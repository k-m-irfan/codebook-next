'use client'

import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useConnection } from './ConnectionContext'

interface TerminalPanelProps {
  host: string
  workspacePath: string
  onClose: () => void
}

export default function TerminalPanel({ host, workspacePath, onClose }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const lastWorkspacePath = useRef<string>('')
  const { connected, sendTerminalData, sendResize, onTerminalData } = useConnection()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let isCleanedUp = false

    // Create a fresh div for xterm
    const terminalDiv = document.createElement('div')
    terminalDiv.style.width = '100%'
    terminalDiv.style.height = '100%'
    container.appendChild(terminalDiv)

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0f0f23',
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
          // Ignore
        }
      }
    }, 100)

    // Subscribe to terminal data
    const unsubscribe = onTerminalData((data) => {
      if (!isCleanedUp) {
        try {
          const parsed = JSON.parse(data)
          if (parsed.type?.startsWith('file:')) return
        } catch {
          // Not JSON
        }
        term.write(data)
      }
    })

    // Handle terminal input
    const dataDisposable = term.onData((data) => {
      sendTerminalData(data)
    })

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (!isCleanedUp) {
        try {
          fitAddon.fit()
          sendResize(term.cols, term.rows)
        } catch (e) {
          // Ignore
        }
      }
    })
    resizeObserver.observe(container)

    return () => {
      isCleanedUp = true
      clearTimeout(fitTimeout)
      resizeObserver.disconnect()
      unsubscribe()
      dataDisposable.dispose()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      if (terminalDiv.parentNode) {
        terminalDiv.parentNode.removeChild(terminalDiv)
      }
    }
  }, [host, sendTerminalData, sendResize, onTerminalData])

  // Change directory when workspace changes
  useEffect(() => {
    if (workspacePath && workspacePath !== lastWorkspacePath.current && connected) {
      lastWorkspacePath.current = workspacePath
      // Send cd command to terminal
      sendTerminalData(`cd ${workspacePath.includes(' ') ? `"${workspacePath}"` : workspacePath}\n`)
    }
  }, [workspacePath, connected, sendTerminalData])

  return (
    <div className="terminal-panel">
      <div className="panel-header">
        <span className="panel-title">Terminal</span>
        <span className={`status ${connected ? 'connected' : ''}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <button className="close-btn" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div ref={containerRef} className="terminal-container" />

      <style jsx>{`
        .terminal-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0f0f23;
        }
        .panel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 12px;
          background: #16213e;
          border-bottom: 1px solid #2a2a4a;
        }
        .panel-title {
          flex: 1;
          color: #fff;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .status {
          font-size: 0.7rem;
          color: #f66;
          padding: 2px 8px;
          background: rgba(255, 102, 102, 0.1);
          border-radius: 3px;
        }
        .status.connected {
          color: #6f6;
          background: rgba(102, 255, 102, 0.1);
        }
        .close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          border-radius: 4px;
        }
        .close-btn:hover {
          background: #2a2a4a;
          color: #fff;
        }
        .terminal-container {
          flex: 1;
          padding: 4px;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
