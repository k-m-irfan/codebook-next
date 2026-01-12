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

  // Fullscreen state
  const [explorerFullscreen, setExplorerFullscreen] = useState(false)
  const [terminalFullscreen, setTerminalFullscreen] = useState(false)

  // Open files in editor
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1)

  // Handle workspace selection
  const handleSelectWorkspace = useCallback((path: string) => {
    setWorkspacePath(path)
    // Exit fullscreen when selecting workspace
    setExplorerFullscreen(false)
  }, [])

  // Handle file open
  const handleOpenFile = useCallback((path: string, name: string, content: string) => {
    // Check if file is already open
    const existingIndex = openFiles.findIndex(f => f.path === path)
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex)
      setShowExplorer(false)
      setExplorerFullscreen(false)
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
    setExplorerFullscreen(false)
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

  // Toggle handlers - open in fullscreen by default
  const toggleExplorer = useCallback(() => {
    if (showExplorer) {
      setShowExplorer(false)
      setExplorerFullscreen(false)
    } else {
      setShowExplorer(true)
      setExplorerFullscreen(true)
      // Hide terminal when opening explorer in fullscreen
      setShowTerminal(false)
      setTerminalFullscreen(false)
    }
  }, [showExplorer])

  const toggleTerminal = useCallback(() => {
    if (showTerminal) {
      setShowTerminal(false)
      setTerminalFullscreen(false)
    } else {
      setShowTerminal(true)
      setTerminalFullscreen(true)
      // Hide explorer when opening terminal in fullscreen
      setShowExplorer(false)
      setExplorerFullscreen(false)
    }
  }, [showTerminal])

  // Fullscreen toggle handlers
  const toggleExplorerFullscreen = useCallback(() => {
    setExplorerFullscreen(prev => !prev)
  }, [])

  const toggleTerminalFullscreen = useCallback(() => {
    setTerminalFullscreen(prev => !prev)
  }, [])

  // Close handlers
  const closeExplorer = useCallback(() => {
    setShowExplorer(false)
    setExplorerFullscreen(false)
  }, [])

  const closeTerminal = useCallback(() => {
    setShowTerminal(false)
    setTerminalFullscreen(false)
  }, [])

  // Determine layout mode
  const isExplorerFullscreen = showExplorer && explorerFullscreen
  const isTerminalFullscreen = showTerminal && terminalFullscreen

  return (
    <ConnectionProvider host={host}>
      <div className="session-container">
        {/* Main content area */}
        <div className="main-area">
          {/* File Explorer - Fullscreen or Sidebar */}
          {showExplorer && (
            <div className={`explorer-panel ${isExplorerFullscreen ? 'fullscreen' : ''}`}>
              <FileExplorer
                workspacePath={workspacePath}
                isFullscreen={explorerFullscreen}
                onSelectWorkspace={handleSelectWorkspace}
                onOpenFile={handleOpenFile}
                onClose={closeExplorer}
                onToggleFullscreen={toggleExplorerFullscreen}
              />
            </div>
          )}

          {/* Editor Area - Hidden when explorer or terminal is fullscreen */}
          {!isExplorerFullscreen && !isTerminalFullscreen && (
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
          )}
        </div>

        {/* Terminal Panel - Fullscreen or Bottom Panel */}
        {showTerminal && (
          <div className={`terminal-section ${isTerminalFullscreen ? 'fullscreen' : ''}`}>
            <TerminalPanel
              host={host}
              workspacePath={workspacePath}
              isFullscreen={terminalFullscreen}
              onClose={closeTerminal}
              onToggleFullscreen={toggleTerminalFullscreen}
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
        .explorer-panel.fullscreen {
          max-width: none;
          border-right: none;
          z-index: 100;
        }
        .editor-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .terminal-section {
          height: 40%;
          min-height: 150px;
          max-height: 60%;
          border-top: 1px solid #2a2a4a;
          display: flex;
          flex-direction: column;
        }
        .terminal-section.fullscreen {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          height: auto;
          max-height: none;
          min-height: auto;
          z-index: 100;
          border-top: none;
        }

        @media (min-width: 768px) {
          .explorer-panel:not(.fullscreen) {
            position: relative;
            width: 280px;
            max-width: 280px;
          }
        }
      `}</style>
    </ConnectionProvider>
  )
}
