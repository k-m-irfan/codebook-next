const { WebSocketServer } = require('ws');
const { spawn } = require('node-pty');
const { Client } = require('ssh2');
const { parse } = require('url');
const fs = require('fs');
const os = require('os');
const path = require('path');

function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: any, socket: any, head: any) => {
    const { pathname } = parse(request.url);
    
    if (pathname === '/api/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const { query } = parse(request.url || '', true);
    const host = query.host || 'localhost';
    const isLocal = query.isLocal === 'true';

    let ptyProcess = null;
    let sshClient = null;
    let sshStream = null;

    if (isLocal) {
      // Local shell
      const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';
      
      ptyProcess = spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE,
        env: process.env,
      });

      ptyProcess.onData((data: string) => {
        try {
          ws.send(data);
        } catch (err) {
          console.error('Error sending data:', err);
        }
      });

      ptyProcess.onExit(() => {
        ws.close();
      });
    } else {
      // Remote SSH connection
      sshClient = new Client();
      
      sshClient.on('ready', () => {
        sshClient!.shell({ term: 'xterm-color' }, (err, stream) => {
          if (err) {
            ws.send(`\r\n\x1b[31mError creating shell: ${err.message}\x1b[0m\r\n`);
            ws.close();
            return;
          }

          sshStream = stream;

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

          stream.stderr.on('data', (data) => {
            try {
              ws.send(data.toString());
            } catch (err) {
              console.error('Error sending stderr:', err);
            }
          });
        });
      });

      sshClient.on('error', (err) => {
        ws.send(`\r\n\x1b[31mSSH Connection error: ${err.message}\x1b[0m\r\n`);
        ws.close();
      });

      // Connect to SSH host
      try {
        const sshConfig = getSSHConfig(host);
        sshClient.connect(sshConfig);
      } catch (err) {
        ws.send(`\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`);
        ws.close();
      }
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'input') {
          if (isLocal && ptyProcess) {
            ptyProcess.write(data.data);
          } else if (sshStream) {
            sshStream.write(data.data);
          }
        } else if (data.type === 'resize' && data.cols && data.rows) {
          if (isLocal && ptyProcess) {
            ptyProcess.resize(data.cols, data.rows);
          } else if (sshStream) {
            sshStream.setWindow(data.rows, data.cols, 0, 0);
          }
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });

    ws.on('close', () => {
      if (ptyProcess) {
        ptyProcess.kill();
      }
      if (sshClient) {
        sshClient.end();
      }
    });
  });
}

function getSSHConfig(host) {
  
  try {
    const configPath = path.join(os.homedir(), '.ssh', 'config');
    const content = fs.readFileSync(configPath, 'utf-8');
    const lines = content.split('\n');
    
    let currentHost: string | null = null;
    let hostname: string | undefined;
    let user: string | undefined;
    let port: numbe = null;
    let hostname = undefined;
    let user = undefined;
    let port= line.trim();
      
      if (trimmed.startsWith('Host ')) {
        if (currentHost === host && hostname) {
          break;
        }
        currentHost = trimmed.substring(5).trim();
        hostname = undefined;
        user = undefined;
        port = 22;
      } else if (currentHost === host) {
        if (trimmed.startsWith('HostName ')) {
          hostname = trimmed.substring(9).trim();
        } else if (trimmed.startsWith('User ')) {
          user = trimmed.substring(5).trim();
        } else if (trimmed.startsWith('Port ')) {
          port = parseInt(trimmed.substring(5).trim(), 10);
        }
      }
    }
    
    if (!hostname) {
      throw new Error(`Host ${host} not found in SSH config`);
    }
    
    // Try to find private key
    const keyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
    let privateKey: Buffer | undefined;
    
    try {
      if (fs.exist =ath)) {
        privateKey = fs.readFileSync(keyPath);
      }
    } catch (err) {
      // Key file not accessible, will try password auth
    }
    
    return {
      host: hostname,
      port,
      username: user || os.userInfo().username,
      privateKey,
      // Add more auth methods as fallback
      tryKeyboard: true,
    };
  } catch (err: any) {
    throw new Error(`Failed to read SSH config: ${err.message}`);
  }
}) {
    throw new Error(`Failed to read SSH config: ${err.message}`);
  }
}

module.exports = { setupWebSocketServer };