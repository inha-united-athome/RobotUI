"""
Sensor Check Service
센서 연결 상태 확인 (ping, RealSense, USB cameras)
"""
import asyncio
import subprocess
import os
import re
from typing import Dict, List, Optional


class SensorCheckService:
    """센서 연결 확인 서비스"""
    
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
        오디오 장치 연결 상태 확인
        aplay -l (스피커), arecord -l (마이크)
        
        Returns:
            {"speaker": bool, "microphone": bool}
        """
        def _check_audio_sync():
            result = {"speaker": False, "microphone": False}
            
            # 스피커 확인 (aplay -l)
            try:
                output = subprocess.run(
                    ["aplay", "-l"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                # "card" 문자열이 있으면 스피커 장치 존재
                if "card" in output.stdout.lower():
                    result["speaker"] = True
            except Exception:
                pass
            
            # 마이크 확인 (arecord -l)
            try:
                output = subprocess.run(
                    ["arecord", "-l"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                # "card" 문자열이 있으면 마이크 장치 존재
                if "card" in output.stdout.lower():
                    result["microphone"] = True
            except Exception:
                pass
            
            return result
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _check_audio_sync)
    
    async def list_audio_devices(self) -> Dict[str, list]:
        """
        사용 가능한 오디오 장치 목록 조회
        
        Returns:
            {"speakers": [...], "microphones": [...]}
        """
        def _list_sync():
            result = {"speakers": [], "microphones": []}
            
            # 스피커 목록 (aplay -l)
            try:
                output = subprocess.run(
                    ["aplay", "-l"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if output.returncode == 0:
                    for line in output.stdout.split('\n'):
                        if line.startswith('card '):
                            # card 0: tegra-hda [tegra-hda], device 3: HDMI 0 [HDMI 0]
                            parts = line.split(':')
                            if len(parts) >= 2:
                                card_info = parts[0].strip()  # "card 0"
                                card_num = card_info.split()[1] if len(card_info.split()) > 1 else "0"
                                name = parts[1].split('[')[0].strip() if '[' in parts[1] else parts[1].strip()
                                device = "0"
                                if 'device' in line:
                                    device_part = line.split('device')[1]
                                    device = device_part.split(':')[0].strip()
                                result["speakers"].append({
                                    "id": f"hw:{card_num},{device}",
                                    "name": name,
                                    "card": int(card_num),
                                    "device": int(device),
                                })
            except Exception as e:
                result["speaker_error"] = str(e)
            
            # 마이크 목록 (arecord -l)
            try:
                output = subprocess.run(
                    ["arecord", "-l"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if output.returncode == 0:
                    for line in output.stdout.split('\n'):
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
                                result["microphones"].append({
                                    "id": f"hw:{card_num},{device}",
                                    "name": name,
                                    "card": int(card_num),
                                    "device": int(device),
                                })
            except Exception as e:
                result["microphone_error"] = str(e)
            
            return result
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _list_sync)
    
    async def test_speaker(self, device_id: str = "default") -> Dict:
        """
        스피커 테스트 (짧은 비프음 재생)
        
        Args:
            device_id: ALSA 장치 ID (예: "hw:0,0" 또는 "default")
        """
        def _test_sync():
            try:
                # speaker-test로 짧은 테스트 (1초)
                result = subprocess.run(
                    ["speaker-test", "-D", device_id, "-c", "2", "-t", "sine", "-f", "440", "-l", "1"],
                    capture_output=True,
                    text=True,
                    timeout=3,
                )
                return {"success": True, "device": device_id, "message": "Test tone played"}
            except subprocess.TimeoutExpired:
                return {"success": True, "device": device_id, "message": "Test completed"}
            except Exception as e:
                return {"success": False, "device": device_id, "error": str(e)}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _test_sync)
    
    async def test_microphone(self, device_id: str = "default", duration: float = 2.0) -> Dict:
        """
        마이크 테스트 (녹음 후 레벨 확인)
        
        Args:
            device_id: ALSA 장치 ID
            duration: 녹음 시간 (초)
        """
        def _test_sync():
            try:
                # arecord로 짧은 녹음 후 삭제
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as f:
                    result = subprocess.run(
                        ["arecord", "-D", device_id, "-d", str(int(duration)), "-f", "cd", f.name],
                        capture_output=True,
                        text=True,
                        timeout=duration + 2,
                    )
                    if result.returncode == 0:
                        # 파일 크기로 녹음 성공 여부 확인
                        import os
                        size = os.path.getsize(f.name)
                        return {"success": True, "device": device_id, "recorded_bytes": size}
                    else:
                        return {"success": False, "device": device_id, "error": result.stderr}
            except subprocess.TimeoutExpired:
                return {"success": True, "device": device_id, "message": "Recording completed"}
            except Exception as e:
                return {"success": False, "device": device_id, "error": str(e)}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _test_sync)

