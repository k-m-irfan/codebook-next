'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useConnection } from './ConnectionContext'
import type { OpenFile } from './page'
import type { editor } from 'monaco-editor'
import QuickKeysPanel, { QuickKeysPanelRef } from './QuickKeysPanel'

const MonacoEditor = dynamic(() => import('./MonacoEditor'), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
      Loading editor...
      <style jsx>{`
        .editor-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: #1e1e1e;
          color: #888;
        }
      `}</style>
    </div>
  ),
})

const ImagePreview = dynamic(() => import('./previews/ImagePreview'), {
  ssr: false,
  loading: () => <PreviewLoading />,
})

const VideoPreview = dynamic(() => import('./previews/VideoPreview'), {
  ssr: false,
  loading: () => <PreviewLoading />,
})

const PdfPreview = dynamic(() => import('./previews/PdfPreview'), {
  ssr: false,
  loading: () => <PreviewLoading />,
})

const NotebookPreview = dynamic(() => import('./previews/NotebookPreview'), {
  ssr: false,
  loading: () => <PreviewLoading />,
})

function PreviewLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: '#0d0d1a',
      color: '#888',
    }}>
      Loading preview...
    </div>
  )
}

interface EditorAreaProps {
  files: OpenFile[]
  activeIndex: number
  onFileChange: (index: number, content: string) => void
  onFileSaved: (index: number, content: string) => void
  onCloseFile: (index: number) => void
  onSelectFile: (index: number) => void
  host: string
  workspacePath: string
  keyboardVisible?: boolean
}

export default function EditorArea({
  files,
  activeIndex,
  onFileChange,
  onFileSaved,
  onCloseFile,
  onSelectFile,
  host,
  workspacePath,
  keyboardVisible = false,
}: EditorAreaProps) {
  const { writeFile, connected } = useConnection()
  const [saving, setSaving] = useState(false)
  const [actionsExpanded, setActionsExpanded] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const quickKeyModifiersRef = useRef({ ctrl: false, alt: false, shift: false })
  const quickKeysPanelRef = useRef<QuickKeysPanelRef>(null)

  const activeFile = activeIndex >= 0 && activeIndex < files.length ? files[activeIndex] : null

  // Force Monaco editor to re-layout when keyboard visibility changes
  // and scroll cursor into view
  useEffect(() => {
    if (editorRef.current) {
      // Small delay to allow DOM to update first
      const timer = setTimeout(() => {
        if (editorRef.current) {
          // Re-layout the editor
          editorRef.current.layout()

          // If keyboard just became visible, scroll cursor into view
          if (keyboardVisible) {
            const position = editorRef.current.getPosition()
            if (position) {
              // Reveal the cursor position, scrolling if needed
              editorRef.current.revealPositionInCenter(position)
            }
          }
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [keyboardVisible])

  const handleSave = useCallback(async () => {
    if (!activeFile) return

    setSaving(true)
    try {
      await writeFile(activeFile.path, activeFile.content)
      onFileSaved(activeIndex, activeFile.content)
      setActionsExpanded(false)
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }, [activeFile, activeIndex, writeFile, onFileSaved])

  const handleUndo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'undo', null)
    }
  }, [])

  const handleRedo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'redo', null)
    }
  }, [])

  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
  }, [])

  const handleSearch = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'actions.find', null)
    }
    setActionsExpanded(false)
  }, [])

  const toggleActions = useCallback(() => {
    setActionsExpanded(prev => !prev)
  }, [])

  // Handler for quick key modifier changes
  const handleModifierChange = useCallback((mods: { ctrl: boolean; alt: boolean; shift: boolean }) => {
    quickKeyModifiersRef.current = mods
  }, [])

  // Handle keyboard input with modifiers for editor
  // Use beforeinput for mobile compatibility (mobile doesn't fire keydown reliably)
  useEffect(() => {
    if (!keyboardVisible) return

    const handleBeforeInput = (e: InputEvent) => {
      const mods = quickKeyModifiersRef.current
      if (!mods.ctrl && !mods.alt && !mods.shift) return
      if (!editorRef.current) return
      if (!e.data) return // No data to process

      const editor = editorRef.current
      const inputText = e.data

      // Handle Ctrl+key combinations
      if (mods.ctrl && inputText.length === 1) {
        e.preventDefault()

        const lowerKey = inputText.toLowerCase()

        // Map common Ctrl shortcuts to Monaco actions
        switch (lowerKey) {
          case 'a': editor.trigger('keyboard', 'editor.action.selectAll', null); break
          case 'c': editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null); break
          case 'v': editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null); break
          case 'x': editor.trigger('keyboard', 'editor.action.clipboardCutAction', null); break
          case 'z': editor.trigger('keyboard', 'undo', null); break
          case 'y': editor.trigger('keyboard', 'redo', null); break
          case 'f': editor.trigger('keyboard', 'actions.find', null); break
          case 's': handleSave(); break
          case 'd': editor.trigger('keyboard', 'editor.action.addSelectionToNextFindMatch', null); break
          default: break
        }

        // Clear modifiers after use (both ref and visual)
        quickKeyModifiersRef.current = { ctrl: false, alt: false, shift: false }
        quickKeysPanelRef.current?.resetModifiers()
        return
      }

      // Handle Alt+key - insert character with alt modifier behavior
      if (mods.alt && inputText.length === 1) {
        e.preventDefault()
        editor.trigger('keyboard', 'type', { text: inputText })
        quickKeyModifiersRef.current = { ctrl: false, alt: false, shift: false }
        quickKeysPanelRef.current?.resetModifiers()
        return
      }

      // Handle Shift+key - insert uppercase or shifted character
      if (mods.shift && inputText.length === 1) {
        e.preventDefault()
        editor.trigger('keyboard', 'type', { text: inputText.toUpperCase() })
        quickKeyModifiersRef.current = { ctrl: false, alt: false, shift: false }
        quickKeysPanelRef.current?.resetModifiers()
        return
      }
    }

    // Capture at document level to intercept before Monaco
    document.addEventListener('beforeinput', handleBeforeInput as EventListener, true)
    return () => document.removeEventListener('beforeinput', handleBeforeInput as EventListener, true)
  }, [keyboardVisible, handleSave])

  // Handler for quick keys panel in editor
  const handleQuickKeyPress = useCallback((key: string) => {
    if (!editorRef.current) return

    const editor = editorRef.current

    // Handle special keys
    switch (key) {
      case '\x1b': // Escape
        editor.trigger('keyboard', 'closeFindWidget', null)
        return
      case '\x01': // Ctrl+A / Home - beginning of line
        editor.trigger('keyboard', 'cursorHome', null)
        return
      case '\x05': // Ctrl+E / End - end of line
        editor.trigger('keyboard', 'cursorEnd', null)
        return
      case '\x1b[5~': // Page Up
        editor.trigger('keyboard', 'cursorPageUp', null)
        return
      case '\x1b[6~': // Page Down
        editor.trigger('keyboard', 'cursorPageDown', null)
        return
      case '\t': // Tab - insert tab or trigger autocomplete
        editor.trigger('keyboard', 'tab', null)
        return
    }

    // For regular characters, insert them at cursor position
    editor.trigger('keyboard', 'type', { text: key })
  }, [])

  // No files open - show welcome screen
  if (files.length === 0) {
    return (
      <div className="welcome-screen">
        <div className="welcome-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <h2 className="welcome-title">{host === 'local' ? 'Local' : host}</h2>
        <div className="status-badge">
          <span className={`status-dot ${connected ? 'connected' : ''}`} />
          {connected ? 'Connected' : 'Connecting...'}
        </div>
        {workspacePath ? (
          <p className="workspace">{workspacePath}</p>
        ) : (
          <p className="hint">Open the Files panel to browse and edit files</p>
        )}

        <style jsx>{`
          .welcome-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            background: linear-gradient(180deg, #1a1a2e 0%, #0f0f23 100%);
            padding: 24px;
          }
          .welcome-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 80px;
            height: 80px;
            background: rgba(138, 180, 248, 0.1);
            border-radius: 20px;
            color: #8ab4f8;
            margin-bottom: 20px;
          }
          .welcome-title {
            color: #fff;
            margin: 0 0 12px;
            font-size: 1.5rem;
            font-weight: 600;
          }
          .status-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 20px;
            color: #888;
            font-size: 0.85rem;
            margin-bottom: 20px;
          }
          .status-dot {
            width: 8px;
            height: 8px;
            background: #f90;
            border-radius: 50%;
          }
          .status-dot.connected {
            background: #4ade80;
          }
          .workspace {
            color: #8ab4f8;
            margin: 0;
            font-size: 0.85rem;
            font-family: 'SF Mono', Monaco, monospace;
            padding: 8px 16px;
            background: rgba(138, 180, 248, 0.1);
            border-radius: 8px;
          }
          .hint {
            color: #666;
            margin: 0;
            font-size: 0.9rem;
            text-align: center;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="editor-area">
      {/* Tab bar */}
      <div className="tab-bar">
        <div className="tabs">
          {files.map((file, index) => (
            <div
              key={file.path}
              className={`tab ${index === activeIndex ? 'active' : ''}`}
              onClick={() => onSelectFile(index)}
            >
              <span className="tab-name">
                {file.isModified && <span className="modified-dot" />}
                {file.fileType !== 'text' && <FileTypeIcon type={file.fileType} />}
                {file.name}
              </span>
              <button
                className="close-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseFile(index)
                }}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="editor-container">
        {activeFile && (
          activeFile.fileType === 'image' ? (
            <ImagePreview
              key={activeFile.path}
              content={activeFile.content}
              filename={activeFile.name}
              encoding={activeFile.encoding}
            />
          ) : activeFile.fileType === 'video' ? (
            <VideoPreview
              key={activeFile.path}
              content={activeFile.content}
              filename={activeFile.name}
              encoding={activeFile.encoding}
            />
          ) : activeFile.fileType === 'pdf' ? (
            <PdfPreview
              key={activeFile.path}
              content={activeFile.content}
              filename={activeFile.name}
              encoding={activeFile.encoding}
            />
          ) : activeFile.fileType === 'notebook' ? (
            <NotebookPreview
              key={activeFile.path}
              content={activeFile.content}
              filename={activeFile.name}
            />
          ) : (
            <MonacoEditor
              key={activeFile.path}
              value={activeFile.content}
              onChange={(content) => onFileChange(activeIndex, content)}
              filename={activeFile.name}
              onEditorMount={handleEditorMount}
            />
          )
        )}

        {/* Collapsible floating action buttons - bottom right (only for text files) */}
        {activeFile && activeFile.fileType === 'text' && (
          <div
            className={`floating-actions ${actionsExpanded ? 'expanded' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
          >
            {actionsExpanded ? (
              <>
                <button
                  className="action-btn"
                  onClick={handleSearch}
                  title="Search"
                >
                  <SearchIcon />
                </button>
                <button
                  className="action-btn"
                  onClick={handleUndo}
                  title="Undo"
                >
                  <UndoIcon />
                </button>
                <button
                  className="action-btn"
                  onClick={handleRedo}
                  title="Redo"
                >
                  <RedoIcon />
                </button>
                <button
                  className={`action-btn save ${activeFile.isModified ? 'modified' : ''}`}
                  onClick={handleSave}
                  disabled={saving || !activeFile.isModified}
                  title="Save"
                >
                  {saving ? <LoadingIcon /> : <SaveIcon />}
                </button>
                <button
                  className="action-btn toggle"
                  onClick={toggleActions}
                  title="Collapse"
                >
                  <CollapseIcon />
                </button>
              </>
            ) : (
              <button
                className="action-btn toggle"
                onClick={toggleActions}
                title="Expand actions"
              >
                <MenuIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick keys panel - shown when keyboard is visible */}
      {keyboardVisible && (
        <QuickKeysPanel ref={quickKeysPanelRef} onKeyPress={handleQuickKeyPress} onModifierChange={handleModifierChange} />
      )}

      <style jsx>{`
        .editor-area {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
          position: relative;
        }
        .tab-bar {
          display: flex;
          align-items: center;
          background: rgba(22, 33, 62, 0.95);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          min-height: 44px;
          padding: 0 4px;
        }
        .tabs {
          flex: 1;
          display: flex;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          gap: 4px;
          padding: 4px 0;
        }
        .tabs::-webkit-scrollbar {
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
          color: #888;
          cursor: pointer;
          white-space: nowrap;
          font-size: 0.85rem;
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
        .tab-name {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .modified-dot {
          width: 8px;
          height: 8px;
          background: #f90;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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
          border-radius: 6px;
          padding: 0;
          transition: all 0.15s;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .close-btn:active {
          transform: scale(0.9);
        }
        .editor-container {
          flex: 1;
          overflow: hidden;
          position: relative;
        }
        .floating-actions {
          position: absolute;
          right: 16px;
          bottom: 20px;
          display: flex;
          gap: 8px;
          z-index: 100;
          padding: 6px;
          background: rgba(22, 33, 62, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: all 0.2s ease;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .floating-actions:not(.expanded) {
          padding: 0;
          background: transparent;
          border-color: transparent;
          box-shadow: none;
        }
        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #aaa;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .floating-actions.expanded .action-btn {
          background: transparent;
          border-color: transparent;
        }
        .action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .action-btn:active:not(:disabled) {
          transform: scale(0.92);
        }
        .action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .action-btn.save.modified {
          background: linear-gradient(135deg, rgba(74, 124, 89, 0.9) 0%, rgba(60, 110, 75, 0.9) 100%);
          border-color: rgba(74, 124, 89, 0.5);
          color: #fff;
          box-shadow: 0 4px 12px rgba(74, 124, 89, 0.3);
        }
        .action-btn.save.modified:hover:not(:disabled) {
          box-shadow: 0 6px 16px rgba(74, 124, 89, 0.4);
        }
        .action-btn.toggle {
          color: #888;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .action-btn.toggle:hover {
          color: #fff;
        }
      `}</style>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}

function LoadingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function FileTypeIcon({ type }: { type: string }) {
  const iconStyle = { marginRight: '4px', flexShrink: 0 }

  switch (type) {
    case 'image':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" style={iconStyle}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    case 'video':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2" style={iconStyle}>
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      )
    case 'pdf':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={iconStyle}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    case 'notebook':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" style={iconStyle}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )
    default:
      return null
  }
}
