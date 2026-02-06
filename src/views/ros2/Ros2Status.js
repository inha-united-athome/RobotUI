import React, { useState, useEffect } from 'react'
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CProgress,
    CBadge,
    CTable,
    CTableHead,
    CTableBody,
    CTableRow,
    CTableHeaderCell,
    CTableDataCell,
    CFormInput,
    CButton,
    CWidgetStatsF,
    CListGroup,
    CListGroupItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
    cilLan,
    cilCheckCircle,
    cilXCircle,
    cilReload,
    cilSignalCellular4,
    cilSettings,
} from '@coreui/icons'
import { useRos } from '../../context/RosContext'
import { useRosTopic } from '../../hooks/useRosTopic'

// 토픽 Hz 모니터 컴포넌트
const TopicHzMonitor = ({ topicName, messageType }) => {
    const { hz, isSubscribed } = useRosTopic(topicName, messageType, { throttleMs: 200 })

    const getHzColor = (hz) => {
        if (hz === 0) return 'secondary'
        if (hz < 5) return 'warning'
        if (hz < 20) return 'info'
        return 'success'
    }

    return (
        <CTableRow>
            <CTableDataCell>
                <CIcon
                    icon={hz > 0 ? cilCheckCircle : cilXCircle}
                    className={`text-${hz > 0 ? 'success' : 'danger'} me-2`}
                />
                <code className="small">{topicName}</code>
            </CTableDataCell>
            <CTableDataCell className="text-center">
                <small className="text-body-secondary">{messageType}</small>
            </CTableDataCell>
            <CTableDataCell className="text-center">
                <CBadge color={getHzColor(hz)}>{hz} Hz</CBadge>
            </CTableDataCell>
            <CTableDataCell>
                <CProgress
                    value={Math.min(hz * 2, 100)}
                    color={getHzColor(hz)}
                    style={{ height: '6px' }}
                />
            </CTableDataCell>
        </CTableRow>
    )
}

// 주요 토픽 목록 (필요에 따라 확장)
const MONITORED_TOPICS = [
    { name: '/joint_states', type: 'sensor_msgs/JointState' },
    { name: '/tf', type: 'tf2_msgs/TFMessage' },
    { name: '/tf_static', type: 'tf2_msgs/TFMessage' },
    { name: '/robot_description', type: 'std_msgs/String' },
    { name: '/diagnostics', type: 'diagnostic_msgs/DiagnosticArray' },
    { name: '/cmd_vel', type: 'geometry_msgs/Twist' },
    { name: '/odom', type: 'nav_msgs/Odometry' },
    { name: '/scan', type: 'sensor_msgs/LaserScan' },
]

// ROS2 연결 상태 위젯
const Ros2ConnectionWidget = () => {
    const { isConnected, url, error } = useRos()

    return (
        <CWidgetStatsF
            className="mb-3"
            color={isConnected ? 'success' : 'danger'}
            icon={<CIcon icon={isConnected ? cilCheckCircle : cilXCircle} height={24} />}
            title="ROS Bridge Connection"
            value={isConnected ? 'Connected' : 'Disconnected'}
            footer={
                <span className="text-body-secondary small">
                    {error ? `Error: ${error}` : url}
                </span>
            }
        />
    )
}

// Domain ID 정보 카드
const DomainInfoCard = () => {
    const { message: domainData } = useRosTopic('/ros_info/domain_id', 'std_msgs/Int32')
    const { message: networkData } = useRosTopic('/ros_info/network', 'std_msgs/String')

    let networkInfo = {}
    try {
        if (networkData?.data) {
            networkInfo = JSON.parse(networkData.data)
        }
    } catch (e) {
        // Ignore parse errors
    }

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong><CIcon icon={cilSettings} className="me-2" />ROS2 Configuration</strong>
            </CCardHeader>
            <CCardBody>
                <CRow>
                    <CCol md={6}>
                        <div className="border-start border-start-4 border-start-primary py-1 px-3 mb-3">
                            <div className="text-body-secondary small">ROS_DOMAIN_ID</div>
                            <div className="fs-5 fw-semibold">
                                {domainData?.data !== undefined ? domainData.data : 'N/A'}
                            </div>
                        </div>
                    </CCol>
                    <CCol md={6}>
                        <div className="border-start border-start-4 border-start-info py-1 px-3 mb-3">
                            <div className="text-body-secondary small">Network Interface</div>
                            <div className="fs-5 fw-semibold">
                                {networkInfo.interface || 'N/A'}
                            </div>
                        </div>
                    </CCol>
                </CRow>
                <CRow>
                    <CCol md={6}>
                        <div className="border-start border-start-4 border-start-success py-1 px-3 mb-3">
                            <div className="text-body-secondary small">IP Address</div>
                            <div className="fs-5 fw-semibold">
                                {networkInfo.ip || 'N/A'}
                            </div>
                        </div>
                    </CCol>
                    <CCol md={6}>
                        <div className="border-start border-start-4 border-start-warning py-1 px-3 mb-3">
                            <div className="text-body-secondary small">RMW Implementation</div>
                            <div className="fs-5 fw-semibold">
                                {networkInfo.rmw || 'N/A'}
                            </div>
                        </div>
                    </CCol>
                </CRow>
            </CCardBody>
        </CCard>
    )
}

// 네트워크 사용량 카드
const NetworkUsageCard = () => {
    const { message: bandwidthData } = useRosTopic('/ros_info/bandwidth', 'std_msgs/String')

    let bandwidth = {}
    try {
        if (bandwidthData?.data) {
            bandwidth = JSON.parse(bandwidthData.data)
        }
    } catch (e) {
        // Ignore parse errors
    }

    const formatBytes = (bytes) => {
        if (!bytes) return 'N/A'
        if (bytes < 1024) return `${bytes} B/s`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB/s`
        return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`
    }

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong><CIcon icon={cilSignalCellular4} className="me-2" />Network Usage</strong>
            </CCardHeader>
            <CCardBody>
                <CRow>
                    <CCol md={6}>
                        <div className="text-center mb-3">
                            <div className="text-body-secondary">Inbound</div>
                            <div className="fs-4 fw-semibold text-success">
                                {formatBytes(bandwidth.rx)}
                            </div>
                        </div>
                    </CCol>
                    <CCol md={6}>
                        <div className="text-center mb-3">
                            <div className="text-body-secondary">Outbound</div>
                            <div className="fs-4 fw-semibold text-primary">
                                {formatBytes(bandwidth.tx)}
                            </div>
                        </div>
                    </CCol>
                </CRow>
                <CRow>
                    <CCol>
                        <div className="text-center">
                            <div className="text-body-secondary">Total Bandwidth</div>
                            <div className="fs-4 fw-semibold">
                                {formatBytes((bandwidth.rx || 0) + (bandwidth.tx || 0))}
                            </div>
                        </div>
                    </CCol>
                </CRow>
            </CCardBody>
        </CCard>
    )
}

// 노드 목록 카드
const NodeListCard = () => {
    const [nodes, setNodes] = useState([])
    const { ros, isConnected } = useRos()

    const refreshNodes = () => {
        if (!ros || !isConnected) return

        ros.getNodes((nodeList) => {
            setNodes(nodeList || [])
        })
    }

    useEffect(() => {
        refreshNodes()
        const interval = setInterval(refreshNodes, 5000)
        return () => clearInterval(interval)
    }, [ros, isConnected])

    return (
        <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong>🔧 Active Nodes</strong>
                <CButton size="sm" color="light" onClick={refreshNodes}>
                    <CIcon icon={cilReload} />
                </CButton>
            </CCardHeader>
            <CCardBody style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {nodes.length > 0 ? (
                    <CListGroup>
                        {nodes.map((node) => (
                            <CListGroupItem key={node} className="py-1">
                                <code className="small">{node}</code>
                            </CListGroupItem>
                        ))}
                    </CListGroup>
                ) : (
                    <p className="text-body-secondary mb-0">
                        {isConnected ? 'No nodes found' : 'Not connected to ROS'}
                    </p>
                )}
            </CCardBody>
        </CCard>
    )
}

const Ros2Status = () => {
    return (
        <>
            <CRow>
                <CCol md={4}>
                    <Ros2ConnectionWidget />
                </CCol>
                <CCol md={8}>
                    <DomainInfoCard />
                </CCol>
            </CRow>

            <CRow>
                <CCol md={8}>
                    <NetworkUsageCard />
                </CCol>
                <CCol md={4}>
                    <NodeListCard />
                </CCol>
            </CRow>

            <CRow>
                <CCol>
                    <CCard className="mb-4">
                        <CCardHeader>
                            <strong><CIcon icon={cilLan} className="me-2" />Topic Hz Monitor</strong>
                        </CCardHeader>
                        <CCardBody>
                            <CTable hover responsive>
                                <CTableHead>
                                    <CTableRow>
                                        <CTableHeaderCell>Topic</CTableHeaderCell>
                                        <CTableHeaderCell className="text-center">Type</CTableHeaderCell>
                                        <CTableHeaderCell className="text-center">Frequency</CTableHeaderCell>
                                        <CTableHeaderCell>Activity</CTableHeaderCell>
                                    </CTableRow>
                                </CTableHead>
                                <CTableBody>
                                    {MONITORED_TOPICS.map((topic) => (
                                        <TopicHzMonitor
                                            key={topic.name}
                                            topicName={topic.name}
                                            messageType={topic.type}
                                        />
                                    ))}
                                </CTableBody>
                            </CTable>
                        </CCardBody>
                    </CCard>
                </CCol>
            </CRow>
        </>
    )
}

export default Ros2Status
