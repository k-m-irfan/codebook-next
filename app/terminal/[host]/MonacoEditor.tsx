'use client'

import { useRef, useCallback } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface MonacoEditorProps {
  value: string
  onChange: (value: string) => void
  filename: string
  readOnly?: boolean
  onEditorMount?: (editor: editor.IStandaloneCodeEditor) => void
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
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const isScrollingRef = useRef(false)

  const handleEditorDidMount = useCallback((editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorInstanceRef.current = editorInstance

    // Blur editor initially to prevent keyboard on load
    const domNode = editorInstance.getDomNode()
    if (domNode) {
      // Prevent focus on touch move (scrolling)
      domNode.addEventListener('touchstart', (e) => {
        const touch = e.touches[0]
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
        isScrollingRef.current = false
      }, { passive: true })

      domNode.addEventListener('touchmove', () => {
        isScrollingRef.current = true
        // Blur if scrolling to prevent keyboard
        if (document.activeElement && domNode.contains(document.activeElement)) {
          (document.activeElement as HTMLElement).blur?.()
        }
      }, { passive: true })

      domNode.addEventListener('touchend', (e) => {
        // Only allow focus if it was a tap (not scroll)
        if (isScrollingRef.current) {
          e.preventDefault()
          const textarea = domNode.querySelector('textarea')
          if (textarea) {
            textarea.blur()
          }
        }
        touchStartRef.current = null
      })
    }

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
