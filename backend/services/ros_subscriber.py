"""
ROS2 Subscriber Service
rclpy를 사용하여 ROS2 토픽 구독하고 최신 데이터 저장
(Frontend에서 rosbridge 사용 안 함 - WiFi 부하 감소)
"""
import threading
from typing import Dict, Any, Optional, Callable
from datetime import datetime
import json

# rclpy 동적 로드 (ROS2가 없는 환경에서도 서버 실행 가능)
try:
    import rclpy
    from rclpy.node import Node
    from rclpy.executors import MultiThreadedExecutor
    from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
    HAS_RCLPY = True
except ImportError:
    HAS_RCLPY = False
    Node = object

# 메시지 타입 임포트
MSG_TYPES = {}
if HAS_RCLPY:
    try:
        from sensor_msgs.msg import JointState, BatteryState, Imu, LaserScan, PointCloud2, Image
        from geometry_msgs.msg import Twist, PoseStamped, WrenchStamped
        from std_msgs.msg import String, Float32, Int32
        from nav_msgs.msg import Odometry, OccupancyGrid, Path
        from diagnostic_msgs.msg import DiagnosticArray
        from tf2_msgs.msg import TFMessage
        
        MSG_TYPES = {
            "sensor_msgs/msg/JointState": JointState,
            "sensor_msgs/msg/BatteryState": BatteryState,
            "sensor_msgs/msg/Imu": Imu,
            "sensor_msgs/msg/LaserScan": LaserScan,
            "sensor_msgs/msg/PointCloud2": PointCloud2,
            "sensor_msgs/msg/Image": Image,
            "geometry_msgs/msg/Twist": Twist,
            "geometry_msgs/msg/PoseStamped": PoseStamped,
            "geometry_msgs/msg/WrenchStamped": WrenchStamped,
            "std_msgs/msg/String": String,
            "std_msgs/msg/Float32": Float32,
            "std_msgs/msg/Int32": Int32,
            "nav_msgs/msg/Odometry": Odometry,
            "nav_msgs/msg/OccupancyGrid": OccupancyGrid,
            "nav_msgs/msg/Path": Path,
            "diagnostic_msgs/msg/DiagnosticArray": DiagnosticArray,
            "tf2_msgs/msg/TFMessage": TFMessage,
        }
    except ImportError as e:
        print(f"Warning: Some ROS2 message types not available: {e}")


class RosSubscriberNode(Node):
    """ROS2 토픽 구독 노드"""
    
    def __init__(self):
        super().__init__('web_ui_backend')
        self._topic_data: Dict[str, Dict[str, Any]] = {}
        self._subscribers = {}
        self._lock = threading.Lock()
        
        # QoS 설정
        self._qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            history=HistoryPolicy.KEEP_LAST,
            depth=1
        )
    
    def subscribe_topic(self, topic: str, msg_type_str: str):
        """토픽 구독 시작"""
        if topic in self._subscribers:
            return
        
        msg_type = MSG_TYPES.get(msg_type_str)
        if not msg_type:
            self.get_logger().warn(f"Unknown message type: {msg_type_str}")
            return
        
        def callback(msg):
            with self._lock:
                self._topic_data[topic] = {
                    "timestamp": datetime.now().isoformat(),
                    "data": self._msg_to_dict(msg),
                    "msg_type": msg_type_str,
                }
        
        sub = self.create_subscription(msg_type, topic, callback, self._qos)
        self._subscribers[topic] = sub
        self.get_logger().info(f"Subscribed to {topic}")
    
    def get_topic_data(self, topic: str) -> Optional[Dict[str, Any]]:
        """토픽 최신 데이터 가져오기"""
        with self._lock:
            return self._topic_data.get(topic)
    
    def get_all_topics_data(self) -> Dict[str, Dict[str, Any]]:
        """모든 토픽 데이터 가져오기"""
        with self._lock:
            return dict(self._topic_data)
    
    def _msg_to_dict(self, msg) -> Dict[str, Any]:
        """ROS 메시지를 딕셔너리로 변환"""
        import array
        result = {}
        
        try:
            # 일반적인 필드 변환
            for field in msg.get_fields_and_field_types().keys():
                try:
                    value = getattr(msg, field)
                    result[field] = self._value_to_dict(value)
                except Exception as e:
                    result[field] = f"<error: {str(e)}>"
        except Exception as e:
            return {"_error": str(e)}
        
        return result
    
    def _value_to_dict(self, value) -> Any:
        """값을 JSON 직렬화 가능한 형태로 변환"""
        import array
        
        # None
        if value is None:
            return None
        
        # 기본 타입
        if isinstance(value, (bool, int, float, str)):
            return value
        
        # array.array 타입 (ROS2 quaternion, translation 등)
        if isinstance(value, array.array):
            return list(value)
        
        # bytes 타입
        if isinstance(value, bytes):
            return f"<bytes len={len(value)}>"
        
        # 리스트/튜플
        if isinstance(value, (list, tuple)):
            if len(value) > 100:  # 큰 배열은 요약
                sample = [self._value_to_dict(item) for item in value[:5]]
                return {"length": len(value), "sample": sample}
            else:
                return [self._value_to_dict(item) for item in value]
        
        # numpy 배열 등 (tolist 메서드가 있는 타입)
        if hasattr(value, 'tolist'):
            arr = value.tolist()
            if len(arr) > 100:
                return {"length": len(arr), "sample": arr[:5]}
            else:
                return arr
        
        # ROS 메시지 (중첩 메시지)
        if hasattr(value, 'get_fields_and_field_types'):
            return self._msg_to_dict(value)
        
        # 그 외 타입은 문자열로 변환
        return str(value)


class RosService:
    """ROS2 서비스 (싱글톤)"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._node: Optional[RosSubscriberNode] = None
        self._executor = None
        self._thread = None
        self._running = False
        self._initialized = True
    
    def start(self, topics: list = None):
        """ROS2 노드 시작"""
        if not HAS_RCLPY:
            print("Warning: rclpy not available. ROS features disabled.")
            return False
        
        if self._running:
            return True
        
        try:
            rclpy.init()
            self._node = RosSubscriberNode()
            self._executor = MultiThreadedExecutor()
            self._executor.add_node(self._node)
            
            # 토픽 구독
            if topics:
                for topic_config in topics:
                    self._node.subscribe_topic(topic_config.topic, topic_config.msg_type)
            
            # 백그라운드 스레드에서 실행
            self._running = True
            self._thread = threading.Thread(target=self._spin, daemon=True)
            self._thread.start()
            
            print("✅ ROS2 node started")
            return True
            
        except Exception as e:
            print(f"❌ Failed to start ROS2 node: {e}")
            return False
    
    def _spin(self):
        """ROS2 이벤트 루프"""
        while self._running:
            self._executor.spin_once(timeout_sec=0.1)
    
    def stop(self):
        """ROS2 노드 종료"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
        if self._node:
            self._node.destroy_node()
        if HAS_RCLPY:
            try:
                rclpy.shutdown()
            except:
                pass
        print("👋 ROS2 node stopped")
    
    def get_topic_data(self, topic: str) -> Optional[Dict[str, Any]]:
        """토픽 데이터 가져오기"""
        if self._node:
            return self._node.get_topic_data(topic)
        return None
    
    def get_all_data(self) -> Dict[str, Dict[str, Any]]:
        """모든 토픽 데이터 가져오기"""
        if self._node:
            return self._node.get_all_topics_data()
        return {}
    
    @property
    def is_running(self) -> bool:
        return self._running


# 전역 인스턴스
ros_service = RosService()
