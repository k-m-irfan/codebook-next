'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ConnectionProvider } from './ConnectionContext'
import { PasswordContext } from './PasswordContext'
import BottomNav from './BottomNav'
import { useKeyboardHeight } from './useKeyboardHeight'
import { getFileType, FileType } from './fileTypes'
import {
  Session,
  TerminalTabState,
  createSession,
  getSession,
  saveSession,
} from '@/lib/session-storage'

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
  fileType: FileType
  encoding?: 'utf8' | 'base64'
}

export default function TerminalPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const host = params.host as string
  const sessionIdParam = searchParams.get('session')

  // Cached password for this host session
  const [cachedPassword, setCachedPassword] = useState<string | null>(null)

  // Session state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [terminalTabs, setTerminalTabs] = useState<TerminalTabState[]>([])
  const [activeTerminalTabId, setActiveTerminalTabId] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false) // Flag to indicate session is ready
  const sessionInitialized = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Initialize or restore session on mount
  useEffect(() => {
    if (sessionInitialized.current) return
    sessionInitialized.current = true

    if (sessionIdParam) {
      // Restore existing session
      const session = getSession(sessionIdParam)
      if (session) {
        setCurrentSessionId(session.id)
        setWorkspacePath(session.workspacePath)
        setOpenFiles(session.openFiles)
        setActiveFileIndex(session.activeFileIndex)
        setTerminalTabs(session.terminalTabs)
        setActiveTerminalTabId(session.activeTerminalTabId)
        console.log('Restored session:', session.name, 'with', session.terminalTabs.length, 'terminal tabs')
        // Mark session as ready after state is set
        setTimeout(() => setSessionReady(true), 0)
        return
      }
    }

    // Create new session
    const newSession = createSession(host)
    setCurrentSessionId(newSession.id)
    saveSession(newSession)
    console.log('Created new session:', newSession.name)
    setSessionReady(true)
  }, [sessionIdParam, host])

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (!currentSessionId) return

      const session: Session = {
        id: currentSessionId,
        host,
        name: '', // Will be preserved from existing
        workspacePath,
        openFiles,
        terminalTabs,
        activeFileIndex,
        activeTerminalTabId,
        createdAt: '', // Will be preserved from existing
        lastAccessedAt: new Date().toISOString(),
      }

      // Get existing session to preserve name and createdAt
      const existing = getSession(currentSessionId)
      if (existing) {
        session.name = existing.name
        session.createdAt = existing.createdAt
      } else {
        session.name = `${host === 'local' ? 'Local' : host} - ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
        session.createdAt = new Date().toISOString()
      }

      saveSession(session)
    }, 2000) // Save 2 seconds after last change
  }, [currentSessionId, host, workspacePath, openFiles, terminalTabs, activeFileIndex, activeTerminalTabId])

  // Auto-save on state changes
  useEffect(() => {
    if (!currentSessionId) return
    debouncedSave()
  }, [workspacePath, openFiles, activeFileIndex, terminalTabs, activeTerminalTabId, debouncedSave, currentSessionId])

  // Save on unmount/beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!currentSessionId) return

      // Sync save
      const existing = getSession(currentSessionId)
      const session: Session = {
        id: currentSessionId,
        host,
        name: existing?.name || `${host === 'local' ? 'Local' : host}`,
        workspacePath,
        openFiles,
        terminalTabs,
        activeFileIndex,
        activeTerminalTabId,
        createdAt: existing?.createdAt || new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      }
      saveSession(session)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      handleBeforeUnload() // Also save on component unmount
    }
  }, [currentSessionId, host, workspacePath, openFiles, terminalTabs, activeFileIndex, activeTerminalTabId])

  // Handle terminal state changes from TerminalPanel
  const handleTerminalStateChange = useCallback((tabs: TerminalTabState[], activeTabId: string | null) => {
    setTerminalTabs(tabs)
    setActiveTerminalTabId(activeTabId)
  }, [])

  // Handle workspace selection
  const handleSelectWorkspace = useCallback((path: string) => {
    setWorkspacePath(path)
  }, [])

  // Handle file open
  const handleOpenFile = useCallback((path: string, name: string, content: string, encoding?: string) => {
    const existingIndex = openFiles.findIndex(f => f.path === path)
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex)
      setShowExplorer(false)
      setExplorerFullscreen(false)
      return
    }

    const fileType = getFileType(name)
    const newFile: OpenFile = {
      path,
      name,
      content,
      originalContent: content,
      isModified: false,
      fileType,
      encoding: encoding as 'utf8' | 'base64' | undefined,
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
            {sessionReady && (
              <TerminalPanel
                host={host}
                workspacePath={workspacePath}
                isVisible={isTerminalFullscreen}
                isKeyboardVisible={isKeyboardVisible}
                sessionId={currentSessionId}
                initialTerminalTabs={terminalTabs}
                onTerminalStateChange={handleTerminalStateChange}
              />
            )}
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

        @media (orientation: landscape) and (max-height: 500px),
               (orientation: landscape) and (min-width: 1024px) {
          .session-container {
            --left-nav-width: calc(64px + env(safe-area-inset-left, 0px));
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
