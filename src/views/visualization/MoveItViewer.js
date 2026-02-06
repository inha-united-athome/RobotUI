import React, { useState, useEffect } from 'react'
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CBadge,
    CButton,
    CProgress,
    CTable,
    CTableHead,
    CTableBody,
    CTableRow,
    CTableHeaderCell,
    CTableDataCell,
    CFormRange,
    CFormLabel,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
    cilMediaPlay,
    cilMediaPause,
    cilReload,
    cilCheckCircle,
    cilXCircle,
} from '@coreui/icons'
import { useRos } from '../../context/RosContext'
import { useRosTopic, useRosService } from '../../hooks/useRosTopic'

// Joint State 시각화
const JointStateViewer = () => {
    const { message: jointStates, hz } = useRosTopic('/joint_states', 'sensor_msgs/JointState')

    const formatRad = (rad) => {
        if (rad === undefined || rad === null) return 'N/A'
        return `${rad.toFixed(3)} rad (${(rad * 180 / Math.PI).toFixed(1)}°)`
    }

    return (
        <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong>🦾 Joint States</strong>
                <CBadge color={hz > 0 ? 'success' : 'secondary'}>{hz} Hz</CBadge>
            </CCardHeader>
            <CCardBody>
                {jointStates?.name?.length > 0 ? (
                    <CTable small hover responsive>
                        <CTableHead>
                            <CTableRow>
                                <CTableHeaderCell>Joint</CTableHeaderCell>
                                <CTableHeaderCell>Position</CTableHeaderCell>
                                <CTableHeaderCell>Velocity</CTableHeaderCell>
                                <CTableHeaderCell>Effort</CTableHeaderCell>
                            </CTableRow>
                        </CTableHead>
                        <CTableBody>
                            {jointStates.name.map((name, i) => (
                                <CTableRow key={name}>
                                    <CTableDataCell><code>{name}</code></CTableDataCell>
                                    <CTableDataCell>{formatRad(jointStates.position?.[i])}</CTableDataCell>
                                    <CTableDataCell>
                                        {jointStates.velocity?.[i]?.toFixed(3) || 'N/A'} rad/s
                                    </CTableDataCell>
                                    <CTableDataCell>
                                        {jointStates.effort?.[i]?.toFixed(3) || 'N/A'} Nm
                                    </CTableDataCell>
                                </CTableRow>
                            ))}
                        </CTableBody>
                    </CTable>
                ) : (
                    <p className="text-body-secondary mb-0">No joint state data</p>
                )}
            </CCardBody>
        </CCard>
    )
}

// MoveIt 상태 모니터
const MoveItStatusCard = () => {
    const { message: moveGroupStatus } = useRosTopic(
        '/move_group/status',
        'actionlib_msgs/GoalStatusArray'
    )
    const { message: executionResult } = useRosTopic(
        '/execute_trajectory/_action/status',
        'action_msgs/GoalStatusArray'
    )

    const getStatusLabel = (status) => {
        const statusMap = {
            0: { label: 'PENDING', color: 'secondary' },
            1: { label: 'ACTIVE', color: 'info' },
            2: { label: 'PREEMPTED', color: 'warning' },
            3: { label: 'SUCCEEDED', color: 'success' },
            4: { label: 'ABORTED', color: 'danger' },
            5: { label: 'REJECTED', color: 'danger' },
            6: { label: 'PREEMPTING', color: 'warning' },
            7: { label: 'RECALLING', color: 'warning' },
            8: { label: 'RECALLED', color: 'secondary' },
            9: { label: 'LOST', color: 'danger' },
        }
        return statusMap[status] || { label: 'UNKNOWN', color: 'secondary' }
    }

    const latestStatus = moveGroupStatus?.status_list?.slice(-1)[0]
    const statusInfo = latestStatus ? getStatusLabel(latestStatus.status) : { label: 'No Data', color: 'secondary' }

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>🎯 MoveIt Status</strong>
            </CCardHeader>
            <CCardBody>
                <CRow className="text-center">
                    <CCol>
                        <div className="mb-2">
                            <span className="text-body-secondary">Current Status</span>
                        </div>
                        <CBadge color={statusInfo.color} className="fs-6 py-2 px-4">
                            {statusInfo.label}
                        </CBadge>
                    </CCol>
                </CRow>
                {latestStatus?.text && (
                    <div className="mt-3 p-2 bg-body-secondary rounded">
                        <small className="text-body-secondary">Message: </small>
                        <span>{latestStatus.text}</span>
                    </div>
                )}
            </CCardBody>
        </CCard>
    )
}

// 계획 경로 표시
const PlannedPathCard = () => {
    const { message: displayPath, hz } = useRosTopic(
        '/display_planned_path',
        'moveit_msgs/DisplayTrajectory'
    )

    const trajectory = displayPath?.trajectory?.[0]?.joint_trajectory
    const pointCount = trajectory?.points?.length || 0
    const duration = trajectory?.points?.slice(-1)[0]?.time_from_start?.sec || 0

    return (
        <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong>📍 Planned Path</strong>
                <CBadge color={hz > 0 ? 'success' : 'secondary'}>
                    {trajectory ? 'Available' : 'No Path'}
                </CBadge>
            </CCardHeader>
            <CCardBody>
                {trajectory ? (
                    <>
                        <div className="mb-2">
                            <span className="text-body-secondary">Joints: </span>
                            <span>{trajectory.joint_names?.length || 0}</span>
                        </div>
                        <div className="mb-2">
                            <span className="text-body-secondary">Waypoints: </span>
                            <span>{pointCount}</span>
                        </div>
                        <div className="mb-2">
                            <span className="text-body-secondary">Duration: </span>
                            <span>{duration.toFixed(2)}s</span>
                        </div>
                        <div className="mt-3">
                            <CFormLabel>Trajectory Progress</CFormLabel>
                            <CProgress value={0} className="mb-2" />
                        </div>
                    </>
                ) : (
                    <p className="text-body-secondary mb-0">No planned trajectory</p>
                )}
            </CCardBody>
        </CCard>
    )
}

// 충돌 객체 표시
const CollisionObjectsCard = () => {
    const { message: planningScene } = useRosTopic(
        '/monitored_planning_scene',
        'moveit_msgs/PlanningScene'
    )

    const collisionObjects = planningScene?.world?.collision_objects || []

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>🧱 Collision Objects</strong>
                <CBadge color="info" className="ms-2">{collisionObjects.length}</CBadge>
            </CCardHeader>
            <CCardBody style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {collisionObjects.length > 0 ? (
                    <CTable small hover>
                        <CTableHead>
                            <CTableRow>
                                <CTableHeaderCell>ID</CTableHeaderCell>
                                <CTableHeaderCell>Type</CTableHeaderCell>
                            </CTableRow>
                        </CTableHead>
                        <CTableBody>
                            {collisionObjects.map((obj) => (
                                <CTableRow key={obj.id}>
                                    <CTableDataCell>{obj.id}</CTableDataCell>
                                    <CTableDataCell>
                                        {obj.primitives?.length > 0 ? 'Primitive' :
                                            obj.meshes?.length > 0 ? 'Mesh' : 'Unknown'}
                                    </CTableDataCell>
                                </CTableRow>
                            ))}
                        </CTableBody>
                    </CTable>
                ) : (
                    <p className="text-body-secondary mb-0">No collision objects</p>
                )}
            </CCardBody>
        </CCard>
    )
}

// Gripper 제어 (간단한 UI)
const GripperControlCard = () => {
    const { isConnected } = useRos()
    const [gripperValue, setGripperValue] = useState(0)

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>🤏 Gripper Control</strong>
            </CCardHeader>
            <CCardBody>
                <div className="mb-3">
                    <CFormLabel>Gripper Position: {gripperValue}%</CFormLabel>
                    <CFormRange
                        min={0}
                        max={100}
                        value={gripperValue}
                        onChange={(e) => setGripperValue(parseInt(e.target.value))}
                        disabled={!isConnected}
                    />
                </div>
                <div className="d-grid gap-2">
                    <CButton
                        color="success"
                        disabled={!isConnected}
                        onClick={() => setGripperValue(0)}
                    >
                        Open Gripper
                    </CButton>
                    <CButton
                        color="danger"
                        disabled={!isConnected}
                        onClick={() => setGripperValue(100)}
                    >
                        Close Gripper
                    </CButton>
                </div>
            </CCardBody>
        </CCard>
    )
}

const MoveItViewer = () => {
    return (
        <>
            <CRow>
                <CCol md={4}>
                    <MoveItStatusCard />
                    <GripperControlCard />
                </CCol>
                <CCol md={8}>
                    <JointStateViewer />
                </CCol>
            </CRow>
            <CRow>
                <CCol md={6}>
                    <PlannedPathCard />
                </CCol>
                <CCol md={6}>
                    <CollisionObjectsCard />
                </CCol>
            </CRow>
        </>
    )
}

export default MoveItViewer
