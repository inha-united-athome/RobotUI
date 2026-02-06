import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const RosContext = createContext(null)

// roslib을 동적으로 가져오기
let ROSLIB = null

export const useRos = () => {
    const context = useContext(RosContext)
    if (!context) {
        throw new Error('useRos must be used within a RosProvider')
    }
    return context
}

export const RosProvider = ({ children, url = 'ws://localhost:9090' }) => {
    const [ros, setRos] = useState(null)
    const [isConnected, setIsConnected] = useState(false)
    const [error, setError] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const rosRef = useRef(null)
    const reconnectTimeoutRef = useRef(null)
    const reconnectAttemptsRef = useRef(0)
    const maxReconnectAttempts = 10
    const reconnectDelay = 3000

    // roslib 로드
    useEffect(() => {
        import('roslib').then(module => {
            ROSLIB = module.default || module
            window.ROSLIB = ROSLIB
            setIsLoading(false)
        }).catch(err => {
            console.error('Failed to load roslib:', err)
            setError('Failed to load roslib library')
            setIsLoading(false)
        })
    }, [])

    useEffect(() => {
        if (isLoading || !ROSLIB) return

        // Cleanup function
        const cleanup = () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
            if (rosRef.current) {
                try {
                    rosRef.current.close()
                } catch (e) {
                    // Ignore close errors
                }
                rosRef.current = null
            }
        }

        // Create ROS connection
        try {
            const rosInstance = new ROSLIB.Ros({ url })
            rosRef.current = rosInstance

            rosInstance.on('connection', () => {
                console.log('Connected to ROS bridge at', url)
                setIsConnected(true)
                setError(null)
                reconnectAttemptsRef.current = 0
            })

            rosInstance.on('error', (err) => {
                console.error('ROS connection error:', err)
                setError('Connection error')
            })

            rosInstance.on('close', () => {
                console.log('ROS connection closed')
                setIsConnected(false)

                // Auto-reconnect logic
                if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                    reconnectAttemptsRef.current += 1
                    reconnectTimeoutRef.current = setTimeout(() => {
                        console.log(`Reconnecting... (attempt ${reconnectAttemptsRef.current})`)
                        // Create new connection (will be handled by effect re-run)
                    }, reconnectDelay)
                }
            })

            setRos(rosInstance)
        } catch (err) {
            console.error('Failed to create ROS connection:', err)
            setError('Failed to create connection')
        }

        return cleanup
    }, [url, isLoading])

    const connect = useCallback(() => {
        if (!ROSLIB) return

        if (rosRef.current) {
            try {
                rosRef.current.close()
            } catch (e) {
                // Ignore
            }
        }

        try {
            const rosInstance = new ROSLIB.Ros({ url })
            rosRef.current = rosInstance
            setRos(rosInstance)
            reconnectAttemptsRef.current = 0
        } catch (err) {
            setError('Failed to connect')
        }
    }, [url])

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }
        if (rosRef.current) {
            try {
                rosRef.current.close()
            } catch (e) {
                // Ignore
            }
        }
        setIsConnected(false)
    }, [])

    const value = {
        ros,
        isConnected,
        error,
        url,
        isLoading,
        connect,
        disconnect,
    }

    return <RosContext.Provider value={value}>{children}</RosContext.Provider>
}

export default RosContext
