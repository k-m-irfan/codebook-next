'use client'

import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useConnection } from './ConnectionContext'

interface TerminalComponentProps {
  host: string
}

export default function TerminalComponent({ host }: TerminalComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { connected, error, sendTerminalData, sendResize, onTerminalData } = useConnection()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let isCleanedUp = false

    // Create a fresh div for xterm to use
    const terminalDiv = document.createElement('div')
    terminalDiv.style.width = '100%'
    terminalDiv.style.height = '100%'
    container.appendChild(terminalDiv)

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#eee',
        cursor: '#fff',
        selectionBackground: '#4a4a8a',
      },
    })

    termRef.current = term

    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon
    term.loadAddon(fitAddon)
    term.open(terminalDiv)

    // Fit terminal after a short delay
    const fitTimeout = setTimeout(() => {
      if (!isCleanedUp) {
        try {
          fitAddon.fit()
          sendResize(term.cols, term.rows)
        } catch (e) {
          // Ignore fit errors
        }
      }
    }, 100)

    // Subscribe to terminal data from the connection
    const unsubscribe = onTerminalData((data) => {
      if (!isCleanedUp) {
        // Try to parse as JSON to filter out file responses
        try {
          const parsed = JSON.parse(data)
          // If it's a file response, don't write to terminal
          if (parsed.type?.startsWith('file:')) {
            return
          }
        } catch {
          // Not JSON, it's terminal data
        }
        term.write(data)
      }
    })

    // Handle terminal input - send to connection
    const dataDisposable = term.onData((data) => {
      sendTerminalData(data)
    })

    // Handle window resize
    const handleResize = () => {
      if (isCleanedUp) return
      try {
        fitAddon.fit()
        sendResize(term.cols, term.rows)
      } catch (e) {
        // Ignore resize errors
      }
    }

    window.addEventListener('resize', handleResize)

    // Also handle when the container becomes visible
    const resizeObserver = new ResizeObserver(() => {
      if (!isCleanedUp) {
        try {
          fitAddon.fit()
          sendResize(term.cols, term.rows)
        } catch (e) {
          // Ignore fit errors
        }
      }
    })
    resizeObserver.observe(container)

    // Cleanup function
    return () => {
      isCleanedUp = true
      clearTimeout(fitTimeout)
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      unsubscribe()
      dataDisposable.dispose()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null

      // Remove the terminal div completely
      if (terminalDiv.parentNode) {
        terminalDiv.parentNode.removeChild(terminalDiv)
      }
    }
  }, [host, sendTerminalData, sendResize, onTerminalData])

  return (
    <div className="terminal-view">
      <div className="terminal-header">
        <span className="terminal-title">{host}</span>
        <span className={`status ${connected ? 'connected' : ''}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      {error && <div className="error">{error}</div>}
      <div ref={containerRef} className="terminal-container" />

      <style jsx>{`
        .terminal-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1a1a2e;
          padding-bottom: 60px;
        }
        .terminal-header {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 10px 16px;
          background: #0f0f23;
          border-bottom: 1px solid #2a2a4a;
        }
        .terminal-title {
          flex: 1;
          color: #fff;
          font-weight: 600;
          font-size: 0.95rem;
        }
        .status {
          font-size: 0.75rem;
          color: #f66;
          padding: 4px 10px;
          background: rgba(255, 102, 102, 0.1);
          border-radius: 4px;
        }
        .status.connected {
          color: #6f6;
          background: rgba(102, 255, 102, 0.1);
        }
        .error {
          padding: 8px 16px;
          background: #cc3333;
          color: #fff;
          text-align: center;
          font-size: 0.85rem;
        }
        .terminal-container {
          flex: 1;
          padding: 8px;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}
