'use client'

import { useSessionManager } from './SessionManager'

interface SessionBottomNavProps {
  sessionId: string
  showExplorer: boolean
  showTerminal: boolean
  onToggleExplorer: () => void
  onToggleTerminal: () => void
  hidden?: boolean
}

export default function SessionBottomNav({
  sessionId,
  showExplorer,
  showTerminal,
  onToggleExplorer,
  onToggleTerminal,
  hidden = false,
}: SessionBottomNavProps) {
  const { switchToSession } = useSessionManager()

  const goHome = () => {
    switchToSession(null)
  }

  return (
    <nav className={`bottom-nav ${hidden ? 'hidden' : ''}`}>
      <button
        className={`nav-btn ${showExplorer ? 'active' : ''}`}
        onClick={onToggleExplorer}
      >
        <FolderIcon />
        <span className="nav-label">Files</span>
      </button>

      <button
        className={`nav-btn ${showTerminal ? 'active' : ''}`}
        onClick={onToggleTerminal}
      >
        <TerminalIcon />
        <span className="nav-label">Terminal</span>
      </button>

      <button className="nav-btn" onClick={goHome}>
        <HomeIcon />
        <span className="nav-label">Sessions</span>
      </button>
    </nav>
  )
}

function FolderIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
