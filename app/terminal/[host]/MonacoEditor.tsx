'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface MonacoEditorProps {
  value: string
  onChange: (value: string) => void
  filename: string
  readOnly?: boolean
  onEditorMount?: (editor: editor.IStandaloneCodeEditor) => void
}

// Shared focus state - must be outside component to persist across re-renders and listener instances
const focusState = {
  focusAllowedUntil: 0,
  touchStartPos: { x: 0, y: 0 },
  touchStartTime: 0,
  hasMoved: false,
  listenersAttached: new WeakSet<HTMLElement>()
}

// Get language from filename extension
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    h: 'c',
    hpp: 'cpp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    md: 'markdown',
    markdown: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    kts: 'kotlin',
    scala: 'scala',
    r: 'r',
    lua: 'lua',
    perl: 'perl',
    pl: 'perl',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmake: 'cmake',
    toml: 'toml',
    ini: 'ini',
    conf: 'ini',
    env: 'ini',
    gitignore: 'ignore',
    dockerignore: 'ignore',
  }

  // Handle special filenames
  const lowerFilename = filename.toLowerCase()
  if (lowerFilename === 'dockerfile') return 'dockerfile'
  if (lowerFilename === 'makefile') return 'makefile'
  if (lowerFilename.startsWith('.env')) return 'ini'
  if (lowerFilename === '.gitignore' || lowerFilename === '.dockerignore') return 'ignore'

  return languageMap[ext || ''] || 'plaintext'
}

export default function MonacoEditor({
  value,
  onChange,
  filename,
  readOnly = false,
  onEditorMount
}: MonacoEditorProps) {
  const language = getLanguage(filename)
  const editorInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(14)

  // Pinch state refs for event handlers (refs don't have stale closure issues)
  const pinchRef = useRef({
    initialDistance: 0,
    initialFontSize: 14,
  })
  const fontSizeRef = useRef(14)

  const MIN_FONT_SIZE = 8
  const MAX_FONT_SIZE = 32

  const getPinchDistance = (touches: TouchList | Touch[]) => {
    const t = Array.from(touches)
    const dx = t[0].clientX - t[1].clientX
    const dy = t[0].clientY - t[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Keep fontSizeRef in sync
  useEffect(() => {
    fontSizeRef.current = fontSize
  }, [fontSize])

  // Handle pinch gestures on the container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let isPinchActive = false

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        isPinchActive = true
        pinchRef.current.initialDistance = getPinchDistance(e.touches)
        pinchRef.current.initialFontSize = fontSizeRef.current
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isPinchActive && e.touches.length === 2) {
        e.preventDefault()
        const currentDistance = getPinchDistance(e.touches)
        const scale = currentDistance / pinchRef.current.initialDistance

        // Calculate new font size
        const projectedFontSize = pinchRef.current.initialFontSize * scale
        const newFontSize = Math.round(projectedFontSize)
        const clampedFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newFontSize))

        // If font size changed, apply it immediately and reset baseline for continuous zoom
        if (clampedFontSize !== fontSizeRef.current) {
          fontSizeRef.current = clampedFontSize
          setFontSize(clampedFontSize)

          // Update Monaco editor immediately
          if (editorInstanceRef.current) {
            editorInstanceRef.current.updateOptions({ fontSize: clampedFontSize })
          }

          // Reset baseline for next step - this makes zoom continuous
          pinchRef.current.initialDistance = currentDistance
          pinchRef.current.initialFontSize = clampedFontSize
        }
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (isPinchActive) {
        isPinchActive = false
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, []) // No dependencies - handlers use refs

  const handleEditorDidMount = useCallback((editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorInstanceRef.current = editorInstance

    const domNode = editorInstance.getDomNode()
    if (!domNode) return

    // Prevent duplicate listeners using WeakSet
    if (focusState.listenersAttached.has(domNode)) {
      if (onEditorMount) onEditorMount(editorInstance)
      return
    }
    focusState.listenersAttached.add(domNode)

    // Reset state for fresh start
    focusState.focusAllowedUntil = 0
    focusState.hasMoved = false

    domNode.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        focusState.touchStartPos = { x: touch.clientX, y: touch.clientY }
        focusState.touchStartTime = Date.now()
        focusState.hasMoved = false
        focusState.focusAllowedUntil = 0
      }
    }, { passive: true })

    domNode.addEventListener('touchmove', (e) => {
      if (focusState.hasMoved) return
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        const dx = Math.abs(touch.clientX - focusState.touchStartPos.x)
        const dy = Math.abs(touch.clientY - focusState.touchStartPos.y)
        if (dx > 8 || dy > 8) {
          focusState.hasMoved = true
          focusState.focusAllowedUntil = 0
        }
      }
    }, { passive: true })

    domNode.addEventListener('touchend', () => {
      const duration = Date.now() - focusState.touchStartTime
      const isTap = !focusState.hasMoved && duration < 300

      if (isTap) {
        focusState.focusAllowedUntil = Date.now() + 300
        const ta = domNode.querySelector('textarea') as HTMLTextAreaElement | null
        if (ta) ta.focus()
      }
    }, { passive: true })

    // Use focusin with capture to intercept ALL focus attempts
    domNode.addEventListener('focusin', (e) => {
      if (e.target instanceof HTMLTextAreaElement) {
        if (Date.now() > focusState.focusAllowedUntil) {
          (e.target as HTMLTextAreaElement).blur()
        }
      }
    }, { capture: true })

    if (onEditorMount) {
      onEditorMount(editorInstance)
    }
  }, [onEditorMount])

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        width: '100%',
        position: 'relative',
        touchAction: 'pan-x pan-y',
      }}
    >
      <Editor
          height="100%"
          language={language}
          value={value}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: fontSize,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 10 },
          }}
          loading={
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              background: '#1e1e1e',
              color: '#888',
            }}>
              Loading editor...
            </div>
          }
        />
    </div>
  )
}
