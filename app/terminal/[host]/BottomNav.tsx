'use client'

import { useRouter } from 'next/navigation'

interface BottomNavProps {
  showExplorer: boolean
  showTerminal: boolean
  onToggleExplorer: () => void
  onToggleTerminal: () => void
  hidden?: boolean
}

export default function BottomNav({
  showExplorer,
  showTerminal,
  onToggleExplorer,
  onToggleTerminal,
  hidden = false,
}: BottomNavProps) {
  const router = useRouter()

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

      <button className="nav-btn" onClick={() => router.push('/')}>
        <HomeIcon />
        <span className="nav-label">Home</span>
      </button>

      <style jsx>{`
        .bottom-nav {
          display: flex;
          justify-content: space-around;
          background: #0f0f23;
          border-top: 1px solid #2a2a4a;
          padding: 6px 0;
          padding-bottom: max(6px, env(safe-area-inset-bottom));
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          transform: translateY(0);
          transition: transform 0.15s ease-out;
        }
        .bottom-nav.hidden {
          transform: translateY(100%);
          pointer-events: none;
        }
        .nav-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 6px 20px;
          border-radius: 8px;
          transition: all 0.2s;
          min-width: 70px;
        }
        .nav-btn:hover {
          color: #aaa;
          background: #1a1a2e;
        }
        .nav-btn.active {
          color: #fff;
          background: #2a2a4a;
        }
        .nav-label {
          font-size: 0.65rem;
          font-weight: 500;
        }
      `}</style>
    </nav>
  )
}

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
