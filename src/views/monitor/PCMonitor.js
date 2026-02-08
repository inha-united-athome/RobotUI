import React, { useState } from 'react'
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CProgress,
    CBadge,
    CNav,
    CNavItem,
    CNavLink,
    CTabContent,
    CTabPane,
    CAlert,
    CTable,
    CTableHead,
    CTableBody,
    CTableRow,
    CTableHeaderCell,
    CTableDataCell,
    CSpinner,
    CButton,
    CCollapse,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
    cilMemory,
    cilSpeedometer,
    cilBolt,
    cilClock,
    cilCheckCircle,
    cilXCircle,
    cilList,
    cilSync,
    cilWifiSignal4,
    cilArrowTop,
    cilArrowBottom,
} from '@coreui/icons'
import { useRosTopic } from '../../hooks/useRosTopic'
import { usePCStatus, usePCProcesses, usePCNetwork, useTimeSyncStatus, callApi } from '../../hooks/useApi'

// 바이트를 사람이 읽기 쉬운 형식으로 변환
const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

// PC 상태 카드 (API + ROS 데이터)
const SinglePCMonitor = ({ pcId, name }) => {
    // API에서 Raw 데이터 가져오기
    const { data: apiData, error: apiError, loading } = usePCStatus(pcId, 2000)

    // ROS 토픽에서도 데이터 가져오기 (선택적)
    const topicPrefix = `/system_monitor/${pcId}`
    const { message: rosCpu } = useRosTopic(`${topicPrefix}/cpu_usage`, 'std_msgs/Float32')
    const { message: rosMemory } = useRosTopic(`${topicPrefix}/memory_usage`, 'std_msgs/Float32')

    // API 데이터 우선, ROS 데이터 fallback
    const cpuPercent = apiData?.cpu_percent ?? rosCpu?.data ?? 0
    const memoryPercent = apiData?.memory_percent ?? rosMemory?.data ?? 0
    const powerWatts = apiData?.power_watts ?? 0
    const temperature = apiData?.temperature ?? 0
    const isOnline = apiData?.online ?? false

    const getColor = (value, thresholds = [50, 80]) => {
        if (value < thresholds[0]) return 'success'
        if (value < thresholds[1]) return 'warning'
        return 'danger'
    }

    return (
        <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong>🖥️ {name}</strong>
                <CBadge color={isOnline ? 'success' : 'danger'}>
                    <CIcon icon={isOnline ? cilCheckCircle : cilXCircle} className="me-1" />
                    {isOnline ? 'Online' : 'Offline'}
                </CBadge>
            </CCardHeader>
            <CCardBody>
                {apiError && (
                    <CAlert color="warning" className="py-1 mb-3">
                        API 연결 실패: {apiError}
                    </CAlert>
                )}

                {/* CPU */}
                <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                        <span><CIcon icon={cilSpeedometer} className="me-1" />CPU</span>
                        <span className="fw-semibold">{cpuPercent.toFixed(1)}%</span>
                    </div>
                    <CProgress value={cpuPercent} color={getColor(cpuPercent)} />
                </div>

                {/* Memory */}
                <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                        <span><CIcon icon={cilMemory} className="me-1" />Memory</span>
                        <span className="fw-semibold">
                            {memoryPercent.toFixed(1)}%
                            {apiData?.memory_used_gb && (
                                <small className="text-body-secondary ms-1">
                                    ({apiData.memory_used_gb}/{apiData.memory_total_gb} GB)
                                </small>
                            )}
                        </span>
                    </div>
                    <CProgress value={memoryPercent} color={getColor(memoryPercent)} />
                </div>

                {/* Power & Temp */}
                <CRow className="text-center">
                    <CCol>
                        <div className="border-start border-start-4 border-start-warning py-1 px-3">
                            <div className="text-body-secondary small"><CIcon icon={cilBolt} /> Power</div>
                            <div className="fs-5 fw-semibold">{powerWatts.toFixed(1)}W</div>
                        </div>
                    </CCol>
                    <CCol>
                        <div className={`border-start border-start-4 border-start-${getColor(temperature, [60, 80])} py-1 px-3`}>
                            <div className="text-body-secondary small">🌡️ Temp</div>
                            <div className="fs-5 fw-semibold">{temperature.toFixed(1)}°C</div>
                        </div>
                    </CCol>
                </CRow>

                {/* PC Time / LAN Time */}
                {apiData && (
                    <CRow className="mt-3">
                        <CCol>
                            <CCard className="bg-body-tertiary">
                                <CCardBody className="py-2">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <small className="text-body-secondary"><CIcon icon={cilClock} /> PC Time</small>
                                            <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>
                                                {apiData.pc_time ? new Date(apiData.pc_time).toLocaleString('ko-KR') : 'N/A'}
                                            </div>
                                        </div>
                                        <div className="text-end">
                                            <small className="text-body-secondary">LAN Time</small>
                                            <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>
                                                {apiData.lan_time ? new Date(apiData.lan_time).toLocaleString('ko-KR') : 'N/A'}
                                            </div>
                                        </div>
                                        <div className="text-end">
                                            <small className="text-body-secondary">Diff</small>
                                            <div className={`fw-semibold ${apiData.time_diff_ms > 100 ? 'text-danger' : 'text-success'}`}>
                                                {apiData.time_diff_ms != null ? `${apiData.time_diff_ms.toFixed(0)}ms` : 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </CCardBody>
                            </CCard>
                        </CCol>
                    </CRow>
                )}
            </CCardBody>
        </CCard>
    )
}

// 프로세스 목록 컴포넌트 (jtop 스타일)
const ProcessList = ({ pcId, name }) => {
    const { data, error, loading } = usePCProcesses(pcId, 5000)
    const processes = data?.processes || []

    return (
        <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong><CIcon icon={cilList} className="me-2" />Top Processes - {name}</strong>
                {loading && <CSpinner size="sm" />}
            </CCardHeader>
            <CCardBody className="p-0">
                {error && (
                    <CAlert color="warning" className="m-3 py-1">
                        프로세스 조회 실패: {error}
                    </CAlert>
                )}
                <CTable hover responsive small className="mb-0">
                    <CTableHead>
                        <CTableRow className="bg-body-tertiary">
                            <CTableHeaderCell style={{ width: '60px' }}>PID</CTableHeaderCell>
                            <CTableHeaderCell>Process</CTableHeaderCell>
                            <CTableHeaderCell style={{ width: '90px' }} className="text-end">CPU %</CTableHeaderCell>
                            <CTableHeaderCell style={{ width: '90px' }} className="text-end">MEM %</CTableHeaderCell>
                            <CTableHeaderCell style={{ width: '100px' }}>User</CTableHeaderCell>
                        </CTableRow>
                    </CTableHead>
                    <CTableBody>
                        {processes.length === 0 && !loading && (
                            <CTableRow>
                                <CTableDataCell colSpan={5} className="text-center text-body-secondary py-3">
                                    프로세스 정보 없음
                                </CTableDataCell>
                            </CTableRow>
                        )}
                        {processes.map((proc, idx) => (
                            <CTableRow key={`${proc.pid}-${idx}`}>
                                <CTableDataCell>
                                    <code className="small">{proc.pid}</code>
                                </CTableDataCell>
                                <CTableDataCell>
                                    <span className="text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                                        {proc.name}
                                    </span>
                                </CTableDataCell>
                                <CTableDataCell className="text-end">
                                    <CBadge color={proc.cpu_percent > 50 ? 'danger' : proc.cpu_percent > 20 ? 'warning' : 'success'}>
                                        {proc.cpu_percent.toFixed(1)}%
                                    </CBadge>
                                </CTableDataCell>
                                <CTableDataCell className="text-end">
                                    <CBadge color={proc.memory_percent > 20 ? 'warning' : 'info'}>
                                        {proc.memory_percent.toFixed(1)}%
                                    </CBadge>
                                </CTableDataCell>
                                <CTableDataCell>
                                    <small className="text-body-secondary">{proc.user}</small>
                                </CTableDataCell>
                            </CTableRow>
                        ))}
                    </CTableBody>
                </CTable>
            </CCardBody>
        </CCard>
    )
}

// 네트워크 모니터 컴포넌트 (bmon 스타일)
const NetworkMonitor = ({ pcId, name }) => {
    const { data, error, loading } = usePCNetwork(pcId, 2000)
    const [expandedIface, setExpandedIface] = useState(null)
    const [prevData, setPrevData] = useState({})
    const [rates, setRates] = useState({})

    // RX/TX rate 계산
    React.useEffect(() => {
        if (data?.interfaces && data?.timestamp) {
            const now = new Date(data.timestamp).getTime()
            const newRates = {}

            data.interfaces.forEach(iface => {
                const prev = prevData[iface.name]
                if (prev && prev.timestamp) {
                    const timeDiff = (now - prev.timestamp) / 1000 // seconds
                    if (timeDiff > 0) {
                        newRates[iface.name] = {
                            rx_rate: (iface.rx_bytes - prev.rx_bytes) / timeDiff,
                            tx_rate: (iface.tx_bytes - prev.tx_bytes) / timeDiff,
                        }
                    }
                }
                prevData[iface.name] = {
                    rx_bytes: iface.rx_bytes,
                    tx_bytes: iface.tx_bytes,
                    timestamp: now,
                }
            })

            setPrevData({ ...prevData })
            setRates(newRates)
        }
    }, [data])

    const interfaces = data?.interfaces || []

    return (
        <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong><CIcon icon={cilWifiSignal4} className="me-2" />Network Interfaces - {name}</strong>
                {loading && <CSpinner size="sm" />}
            </CCardHeader>
            <CCardBody>
                {error && (
                    <CAlert color="warning" className="py-1 mb-3">
                        네트워크 조회 실패: {error}
                    </CAlert>
                )}

                {interfaces.length === 0 && !loading && (
                    <div className="text-center text-body-secondary py-3">
                        네트워크 인터페이스 정보 없음
                    </div>
                )}

                {interfaces.map(iface => {
                    const rate = rates[iface.name] || { rx_rate: 0, tx_rate: 0 }
                    const isExpanded = expandedIface === iface.name

                    return (
                        <div key={iface.name} className="mb-2">
                            {/* 요약 행 (클릭 가능) */}
                            <div
                                className={`d-flex justify-content-between align-items-center p-2 rounded ${iface.is_up ? 'bg-body-tertiary' : 'bg-body-secondary'}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setExpandedIface(isExpanded ? null : iface.name)}
                            >
                                <div className="d-flex align-items-center">
                                    <CBadge color={iface.is_up ? 'success' : 'secondary'} className="me-2">
                                        {iface.is_up ? 'UP' : 'DOWN'}
                                    </CBadge>
                                    <strong>{iface.name}</strong>
                                    {iface.ipv4 && (
                                        <small className="text-body-secondary ms-2">({iface.ipv4})</small>
                                    )}
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="text-end">
                                        <small className="text-success">
                                            <CIcon icon={cilArrowBottom} size="sm" />
                                            {formatBytes(rate.rx_rate)}/s
                                        </small>
                                    </div>
                                    <div className="text-end">
                                        <small className="text-primary">
                                            <CIcon icon={cilArrowTop} size="sm" />
                                            {formatBytes(rate.tx_rate)}/s
                                        </small>
                                    </div>
                                    <small className="text-body-secondary">
                                        {isExpanded ? '▲' : '▼'}
                                    </small>
                                </div>
                            </div>

                            {/* 상세 정보 (펼침) */}
                            <CCollapse visible={isExpanded}>
                                <div className="p-3 border border-top-0 rounded-bottom bg-body">
                                    <CRow>
                                        <CCol md={6}>
                                            <h6 className="text-body-secondary mb-2">Traffic</h6>
                                            <table className="table table-sm table-borderless mb-0">
                                                <tbody>
                                                    <tr>
                                                        <td className="text-body-secondary">RX Bytes</td>
                                                        <td className="text-end">{formatBytes(iface.rx_bytes)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-body-secondary">TX Bytes</td>
                                                        <td className="text-end">{formatBytes(iface.tx_bytes)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-body-secondary">RX Packets</td>
                                                        <td className="text-end">{iface.rx_packets?.toLocaleString()}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-body-secondary">TX Packets</td>
                                                        <td className="text-end">{iface.tx_packets?.toLocaleString()}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </CCol>
                                        <CCol md={6}>
                                            <h6 className="text-body-secondary mb-2">Errors & Info</h6>
                                            <table className="table table-sm table-borderless mb-0">
                                                <tbody>
                                                    <tr>
                                                        <td className="text-body-secondary">RX Errors</td>
                                                        <td className="text-end">
                                                            <CBadge color={iface.rx_errors > 0 ? 'danger' : 'success'}>
                                                                {iface.rx_errors}
                                                            </CBadge>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-body-secondary">TX Errors</td>
                                                        <td className="text-end">
                                                            <CBadge color={iface.tx_errors > 0 ? 'danger' : 'success'}>
                                                                {iface.tx_errors}
                                                            </CBadge>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-body-secondary">RX Drops</td>
                                                        <td className="text-end">{iface.rx_drops}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-body-secondary">TX Drops</td>
                                                        <td className="text-end">{iface.tx_drops}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-body-secondary">MTU</td>
                                                        <td className="text-end">{iface.mtu}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-body-secondary">Speed</td>
                                                        <td className="text-end">{iface.speed_mbps} Mbps</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </CCol>
                                    </CRow>
                                </div>
                            </CCollapse>
                        </div>
                    )
                })}
            </CCardBody>
        </CCard>
    )
}

// 시간 동기화 버튼 컴포넌트
const TimeSyncButton = () => {
    const { data: syncStatus, refetch } = useTimeSyncStatus(3000)
    const [loading, setLoading] = useState(false)

    const isRunning = syncStatus?.running ?? false

    const handleToggle = async () => {
        setLoading(true)
        try {
            if (isRunning) {
                await callApi('/api/pc/time-sync/stop', 'POST')
            } else {
                await callApi('/api/pc/time-sync/start', 'POST')
            }
            // 상태 새로고침
            setTimeout(refetch, 500)
        } catch (err) {
            console.error('Time sync error:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <CButton
            color={isRunning ? 'danger' : 'primary'}
            size="sm"
            onClick={handleToggle}
            disabled={loading}
            className="ms-2"
        >
            {loading ? (
                <CSpinner size="sm" />
            ) : (
                <>
                    <CIcon icon={cilSync} className="me-1" />
                    {isRunning ? 'Stop Time Sync' : 'Start Time Sync'}
                </>
            )}
        </CButton>
    )
}

const PCMonitor = () => {
    const [activeTab, setActiveTab] = useState('all')

    return (
        <>
            <CCard className="mb-4">
                <CCardHeader className="d-flex justify-content-between align-items-center">
                    <strong>💻 PC Monitor</strong>
                    <TimeSyncButton />
                </CCardHeader>
                <CCardBody>
                    <CNav variant="tabs" className="mb-3">
                        <CNavItem>
                            <CNavLink active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
                                All PCs
                            </CNavLink>
                        </CNavItem>
                        <CNavItem>
                            <CNavLink active={activeTab === 'pc1'} onClick={() => setActiveTab('pc1')}>
                                PC 1 (Main)
                            </CNavLink>
                        </CNavItem>
                        <CNavItem>
                            <CNavLink active={activeTab === 'pc2'} onClick={() => setActiveTab('pc2')}>
                                PC 2 (Slave)
                            </CNavLink>
                        </CNavItem>
                    </CNav>

                    <CTabContent>
                        <CTabPane visible={activeTab === 'all'}>
                            <CRow>
                                <CCol md={6}>
                                    <SinglePCMonitor pcId="pc1" name="PC 1 (Main)" />
                                </CCol>
                                <CCol md={6}>
                                    <SinglePCMonitor pcId="pc2" name="PC 2 (Slave)" />
                                </CCol>
                            </CRow>
                        </CTabPane>
                        <CTabPane visible={activeTab === 'pc1'}>
                            <SinglePCMonitor pcId="pc1" name="PC 1 (Main)" />
                            <ProcessList pcId="pc1" name="PC 1 (Main)" />
                            <NetworkMonitor pcId="pc1" name="PC 1 (Main)" />
                        </CTabPane>
                        <CTabPane visible={activeTab === 'pc2'}>
                            <SinglePCMonitor pcId="pc2" name="PC 2 (Slave)" />
                            <ProcessList pcId="pc2" name="PC 2 (Slave)" />
                            <NetworkMonitor pcId="pc2" name="PC 2 (Slave)" />
                        </CTabPane>
                    </CTabContent>
                </CCardBody>
            </CCard>
        </>
    )
}

export default PCMonitor
