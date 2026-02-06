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
    CWidgetStatsF,
    CAlert,
    CTable,
    CTableHead,
    CTableBody,
    CTableRow,
    CTableHeaderCell,
    CTableDataCell,
    CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
    cilMemory,
    cilSpeedometer,
    cilStorage,
    cilBolt,
    cilClock,
    cilCheckCircle,
    cilXCircle,
    cilList,
} from '@coreui/icons'
import { useRosTopic } from '../../hooks/useRosTopic'
import { usePCStatus, useAllPCStatus, usePCProcesses } from '../../hooks/useApi'

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

                {/* GPU - Jetson은 통합 메모리라 별도 표시 불필요 */}

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

const PCMonitor = () => {
    const [activeTab, setActiveTab] = useState('all')

    return (
        <>
            <CCard className="mb-4">
                <CCardHeader>
                    <strong>💻 PC Monitor</strong>
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
                        </CTabPane>
                        <CTabPane visible={activeTab === 'pc2'}>
                            <SinglePCMonitor pcId="pc2" name="PC 2 (Slave)" />
                            <ProcessList pcId="pc2" name="PC 2 (Slave)" />
                        </CTabPane>
                    </CTabContent>
                </CCardBody>
            </CCard>

            {/* API 상태 정보 */}
            <CCard className="mb-4">
                <CCardHeader>
                    <strong>ℹ️ Data Source</strong>
                </CCardHeader>
                <CCardBody>
                    <CRow>
                        <CCol md={6}>
                            <div className="border-start border-start-4 border-start-primary py-1 px-3">
                                <div className="text-body-secondary small">Backend API</div>
                                <code>http://localhost:8000/api/pc/</code>
                            </div>
                        </CCol>
                        <CCol md={6}>
                            <div className="border-start border-start-4 border-start-info py-1 px-3">
                                <div className="text-body-secondary small">ROS2 Topics (Fallback)</div>
                                <code>/system_monitor/pc{'{1,2}'}/*</code>
                            </div>
                        </CCol>
                    </CRow>
                </CCardBody>
            </CCard>
        </>
    )
}

export default PCMonitor
