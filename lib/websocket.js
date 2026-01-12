const { Server } = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { spawn } = require('node-pty');
const { Client } = require('ssh2');
const { homedir } = require('os');
const { readFileSync } = require('fs');
const { join } = require('path');

let wss = null;

function parseSSHConfigForHost(hostname) {
  try {
    const configPath = join(homedir(), '.ssh', 'config');
    const content = readFileSync(configPath, 'utf-8');
    const lines = content.split('\n');
    
    let inHost = false;
    const config = { port: 22, identityFiles: [] };
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('Host ')) {
        const hostName = trimmed.substring(5).trim();
        inHost = hostName === hostname;
      } else if (inHost) {
        if (trimmed.startsWith('HostName ')) {
          config.hostname = trimmed.substring(9).trim();
        } else if (trimmed.startsWith('User ')) {
          config.user = trimmed.substring(5).trim();
        } else if (trimmed.startsWith('Port ')) {
          config.port = parseInt(trimmed.substring(5).trim(), 10);
        } else if (trimmed.startsWith('IdentityFile ')) {
          const identityFile = trimmed.substring(13).trim().replace('~', homedir());
          config.identityFiles.push(identityFile);
        } else if (trimmed.startsWith('ProxyCommand ')) {
          config.proxyCommand = trimmed.substring(13).trim();
        }
      }
    }
    
    // Add default identity files if none specified
    if (config.identityFiles.length === 0) {
      config.identityFiles = [
        join(homedir(), '.ssh', 'id_rsa'),
        join(homedir(), '.ssh', 'id_ed25519'),
        join(homedir(), '.ssh', 'id_ecdsa'),
      ];
    }
    
    return config;
  } catch (error) {
    console.error('Error parsing SSH config:', error);
    return {};
  }
}

function setupWebSocketServer(server) {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    
    if (url.pathname === '/api/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const hostname = url.searchParams.get('host');

    if (!hostname) {
      ws.close();
      return;
    }

    let ptyProcess = null;
    let sshClient = null;

    if (hostname === 'local') {
      // Local terminal
      const shell = process.env.SHELL || '/bin/zsh';
      ptyProcess = spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: homedir(),
        env: process.env,
      });

      ptyProcess.onData((data) => {
        try {
          ws.send(data);
        } catch (err) {
          console.error('Error sending data:', err);
        }
      });

      ptyProcess.onExit(() => {
        ws.close();
      });

      ws.on('message', (msg) => {
        const data = msg.toString();
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'resize') {
            ptyProcess.resize(parsed.cols, parsed.rows);
          }
        } catch {
          ptyProcess.write(data);
        }
      });
    } else {
      // SSH connection
      const config = parseSSHConfigForHost(hostname);
      
      if (!config.hostname || !config.user) {
        ws.send('Error: Invalid SSH configuration\r\n');
        ws.close();
        return;
      }

      sshClient = new Client();
      
      // Try to load private keys
      const privateKeys = [];
      for (const keyPath of config.identityFiles) {
        try {
          const key = readFileSync(keyPath);
          privateKeys.push(key);
        } catch (err) {
          // Key file doesn't exist or can't be read, skip it
        }
      }

      sshClient.on('ready', () => {
        ws.send(`Connected to ${hostname}\r\n`);
        
        sshClient.shell({ term: 'xterm-color' }, (err, stream) => {
          if (err) {
            ws.send(`Error: ${err.message}\r\n`);
            ws.close();
            return;
          }

          stream.on('data', (data) => {
            try {
              ws.send(data.toString());
            } catch (err) {
              console.error('Error sending data:', err);
            }
          });

          stream.on('close', () => {
            ws.close();
          });

          ws.on('message', (msg) => {
            const data = msg.toString();
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'resize') {
                stream.setWindow(parsed.rows, parsed.cols, 0, 0);
              }
            } catch {
              stream.write(data);
            }
          });
        });
      });

      sshClient.on('error', (err) => {
        ws.send(`SSH Error: ${err.message}\r\n`);
        ws.close();
      });

      const connectOptions = {
        host: config.hostname,
        port: config.port || 22,
        username: config.user,
        agent: process.env.SSH_AUTH_SOCK,
        tryKeyboard: true,
      };

      if (privateKeys.length > 0) {
        connectOptions.privateKey = privateKeys[0];
      }

      sshClient.connect(connectOptions);
    }

    ws.on('close', () => {
      if (ptyProcess) {
        ptyProcess.kill();
      }
      if (sshClient) {
        sshClient.end();
      }
    });
  });

  return wss;
}

module.exports = { setupWebSocketServer };
