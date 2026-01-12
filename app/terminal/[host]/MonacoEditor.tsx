'use client'

import { useRef, useCallback, useEffect } from 'react'
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
      const touch = e.touches[0]
      focusState.touchStartPos = { x: touch.clientX, y: touch.clientY }
      focusState.touchStartTime = Date.now()
      focusState.hasMoved = false
      focusState.focusAllowedUntil = 0
    }, { passive: true })

    domNode.addEventListener('touchmove', (e) => {
      if (focusState.hasMoved) return
      const touch = e.touches[0]
      const dx = Math.abs(touch.clientX - focusState.touchStartPos.x)
      const dy = Math.abs(touch.clientY - focusState.touchStartPos.y)
      if (dx > 8 || dy > 8) {
        focusState.hasMoved = true
        focusState.focusAllowedUntil = 0
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
          fontSize: 14,
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
  )
}
