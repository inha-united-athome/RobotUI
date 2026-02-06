import React, { useState } from 'react'
import {
    CCard,
    CCardBody,
    CCardHeader,
    CAlert,
    CFormInput,
    CButton,
    CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilScreenDesktop, cilExternalLink } from '@coreui/icons'

const FoxgloveViewer = () => {
    // 기본 로봇 IP (설정 가능하도록 나중엔 .env나 API에서 가져오면 좋음)
    const [robotIp, setRobotIp] = useState('192.168.50.10')
    const [port, setPort] = useState('8765') // foxglove-bridge 기본 포트
    const [useIframe, setUseIframe] = useState(false)

    // Foxglove Studio URL 생성
    const foxgloveUrl = `https://studio.foxglove.dev/?ds=foxglove-websocket&ds.url=ws://${robotIp}:${port}`

    const openInNewTab = () => {
        window.open(foxgloveUrl, '_blank')
    }

    return (
        <>
            <CAlert color="warning" className="d-flex align-items-center">
                <CIcon icon={cilScreenDesktop} className="flex-shrink-0 me-2" width={24} height={24} />
                <div>
                    <strong>Foxglove Studio 연동</strong>
                    <div className="small">
                        브라우저 보안 정책으로 인해 iframe에서 WebSocket 연결이 차단될 수 있습니다.
                        <strong className="ms-1">새 탭에서 열기</strong>를 권장합니다.
                    </div>
                    <div className="small mt-1">
                        로봇 PC에서 <code>ros2 launch foxglove_bridge foxglove_bridge_launch.xml</code> 실행 필요
                    </div>
                </div>
            </CAlert>

            <CCard className="mb-4">
                <CCardHeader className="d-flex justify-content-between align-items-center py-2">
                    <strong>🦊 3D Visualization</strong>
                    <div className="d-flex gap-2 align-items-center">
                        <span className="small text-body-secondary">Robot IP:</span>
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
                        <CButton size="sm" color="primary" onClick={openInNewTab}>
                            <CIcon icon={cilExternalLink} className="me-1" />
                            새 탭에서 열기
                        </CButton>
                        <CButton
                            size="sm"
                            color={useIframe ? 'success' : 'secondary'}
                            onClick={() => setUseIframe(!useIframe)}
                        >
                            {useIframe ? 'iframe 숨기기' : 'iframe 시도'}
                        </CButton>
                    </div>
                </CCardHeader>
                <CCardBody className="p-0 overflow-hidden" style={{ minHeight: '400px' }}>
                    {useIframe ? (
                        <iframe
                            src={foxgloveUrl}
                            title="Foxglove Studio"
                            width="100%"
                            height="600"
                            style={{ border: 'none' }}
                            allow="accelerometer; camera; encrypted-media; gyroscope; microphone; xr-spatial-tracking; fullscreen"
                        />
                    ) : (
                        <div className="d-flex flex-column align-items-center justify-content-center h-100 p-5 text-center">
                            <div className="display-1 mb-3">🦊</div>
                            <h4>Foxglove Studio</h4>
                            <p className="text-body-secondary mb-4">
                                3D 시각화, 로봇 상태, 카메라 이미지 등을 확인하세요
                            </p>
                            <CButton color="primary" size="lg" onClick={openInNewTab}>
                                <CIcon icon={cilExternalLink} className="me-2" />
                                Foxglove Studio 열기
                            </CButton>
                            <div className="mt-3">
                                <CBadge color="info" className="me-2">ws://{robotIp}:{port}</CBadge>
                            </div>
                        </div>
                    )}
                </CCardBody>
            </CCard>
        </>
    )
}

export default FoxgloveViewer
