import React, { useState } from 'react'
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CFormInput,
    CFormLabel,
    CButton,
    CFormSwitch,
    CAlert,
    CListGroup,
    CListGroupItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSave, cilReload } from '@coreui/icons'
import { useRos } from '../../context/RosContext'

const RosSettings = () => {
    const { url, isConnected, connect, disconnect } = useRos()
    const [newUrl, setNewUrl] = useState(url)
    const [autoReconnect, setAutoReconnect] = useState(true)

    const handleConnect = () => {
        // In a real app, you'd update the URL in context
        // For now, just show that settings would be saved
        window.location.reload()
    }

    const handleDisconnect = () => {
        disconnect()
    }

    return (
        <>
            <CRow>
                <CCol md={6}>
                    <CCard className="mb-4">
                        <CCardHeader>
                            <strong>🔌 ROS Bridge Connection</strong>
                        </CCardHeader>
                        <CCardBody>
                            <div className="mb-3">
                                <CFormLabel htmlFor="rosbridgeUrl">WebSocket URL</CFormLabel>
                                <CFormInput
                                    id="rosbridgeUrl"
                                    type="text"
                                    value={newUrl}
                                    onChange={(e) => setNewUrl(e.target.value)}
                                    placeholder="ws://localhost:9090"
                                />
                                <div className="form-text">
                                    Format: ws://[hostname]:[port]
                                </div>
                            </div>

                            <div className="mb-3">
                                <CFormSwitch
                                    id="autoReconnect"
                                    label="Auto-reconnect on disconnect"
                                    checked={autoReconnect}
                                    onChange={(e) => setAutoReconnect(e.target.checked)}
                                />
                            </div>

                            <div className="d-flex gap-2">
                                {isConnected ? (
                                    <CButton color="danger" onClick={handleDisconnect}>
                                        Disconnect
                                    </CButton>
                                ) : (
                                    <CButton color="success" onClick={handleConnect}>
                                        Connect
                                    </CButton>
                                )}
                                <CButton color="secondary" onClick={() => setNewUrl(url)}>
                                    <CIcon icon={cilReload} className="me-1" />
                                    Reset
                                </CButton>
                            </div>

                            {isConnected && (
                                <CAlert color="success" className="mt-3 mb-0">
                                    ✅ Connected to {url}
                                </CAlert>
                            )}
                        </CCardBody>
                    </CCard>
                </CCol>

                <CCol md={6}>
                    <CCard className="mb-4">
                        <CCardHeader>
                            <strong>⚙️ Default Topics</strong>
                        </CCardHeader>
                        <CCardBody>
                            <p className="text-body-secondary small">
                                Configure the default ROS topics used by the dashboard.
                            </p>
                            <CListGroup flush>
                                <CListGroupItem className="d-flex justify-content-between">
                                    <span>Joint States</span>
                                    <code>/joint_states</code>
                                </CListGroupItem>
                                <CListGroupItem className="d-flex justify-content-between">
                                    <span>Battery State</span>
                                    <code>/battery_state</code>
                                </CListGroupItem>
                                <CListGroupItem className="d-flex justify-content-between">
                                    <span>Diagnostics</span>
                                    <code>/diagnostics</code>
                                </CListGroupItem>
                                <CListGroupItem className="d-flex justify-content-between">
                                    <span>Map</span>
                                    <code>/map</code>
                                </CListGroupItem>
                                <CListGroupItem className="d-flex justify-content-between">
                                    <span>Robot Pose</span>
                                    <code>/amcl_pose</code>
                                </CListGroupItem>
                            </CListGroup>
                        </CCardBody>
                    </CCard>
                </CCol>
            </CRow>

            <CRow>
                <CCol md={6}>
                    <CCard className="mb-4">
                        <CCardHeader>
                            <strong>💻 PC Monitor Settings</strong>
                        </CCardHeader>
                        <CCardBody>
                            <div className="mb-3">
                                <CFormLabel>PC 1 (Main) Topic Prefix</CFormLabel>
                                <CFormInput
                                    type="text"
                                    defaultValue="/system_monitor/pc1"
                                    placeholder="/system_monitor/pc1"
                                />
                            </div>
                            <div className="mb-3">
                                <CFormLabel>PC 2 (Slave) Topic Prefix</CFormLabel>
                                <CFormInput
                                    type="text"
                                    defaultValue="/system_monitor/pc2"
                                    placeholder="/system_monitor/pc2"
                                />
                            </div>
                            <CButton color="primary">
                                <CIcon icon={cilSave} className="me-1" />
                                Save Settings
                            </CButton>
                        </CCardBody>
                    </CCard>
                </CCol>

                <CCol md={6}>
                    <CCard className="mb-4">
                        <CCardHeader>
                            <strong>📡 Sensor Configuration</strong>
                        </CCardHeader>
                        <CCardBody>
                            <p className="text-body-secondary small">
                                Sensor topics can be configured in the source code.
                                A future update will add a configuration UI.
                            </p>
                            <CAlert color="info" className="mb-0">
                                Default sensors are configured in:
                                <br />
                                <code>src/views/sensor/SensorStatus.js</code>
                            </CAlert>
                        </CCardBody>
                    </CCard>
                </CCol>
            </CRow>

            <CRow>
                <CCol>
                    <CCard className="mb-4">
                        <CCardHeader>
                            <strong>🚀 Quick Start Guide</strong>
                        </CCardHeader>
                        <CCardBody>
                            <h6>1. Start rosbridge_server</h6>
                            <pre className="bg-dark text-light p-3 rounded">
                                ros2 launch rosbridge_server rosbridge_websocket_launch.xml
                            </pre>

                            <h6>2. (Optional) Start system monitor node</h6>
                            <p className="text-body-secondary small">
                                For PC monitoring, run the system monitor node on each PC.
                            </p>
                            <pre className="bg-dark text-light p-3 rounded">
                                ros2 run robot_web_ui system_monitor
                            </pre>

                            <h6>3. Open the Web UI</h6>
                            <pre className="bg-dark text-light p-3 rounded">
                                http://localhost:3000
                            </pre>
                        </CCardBody>
                    </CCard>
                </CCol>
            </CRow>
        </>
    )
}

export default RosSettings
