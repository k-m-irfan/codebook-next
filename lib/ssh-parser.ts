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
