import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilMonitor,
  cilRouter,
  cilSettings,
  cilScreenDesktop,
  cilMap,
  cilChart,
  cilLan,
  cilMemory,
} from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'

const _nav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Robot Monitoring',
  },
  {
    component: CNavItem,
    name: 'Robot Status',
    to: '/robot/status',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'PC Monitor',
    to: '/monitor/pc',
    icon: <CIcon icon={cilMonitor} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Sensor Status',
    to: '/sensor/status',
    icon: <CIcon icon={cilRouter} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'ROS2',
  },
  {
    component: CNavItem,
    name: 'ROS2 Status',
    to: '/ros2/status',
    icon: <CIcon icon={cilLan} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '3D Visualization',
    to: '/visualization/foxglove',
    icon: <CIcon icon={cilScreenDesktop} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Settings',
  },
  {
    component: CNavItem,
    name: 'ROS Settings',
    to: '/settings/ros',
    icon: <CIcon icon={cilMemory} customClassName="nav-icon" />,
  },
]

export default _nav
