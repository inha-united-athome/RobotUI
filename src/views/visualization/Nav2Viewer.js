import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CBadge,
    CButton,
    CButtonGroup,
    CFormCheck,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
    cilLocationPin,
    cilReload,
    cilMap,
    cilCursor,
} from '@coreui/icons'
import { useRos } from '../../context/RosContext'
import { useRosTopic, useRosPublisher } from '../../hooks/useRosTopic'

// 맵 뷰어 컴포넌트
const MapViewer = ({ onMapClick }) => {
    const canvasRef = useRef(null)
    const { message: mapData } = useRosTopic('/map', 'nav_msgs/OccupancyGrid')
    const { message: robotPose } = useRosTopic('/amcl_pose', 'geometry_msgs/PoseWithCovarianceStamped')
    const { message: globalPath } = useRosTopic('/plan', 'nav_msgs/Path')
    const { message: localPath } = useRosTopic('/local_plan', 'nav_msgs/Path')

    const [scale, setScale] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })

    const drawMap = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas || !mapData) return

        const ctx = canvas.getContext('2d')
        const { width, height } = mapData.info
        const resolution = mapData.info.resolution
        const origin = mapData.info.origin.position

        // Set canvas size
        canvas.width = width
        canvas.height = height

        // Draw map
        const imageData = ctx.createImageData(width, height)
        for (let i = 0; i < mapData.data.length; i++) {
            const value = mapData.data[i]
            const idx = i * 4

            if (value === -1) {
                // Unknown - gray
                imageData.data[idx] = 128
                imageData.data[idx + 1] = 128
                imageData.data[idx + 2] = 128
            } else if (value === 0) {
                // Free - white
                imageData.data[idx] = 255
                imageData.data[idx + 1] = 255
                imageData.data[idx + 2] = 255
            } else {
                // Occupied - black
                imageData.data[idx] = 0
                imageData.data[idx + 1] = 0
                imageData.data[idx + 2] = 0
            }
            imageData.data[idx + 3] = 255
        }
        ctx.putImageData(imageData, 0, 0)

        // Draw robot position
        if (robotPose?.pose?.pose) {
            const pose = robotPose.pose.pose
            const robotX = (pose.position.x - origin.x) / resolution
            const robotY = height - (pose.position.y - origin.y) / resolution

            ctx.save()
            ctx.translate(robotX, robotY)

            // Calculate yaw from quaternion
            const q = pose.orientation
            const yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))
            ctx.rotate(-yaw)

            // Draw robot as arrow
            ctx.beginPath()
            ctx.moveTo(10, 0)
            ctx.lineTo(-5, 5)
            ctx.lineTo(-5, -5)
            ctx.closePath()
            ctx.fillStyle = '#3b82f6'
            ctx.fill()
            ctx.strokeStyle = '#1e40af'
            ctx.lineWidth = 2
            ctx.stroke()

            ctx.restore()
        }

        // Draw global path
        if (globalPath?.poses?.length > 0) {
            ctx.beginPath()
            ctx.strokeStyle = '#22c55e'
            ctx.lineWidth = 2
            globalPath.poses.forEach((p, i) => {
                const x = (p.pose.position.x - origin.x) / resolution
                const y = height - (p.pose.position.y - origin.y) / resolution
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            })
            ctx.stroke()
        }

        // Draw local path
        if (localPath?.poses?.length > 0) {
            ctx.beginPath()
            ctx.strokeStyle = '#f97316'
            ctx.lineWidth = 2
            localPath.poses.forEach((p, i) => {
                const x = (p.pose.position.x - origin.x) / resolution
                const y = height - (p.pose.position.y - origin.y) / resolution
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            })
            ctx.stroke()
        }
    }, [mapData, robotPose, globalPath, localPath])

    useEffect(() => {
        drawMap()
    }, [drawMap])

    const handleCanvasClick = (e) => {
        if (!mapData || !onMapClick) return

        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const { width, height } = mapData.info
        const resolution = mapData.info.resolution
        const origin = mapData.info.origin.position

        const worldX = (x / canvas.offsetWidth) * width * resolution + origin.x
        const worldY = ((canvas.offsetHeight - y) / canvas.offsetHeight) * height * resolution + origin.y

        onMapClick(worldX, worldY)
    }

    return (
        <div style={{ position: 'relative', background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: 'auto', cursor: 'crosshair' }}
                onClick={handleCanvasClick}
            />
            {!mapData && (
                <div className="position-absolute top-50 start-50 translate-middle text-white">
                    <p className="mb-0">Waiting for map data...</p>
                    <small className="text-body-secondary">Topic: /map</small>
                </div>
            )}
        </div>
    )
}

// Nav2 상태 카드
const Nav2StatusCard = () => {
    const { message: navStatus } = useRosTopic(
        '/navigate_to_pose/_action/status',
        'action_msgs/GoalStatusArray'
    )

    const getStatusInfo = (status) => {
        const statusMap = {
            1: { label: 'ACTIVE', color: 'info', text: 'Navigating...' },
            2: { label: 'SUCCEEDED', color: 'success', text: 'Goal reached!' },
            4: { label: 'ABORTED', color: 'danger', text: 'Navigation aborted' },
            5: { label: 'CANCELED', color: 'warning', text: 'Navigation canceled' },
            6: { label: 'CANCELING', color: 'warning', text: 'Canceling...' },
        }
        return statusMap[status] || { label: 'IDLE', color: 'secondary', text: 'Ready' }
    }

    const latestStatus = navStatus?.status_list?.slice(-1)[0]
    const statusInfo = latestStatus ? getStatusInfo(latestStatus.status) : { label: 'IDLE', color: 'secondary', text: 'Ready' }

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>🧭 Nav2 Status</strong>
            </CCardHeader>
            <CCardBody className="text-center">
                <CBadge color={statusInfo.color} className="fs-6 py-2 px-4 mb-2">
                    {statusInfo.label}
                </CBadge>
                <p className="text-body-secondary mb-0">{statusInfo.text}</p>
            </CCardBody>
        </CCard>
    )
}

// 로봇 위치 정보 카드
const RobotPoseCard = () => {
    const { message: robotPose } = useRosTopic('/amcl_pose', 'geometry_msgs/PoseWithCovarianceStamped')

    const pose = robotPose?.pose?.pose
    const q = pose?.orientation
    const yaw = q ? Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z)) : 0

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>📍 Robot Pose</strong>
            </CCardHeader>
            <CCardBody>
                {pose ? (
                    <CRow>
                        <CCol xs={4} className="text-center">
                            <div className="text-body-secondary small">X</div>
                            <div className="fw-semibold">{pose.position.x.toFixed(3)} m</div>
                        </CCol>
                        <CCol xs={4} className="text-center">
                            <div className="text-body-secondary small">Y</div>
                            <div className="fw-semibold">{pose.position.y.toFixed(3)} m</div>
                        </CCol>
                        <CCol xs={4} className="text-center">
                            <div className="text-body-secondary small">Yaw</div>
                            <div className="fw-semibold">{(yaw * 180 / Math.PI).toFixed(1)}°</div>
                        </CCol>
                    </CRow>
                ) : (
                    <p className="text-body-secondary mb-0 text-center">No pose data</p>
                )}
            </CCardBody>
        </CCard>
    )
}

// 목표점 설정 카드
const GoalSetCard = () => {
    const { isConnected } = useRos()
    const [goalX, setGoalX] = useState(0)
    const [goalY, setGoalY] = useState(0)
    const [goalYaw, setGoalYaw] = useState(0)

    const publishGoal = useRosPublisher('/goal_pose', 'geometry_msgs/PoseStamped')

    const handleSendGoal = () => {
        const yawRad = goalYaw * Math.PI / 180
        publishGoal({
            header: {
                frame_id: 'map',
                stamp: { sec: 0, nanosec: 0 },
            },
            pose: {
                position: { x: goalX, y: goalY, z: 0 },
                orientation: {
                    x: 0,
                    y: 0,
                    z: Math.sin(yawRad / 2),
                    w: Math.cos(yawRad / 2),
                },
            },
        })
    }

    const handleMapClick = (x, y) => {
        setGoalX(x)
        setGoalY(y)
    }

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong><CIcon icon={cilLocationPin} className="me-2" />Set Goal</strong>
            </CCardHeader>
            <CCardBody>
                <div className="mb-2">
                    <label className="form-label small">X (m)</label>
                    <input
                        type="number"
                        className="form-control form-control-sm"
                        value={goalX}
                        onChange={(e) => setGoalX(parseFloat(e.target.value) || 0)}
                        step="0.1"
                    />
                </div>
                <div className="mb-2">
                    <label className="form-label small">Y (m)</label>
                    <input
                        type="number"
                        className="form-control form-control-sm"
                        value={goalY}
                        onChange={(e) => setGoalY(parseFloat(e.target.value) || 0)}
                        step="0.1"
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label small">Yaw (°)</label>
                    <input
                        type="number"
                        className="form-control form-control-sm"
                        value={goalYaw}
                        onChange={(e) => setGoalYaw(parseFloat(e.target.value) || 0)}
                        step="5"
                    />
                </div>
                <div className="d-grid gap-2">
                    <CButton color="primary" onClick={handleSendGoal} disabled={!isConnected}>
                        <CIcon icon={cilCursor} className="me-2" />
                        Send Goal
                    </CButton>
                </div>
                <small className="text-body-secondary d-block mt-2">
                    Tip: Click on the map to set X/Y coordinates
                </small>
            </CCardBody>
        </CCard>
    )
}

// Costmap 레이어 토글
const CostmapControlCard = () => {
    const [showGlobal, setShowGlobal] = useState(true)
    const [showLocal, setShowLocal] = useState(true)
    const [showPath, setShowPath] = useState(true)

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong><CIcon icon={cilMap} className="me-2" />Layers</strong>
            </CCardHeader>
            <CCardBody>
                <CFormCheck
                    id="globalCostmap"
                    label="Global Costmap"
                    checked={showGlobal}
                    onChange={(e) => setShowGlobal(e.target.checked)}
                />
                <CFormCheck
                    id="localCostmap"
                    label="Local Costmap"
                    checked={showLocal}
                    onChange={(e) => setShowLocal(e.target.checked)}
                />
                <CFormCheck
                    id="globalPath"
                    label="Global Path"
                    checked={showPath}
                    onChange={(e) => setShowPath(e.target.checked)}
                />
            </CCardBody>
        </CCard>
    )
}

const Nav2Viewer = () => {
    const [goalPosition, setGoalPosition] = useState(null)

    const handleMapClick = (x, y) => {
        setGoalPosition({ x, y })
    }

    return (
        <>
            <CRow>
                <CCol md={8}>
                    <CCard className="mb-4">
                        <CCardHeader className="d-flex justify-content-between align-items-center">
                            <strong><CIcon icon={cilMap} className="me-2" />Map View</strong>
                            <CBadge color="info">Click to set goal</CBadge>
                        </CCardHeader>
                        <CCardBody style={{ minHeight: '500px' }}>
                            <MapViewer onMapClick={handleMapClick} />
                        </CCardBody>
                    </CCard>
                </CCol>
                <CCol md={4}>
                    <Nav2StatusCard />
                    <RobotPoseCard />
                    <GoalSetCard />
                    <CostmapControlCard />
                </CCol>
            </CRow>
        </>
    )
}

export default Nav2Viewer
