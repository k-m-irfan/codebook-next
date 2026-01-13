'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SSHHost {
  name: string
  hostname?: string
  user?: string
  port?: string
}

type Tab = 'hosts' | 'sessions'

export default function Home() {
  const router = useRouter()
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
      router.push(`/terminal/${encodeURIComponent(host)}`)
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
        router.push(`/terminal/${encodeURIComponent(host)}`)
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

    // Close test connection and navigate
    wsRef.current.close()
    setShowPasswordModal(false)
    setPasswordInput('')

    router.push(`/terminal/${encodeURIComponent(connectingHost)}`)
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

  return (
    <div className="app">
      <main className="content">
        {activeTab === 'hosts' && (
          <>
            <h1 className="title">Hosts</h1>
            <div className="panel">
              <div className="host-list">
                <button className="host-btn local" onClick={() => openTerminal('local')}>
                  Local
                </button>
                <button className="host-btn add" onClick={() => setShowAddModal(true)}>+ Add Remote</button>
                {hosts.map((host) => (
                  <div key={host.name} className="host-item" onClick={() => openTerminal(host.name)}>
                    <div className="host-info">
                      <span className="host-name">{host.name}</span>
                    </div>
                    <div className="host-actions">
                      <button className="action-btn" onClick={(e) => { e.stopPropagation(); openEditModal(host); }} title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); openDeleteModal(host.name); }} title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'sessions' && (
          <>
            <h1 className="title">Sessions</h1>
            <div className="panel">
              <p className="empty-state">No active sessions</p>
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
        </button>
        <button
          className="nav-btn"
          onClick={() => router.push('/local-terminal')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="nav-label">Terminal</span>
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
        <div className="modal-overlay">
          <div className="modal" style={{ textAlign: 'center' }}>
            <p style={{ color: '#fff' }}>Connecting to {connectingHost}...</p>
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Delete Host</h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>
              Are you sure you want to delete <strong style={{ color: '#fff' }}>{deleteHostName}</strong>? This will remove it from your SSH config.
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
    </div>
  )
}
