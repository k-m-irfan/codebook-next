'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ConnectionProvider } from './ConnectionContext'
import BottomNav, { type View } from './BottomNav'

const TerminalComponent = dynamic(() => import('./Terminal'), {
  ssr: false,
  loading: () => <LoadingScreen message="Loading terminal..." />,
})

const FileExplorer = dynamic(() => import('./FileExplorer'), {
  ssr: false,
  loading: () => <LoadingScreen message="Loading file explorer..." />,
})

function LoadingScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#1a1a2e',
        color: '#888',
      }}
    >
      {message}
    </div>
  )
}

export default function TerminalPage() {
  const params = useParams()
  const host = params.host as string
  const [activeView, setActiveView] = useState<View>('terminal')

  return (
    <ConnectionProvider host={host}>
      <div className="session-container">
        <div className={`view-panel ${activeView === 'terminal' ? 'active' : ''}`}>
          <TerminalComponent host={host} />
        </div>
        <div className={`view-panel ${activeView === 'files' ? 'active' : ''}`}>
          <FileExplorer />
        </div>

        <BottomNav activeView={activeView} onViewChange={setActiveView} />
      </div>

      <style jsx>{`
        .session-container {
          height: 100vh;
          height: 100dvh;
          background: #1a1a2e;
          display: flex;
          flex-direction: column;
        }
        .view-panel {
          display: none;
          flex: 1;
          overflow: hidden;
        }
        .view-panel.active {
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </ConnectionProvider>
  )
}
