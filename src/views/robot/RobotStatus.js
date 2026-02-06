import React from 'react'
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CProgress,
    CBadge,
    CWidgetStatsF,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
    cilSpeedometer,
    cilBattery5,
    cilRouter,
    cilCheckCircle,
    cilXCircle,
    cilWarning,
} from '@coreui/icons'
import { useRos } from '../../context/RosContext'
import { useRosTopic } from '../../hooks/useRosTopic'

// Connection Status Widget
const ConnectionWidget = () => {
    const { isConnected, url, error } = useRos()

    return (
        <CWidgetStatsF
            className="mb-3"
            color={isConnected ? 'success' : 'danger'}
            icon={<CIcon icon={isConnected ? cilCheckCircle : cilXCircle} height={24} />}
            title="ROS Bridge"
            value={isConnected ? 'Connected' : 'Disconnected'}
            footer={
                <span className="text-body-secondary">
                    {error ? `Error: ${error}` : `URL: ${url}`}
                </span>
            }
        />
    )
}

// Robot Status Card
const RobotStatusCard = () => {
    // Subscribe to diagnostics topic
    const { message: diagnostics } = useRosTopic('/diagnostics', 'diagnostic_msgs/DiagnosticArray')

    // Subscribe to battery state
    const { message: battery } = useRosTopic('/battery_state', 'sensor_msgs/BatteryState')

    // Subscribe to joint states
    const { message: jointStates, hz: jointHz } = useRosTopic('/joint_states', 'sensor_msgs/JointState')

    const batteryPercent = battery?.percentage ? battery.percentage * 100 : 0
    const batteryVoltage = battery?.voltage || 0

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>🤖 Robot Status</strong>
            </CCardHeader>
            <CCardBody>
                <CRow>
                    <CCol md={6}>
                        <div className="mb-4">
                            <div className="d-flex justify-content-between mb-1">
                                <span><CIcon icon={cilBattery5} className="me-2" />Battery</span>
                                <span className="fw-semibold">{batteryPercent.toFixed(1)}%</span>
                            </div>
                            <CProgress
                                value={batteryPercent}
                                color={batteryPercent > 50 ? 'success' : batteryPercent > 20 ? 'warning' : 'danger'}
                            />
                            <small className="text-body-secondary">Voltage: {batteryVoltage.toFixed(2)}V</small>
                        </div>
                    </CCol>
                    <CCol md={6}>
                        <div className="mb-4">
                            <div className="d-flex justify-content-between mb-1">
                                <span><CIcon icon={cilRouter} className="me-2" />Joint States</span>
                                <CBadge color={jointHz > 0 ? 'success' : 'secondary'}>
                                    {jointHz} Hz
                                </CBadge>
                            </div>
                            {jointStates?.name?.slice(0, 6).map((name, i) => (
                                <div key={name} className="small">
                                    <span className="text-body-secondary">{name}: </span>
                                    <span>{jointStates.position?.[i]?.toFixed(3) || 'N/A'} rad</span>
                                </div>
                            ))}
                        </div>
                    </CCol>
                </CRow>

                {/* Diagnostics */}
                <h6 className="mt-3">Diagnostics</h6>
                {diagnostics?.status?.length > 0 ? (
                    <div className="table-responsive">
                        <table className="table table-sm table-hover">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Name</th>
                                    <th>Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diagnostics.status.slice(0, 10).map((status, i) => (
                                    <tr key={i}>
                                        <td>
                                            <CBadge color={
                                                status.level === 0 ? 'success' :
                                                    status.level === 1 ? 'warning' : 'danger'
                                            }>
                                                {status.level === 0 ? 'OK' : status.level === 1 ? 'WARN' : 'ERROR'}
                                            </CBadge>
                                        </td>
                                        <td>{status.name}</td>
                                        <td className="text-truncate" style={{ maxWidth: '300px' }}>
                                            {status.message}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-body-secondary">No diagnostics data available</p>
                )}
            </CCardBody>
        </CCard>
    )
}

// Emergency Stop Status
const EmergencyStopCard = () => {
    const { message: estop } = useRosTopic('/emergency_stop', 'std_msgs/Bool')

    const isPressed = estop?.data === true

    return (
        <CCard className={`mb-4 border-${isPressed ? 'danger' : 'success'}`}>
            <CCardBody className="text-center">
                <CIcon
                    icon={isPressed ? cilWarning : cilCheckCircle}
                    size="3xl"
                    className={`text-${isPressed ? 'danger' : 'success'} mb-2`}
                />
                <h5 className={`text-${isPressed ? 'danger' : 'success'}`}>
                    {isPressed ? '⚠️ E-STOP ACTIVATED' : '✅ System Normal'}
                </h5>
                <p className="text-body-secondary mb-0">
                    Emergency Stop: {isPressed ? 'PRESSED' : 'Released'}
                </p>
            </CCardBody>
        </CCard>
    )
}

const RobotStatus = () => {
    return (
        <>
            <CRow>
                <CCol md={4}>
                    <ConnectionWidget />
                </CCol>
                <CCol md={8}>
                    <EmergencyStopCard />
                </CCol>
            </CRow>
            <CRow>
                <CCol>
                    <RobotStatusCard />
                </CCol>
            </CRow>
        </>
    )
}

export default RobotStatus
