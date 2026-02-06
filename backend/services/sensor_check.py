"""
Sensor Check Service
센서 연결 상태 확인 (ping, RealSense, USB cameras)
"""
import asyncio
import subprocess
import os
import re
from typing import Dict, List, Optional

try:
    import paramiko
    HAS_PARAMIKO = True
except ImportError:
    HAS_PARAMIKO = False

from config import config


class SensorCheckService:
    """센서 연결 확인 서비스"""
    
    def __init__(self):
        self._ssh_client = None
        self._pc2_config = config.pcs.get("pc2") if hasattr(config, 'pcs') else None
    
    def _get_ssh_client(self):
        """PC2 SSH 클라이언트 생성 또는 재사용"""
        if not HAS_PARAMIKO:
            raise ImportError("paramiko is required for SSH")
        
        if not self._pc2_config:
            raise ValueError("PC2 config not found")
        
        if self._ssh_client:
            try:
                if self._ssh_client.get_transport() and self._ssh_client.get_transport().is_active():
                    return self._ssh_client
            except:
                pass
        
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        pc = self._pc2_config
        if pc.ssh_key_path:
            client.connect(
                hostname=pc.ip,
                port=pc.port,
                username=pc.username,
                key_filename=pc.ssh_key_path,
                timeout=5,
            )
        else:
            client.connect(
                hostname=pc.ip,
                port=pc.port,
                username=pc.username,
                password=pc.password,
                timeout=5,
            )
        
        self._ssh_client = client
        return client
    
    def _run_remote_command(self, command: str, timeout: int = 10) -> tuple:
        """PC2에서 명령 실행"""
        client = self._get_ssh_client()
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        return stdout.read().decode().strip(), stderr.read().decode().strip()
    
    async def ping_host(self, ip: str, timeout: float = 1.0) -> Dict:
        """
        IP로 ping 테스트
        
        Returns:
            {"online": bool, "ping_ms": float | None}
        """
        def _ping_sync():
            try:
                # Linux ping: -c 1 (1회), -W timeout (초)
                result = subprocess.run(
                    ["ping", "-c", "1", "-W", str(int(timeout)), ip],
                    stdin=subprocess.DEVNULL,
                    capture_output=True,
                    text=True,
                    timeout=timeout + 1,
                )
                
                if result.returncode == 0:
                    # ping 시간 추출
                    match = re.search(r"time[=<](\d+\.?\d*)", result.stdout)
                    ping_ms = float(match.group(1)) if match else None
                    return {"online": True, "ping_ms": ping_ms, "ip": ip}
                else:
                    return {"online": False, "ping_ms": None, "ip": ip}
                    
            except subprocess.TimeoutExpired:
                return {"online": False, "ping_ms": None, "ip": ip, "error": "timeout"}
            except Exception as e:
                return {"online": False, "ping_ms": None, "ip": ip, "error": str(e)}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _ping_sync)
    
    async def get_realsense_devices(self) -> Dict[str, str]:
        """
        연결된 RealSense 기기 목록
        rs-enumerate-devices 사용
        
        Returns:
            {serial_number: device_name, ...}
        """
        def _enumerate_sync():
            devices = {}
            try:
                result = subprocess.run(
                    ["rs-enumerate-devices"],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                
                if result.returncode == 0:
                    lines = result.stdout.split('\n')
                    current_name = None
                    
                    for line in lines:
                        # Device Name 찾기
                        if "Name" in line and ":" in line:
                            current_name = line.split(":")[-1].strip()
                        # Serial Number 찾기
                        elif "Serial Number" in line and ":" in line:
                            serial = line.split(":")[-1].strip()
                            if serial and current_name:
                                devices[serial] = current_name
                                current_name = None
                
            except FileNotFoundError:
                # rs-enumerate-devices가 없는 경우
                pass
            except subprocess.TimeoutExpired:
                pass
            except Exception as e:
                pass
            
            return devices
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _enumerate_sync)
    
    async def get_video_devices(self) -> List[Dict]:
        """
        사용 가능한 /dev/video* 디바이스 목록
        
        Returns:
            [{"device": "/dev/video0", "available": True}, ...]
        """
        def _check_devices_sync():
            devices = []
            
            # /dev/video* 찾기
            dev_path = "/dev"
            try:
                for entry in os.listdir(dev_path):
                    if entry.startswith("video"):
                        device_path = os.path.join(dev_path, entry)
                        # 디바이스 접근 가능 여부 확인
                        available = os.access(device_path, os.R_OK)
                        devices.append({
                            "device": device_path,
                            "available": available,
                        })
            except Exception:
                pass
            
            # 정렬
            devices.sort(key=lambda x: x["device"])
            return devices
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _check_devices_sync)
    
    async def check_usb_device(self, vendor_id: str, product_id: str) -> bool:
        """
        특정 USB 장치가 연결되어 있는지 확인
        
        Args:
            vendor_id: USB Vendor ID (예: "8086")
            product_id: USB Product ID (예: "0b07")
        
        Returns:
            연결 여부
        """
        def _check_sync():
            try:
                result = subprocess.run(
                    ["lsusb"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                
                search_pattern = f"{vendor_id}:{product_id}".lower()
                return search_pattern in result.stdout.lower()
                
            except Exception:
                return False
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _check_sync)
    
    async def get_audio_devices(self) -> Dict[str, bool]:
        """
        오디오 장치 연결 상태 확인 (PC2에서 SSH로 실행)
        aplay -l (스피커), arecord -l (마이크)
        
        Returns:
            {"speaker": bool, "microphone": bool}
        """
        def _check_audio_sync():
            result = {"speaker": False, "microphone": False}
            
            try:
                # PC2에서 aplay -l 실행
                stdout, stderr = self._run_remote_command("aplay -l")
                if "card" in stdout.lower():
                    result["speaker"] = True
            except Exception as e:
                result["speaker_error"] = str(e)
            
            try:
                # PC2에서 arecord -l 실행
                stdout, stderr = self._run_remote_command("arecord -l")
                if "card" in stdout.lower():
                    result["microphone"] = True
            except Exception as e:
                result["microphone_error"] = str(e)
            
            return result
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _check_audio_sync)
    
    async def list_audio_devices(self) -> Dict[str, list]:
        """
        사용 가능한 오디오 장치 목록 조회 (PC2에서 SSH로 실행)
        
        Returns:
            {"speakers": [...], "microphones": [...]}
        """
        def _list_sync():
            result = {"speakers": [], "microphones": []}
            
            def parse_audio_output(output_str, device_list):
                for line in output_str.split('\n'):
                    if line.startswith('card '):
                        parts = line.split(':')
                        if len(parts) >= 2:
                            card_info = parts[0].strip()
                            card_num = card_info.split()[1] if len(card_info.split()) > 1 else "0"
                            name = parts[1].split('[')[0].strip() if '[' in parts[1] else parts[1].strip()
                            device = "0"
                            if 'device' in line:
                                device_part = line.split('device')[1]
                                device = device_part.split(':')[0].strip()
                            device_list.append({
                                "id": f"hw:{card_num},{device}",
                                "name": name,
                                "card": int(card_num),
                                "device": int(device),
                            })
            
            # PC2에서 aplay -l 실행
            try:
                stdout, stderr = self._run_remote_command("aplay -l")
                parse_audio_output(stdout, result["speakers"])
            except Exception as e:
                result["speaker_error"] = str(e)
            
            # PC2에서 arecord -l 실행
            try:
                stdout, stderr = self._run_remote_command("arecord -l")
                parse_audio_output(stdout, result["microphones"])
            except Exception as e:
                result["microphone_error"] = str(e)
            
            return result
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _list_sync)
    
    async def test_speaker(self, device_id: str = "default") -> Dict:
        """
        스피커 테스트 (짧은 비프음 재생) - PC2에서 SSH로 실행
        
        Args:
            device_id: ALSA 장치 ID (예: "hw:0,0" 또는 "default")
        """
        def _test_sync():
            try:
                # PC2에서 speaker-test 실행 (timeout 3초)
                cmd = f"timeout 3 speaker-test -D {device_id} -c 2 -t sine -f 440 -l 1 2>&1 || true"
                stdout, stderr = self._run_remote_command(cmd, timeout=5)
                return {"success": True, "device": device_id, "message": "Test tone played"}
            except Exception as e:
                return {"success": False, "device": device_id, "error": str(e)}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _test_sync)
    
    async def test_microphone(self, device_id: str = "default", duration: float = 2.0) -> Dict:
        """
        마이크 테스트 (녹음 후 레벨 확인) - PC2에서 SSH로 실행
        
        Args:
            device_id: ALSA 장치 ID
            duration: 녹음 시간 (초)
        """
        def _test_sync():
            try:
                # PC2에서 arecord로 녹음 테스트
                cmd = f"arecord -D {device_id} -d {int(duration)} -f cd /tmp/mic_test.wav 2>&1 && ls -la /tmp/mic_test.wav && rm -f /tmp/mic_test.wav"
                stdout, stderr = self._run_remote_command(cmd, timeout=int(duration) + 5)
                if "mic_test.wav" in stdout:
                    return {"success": True, "device": device_id, "message": "Recording completed"}
                else:
                    return {"success": False, "device": device_id, "error": stderr or "Recording failed"}
            except Exception as e:
                return {"success": False, "device": device_id, "error": str(e)}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _test_sync)
    
    async def get_volume(self) -> Dict[str, int]:
        """
        현재 볼륨 조회 - PC2에서 SSH로 실행
        
        Returns:
            {"speaker": 0-100, "microphone": 0-100}
        """
        def _get_sync():
            result = {"speaker": 50, "microphone": 50}
            
            # PC2에서 스피커 볼륨 조회 (Master 또는 PCM)
            for control in ["Master", "PCM"]:
                try:
                    stdout, stderr = self._run_remote_command(f"amixer get {control}")
                    match = re.search(r'\[(\d+)%\]', stdout)
                    if match:
                        result["speaker"] = int(match.group(1))
                        break
                except:
                    pass
            
            # PC2에서 마이크 볼륨 조회 (Capture 또는 Mic)
            for control in ["Capture", "Mic"]:
                try:
                    stdout, stderr = self._run_remote_command(f"amixer get {control}")
                    match = re.search(r'\[(\d+)%\]', stdout)
                    if match:
                        result["microphone"] = int(match.group(1))
                        break
                except:
                    pass
            
            return result
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _get_sync)
    
    async def set_volume(self, device_type: str, volume: int) -> Dict:
        """
        볼륨 설정 - PC2에서 SSH로 실행
        
        Args:
            device_type: "speaker" 또는 "microphone"
            volume: 0-100
        """
        def _set_sync():
            volume_clamped = max(0, min(100, volume))
            
            if device_type == "speaker":
                controls = ["Master", "PCM"]
            else:
                controls = ["Capture", "Mic"]
            
            for control in controls:
                try:
                    stdout, stderr = self._run_remote_command(f"amixer set {control} {volume_clamped}%")
                    if "%" in stdout:
                        return {"success": True, "device": device_type, "volume": volume_clamped}
                except:
                    continue
            
            return {"success": False, "device": device_type, "error": "No control found"}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _set_sync)
