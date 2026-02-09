"""
Robot Web UI Backend Configuration
PC1: 로컬 (이 PC)
PC2: 원격 (SSH)
"""
from pydantic import BaseModel
from typing import Dict, List, Optional
import os
from dotenv import load_dotenv

load_dotenv()


class PCConfig(BaseModel):
    """PC 접속 설정"""
    ip: str = ""
    port: int = 22
    username: str = "robot"
    ssh_key_path: Optional[str] = None
    password: Optional[str] = None


class SensorConfig(BaseModel):
    """센서 설정"""
    name: str
    type: str  # "lidar_2d", "lidar_3d", "realsense", "camera"
    ip: Optional[str] = None
    serial: Optional[str] = None
    device: Optional[str] = None


class RosTopicConfig(BaseModel):
    """ROS 토픽 설정"""
    name: str
    topic: str
    msg_type: str
    throttle_hz: float = 1.0  # WiFi 부하 줄이기 위해 낮은 Hz로 샘플링


class AppConfig(BaseModel):
    """전체 앱 설정"""
    
    # PC 설정 (PC1은 로컬이므로 설정 불필요, PC2만 설정)
    pcs: Dict[str, PCConfig] = {
        "pc2": PCConfig(
            ip=os.getenv("PC2_IP", "192.168.78.11"),
            username=os.getenv("PC2_USER", "robot"),
            password=os.getenv("PC2_PASSWORD"),
            ssh_key_path=os.getenv("PC2_SSH_KEY"),
        ),
    }
    
    # 센서 설정
    sensors: List[SensorConfig] = [
        # LiDAR (2D 2개, 3D 1개)
        SensorConfig(name="2D LiDAR #1", type="lidar_2d", ip=os.getenv("LIDAR_2D_IP_1", os.getenv("LIDAR_2D_IP", "192.168.30.10"))),
        SensorConfig(name="2D LiDAR #2", type="lidar_2d", ip=os.getenv("LIDAR_2D_IP_2", "192.168.30.11")),
        SensorConfig(name="3D LiDAR", type="lidar_3d", ip=os.getenv("LIDAR_3D_IP", "192.168.78.110")),
        # Audio
        SensorConfig(name="Speaker", type="audio_output"),
        SensorConfig(name="Microphone", type="audio_input"),
        # RealSense
        SensorConfig(name="RealSense #1", type="realsense", serial=os.getenv("RS_SERIAL_1", "")),
        SensorConfig(name="RealSense #2", type="realsense", serial=os.getenv("RS_SERIAL_2", "")),
        SensorConfig(name="RealSense #3", type="realsense", serial=os.getenv("RS_SERIAL_3", "")),
    ]
    
    # ROS 토픽 (Backend에서 구독하여 API로 제공)
    ros_topics: List[RosTopicConfig] = [
        RosTopicConfig(name="Joint States", topic="/joint_states", msg_type="sensor_msgs/msg/JointState", throttle_hz=10),
        RosTopicConfig(name="Battery", topic="/battery_state", msg_type="sensor_msgs/msg/BatteryState", throttle_hz=1),
        RosTopicConfig(name="IMU", topic="/imu/data", msg_type="sensor_msgs/msg/Imu", throttle_hz=10),
        RosTopicConfig(name="TF", topic="/tf", msg_type="tf2_msgs/msg/TFMessage", throttle_hz=5),
        RosTopicConfig(name="Diagnostics", topic="/diagnostics", msg_type="diagnostic_msgs/msg/DiagnosticArray", throttle_hz=1),
    ]
    
    # CORS 설정
    cors_origins: List[str] = ["*"]  # 모든 origin 허용 (WiFi 접속용)
    
    # WiFi IP (브라우저 접속용)
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))


# 전역 설정 인스턴스
config = AppConfig()
