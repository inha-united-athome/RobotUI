import React, { useState, useEffect, useCallback } from 'react'
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
    CSpinner,
    CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
    cilRouter,
    cilCheckCircle,
    cilXCircle,
    cilGlobeAlt,
    cilReload,
} from '@coreui/icons'
import { useSensorsStatus, useRosTopics, pingHost } from '../../hooks/useApi'

// ROS 토픽 기반 센서 목록
const ROS_SENSORS = [
    { name: 'RGB Camera', topic: '/camera/color/image_raw' },
    { name: 'Depth Camera', topic: '/camera/depth/image_rect_raw' },
    { name: '2D LiDAR', topic: '/scan' },
    { name: '3D LiDAR', topic: '/points' },
    { name: 'IMU', topic: '/imu/data' },
    { name: 'Force Sensor L', topic: '/force_sensor/left' },
    { name: 'Force Sensor R', topic: '/force_sensor/right' },
]

// ROS 토픽 센서 행
const RosSensorRow = ({ sensor, topicsData }) => {
    const topicData = topicsData?.[sensor.topic]
    const isActive = topicData?.available ?? false

    return (
        <CTableRow>
            <CTableDataCell>
                <CIcon
                    icon={isActive ? cilCheckCircle : cilXCircle}
                    className={`text-${isActive ? 'success' : 'danger'} me-2`}
                />
                {sensor.name}
            </CTableDataCell>
            <CTableDataCell>
                <code className="small">{sensor.topic}</code>
            </CTableDataCell>
            <CTableDataCell className="text-center">
                <CBadge color={isActive ? 'success' : 'secondary'}>
                    {isActive ? 'Active' : 'Inactive'}
                </CBadge>
            </CTableDataCell>
            <CTableDataCell>
                {topicData?.timestamp && (
                    <small className="text-body-secondary">
                        {new Date(topicData.timestamp).toLocaleTimeString()}
                    </small>
                )}
            </CTableDataCell>
        </CTableRow>
    )
}

// API 기반 센서 상태 카드 (Raw 접근)
const RawSensorStatusCard = () => {
    const { data: sensorData, error, loading, refetch } = useSensorsStatus(3000)

    return (
        <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong><CIcon icon={cilRouter} className="me-2" />Raw Sensor Status (IP/USB)</strong>
                <CButton size="sm" color="light" onClick={refetch}>
                    <CIcon icon={cilReload} />
                </CButton>
            </CCardHeader>
            <CCardBody>
                {error && (
                    <CAlert color="warning" className="py-1">
                        API 연결 실패: {error}
                    </CAlert>
                )}

                {loading && <CSpinner size="sm" />}

                {sensorData && (
                    <>
                        {/* LiDAR 상태 */}
                        <h6 className="mb-2">📡 LiDAR (IP Ping)</h6>
                        <CRow className="mb-3">
                            {sensorData.lidars?.map((lidar) => (
                                <CCol md={6} key={lidar.ip}>
                                    <div className={`border-start border-start-4 border-start-${lidar.online ? 'success' : 'danger'} py-2 px-3 mb-2`}>
                                        <div className="d-flex justify-content-between">
                                            <span>{lidar.name}</span>
                                            <CBadge color={lidar.online ? 'success' : 'danger'}>
                                                {lidar.online ? `${lidar.ping_ms?.toFixed(1)}ms` : 'Offline'}
                                            </CBadge>
                                        </div>
                                        <small className="text-body-secondary">{lidar.ip}</small>
                                    </div>
                                </CCol>
                            ))}
                        </CRow>

                        {/* RealSense 상태 */}
                        <h6 className="mb-2">📷 RealSense Cameras (rs-enumerate)</h6>
                        <CRow className="mb-3">
                            {sensorData.realsense?.map((rs, idx) => (
                                <CCol md={4} key={rs.serial || idx}>
                                    <div className={`border-start border-start-4 border-start-${rs.connected ? 'success' : 'danger'} py-2 px-3 mb-2`}>
                                        <div className="d-flex justify-content-between">
                                            <span>{rs.name}</span>
                                            <CBadge color={rs.connected ? 'success' : 'danger'}>
                                                {rs.connected ? 'Connected' : 'Disconnected'}
                                            </CBadge>
                                        </div>
                                        <small className="text-body-secondary">S/N: {rs.serial || 'Not set'}</small>
                                        {rs.device_name && (
                                            <div><small className="text-info">{rs.device_name}</small></div>
                                        )}
                                    </div>
                                </CCol>
                            ))}
                        </CRow>

                        {/* Video 디바이스 */}
                        <h6 className="mb-2">🎥 Video Devices (/dev/video*)</h6>
                        <div className="d-flex flex-wrap gap-2 mb-3">
                            {sensorData.cameras?.map((cam) => (
                                <CBadge key={cam.device} color={cam.available ? 'success' : 'secondary'}>
                                    {cam.device}
                                </CBadge>
                            ))}
                            {(!sensorData.cameras || sensorData.cameras.length === 0) && (
                                <span className="text-body-secondary">No video devices found</span>
                            )}
                        </div>

                        {/* Audio 장치 - 기본 상태만 표시 */}
                        <h6 className="mb-2">🔊 Audio Devices</h6>
                        <CRow className="mb-3">
                            {sensorData.audio?.map((audio, idx) => (
                                <CCol md={6} key={audio.type || idx}>
                                    <div className={`border-start border-start-4 border-start-${audio.connected ? 'success' : 'danger'} py-2 px-3 mb-2`}>
                                        <div className="d-flex justify-content-between">
                                            <span>
                                                {audio.type === 'speaker' ? '🔊' : '🎤'} {audio.name}
                                            </span>
                                            <CBadge color={audio.connected ? 'success' : 'danger'}>
                                                {audio.connected ? 'Connected' : 'Disconnected'}
                                            </CBadge>
                                        </div>
                                    </div>
                                </CCol>
                            ))}
                        </CRow>
                    </>
                )}
            </CCardBody>
        </CCard>
    )
}

// 오디오 테스트 카드
const AudioTestCard = () => {
    const [audioDevices, setAudioDevices] = useState(null)
    const [selectedSpeaker, setSelectedSpeaker] = useState('default')
    const [selectedMic, setSelectedMic] = useState('default')
    const [testing, setTesting] = useState(null)
    const [testResult, setTestResult] = useState(null)
    const [loading, setLoading] = useState(false)

    const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : ''

    const loadDevices = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/api/sensors/audio/list`)
            const data = await res.json()
            setAudioDevices(data)
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    const updateVolume = useCallback(async (type, id) => {
        try {
            // 현재는 get_volume이 전체를 리턴하지만 device_id를 주면 해당 장치의 볼륨을 우선으로 가져오도록 백엔드가 수정됨
            const res = await fetch(`${API_BASE}/api/sensors/audio/volume?device_id=${id}`)
            const data = await res.json()
            setVolume(prev => ({ ...prev, [type]: data[type] }))
        } catch (e) {
            console.error(e)
        }
    }, [API_BASE])

    // 장치 선택 변경 시 볼륨 다시 조회
    useEffect(() => {
        if (selectedSpeaker && selectedSpeaker !== 'default') {
            updateVolume('speaker', selectedSpeaker)
        }
    }, [selectedSpeaker, updateVolume])

    useEffect(() => {
        if (selectedMic && selectedMic !== 'default') {
            updateVolume('microphone', selectedMic)
        }
    }, [selectedMic, updateVolume])

    const testSpeaker = async () => {
        setTesting('speaker')
        setTestResult(null)
        try {
            const res = await fetch(`${API_BASE}/api/sensors/audio/test/speaker?device_id=${selectedSpeaker}`, {
                method: 'POST'
            })
            const data = await res.json()
            setTestResult({ type: 'speaker', ...data })
        } catch (e) {
            setTestResult({ type: 'speaker', success: false, error: e.message })
        }
        setTesting(null)
    }

    const testMicrophone = async () => {
        setTesting('microphone')
        setTestResult(null)
        try {
            // 마이크 테스트 시 스피커 ID도 함께 전송 (녹음 후 재생용)
            // 녹음 3초 + 재생 3초 + 여유 = 약 6~7초 소요됨
            const res = await fetch(`${API_BASE}/api/sensors/audio/test/microphone?device_id=${selectedMic}&speaker_id=${selectedSpeaker}`, {
                method: 'POST'
            })
            const data = await res.json()
            setTestResult({ type: 'microphone', ...data })
        } catch (e) {
            setTestResult({ type: 'microphone', success: false, error: e.message })
        }
        setTesting(null)
    }

    const handleVolumeChange = async (deviceType, value) => {
        setVolume(prev => ({ ...prev, [deviceType]: value }))
    }

    const applyVolume = async (deviceType) => {
        try {
            const deviceId = deviceType === 'speaker' ? selectedSpeaker : selectedMic
            await fetch(`${API_BASE}/api/sensors/audio/volume?device_type=${deviceType}&volume=${volume[deviceType]}&device_id=${deviceId}`, {
                method: 'POST'
            })
            setTestResult({ type: deviceType, success: true, message: `Volume set to ${volume[deviceType]}%` })
        } catch (e) {
            setTestResult({ type: deviceType, success: false, error: e.message })
        }
    }
    return (
        <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong>🎧 Audio Device Test</strong>
                <CButton size="sm" color="light" onClick={loadDevices} disabled={loading}>
                    {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} />}
                </CButton>
            </CCardHeader>
            <CCardBody>
                {!audioDevices && (
                    <CButton color="primary" onClick={loadDevices}>
                        Load Audio Devices
                    </CButton>
                )}

                {audioDevices && (
                    <CRow>
                        {/* 스피커 */}
                        <CCol md={6}>
                            <h6>🔊 Speaker</h6>
                            <select
                                className="form-select form-select-sm mb-2"
                                value={selectedSpeaker}
                                onChange={(e) => setSelectedSpeaker(e.target.value)}
                            >
                                <option value="default">Default</option>
                                {audioDevices.speakers?.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.id})
                                    </option>
                                ))}
                            </select>
                            <CButton
                                size="sm"
                                color="primary"
                                onClick={testSpeaker}
                                disabled={testing === 'speaker'}
                            >
                                {testing === 'speaker' ? <CSpinner size="sm" /> : '🔊 Test Speaker'}
                            </CButton>
                        </CCol>

                        {/* 마이크 */}
                        <CCol md={6}>
                            <h6>🎤 Microphone</h6>
                            <select
                                className="form-select form-select-sm mb-2"
                                value={selectedMic}
                                onChange={(e) => setSelectedMic(e.target.value)}
                            >
                                <option value="default">Default</option>
                                {audioDevices.microphones?.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.id})
                                    </option>
                                ))}
                            </select>
                            <CButton
                                size="sm"
                                color="info"
                                onClick={testMicrophone}
                                disabled={testing === 'microphone'}
                            >
                                {testing === 'microphone' ? <CSpinner size="sm" /> : '🎤 Test Microphone'}
                            </CButton>
                        </CCol>
                    </CRow>
                )}

                {testResult && (
                    <CAlert
                        color={testResult.success ? 'success' : 'danger'}
                        className="mt-3 py-2"
                    >
                        <strong>{testResult.type === 'speaker' ? '🔊' : '🎤'} Test Result:</strong>{' '}
                        {testResult.success
                            ? (testResult.message || 'Success!')
                            : `Failed: ${testResult.error}`
                        }
                    </CAlert>
                )}
            </CCardBody>
        </CCard>
    )
}

// Ping 테스트 카드
const PingTestCard = () => {
    const [pingTarget, setPingTarget] = useState('192.168.0.1')
    const [pingResult, setPingResult] = useState(null)
    const [pinging, setPinging] = useState(false)

    const handlePing = async () => {
        setPinging(true)
        try {
            const result = await pingHost(pingTarget)
            setPingResult(result)
        } catch (err) {
            setPingResult({ online: false, error: err.message })
        } finally {
            setPinging(false)
        }
    }

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>🏓 Ping Test</strong>
            </CCardHeader>
            <CCardBody>
                <div className="d-flex gap-2 mb-3">
                    <CFormInput
                        type="text"
                        value={pingTarget}
                        onChange={(e) => setPingTarget(e.target.value)}
                        placeholder="IP Address"
                    />
                    <CButton color="primary" onClick={handlePing} disabled={pinging}>
                        {pinging ? <CSpinner size="sm" /> : 'Ping'}
                    </CButton>
                </div>
                {pingResult && (
                    <CAlert color={pingResult.online ? 'success' : 'danger'} className="mb-0">
                        {pingResult.online
                            ? `✅ ${pingTarget} is reachable (${pingResult.ping_ms?.toFixed(1)}ms)`
                            : `❌ ${pingTarget} is not reachable`}
                    </CAlert>
                )}
            </CCardBody>
        </CCard>
    )
}

const SensorStatus = () => {
    const { data: topicsData } = useRosTopics(3000)

    return (
        <>
            <CRow>
                <CCol md={8}>
                    {/* Raw API 기반 센서 상태 */}
                    <RawSensorStatusCard />
                </CCol>
                <CCol md={4}>
                    <PingTestCard />
                </CCol>
            </CRow>

            {/* 오디오 테스트 */}
            <AudioTestCard />

            {/* ROS 토픽 기반 센서 상태 */}
            <CCard className="mb-4">
                <CCardHeader>
                    <strong><CIcon icon={cilGlobeAlt} className="me-2" />ROS2 Topic Sensor Status</strong>
                </CCardHeader>
                <CCardBody>
                    <CTable hover responsive>
                        <CTableHead>
                            <CTableRow>
                                <CTableHeaderCell>Sensor</CTableHeaderCell>
                                <CTableHeaderCell>Topic</CTableHeaderCell>
                                <CTableHeaderCell className="text-center">Status</CTableHeaderCell>
                                <CTableHeaderCell>Last Update</CTableHeaderCell>
                            </CTableRow>
                        </CTableHead>
                        <CTableBody>
                            {ROS_SENSORS.map((sensor) => (
                                <RosSensorRow key={sensor.topic} sensor={sensor} topicsData={topicsData} />
                            ))}
                        </CTableBody>
                    </CTable>
                </CCardBody>
            </CCard>
        </>
    )
}

export default SensorStatus
