import { readFileSync, existsSync } from 'fs'
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
