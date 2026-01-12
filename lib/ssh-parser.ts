import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface SSHHost {
  name: string;
  hostname?: string;
  user?: string;
}

export function parseSSHConfig(): SSHHost[] {
  try {
    const configPath = join(homedir(), '.ssh', 'config');
    const content = readFileSync(configPath, 'utf-8');
    
    const hosts: SSHHost[] = [];
    const lines = content.split('\n');
    let currentHost: SSHHost | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('Host ')) {
        if (currentHost) {
          hosts.push(currentHost);
        }
        const hostName = trimmed.substring(5).trim();
        currentHost = { name: hostName };
      } else if (currentHost) {
        if (trimmed.startsWith('HostName ')) {
          currentHost.hostname = trimmed.substring(9).trim();
        } else if (trimmed.startsWith('User ')) {
          currentHost.user = trimmed.substring(5).trim();
        }
      }
    }
    
    if (currentHost) {
      hosts.push(currentHost);
    }
    
    return hosts;
  } catch (error) {
    console.error('Error reading SSH config:', error);
    return [];
  }
}
