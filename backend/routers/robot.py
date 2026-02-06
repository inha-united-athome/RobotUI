"""
Robot Status Router
로봇 SDK를 통한 상태 조회 (placeholder)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

from services.robot_sdk import get_robot_state

router = APIRouter()


class RobotStateResponse(BaseModel):
    """로봇 상태 응답"""
    status: str  # "ok", "error", "disconnected"
    timestamp: datetime
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.get("/state", response_model=RobotStateResponse)
async def get_state():
    """로봇 현재 상태 조회 (SDK 사용)"""
    try:
        state = await get_robot_state()
        return RobotStateResponse(
            status="ok",
            timestamp=datetime.now(),
            data=state
        )
    except Exception as e:
        return RobotStateResponse(
            status="error",
            timestamp=datetime.now(),
            error=str(e)
        )


@router.get("/info")
async def get_robot_info():
    """로봇 기본 정보"""
    return {
        "name": "Robot",
        "sdk_version": "placeholder",
        "note": "Robot SDK를 연동하면 이 정보가 업데이트됩니다."
    }
