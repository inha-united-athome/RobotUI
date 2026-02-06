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
        연결된 RealSense 기기 목록 (PC2에서 SSH로 실행)
        rs-enumerate-devices 사용
        
        Returns:
            {serial_number: device_name, ...}
        """
        def _enumerate_sync():
            devices = {}
            try:
                # PC2에서 rs-enumerate-devices 실행
                stdout, stderr = self._run_remote_command("rs-enumerate-devices", timeout=10)
                
                lines = stdout.split('\n')
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
            except Exception:
                pass
            
            return devices
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _enumerate_sync)
    
    async def get_video_devices(self) -> List[Dict]:
        """
        사용 가능한 /dev/video* 디바이스 목록 (PC2에서 SSH로 실행)
        
        Returns:
            [{"device": "/dev/video0", "available": True}, ...]
        """
        def _check_devices_sync():
            devices = []
            
            try:
                # PC2에서 /dev/video* 목록 확인
                stdout, stderr = self._run_remote_command("ls -1 /dev/video*")
                
                for line in stdout.split('\n'):
                    if line.startswith('/dev/video'):
                        device_path = line.strip()
                        # 사용 가능 여부 확인 (fuser로 점유 확인)
                        try:
                            fuser_out, _ = self._run_remote_command(f"fuser {device_path}")
                            available = len(fuser_out.strip()) == 0
                        except:
                            available = True
                            
                        # V4L2 정보 확인 (USB ID 등)
                        try:
                            # udevadm info
                            udev_out, _ = self._run_remote_command(f"udevadm info --query=all --name={device_path} | grep ID_VENDOR_ID")
                            if "ID_VENDOR_ID" in udev_out:
                                vendor_id = udev_out.split('=')[-1].strip()
                                # RealSense 제외 (8086: Intel)
                                if vendor_id == "8086":
                                    continue
                        except:
                            pass

                        devices.append({
                            "device": device_path,
                            "available": available
                        })

            except Exception:
                pass
            
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
                            # 필터링: ADMAIF(Jetson 내부) 및 HDMI 제외
                            if "ADMAIF" in line or "HDMI" in line:
                                continue
                                
                            card_info = parts[0].strip()
                            card_num = card_info.split()[1] if len(card_info.split()) > 1 else "0"
                            name = parts[1].split('[')[0].strip() if '[' in parts[1] else parts[1].strip()
                            device = "0"
                            if 'device' in line:
                                device_part = line.split('device')[1]
                                device = device_part.split(':')[0].strip()
                            
                            # 친화적인 이름 생성
                            friendly_name = name
                            if "USB" in name:
                                friendly_name = f"🔊 USB Audio ({name})"
                            elif "ReSpeaker" in line:
                                friendly_name = f"🎤 ReSpeaker ({name})"
                                
                            device_list.append({
                                "id": f"hw:{card_num},{device}",
                                "name": friendly_name,
                                "original_name": name,
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
    
    async def get_volume(self, device_id: str = "default") -> Dict[str, int]:
        """
        현재 볼륨 조회 - PC2에서 SSH로 실행
        
        Returns:
            {"speaker": 0-100, "microphone": 0-100}
        """
        def _get_sync():
            result = {"speaker": 50, "microphone": 50}
            
            # 카드 번호 추출 (hw:X,Y -> X)
            card_num = "0"
            if device_id.startswith("hw:"):
                try:
                    card_num = device_id.split(":")[1].split(",")[0]
                except:
                    pass
            
            # 1. 믹서 컨트롤 목록 조회 (amixer -c X scontrols)
            # 2. 적절한 컨트롤(Master, PCM, Speaker / Capture, Mic) 찾기
            # 3. 볼륨 조회
            
            def get_vol_for_type(controls_pool):
                try:
                    # scontrols 조회
                    stdout, stderr = self._run_remote_command(f"amixer -c {card_num} scontrols")
                    available_controls = []
                    for line in stdout.split('\n'):
                        if "Simple mixer control" in line:
                            # Simple mixer control 'Master',0 -> Master
                            ctrl = line.split("'")[1]
                            available_controls.append(ctrl)
                    
                    # 우선순위에 따라 매칭
                    target_control = None
                    for candidate in controls_pool:
                        if candidate in available_controls:
                            target_control = candidate
                            break
                    
                    if target_control:
                        stdout, stderr = self._run_remote_command(f"amixer -c {card_num} get '{target_control}'")
                        match = re.search(r'\[(\d+)%\]', stdout)
                        if match:
                            return int(match.group(1))
                except:
                    pass
                return 50 # 기본값
            
            result["speaker"] = get_vol_for_type(["Master", "PCM", "Speaker", "Headphone", "Playback"])
            result["microphone"] = get_vol_for_type(["Capture", "Mic", "Microphone", "Input"])
            
            return result
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _get_sync)
    
    async def set_volume(self, device_type: str, volume: int, device_id: str = "default") -> Dict:
        """
        볼륨 설정 - PC2에서 SSH로 실행
        
        Args:
            device_type: "speaker" 또는 "microphone"
            volume: 0-100
            device_id: 장치 ID (예: hw:1,0)
        """
        def _set_sync():
            volume_clamped = max(0, min(100, volume))
            
            # 카드 번호 추출
            card_num = "0"
            if device_id.startswith("hw:"):
                try:
                    card_num = device_id.split(":")[1].split(",")[0]
                except:
                    pass
            
            try:
                # 사용 가능한 컨트롤 확인
                stdout, stderr = self._run_remote_command(f"amixer -c {card_num} scontrols")
                available_controls = []
                for line in stdout.split('\n'):
                     if "Simple mixer control" in line:
                         ctrl = line.split("'")[1]
                         available_controls.append(ctrl)
                
                # 타겟 컨트롤 찾기
                target_controls = []
                if device_type == "speaker":
                    candidates = ["Master", "PCM", "Speaker", "Headphone", "Playback"]
                else:
                    candidates = ["Capture", "Mic", "Microphone", "Input"]
                
                for cand in candidates:
                    if cand in available_controls:
                        target_controls.append(cand)
                        # 보통 하나만 조절하면 되지만, Master/PCM 둘 다 있는 경우 둘 다 조절하면 확실함
                
                if not target_controls:
                     return {"success": False, "device": device_type, "error": f"No volume control found for card {card_num}"}
                
                # 설정 적용
                for ctrl in target_controls:
                    self._run_remote_command(f"amixer -c {card_num} set '{ctrl}' {volume_clamped}%")
                
                return {"success": True, "device": device_type, "volume": volume_clamped, "card": card_num}
                
            except Exception as e:
                return {"success": False, "device": device_type, "error": str(e)}
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _set_sync)
