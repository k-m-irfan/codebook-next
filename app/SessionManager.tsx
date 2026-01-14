'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface SessionInfo {
  id: string
  host: string
  name: string
  workspacePath: string
  createdAt: Date
}

interface SessionManagerContextType {
  // List of open sessions
  sessions: SessionInfo[]
  // Currently active session ID (null means home screen)
  activeSessionId: string | null
  // Create a new session for a host
  createSession: (host: string) => string
  // Switch to a session (or null for home)
  switchToSession: (sessionId: string | null) => void
  // Close a session
  closeSession: (sessionId: string) => void
  // Update session workspace path
  updateSessionWorkspace: (sessionId: string, workspacePath: string) => void
  // Check if on home screen
  isHome: boolean
}

const SessionManagerContext = createContext<SessionManagerContextType | null>(null)

export function useSessionManager() {
  const ctx = useContext(SessionManagerContext)
  if (!ctx) {
    throw new Error('useSessionManager must be used within SessionManagerProvider')
  }
  return ctx
}

let sessionCounter = 0

export function SessionManagerProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const createSession = useCallback((host: string) => {
    const id = `session-${Date.now()}-${++sessionCounter}`
    const displayName = host === 'local' ? 'Local' : host

    const newSession: SessionInfo = {
      id,
      host,
      name: displayName,
      workspacePath: '',
      createdAt: new Date(),
    }

    setSessions(prev => [...prev, newSession])
    setActiveSessionId(id)
    return id
  }, [])

  const switchToSession = useCallback((sessionId: string | null) => {
    setActiveSessionId(sessionId)
  }, [])

  const closeSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    // If closing the active session, go back to home
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
    }
  }, [activeSessionId])

  const updateSessionWorkspace = useCallback((sessionId: string, workspacePath: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, workspacePath } : s
    ))
  }, [])

  const isHome = activeSessionId === null

  return (
    <SessionManagerContext.Provider value={{
      sessions,
      activeSessionId,
      createSession,
      switchToSession,
      closeSession,
      updateSessionWorkspace,
      isHome,
    }}>
      {children}
    </SessionManagerContext.Provider>
  )
}
