"""
Robot Web UI - FastAPI Backend Server
로봇 PC에서 실행, WiFi로 브라우저 접속
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os

from config import config
from routers import robot, pc, sensors, ros
from services.ros_subscriber import ros_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행"""
    print("🚀 Robot Web UI Backend starting...")
    
    # ROS2 노드 시작
    ros_service.start(config.ros_topics)
    
    yield
    
    # ROS2 노드 종료
    ros_service.stop()
    print("👋 Robot Web UI Backend shutting down...")


app = FastAPI(
    title="Robot Web UI Backend",
    description="로봇 모니터링 API - PC 상태, 센서, ROS2 데이터",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS 설정 (WiFi 접속 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(robot.router, prefix="/api/robot", tags=["Robot"])
app.include_router(pc.router, prefix="/api/pc", tags=["PC Monitor"])
app.include_router(sensors.router, prefix="/api/sensors", tags=["Sensors"])
app.include_router(ros.router, prefix="/api/ros", tags=["ROS2"])


# 정적 파일 서빙 (빌드된 React 앱)
BUILD_DIR = os.path.join(os.path.dirname(__file__), "..", "build")
if os.path.exists(BUILD_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(BUILD_DIR, "assets")), name="static")
    
    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))
    
    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """SPA 라우팅 지원"""
        file_path = os.path.join(BUILD_DIR, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "ros_running": ros_service.is_running,
    }


@app.get("/api/info")
async def get_info():
    """서버 정보"""
    return {
        "name": "Robot Web UI Backend",
        "version": "2.0.0",
        "architecture": {
            "pc1": "local (this PC)",
            "pc2": f"remote ({config.pcs['pc2'].ip})",
            "ros": "rclpy (direct subscription)",
            "frontend": "API only (no rosbridge)",
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.host, port=config.port)
