const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')
const pty = require('@homebridge/node-pty-prebuilt-multiarch')
const { Client } = require('ssh2')
const os = require('os')
const fs = require('fs')
const path = require('path')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000
const wsPort = 3001 // Separate port for WebSocket to avoid HMR conflicts

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Parse SSH config to get host details
function parseSSHConfig() {
  const configPath = path.join(os.homedir(), '.ssh', 'config')
  if (!fs.existsSync(configPath)) return {}

  const content = fs.readFileSync(configPath, 'utf-8')
  const lines = content.split('\n')
  const hosts = {}
  let currentHost = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || trimmed === '') continue

    const [key, ...valueParts] = trimmed.split(/\s+/)
    const value = valueParts.join(' ')

    if (key.toLowerCase() === 'host' && value !== '*') {
      currentHost = value
      hosts[currentHost] = { name: currentHost }
    } else if (currentHost && hosts[currentHost]) {
      switch (key.toLowerCase()) {
        case 'hostname':
          hosts[currentHost].hostname = value
          break
        case 'user':
          hosts[currentHost].user = value
          break
        case 'port':
          hosts[currentHost].port = value
          break
        case 'identityfile':
          hosts[currentHost].identityFile = value.replace('~', os.homedir())
          break
      }
    }
  }
  return hosts
}

// Get default shell based on platform
function getDefaultShell() {
  if (process.platform === 'win32') {
    return 'powershell.exe'
  }
  // Works for Mac, Linux, and Termux
  return process.env.SHELL || '/bin/sh'
}

app.prepare().then(() => {
  // Next.js HTTP server - handles all HTTP requests and HMR WebSocket
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true)
    await handle(req, res, parsedUrl)
  })

  // Separate WebSocket server on different port to avoid HMR conflicts
  const wsServer = createServer()
  const wss = new WebSocketServer({ server: wsServer })

  wss.on('connection', (ws, req) => {
    const parsedUrl = parse(req.url, true)
    const hostName = parsedUrl.query.host

    if (hostName === 'local') {
      // Local terminal
      const shell = getDefaultShell()
      console.log(`Starting local terminal with shell: ${shell}`)

      let ptyProcess
      try {
        ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: os.homedir(),
          env: { ...process.env, TERM: 'xterm-256color' }
        })
      } catch (err) {
        console.error('Failed to spawn terminal:', err)
        ws.send(`\r\nError: Failed to start terminal - ${err.message}\r\n`)
        ws.close()
        return
      }

      ptyProcess.onData((data) => {
        try {
          ws.send(data)
        } catch (e) {
          // WebSocket closed
        }
      })

      ws.on('message', (message) => {
        const msg = message.toString()
        try {
          const parsed = JSON.parse(msg)
          if (parsed.type === 'resize') {
            ptyProcess.resize(parsed.cols, parsed.rows)
          }
        } catch {
          // Not JSON, treat as terminal input
          ptyProcess.write(msg)
        }
      })

      ws.on('close', () => {
        ptyProcess.kill()
      })

    } else {
      // SSH connection
      const hosts = parseSSHConfig()
      const hostConfig = hosts[hostName]

      if (!hostConfig) {
        ws.send(`\r\nError: Host "${hostName}" not found in SSH config\r\n`)
        ws.close()
        return
      }

      const conn = new Client()

      conn.on('ready', () => {
        conn.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            ws.send(`\r\nError: ${err.message}\r\n`)
            ws.close()
            return
          }

          stream.on('data', (data) => {
            try {
              ws.send(data.toString())
            } catch (e) {
              // WebSocket closed
            }
          })

          stream.on('close', () => {
            conn.end()
            ws.close()
          })

          ws.on('message', (message) => {
            const msg = message.toString()
            try {
              const parsed = JSON.parse(msg)
              if (parsed.type === 'resize') {
                stream.setWindow(parsed.rows, parsed.cols, 0, 0)
              }
            } catch {
              stream.write(msg)
            }
          })

          ws.on('close', () => {
            stream.close()
            conn.end()
          })
        })
      })

      conn.on('error', (err) => {
        ws.send(`\r\nSSH Error: ${err.message}\r\n`)
        ws.close()
      })

      // Build connection config
      const connectConfig = {
        host: hostConfig.hostname || hostConfig.name,
        port: parseInt(hostConfig.port) || 22,
        username: hostConfig.user || os.userInfo().username,
      }

      // Try to find a working private key
      const sshDir = path.join(os.homedir(), '.ssh')
      const keyTypes = ['id_ed25519', 'id_ecdsa', 'id_rsa', 'id_dsa']

      // First try the identity file from config
      if (hostConfig.identityFile && fs.existsSync(hostConfig.identityFile)) {
        connectConfig.privateKey = fs.readFileSync(hostConfig.identityFile)
        console.log(`Using identity file from config: ${hostConfig.identityFile}`)
      } else {
        // Try common key types
        for (const keyType of keyTypes) {
          const keyPath = path.join(sshDir, keyType)
          if (fs.existsSync(keyPath)) {
            connectConfig.privateKey = fs.readFileSync(keyPath)
            console.log(`Using key: ${keyPath}`)
            break
          }
        }
      }

      // Try ssh-agent if available
      if (process.env.SSH_AUTH_SOCK) {
        connectConfig.agent = process.env.SSH_AUTH_SOCK
        console.log(`Using SSH agent: ${process.env.SSH_AUTH_SOCK}`)
      }

      console.log(`Connecting to ${connectConfig.host}:${connectConfig.port} as ${connectConfig.username}`)
      conn.connect(connectConfig)
    }
  })

  // Start Next.js server
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })

  // Start WebSocket server on separate port
  wsServer.listen(wsPort, () => {
    console.log(`> WebSocket server on ws://${hostname}:${wsPort}`)
  })
})
