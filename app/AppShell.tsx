'use client'

import { ReactNode } from 'react'
import { SessionManagerProvider, useSessionManager } from './SessionManager'
import { SettingsProvider } from './SettingsContext'
import dynamic from 'next/dynamic'

// Dynamically import TerminalSession to avoid SSR issues
const TerminalSession = dynamic(() => import('./TerminalSession'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: '#1a1a2e',
      color: '#888',
    }}>
      Loading session...
    </div>
  ),
})

interface AppShellProps {
  homeContent: ReactNode
}

function AppShellInner({ homeContent }: AppShellProps) {
  const { sessions, activeSessionId, isHome } = useSessionManager()

  return (
    <div className="app-shell">
      {/* Home screen - visible when no session is active */}
      <div
        className="app-shell-layer"
        style={{
          visibility: isHome ? 'visible' : 'hidden',
          pointerEvents: isHome ? 'auto' : 'none',
          zIndex: isHome ? 1 : 0,
          overflowY: 'auto',
        }}
      >
        {homeContent}
      </div>

      {/* All terminal sessions - kept mounted, visibility toggled */}
      {sessions.map(session => {
        const isSessionActive = activeSessionId === session.id
        return (
          <div
            key={session.id}
            className="app-shell-layer"
            style={{
              visibility: isSessionActive ? 'visible' : 'hidden',
              pointerEvents: isSessionActive ? 'auto' : 'none',
              zIndex: isSessionActive ? 1 : 0,
              opacity: isSessionActive ? 1 : 0,
            }}
          >
            <TerminalSession
              sessionId={session.id}
              host={session.host}
              isActive={isSessionActive}
            />
          </div>
        )
      })}

      <style jsx>{`
        .app-shell {
          position: relative;
          height: 100dvh;
          width: 100%;
          overflow: hidden;
        }
        .app-shell-layer {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }
      `}</style>
    </div>
  )
}

export default function AppShell({ homeContent }: AppShellProps) {
  return (
    <SettingsProvider>
      <SessionManagerProvider>
        <AppShellInner homeContent={homeContent} />
      </SessionManagerProvider>
    </SettingsProvider>
  )
}
