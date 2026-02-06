"""
Sensors Router
센서 연결 상태 확인 (ping, RealSense, USB)
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from services.sensor_check import SensorCheckService
from config import config, SensorConfig

router = APIRouter()
sensor_service = SensorCheckService()


class LidarStatus(BaseModel):
    """LiDAR 상태"""
    name: str
    ip: str
    online: bool
    ping_ms: Optional[float] = None


class RealSenseStatus(BaseModel):
    """RealSense 상태"""
    name: str
    serial: str
    connected: bool
    device_name: Optional[str] = None


class CameraStatus(BaseModel):
    """일반 카메라 상태"""
    device: str
    available: bool


class AudioStatus(BaseModel):
    """오디오 장치 상태"""
    name: str
    type: str  # "speaker" or "microphone"
    connected: bool


class SensorsStatusResponse(BaseModel):
    """전체 센서 상태 응답"""
    timestamp: datetime
    lidars: List[LidarStatus]
    realsense: List[RealSenseStatus]
    cameras: List[CameraStatus]
    audio: List[AudioStatus]


class SensorConfigRequest(BaseModel):
    """센서 설정 요청"""
    lidar_2d_ip: Optional[str] = None
    lidar_3d_ip: Optional[str] = None
    realsense_serials: Optional[List[str]] = None


@router.get("/status", response_model=SensorsStatusResponse)
async def get_sensors_status():
    """모든 센서 상태 조회"""
    lidars = []
    realsense_list = []
    
    # LiDAR 확인
    for sensor in config.sensors:
        if sensor.type in ["lidar_2d", "lidar_3d"] and sensor.ip:
            ping_result = await sensor_service.ping_host(sensor.ip)
            lidars.append(LidarStatus(
                name=sensor.name,
                ip=sensor.ip,
                online=ping_result["online"],
                ping_ms=ping_result.get("ping_ms"),
            ))
    
    # RealSense 확인
    connected_rs = await sensor_service.get_realsense_devices()
    for sensor in config.sensors:
        if sensor.type == "realsense" and sensor.serial:
            is_connected = sensor.serial in connected_rs
            device_name = connected_rs.get(sensor.serial)
            realsense_list.append(RealSenseStatus(
                name=sensor.name,
                serial=sensor.serial,
                connected=is_connected,
                device_name=device_name,
            ))
    
    # 일반 카메라 확인
    cameras = await sensor_service.get_video_devices()
    
    # 오디오 장치 확인
    audio_status = await sensor_service.get_audio_devices()
    audio_list = [
        AudioStatus(name="Speaker", type="speaker", connected=audio_status.get("speaker", False)),
        AudioStatus(name="Microphone", type="microphone", connected=audio_status.get("microphone", False)),
    ]
    
    return SensorsStatusResponse(
        timestamp=datetime.now(),
        lidars=lidars,
        realsense=realsense_list,
        cameras=cameras,
        audio=audio_list,
    )


@router.get("/ping/{ip}")
async def ping_sensor(ip: str):
    """특정 IP ping 테스트"""
    result = await sensor_service.ping_host(ip)
    return result


@router.get("/realsense")
async def get_realsense_devices():
    """연결된 RealSense 기기 목록"""
    devices = await sensor_service.get_realsense_devices()
    return {"devices": devices}


@router.get("/cameras")
async def get_camera_devices():
    """사용 가능한 카메라 디바이스 목록"""
    cameras = await sensor_service.get_video_devices()
    return {"cameras": cameras}


@router.post("/config")
async def update_sensor_config(req: SensorConfigRequest):
    """센서 설정 업데이트"""
    for sensor in config.sensors:
        if sensor.type == "lidar_2d" and req.lidar_2d_ip:
            sensor.ip = req.lidar_2d_ip
        elif sensor.type == "lidar_3d" and req.lidar_3d_ip:
            sensor.ip = req.lidar_3d_ip
    
    if req.realsense_serials:
        rs_sensors = [s for s in config.sensors if s.type == "realsense"]
        for i, serial in enumerate(req.realsense_serials):
            if i < len(rs_sensors):
                rs_sensors[i].serial = serial
    
    return {"status": "ok", "message": "Sensor configuration updated"}


@router.get("/config")
async def get_sensor_config():
    """현재 센서 설정 조회"""
    return {
        "sensors": [
            {
                "name": s.name,
                "type": s.type,
                "ip": s.ip,
                "serial": s.serial,
                "device": s.device,
            }
            for s in config.sensors
        ]
    }
