import React, { useRef, useEffect, useState } from 'react'
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CBadge,
    CFormSelect,
    CButton,
    CButtonGroup,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
    cilMediaPlay,
    cilMediaPause,
    cilReload,
    cilFullscreen,
} from '@coreui/icons'
import { useRos } from '../../context/RosContext'
import { useRosTopic } from '../../hooks/useRosTopic'

// 카메라 이미지 뷰어 컴포넌트
const ImageViewer = ({ topic, title }) => {
    const [imageData, setImageData] = useState(null)
    const { ros, isConnected } = useRos()
    const canvasRef = useRef(null)

    useEffect(() => {
        if (!ros || !isConnected || !topic) return

        // compressed 이미지 토픽 사용 (더 효율적)
        const imageTopic = new window.ROSLIB.Topic({
            ros,
            name: topic,
            messageType: 'sensor_msgs/CompressedImage',
        })

        imageTopic.subscribe((message) => {
            setImageData(`data:image/jpeg;base64,${message.data}`)
        })

        return () => {
            imageTopic.unsubscribe()
        }
    }, [ros, isConnected, topic])

    return (
        <CCard className="mb-4 h-100">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong>{title}</strong>
                <code className="small text-body-secondary">{topic}</code>
            </CCardHeader>
            <CCardBody className="d-flex align-items-center justify-content-center" style={{ minHeight: '300px' }}>
                {imageData ? (
                    <img
                        src={imageData}
                        alt={title}
                        style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                    />
                ) : (
                    <div className="text-body-secondary text-center">
                        <p className="mb-0">No image data</p>
                        <small>Waiting for compressed image...</small>
                    </div>
                )}
            </CCardBody>
        </CCard>
    )
}

// TF 트리 시각화 컴포넌트
const TFTreeViewer = () => {
    const [tfFrames, setTfFrames] = useState([])
    const { message: tfMessage } = useRosTopic('/tf', 'tf2_msgs/TFMessage')
    const { message: tfStaticMessage } = useRosTopic('/tf_static', 'tf2_msgs/TFMessage')

    useEffect(() => {
        const frames = new Set()

        if (tfMessage?.transforms) {
            tfMessage.transforms.forEach((t) => {
                frames.add(t.header.frame_id)
                frames.add(t.child_frame_id)
            })
        }

        if (tfStaticMessage?.transforms) {
            tfStaticMessage.transforms.forEach((t) => {
                frames.add(t.header.frame_id)
                frames.add(t.child_frame_id)
            })
        }

        setTfFrames(Array.from(frames).sort())
    }, [tfMessage, tfStaticMessage])

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>🌳 TF Frames</strong>
                <CBadge color="info" className="ms-2">{tfFrames.length}</CBadge>
            </CCardHeader>
            <CCardBody style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {tfFrames.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2">
                        {tfFrames.map((frame) => (
                            <CBadge key={frame} color="secondary" className="py-2 px-3">
                                {frame}
                            </CBadge>
                        ))}
                    </div>
                ) : (
                    <p className="text-body-secondary mb-0">No TF frames detected</p>
                )}
            </CCardBody>
        </CCard>
    )
}

// 포인트 클라우드 정보 표시
const PointCloudInfo = () => {
    const { message: pcData, hz } = useRosTopic('/camera/depth/points', 'sensor_msgs/PointCloud2')

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>☁️ Point Cloud</strong>
                <CBadge color={hz > 0 ? 'success' : 'secondary'} className="ms-2">{hz} Hz</CBadge>
            </CCardHeader>
            <CCardBody>
                {pcData ? (
                    <>
                        <div className="mb-2">
                            <span className="text-body-secondary">Frame: </span>
                            <code>{pcData.header?.frame_id}</code>
                        </div>
                        <div className="mb-2">
                            <span className="text-body-secondary">Size: </span>
                            <span>{pcData.width} x {pcData.height}</span>
                        </div>
                        <div className="mb-2">
                            <span className="text-body-secondary">Points: </span>
                            <span>{(pcData.width * pcData.height).toLocaleString()}</span>
                        </div>
                        <div>
                            <span className="text-body-secondary">Fields: </span>
                            <span>{pcData.fields?.map(f => f.name).join(', ')}</span>
                        </div>
                    </>
                ) : (
                    <p className="text-body-secondary mb-0">No point cloud data</p>
                )}
            </CCardBody>
        </CCard>
    )
}

// 마커 정보 표시
const MarkerInfo = () => {
    const [markers, setMarkers] = useState([])
    const { message: markerArray, hz } = useRosTopic('/visualization_marker_array', 'visualization_msgs/MarkerArray')

    useEffect(() => {
        if (markerArray?.markers) {
            setMarkers(markerArray.markers.slice(0, 20)) // 최대 20개
        }
    }, [markerArray])

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>🎯 Markers</strong>
                <CBadge color={hz > 0 ? 'success' : 'secondary'} className="ms-2">{markers.length}</CBadge>
            </CCardHeader>
            <CCardBody style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {markers.length > 0 ? (
                    <table className="table table-sm table-hover mb-0">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Namespace</th>
                                <th>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {markers.map((m, i) => (
                                <tr key={`${m.ns}-${m.id}`}>
                                    <td>{m.id}</td>
                                    <td><code className="small">{m.ns}</code></td>
                                    <td>{m.type}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-body-secondary mb-0">No markers</p>
                )}
            </CCardBody>
        </CCard>
    )
}

const CustomViewer = () => {
    const [selectedCamera, setSelectedCamera] = useState('/camera/color/image_raw/compressed')

    const cameraOptions = [
        { value: '/camera/color/image_raw/compressed', label: 'RGB Camera' },
        { value: '/camera/depth/image_rect_raw/compressed', label: 'Depth Camera' },
        { value: '/camera/infra1/image_rect_raw/compressed', label: 'Infrared 1' },
        { value: '/camera/infra2/image_rect_raw/compressed', label: 'Infrared 2' },
    ]

    return (
        <>
            <CRow>
                <CCol md={8}>
                    <CCard className="mb-4">
                        <CCardHeader className="d-flex justify-content-between align-items-center">
                            <strong>📷 Camera View</strong>
                            <CFormSelect
                                size="sm"
                                style={{ width: 'auto' }}
                                value={selectedCamera}
                                onChange={(e) => setSelectedCamera(e.target.value)}
                            >
                                {cameraOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </CFormSelect>
                        </CCardHeader>
                        <CCardBody className="text-center" style={{ minHeight: '400px', background: '#1a1a1a' }}>
                            <ImageViewer topic={selectedCamera} title="Camera Feed" />
                        </CCardBody>
                    </CCard>
                </CCol>
                <CCol md={4}>
                    <PointCloudInfo />
                    <MarkerInfo />
                </CCol>
            </CRow>
            <CRow>
                <CCol>
                    <TFTreeViewer />
                </CCol>
            </CRow>
        </>
    )
}

export default CustomViewer
