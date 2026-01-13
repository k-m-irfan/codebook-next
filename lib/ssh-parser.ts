import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface SSHHost {
  name: string
  hostname?: string
  user?: string
  port?: string
}

export function parseSSHConfig(): SSHHost[] {
  const configPath = join(homedir(), '.ssh', 'config')

  if (!existsSync(configPath)) {
    return []
  }

  const content = readFileSync(configPath, 'utf-8')
  const lines = content.split('\n')
  const hosts: SSHHost[] = []
  let currentHost: SSHHost | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('#') || trimmed === '') {
      continue
    }

    const [key, ...valueParts] = trimmed.split(/\s+/)
    const value = valueParts.join(' ')

    if (key.toLowerCase() === 'host') {
      if (currentHost) {
        hosts.push(currentHost)
      }
      // Skip wildcard hosts
      if (value !== '*') {
        currentHost = { name: value }
      } else {
        currentHost = null
      }
    } else if (currentHost) {
      switch (key.toLowerCase()) {
        case 'hostname':
          currentHost.hostname = value
          break
        case 'user':
          currentHost.user = value
          break
        case 'port':
          currentHost.port = value
          break
      }
    }
  }

  if (currentHost) {
    hosts.push(currentHost)
  }

  return hosts
}

export function addSSHHost(host: SSHHost): void {
  const sshDir = join(homedir(), '.ssh')
  const configPath = join(sshDir, 'config')

  // Ensure .ssh directory exists
  if (!existsSync(sshDir)) {
    mkdirSync(sshDir, { mode: 0o700 })
  }

  // Build the new host entry
  let entry = `\nHost ${host.name}\n`
  if (host.hostname) {
    entry += `  HostName ${host.hostname}\n`
  }
  if (host.user) {
    entry += `  User ${host.user}\n`
  }
  if (host.port) {
    entry += `  Port ${host.port}\n`
  }

  // Read existing config or start fresh
  let existingContent = ''
  if (existsSync(configPath)) {
    existingContent = readFileSync(configPath, 'utf-8')
  }

  // Append new host
  writeFileSync(configPath, existingContent + entry, { mode: 0o600 })
}

export function updateSSHHost(oldName: string, host: SSHHost): void {
  const configPath = join(homedir(), '.ssh', 'config')

  if (!existsSync(configPath)) {
    throw new Error('SSH config file not found')
  }

  const content = readFileSync(configPath, 'utf-8')
  const lines = content.split('\n')
  const newLines: string[] = []
  let skipUntilNextHost = false
  let hostFound = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.toLowerCase().startsWith('host ')) {
      const hostName = trimmed.substring(5).trim()
      if (hostName === oldName) {
        // Found the host to update - skip its lines and insert new ones
        skipUntilNextHost = true
        hostFound = true

        // Add the updated host entry (trim values to avoid encoding issues)
        newLines.push(`Host ${host.name.trim()}`)
        if (host.hostname && host.hostname.trim()) {
          newLines.push(`  HostName ${host.hostname.trim()}`)
        }
        if (host.user && host.user.trim()) {
          newLines.push(`  User ${host.user.trim()}`)
        }
        if (host.port && host.port.trim()) {
          newLines.push(`  Port ${host.port.trim()}`)
        }
        continue
      } else {
        skipUntilNextHost = false
      }
    }

    if (!skipUntilNextHost) {
      newLines.push(line)
    }
  }

  if (!hostFound) {
    throw new Error('Host not found')
  }

  writeFileSync(configPath, newLines.join('\n'), { mode: 0o600 })
}

export function deleteSSHHost(name: string): void {
  const configPath = join(homedir(), '.ssh', 'config')

  if (!existsSync(configPath)) {
    throw new Error('SSH config file not found')
  }

  const content = readFileSync(configPath, 'utf-8')
  const lines = content.split('\n')
  const newLines: string[] = []
  let skipUntilNextHost = false
  let hostFound = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.toLowerCase().startsWith('host ')) {
      const hostName = trimmed.substring(5).trim()
      if (hostName === name) {
        // Found the host to delete - skip its lines
        skipUntilNextHost = true
        hostFound = true
        continue
      } else {
        skipUntilNextHost = false
      }
    }

    if (!skipUntilNextHost) {
      newLines.push(line)
    }
  }

  if (!hostFound) {
    throw new Error('Host not found')
  }

  // Clean up extra blank lines
  const cleanedContent = newLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  writeFileSync(configPath, cleanedContent + '\n', { mode: 0o600 })
}
