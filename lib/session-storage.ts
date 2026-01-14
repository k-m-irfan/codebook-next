// Session storage utilities for persistent sessions
// Stores session data in browser localStorage

import { OpenFile } from '@/app/terminal/[host]/page'

export interface TerminalTabState {
  id: string
  title: string
  scrollbackBuffer: string
}

export interface Session {
  id: string
  host: string
  name: string
  workspacePath: string
  openFiles: OpenFile[]
  terminalTabs: TerminalTabState[]
  activeFileIndex: number
  activeTerminalTabId: string | null
  createdAt: string
  lastAccessedAt: string
}

export interface SessionSummary {
  id: string
  host: string
  name: string
  workspacePath: string
  openFilesCount: number
  terminalTabsCount: number
  lastAccessedAt: string
}

const SESSIONS_INDEX_KEY = 'codebook:sessions:index'
const SESSION_KEY_PREFIX = 'codebook:session:'

// Generate a unique session ID
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Get all session summaries (lightweight list for home screen)
export function getSessionsIndex(): SessionSummary[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(SESSIONS_INDEX_KEY)
    if (!data) return []
    const sessions = JSON.parse(data) as SessionSummary[]
    // Sort by lastAccessedAt descending (most recent first)
    return sessions.sort((a, b) =>
      new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
    )
  } catch (e) {
    console.error('Failed to load sessions index:', e)
    return []
  }
}

// Save sessions index
export function saveSessionsIndex(sessions: SessionSummary[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(sessions))
  } catch (e) {
    console.error('Failed to save sessions index:', e)
  }
}

// Get full session data by ID
export function getSession(id: string): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(`${SESSION_KEY_PREFIX}${id}`)
    if (!data) {
      console.log('[Session] No session found with id:', id)
      return null
    }
    const session = JSON.parse(data) as Session
    console.log('[Session] Loaded session:', id, {
      name: session.name,
      host: session.host,
      workspacePath: session.workspacePath,
      openFilesCount: session.openFiles.length,
      terminalTabsCount: session.terminalTabs.length,
      terminalTabs: session.terminalTabs.map(t => ({ id: t.id, title: t.title, bufferLen: t.scrollbackBuffer?.length || 0 })),
    })
    return session
  } catch (e) {
    console.error('Failed to load session:', e)
    return null
  }
}

// Save full session data
export function saveSession(session: Session): void {
  if (typeof window === 'undefined') return

  try {
    // Ensure storage space
    const sessionData = JSON.stringify(session)
    const estimatedSize = sessionData.length * 2 // UTF-16

    console.log('[Session] Saving session:', session.id, {
      name: session.name,
      host: session.host,
      workspacePath: session.workspacePath,
      openFilesCount: session.openFiles.length,
      terminalTabsCount: session.terminalTabs.length,
      terminalTabs: session.terminalTabs.map(t => ({ id: t.id, title: t.title, bufferLen: t.scrollbackBuffer?.length || 0 })),
    })

    if (!ensureStorageSpace(estimatedSize)) {
      console.warn('Could not free enough storage space for session')
    }

    // Save full session
    localStorage.setItem(`${SESSION_KEY_PREFIX}${session.id}`, sessionData)

    // Update index
    updateSessionSummary(session)
  } catch (e) {
    console.error('Failed to save session:', e)
    // If quota exceeded, try evicting old sessions
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      if (evictOldestSession()) {
        // Retry save
        try {
          localStorage.setItem(`${SESSION_KEY_PREFIX}${session.id}`, JSON.stringify(session))
          updateSessionSummary(session)
        } catch {
          console.error('Failed to save session even after eviction')
        }
      }
    }
  }
}

// Delete a session
export function deleteSession(id: string): void {
  if (typeof window === 'undefined') return
  try {
    // Remove full session data
    localStorage.removeItem(`${SESSION_KEY_PREFIX}${id}`)

    // Update index
    const sessions = getSessionsIndex()
    const filtered = sessions.filter(s => s.id !== id)
    saveSessionsIndex(filtered)
  } catch (e) {
    console.error('Failed to delete session:', e)
  }
}

// Create a new session
export function createSession(host: string): Session {
  const now = new Date().toISOString()
  const displayName = host === 'local' ? 'Local' : host
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })

  return {
    id: generateSessionId(),
    host,
    name: `${displayName} - ${timestamp}`,
    workspacePath: '',
    openFiles: [],
    terminalTabs: [],
    activeFileIndex: -1,
    activeTerminalTabId: null,
    createdAt: now,
    lastAccessedAt: now,
  }
}

// Update session summary in the index
export function updateSessionSummary(session: Session): void {
  const sessions = getSessionsIndex()
  const existingIndex = sessions.findIndex(s => s.id === session.id)

  const summary: SessionSummary = {
    id: session.id,
    host: session.host,
    name: session.name,
    workspacePath: session.workspacePath,
    openFilesCount: session.openFiles.length,
    terminalTabsCount: session.terminalTabs.length,
    lastAccessedAt: session.lastAccessedAt,
  }

  if (existingIndex >= 0) {
    sessions[existingIndex] = summary
  } else {
    sessions.push(summary)
  }

  saveSessionsIndex(sessions)
}

// Get storage usage for codebook data
export function getStorageUsage(): { used: number; available: number; percentage: number } {
  if (typeof window === 'undefined') return { used: 0, available: 5 * 1024 * 1024, percentage: 0 }

  let used = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('codebook:')) {
      const value = localStorage.getItem(key)
      if (value) {
        used += (key.length + value.length) * 2 // UTF-16 = 2 bytes per char
      }
    }
  }

  const available = 5 * 1024 * 1024 // Assume 5MB limit (conservative)
  return {
    used,
    available,
    percentage: (used / available) * 100
  }
}

// Evict the oldest session to free space
export function evictOldestSession(): boolean {
  const sessions = getSessionsIndex()
  if (sessions.length === 0) return false

  // Sort by lastAccessedAt ascending (oldest first)
  const sorted = [...sessions].sort((a, b) =>
    new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime()
  )

  // Delete oldest
  deleteSession(sorted[0].id)
  console.log(`Evicted old session: ${sorted[0].name}`)
  return true
}

// Ensure enough storage space is available
export function ensureStorageSpace(requiredBytes: number): boolean {
  const MAX_ATTEMPTS = 5
  let attempts = 0

  while (attempts < MAX_ATTEMPTS) {
    const { used, available } = getStorageUsage()
    const threshold = available * 0.9 // Keep 10% buffer

    if (used + requiredBytes < threshold) {
      return true
    }

    if (!evictOldestSession()) {
      return false // No more sessions to evict
    }
    attempts++
  }

  return false
}

// Format relative time for display
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}
