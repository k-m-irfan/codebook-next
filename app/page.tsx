'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SSHHost {
  name: string
  hostname?: string
  user?: string
  port?: string
}

type Tab = 'hosts' | 'sessions' | 'settings'

export default function Home() {
  const router = useRouter()
  const [hosts, setHosts] = useState<SSHHost[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('hosts')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newHost, setNewHost] = useState<SSHHost>({ name: '', hostname: '', user: '', port: '' })
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
                <button className="host-btn add" onClick={() => setShowAddModal(true)}>+ Add</button>
                {hosts.map((host) => (
                  <button key={host.name} className="host-btn" onClick={() => openTerminal(host.name)}>
                    {host.name}
                  </button>
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

        {activeTab === 'settings' && (
          <>
            <h1 className="title">Settings</h1>
            <div className="panel">
              <div className="settings-list">
                <div className="settings-item">
                  <span className="settings-label">Theme</span>
                  <span className="settings-value">Dark</span>
                </div>
                <div className="settings-item">
                  <span className="settings-label">Default Shell</span>
                  <span className="settings-value">/bin/zsh</span>
                </div>
                <div className="settings-item">
                  <span className="settings-label">Font Size</span>
                  <span className="settings-value">14px</span>
                </div>
                <div className="settings-item">
                  <span className="settings-label">SSH Key Path</span>
                  <span className="settings-value">~/.ssh/id_rsa</span>
                </div>
              </div>
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
            <path d="M4 17l6-6-6-6M12 19h8" />
          </svg>
          <span className="nav-label">Sessions</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span className="nav-label">Settings</span>
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
    </div>
  )
}
