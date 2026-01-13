'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect, ReactNode } from 'react'
import type { FileEntry } from '@/lib/file-protocol'

interface ConnectionContextType {
  host: string
  connected: boolean
  error: string | null

  // File operations
  listFiles: (path: string) => Promise<FileEntry[]>
  readFile: (path: string) => Promise<{ content: string; encoding: string; size: number }>
  writeFile: (path: string, content: string, encoding?: 'utf8' | 'base64') => Promise<void>
  createFile: (path: string, isDirectory: boolean) => Promise<void>
  deleteFile: (path: string, recursive?: boolean) => Promise<void>
  renameFile: (oldPath: string, newPath: string) => Promise<void>

  // Terminal access
  sendTerminalData: (data: string) => void
  sendResize: (cols: number, rows: number) => void
  onTerminalData: (callback: (data: string) => void) => () => void
}

const ConnectionContext = createContext<ConnectionContextType | null>(null)

interface ConnectionProviderProps {
  host: string
  password?: string | null
  children: ReactNode
}

export function ConnectionProvider({ host, password, children }: ConnectionProviderProps) {
  const wsRef = useRef<WebSocket | null>(null)
  const pendingRequests = useRef<Map<string, { resolve: (data: any) => void; reject: (err: Error) => void }>>(new Map())
  const terminalCallbacks = useRef<Set<(data: string) => void>>(new Set())
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef(password)
  const sshAuthenticatedRef = useRef(false)

  // Keep password ref updated when prop changes
  useEffect(() => {
    passwordRef.current = password
  }, [password])

  // Single WebSocket connection management
  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:3001?host=${encodeURIComponent(host)}`
    console.log('ConnectionContext: Connecting to', wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('ConnectionContext: WebSocket connected')
      // For local host, we're immediately ready
      // For SSH hosts, we wait for SSH authentication
      if (host === 'local') {
        sshAuthenticatedRef.current = true
        setConnected(true)
      }
      setError(null)
    }

    ws.onclose = () => {
      console.log('ConnectionContext: Disconnected')
      sshAuthenticatedRef.current = false
      setConnected(false)
    }

    ws.onerror = () => {
      setError('Connection error')
    }

    ws.onmessage = (event) => {
      const data = event.data
      try {
        const parsed = JSON.parse(data)

        // Handle password authentication request
        if (parsed.type === 'auth:password-required') {
          console.log('ConnectionContext: Password required, auto-submitting cached password')
          if (passwordRef.current) {
            ws.send(JSON.stringify({
              type: 'auth:password',
              password: passwordRef.current
            }))
          } else {
            console.warn('ConnectionContext: Password required but no cached password available')
            setError('SSH authentication required')
          }
          return
        }

        // Check if this is a response to a pending request
        if (parsed.requestId && pendingRequests.current.has(parsed.requestId)) {
          const { resolve, reject } = pendingRequests.current.get(parsed.requestId)!
          pendingRequests.current.delete(parsed.requestId)
          if (parsed.success) {
            resolve(parsed)
          } else {
            reject(new Error(parsed.error || 'Operation failed'))
          }
          return
        }
      } catch {
        // Not JSON - it's terminal data, which means SSH is authenticated
        if (!sshAuthenticatedRef.current && host !== 'local') {
          console.log('ConnectionContext: SSH authenticated (received terminal data)')
          sshAuthenticatedRef.current = true
          setConnected(true)
        }
      }
      // Forward to terminal callbacks
      terminalCallbacks.current.forEach((cb) => cb(data))
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [host])

  // Generate unique request ID
  const generateRequestId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }, [])

  // Send request and wait for response
  const sendRequest = useCallback(<T,>(message: Record<string, any>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'))
        return
      }

      const requestId = generateRequestId()
      pendingRequests.current.set(requestId, { resolve, reject })

      ws.send(JSON.stringify({ ...message, requestId }))

      // Timeout after 30s
      setTimeout(() => {
        if (pendingRequests.current.has(requestId)) {
          pendingRequests.current.delete(requestId)
          reject(new Error('Request timeout'))
        }
      }, 30000)
    })
  }, [generateRequestId])

  // File operations
  const listFiles = useCallback(async (path: string): Promise<FileEntry[]> => {
    const response = await sendRequest<{ entries: FileEntry[] }>({
      type: 'file:list',
      path,
    })
    return response.entries || []
  }, [sendRequest])

  const readFile = useCallback(async (path: string) => {
    const response = await sendRequest<{ content: string; encoding: string; size: number }>({
      type: 'file:read',
      path,
    })
    return {
      content: response.content || '',
      encoding: response.encoding || 'utf8',
      size: response.size || 0,
    }
  }, [sendRequest])

  const writeFile = useCallback(async (path: string, content: string, encoding: 'utf8' | 'base64' = 'utf8') => {
    await sendRequest({
      type: 'file:write',
      path,
      content,
      encoding,
    })
  }, [sendRequest])

  const createFile = useCallback(async (path: string, isDirectory: boolean) => {
    await sendRequest({
      type: 'file:create',
      path,
      isDirectory,
    })
  }, [sendRequest])

  const deleteFile = useCallback(async (path: string, recursive = false) => {
    await sendRequest({
      type: 'file:delete',
      path,
      recursive,
    })
  }, [sendRequest])

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    await sendRequest({
      type: 'file:rename',
      oldPath,
      newPath,
    })
  }, [sendRequest])

  // Terminal operations
  const sendTerminalData = useCallback((data: string) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }, [])

  const sendResize = useCallback((cols: number, rows: number) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  }, [])

  const onTerminalData = useCallback((callback: (data: string) => void) => {
    terminalCallbacks.current.add(callback)
    return () => {
      terminalCallbacks.current.delete(callback)
    }
  }, [])

  const value: ConnectionContextType = {
    host,
    connected,
    error,
    listFiles,
    readFile,
    writeFile,
    createFile,
    deleteFile,
    renameFile,
    sendTerminalData,
    sendResize,
    onTerminalData,
  }

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnection() {
  const context = useContext(ConnectionContext)
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider')
  }
  return context
}
