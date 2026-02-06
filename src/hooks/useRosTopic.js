import { useState, useEffect, useRef, useCallback } from 'react'
import { useRos } from '../context/RosContext'

// roslib을 동적으로 가져오기 (UMD 호환)
let ROSLIB = null
if (typeof window !== 'undefined') {
    import('roslib').then(module => {
        ROSLIB = module.default || module
        window.ROSLIB = ROSLIB
    }).catch(() => {
        // CDN 폴백
        console.warn('Failed to import roslib, please ensure it is installed')
    })
}

// ROSLIB 객체를 가져오는 헬퍼
const getRoslib = () => {
    if (ROSLIB) return ROSLIB
    if (typeof window !== 'undefined' && window.ROSLIB) return window.ROSLIB
    return null
}

/**
 * Hook to subscribe to a ROS topic
 * @param {string} topicName - Name of the topic to subscribe to
 * @param {string} messageType - ROS message type (e.g., 'std_msgs/String')
 * @param {object} options - Additional options
 * @returns {object} - { message, hz, isSubscribed }
 */
export const useRosTopic = (topicName, messageType, options = {}) => {
    const { ros, isConnected } = useRos()
    const [message, setMessage] = useState(null)
    const [hz, setHz] = useState(0)
    const [isSubscribed, setIsSubscribed] = useState(false)

    const topicRef = useRef(null)
    const messageCountRef = useRef(0)
    const hzIntervalRef = useRef(null)
    const lastMessageTimeRef = useRef(null)

    const { throttleMs = 0, queueSize = 1 } = options

    useEffect(() => {
        const ROS = getRoslib()
        if (!ROS || !ros || !isConnected || !topicName || !messageType) {
            return
        }

        const topic = new ROS.Topic({
            ros,
            name: topicName,
            messageType,
            throttle_rate: throttleMs,
            queue_size: queueSize,
        })

        topic.subscribe((msg) => {
            setMessage(msg)
            messageCountRef.current += 1
            lastMessageTimeRef.current = Date.now()
        })

        topicRef.current = topic
        setIsSubscribed(true)

        // Calculate Hz every second
        hzIntervalRef.current = setInterval(() => {
            setHz(messageCountRef.current)
            messageCountRef.current = 0
        }, 1000)

        return () => {
            if (topicRef.current) {
                topicRef.current.unsubscribe()
            }
            if (hzIntervalRef.current) {
                clearInterval(hzIntervalRef.current)
            }
            setIsSubscribed(false)
        }
    }, [ros, isConnected, topicName, messageType, throttleMs, queueSize])

    return { message, hz, isSubscribed, lastMessageTime: lastMessageTimeRef.current }
}

/**
 * Hook to publish to a ROS topic
 * @param {string} topicName - Name of the topic to publish to
 * @param {string} messageType - ROS message type
 * @returns {function} - publish function
 */
export const useRosPublisher = (topicName, messageType) => {
    const { ros, isConnected } = useRos()
    const topicRef = useRef(null)

    useEffect(() => {
        const ROS = getRoslib()
        if (!ROS || !ros || !isConnected || !topicName || !messageType) {
            return
        }

        topicRef.current = new ROS.Topic({
            ros,
            name: topicName,
            messageType,
        })

        return () => {
            if (topicRef.current) {
                topicRef.current.unadvertise()
            }
        }
    }, [ros, isConnected, topicName, messageType])

    const publish = useCallback((data) => {
        const ROS = getRoslib()
        if (topicRef.current && ROS) {
            const message = new ROS.Message(data)
            topicRef.current.publish(message)
        }
    }, [])

    return publish
}

/**
 * Hook to call a ROS service
 * @param {string} serviceName - Name of the service
 * @param {string} serviceType - ROS service type
 * @returns {object} - { call, isLoading, result, error }
 */
export const useRosService = (serviceName, serviceType) => {
    const { ros, isConnected } = useRos()
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const serviceRef = useRef(null)

    useEffect(() => {
        const ROS = getRoslib()
        if (!ROS || !ros || !isConnected || !serviceName || !serviceType) {
            return
        }

        serviceRef.current = new ROS.Service({
            ros,
            name: serviceName,
            serviceType,
        })
    }, [ros, isConnected, serviceName, serviceType])

    const call = useCallback((request = {}) => {
        return new Promise((resolve, reject) => {
            const ROS = getRoslib()
            if (!serviceRef.current || !ROS) {
                reject(new Error('Service not initialized'))
                return
            }

            setIsLoading(true)
            setError(null)

            const serviceRequest = new ROS.ServiceRequest(request)
            serviceRef.current.callService(serviceRequest, (response) => {
                setResult(response)
                setIsLoading(false)
                resolve(response)
            }, (err) => {
                setError(err)
                setIsLoading(false)
                reject(err)
            })
        })
    }, [])

    return { call, isLoading, result, error }
}

/**
 * Hook to get ROS parameter
 * @param {string} paramName - Name of the parameter
 * @returns {object} - { value, get, set }
 */
export const useRosParam = (paramName) => {
    const { ros, isConnected } = useRos()
    const [value, setValue] = useState(null)
    const paramRef = useRef(null)

    useEffect(() => {
        const ROS = getRoslib()
        if (!ROS || !ros || !isConnected || !paramName) {
            return
        }

        paramRef.current = new ROS.Param({
            ros,
            name: paramName,
        })

        // Get initial value
        paramRef.current.get((val) => {
            setValue(val)
        })
    }, [ros, isConnected, paramName])

    const get = useCallback(() => {
        return new Promise((resolve) => {
            if (paramRef.current) {
                paramRef.current.get((val) => {
                    setValue(val)
                    resolve(val)
                })
            }
        })
    }, [])

    const set = useCallback((newValue) => {
        return new Promise((resolve) => {
            if (paramRef.current) {
                paramRef.current.set(newValue, () => {
                    setValue(newValue)
                    resolve()
                })
            }
        })
    }, [])

    return { value, get, set }
}

export default useRosTopic
