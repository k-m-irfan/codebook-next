'use client'

import { useEffect, useState, useRef } from 'react'
import { useSessionManager } from './SessionManager'

interface SSHHost {
  name: string
  hostname?: string
  user?: string
  port?: string
}

type Tab = 'hosts' | 'sessions'

export default function HomeScreen() {
  const { sessions, createSession, switchToSession, closeSession } = useSessionManager()

  const [hosts, setHosts] = useState<SSHHost[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('hosts')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [newHost, setNewHost] = useState<SSHHost>({ name: '', hostname: '', user: '', port: '' })
  const [editHost, setEditHost] = useState<SSHHost & { oldName: string }>({ oldName: '', name: '', hostname: '', user: '', port: '' })
  const [deleteHostName, setDeleteHostName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Delete session state
  const [showDeleteSessionModal, setShowDeleteSessionModal] = useState(false)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  const [deleteSessionName, setDeleteSessionName] = useState('')

  // Password prompt state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordPrompt, setPasswordPrompt] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [connectingHost, setConnectingHost] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const openTerminal = (host: string) => {
    // Local terminal doesn't need password check
    if (host === 'local') {
      createSession(host)
      return
    }

    // Test SSH connection first
    setConnecting(true)
    setConnectingHost(host)

    const wsUrl = `ws://${window.location.hostname}:3001?host=${encodeURIComponent(host)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type === 'auth:password-required') {
          // Password needed - show modal
          setConnecting(false)
          const prompt = parsed.prompts?.[0]?.prompt || 'Password:'
          setPasswordPrompt(prompt)
          setShowPasswordModal(true)
          return
        }
      } catch {
        // Got terminal data - connection succeeded without password
        ws.close()
        setConnecting(false)
        createSession(host)
      }
    }

    ws.onerror = () => {
      setConnecting(false)
      setConnectingHost(null)
    }

    ws.onclose = () => {
      // If we're still connecting, it might have failed
      if (connecting && !showPasswordModal) {
        setConnecting(false)
        setConnectingHost(null)
      }
    }
  }

  const handlePasswordSubmit = () => {
    if (!passwordInput || !connectingHost || !wsRef.current) return

    // Send password to server
    wsRef.current.send(JSON.stringify({
      type: 'auth:password',
      password: passwordInput
    }))

    // Store password for the terminal page
    sessionStorage.setItem(`ssh_password_${connectingHost}`, passwordInput)

    // Close test connection and create session
    wsRef.current.close()
    setShowPasswordModal(false)
    setPasswordInput('')

    createSession(connectingHost)
    setConnectingHost(null)
  }

  const handlePasswordCancel = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    setShowPasswordModal(false)
    setPasswordInput('')
    setConnectingHost(null)
  }

  const handleConnectingCancel = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    setConnecting(false)
    setConnectingHost(null)
  }

  const fetchHosts = () => {
    fetch('/api/hosts')
      .then(res => res.json())
      .then(data => setHosts(data))
      .catch(err => console.error('Failed to fetch hosts:', err))
  }

  useEffect(() => {
    fetchHosts()
  }, [])

  const handleAddHost = async () => {
    if (!newHost.name.trim()) {
      setError('Host name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHost),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to add host')
        return
      }

      setShowAddModal(false)
      setNewHost({ name: '', hostname: '', user: '', port: '' })
      fetchHosts()
    } catch (err) {
      setError('Failed to add host')
    } finally {
      setSaving(false)
    }
  }

  const handleEditHost = async () => {
    if (!editHost.name.trim()) {
      setError('Host name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/hosts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editHost),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to update host')
        return
      }

      setShowEditModal(false)
      setEditHost({ oldName: '', name: '', hostname: '', user: '', port: '' })
      fetchHosts()
    } catch (err) {
      setError('Failed to update host')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteHost = async () => {
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/hosts?name=${encodeURIComponent(deleteHostName)}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to delete host')
        return
      }

      setShowDeleteModal(false)
      setDeleteHostName('')
      fetchHosts()
    } catch (err) {
      setError('Failed to delete host')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (host: SSHHost) => {
    setEditHost({
      oldName: host.name,
      name: host.name,
      hostname: host.hostname || '',
      user: host.user || '',
      port: host.port || '',
    })
    setError('')
    setShowEditModal(true)
  }

  const openDeleteModal = (name: string) => {
    setDeleteHostName(name)
    setShowDeleteModal(true)
  }

  // Resume an existing session
  const resumeSession = (sessionId: string) => {
    switchToSession(sessionId)
  }

  // Confirm delete session
  const confirmDeleteSession = (sessionId: string, sessionName: string) => {
    setDeleteSessionId(sessionId)
    setDeleteSessionName(sessionName)
    setShowDeleteSessionModal(true)
  }

  // Handle delete session
  const handleDeleteSession = () => {
    if (!deleteSessionId) return
    closeSession(deleteSessionId)
    setShowDeleteSessionModal(false)
    setDeleteSessionId(null)
    setDeleteSessionName('')
  }

  return (
    <div className="app">
      <main className="content">
        {activeTab === 'hosts' && (
          <>
            <div className="page-header">
              <div className="page-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </div>
              <div>
                <h1 className="title">Hosts</h1>
                <p className="subtitle">Connect to local or remote servers</p>
              </div>
            </div>
            <div className="panel">
              <div className="host-list">
                <button className="host-btn local" onClick={() => openTerminal('local')}>
                  <div className="host-btn-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                  </div>
                  <div className="host-btn-text">
                    <div className="host-btn-name">Local</div>
                    <div className="host-btn-detail">This device</div>
                  </div>
                </button>
                {hosts.map((host) => (
                  <div key={host.name} className="host-item" onClick={() => openTerminal(host.name)}>
                    <div className="host-item-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="20" height="8" rx="2" />
                        <rect x="2" y="14" width="20" height="8" rx="2" />
                        <line x1="6" y1="6" x2="6.01" y2="6" />
                        <line x1="6" y1="18" x2="6.01" y2="18" />
                      </svg>
                    </div>
                    <div className="host-info">
                      <span className="host-name">{host.name}</span>
                      {host.hostname && <span className="host-detail">{host.user ? `${host.user}@` : ''}{host.hostname}{host.port && host.port !== '22' ? `:${host.port}` : ''}</span>}
                    </div>
                    <div className="host-actions">
                      <button className="action-btn" onClick={(e) => { e.stopPropagation(); openEditModal(host); }} title="Edit">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); openDeleteModal(host.name); }} title="Delete">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                <button className="host-btn add" onClick={() => setShowAddModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Remote Host
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'sessions' && (
          <>
            <div className="page-header">
              <div className="page-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="9" rx="1" />
                  <rect x="14" y="3" width="7" height="5" rx="1" />
                  <rect x="14" y="12" width="7" height="9" rx="1" />
                  <rect x="3" y="16" width="7" height="5" rx="1" />
                </svg>
              </div>
              <div>
                <h1 className="title">Sessions</h1>
                <p className="subtitle">Switch between active sessions</p>
              </div>
            </div>
            <div className="panel">
              {sessions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="7" height="9" rx="1" />
                      <rect x="14" y="3" width="7" height="5" rx="1" />
                      <rect x="14" y="12" width="7" height="9" rx="1" />
                      <rect x="3" y="16" width="7" height="5" rx="1" />
                    </svg>
                  </div>
                  <p>No active sessions</p>
                  <p style={{ fontSize: '0.85rem' }}>Connect to a host to start a session</p>
                </div>
              ) : (
                <div className="host-list">
                  {sessions.map((session) => (
                    <div key={session.id} className="host-item" onClick={() => resumeSession(session.id)}>
                      <div className="host-item-icon">
                        {session.host === 'local' ? (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <path d="M8 21h8M12 17v4" />
                          </svg>
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="2" width="20" height="8" rx="2" />
                            <rect x="2" y="14" width="20" height="8" rx="2" />
                            <line x1="6" y1="6" x2="6.01" y2="6" />
                            <line x1="6" y1="18" x2="6.01" y2="18" />
                          </svg>
                        )}
                      </div>
                      <div className="host-info">
                        <span className="host-name">{session.name}</span>
                        <span className="host-detail">{session.workspacePath ? session.workspacePath.split('/').pop() : '~'}</span>
                      </div>
                      <div className="host-actions">
                        <button
                          className="action-btn delete"
                          onClick={(e) => { e.stopPropagation(); confirmDeleteSession(session.id, session.name); }}
                          title="Close Session"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-btn ${activeTab === 'hosts' ? 'active' : ''}`}
          onClick={() => setActiveTab('hosts')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          <span className="nav-label">Hosts</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
          <span className="nav-label">Sessions</span>
          {sessions.length > 0 && (
            <span className="nav-badge">{sessions.length}</span>
          )}
        </button>
      </nav>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={handlePasswordCancel}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Authentication Required</h2>
            <p style={{ color: '#888', marginBottom: '16px' }}>{passwordPrompt}</p>
            <div className="form-group">
              <input
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handlePasswordSubmit()
                  if (e.key === 'Escape') handlePasswordCancel()
                }}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={handlePasswordCancel}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handlePasswordSubmit}>
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connecting Overlay */}
      {connecting && (
        <div className="modal-overlay" onClick={handleConnectingCancel}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="connecting-spinner" />
            <p style={{ color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>Connecting</p>
            <p style={{ color: '#888', fontSize: '0.9rem' }}>{connectingHost}</p>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-cancel" onClick={handleConnectingCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Host Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Add SSH Host</h2>

            {error && <div className="modal-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="my-server"
                value={newHost.name}
                onChange={e => setNewHost({ ...newHost, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hostname</label>
              <input
                type="text"
                className="form-input"
                placeholder="192.168.1.100 or example.com"
                value={newHost.hostname}
                onChange={e => setNewHost({ ...newHost, hostname: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">User</label>
              <input
                type="text"
                className="form-input"
                placeholder="root"
                value={newHost.user}
                onChange={e => setNewHost({ ...newHost, user: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Port</label>
              <input
                type="text"
                className="form-input"
                placeholder="22"
                value={newHost.port}
                onChange={e => setNewHost({ ...newHost, port: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddHost} disabled={saving}>
                {saving ? 'Adding...' : 'Add Host'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Host Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Edit SSH Host</h2>

            {error && <div className="modal-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="my-server"
                value={editHost.name}
                onChange={e => setEditHost({ ...editHost, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hostname</label>
              <input
                type="text"
                className="form-input"
                placeholder="192.168.1.100 or example.com"
                value={editHost.hostname}
                onChange={e => setEditHost({ ...editHost, hostname: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">User</label>
              <input
                type="text"
                className="form-input"
                placeholder="root"
                value={editHost.user}
                onChange={e => setEditHost({ ...editHost, user: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Port</label>
              <input
                type="text"
                className="form-input"
                placeholder="22"
                value={editHost.port}
                onChange={e => setEditHost({ ...editHost, port: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleEditHost} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Host Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="delete-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <h2 className="modal-title" style={{ marginBottom: '12px' }}>Delete Host?</h2>
            <p style={{ color: '#999', marginBottom: '8px', fontSize: '0.95rem' }}>
              <strong style={{ color: '#fff' }}>{deleteHostName}</strong>
            </p>
            <p style={{ color: '#666', fontSize: '0.85rem' }}>
              This will remove it from your SSH config.
            </p>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteHost} disabled={saving}>
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Session Confirmation Modal */}
      {showDeleteSessionModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteSessionModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="delete-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
            </div>
            <h2 className="modal-title" style={{ marginBottom: '12px' }}>Close Session?</h2>
            <p style={{ color: '#999', marginBottom: '8px', fontSize: '0.95rem' }}>
              <strong style={{ color: '#fff' }}>{deleteSessionName}</strong>
            </p>
            <p style={{ color: '#666', fontSize: '0.85rem' }}>
              This will close the session and lose any unsaved work.
            </p>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setShowDeleteSessionModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteSession}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
