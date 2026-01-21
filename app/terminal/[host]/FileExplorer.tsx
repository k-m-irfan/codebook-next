'use client'

import { useState, useCallback, useEffect } from 'react'
import { useConnection } from './ConnectionContext'
import type { FileEntry } from '@/lib/file-protocol'

interface FileExplorerProps {
  workspacePath: string
  isFullscreen: boolean
  onSelectWorkspace: (path: string) => void
  onOpenFile: (path: string, name: string, content: string, encoding?: string) => void
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
      const { content, encoding } = await readFile(entry.path)
      onOpenFile(entry.path, entry.name, content, encoding)
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
        <div className="empty-icon">
          <FolderOpenIcon />
        </div>
        <h2 className="empty-title">No Folder Open</h2>
        <p className="empty-hint">Browse and manage files on {host}</p>
        <button className="open-folder-btn" onClick={openFolder}>
          <FolderPlusIcon />
          <span>Open Folder</span>
        </button>

        <style jsx>{`
          .explorer-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 24px;
            background: linear-gradient(180deg, #16213e 0%, #0f0f23 100%);
          }
          .empty-icon {
            color: #3a4a6a;
            margin-bottom: 16px;
          }
          .empty-title {
            margin: 0 0 8px;
            color: #fff;
            font-size: 1.25rem;
            font-weight: 600;
          }
          .empty-hint {
            margin: 0 0 24px;
            color: #666;
            font-size: 0.9rem;
            text-align: center;
          }
          .open-folder-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 14px 28px;
            background: linear-gradient(135deg, #4a7c59 0%, #3a6c49 100%);
            border: none;
            border-radius: 12px;
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 1rem;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(74, 124, 89, 0.3);
          }
          .open-folder-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(74, 124, 89, 0.4);
          }
          .open-folder-btn:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(74, 124, 89, 0.3);
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="file-explorer">
      {/* Header */}
      <div className="explorer-header">
        <button className="header-btn" onClick={goUp} disabled={currentPath === '/'} title="Go up">
          <UpIcon />
        </button>
        <button
          className="header-btn"
          onClick={() => loadDirectory(currentPath)}
          title="Refresh"
        >
          <RefreshIcon />
        </button>
        <div className="header-spacer" />
        <button
          className="header-btn"
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
          <CheckIcon />
          <span>Select</span>
        </button>
      </div>

      {/* Path breadcrumb */}
      <div className="path-bar">
        <span className="path-label">Path:</span>
        <span className="path-text">{currentPath}</span>
      </div>

      {error && (
        <div className="error-bar">
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}
      {loading && (
        <div className="loading-bar">
          <div className="loading-spinner" />
          <span>Loading...</span>
        </div>
      )}

      {/* File list */}
      <div className="file-list">
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`file-item ${entry.isDirectory ? 'directory' : 'file'}`}
            onClick={() => handleFileClick(entry)}
          >
            <div className="file-icon-wrapper">
              {entry.isDirectory ? <FolderIcon /> : <FileTypeIcon name={entry.name} />}
            </div>
            <div className="file-info">
              <span className="file-name">{entry.name}</span>
              {!entry.isDirectory && <span className="file-size">{formatSize(entry.size)}</span>}
            </div>
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
          <div className="empty-folder">
            <EmptyFolderIcon />
            <span>This folder is empty</span>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextEntry && (
        <div className="context-overlay" onClick={() => setContextEntry(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-header">
              <div className="context-icon">
                {contextEntry.isDirectory ? <FolderIcon /> : <FileTypeIcon name={contextEntry.name} />}
              </div>
              <div className="context-info">
                <span className="context-name">{contextEntry.name}</span>
                {!contextEntry.isDirectory && <span className="context-size">{formatSize(contextEntry.size)}</span>}
              </div>
            </div>
            <div className="context-actions">
              <button onClick={() => setShowRenameDialog(true)}>
                <RenameIcon />
                <span>Rename</span>
              </button>
              <button className="danger" onClick={() => setShowDeleteDialog(true)}>
                <TrashIcon />
                <span>Delete</span>
              </button>
            </div>
            <button className="cancel-btn" onClick={() => setContextEntry(null)}>Cancel</button>
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
                <FileIcon />
                <span>File</span>
              </button>
              <button className={createIsDirectory ? 'active' : ''} onClick={() => setCreateIsDirectory(true)}>
                <FolderIcon />
                <span>Folder</span>
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
              <button className="primary" onClick={handleCreate} disabled={!dialogInput.trim()}>Create</button>
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
              <button className="primary" onClick={handleRename} disabled={!dialogInput.trim()}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {showDeleteDialog && (
        <div className="dialog-overlay" onClick={() => setShowDeleteDialog(false)}>
          <div className="dialog delete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="delete-icon">
              <TrashIcon />
            </div>
            <h3>Delete {contextEntry?.isDirectory ? 'Folder' : 'File'}?</h3>
            <p>"{contextEntry?.name}" will be permanently deleted.</p>
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
          background: linear-gradient(180deg, #16213e 0%, #0f0f23 100%);
        }
        .explorer-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .header-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #aaa;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .header-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .header-btn:active:not(:disabled) {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.15);
        }
        .header-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .header-spacer {
          flex: 1;
        }
        .select-folder-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: linear-gradient(135deg, #4a7c59 0%, #3a6c49 100%);
          border: none;
          color: #fff;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(74, 124, 89, 0.3);
        }
        .select-folder-btn:hover {
          box-shadow: 0 4px 12px rgba(74, 124, 89, 0.4);
        }
        .select-folder-btn:active {
          transform: scale(0.97);
        }
        .path-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .path-label {
          color: #666;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .path-text {
          flex: 1;
          color: #8ab4f8;
          font-size: 0.8rem;
          font-family: 'SF Mono', 'Monaco', monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .error-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: linear-gradient(135deg, #cc3333 0%, #a02828 100%);
          color: #fff;
          font-size: 0.85rem;
        }
        .error-bar button {
          background: none;
          border: none;
          color: #fff;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 4px 8px;
          opacity: 0.7;
        }
        .error-bar button:hover {
          opacity: 1;
        }
        .loading-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(74, 124, 255, 0.1);
          color: #8ab4f8;
          font-size: 0.85rem;
        }
        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(138, 180, 248, 0.3);
          border-top-color: #8ab4f8;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .file-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          -webkit-overflow-scrolling: touch;
        }
        .file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 12px;
          margin: 4px 0;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s;
          min-height: 56px;
        }
        .file-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.08);
        }
        .file-item:active {
          background: rgba(255, 255, 255, 0.08);
          transform: scale(0.99);
        }
        .file-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          flex-shrink: 0;
        }
        .file .file-icon-wrapper {
          color: #888;
        }
        .directory .file-icon-wrapper {
          background: rgba(126, 176, 213, 0.15);
          color: #7eb0d5;
        }
        .file-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .file-name {
          color: #e0e0e0;
          font-size: 0.95rem;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .directory .file-name {
          color: #7eb0d5;
        }
        .file-size {
          color: #666;
          font-size: 0.75rem;
        }
        .more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          border-radius: 10px;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .more-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .more-btn:active {
          background: rgba(255, 255, 255, 0.15);
        }
        .empty-folder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          color: #555;
          gap: 12px;
        }
        .empty-folder span {
          font-size: 0.9rem;
        }

        .context-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 200;
          animation: fadeIn 0.15s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .context-menu {
          width: 100%;
          max-width: 400px;
          background: linear-gradient(180deg, #1e2a4a 0%, #16213e 100%);
          border-radius: 20px 20px 0 0;
          padding: 8px;
          padding-bottom: max(8px, env(safe-area-inset-bottom));
          animation: slideUp 0.2s ease-out;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .context-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 8px;
        }
        .context-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          color: #7eb0d5;
        }
        .context-info {
          flex: 1;
          min-width: 0;
        }
        .context-name {
          display: block;
          color: #fff;
          font-size: 1rem;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .context-size {
          color: #666;
          font-size: 0.8rem;
        }
        .context-actions {
          display: flex;
          gap: 8px;
          padding: 8px;
        }
        .context-actions button {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 16px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 0.85rem;
          cursor: pointer;
          border-radius: 12px;
          transition: all 0.15s;
        }
        .context-actions button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .context-actions button:active {
          transform: scale(0.97);
        }
        .context-actions button.danger {
          color: #ff6b6b;
        }
        .context-actions button.danger:hover {
          background: rgba(255, 107, 107, 0.1);
        }
        .cancel-btn {
          display: block;
          width: 100%;
          padding: 16px;
          margin-top: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: none;
          color: #888;
          font-size: 0.95rem;
          cursor: pointer;
          border-radius: 12px;
          transition: all 0.15s;
        }
        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .cancel-btn:active {
          transform: scale(0.98);
        }

        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 24px;
          animation: fadeIn 0.15s ease-out;
        }
        .dialog {
          width: 100%;
          max-width: 340px;
          background: linear-gradient(180deg, #1e2a4a 0%, #16213e 100%);
          border-radius: 16px;
          padding: 24px;
          animation: scaleIn 0.2s ease-out;
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .dialog.delete-dialog {
          text-align: center;
        }
        .delete-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background: rgba(255, 107, 107, 0.15);
          border-radius: 50%;
          color: #ff6b6b;
          margin-bottom: 16px;
        }
        .dialog h3 {
          margin: 0 0 16px;
          color: #fff;
          font-size: 1.1rem;
          font-weight: 600;
        }
        .dialog p {
          color: #999;
          margin: 0 0 20px;
          font-size: 0.9rem;
          line-height: 1.4;
        }
        .dialog input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #fff;
          font-size: 1rem;
          transition: all 0.15s;
        }
        .dialog input:focus {
          outline: none;
          border-color: #4a7c59;
          background: rgba(0, 0, 0, 0.4);
        }
        .dialog input::placeholder {
          color: #555;
        }
        .dialog-type-toggle {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }
        .dialog-type-toggle button {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #888;
          border-radius: 12px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.15s;
        }
        .dialog-type-toggle button:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .dialog-type-toggle button.active {
          background: rgba(74, 124, 89, 0.2);
          color: #fff;
          border-color: rgba(74, 124, 89, 0.5);
        }
        .dialog-buttons {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }
        .dialog-buttons button {
          flex: 1;
          padding: 14px 16px;
          border: none;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          transition: all 0.15s;
        }
        .dialog-buttons button:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .dialog-buttons button:active {
          transform: scale(0.97);
        }
        .dialog-buttons button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .dialog-buttons button.primary {
          background: linear-gradient(135deg, #4a7c59 0%, #3a6c49 100%);
          box-shadow: 0 2px 8px rgba(74, 124, 89, 0.3);
        }
        .dialog-buttons button.primary:hover:not(:disabled) {
          box-shadow: 0 4px 12px rgba(74, 124, 89, 0.4);
        }
        .dialog-buttons button.danger {
          background: linear-gradient(135deg, #cc4444 0%, #a03030 100%);
          box-shadow: 0 2px 8px rgba(160, 48, 48, 0.3);
        }
        .dialog-buttons button.danger:hover {
          box-shadow: 0 4px 12px rgba(160, 48, 48, 0.4);
        }
      `}</style>
    </div>
  )
}

// Icons
function FolderOpenIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FolderPlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

// File type icon with color coding based on extension
function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || ''

  // Color mapping for file types
  const getColor = () => {
    if (['js', 'jsx', 'mjs'].includes(ext)) return '#f7df1e'
    if (['ts', 'tsx'].includes(ext)) return '#3178c6'
    if (['py'].includes(ext)) return '#3776ab'
    if (['rb'].includes(ext)) return '#cc342d'
    if (['go'].includes(ext)) return '#00add8'
    if (['rs'].includes(ext)) return '#dea584'
    if (['java'].includes(ext)) return '#ed8b00'
    if (['php'].includes(ext)) return '#777bb4'
    if (['html', 'htm'].includes(ext)) return '#e34c26'
    if (['css', 'scss', 'sass'].includes(ext)) return '#264de4'
    if (['json'].includes(ext)) return '#cbcb41'
    if (['md', 'markdown'].includes(ext)) return '#083fa1'
    if (['yml', 'yaml'].includes(ext)) return '#cb171e'
    if (['xml'].includes(ext)) return '#f16529'
    if (['sh', 'bash', 'zsh'].includes(ext)) return '#4eaa25'
    if (['sql'].includes(ext)) return '#e38c00'
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return '#a352e8'
    if (['pdf'].includes(ext)) return '#ff0000'
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return '#ffc107'
    return '#888'
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={getColor()} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function UpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </svg>
  )
}

function RenameIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function EmptyFolderIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="9" y1="14" x2="15" y2="14" opacity="0.5" />
    </svg>
  )
}

