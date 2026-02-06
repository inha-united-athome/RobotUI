import React, { useState } from 'react'
import {
    CCard,
    CCardBody,
    CCardHeader,
    CAlert,
    CFormInput,
    CButton,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilScreenDesktop } from '@coreui/icons'

const FoxgloveViewer = () => {
    // 기본 로봇 IP (설정 가능하도록 나중엔 .env나 API에서 가져오면 좋음)
    const [robotIp, setRobotIp] = useState('192.168.1.10')
    const [port, setPort] = useState('8765') // foxglove-bridge 기본 포트

    // Foxglove Studio URL 생성
    // ds=rosbridge-websocket 또는 ds=foxglove-websocket 선택 가능
    // 여기서는 foxglove-bridge (8765) 사용 권장 (성능이 훨씬 좋음)
    const foxgloveUrl = `https://studio.foxglove.dev/?ds=foxglove-websocket&ds.url=ws://${robotIp}:${port}`

    return (
        <>
            <CAlert color="info" className="d-flex align-items-center">
                <CIcon icon={cilScreenDesktop} className="flex-shrink-0 me-2" width={24} height={24} />
                <div>
                    <strong>Foxglove Studio Integration</strong>
                    <div className="small">
                        로봇 PC에서 <code>ros2 launch foxglove_bridge foxglove_bridge_launch.xml</code> 명령을 실행해야 합니다.
                    </div>
                </div>
            </CAlert>

            <CCard className="mb-4" style={{ height: 'calc(100vh - 180px)' }}>
                <CCardHeader className="d-flex justify-content-between align-items-center py-2">
                    <strong>🦊 3D Visualization</strong>
                    <div className="d-flex gap-2 align-items-center">
                        <span className="small text-body-secondary">Connection:</span>
                        <CFormInput
                            size="sm"
                            style={{ width: '120px' }}
                            value={robotIp}
                            onChange={(e) => setRobotIp(e.target.value)}
                            placeholder="Robot IP"
                        />
                        <span className="small text-body-secondary">:</span>
                        <CFormInput
                            size="sm"
                            style={{ width: '70px' }}
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            placeholder="Port"
                        />
                        <CButton size="sm" color="primary" onClick={() => window.location.reload()}>
                            Reconnect
                        </CButton>
                    </div>
                </CCardHeader>
                <CCardBody className="p-0 overflow-hidden">
                    <iframe
                        src={foxgloveUrl}
                        title="Foxglove Studio"
                        width="100%"
                        height="100%"
                        style={{ border: 'none' }}
                        allow="accelerometer; camera; encrypted-media; gyroscope; microphone; xr-spatial-tracking; fullscreen"
                    />
                </CCardBody>
            </CCard>
        </>
    )
}

export default FoxgloveViewer
