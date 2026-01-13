'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { usePassword } from './PasswordContext'

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
  const { password: cachedPassword, setPassword: setCachedPassword } = usePassword()

  // On mount, check sessionStorage for password from home page
  useEffect(() => {
    const storedPassword = sessionStorage.getItem(`ssh_password_${host}`)
    if (storedPassword && !cachedPassword) {
      setCachedPassword(storedPassword)
      // Clear from sessionStorage after reading
      sessionStorage.removeItem(`ssh_password_${host}`)
    }
  }, [host, cachedPassword, setCachedPassword])
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordPrompt, setPasswordPrompt] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [pendingTabId, setPendingTabId] = useState<string | null>(null)
  const [gestureMode, setGestureMode] = useState(true) // Gesture mode enabled by default
  const containerRef = useRef<HTMLDivElement>(null)
  const tabCounter = useRef(0)
  const lastWorkspacePath = useRef<string>('')
  const gestureModeRef = useRef(true) // Ref for touch handlers to access current state

  // Keep ref in sync with state for touch handlers
  // Also update viewport overflow style directly
  useEffect(() => {
    gestureModeRef.current = gestureMode

    // Directly set overflow on all viewports to ensure scroll is blocked in gesture mode
    if (containerRef.current) {
      const viewports = containerRef.current.querySelectorAll('.xterm-viewport') as NodeListOf<HTMLElement>
      const screens = containerRef.current.querySelectorAll('.xterm-screen') as NodeListOf<HTMLElement>

      viewports.forEach(viewport => {
        if (gestureMode) {
          viewport.style.overflowY = 'hidden'
          viewport.style.overflow = 'hidden'
          viewport.style.touchAction = 'none'
          viewport.style.overscrollBehavior = 'none'
        } else {
          viewport.style.overflowY = 'scroll'
          viewport.style.overflow = ''
          viewport.style.touchAction = ''
          viewport.style.overscrollBehavior = ''
        }
      })

      // Also disable touch on xterm-screen to prevent its internal handling
      screens.forEach(screen => {
        if (gestureMode) {
          screen.style.touchAction = 'none'
        } else {
          screen.style.touchAction = ''
        }
      })
    }
  }, [gestureMode])

  // Write buffer for batching terminal output using requestAnimationFrame
  const writeBuffers = useRef<Map<string, string[]>>(new Map())
  const rafIds = useRef<Map<string, number>>(new Map())

  // Flush buffered writes on animation frame for smooth scrolling
  const flushWrites = useCallback((tabId: string, term: Terminal) => {
    const buffer = writeBuffers.current.get(tabId)
    if (buffer && buffer.length > 0) {
      const data = buffer.join('')
      buffer.length = 0
      term.write(data)
    }
    rafIds.current.delete(tabId)
  }, [])

  // Queue data for batched writing
  const queueWrite = useCallback((tabId: string, term: Terminal, data: string) => {
    let buffer = writeBuffers.current.get(tabId)
    if (!buffer) {
      buffer = []
      writeBuffers.current.set(tabId, buffer)
    }
    buffer.push(data)

    // Schedule flush if not already scheduled
    if (!rafIds.current.has(tabId)) {
      const rafId = requestAnimationFrame(() => flushWrites(tabId, term))
      rafIds.current.set(tabId, rafId)
    }
  }, [flushWrites])

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
        // Scrolling performance options
        scrollback: 5000,
        fastScrollModifier: 'alt',
        fastScrollSensitivity: 5,
        scrollSensitivity: 1,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(termDiv)

      // Create WebSocket connection for this tab
      const wsUrl = `ws://${window.location.hostname}:3001?host=${encodeURIComponent(host)}`
      const ws = new WebSocket(wsUrl)
      const tabId = tab.id

      ws.onopen = () => {
        console.log('WebSocket connected for tab:', tabId)
        setTabs(prev => prev.map(t =>
          t.id === tabId ? { ...t, connected: true } : t
        ))
      }

      ws.onclose = () => {
        setTabs(prev => prev.map(t =>
          t.id === tabId ? { ...t, connected: false } : t
        ))
      }

      let initialCommandsSent = false

      const sendInitialCommands = () => {
        if (initialCommandsSent) return
        initialCommandsSent = true
        setTimeout(() => {
          try {
            fitAddon.fit()
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
            if (workspacePath) {
              const cdCommand = workspacePath.includes(' ') ? `cd "${workspacePath}" && clear\n` : `cd ${workspacePath} && clear\n`
              ws.send(cdCommand)
            } else {
              ws.send('clear\n')
            }
          } catch (e) {
            console.error('Error sending initial commands:', e)
          }
        }, 100)
      }

      ws.onmessage = (event) => {
        const data = event.data
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'auth:password-required') {
            // Server is asking for password
            if (cachedPassword) {
              // Use cached password automatically
              console.log('Using cached password for', host)
              ws.send(JSON.stringify({
                type: 'auth:password',
                password: cachedPassword
              }))
              return
            }
            // No cached password - show modal
            console.log('Password required - showing modal')
            const prompt = parsed.prompts?.[0]?.prompt || 'Password:'
            setPasswordPrompt(prompt)
            setPendingTabId(tabId)
            setShowPasswordModal(true)
            return
          }
          if (parsed.type?.startsWith('file:')) return
        } catch {
          // Not JSON - terminal data, connection is ready
          if (!initialCommandsSent) {
            sendInitialCommands()
          }
        }
        // Use batched writes for smooth scrolling
        queueWrite(tabId, term, data)
      }

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      })

      // Add debounced resize observer for this terminal
      let resizeTimeout: ReturnType<typeof setTimeout> | null = null
      const resizeObserver = new ResizeObserver(() => {
        if (resizeTimeout) clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => {
          try {
            fitAddon.fit()
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
            }
          } catch (e) {
            // Ignore
          }
        }, 50) // Debounce resize operations
      })
      resizeObserver.observe(termDiv)

      // Touch handler with gesture mode support
      const viewport = termDiv.querySelector('.xterm-viewport') as HTMLElement
      if (viewport) {
        viewport.style.touchAction = 'none'

        // Set initial overflow based on gesture mode
        if (gestureModeRef.current) {
          viewport.style.overflowY = 'hidden'
          viewport.style.overflow = 'hidden'
          viewport.style.touchAction = 'none'
          viewport.style.overscrollBehavior = 'none'
        }

        // Scroll mode state
        let lastY = 0
        let velocityY = 0
        let animFrameId: number | null = null
        const history: { y: number; t: number }[] = []

        // Gesture mode state
        let startX = 0
        let startY = 0
        let startTime = 0
        let lastTapTime = 0
        let gestureTriggered = false
        let lastGestureX = 0
        let lastGestureY = 0
        let cumulativeX = 0
        let cumulativeY = 0
        let swipeAxis: 'horizontal' | 'vertical' | null = null // Lock to one axis

        // Arrow key escape codes
        const ARROW_UP = '\x1b[A'
        const ARROW_DOWN = '\x1b[B'
        const ARROW_RIGHT = '\x1b[C'
        const ARROW_LEFT = '\x1b[D'
        const TAB_KEY = '\t'

        const SWIPE_THRESHOLD = 30 // Min pixels for swipe
        const GESTURE_STEP = 25 // Pixels per arrow key in continuous gesture
        const DOUBLE_TAP_DELAY = 300 // Max ms between taps

        const cancelMomentum = () => {
          if (animFrameId !== null) {
            cancelAnimationFrame(animFrameId)
            animFrameId = null
          }
        }

        const doMomentum = () => {
          viewport.scrollTop += velocityY
          velocityY *= 0.97

          if (Math.abs(velocityY) > 0.3) {
            animFrameId = requestAnimationFrame(doMomentum)
          } else {
            animFrameId = null
          }
        }

        const sendKey = (key: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(key)
          }
        }

        const onTouchStart = (e: TouchEvent) => {
          const touch = e.touches[0]
          startX = touch.clientX
          startY = touch.clientY
          startTime = e.timeStamp
          gestureTriggered = false

          if (gestureModeRef.current) {
            // Prevent default and stop propagation to fully block xterm's touch handling
            e.preventDefault()
            e.stopPropagation()

            // Gesture mode - reset tracking for continuous gesture
            lastGestureX = touch.clientX
            lastGestureY = touch.clientY
            cumulativeX = 0
            cumulativeY = 0
            swipeAxis = null // Reset axis lock for new gesture

            // Check for double tap
            const timeSinceLastTap = startTime - lastTapTime
            if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
              // Double tap detected - send tab
              sendKey(TAB_KEY)
              lastTapTime = 0 // Reset to prevent triple tap
              gestureTriggered = true
              // Refocus terminal to keep keyboard open
              term.focus()
              return
            }
          } else {
            // Scroll mode
            cancelMomentum()
            lastY = startY
            history.length = 0
            history.push({ y: startY, t: e.timeStamp })
          }
        }

        const onTouchMove = (e: TouchEvent) => {
          if (gestureModeRef.current) {
            // Gesture mode - prevent and stop to block xterm's handling
            e.preventDefault()
            e.stopPropagation()

            // Gesture mode - send keys continuously based on movement
            const touch = e.touches[0]
            const deltaX = touch.clientX - lastGestureX
            const deltaY = touch.clientY - lastGestureY

            lastGestureX = touch.clientX
            lastGestureY = touch.clientY

            cumulativeX += deltaX
            cumulativeY += deltaY

            // Determine axis lock on first significant movement
            if (swipeAxis === null) {
              const absX = Math.abs(cumulativeX)
              const absY = Math.abs(cumulativeY)
              if (absX >= GESTURE_STEP || absY >= GESTURE_STEP) {
                swipeAxis = absX > absY ? 'horizontal' : 'vertical'
              }
            }

            // Send keys only for the locked axis
            if (swipeAxis === 'horizontal') {
              while (Math.abs(cumulativeX) >= GESTURE_STEP) {
                if (cumulativeX > 0) {
                  sendKey(ARROW_RIGHT)
                  cumulativeX -= GESTURE_STEP
                } else {
                  sendKey(ARROW_LEFT)
                  cumulativeX += GESTURE_STEP
                }
                gestureTriggered = true
              }
            } else if (swipeAxis === 'vertical') {
              while (Math.abs(cumulativeY) >= GESTURE_STEP) {
                if (cumulativeY > 0) {
                  sendKey(ARROW_DOWN)
                  cumulativeY -= GESTURE_STEP
                } else {
                  sendKey(ARROW_UP)
                  cumulativeY += GESTURE_STEP
                }
                gestureTriggered = true
              }
            }

            return
          }

          // Scroll mode - prevent default for custom momentum scrolling
          e.preventDefault()
          const touch = e.touches[0]
          const y = touch.clientY
          const deltaY = lastY - y

          history.push({ y, t: e.timeStamp })
          const cutoff = e.timeStamp - 100
          while (history.length > 2 && history[0].t < cutoff) {
            history.shift()
          }

          viewport.scrollTop += deltaY
          lastY = y
        }

        const onTouchEnd = (e: TouchEvent) => {
          if (gestureTriggered) {
            // Refocus terminal after gesture
            term.focus()
            return
          }

          const endTime = e.timeStamp
          const touch = e.changedTouches[0]
          const endX = touch.clientX
          const endY = touch.clientY

          const deltaX = endX - startX
          const deltaY = endY - startY

          if (gestureModeRef.current) {
            // Gesture mode - keys sent during move, just handle tap detection
            if (gestureTriggered) {
              // Swipe occurred, reset tap detection
              lastTapTime = 0
            } else {
              // No swipe - record tap time for double tap detection
              lastTapTime = endTime
            }
            // Always refocus terminal after gesture to keep keyboard and cursor
            term.focus()
          } else {
            // Scroll mode - apply momentum
            if (history.length >= 2) {
              const first = history[0]
              const last = history[history.length - 1]
              const dy = first.y - last.y
              const dt = last.t - first.t

              if (dt > 0 && dt < 300) {
                velocityY = (dy / dt) * 16 * 2.5
                if (Math.abs(velocityY) > 1) {
                  animFrameId = requestAnimationFrame(doMomentum)
                }
              }
            }
            history.length = 0
          }
        }

        // Use passive: false to allow preventDefault in gesture mode
        viewport.addEventListener('touchstart', onTouchStart, { passive: false })
        viewport.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
        viewport.addEventListener('touchend', onTouchEnd, { passive: true })
        viewport.addEventListener('touchcancel', onTouchEnd, { passive: true })
      }

      // Update tab with terminal instances
      setTabs(prev => prev.map(t =>
        t.id === tabId ? { ...t, ws, term, fitAddon, containerEl: termDiv } : t
      ))
    })
  }, [tabs, activeTabId, host, workspacePath, cachedPassword, queueWrite])

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

  const handlePasswordSubmit = useCallback(() => {
    if (!pendingTabId || !passwordInput) return

    const tab = tabs.find(t => t.id === pendingTabId)
    if (tab?.ws?.readyState === WebSocket.OPEN) {
      tab.ws.send(JSON.stringify({
        type: 'auth:password',
        password: passwordInput
      }))
      // Cache the password for future terminal tabs
      setCachedPassword(passwordInput)
    }

    setShowPasswordModal(false)
    setPasswordInput('')
    setPendingTabId(null)
  }, [pendingTabId, passwordInput, tabs, setCachedPassword])

  const handlePasswordCancel = useCallback(() => {
    // Close the connection if password is cancelled
    if (pendingTabId) {
      const tab = tabs.find(t => t.id === pendingTabId)
      if (tab?.ws) {
        tab.ws.close()
      }
    }
    setShowPasswordModal(false)
    setPasswordInput('')
    setPendingTabId(null)
  }, [pendingTabId, tabs])

  return (
    <div className={`terminal-panel ${gestureMode ? 'gesture-mode' : 'scroll-mode'}`}>
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
          <span className={`status-dot ${activeTab?.connected ? 'connected' : ''}`} />
        </div>
      </div>
      <div className="terminal-wrapper">
        <div ref={containerRef} className="terminal-container" />
        <button
          className={`gesture-toggle ${gestureMode ? 'active' : ''}`}
          onClick={() => setGestureMode(!gestureMode)}
          title={gestureMode ? 'Gesture Mode (tap to switch to scroll)' : 'Scroll Mode (tap to switch to gesture)'}
        >
          {gestureMode ? <GestureIcon /> : <ScrollIcon />}
        </button>
      </div>

      <style jsx>{`
        .terminal-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0f0f23;
          position: relative;
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
          gap: 10px;
          padding: 0 12px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f55;
          box-shadow: 0 0 6px rgba(255, 85, 85, 0.6);
        }
        .status-dot.connected {
          background: #5f5;
          box-shadow: 0 0 6px rgba(85, 255, 85, 0.6);
        }
        .terminal-wrapper {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .terminal-container {
          flex: 1;
          padding: 4px;
          overflow: hidden;
        }
        .gesture-toggle {
          position: absolute;
          bottom: 16px;
          left: 16px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #2a2a4a;
          border: 2px solid #3a3a6a;
          color: #888;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .gesture-toggle:hover {
          background: #3a3a5a;
          color: #fff;
        }
        .gesture-toggle.active {
          background: #4a4a8a;
          border-color: #6a6aba;
          color: #fff;
        }
        .password-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .password-modal {
          background: #16213e;
          border-radius: 12px;
          padding: 24px;
          width: 100%;
          max-width: 350px;
        }
        .password-modal h3 {
          color: #fff;
          margin: 0 0 16px;
          font-size: 1.1rem;
        }
        .password-modal input {
          width: 100%;
          padding: 12px;
          background: #1a1a2e;
          border: 1px solid #2a2a4a;
          border-radius: 6px;
          color: #fff;
          font-size: 1rem;
          margin-bottom: 16px;
        }
        .password-modal input:focus {
          outline: none;
          border-color: #4a4a8a;
        }
        .password-modal-actions {
          display: flex;
          gap: 12px;
        }
        .password-modal-actions button {
          flex: 1;
          padding: 10px 16px;
          border-radius: 6px;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-cancel {
          background: transparent;
          border: 1px solid #3a3a5a;
          color: #888;
        }
        .btn-cancel:hover {
          background: #2a2a4a;
          color: #fff;
        }
        .btn-submit {
          background: #4a4a8a;
          border: none;
          color: #fff;
        }
        .btn-submit:hover {
          background: #5a5a9a;
        }
      `}</style>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="password-modal-overlay" onClick={handlePasswordCancel}>
          <div className="password-modal" onClick={e => e.stopPropagation()}>
            <h3>{passwordPrompt}</h3>
            <input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handlePasswordSubmit()
                if (e.key === 'Escape') handlePasswordCancel()
              }}
              autoFocus
            />
            <div className="password-modal-actions">
              <button className="btn-cancel" onClick={handlePasswordCancel}>
                Cancel
              </button>
              <button className="btn-submit" onClick={handlePasswordSubmit}>
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
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

function GestureIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Hand with swipe arrows */}
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  )
}

function ScrollIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Scroll/list icon */}
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
      <path d="M19 9l3-3-3-3" />
      <path d="M19 21l3-3-3-3" />
    </svg>
  )
}
