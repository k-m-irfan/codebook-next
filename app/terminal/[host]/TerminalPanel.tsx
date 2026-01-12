'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalTab {
  id: string
  title: string
  ws: WebSocket | null
  term: Terminal | null
  fitAddon: FitAddon | null
  connected: boolean
}

interface TerminalPanelProps {
  host: string
  workspacePath: string
  isFullscreen: boolean
  onClose: () => void
  onToggleFullscreen: () => void
}

export default function TerminalPanel({
  host,
  workspacePath,
  isFullscreen,
  onClose,
  onToggleFullscreen
}: TerminalPanelProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tabCounter = useRef(0)
  const lastWorkspacePath = useRef<string>('')

  // Create a new terminal tab
  const createTab = useCallback(() => {
    const id = `term-${Date.now()}-${++tabCounter.current}`
    const newTab: TerminalTab = {
      id,
      title: `Terminal ${tabCounter.current}`,
      ws: null,
      term: null,
      fitAddon: null,
      connected: false,
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
    return id
  }, [])

  // Close a terminal tab
  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === id)
      if (tab) {
        tab.ws?.close()
        tab.term?.dispose()
      }
      const newTabs = prev.filter(t => t.id !== id)
      // If we closed the active tab, switch to another
      if (activeTabId === id && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id)
      } else if (newTabs.length === 0) {
        setActiveTabId(null)
      }
      return newTabs
    })
  }, [activeTabId])

  // Initialize first tab on mount
  useEffect(() => {
    if (tabs.length === 0) {
      createTab()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Setup terminal for active tab
  useEffect(() => {
    if (!activeTabId || !containerRef.current) return

    const tabIndex = tabs.findIndex(t => t.id === activeTabId)
    if (tabIndex === -1) return

    const tab = tabs[tabIndex]

    // If terminal already exists, just show it
    if (tab.term) {
      // Clear container and re-attach
      const container = containerRef.current
      container.innerHTML = ''
      const termDiv = document.createElement('div')
      termDiv.style.width = '100%'
      termDiv.style.height = '100%'
      container.appendChild(termDiv)
      tab.term.open(termDiv)
      setTimeout(() => {
        try {
          tab.fitAddon?.fit()
        } catch (e) {
          // Ignore
        }
      }, 50)
      return
    }

    // Create new terminal instance
    let isCleanedUp = false
    const container = containerRef.current
    container.innerHTML = ''

    const termDiv = document.createElement('div')
    termDiv.style.width = '100%'
    termDiv.style.height = '100%'
    container.appendChild(termDiv)

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

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termDiv)

    // Create WebSocket connection for this tab
    const wsUrl = `ws://${window.location.hostname}:3001?host=${encodeURIComponent(host)}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      if (isCleanedUp) return
      setTabs(prev => prev.map(t =>
        t.id === activeTabId ? { ...t, connected: true } : t
      ))
      // Initial resize
      setTimeout(() => {
        if (!isCleanedUp) {
          try {
            fitAddon.fit()
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
          } catch (e) {
            // Ignore
          }
        }
      }, 100)
    }

    ws.onclose = () => {
      if (isCleanedUp) return
      setTabs(prev => prev.map(t =>
        t.id === activeTabId ? { ...t, connected: false } : t
      ))
    }

    ws.onmessage = (event) => {
      if (isCleanedUp) return
      const data = event.data
      // Skip file operation responses
      try {
        const parsed = JSON.parse(data)
        if (parsed.type?.startsWith('file:')) return
      } catch {
        // Not JSON - terminal data
      }
      term.write(data)
    }

    // Handle terminal input
    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (!isCleanedUp) {
        try {
          fitAddon.fit()
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
          }
        } catch (e) {
          // Ignore
        }
      }
    })
    resizeObserver.observe(container)

    // Update tab with references
    setTabs(prev => prev.map(t =>
      t.id === activeTabId ? { ...t, ws, term, fitAddon } : t
    ))

    return () => {
      isCleanedUp = true
      resizeObserver.disconnect()
      dataDisposable.dispose()
      // Don't close ws/dispose term here - keep them for tab switching
    }
  }, [activeTabId, host]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fit terminal when fullscreen changes
  useEffect(() => {
    const tab = tabs.find(t => t.id === activeTabId)
    if (tab?.fitAddon) {
      setTimeout(() => {
        try {
          tab.fitAddon?.fit()
          if (tab.ws?.readyState === WebSocket.OPEN && tab.term) {
            tab.ws.send(JSON.stringify({ type: 'resize', cols: tab.term.cols, rows: tab.term.rows }))
          }
        } catch (e) {
          // Ignore
        }
      }, 100)
    }
  }, [isFullscreen, activeTabId, tabs])

  // Change directory when workspace changes
  useEffect(() => {
    if (workspacePath && workspacePath !== lastWorkspacePath.current) {
      lastWorkspacePath.current = workspacePath
      const tab = tabs.find(t => t.id === activeTabId)
      if (tab?.ws?.readyState === WebSocket.OPEN) {
        const cdCommand = workspacePath.includes(' ') ? `cd "${workspacePath}"\n` : `cd ${workspacePath}\n`
        tab.ws.send(cdCommand)
      }
    }
  }, [workspacePath, activeTabId, tabs])

  const activeTab = tabs.find(t => t.id === activeTabId)

  return (
    <div className="terminal-panel">
      <div className="panel-header">
        <div className="tabs-container">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="tab-title">{tab.title}</span>
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
              >
                <CloseIcon size={12} />
              </button>
            </div>
          ))}
          <button className="add-tab-btn" onClick={createTab} title="New Terminal">
            <PlusIcon />
          </button>
        </div>
        <div className="header-actions">
          <span className={`status ${activeTab?.connected ? 'connected' : ''}`}>
            {activeTab?.connected ? 'Connected' : 'Disconnected'}
          </span>
          <button className="action-btn" onClick={onToggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
          </button>
          <button className="action-btn" onClick={onClose} title="Close">
            <CloseIcon size={14} />
          </button>
        </div>
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
          justify-content: space-between;
          background: #16213e;
          border-bottom: 1px solid #2a2a4a;
          min-height: 36px;
        }
        .tabs-container {
          display: flex;
          align-items: center;
          flex: 1;
          overflow-x: auto;
          padding: 4px 4px 0;
        }
        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #1a1a2e;
          border: 1px solid #2a2a4a;
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          margin-right: 2px;
          cursor: pointer;
          color: #888;
          font-size: 0.8rem;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .tab:hover {
          background: #252545;
          color: #aaa;
        }
        .tab.active {
          background: #0f0f23;
          color: #fff;
          border-color: #3a3a6a;
        }
        .tab-title {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tab-close {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 2px;
          border-radius: 3px;
        }
        .tab-close:hover {
          background: #3a3a5a;
          color: #fff;
        }
        .add-tab-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: none;
          border: 1px solid transparent;
          color: #666;
          cursor: pointer;
          border-radius: 4px;
          margin-left: 4px;
        }
        .add-tab-btn:hover {
          background: #252545;
          border-color: #3a3a6a;
          color: #fff;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
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
        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          border-radius: 4px;
        }
        .action-btn:hover {
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

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  )
}

function MinimizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  )
}
