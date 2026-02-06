"""
PC Monitor Router
PC1: 로컬 (직접 조회)
PC2: SSH 원격 조회
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from services.pc_monitor import PCMonitorService
from config import config

router = APIRouter()
pc_service = PCMonitorService()


class PCStatusResponse(BaseModel):
    """PC 상태 응답"""
    pc_id: str
    online: bool
    is_local: bool = False
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    memory_used_gb: Optional[float] = None
    memory_total_gb: Optional[float] = None
    gpu_percent: Optional[float] = None
    gpu_memory_used_mb: Optional[int] = None
    gpu_memory_total_mb: Optional[int] = None
    power_watts: Optional[float] = None
    temperature: Optional[float] = None
    pc_time: Optional[str] = None
    lan_time: str
    time_diff_ms: Optional[float] = None
    error: Optional[str] = None


class PCConfigRequest(BaseModel):
    """PC 설정 요청"""
    pc2_ip: Optional[str] = None
    pc2_user: Optional[str] = None
    pc2_password: Optional[str] = None


@router.get("/{pc_id}/status", response_model=PCStatusResponse)
async def get_pc_status(pc_id: str):
    """특정 PC 상태 조회"""
    lan_time = datetime.now()
    
    # PC1은 로컬, PC2는 원격
    is_local = (pc_id == "pc1")
    
    if not is_local and pc_id not in config.pcs:
        raise HTTPException(status_code=404, detail=f"PC '{pc_id}' not found")
    
    try:
        if is_local:
            # PC1: 로컬 직접 조회
            status = await pc_service.get_status(None, is_local=True)
        else:
            # PC2: SSH 원격 조회
            pc_config = config.pcs[pc_id]
            status = await pc_service.get_status(pc_config, is_local=False)
        
        # 시간 차이 계산
        time_diff_ms = None
        if status.get("pc_time"):
            try:
                pc_time = datetime.fromisoformat(status["pc_time"])
                time_diff_ms = abs((lan_time - pc_time).total_seconds() * 1000)
            except:
                pass
        
        return PCStatusResponse(
            pc_id=pc_id,
            online=True,
            is_local=is_local,
            cpu_percent=status.get("cpu_percent"),
            memory_percent=status.get("memory_percent"),
            memory_used_gb=status.get("memory_used_gb"),
            memory_total_gb=status.get("memory_total_gb"),
            gpu_percent=status.get("gpu_percent"),
            gpu_memory_used_mb=status.get("gpu_memory_used_mb"),
            gpu_memory_total_mb=status.get("gpu_memory_total_mb"),
            power_watts=status.get("power_watts"),
            temperature=status.get("temperature"),
            pc_time=status.get("pc_time"),
            lan_time=lan_time.isoformat(),
            time_diff_ms=time_diff_ms,
        )
    except Exception as e:
        return PCStatusResponse(
            pc_id=pc_id,
            online=False,
            is_local=is_local,
            lan_time=lan_time.isoformat(),
            error=str(e),
        )


@router.get("/all")
async def get_all_pcs_status():
    """모든 PC 상태 조회"""
    results = {}
    for pc_id in ["pc1", "pc2"]:
        status = await get_pc_status(pc_id)
        results[pc_id] = status
    return results


@router.post("/config")
async def update_pc_config(req: PCConfigRequest):
    """PC2 설정 업데이트 (PC1은 로컬이므로 설정 불필요)"""
    if req.pc2_ip:
        config.pcs["pc2"].ip = req.pc2_ip
    if req.pc2_user:
        config.pcs["pc2"].username = req.pc2_user
    if req.pc2_password:
        config.pcs["pc2"].password = req.pc2_password
    
    return {"status": "ok", "message": "PC2 configuration updated"}


@router.get("/config")
async def get_pc_config():
    """현재 PC 설정 조회"""
    return {
        "pc1": {"type": "local", "note": "이 PC (Backend 실행 중)"},
        "pc2": {
            "type": "remote",
            "ip": config.pcs["pc2"].ip,
            "username": config.pcs["pc2"].username,
            "port": config.pcs["pc2"].port,
        }
    }


@router.get("/{pc_id}/processes")
async def get_pc_processes(pc_id: str, top_n: int = 10):
    """특정 PC의 상위 프로세스 목록 조회"""
    is_local = (pc_id == "pc1")
    
    if not is_local and pc_id not in config.pcs:
        raise HTTPException(status_code=404, detail=f"PC '{pc_id}' not found")
    
    try:
        if is_local:
            processes = await pc_service.get_processes(None, is_local=True, top_n=top_n)
        else:
            pc_config = config.pcs[pc_id]
            processes = await pc_service.get_processes(pc_config, is_local=False, top_n=top_n)
        
        return {"pc_id": pc_id, "processes": processes}
    except Exception as e:
        return {"pc_id": pc_id, "processes": [], "error": str(e)}

