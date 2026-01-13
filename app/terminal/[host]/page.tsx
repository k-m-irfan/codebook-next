'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ConnectionProvider } from './ConnectionContext'
import { PasswordContext } from './PasswordContext'
import BottomNav from './BottomNav'
import { useKeyboardHeight } from './useKeyboardHeight'

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

  // Cached password for this host session
  const [cachedPassword, setCachedPassword] = useState<string | null>(null)

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
  }, [])

  // Handle file open
  const handleOpenFile = useCallback((path: string, name: string, content: string) => {
    const existingIndex = openFiles.findIndex(f => f.path === path)
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex)
      setShowExplorer(false)
      setExplorerFullscreen(false)
      return
    }

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
      setShowExplorer(false)
      setExplorerFullscreen(false)
    }
  }, [showTerminal])

  // Determine layout mode
  const isExplorerFullscreen = showExplorer && explorerFullscreen
  const isTerminalFullscreen = showTerminal && terminalFullscreen

  // Keyboard height detection
  const { keyboardHeight, viewportHeight, isKeyboardVisible } = useKeyboardHeight()

  return (
    <ConnectionProvider host={host} password={cachedPassword}>
      <PasswordContext.Provider value={{ password: cachedPassword, setPassword: setCachedPassword }}>
        <div className="session-container">
        {/* Content area - above bottom nav */}
        <div className="content-area">
          {/* File Explorer - Fullscreen (always mounted, hidden when not active) */}
          <div className={`explorer-panel fullscreen ${isExplorerFullscreen ? 'visible' : 'hidden'}`}>
            <FileExplorer
              workspacePath={workspacePath}
              isFullscreen={explorerFullscreen}
              onSelectWorkspace={handleSelectWorkspace}
              onOpenFile={handleOpenFile}
            />
          </div>

          {/* Terminal Panel - Fullscreen (always mounted, hidden when not active) */}
          <div className={`terminal-fullscreen ${isTerminalFullscreen ? 'visible' : 'hidden'}`}>
            <TerminalPanel
              host={host}
              workspacePath={workspacePath}
              isVisible={isTerminalFullscreen}
            />
          </div>

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
                keyboardVisible={isKeyboardVisible}
              />
            </div>
          )}

          {/* Terminal Panel - Bottom panel (non-fullscreen) - removed duplicate, using fullscreen only */}
        </div>

        {/* Bottom nav - hidden when keyboard is visible */}
        <BottomNav
          showExplorer={showExplorer}
          showTerminal={showTerminal}
          onToggleExplorer={toggleExplorer}
          onToggleTerminal={toggleTerminal}
          hidden={isKeyboardVisible}
        />
      </div>

      <style jsx>{`
        .session-container {
          --bottom-nav-height: calc(56px + env(safe-area-inset-bottom, 0px));
          height: ${isKeyboardVisible ? `${viewportHeight}px` : '100dvh'};
          background: #1a1a2e;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .content-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          min-height: 0;
          padding-bottom: ${isKeyboardVisible ? '0' : 'var(--bottom-nav-height)'};
        }
        .explorer-panel {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #16213e;
          z-index: 10;
          display: flex;
          flex-direction: column;
        }
        .explorer-panel.fullscreen {
          flex: 1;
          min-height: 0;
        }
        .explorer-panel.hidden {
          visibility: hidden;
          pointer-events: none;
          z-index: -1;
        }
        .explorer-panel.visible {
          visibility: visible;
          pointer-events: auto;
          z-index: 10;
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
        .terminal-fullscreen {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: ${isKeyboardVisible ? '0' : 'var(--bottom-nav-height)'};
          display: flex;
          flex-direction: column;
          min-height: 0;
          z-index: 10;
        }
        .terminal-fullscreen.hidden {
          visibility: hidden;
          pointer-events: none;
          z-index: -1;
        }
        .terminal-fullscreen.visible {
          visibility: visible;
          pointer-events: auto;
          z-index: 10;
        }

        @media (min-width: 768px) {
          .explorer-panel:not(.fullscreen) {
            position: relative;
            width: 280px;
            max-width: 280px;
          }
          .content-area {
            flex-direction: row;
            flex-wrap: wrap;
          }
          .editor-area {
            flex: 1;
          }
          .terminal-panel {
            width: 100%;
            flex-shrink: 0;
          }
        }

        @media (orientation: landscape) and (max-height: 500px) {
          .session-container {
            --left-nav-width: 70px;
          }
          .content-area {
            padding-left: var(--left-nav-width);
            padding-bottom: 0;
          }
          .terminal-fullscreen {
            left: var(--left-nav-width);
            bottom: 0;
          }
          .explorer-panel {
            left: var(--left-nav-width);
          }
        }
      `}</style>
      </PasswordContext.Provider>
    </ConnectionProvider>
  )
}
