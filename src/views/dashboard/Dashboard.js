import React from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CWidgetStatsF,
  CProgress,
  CBadge,
  CListGroup,
  CListGroupItem,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilBattery5,
  cilLaptop,
  cilRouter,
  cilCheckCircle,
  cilXCircle,
  cilChart,
} from '@coreui/icons'
import { useRosSummary, useRosStatus, usePCStatus, useSensorsStatus } from '../../hooks/useApi'

// ROS 연결 상태 위젯
const RosConnectionWidget = () => {
  const { data, loading } = useRosStatus(5000)

  if (loading) {
    return (
      <CWidgetStatsF
        className="mb-3"
        color="secondary"
        icon={<CSpinner size="sm" />}
        title="ROS2"
        value="Loading..."
      />
    )
  }

  const isConnected = data?.node_running ?? false

  return (
    <CWidgetStatsF
      className="mb-3"
      color={isConnected ? 'success' : 'danger'}
      icon={<CIcon icon={isConnected ? cilCheckCircle : cilXCircle} height={24} />}
      title="ROS2 Node"
      value={isConnected ? 'Running' : 'Stopped'}
      footer={
        <small>
          Domain ID: {data?.domain_id ?? 'N/A'} | Topics: {data?.subscribed_topics?.length ?? 0}
        </small>
      }
    />
  )
}

// 배터리 위젯
const BatteryWidget = () => {
  const { data } = useRosSummary(2000)
  const battery = data?.battery ?? {}
  const percentage = battery.percentage ?? 0
  const voltage = battery.voltage ?? 0

  const getColor = () => {
    if (percentage > 50) return 'success'
    if (percentage > 20) return 'warning'
    return 'danger'
  }

  return (
    <CWidgetStatsF
      className="mb-3"
      color={getColor()}
      icon={<CIcon icon={cilBattery5} height={24} />}
      title="Battery"
      value={`${percentage.toFixed(0)}%`}
      footer={<small>Voltage: {voltage.toFixed(1)}V</small>}
    />
  )
}

// PC 상태 위젯
const PCStatusWidget = () => {
  const { data: pc1 } = usePCStatus('pc1', 3000)
  const { data: pc2 } = usePCStatus('pc2', 3000)

  const getStatus = (pc) => {
    if (!pc) return { online: false, cpu: 0 }
    return { online: pc.online, cpu: pc.cpu_percent ?? 0 }
  }

  const s1 = getStatus(pc1)
  const s2 = getStatus(pc2)
  const allOnline = s1.online && s2.online

  return (
    <CWidgetStatsF
      className="mb-3"
      color={allOnline ? 'info' : 'warning'}
      icon={<CIcon icon={cilLaptop} height={24} />}
      title="PC Status"
      value={allOnline ? 'All Online' : 'Check Required'}
      footer={
        <small>
          PC1: {s1.online ? `${s1.cpu.toFixed(0)}%` : 'Offline'} |
          PC2: {s2.online ? `${s2.cpu.toFixed(0)}%` : 'Offline'}
        </small>
      }
    />
  )
}

// 센서 위젯
const SensorWidget = () => {
  const { data } = useSensorsStatus(5000)

  if (!data) {
    return (
      <CWidgetStatsF
        className="mb-3"
        color="secondary"
        icon={<CIcon icon={cilRouter} height={24} />}
        title="Sensors"
        value="Loading..."
      />
    )
  }

  const lidarOnline = data.lidars?.filter(l => l.online).length ?? 0
  const lidarTotal = data.lidars?.length ?? 0
  const rsConnected = data.realsense?.filter(r => r.connected).length ?? 0
  const rsTotal = data.realsense?.length ?? 0

  const allOk = lidarOnline === lidarTotal && rsConnected === rsTotal

  return (
    <CWidgetStatsF
      className="mb-3"
      color={allOk ? 'success' : 'warning'}
      icon={<CIcon icon={cilRouter} height={24} />}
      title="Sensors"
      value={allOk ? 'All Connected' : 'Check Required'}
      footer={
        <small>
          LiDAR: {lidarOnline}/{lidarTotal} | RealSense: {rsConnected}/{rsTotal}
        </small>
      }
    />
  )
}

// 로봇 개요 카드
const RobotOverviewCard = () => {
  const { data } = useRosSummary(2000)

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>🤖 Robot Overview</strong>
      </CCardHeader>
      <CCardBody>
        <CRow>
          <CCol sm={4}>
            <div className="border-start border-start-4 border-start-info py-1 px-3">
              <div className="text-body-secondary small">Joints</div>
              <div className="fs-5 fw-semibold">{data?.joints?.count ?? 0}</div>
            </div>
          </CCol>
          <CCol sm={4}>
            <div className="border-start border-start-4 border-start-warning py-1 px-3">
              <div className="text-body-secondary small">Diagnostics</div>
              <div className="fs-5 fw-semibold">
                {data?.diagnostics?.count ?? 0}
                {data?.diagnostics?.errors > 0 && (
                  <CBadge color="danger" className="ms-2">{data.diagnostics.errors} errors</CBadge>
                )}
              </div>
            </div>
          </CCol>
          <CCol sm={4}>
            <div className="border-start border-start-4 border-start-success py-1 px-3">
              <div className="text-body-secondary small">Topics Active</div>
              <div className="fs-5 fw-semibold">
                {data?.topics_active ?? 0} / {data?.topics_configured ?? 0}
              </div>
            </div>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  )
}

// 시스템 정보 카드
const SystemInfoCard = () => {
  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>ℹ️ Welcome to Robot Web UI</strong>
      </CCardHeader>
      <CCardBody>
        <p>이 대시보드는 로봇의 실시간 상태를 모니터링합니다.</p>
        <ul className="mb-0">
          <li><strong>Robot Status</strong> - 배터리, 관절, 진단</li>
          <li><strong>PC Monitor</strong> - CPU, 메모리, GPU, 온도</li>
          <li><strong>Sensor Status</strong> - LiDAR, RealSense, 카메라</li>
          <li><strong>ROS2 Status</strong> - 토픽, 노드, 대역폭</li>
          <li><strong>Visualization</strong> - 맵, 경로, MoveIt</li>
        </ul>
      </CCardBody>
    </CCard>
  )
}

const Dashboard = () => {
  return (
    <>
      {/* 상단 위젯 */}
      <CRow>
        <CCol sm={6} lg={3}>
          <RosConnectionWidget />
        </CCol>
        <CCol sm={6} lg={3}>
          <BatteryWidget />
        </CCol>
        <CCol sm={6} lg={3}>
          <PCStatusWidget />
        </CCol>
        <CCol sm={6} lg={3}>
          <SensorWidget />
        </CCol>
      </CRow>

      {/* 메인 콘텐츠 */}
      <CRow>
        <CCol md={6}>
          <RobotOverviewCard />
        </CCol>
        <CCol md={6}>
          <SystemInfoCard />
        </CCol>
      </CRow>
    </>
  )
}

export default Dashboard
