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


# 실행 중인 PTP 프로세스 추적
_ptp_processes: dict = {"running": False, "pids": []}


@router.get("/{pc_id}/network")
async def get_network_interfaces(pc_id: str):
    """네트워크 인터페이스 목록 및 트래픽 요약 (bmon 스타일)"""
    is_local = (pc_id == "pc1")
    
    if not is_local and pc_id not in config.pcs:
        raise HTTPException(status_code=404, detail=f"PC '{pc_id}' not found")
    
    try:
        if is_local:
            data = await pc_service.get_network_interfaces(None, is_local=True)
        else:
            pc_config = config.pcs[pc_id]
            data = await pc_service.get_network_interfaces(pc_config, is_local=False)
        
        return {"pc_id": pc_id, **data}
    except Exception as e:
        return {"pc_id": pc_id, "interfaces": [], "error": str(e)}


@router.get("/{pc_id}/tegrastats")
async def get_tegrastats_power(pc_id: str, duration: int = 3):
    """Jetson tegrastats로 전력 측정 (PC2 전용)"""
    if pc_id == "pc1":
        return {"pc_id": pc_id, "error": "tegrastats is only for Jetson (PC2)"}
    
    if pc_id not in config.pcs:
        raise HTTPException(status_code=404, detail=f"PC '{pc_id}' not found")
    
    try:
        pc_config = config.pcs[pc_id]
        data = await pc_service.get_tegrastats_power(pc_config, duration_sec=min(duration, 10))
        return {"pc_id": pc_id, **data}
    except Exception as e:
        return {"pc_id": pc_id, "error": str(e)}


@router.post("/time-sync/start")
async def start_time_sync():
    """PTP 시간 동기화 시작 (PC1: slave, PC2: master)"""
    global _ptp_processes
    
    if _ptp_processes["running"]:
        return {"status": "already_running", "message": "Time sync is already running"}
    
    try:
        # PC2 (Master) - sudo 명령어 실행
        pc2_config = config.pcs["pc2"]
        
        # SSH 연결 및 PTP 명령 실행 (백그라운드)
        import paramiko
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if pc2_config.password:
            client.connect(
                hostname=pc2_config.ip,
                port=pc2_config.port,
                username=pc2_config.username,
                password=pc2_config.password,
                timeout=5,
            )
        else:
            client.connect(
                hostname=pc2_config.ip,
                port=pc2_config.port,
                username=pc2_config.username,
                key_filename=pc2_config.ssh_key_path,
                timeout=5,
            )
        
        # PC2에서 PTP master 실행
        pc2_cmd = '''
echo "{password}" | sudo -S bash -c '
nohup ptp4l -i enP2p1s0 --gmCapable 1 -m > /tmp/ptp4l.log 2>&1 &
echo $! > /tmp/ptp4l.pid
sleep 1
nohup phc2sys -s /dev/ptp0 -c CLOCK_REALTIME -O 0 -w -m > /tmp/phc2sys.log 2>&1 &
echo $! > /tmp/phc2sys.pid
'
'''.format(password=pc2_config.password or '')
        
        stdin, stdout, stderr = client.exec_command(pc2_cmd, timeout=10)
        stdout.read()
        client.close()
        
        # PC1 (Slave) - 로컬 실행
        import subprocess
        
        # ptp4l 실행
        ptp4l_proc = subprocess.Popen(
            ['sudo', 'ptp4l', '-i', 'eno1', '-m', '-s'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        
        # phc2sys 실행
        phc2sys_proc = subprocess.Popen(
            ['sudo', 'phc2sys', '-s', '/dev/ptp1', '-c', 'CLOCK_REALTIME', '-O', '0', '-w', '-m'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        
        _ptp_processes = {
            "running": True,
            "pids": [ptp4l_proc.pid, phc2sys_proc.pid],
            "started_at": datetime.now().isoformat(),
        }
        
        return {"status": "started", "message": "PTP time sync started on both PCs"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/time-sync/stop")
async def stop_time_sync():
    """PTP 시간 동기화 중지"""
    global _ptp_processes
    
    if not _ptp_processes["running"]:
        return {"status": "not_running", "message": "Time sync is not running"}
    
    try:
        import subprocess
        
        # PC1 로컬 프로세스 종료
        for pid in _ptp_processes.get("pids", []):
            try:
                subprocess.run(['sudo', 'kill', str(pid)], timeout=5)
            except:
                pass
        
        # sudo로 남아있는 ptp4l, phc2sys 종료
        subprocess.run(['sudo', 'pkill', '-f', 'ptp4l'], timeout=5, check=False)
        subprocess.run(['sudo', 'pkill', '-f', 'phc2sys'], timeout=5, check=False)
        
        # PC2 원격 프로세스 종료
        pc2_config = config.pcs["pc2"]
        
        import paramiko
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if pc2_config.password:
            client.connect(
                hostname=pc2_config.ip,
                port=pc2_config.port,
                username=pc2_config.username,
                password=pc2_config.password,
                timeout=5,
            )
        else:
            client.connect(
                hostname=pc2_config.ip,
                port=pc2_config.port,
                username=pc2_config.username,
                key_filename=pc2_config.ssh_key_path,
                timeout=5,
            )
        
        stop_cmd = '''
echo "{password}" | sudo -S bash -c '
pkill -f ptp4l || true
pkill -f phc2sys || true
'
'''.format(password=pc2_config.password or '')
        
        stdin, stdout, stderr = client.exec_command(stop_cmd, timeout=10)
        stdout.read()
        client.close()
        
        _ptp_processes = {"running": False, "pids": []}
        
        return {"status": "stopped", "message": "PTP time sync stopped on both PCs"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/time-sync/status")
async def get_time_sync_status():
    """PTP 시간 동기화 상태 확인"""
    return {
        "running": _ptp_processes.get("running", False),
        "started_at": _ptp_processes.get("started_at"),
    }

