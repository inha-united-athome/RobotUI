import React from 'react'

// Dashboard
const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))

// Robot
const RobotStatus = React.lazy(() => import('./views/robot/RobotStatus'))

// Monitor
const PCMonitor = React.lazy(() => import('./views/monitor/PCMonitor'))

// Sensor
const SensorStatus = React.lazy(() => import('./views/sensor/SensorStatus'))

// ROS2
const Ros2Status = React.lazy(() => import('./views/ros2/Ros2Status'))

// Visualization
const FoxgloveViewer = React.lazy(() => import('./views/visualization/FoxgloveViewer'))

// Settings
const RosSettings = React.lazy(() => import('./views/settings/RosSettings'))

const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },

  // Robot
  { path: '/robot', name: 'Robot', exact: true },
  { path: '/robot/status', name: 'Robot Status', element: RobotStatus },

  // Monitor
  { path: '/monitor', name: 'Monitor', exact: true },
  { path: '/monitor/pc', name: 'PC Monitor', element: PCMonitor },

  // Sensor
  { path: '/sensor', name: 'Sensor', exact: true },
  { path: '/sensor/status', name: 'Sensor Status', element: SensorStatus },

  // ROS2
  { path: '/ros2', name: 'ROS2', exact: true },
  { path: '/ros2/status', name: 'ROS2 Status', element: Ros2Status },

  // Visualization
  { path: '/visualization', name: 'Visualization', exact: true },
  { path: '/visualization/foxglove', name: '3D Visualization (Foxglove)', element: FoxgloveViewer },

  // Settings
  { path: '/settings', name: 'Settings', exact: true },
  { path: '/settings/ros', name: 'ROS Settings', element: RosSettings },
]

export default routes
