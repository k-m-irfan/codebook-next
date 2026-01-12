'use client'

import { useRouter } from 'next/navigation'

export type View = 'terminal' | 'files'

interface BottomNavProps {
  activeView: View
  onViewChange: (view: View) => void
}

export default function BottomNav({ activeView, onViewChange }: BottomNavProps) {
  const router = useRouter()

  return (
    <nav className="session-bottom-nav">
      <button
        className={`nav-btn ${activeView === 'files' ? 'active' : ''}`}
        onClick={() => onViewChange('files')}
      >
        <FolderIcon />
        <span className="nav-label">Files</span>
      </button>

      <button
        className={`nav-btn ${activeView === 'terminal' ? 'active' : ''}`}
        onClick={() => onViewChange('terminal')}
      >
        <TerminalIcon />
        <span className="nav-label">Terminal</span>
      </button>

      <button
        className="nav-btn"
        onClick={() => router.push('/')}
      >
        <HomeIcon />
        <span className="nav-label">Home</span>
      </button>

      <style jsx>{`
        .session-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-around;
          background: #0f0f23;
          border-top: 1px solid #2a2a4a;
          padding: 8px 0;
          padding-bottom: max(8px, env(safe-area-inset-bottom));
          z-index: 100;
        }
        .nav-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 8px 24px;
          border-radius: 8px;
          transition: all 0.2s;
          min-width: 80px;
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
          font-size: 0.7rem;
          font-weight: 500;
        }

        @media (max-width: 480px) {
          .nav-btn {
            padding: 10px 16px;
            min-width: 70px;
          }
        }
      `}</style>
    </nav>
  )
}

function FolderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
