"""
Robot SDK Service (Placeholder)
실제 로봇 SDK를 연동하려면 이 파일을 수정하세요.
"""
from typing import Dict, Any


async def get_robot_state() -> Dict[str, Any]:
    """
    로봇 현재 상태 조회
    
    TODO: 실제 SDK 연동 시 이 함수를 수정하세요.
    
    예시:
    ```python
    from your_robot_sdk import Robot
    
    robot = Robot()
    state = robot.get_current_state()
    return {
        "position": state.position,
        "velocity": state.velocity,
        "joint_angles": state.joint_angles,
        ...
    }
    ```
    """
    # Placeholder 데이터
    return {
        "status": "placeholder",
        "message": "Robot SDK가 아직 연동되지 않았습니다.",
        "note": "backend/services/robot_sdk.py를 수정하여 실제 SDK를 연동하세요.",
        # 예시 데이터 구조
        "example_data": {
            "position": {"x": 0.0, "y": 0.0, "z": 0.0},
            "orientation": {"roll": 0.0, "pitch": 0.0, "yaw": 0.0},
            "joint_angles": [],
            "battery_percent": None,
            "is_running": False,
        }
    }


# SDK 초기화 함수 (필요시)
def init_robot_sdk():
    """
    SDK 초기화
    앱 시작 시 호출됩니다.
    """
    pass


# SDK 종료 함수 (필요시)  
def shutdown_robot_sdk():
    """
    SDK 종료
    앱 종료 시 호출됩니다.
    """
    pass
