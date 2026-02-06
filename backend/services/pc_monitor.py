"""
PC Monitor Service
PC1: 로컬 (psutil 직접 호출)
PC2: SSH를 통한 원격 조회
"""
import asyncio
import json
import subprocess
from typing import Dict, Any, Optional
from datetime import datetime
import psutil

try:
    import paramiko
    HAS_PARAMIKO = True
except ImportError:
    HAS_PARAMIKO = False

from config import PCConfig


class PCMonitorService:
    """PC 모니터링 서비스"""
    
    def __init__(self):
        self._ssh_clients: Dict[str, paramiko.SSHClient] = {} if HAS_PARAMIKO else {}
    
    async def get_status(self, pc_config: PCConfig, is_local: bool = False) -> Dict[str, Any]:
        """
        PC 상태 조회
        
        Args:
            pc_config: PC 설정
            is_local: True면 로컬 PC (psutil 직접), False면 SSH
        """
        if is_local:
            return await self._get_local_status()
        else:
            return await self._get_remote_status(pc_config)
    
    async def _get_local_status(self) -> Dict[str, Any]:
        """로컬 PC 상태 조회 (psutil 직접 사용)"""
        def _get_sync():
            result = {}
            
            # CPU
            result['cpu_percent'] = psutil.cpu_percent(interval=0.1)
            
            # Memory
            mem = psutil.virtual_memory()
            result['memory_percent'] = mem.percent
            result['memory_used_gb'] = round(mem.used / (1024**3), 2)
            result['memory_total_gb'] = round(mem.total / (1024**3), 2)
            
            # GPU (nvidia-smi)
            try:
                gpu_output = subprocess.check_output([
                    'nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,power.draw,temperature.gpu',
                    '--format=csv,noheader,nounits'
                ], timeout=3).decode().strip().split(',')
                result['gpu_percent'] = float(gpu_output[0].strip())
                result['gpu_memory_used_mb'] = int(gpu_output[1].strip())
                result['gpu_memory_total_mb'] = int(gpu_output[2].strip())
                result['power_watts'] = float(gpu_output[3].strip())
                result['temperature'] = float(gpu_output[4].strip())
            except Exception:
                result['gpu_percent'] = 0
                result['gpu_memory_used_mb'] = 0
                result['gpu_memory_total_mb'] = 0
                result['power_watts'] = 0
                result['temperature'] = 0
            
            # Time
            result['pc_time'] = datetime.now().isoformat()
            
            return result
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _get_sync)
    
    async def _get_remote_status(self, pc_config: PCConfig) -> Dict[str, Any]:
        """원격 PC 상태 조회 (SSH)"""
        if not HAS_PARAMIKO:
            raise ImportError("paramiko is required for SSH. Install with: pip install paramiko")
        
        def _get_sync():
            client = self._get_ssh_client(pc_config)
            
            # Python 스크립트로 모든 정보 한 번에 조회
            script = '''
python3 -c "
import json
import psutil
import subprocess
from datetime import datetime

result = {}
result['cpu_percent'] = psutil.cpu_percent(interval=0.1)

mem = psutil.virtual_memory()
result['memory_percent'] = mem.percent
result['memory_used_gb'] = round(mem.used / (1024**3), 2)
result['memory_total_gb'] = round(mem.total / (1024**3), 2)

try:
    gpu_output = subprocess.check_output([
        'nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,power.draw,temperature.gpu',
        '--format=csv,noheader,nounits'
    ], timeout=3).decode().strip().split(',')
    result['gpu_percent'] = float(gpu_output[0].strip())
    result['gpu_memory_used_mb'] = int(gpu_output[1].strip())
    result['gpu_memory_total_mb'] = int(gpu_output[2].strip())
    result['power_watts'] = float(gpu_output[3].strip())
    result['temperature'] = float(gpu_output[4].strip())
except:
    pass

result['pc_time'] = datetime.now().isoformat()
print(json.dumps(result))
"
'''
            stdin, stdout, stderr = client.exec_command(script, timeout=10)
            output = stdout.read().decode().strip()
            
            return json.loads(output)
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _get_sync)
    
    def _get_ssh_client(self, pc_config: PCConfig):
        """SSH 클라이언트 생성 또는 재사용"""
        key = f"{pc_config.ip}:{pc_config.port}"
        
        if key in self._ssh_clients:
            client = self._ssh_clients[key]
            if client.get_transport() and client.get_transport().is_active():
                return client
        
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if pc_config.ssh_key_path:
            client.connect(
                hostname=pc_config.ip,
                port=pc_config.port,
                username=pc_config.username,
                key_filename=pc_config.ssh_key_path,
                timeout=5,
            )
        elif pc_config.password:
            client.connect(
                hostname=pc_config.ip,
                port=pc_config.port,
                username=pc_config.username,
                password=pc_config.password,
                timeout=5,
            )
        else:
            client.connect(
                hostname=pc_config.ip,
                port=pc_config.port,
                username=pc_config.username,
                timeout=5,
            )
        
        self._ssh_clients[key] = client
        return client
    
    def close_all(self):
        """모든 SSH 연결 종료"""
        for client in self._ssh_clients.values():
            try:
                client.close()
            except:
                pass
        self._ssh_clients.clear()
