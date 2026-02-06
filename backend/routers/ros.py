"""
ROS2 Data Router
Backend에서 rclpy로 구독한 ROS 토픽 데이터를 API로 제공
(rosbridge 대신 사용 - WiFi 부하 감소)
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime

from services.ros_subscriber import ros_service, HAS_RCLPY
from config import config

router = APIRouter()


class TopicDataResponse(BaseModel):
    """토픽 데이터 응답"""
    topic: str
    timestamp: Optional[str] = None
    msg_type: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    available: bool = False


class RosStatusResponse(BaseModel):
    """ROS 상태 응답"""
    ros_available: bool
    node_running: bool
    subscribed_topics: List[str]
    domain_id: Optional[int] = None


@router.get("/status", response_model=RosStatusResponse)
async def get_ros_status():
    """ROS2 연결 상태"""
    import os
    return RosStatusResponse(
        ros_available=HAS_RCLPY,
        node_running=ros_service.is_running,
        subscribed_topics=[t.topic for t in config.ros_topics],
        domain_id=int(os.getenv("ROS_DOMAIN_ID", "0")) if HAS_RCLPY else None,
    )


@router.get("/topics")
async def get_all_topics():
    """모든 구독 중인 토픽 데이터"""
    all_data = ros_service.get_all_data()
    
    result = {}
    for topic_config in config.ros_topics:
        topic = topic_config.topic
        if topic in all_data:
            result[topic] = {
                "name": topic_config.name,
                "available": True,
                **all_data[topic]
            }
        else:
            result[topic] = {
                "name": topic_config.name,
                "available": False,
                "msg_type": topic_config.msg_type,
            }
    
    return result


@router.get("/topic/{topic_path:path}", response_model=TopicDataResponse)
async def get_topic_data(topic_path: str):
    """특정 토픽 데이터"""
    topic = "/" + topic_path if not topic_path.startswith("/") else topic_path
    data = ros_service.get_topic_data(topic)
    
    if data:
        return TopicDataResponse(
            topic=topic,
            timestamp=data.get("timestamp"),
            msg_type=data.get("msg_type"),
            data=data.get("data"),
            available=True,
        )
    else:
        return TopicDataResponse(
            topic=topic,
            available=False,
        )


@router.get("/summary")
async def get_ros_summary():
    """ROS 데이터 요약 (WiFi 트래픽 최소화)"""
    all_data = ros_service.get_all_data()
    
    summary = {
        "timestamp": datetime.now().isoformat(),
        "topics_active": len(all_data),
        "topics_configured": len(config.ros_topics),
    }
    
    # 주요 데이터 요약
    # Battery
    battery_data = all_data.get("/battery_state", {}).get("data", {})
    if battery_data:
        summary["battery"] = {
            "percentage": battery_data.get("percentage", 0) * 100,
            "voltage": battery_data.get("voltage", 0),
        }
    
    # Joint States
    joint_data = all_data.get("/joint_states", {}).get("data", {})
    if joint_data:
        names = joint_data.get("name", [])
        summary["joints"] = {
            "count": len(names) if isinstance(names, list) else 0,
            "names": names[:5] if isinstance(names, list) else [],  # 처음 5개만
        }
    
    # Diagnostics
    diag_data = all_data.get("/diagnostics", {}).get("data", {})
    if diag_data:
        statuses = diag_data.get("status", [])
        summary["diagnostics"] = {
            "count": len(statuses) if isinstance(statuses, list) else 0,
            "errors": sum(1 for s in statuses if isinstance(s, dict) and s.get("level", 0) >= 2) if isinstance(statuses, list) else 0,
        }
    
    return summary
