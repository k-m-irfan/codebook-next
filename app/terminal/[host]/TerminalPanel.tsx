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
  containerEl: HTMLDivElement | null
}

interface TerminalPanelProps {
  host: string
  workspacePath: string
  isVisible?: boolean
}

export default function TerminalPanel({
  host,
  workspacePath,
  isVisible = false,
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
      containerEl: null,
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
        tab.containerEl?.remove()
      }
      const newTabs = prev.filter(t => t.id !== id)
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

  // Show/hide terminal containers based on active tab
  useEffect(() => {
    tabs.forEach(tab => {
      if (tab.containerEl) {
        tab.containerEl.style.display = tab.id === activeTabId ? 'block' : 'none'
      }
    })
    // Fit the active terminal
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (activeTab?.fitAddon) {
      setTimeout(() => {
        try {
          activeTab.fitAddon?.fit()
        } catch (e) {
          // Ignore
        }
      }, 50)
    }
  }, [activeTabId, tabs])

  // Setup terminal for tabs that don't have one yet
  useEffect(() => {
    if (!containerRef.current) return

    const tabsNeedingSetup = tabs.filter(t => !t.term && !t.containerEl)
    if (tabsNeedingSetup.length === 0) return

    tabsNeedingSetup.forEach(tab => {
      const container = containerRef.current!

      // Create persistent container for this terminal
      const termDiv = document.createElement('div')
      termDiv.style.width = '100%'
      termDiv.style.height = '100%'
      termDiv.style.display = tab.id === activeTabId ? 'block' : 'none'
      termDiv.dataset.tabId = tab.id
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
      const tabId = tab.id

      ws.onopen = () => {
        setTabs(prev => prev.map(t =>
          t.id === tabId ? { ...t, connected: true } : t
        ))
        setTimeout(() => {
          try {
            fitAddon.fit()
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
            // Auto cd to workspace directory for new terminals and clear
            if (workspacePath) {
              const cdCommand = workspacePath.includes(' ') ? `cd "${workspacePath}" && clear\n` : `cd ${workspacePath} && clear\n`
              ws.send(cdCommand)
            } else {
              ws.send('clear\n')
            }
          } catch (e) {
            // Ignore
          }
        }, 100)
      }

      ws.onclose = () => {
        setTabs(prev => prev.map(t =>
          t.id === tabId ? { ...t, connected: false } : t
        ))
      }

      ws.onmessage = (event) => {
        const data = event.data
        try {
          const parsed = JSON.parse(data)
          if (parsed.type?.startsWith('file:')) return
        } catch {
          // Not JSON - terminal data
        }
        term.write(data)
      }

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      })

      // Add resize observer for this terminal
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit()
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
          }
        } catch (e) {
          // Ignore
        }
      })
      resizeObserver.observe(termDiv)

      // Update tab with terminal instances
      setTabs(prev => prev.map(t =>
        t.id === tabId ? { ...t, ws, term, fitAddon, containerEl: termDiv } : t
      ))
    })
  }, [tabs, activeTabId, host, workspacePath])

  // Change directory when workspace changes
  useEffect(() => {
    if (workspacePath && workspacePath !== lastWorkspacePath.current) {
      lastWorkspacePath.current = workspacePath
      const tab = tabs.find(t => t.id === activeTabId)
      if (tab?.ws?.readyState === WebSocket.OPEN) {
        const cdCommand = workspacePath.includes(' ') ? `cd "${workspacePath}" && clear\n` : `cd ${workspacePath} && clear\n`
        tab.ws.send(cdCommand)
      }
    }
  }, [workspacePath, activeTabId, tabs])

  // Re-fit terminal when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure container has proper dimensions
      const timer = setTimeout(() => {
        tabs.forEach(tab => {
          if (tab.fitAddon && tab.ws?.readyState === WebSocket.OPEN) {
            try {
              tab.fitAddon.fit()
              if (tab.term) {
                tab.ws.send(JSON.stringify({ type: 'resize', cols: tab.term.cols, rows: tab.term.rows }))
              }
            } catch (e) {
              // Ignore
            }
          }
        })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isVisible, tabs])

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
