'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useConnection } from './ConnectionContext'
import type { FileEntry } from '@/lib/file-protocol'

const MonacoEditor = dynamic(() => import('./MonacoEditor'), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
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
      Loading editor...
    </div>
  ),
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileExplorer() {
  const { host, listFiles, readFile, writeFile, createFile, deleteFile, renameFile } = useConnection()

  const [currentPath, setCurrentPath] = useState<string>('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [originalContent, setOriginalContent] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [dialogInput, setDialogInput] = useState('')
  const [createIsDirectory, setCreateIsDirectory] = useState(false)
  const [contextEntry, setContextEntry] = useState<FileEntry | null>(null)

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const files = await listFiles(path)
      setEntries(
        files.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      )
      setCurrentPath(path)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [listFiles])

  // Open file in editor
  const openFile = useCallback(async (entry: FileEntry) => {
    if (entry.isDirectory) {
      loadDirectory(entry.path)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { content } = await readFile(entry.path)
      setSelectedFile(entry)
      setFileContent(content)
      setOriginalContent(content)
      setIsEditing(true)
    } catch (err: any) {
      setError(`Failed to open file: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [readFile, loadDirectory])

  // Save file
  const saveFile = useCallback(async () => {
    if (!selectedFile) return

    setSaving(true)
    try {
      await writeFile(selectedFile.path, fileContent)
      setOriginalContent(fileContent)
      setError(null)
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }, [selectedFile, fileContent, writeFile])

  // Navigate up
  const goUp = useCallback(() => {
    if (!currentPath || currentPath === '/') return
    const parts = currentPath.split('/')
    parts.pop()
    const parentPath = parts.join('/') || '/'
    loadDirectory(parentPath)
  }, [currentPath, loadDirectory])

  // Open folder - start browsing
  const openFolder = useCallback(() => {
    const defaultPath = host === 'local' ? '/' : '/home'
    loadDirectory(defaultPath)
  }, [host, loadDirectory])

  // Create new file/folder
  const handleCreate = useCallback(async () => {
    if (!dialogInput.trim()) return

    const newPath = currentPath === '/'
      ? `/${dialogInput}`
      : `${currentPath}/${dialogInput}`

    try {
      await createFile(newPath, createIsDirectory)
      setShowCreateDialog(false)
      setDialogInput('')
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Failed to create: ${err.message}`)
    }
  }, [currentPath, dialogInput, createIsDirectory, createFile, loadDirectory])

  // Rename file/folder
  const handleRename = useCallback(async () => {
    if (!contextEntry || !dialogInput.trim()) return

    const parentPath = contextEntry.path.substring(0, contextEntry.path.lastIndexOf('/'))
    const newPath = parentPath ? `${parentPath}/${dialogInput}` : `/${dialogInput}`

    try {
      await renameFile(contextEntry.path, newPath)
      setShowRenameDialog(false)
      setDialogInput('')
      setContextEntry(null)
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Failed to rename: ${err.message}`)
    }
  }, [contextEntry, dialogInput, renameFile, currentPath, loadDirectory])

  // Delete file/folder
  const handleDelete = useCallback(async () => {
    if (!contextEntry) return

    try {
      await deleteFile(contextEntry.path, contextEntry.isDirectory)
      setShowDeleteDialog(false)
      setContextEntry(null)
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Failed to delete: ${err.message}`)
    }
  }, [contextEntry, deleteFile, currentPath, loadDirectory])

  // Context menu for file operations
  const showContextMenu = (entry: FileEntry) => {
    setContextEntry(entry)
    setDialogInput(entry.name)
  }

  const hasChanges = fileContent !== originalContent

  // If no path selected, show "Open Folder" button
  if (!currentPath) {
    return (
      <div className="file-explorer empty">
        <button className="open-folder-btn" onClick={openFolder}>
          <FolderOpenIcon />
          <span>Open Folder</span>
        </button>
        <p className="hint">Select a folder to browse files</p>

        <style jsx>{`
          .file-explorer.empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            background: #1a1a2e;
          }
          .open-folder-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            padding: 32px 48px;
            background: #16213e;
            border: 2px dashed #3a3a5a;
            border-radius: 12px;
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
          }
          .open-folder-btn:hover {
            background: #1f2847;
            border-color: #5a5a8a;
          }
          .hint {
            margin-top: 16px;
            color: #666;
            font-size: 0.9rem;
          }
        `}</style>
      </div>
    )
  }

  // File editing view
  if (isEditing && selectedFile) {
    return (
      <div className="file-editor">
        <div className="editor-header">
          <button className="back-btn" onClick={() => setIsEditing(false)}>
            <BackIcon />
          </button>
          <span className="file-name">
            {selectedFile.name}
            {hasChanges && <span className="unsaved">*</span>}
          </span>
          <button
            className="save-btn"
            onClick={saveFile}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {error && <div className="error-bar">{error}</div>}
        <div className="editor-container">
          <MonacoEditor
            value={fileContent}
            onChange={setFileContent}
            filename={selectedFile.name}
          />
        </div>

        <style jsx>{`
          .file-editor {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: #1a1a2e;
            padding-bottom: 60px;
          }
          .editor-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: #0f0f23;
            border-bottom: 1px solid #2a2a4a;
          }
          .back-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            background: #2a2a4a;
            border: none;
            color: #fff;
            border-radius: 6px;
            cursor: pointer;
          }
          .back-btn:hover {
            background: #3a3a6a;
          }
          .file-name {
            flex: 1;
            color: #fff;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .unsaved {
            color: #f90;
            margin-left: 4px;
          }
          .save-btn {
            background: #4a7c59;
            border: none;
            color: #fff;
            padding: 8px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          }
          .save-btn:hover:not(:disabled) {
            background: #5a8c69;
          }
          .save-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .error-bar {
            padding: 8px 16px;
            background: #cc3333;
            color: #fff;
            font-size: 0.85rem;
          }
          .editor-container {
            flex: 1;
            overflow: hidden;
          }
        `}</style>
      </div>
    )
  }

  // File browser view
  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <button className="nav-btn" onClick={goUp} disabled={currentPath === '/'}>
          <UpIcon />
        </button>
        <div className="path-breadcrumb">{currentPath || '/'}</div>
        <button
          className="action-btn"
          onClick={() => {
            setShowCreateDialog(true)
            setDialogInput('')
            setCreateIsDirectory(false)
          }}
        >
          <PlusIcon />
        </button>
      </div>

      {error && <div className="error-bar">{error}</div>}
      {loading && <div className="loading-bar">Loading...</div>}

      <div className="file-list">
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`file-item ${entry.isDirectory ? 'directory' : 'file'}`}
            onClick={() => openFile(entry)}
          >
            <div className="file-icon">
              {entry.isDirectory ? <FolderIcon /> : <FileIcon />}
            </div>
            <span className="name">{entry.name}</span>
            {!entry.isDirectory && <span className="size">{formatSize(entry.size)}</span>}
            <button
              className="more-btn"
              onClick={(e) => {
                e.stopPropagation()
                showContextMenu(entry)
              }}
            >
              <MoreIcon />
            </button>
          </div>
        ))}
        {entries.length === 0 && !loading && (
          <div className="empty-message">This folder is empty</div>
        )}
      </div>

      {/* Context menu for selected entry */}
      {contextEntry && (
        <div className="context-overlay" onClick={() => setContextEntry(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-header">{contextEntry.name}</div>
            <button
              onClick={() => {
                setShowRenameDialog(true)
                setDialogInput(contextEntry.name)
              }}
            >
              Rename
            </button>
            <button
              className="danger"
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete
            </button>
            <button onClick={() => setContextEntry(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      {showCreateDialog && (
        <div className="dialog-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Create New</h3>
            <div className="dialog-type-toggle">
              <button
                className={!createIsDirectory ? 'active' : ''}
                onClick={() => setCreateIsDirectory(false)}
              >
                File
              </button>
              <button
                className={createIsDirectory ? 'active' : ''}
                onClick={() => setCreateIsDirectory(true)}
              >
                Folder
              </button>
            </div>
            <input
              type="text"
              placeholder={createIsDirectory ? 'Folder name' : 'File name'}
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="dialog-buttons">
              <button onClick={() => setShowCreateDialog(false)}>Cancel</button>
              <button className="primary" onClick={handleCreate}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {showRenameDialog && (
        <div className="dialog-overlay" onClick={() => setShowRenameDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Rename</h3>
            <input
              type="text"
              placeholder="New name"
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="dialog-buttons">
              <button onClick={() => setShowRenameDialog(false)}>Cancel</button>
              <button className="primary" onClick={handleRename}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="dialog-overlay" onClick={() => setShowDeleteDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {contextEntry?.isDirectory ? 'Folder' : 'File'}</h3>
            <p>Are you sure you want to delete "{contextEntry?.name}"?</p>
            <div className="dialog-buttons">
              <button onClick={() => setShowDeleteDialog(false)}>Cancel</button>
              <button className="danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .file-explorer {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1a1a2e;
          padding-bottom: 60px;
        }
        .explorer-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #0f0f23;
          border-bottom: 1px solid #2a2a4a;
        }
        .nav-btn,
        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: #2a2a4a;
          border: none;
          color: #fff;
          border-radius: 6px;
          cursor: pointer;
        }
        .nav-btn:hover:not(:disabled),
        .action-btn:hover {
          background: #3a3a6a;
        }
        .nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .path-breadcrumb {
          flex: 1;
          color: #aaa;
          font-size: 0.9rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .error-bar {
          padding: 8px 16px;
          background: #cc3333;
          color: #fff;
          font-size: 0.85rem;
        }
        .loading-bar {
          padding: 8px 16px;
          background: #2a2a4a;
          color: #888;
          font-size: 0.85rem;
          text-align: center;
        }
        .file-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        .file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          margin: 4px 0;
          background: #16213e;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .file-item:hover {
          background: #1f2847;
        }
        .file-item:active {
          background: #2a3352;
        }
        .file-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #888;
        }
        .directory .file-icon {
          color: #7eb0d5;
        }
        .name {
          flex: 1;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .directory .name {
          color: #7eb0d5;
        }
        .size {
          color: #666;
          font-size: 0.8rem;
        }
        .more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: none;
          border: none;
          color: #666;
          border-radius: 4px;
          cursor: pointer;
        }
        .more-btn:hover {
          background: #2a2a4a;
          color: #fff;
        }
        .empty-message {
          text-align: center;
          color: #666;
          padding: 40px 20px;
        }

        /* Context menu overlay */
        .context-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 200;
        }
        .context-menu {
          width: 100%;
          max-width: 400px;
          background: #16213e;
          border-radius: 12px 12px 0 0;
          padding: 16px;
          padding-bottom: max(16px, env(safe-area-inset-bottom));
        }
        .context-header {
          padding: 8px 16px;
          color: #888;
          font-size: 0.85rem;
          border-bottom: 1px solid #2a2a4a;
          margin-bottom: 8px;
        }
        .context-menu button {
          display: block;
          width: 100%;
          padding: 14px 16px;
          background: none;
          border: none;
          color: #fff;
          text-align: left;
          font-size: 1rem;
          cursor: pointer;
          border-radius: 8px;
        }
        .context-menu button:hover {
          background: #2a2a4a;
        }
        .context-menu button.danger {
          color: #f66;
        }

        /* Dialog styles */
        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 20px;
        }
        .dialog {
          width: 100%;
          max-width: 360px;
          background: #16213e;
          border-radius: 12px;
          padding: 20px;
        }
        .dialog h3 {
          margin: 0 0 16px;
          color: #fff;
          font-size: 1.1rem;
        }
        .dialog p {
          color: #aaa;
          margin: 0 0 16px;
          font-size: 0.9rem;
        }
        .dialog input {
          width: 100%;
          padding: 12px;
          background: #0f0f23;
          border: 1px solid #2a2a4a;
          border-radius: 6px;
          color: #fff;
          font-size: 1rem;
        }
        .dialog input:focus {
          outline: none;
          border-color: #4a4a8a;
        }
        .dialog-type-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .dialog-type-toggle button {
          flex: 1;
          padding: 8px;
          background: #0f0f23;
          border: 1px solid #2a2a4a;
          color: #888;
          border-radius: 6px;
          cursor: pointer;
        }
        .dialog-type-toggle button.active {
          background: #2a2a4a;
          color: #fff;
          border-color: #4a4a8a;
        }
        .dialog-buttons {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }
        .dialog-buttons button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 6px;
          font-size: 0.95rem;
          cursor: pointer;
          background: #2a2a4a;
          color: #fff;
        }
        .dialog-buttons button:hover {
          background: #3a3a6a;
        }
        .dialog-buttons button.primary {
          background: #4a7c59;
        }
        .dialog-buttons button.primary:hover {
          background: #5a8c69;
        }
        .dialog-buttons button.danger {
          background: #a03030;
        }
        .dialog-buttons button.danger:hover {
          background: #c04040;
        }
      `}</style>
    </div>
  )
}

// Icons
function FolderOpenIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function UpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}
