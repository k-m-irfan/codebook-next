'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalComponentProps {
  host: string
}

export default function TerminalComponent({ host }: TerminalComponentProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(0)

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

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalDiv)

    // Fit terminal after a short delay
    const fitTimeout = setTimeout(() => {
      if (!isCleanedUp) {
        try {
          fitAddon.fit()
        } catch (e) {
          // Ignore fit errors
        }
      }
    }, 100)

    // Connect WebSocket
    const wsUrl = `ws://${window.location.hostname}:3001?host=${encodeURIComponent(host)}`
    console.log('Connecting to:', wsUrl)
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      if (isCleanedUp) return
      console.log('WebSocket connected')
      setConnected(true)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }

    ws.onmessage = (event) => {
      if (isCleanedUp) return
      term.write(event.data)
    }

    ws.onerror = () => {
      if (isCleanedUp) return
      setError('Connection error')
    }

    ws.onclose = (e) => {
      if (isCleanedUp) return
      console.log('WebSocket closed:', e.code)
      setConnected(false)
      term.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n')
    }

    // Handle terminal input
    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    // Handle window resize
    const handleResize = () => {
      if (isCleanedUp) return
      try {
        fitAddon.fit()
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
        }
      } catch (e) {
        // Ignore resize errors
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup function
    return () => {
      isCleanedUp = true
      clearTimeout(fitTimeout)
      window.removeEventListener('resize', handleResize)

      dataDisposable.dispose()

      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      ws.close()

      term.dispose()

      // Remove the terminal div completely
      if (terminalDiv.parentNode) {
        terminalDiv.parentNode.removeChild(terminalDiv)
      }
    }
  }, [host, key])

  return (
    <div className="terminal-page">
      <div className="terminal-header">
        <button className="back-btn" onClick={() => router.push('/')}>
          ← Back
        </button>
        <span className="terminal-title">{host}</span>
        <span className={`status ${connected ? 'connected' : ''}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      {error && <div className="error">{error}</div>}
      <div ref={containerRef} className="terminal-container" />

      <style jsx>{`
        .terminal-page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #1a1a2e;
        }
        .terminal-header {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 12px 16px;
          background: #0f0f23;
          border-bottom: 1px solid #2a2a4a;
        }
        .back-btn {
          background: #2a2a4a;
          border: none;
          color: #fff;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .back-btn:hover {
          background: #3a3a6a;
        }
        .terminal-title {
          flex: 1;
          color: #fff;
          font-weight: 600;
        }
        .status {
          font-size: 0.8rem;
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
          padding: 10px;
          background: #f66;
          color: #fff;
          text-align: center;
        }
        .terminal-container {
          flex: 1;
          padding: 10px;
        }
      `}</style>
    </div>
  )
}
