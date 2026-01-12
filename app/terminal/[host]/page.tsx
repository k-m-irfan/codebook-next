'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ConnectionProvider } from './ConnectionContext'
import BottomNav from './BottomNav'

const TerminalPanel = dynamic(() => import('./TerminalPanel'), {
  ssr: false,
  loading: () => <LoadingScreen message="Loading terminal..." />,
})

const FileExplorer = dynamic(() => import('./FileExplorer'), {
  ssr: false,
  loading: () => <LoadingScreen message="Loading explorer..." />,
})

const EditorArea = dynamic(() => import('./EditorArea'), {
  ssr: false,
  loading: () => <LoadingScreen message="Loading editor..." />,
})

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="loading-screen">
      <style jsx>{`
        .loading-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: #1a1a2e;
          color: #888;
        }
      `}</style>
      {message}
    </div>
  )
}

export interface OpenFile {
  path: string
  name: string
  content: string
  originalContent: string
  isModified: boolean
}

export default function TerminalPage() {
  const params = useParams()
  const host = params.host as string

  // Workspace state
  const [workspacePath, setWorkspacePath] = useState<string>('')

  // Panel visibility
  const [showExplorer, setShowExplorer] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)

  // Open files in editor
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1)

  // Handle workspace selection
  const handleSelectWorkspace = useCallback((path: string) => {
    setWorkspacePath(path)
    setShowExplorer(false)
  }, [])

  // Handle file open
  const handleOpenFile = useCallback((path: string, name: string, content: string) => {
    // Check if file is already open
    const existingIndex = openFiles.findIndex(f => f.path === path)
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex)
      setShowExplorer(false)
      return
    }

    // Add new file
    const newFile: OpenFile = {
      path,
      name,
      content,
      originalContent: content,
      isModified: false,
    }
    setOpenFiles(prev => [...prev, newFile])
    setActiveFileIndex(openFiles.length)
    setShowExplorer(false)
  }, [openFiles])

  // Handle file content change
  const handleFileChange = useCallback((index: number, content: string) => {
    setOpenFiles(prev => prev.map((f, i) => {
      if (i !== index) return f
      return {
        ...f,
        content,
        isModified: content !== f.originalContent,
      }
    }))
  }, [])

  // Handle file save
  const handleFileSaved = useCallback((index: number, content: string) => {
    setOpenFiles(prev => prev.map((f, i) => {
      if (i !== index) return f
      return {
        ...f,
        content,
        originalContent: content,
        isModified: false,
      }
    }))
  }, [])

  // Handle file close
  const handleCloseFile = useCallback((index: number) => {
    setOpenFiles(prev => prev.filter((_, i) => i !== index))
    if (activeFileIndex >= index && activeFileIndex > 0) {
      setActiveFileIndex(activeFileIndex - 1)
    } else if (openFiles.length <= 1) {
      setActiveFileIndex(-1)
    }
  }, [activeFileIndex, openFiles.length])

  // Toggle handlers
  const toggleExplorer = useCallback(() => {
    setShowExplorer(prev => !prev)
  }, [])

  const toggleTerminal = useCallback(() => {
    setShowTerminal(prev => !prev)
  }, [])

  return (
    <ConnectionProvider host={host}>
      <div className="session-container">
        {/* Main content area */}
        <div className="main-area">
          {/* File Explorer Sidebar */}
          {showExplorer && (
            <div className="explorer-panel">
              <FileExplorer
                workspacePath={workspacePath}
                onSelectWorkspace={handleSelectWorkspace}
                onOpenFile={handleOpenFile}
                onClose={() => setShowExplorer(false)}
              />
            </div>
          )}

          {/* Editor Area */}
          <div className="editor-area">
            <EditorArea
              files={openFiles}
              activeIndex={activeFileIndex}
              onFileChange={handleFileChange}
              onFileSaved={handleFileSaved}
              onCloseFile={handleCloseFile}
              onSelectFile={setActiveFileIndex}
              host={host}
              workspacePath={workspacePath}
            />
          </div>
        </div>

        {/* Terminal Panel */}
        {showTerminal && (
          <div className="terminal-panel">
            <TerminalPanel
              host={host}
              workspacePath={workspacePath}
              onClose={() => setShowTerminal(false)}
            />
          </div>
        )}

        <BottomNav
          showExplorer={showExplorer}
          showTerminal={showTerminal}
          onToggleExplorer={toggleExplorer}
          onToggleTerminal={toggleTerminal}
        />
      </div>

      <style jsx>{`
        .session-container {
          height: 100vh;
          height: 100dvh;
          background: #1a1a2e;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .main-area {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
        }
        .explorer-panel {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 100%;
          max-width: 320px;
          background: #16213e;
          border-right: 1px solid #2a2a4a;
          z-index: 50;
          display: flex;
          flex-direction: column;
        }
        .editor-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .terminal-panel {
          height: 40%;
          min-height: 150px;
          max-height: 60%;
          border-top: 1px solid #2a2a4a;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 768px) {
          .explorer-panel {
            position: relative;
            width: 280px;
            max-width: 280px;
          }
        }
      `}</style>
    </ConnectionProvider>
  )
}
