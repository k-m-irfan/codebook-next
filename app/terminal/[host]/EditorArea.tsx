'use client'

import { useCallback, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useConnection } from './ConnectionContext'
import type { OpenFile } from './page'
import type { editor } from 'monaco-editor'

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

interface EditorAreaProps {
  files: OpenFile[]
  activeIndex: number
  onFileChange: (index: number, content: string) => void
  onFileSaved: (index: number, content: string) => void
  onCloseFile: (index: number) => void
  onSelectFile: (index: number) => void
  host: string
  workspacePath: string
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
}: EditorAreaProps) {
  const { writeFile, connected } = useConnection()
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const activeFile = activeIndex >= 0 && activeIndex < files.length ? files[activeIndex] : null

  const handleSave = useCallback(async () => {
    if (!activeFile) return

    setSaving(true)
    try {
      await writeFile(activeFile.path, activeFile.content)
      onFileSaved(activeIndex, activeFile.content)
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

  // No files open - show welcome screen
  if (files.length === 0) {
    return (
      <div className="welcome-screen">
        <div className="welcome-content">
          <h2>{host}</h2>
          <p className="status">{connected ? 'Connected' : 'Connecting...'}</p>
          {workspacePath ? (
            <p className="workspace">Workspace: {workspacePath}</p>
          ) : (
            <p className="hint">Open the Files panel to select a workspace</p>
          )}
        </div>

        <style jsx>{`
          .welcome-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            background: #1a1a2e;
            padding: 20px;
          }
          .welcome-content {
            text-align: center;
          }
          h2 {
            color: #fff;
            margin: 0 0 8px;
            font-size: 1.5rem;
          }
          .status {
            color: ${connected ? '#6f6' : '#f90'};
            margin: 0 0 16px;
            font-size: 0.9rem;
          }
          .workspace {
            color: #7eb0d5;
            margin: 0;
            font-size: 0.85rem;
            font-family: monospace;
          }
          .hint {
            color: #666;
            margin: 0;
            font-size: 0.9rem;
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

      {/* Editor */}
      <div className="editor-container">
        {activeFile && (
          <MonacoEditor
            key={activeFile.path}
            value={activeFile.content}
            onChange={(content) => onFileChange(activeIndex, content)}
            filename={activeFile.name}
            onEditorMount={handleEditorMount}
          />
        )}

        {/* Floating action buttons - top right */}
        {activeFile && (
          <div className="floating-actions">
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
          </div>
        )}
      </div>

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
          background: #16213e;
          border-bottom: 1px solid #2a2a4a;
          min-height: 36px;
        }
        .tabs {
          flex: 1;
          display: flex;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .tabs::-webkit-scrollbar {
          display: none;
        }
        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #1a1a2e;
          border-right: 1px solid #2a2a4a;
          color: #888;
          cursor: pointer;
          white-space: nowrap;
          font-size: 0.85rem;
          transition: background 0.15s;
        }
        .tab:hover {
          background: #222244;
        }
        .tab.active {
          background: #1e1e1e;
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
        }
        .close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          border-radius: 3px;
          padding: 0;
        }
        .close-btn:hover {
          background: #444;
          color: #fff;
        }
        .editor-container {
          flex: 1;
          overflow: hidden;
          position: relative;
        }
        .floating-actions {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 8px;
          z-index: 100;
        }
        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: rgba(30, 30, 46, 0.9);
          border: 1px solid #3a3a6a;
          color: #aaa;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          backdrop-filter: blur(4px);
        }
        .action-btn:hover:not(:disabled) {
          background: #3a3a6a;
          color: #fff;
        }
        .action-btn:active:not(:disabled) {
          transform: scale(0.95);
        }
        .action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .action-btn.save.modified {
          background: rgba(74, 124, 89, 0.9);
          border-color: #5a8c69;
          color: #fff;
        }
        .action-btn.save.modified:hover:not(:disabled) {
          background: #5a8c69;
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
