'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { usePassword } from './PasswordContext'
import QuickKeysPanel, { QuickKeysPanelRef } from './QuickKeysPanel'
import { TerminalTabState } from '@/lib/session-storage'
import { serializeTerminalBuffer, restoreTerminalBuffer } from '@/lib/terminal-serializer'

interface TerminalTab {
  id: string
  title: string
  ws: WebSocket | null
  term: Terminal | null
  fitAddon: FitAddon | null
  connected: boolean
  containerEl: HTMLDivElement | null
  initialContent?: string // Content to restore after connection
}

interface TerminalPanelProps {
  host: string
  workspacePath: string
  isVisible?: boolean
  isKeyboardVisible?: boolean
  sessionId?: string | null
  initialTerminalTabs?: TerminalTabState[]
  onTerminalStateChange?: (tabs: TerminalTabState[], activeTabId: string | null) => void
}

export default function TerminalPanel({
  host,
  workspacePath,
  isVisible = false,
  isKeyboardVisible = false,
  sessionId = null,
  initialTerminalTabs = [],
  onTerminalStateChange,
}: TerminalPanelProps) {
  const { password: cachedPassword, setPassword: setCachedPassword } = usePassword()
  const initialTabsRestoredRef = useRef(false)

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
  const tabCompletionPendingRef = useRef<Set<string>>(new Set()) // Track TAB completion state per terminal
  const quickKeyModifiersRef = useRef({ ctrl: false, alt: false, shift: false }) // Track quick key modifiers
  const quickKeysPanelRef = useRef<QuickKeysPanelRef>(null) // Ref to reset modifiers visually

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

  // Create a new terminal tab (optionally with restored state)
  const createTab = useCallback((restoredState?: { id: string; title: string; initialContent?: string }) => {
    let id: string
    let title: string
    let newTabRef: TerminalTab | null = null

    if (restoredState) {
      id = restoredState.id
      title = restoredState.title
      newTabRef = {
        id,
        title,
        ws: null,
        term: null,
        fitAddon: null,
        connected: false,
        containerEl: null,
        initialContent: restoredState.initialContent,
      }
      setTabs(prev => [...prev, newTabRef!])
    } else {
      // Find lowest available number by checking current tabs
      setTabs(prev => {
        const usedNumbers = new Set(
          prev
            .filter(t => t.title.startsWith('Terminal '))
            .map(t => {
              const num = parseInt(t.title.replace('Terminal ', ''), 10)
              return isNaN(num) ? 0 : num
            })
        )
        let nextNum = 1
        while (usedNumbers.has(nextNum)) {
          nextNum++
        }

        id = `term-${Date.now()}-${nextNum}`
        title = `Terminal ${nextNum}`

        newTabRef = {
          id,
          title,
          ws: null,
          term: null,
          fitAddon: null,
          connected: false,
          containerEl: null,
        }
        return [...prev, newTabRef]
      })
    }

    // Use setTimeout to ensure setTabs has completed before setting activeTabId
    setTimeout(() => {
      if (newTabRef) {
        setActiveTabId(newTabRef.id)
      }
    }, 0)

    return id!
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

  // Initialize tabs on mount (restore from session or create new)
  useEffect(() => {
    if (tabs.length === 0 && !initialTabsRestoredRef.current) {
      initialTabsRestoredRef.current = true

      if (initialTerminalTabs && initialTerminalTabs.length > 0) {
        // Restore tabs from session
        initialTerminalTabs.forEach((tabState, index) => {
          createTab({
            id: tabState.id,
            title: tabState.title,
            initialContent: tabState.scrollbackBuffer,
          })
        })
        console.log(`Restored ${initialTerminalTabs.length} terminal tabs from session`)
      } else {
        // Create a fresh tab
        createTab()
      }
    }
  }, [initialTerminalTabs]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show/hide terminal containers based on active tab
  useEffect(() => {
    tabs.forEach(tab => {
      if (tab.containerEl) {
        tab.containerEl.style.display = tab.id === activeTabId ? 'block' : 'none'
      }
    })
    // Note: We don't call fit() here - the ResizeObserver will handle fitting
    // when the container becomes visible. Calling fit() here was causing
    // unnecessary resize events that triggered the shell's partial line indicator (%)
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
      const hasInitialContent = !!tab.initialContent

      const sendInitialCommands = () => {
        if (initialCommandsSent) return
        initialCommandsSent = true
        setTimeout(() => {
          try {
            fitAddon.fit()
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))

            // If restoring from session, write initial content first
            if (hasInitialContent && tab.initialContent) {
              restoreTerminalBuffer(term, tab.initialContent)
              // Clear the initial content after restoration
              setTabs(prev => prev.map(t =>
                t.id === tabId ? { ...t, initialContent: undefined } : t
              ))
            }

            // Send cd command if workspace set, otherwise just clear (unless restoring)
            if (workspacePath) {
              const cdCommand = hasInitialContent
                ? `cd "${workspacePath.includes(' ') ? workspacePath : workspacePath}"\n`
                : workspacePath.includes(' ') ? `cd "${workspacePath}" && clear\n` : `cd ${workspacePath} && clear\n`
              ws.send(cdCommand)
            } else if (!hasInitialContent) {
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
          let dataToSend = data

          // Apply quick key modifiers to single character input
          const mods = quickKeyModifiersRef.current
          if ((mods.ctrl || mods.alt || mods.shift) && data.length === 1) {
            const charCode = data.charCodeAt(0)

            if (mods.ctrl) {
              // Convert to control character (a-z and A-Z)
              if ((charCode >= 97 && charCode <= 122) || (charCode >= 65 && charCode <= 90)) {
                const lowerCharCode = data.toLowerCase().charCodeAt(0)
                dataToSend = String.fromCharCode(lowerCharCode - 96)
              }
            } else if (mods.alt) {
              // Alt + char = ESC + char
              dataToSend = '\x1b' + data
            } else if (mods.shift) {
              // Shift = uppercase
              dataToSend = data.toUpperCase()
            }

            // Clear modifiers after use (both ref and visual state)
            quickKeyModifiersRef.current = { ctrl: false, alt: false, shift: false }
            quickKeysPanelRef.current?.resetModifiers()
          }

          // Clear completion pending state on Enter or Escape (user committed or cancelled)
          if (dataToSend === '\r' || dataToSend === '\x1b') {
            tabCompletionPendingRef.current.delete(tabId)
            ws.send(dataToSend)
            return
          }
          // If TAB completion list is showing and user types anything (except TAB),
          // send the character first, then clear screen to remove completion list
          if (tabCompletionPendingRef.current.has(tabId) && dataToSend.length > 0 && dataToSend !== '\t') {
            tabCompletionPendingRef.current.delete(tabId)
            // Send character first so shell registers it
            ws.send(dataToSend)
            // Then clear screen after a delay to remove completion list
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send('\x0c') // Ctrl+L to clear and redraw with updated command
              }
            }, 100)
            return
          }
          ws.send(dataToSend)
        }
      })

      // Add debounced resize observer for this terminal
      let resizeTimeout: ReturnType<typeof setTimeout> | null = null
      let lastCols = 0
      let lastRows = 0
      let wasHidden = true // Track if container was previously hidden
      const resizeObserver = new ResizeObserver(() => {
        if (resizeTimeout) clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => {
          try {
            // Check if container is actually visible
            const isVisible = termDiv.style.display !== 'none' && termDiv.offsetParent !== null

            if (!isVisible) {
              // Container is hidden, just mark it and skip
              wasHidden = true
              return
            }

            fitAddon.fit()
            const newCols = term.cols
            const newRows = term.rows

            // Only send resize if:
            // 1. We have valid previous dimensions (lastCols > 0 && lastRows > 0)
            // 2. Dimensions actually changed
            // 3. Container wasn't just shown (wasHidden was false)
            // This prevents resize when switching tabs
            if (ws.readyState === WebSocket.OPEN &&
                lastCols > 0 && lastRows > 0 &&
                !wasHidden &&
                (newCols !== lastCols || newRows !== lastRows)) {
              ws.send(JSON.stringify({ type: 'resize', cols: newCols, rows: newRows }))
            }

            lastCols = newCols
            lastRows = newRows
            wasHidden = false
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
              // Mark that TAB completion list might be showing
              tabCompletionPendingRef.current.add(tabId)
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
  // Note: We only call fit() here - the ResizeObserver handles sending resize events
  // This prevents unnecessary resize events that trigger shell's partial line indicator (%)
  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure container has proper dimensions
      const timer = setTimeout(() => {
        // Only fit the active tab - hidden tabs will be fit when they become visible
        const activeTab = tabs.find(t => t.id === activeTabId)
        if (activeTab?.fitAddon) {
          try {
            activeTab.fitAddon.fit()
          } catch (e) {
            // Ignore
          }
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isVisible, tabs, activeTabId])

  // Periodic serialization to persist terminal state (every 5 seconds)
  useEffect(() => {
    if (!sessionId || !onTerminalStateChange) return

    const interval = setInterval(() => {
      const serializedTabs: TerminalTabState[] = tabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        scrollbackBuffer: tab.term ? serializeTerminalBuffer(tab.term) : '',
      }))
      onTerminalStateChange(serializedTabs, activeTabId)
    }, 5000)

    return () => clearInterval(interval)
  }, [sessionId, tabs, activeTabId, onTerminalStateChange])

  // Also serialize when tabs are created or closed
  useEffect(() => {
    if (!sessionId || !onTerminalStateChange) return

    // Debounce to avoid too frequent updates
    const timer = setTimeout(() => {
      const serializedTabs: TerminalTabState[] = tabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        scrollbackBuffer: tab.term ? serializeTerminalBuffer(tab.term) : '',
      }))
      onTerminalStateChange(serializedTabs, activeTabId)
    }, 500)

    return () => clearTimeout(timer)
  }, [tabs.length, activeTabId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Handler for quick keys panel
  const handleQuickKeyPress = useCallback((key: string) => {
    const tab = tabs.find(t => t.id === activeTabId)
    if (tab?.ws?.readyState === WebSocket.OPEN) {
      tab.ws.send(key)
    }
  }, [tabs, activeTabId])

  // Handler for quick key modifier changes
  const handleModifierChange = useCallback((mods: { ctrl: boolean; alt: boolean; shift: boolean }) => {
    quickKeyModifiersRef.current = mods
  }, [])

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
          <button className="add-tab-btn" onClick={() => createTab()} title="New Terminal">
            <PlusIcon />
          </button>
        </div>
        <div className="header-actions">
          <span className={`status-dot ${activeTab?.connected ? 'connected' : ''}`} />
        </div>
      </div>
      <div className="terminal-wrapper">
        <div ref={containerRef} className="terminal-container" />
        {isKeyboardVisible && (
          <QuickKeysPanel ref={quickKeysPanelRef} onKeyPress={handleQuickKeyPress} onModifierChange={handleModifierChange} />
        )}
        <button
          className={`gesture-toggle ${gestureMode ? 'active' : ''} ${isKeyboardVisible ? 'keyboard-visible' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setGestureMode(!gestureMode)
          }}
          onTouchStart={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setGestureMode(!gestureMode)
          }}
          title={gestureMode ? 'Gesture Mode (tap to switch to scroll)' : 'Scroll Mode (tap to switch to gesture)'}
        >
          <GestureIcon />
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
          background: rgba(22, 33, 62, 0.95);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          min-height: 48px;
          padding: 0 8px;
        }
        .tabs-container {
          display: flex;
          align-items: center;
          flex: 1;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          gap: 4px;
          padding: 6px 0;
        }
        .tabs-container::-webkit-scrollbar {
          display: none;
        }
        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          min-height: 36px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid transparent;
          border-radius: 10px;
          cursor: pointer;
          color: #888;
          font-size: 0.85rem;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .tab:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .tab:active {
          transform: scale(0.98);
        }
        .tab.active {
          background: rgba(138, 180, 248, 0.1);
          border-color: rgba(138, 180, 248, 0.2);
          color: #fff;
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
          width: 24px;
          height: 24px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 0;
          border-radius: 6px;
          transition: all 0.15s;
        }
        .tab-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .tab-close:active {
          transform: scale(0.9);
        }
        .add-tab-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #888;
          cursor: pointer;
          border-radius: 10px;
          margin-left: 4px;
          transition: all 0.15s;
        }
        .add-tab-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #fff;
        }
        .add-tab-btn:active {
          transform: scale(0.92);
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 8px;
        }
        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ff6b6b;
          box-shadow: 0 0 8px rgba(255, 107, 107, 0.5);
          transition: all 0.3s;
        }
        .status-dot.connected {
          background: #4ade80;
          box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
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
          bottom: 20px;
          left: 16px;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: rgba(42, 42, 74, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #888;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 100;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .gesture-toggle:hover {
          background: rgba(58, 58, 90, 0.95);
          color: #fff;
        }
        .gesture-toggle:active {
          transform: scale(0.92);
        }
        .gesture-toggle.keyboard-visible {
          bottom: 68px;
        }
        .gesture-toggle.active {
          background: linear-gradient(135deg, rgba(74, 74, 138, 0.95) 0%, rgba(106, 106, 186, 0.95) 100%);
          border-color: rgba(138, 138, 218, 0.5);
          color: #fff;
          box-shadow: 0 4px 16px rgba(74, 74, 138, 0.4);
        }
        .password-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
          animation: fadeIn 0.15s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .password-modal {
          background: linear-gradient(180deg, #1e2a4a 0%, #16213e 100%);
          border-radius: 20px;
          padding: 24px;
          width: 100%;
          max-width: 360px;
          animation: scaleIn 0.2s ease-out;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .password-modal h3 {
          color: #fff;
          margin: 0 0 20px;
          font-size: 1.15rem;
          font-weight: 600;
        }
        .password-modal input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 1rem;
          margin-bottom: 20px;
          transition: all 0.15s;
        }
        .password-modal input:focus {
          outline: none;
          border-color: rgba(138, 180, 248, 0.5);
          background: rgba(0, 0, 0, 0.4);
        }
        .password-modal input::placeholder {
          color: #555;
        }
        .password-modal-actions {
          display: flex;
          gap: 12px;
        }
        .password-modal-actions button {
          flex: 1;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          min-height: 48px;
        }
        .password-modal-actions button:active {
          transform: scale(0.97);
        }
        .btn-cancel {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #888;
        }
        .btn-cancel:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .btn-submit {
          background: linear-gradient(135deg, #4a7cff 0%, #3a6cef 100%);
          border: none;
          color: #fff;
          box-shadow: 0 4px 12px rgba(74, 124, 255, 0.3);
        }
        .btn-submit:hover {
          box-shadow: 0 6px 16px rgba(74, 124, 255, 0.4);
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

