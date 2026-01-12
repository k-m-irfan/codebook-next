'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useConnection } from './ConnectionContext'
import type { OpenFile } from './page'

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
        {activeFile && (
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={saving || !activeFile.isModified}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {/* Editor */}
      <div className="editor-container">
        {activeFile && (
          <MonacoEditor
            key={activeFile.path}
            value={activeFile.content}
            onChange={(content) => onFileChange(activeIndex, content)}
            filename={activeFile.name}
          />
        )}
      </div>

      <style jsx>{`
        .editor-area {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
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
        .save-btn {
          padding: 4px 12px;
          margin: 0 8px;
          background: #4a7c59;
          border: none;
          color: #fff;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          white-space: nowrap;
        }
        .save-btn:hover:not(:disabled) {
          background: #5a8c69;
        }
        .save-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .editor-container {
          flex: 1;
          overflow: hidden;
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
