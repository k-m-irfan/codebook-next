'use client'

import { useEffect, useState } from 'react'
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

  const openTerminal = (host: string) => {
    router.push(`/terminal/${encodeURIComponent(host)}`)
  }

  useEffect(() => {
    fetch('/api/hosts')
      .then(res => res.json())
      .then(data => setHosts(data))
      .catch(err => console.error('Failed to fetch hosts:', err))
  }, [])

  return (
    <div className="app">
      <main className="content">
        {activeTab === 'hosts' && (
          <>
            <h1 className="title">Hosts</h1>
            <div className="panel">
              <div className="host-grid">
                <button className="host-btn local" onClick={() => openTerminal('local')}>
                  Local
                </button>
                {hosts.map((host) => (
                  <button key={host.name} className="host-btn" onClick={() => openTerminal(host.name)}>
                    {host.name}
                  </button>
                ))}
                <button className="host-btn add">+ Add</button>
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
          <span className="nav-icon">🖥️</span>
          <span className="nav-label">Hosts</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <span className="nav-icon">📺</span>
          <span className="nav-label">Sessions</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">Settings</span>
        </button>
      </nav>
    </div>
  )
}
