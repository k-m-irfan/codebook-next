'use client'

import { useRouter } from 'next/navigation'

interface HomeBottomNavProps {
  hidden?: boolean
}

export default function HomeBottomNav({ hidden = false }: HomeBottomNavProps) {
  const router = useRouter()

  return (
    <nav className={`bottom-nav ${hidden ? 'hidden' : ''}`}>
      <button className="nav-btn" onClick={() => router.push('/')}>
        <HostsIcon />
        <span className="nav-label">Hosts</span>
      </button>

      <button className="nav-btn" onClick={() => router.push('/')}>
        <SessionsIcon />
        <span className="nav-label">Sessions</span>
      </button>

      <button className="nav-btn active">
        <TerminalIcon />
        <span className="nav-label">Terminal</span>
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
          z-index: 1000;
          transform: translateY(0);
          transition: transform 0.15s ease-out;
          visibility: visible;
        }
        .bottom-nav.hidden {
          transform: translateY(100%);
          pointer-events: none;
          visibility: hidden;
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

        @media (orientation: landscape) and (max-height: 500px) {
          .bottom-nav {
            flex-direction: column;
            justify-content: center;
            top: 0;
            bottom: 0;
            left: 0;
            right: auto;
            width: 70px;
            border-top: none;
            border-right: 1px solid #2a2a4a;
            padding: 6px;
            padding-left: max(6px, env(safe-area-inset-left));
            padding-bottom: 6px;
          }
          .bottom-nav.hidden {
            transform: translateX(-100%);
          }
          .nav-btn {
            padding: 10px 6px;
            min-width: auto;
            width: 100%;
          }
          .nav-label {
            font-size: 0.6rem;
          }
        }
      `}</style>
    </nav>
  )
}

function HostsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function SessionsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
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
