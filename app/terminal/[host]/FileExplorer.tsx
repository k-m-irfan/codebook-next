'use client'

import { useState, useCallback, useEffect } from 'react'
import { useConnection } from './ConnectionContext'
import type { FileEntry } from '@/lib/file-protocol'

interface FileExplorerProps {
  workspacePath: string
  isFullscreen: boolean
  onSelectWorkspace: (path: string) => void
  onOpenFile: (path: string, name: string, content: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileExplorer({
  workspacePath,
  isFullscreen,
  onSelectWorkspace,
  onOpenFile,
}: FileExplorerProps) {
  const { host, listFiles, readFile, createFile, deleteFile, renameFile } = useConnection()

  const [currentPath, setCurrentPath] = useState<string>(workspacePath || '')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [dialogInput, setDialogInput] = useState('')
  const [createIsDirectory, setCreateIsDirectory] = useState(false)
  const [contextEntry, setContextEntry] = useState<FileEntry | null>(null)

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    console.log('FileExplorer: loadDirectory called with path:', path || '(empty)')
    setLoading(true)
    setError(null)
    try {
      const files = await listFiles(path)
      console.log('FileExplorer: received', files.length, 'files')
      setEntries(
        files.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      )
      setCurrentPath(path || '/') // Use '/' as display path if empty
    } catch (err: any) {
      console.error('FileExplorer: loadDirectory error:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [listFiles])

  // Load workspace path on mount or when it changes
  useEffect(() => {
    if (workspacePath) {
      loadDirectory(workspacePath)
    }
  }, [workspacePath, loadDirectory])

  // Open file handler
  const handleFileClick = useCallback(async (entry: FileEntry) => {
    if (entry.isDirectory) {
      loadDirectory(entry.path)
      return
    }

    // Read file and open in editor
    setLoading(true)
    try {
      const { content } = await readFile(entry.path)
      onOpenFile(entry.path, entry.name, content)
    } catch (err: any) {
      setError(`Failed to open file: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [loadDirectory, readFile, onOpenFile])

  // Navigate up
  const goUp = useCallback(() => {
    if (!currentPath || currentPath === '/') return
    const parts = currentPath.split('/')
    parts.pop()
    const parentPath = parts.join('/') || '/'
    loadDirectory(parentPath)
  }, [currentPath, loadDirectory])

  // Open initial folder
  const openFolder = useCallback(() => {
    // For local, use empty string which tells server to use homedir
    // For remote SSH hosts, start at /home
    const defaultPath = host === 'local' ? '' : '/home'
    console.log('FileExplorer: openFolder called, defaultPath:', defaultPath || '(homedir)')
    loadDirectory(defaultPath)
  }, [host, loadDirectory])

  // Select current folder as workspace
  const selectThisFolder = useCallback(() => {
    if (currentPath) {
      onSelectWorkspace(currentPath)
    }
  }, [currentPath, onSelectWorkspace])

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

  // If no path, show "Open Folder" prompt
  if (!currentPath) {
    return (
      <div className="explorer-empty">
        <button className="open-folder-btn" onClick={openFolder}>
          <FolderOpenIcon />
          <span>Open Folder</span>
        </button>
        <p className="hint">Browse files on {host}</p>

        <style jsx>{`
          .explorer-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 20px;
          }
          .open-folder-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            padding: 24px 36px;
            background: #1a1a2e;
            border: 2px dashed #3a3a5a;
            border-radius: 10px;
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
          }
          .open-folder-btn:hover {
            background: #222244;
            border-color: #5a5a8a;
          }
          .hint {
            margin-top: 12px;
            color: #666;
            font-size: 0.85rem;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="file-explorer">
      {/* Header */}
      <div className="explorer-header">
        <button className="icon-btn" onClick={goUp} disabled={currentPath === '/'} title="Go up">
          <UpIcon />
        </button>
        <div className="header-spacer" />
        <button
          className="icon-btn"
          onClick={() => {
            setShowCreateDialog(true)
            setDialogInput('')
            setCreateIsDirectory(false)
          }}
          title="New file/folder"
        >
          <PlusIcon />
        </button>
        <button className="select-folder-btn" onClick={selectThisFolder}>
          Select Folder
        </button>
      </div>

      {/* Path */}
      <div className="path-bar">{currentPath}</div>

      {error && <div className="error-bar">{error}</div>}
      {loading && <div className="loading-bar">Loading...</div>}

      {/* File list */}
      <div className="file-list">
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`file-item ${entry.isDirectory ? 'directory' : 'file'}`}
            onClick={() => handleFileClick(entry)}
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
                setContextEntry(entry)
                setDialogInput(entry.name)
              }}
            >
              <MoreIcon />
            </button>
          </div>
        ))}
        {entries.length === 0 && !loading && (
          <div className="empty-message">Empty folder</div>
        )}
      </div>

      {/* Context menu */}
      {contextEntry && (
        <div className="context-overlay" onClick={() => setContextEntry(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-header">{contextEntry.name}</div>
            <button onClick={() => setShowRenameDialog(true)}>Rename</button>
            <button className="danger" onClick={() => setShowDeleteDialog(true)}>Delete</button>
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
              <button className={!createIsDirectory ? 'active' : ''} onClick={() => setCreateIsDirectory(false)}>
                File
              </button>
              <button className={createIsDirectory ? 'active' : ''} onClick={() => setCreateIsDirectory(true)}>
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
              <button className="primary" onClick={handleCreate}>Create</button>
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
              <button className="primary" onClick={handleRename}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {showDeleteDialog && (
        <div className="dialog-overlay" onClick={() => setShowDeleteDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {contextEntry?.isDirectory ? 'Folder' : 'File'}</h3>
            <p>Are you sure you want to delete "{contextEntry?.name}"?</p>
            <div className="dialog-buttons">
              <button onClick={() => setShowDeleteDialog(false)}>Cancel</button>
              <button className="danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .file-explorer {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #16213e;
        }
        .explorer-header {
          display: flex;
          gap: 4px;
          padding: 8px;
          border-bottom: 1px solid #2a2a4a;
        }
        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: #1a1a2e;
          border: none;
          color: #888;
          border-radius: 6px;
          cursor: pointer;
        }
        .icon-btn:hover:not(:disabled) {
          background: #2a2a4a;
          color: #fff;
        }
        .icon-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .header-spacer {
          flex: 1;
        }
        .select-folder-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          background: #4a7c59;
          border: none;
          color: #fff;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          white-space: nowrap;
        }
        .select-folder-btn:hover {
          background: #5a8c69;
        }
        .select-folder-btn:active {
          background: #3a6c49;
        }
        .path-bar {
          padding: 6px 12px;
          background: #0f0f23;
          color: #888;
          font-size: 0.75rem;
          font-family: monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .error-bar {
          padding: 6px 12px;
          background: #cc3333;
          color: #fff;
          font-size: 0.8rem;
        }
        .loading-bar {
          padding: 6px 12px;
          background: #2a2a4a;
          color: #888;
          font-size: 0.8rem;
          text-align: center;
        }
        .file-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px;
        }
        .file-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          margin: 2px 0;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .file-item:hover {
          background: #1a1a2e;
        }
        .file-item:active {
          background: #222244;
        }
        .file-icon {
          display: flex;
          color: #666;
        }
        .directory .file-icon {
          color: #7eb0d5;
        }
        .name {
          flex: 1;
          color: #ddd;
          font-size: 0.85rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .directory .name {
          color: #7eb0d5;
        }
        .size {
          color: #555;
          font-size: 0.7rem;
        }
        .more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: none;
          border: none;
          color: #555;
          cursor: pointer;
          border-radius: 4px;
          opacity: 0;
        }
        .file-item:hover .more-btn {
          opacity: 1;
        }
        .more-btn:hover {
          background: #2a2a4a;
          color: #fff;
        }
        .empty-message {
          text-align: center;
          color: #555;
          padding: 30px 15px;
          font-size: 0.85rem;
        }

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
          max-width: 360px;
          background: #16213e;
          border-radius: 12px 12px 0 0;
          padding: 12px;
          padding-bottom: max(12px, env(safe-area-inset-bottom));
        }
        .context-header {
          padding: 8px 12px;
          color: #666;
          font-size: 0.8rem;
          border-bottom: 1px solid #2a2a4a;
          margin-bottom: 6px;
        }
        .context-menu button {
          display: block;
          width: 100%;
          padding: 12px;
          background: none;
          border: none;
          color: #fff;
          text-align: left;
          font-size: 0.95rem;
          cursor: pointer;
          border-radius: 6px;
        }
        .context-menu button:hover {
          background: #2a2a4a;
        }
        .context-menu button.danger {
          color: #f66;
        }

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
          max-width: 320px;
          background: #16213e;
          border-radius: 10px;
          padding: 16px;
        }
        .dialog h3 {
          margin: 0 0 12px;
          color: #fff;
          font-size: 1rem;
        }
        .dialog p {
          color: #aaa;
          margin: 0 0 12px;
          font-size: 0.85rem;
        }
        .dialog input {
          width: 100%;
          padding: 10px;
          background: #0f0f23;
          border: 1px solid #2a2a4a;
          border-radius: 6px;
          color: #fff;
          font-size: 0.95rem;
        }
        .dialog input:focus {
          outline: none;
          border-color: #4a4a8a;
        }
        .dialog-type-toggle {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
        }
        .dialog-type-toggle button {
          flex: 1;
          padding: 6px;
          background: #0f0f23;
          border: 1px solid #2a2a4a;
          color: #888;
          border-radius: 5px;
          cursor: pointer;
          font-size: 0.85rem;
        }
        .dialog-type-toggle button.active {
          background: #2a2a4a;
          color: #fff;
          border-color: #4a4a8a;
        }
        .dialog-buttons {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .dialog-buttons button {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 6px;
          font-size: 0.9rem;
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
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function UpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}

