import { useState, useEffect, useCallback } from 'react'

// API URL - 같은 서버에서 서빙되므로 상대 경로 사용
// 개발 모드에서는 백엔드 주소 직접 지정
const API_BASE_URL = import.meta.env.DEV
    ? 'http://localhost:8000'
    : ''  // Production: 같은 서버

/**
 * API 데이터를 주기적으로 가져오는 훅
 */
export const useApiData = (endpoint, interval = 2000) => {
    const [data, setData] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`)
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            const json = await response.json()
            setData(json)
            setError(null)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [endpoint])

    useEffect(() => {
        fetchData()

        if (interval > 0) {
            const id = setInterval(fetchData, interval)
            return () => clearInterval(id)
        }
    }, [fetchData, interval])

    return { data, error, loading, refetch: fetchData }
}

/**
 * PC 상태 조회 훅
 */
export const usePCStatus = (pcId, interval = 2000) => {
    return useApiData(`/api/pc/${pcId}/status`, interval)
}

/**
 * PC 프로세스 목록 조회 훅
 */
export const usePCProcesses = (pcId, interval = 5000) => {
    return useApiData(`/api/pc/${pcId}/processes?top_n=10`, interval)
}

/**
 * 모든 PC 상태 조회 훅
 */
export const useAllPCStatus = (interval = 2000) => {
    return useApiData('/api/pc/all', interval)
}

/**
 * 센서 상태 조회 훅
 */
export const useSensorsStatus = (interval = 3000) => {
    return useApiData('/api/sensors/status', interval)
}

/**
 * 로봇 상태 조회 훅 (SDK)
 */
export const useRobotStatus = (interval = 1000) => {
    return useApiData('/api/robot/state', interval)
}

/**
 * ROS 상태 요약 조회 훅 (rclpy 기반)
 */
export const useRosSummary = (interval = 1000) => {
    return useApiData('/api/ros/summary', interval)
}

/**
 * ROS 전체 토픽 데이터 조회 훅
 */
export const useRosTopics = (interval = 2000) => {
    return useApiData('/api/ros/topics', interval)
}

/**
 * ROS 연결 상태 조회 훅
 */
export const useRosStatus = (interval = 5000) => {
    return useApiData('/api/ros/status', interval)
}

/**
 * 특정 ROS 토픽 데이터 조회 훅
 */
export const useRosTopic = (topicPath, interval = 1000) => {
    const path = topicPath.startsWith('/') ? topicPath.slice(1) : topicPath
    return useApiData(`/api/ros/topic/${path}`, interval)
}

/**
 * API 호출 (POST/PUT)
 */
export const callApi = async (endpoint, method = 'POST', body = null) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : null,
    })

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
    }

    return response.json()
}

/**
 * Ping 테스트
 */
export const pingHost = async (ip) => {
    const response = await fetch(`${API_BASE_URL}/api/sensors/ping/${ip}`)
    return response.json()
}

export default useApiData
