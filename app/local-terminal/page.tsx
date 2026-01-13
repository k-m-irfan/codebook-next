'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import HomeBottomNav from './HomeBottomNav'
import { useKeyboardHeight } from '../terminal/[host]/useKeyboardHeight'

const TerminalPanel = dynamic(() => import('../terminal/[host]/TerminalPanel'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: '#0f0f23',
      color: '#888'
    }}>
      Loading terminal...
    </div>
  ),
})

// Minimal provider to satisfy TerminalPanel's usePassword hook
function PasswordProvider({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState<string | null>(null)
  const { PasswordContext } = require('../terminal/[host]/PasswordContext')
  return (
    <PasswordContext.Provider value={{ password, setPassword }}>
      {children}
    </PasswordContext.Provider>
  )
}

export default function LocalTerminalPage() {
  const { keyboardHeight, viewportHeight, isKeyboardVisible } = useKeyboardHeight()

  return (
    <PasswordProvider>
      <div className="local-terminal-container">
        <div className="terminal-content">
          <TerminalPanel
            host="local"
            workspacePath=""
            isVisible={true}
          />
        </div>

        <HomeBottomNav hidden={isKeyboardVisible} />

        <style jsx>{`
          .local-terminal-container {
            --bottom-nav-height: calc(56px + env(safe-area-inset-bottom, 0px));
            height: ${isKeyboardVisible ? `${viewportHeight}px` : '100dvh'};
            background: #0f0f23;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .terminal-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding-bottom: ${isKeyboardVisible ? '0' : 'var(--bottom-nav-height)'};
          }
        `}</style>
      </div>
    </PasswordProvider>
  )
}
