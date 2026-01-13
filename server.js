const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')
const { Client } = require('ssh2')
const os = require('os')
const fs = require('fs')
const fsPromises = require('fs').promises
const path = require('path')
const { spawn } = require('child_process')

// Try to load node-pty, fall back to child_process wrapper
let pty = null
try {
  pty = require('node-pty')
  console.log('Using node-pty for terminal')
} catch (e) {
  console.log('node-pty not available, using child_process fallback')
}

// Fallback PTY implementation for Termux/Linux without node-pty
class FallbackPty {
  constructor(shell, args, options) {
    this.shell = shell
    this.options = options
    this.dataCallbacks = []
    this.exitCallbacks = []
    this.cols = options.cols || 80
    this.rows = options.rows || 24

    // Try different methods to get a PTY-like experience
    // Method 1: Use 'script' with Termux-compatible flags
    // Method 2: Direct shell spawn as fallback

    let spawnCmd, spawnArgs

    // Check if we're on Termux (Android)
    const isTermux = process.platform === 'android' ||
                     process.env.TERMUX_VERSION ||
                     process.env.PREFIX?.includes('com.termux')

    if (isTermux) {
      // On Termux, use script command which is available via util-linux
      // script -q -c "bash -i" /dev/null creates a proper PTY
      spawnCmd = 'script'
      spawnArgs = ['-q', '-c', `${shell} -i`, '/dev/null']
    } else {
      // On regular Linux, try script command
      spawnCmd = 'script'
      spawnArgs = ['-q', '/dev/null', shell, ...args]
    }

    console.log(`FallbackPty: spawning ${spawnCmd} with args:`, spawnArgs)

    this.process = spawn(spawnCmd, spawnArgs, {
      cwd: options.cwd || os.homedir(),
      env: {
        ...process.env,
        ...options.env,
        TERM: 'xterm-256color',
        COLUMNS: String(this.cols),
        LINES: String(this.rows),
        PS1: '\\u@\\h:\\w\\$ '  // Set a simple prompt
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Handle stdout
    this.process.stdout.on('data', (data) => {
      this.dataCallbacks.forEach(cb => cb(data.toString()))
    })

    // Handle stderr - also send to terminal
    this.process.stderr.on('data', (data) => {
      this.dataCallbacks.forEach(cb => cb(data.toString()))
    })

    // Handle exit
    this.process.on('exit', (code) => {
      console.log('FallbackPty: process exited with code', code)
      this.exitCallbacks.forEach(cb => cb(code))
    })

    this.process.on('error', (err) => {
      console.error('FallbackPty: spawn error', err)
      this.dataCallbacks.forEach(cb => cb(`\r\nError: ${err.message}\r\n`))
    })

  }

  onData(callback) {
    this.dataCallbacks.push(callback)
  }

  onExit(callback) {
    this.exitCallbacks.push(callback)
  }

  write(data) {
    if (this.process.stdin.writable) {
      this.process.stdin.write(data)
    }
  }

  resize(cols, rows) {
    this.cols = cols
    this.rows = rows
  }

  kill() {
    this.process.kill('SIGHUP')
  }
}

// PTY spawn function that works with both node-pty and fallback
function spawnPty(shell, args, options) {
  if (pty) {
    return pty.spawn(shell, args, options)
  }
  return new FallbackPty(shell, args, options)
}

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

// Format file stats to FileEntry
function formatFileEntry(name, stats, parentPath) {
  return {
    name,
    path: path.join(parentPath, name),
    isDirectory: stats.isDirectory(),
    size: stats.size,
    modified: stats.mtime.toISOString(),
  }
}

// Handle local file operations
async function handleLocalFileOperation(ws, message) {
  const { type, requestId } = message

  try {
    switch (type) {
      case 'file:list': {
        const dirPath = message.path || os.homedir()
        const items = await fsPromises.readdir(dirPath, { withFileTypes: true })
        const entries = await Promise.all(
          items.map(async (item) => {
            try {
              const fullPath = path.join(dirPath, item.name)
              const stats = await fsPromises.stat(fullPath)
              return formatFileEntry(item.name, stats, dirPath)
            } catch (err) {
              // Skip files we can't stat
              return null
            }
          })
        )
        ws.send(JSON.stringify({
          type: 'file:list:response',
          requestId,
          success: true,
          entries: entries.filter(Boolean),
        }))
        break
      }

      case 'file:read': {
        const filePath = message.path
        const stats = await fsPromises.stat(filePath)

        // Check if file is too large (>5MB)
        if (stats.size > 5 * 1024 * 1024) {
          ws.send(JSON.stringify({
            type: 'file:read:response',
            requestId,
            success: false,
            error: 'File too large (>5MB)',
          }))
          break
        }

        const content = await fsPromises.readFile(filePath)
        // Try to detect if binary
        const isBinary = content.includes(0x00)

        ws.send(JSON.stringify({
          type: 'file:read:response',
          requestId,
          success: true,
          content: isBinary ? content.toString('base64') : content.toString('utf8'),
          encoding: isBinary ? 'base64' : 'utf8',
          size: stats.size,
        }))
        break
      }

      case 'file:write': {
        const filePath = message.path
        const content = message.encoding === 'base64'
          ? Buffer.from(message.content, 'base64')
          : message.content
        await fsPromises.writeFile(filePath, content)
        ws.send(JSON.stringify({
          type: 'file:operation:response',
          requestId,
          success: true,
        }))
        break
      }

      case 'file:create': {
        const filePath = message.path
        if (message.isDirectory) {
          await fsPromises.mkdir(filePath, { recursive: true })
        } else {
          await fsPromises.writeFile(filePath, '')
        }
        ws.send(JSON.stringify({
          type: 'file:operation:response',
          requestId,
          success: true,
        }))
        break
      }

      case 'file:delete': {
        const filePath = message.path
        if (message.recursive) {
          await fsPromises.rm(filePath, { recursive: true, force: true })
        } else {
          const stats = await fsPromises.stat(filePath)
          if (stats.isDirectory()) {
            await fsPromises.rmdir(filePath)
          } else {
            await fsPromises.unlink(filePath)
          }
        }
        ws.send(JSON.stringify({
          type: 'file:operation:response',
          requestId,
          success: true,
        }))
        break
      }

      case 'file:rename': {
        await fsPromises.rename(message.oldPath, message.newPath)
        ws.send(JSON.stringify({
          type: 'file:operation:response',
          requestId,
          success: true,
        }))
        break
      }

      default:
        ws.send(JSON.stringify({
          type: 'file:operation:response',
          requestId,
          success: false,
          error: `Unknown file operation: ${type}`,
        }))
    }
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'file:operation:response',
      requestId,
      success: false,
      error: err.message,
    }))
  }
}

// Handle SSH/SFTP file operations
function handleSFTPFileOperation(ws, sftp, message) {
  const { type, requestId } = message

  switch (type) {
    case 'file:list': {
      const dirPath = message.path || '/home'
      sftp.readdir(dirPath, (err, list) => {
        if (err) {
          ws.send(JSON.stringify({
            type: 'file:list:response',
            requestId,
            success: false,
            error: err.message,
          }))
          return
        }
        const entries = list.map((item) => ({
          name: item.filename,
          path: path.posix.join(dirPath, item.filename),
          isDirectory: item.attrs.isDirectory(),
          size: item.attrs.size,
          modified: new Date(item.attrs.mtime * 1000).toISOString(),
        }))
        ws.send(JSON.stringify({
          type: 'file:list:response',
          requestId,
          success: true,
          entries,
        }))
      })
      break
    }

    case 'file:read': {
      const filePath = message.path
      sftp.stat(filePath, (err, stats) => {
        if (err) {
          ws.send(JSON.stringify({
            type: 'file:read:response',
            requestId,
            success: false,
            error: err.message,
          }))
          return
        }

        // Check if file is too large (>5MB)
        if (stats.size > 5 * 1024 * 1024) {
          ws.send(JSON.stringify({
            type: 'file:read:response',
            requestId,
            success: false,
            error: 'File too large (>5MB)',
          }))
          return
        }

        sftp.readFile(filePath, (err, content) => {
          if (err) {
            ws.send(JSON.stringify({
              type: 'file:read:response',
              requestId,
              success: false,
              error: err.message,
            }))
            return
          }

          // Try to detect if binary
          const isBinary = content.includes(0x00)

          ws.send(JSON.stringify({
            type: 'file:read:response',
            requestId,
            success: true,
            content: isBinary ? content.toString('base64') : content.toString('utf8'),
            encoding: isBinary ? 'base64' : 'utf8',
            size: stats.size,
          }))
        })
      })
      break
    }

    case 'file:write': {
      const filePath = message.path
      const content = message.encoding === 'base64'
        ? Buffer.from(message.content, 'base64')
        : Buffer.from(message.content, 'utf8')

      sftp.writeFile(filePath, content, (err) => {
        ws.send(JSON.stringify({
          type: 'file:operation:response',
          requestId,
          success: !err,
          error: err?.message,
        }))
      })
      break
    }

    case 'file:create': {
      const filePath = message.path
      if (message.isDirectory) {
        sftp.mkdir(filePath, (err) => {
          ws.send(JSON.stringify({
            type: 'file:operation:response',
            requestId,
            success: !err,
            error: err?.message,
          }))
        })
      } else {
        sftp.writeFile(filePath, '', (err) => {
          ws.send(JSON.stringify({
            type: 'file:operation:response',
            requestId,
            success: !err,
            error: err?.message,
          }))
        })
      }
      break
    }

    case 'file:delete': {
      const filePath = message.path
      sftp.stat(filePath, (err, stats) => {
        if (err) {
          ws.send(JSON.stringify({
            type: 'file:operation:response',
            requestId,
            success: false,
            error: err.message,
          }))
          return
        }

        if (stats.isDirectory()) {
          sftp.rmdir(filePath, (err) => {
            ws.send(JSON.stringify({
              type: 'file:operation:response',
              requestId,
              success: !err,
              error: err?.message,
            }))
          })
        } else {
          sftp.unlink(filePath, (err) => {
            ws.send(JSON.stringify({
              type: 'file:operation:response',
              requestId,
              success: !err,
              error: err?.message,
            }))
          })
        }
      })
      break
    }

    case 'file:rename': {
      sftp.rename(message.oldPath, message.newPath, (err) => {
        ws.send(JSON.stringify({
          type: 'file:operation:response',
          requestId,
          success: !err,
          error: err?.message,
        }))
      })
      break
    }

    default:
      ws.send(JSON.stringify({
        type: 'file:operation:response',
        requestId,
        success: false,
        error: `Unknown file operation: ${type}`,
      }))
  }
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
      // Local terminal + file operations
      const shell = getDefaultShell()
      console.log(`Starting local terminal with shell: ${shell}`)

      let ptyProcess
      try {
        ptyProcess = spawnPty(shell, [], {
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
          } else if (parsed.type?.startsWith('file:')) {
            // Handle file operations
            handleLocalFileOperation(ws, parsed)
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
      // SSH connection + SFTP file operations
      const hosts = parseSSHConfig()
      const hostConfig = hosts[hostName]

      if (!hostConfig) {
        ws.send(`\r\nError: Host "${hostName}" not found in SSH config\r\n`)
        ws.close()
        return
      }

      let conn = new Client()
      let sftpSession = null
      let shellStream = null

      let pendingPassword = null
      let passwordResolver = null

      conn.on('ready', () => {
        console.log(`SSH connected to ${hostName}`)

        conn.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            ws.send(`\r\nError: ${err.message}\r\n`)
            ws.close()
            return
          }

          shellStream = stream

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
        })
      })

      conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
        console.log(`Keyboard-interactive auth requested for ${hostName}`)

        // Request password from client
        ws.send(JSON.stringify({
          type: 'auth:password-required',
          prompts: prompts.map(p => ({ prompt: p.prompt, echo: p.echo }))
        }))

        // Wait for password from client
        passwordResolver = (responses) => {
          finish(responses)
        }
      })

      // Handle messages
      ws.on('message', (message) => {
        const msg = message.toString()
        try {
          const parsed = JSON.parse(msg)
          if (parsed.type === 'resize') {
            if (shellStream) {
              shellStream.setWindow(parsed.rows, parsed.cols, 0, 0)
            }
          } else if (parsed.type === 'auth:password') {
            // Handle password submission
            if (passwordResolver) {
              passwordResolver(parsed.responses || [parsed.password])
              passwordResolver = null
            }
          } else if (parsed.type?.startsWith('file:')) {
            // Handle file operations via SFTP
            if (!sftpSession) {
              // Lazy-initialize SFTP session
              conn.sftp((err, sftp) => {
                if (err) {
                  ws.send(JSON.stringify({
                    type: 'file:operation:response',
                    requestId: parsed.requestId,
                    success: false,
                    error: `SFTP error: ${err.message}`,
                  }))
                  return
                }
                sftpSession = sftp
                handleSFTPFileOperation(ws, sftp, parsed)
              })
            } else {
              handleSFTPFileOperation(ws, sftpSession, parsed)
            }
          }
        } catch {
          // Not JSON, treat as terminal input
          if (shellStream) {
            shellStream.write(msg)
          }
        }
      })

      // Build connection config
      const connectConfig = {
        host: hostConfig.hostname || hostConfig.name,
        port: parseInt(hostConfig.port) || 22,
        username: hostConfig.user || os.userInfo().username,
        tryKeyboard: true, // Enable keyboard-interactive for password fallback
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

      let waitingForPassword = false

      // Handle WebSocket close
      ws.on('close', () => {
        passwordResolver = null
        if (shellStream) {
          shellStream.close()
        }
        conn.end()
      })

      conn.on('ready', () => {
        console.log(`SSH connected to ${hostName}`)

        conn.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            ws.send(`\r\nError: ${err.message}\r\n`)
            ws.close()
            return
          }

          shellStream = stream

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
        })
      })

      // Handle keyboard-interactive auth - this is triggered when server asks for password
      conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
        console.log(`Keyboard-interactive auth requested for ${hostName}`)

        if (prompts.length > 0) {
          waitingForPassword = true
          ws.send(JSON.stringify({
            type: 'auth:password-required',
            prompts: prompts.map(p => ({ prompt: p.prompt, echo: p.echo }))
          }))

          // Wait for password from client and call finish
          passwordResolver = (responses) => {
            waitingForPassword = false
            finish(responses)
          }
        } else {
          finish([])
        }
      })

      conn.on('error', (err) => {
        console.log(`SSH error for ${hostName}:`, err.message)

        // Check if this is an auth failure - prompt for password
        const isAuthError = err.message.includes('All configured authentication methods failed') ||
                           err.message.includes('authentication failed') ||
                           err.level === 'client-authentication'

        if (isAuthError && !waitingForPassword) {
          // Auth failed, ask for password
          console.log(`Auth failed for ${hostName}, requesting password`)
          waitingForPassword = true
          ws.send(JSON.stringify({
            type: 'auth:password-required',
            prompts: [{ prompt: `Password for ${connectConfig.username}@${connectConfig.host}:`, echo: false }]
          }))

          // Set up password handler to create new connection with password
          passwordResolver = (responses) => {
            waitingForPassword = false
            const password = responses[0]

            // Create new connection with password
            const newConn = new Client()

            newConn.on('ready', () => {
              console.log(`SSH connected to ${hostName} with password`)
              conn = newConn

              newConn.shell({ term: 'xterm-256color' }, (err, stream) => {
                if (err) {
                  ws.send(`\r\nError: ${err.message}\r\n`)
                  ws.close()
                  return
                }

                shellStream = stream

                stream.on('data', (data) => {
                  try {
                    ws.send(data.toString())
                  } catch (e) {
                    // WebSocket closed
                  }
                })

                stream.on('close', () => {
                  newConn.end()
                  ws.close()
                })
              })

              sftpSession = null
            })

            newConn.on('error', (err) => {
              console.log(`SSH password auth error for ${hostName}:`, err.message)
              ws.send(`\r\nSSH Error: ${err.message}\r\n`)
              ws.close()
            })

            console.log(`Connecting to ${connectConfig.host}:${connectConfig.port} as ${connectConfig.username} with password`)
            newConn.connect({
              host: connectConfig.host,
              port: connectConfig.port,
              username: connectConfig.username,
              password: password
            })
          }
        } else if (!waitingForPassword) {
          ws.send(`\r\nSSH Error: ${err.message}\r\n`)
          ws.close()
        }
      })

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
