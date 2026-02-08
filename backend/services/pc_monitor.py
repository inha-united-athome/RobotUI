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
            # CPU percent는 interval=0.5로 더 정확하게 측정
            script = '''
python3 -c "
import json
import psutil
import subprocess
from datetime import datetime

result = {}

# CPU - interval을 0.5로 늘려서 더 정확한 값 측정
result['cpu_percent'] = psutil.cpu_percent(interval=0.5)

mem = psutil.virtual_memory()
result['memory_percent'] = mem.percent
result['memory_used_gb'] = round(mem.used / (1024**3), 2)
result['memory_total_gb'] = round(mem.total / (1024**3), 2)

# Jetson의 경우 tegrastats 또는 nvidia-smi 대신 다른 방법 사용
try:
    # 먼저 tegrastats 확인 (Jetson용)
    import os
    if os.path.exists('/usr/bin/tegrastats'):
        # Jetson에서는 GPU/CPU가 통합되어 있음, power/temp 조회
        with open('/sys/devices/gpu.0/load', 'r') as f:
            result['gpu_percent'] = int(f.read().strip()) / 10.0
    else:
        # 일반 NVIDIA GPU
        gpu_output = subprocess.check_output([
            'nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,power.draw,temperature.gpu',
            '--format=csv,noheader,nounits'
        ], timeout=3).decode().strip().split(',')
        result['gpu_percent'] = float(gpu_output[0].strip())
        result['gpu_memory_used_mb'] = int(gpu_output[1].strip())
        result['gpu_memory_total_mb'] = int(gpu_output[2].strip())
        result['power_watts'] = float(gpu_output[3].strip())
        result['temperature'] = float(gpu_output[4].strip())
except Exception as e:
    result['gpu_error'] = str(e)

# Temperature (thermal zone)
try:
    with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
        result['temperature'] = round(int(f.read().strip()) / 1000.0, 1)
except:
    pass

# Power (Jetson)
try:
    import subprocess
    power_out = subprocess.check_output(['cat', '/sys/bus/i2c/drivers/ina3221x/1-0040/iio:device0/in_power0_input'], timeout=2)
    result['power_watts'] = round(int(power_out.strip()) / 1000.0, 1)
except:
    pass

result['pc_time'] = datetime.now().isoformat()
print(json.dumps(result))
"
'''
            stdin, stdout, stderr = client.exec_command(script, timeout=15)
            output = stdout.read().decode().strip()
            error = stderr.read().decode().strip()
            
            if error and not output:
                return {"error": error}
            
            return json.loads(output) if output else {"error": "No output"}
        
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
    
    async def get_processes(self, pc_config: PCConfig, is_local: bool = False, top_n: int = 10) -> list:
        """
        CPU/메모리 상위 프로세스 목록 조회
        
        Args:
            pc_config: PC 설정
            is_local: True면 로컬 PC
            top_n: 반환할 프로세스 수
        """
        if is_local:
            return await self._get_local_processes(top_n)
        else:
            return await self._get_remote_processes(pc_config, top_n)
    
    async def _get_local_processes(self, top_n: int = 10) -> list:
        """로컬 PC 프로세스 목록"""
        def _get_sync():
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'username']):
                try:
                    pinfo = proc.info
                    if pinfo['cpu_percent'] is not None and pinfo['memory_percent'] is not None:
                        processes.append({
                            'pid': pinfo['pid'],
                            'name': pinfo['name'],
                            'cpu_percent': round(pinfo['cpu_percent'], 1),
                            'memory_percent': round(pinfo['memory_percent'], 1),
                            'user': pinfo['username'] or 'N/A',
                        })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            # CPU 사용률 기준 정렬
            processes.sort(key=lambda x: x['cpu_percent'], reverse=True)
            return processes[:top_n]
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _get_sync)
    
    async def _get_remote_processes(self, pc_config: PCConfig, top_n: int = 10) -> list:
        """원격 PC 프로세스 목록 (SSH)"""
        if not HAS_PARAMIKO:
            return []
        
        def _get_sync():
            client = self._get_ssh_client(pc_config)
            
            script = f'''
python3 -c "
import json
import psutil

processes = []
for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'username']):
    try:
        pinfo = proc.info
        if pinfo['cpu_percent'] is not None and pinfo['memory_percent'] is not None:
            processes.append({{
                'pid': pinfo['pid'],
                'name': pinfo['name'],
                'cpu_percent': round(pinfo['cpu_percent'], 1),
                'memory_percent': round(pinfo['memory_percent'], 1),
                'user': pinfo['username'] or 'N/A',
            }})
    except:
        pass

processes.sort(key=lambda x: x['cpu_percent'], reverse=True)
print(json.dumps(processes[:{top_n}]))
"
'''
            stdin, stdout, stderr = client.exec_command(script, timeout=10)
            output = stdout.read().decode().strip()
            
            return json.loads(output) if output else []
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _get_sync)

    async def get_tegrastats_power(self, pc_config: PCConfig, duration_sec: int = 3) -> Dict[str, Any]:
        """
        Jetson tegrastats로 전력 측정 (평균값)
        
        Args:
            pc_config: PC 설정
            duration_sec: 측정 시간 (초)
        """
        if not HAS_PARAMIKO:
            return {"error": "paramiko required"}
        
        def _get_sync():
            client = self._get_ssh_client(pc_config)
            
            # tegrastats를 duration_sec 동안 실행하고 전력 값 파싱
            script = f'''
timeout {duration_sec} tegrastats --interval 1000 2>/dev/null | python3 -c "
import sys
import re

powers = []
for line in sys.stdin:
    # VDD_IN 또는 VDD_CPU_GPU_CV 패턴 찾기
    # 예: VDD_IN 4500mW/4500mW
    matches = re.findall(r'VDD_(?:IN|CPU_GPU_CV|SYS_SOC|SOC|GPU|CPU)\\s+(\\d+)mW', line)
    if matches:
        # 첫 번째 값(현재 전력)만 사용
        powers.append(int(matches[0]))

if powers:
    import json
    print(json.dumps({{
        'avg_power_mw': sum(powers) / len(powers),
        'min_power_mw': min(powers),
        'max_power_mw': max(powers),
        'samples': len(powers)
    }}))
else:
    print('{{}}')
"
'''
            stdin, stdout, stderr = client.exec_command(script, timeout=duration_sec + 5)
            output = stdout.read().decode().strip()
            
            if output:
                try:
                    data = json.loads(output)
                    # mW를 W로 변환
                    if 'avg_power_mw' in data:
                        data['avg_power_watts'] = round(data['avg_power_mw'] / 1000, 2)
                        data['min_power_watts'] = round(data['min_power_mw'] / 1000, 2)
                        data['max_power_watts'] = round(data['max_power_mw'] / 1000, 2)
                    return data
                except json.JSONDecodeError:
                    return {"error": "Failed to parse tegrastats output"}
            return {"error": "No tegrastats output"}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _get_sync)

    async def get_network_interfaces(self, pc_config: PCConfig, is_local: bool = False) -> Dict[str, Any]:
        """
        네트워크 인터페이스 목록 및 트래픽 요약 (bmon 스타일)
        """
        if is_local:
            return await self._get_local_network()
        else:
            return await self._get_remote_network(pc_config)
    
    async def _get_local_network(self) -> Dict[str, Any]:
        """로컬 네트워크 인터페이스 정보"""
        def _get_sync():
            import socket
            
            interfaces = []
            net_io = psutil.net_io_counters(pernic=True)
            net_if_addrs = psutil.net_if_addrs()
            net_if_stats = psutil.net_if_stats()
            
            for iface, counters in net_io.items():
                # lo (loopback) 제외
                if iface == 'lo':
                    continue
                
                stats = net_if_stats.get(iface)
                addrs = net_if_addrs.get(iface, [])
                
                # IPv4 주소 찾기
                ipv4 = None
                for addr in addrs:
                    if addr.family == socket.AF_INET:
                        ipv4 = addr.address
                        break
                
                interfaces.append({
                    'name': iface,
                    'is_up': stats.isup if stats else False,
                    'speed_mbps': stats.speed if stats else 0,
                    'mtu': stats.mtu if stats else 0,
                    'ipv4': ipv4,
                    'rx_bytes': counters.bytes_recv,
                    'tx_bytes': counters.bytes_sent,
                    'rx_packets': counters.packets_recv,
                    'tx_packets': counters.packets_sent,
                    'rx_errors': counters.errin,
                    'tx_errors': counters.errout,
                    'rx_drops': counters.dropin,
                    'tx_drops': counters.dropout,
                })
            
            return {'interfaces': interfaces, 'timestamp': datetime.now().isoformat()}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _get_sync)
    
    async def _get_remote_network(self, pc_config: PCConfig) -> Dict[str, Any]:
        """원격 PC 네트워크 인터페이스 정보 (SSH)"""
        if not HAS_PARAMIKO:
            return {"error": "paramiko required"}
        
        def _get_sync():
            client = self._get_ssh_client(pc_config)
            
            script = '''
python3 -c "
import json
import psutil
import socket
from datetime import datetime

interfaces = []
net_io = psutil.net_io_counters(pernic=True)
net_if_addrs = psutil.net_if_addrs()
net_if_stats = psutil.net_if_stats()

for iface, counters in net_io.items():
    if iface == 'lo':
        continue
    
    stats = net_if_stats.get(iface)
    addrs = net_if_addrs.get(iface, [])
    
    ipv4 = None
    for addr in addrs:
        if addr.family == socket.AF_INET:
            ipv4 = addr.address
            break
    
    interfaces.append({
        'name': iface,
        'is_up': stats.isup if stats else False,
        'speed_mbps': stats.speed if stats else 0,
        'mtu': stats.mtu if stats else 0,
        'ipv4': ipv4,
        'rx_bytes': counters.bytes_recv,
        'tx_bytes': counters.bytes_sent,
        'rx_packets': counters.packets_recv,
        'tx_packets': counters.packets_sent,
        'rx_errors': counters.errin,
        'tx_errors': counters.errout,
        'rx_drops': counters.dropin,
        'tx_drops': counters.dropout,
    })

print(json.dumps({'interfaces': interfaces, 'timestamp': datetime.now().isoformat()}))
"
'''
            stdin, stdout, stderr = client.exec_command(script, timeout=10)
            output = stdout.read().decode().strip()
            
            return json.loads(output) if output else {"interfaces": []}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _get_sync)

