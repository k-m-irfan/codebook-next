'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<any>(null);
  const fitAddon = useRef<any>(null);
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hostname = decodeURIComponent(params.hostname as string);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Dynamically import xterm only on client side
    import('xterm').then(({ Terminal }) => {
      import('xterm-addon-fit').then(({ FitAddon }) => {
        import('xterm-addon-web-links').then(({ WebLinksAddon }) => {
          import('xterm/css/xterm.css');

          // Initialize terminal
          terminal.current = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
              background: '#1e1e1e',
              foreground: '#d4d4d4',
            },
          });

          fitAddon.current = new FitAddon();
          terminal.current.loadAddon(fitAddon.current);
          terminal.current.loadAddon(new WebLinksAddon());

          terminal.current.open(terminalRef.current);
          fitAddon.current.fit();

          // Connect WebSocket
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal?host=${encodeURIComponent(hostname)}`;
          
          ws.current = new WebSocket(wsUrl);

          ws.current.onopen = () => {
            setConnected(true);
            setError(null);
          };

          ws.current.onmessage = (event) => {
            if (terminal.current) {
              terminal.current.write(event.data);
            }
          };

          ws.current.onerror = (err) => {
            setError('Connection error');
            console.error('WebSocket error:', err);
          };

          ws.current.onclose = () => {
            setConnected(false);
            if (terminal.current) {
              terminal.current.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n');
            }
          };

          // Send terminal input to WebSocket
          const disposable = terminal.current.onData((data: string) => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(data);
            }
          });

          // Handle window resize
          const handleResize = () => {
            if (fitAddon.current && terminal.current) {
              fitAddon.current.fit();
              const dimensions = {
                cols: terminal.current.cols,
                rows: terminal.current.rows,
              };
              if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ type: 'resize', ...dimensions }));
              }
            }
          };

          window.addEventListener('resize', handleResize);

          // Cleanup function
          return () => {
            disposable.dispose();
            window.removeEventListener('resize', handleResize);
            if (ws.current) {
              ws.current.close();
            }
            if (terminal.current) {
              terminal.current.dispose();
            }
          };
        });
      });
    });
  }, [hostname]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/hosts')}
            className="text-gray-300 hover:text-white"
          >
            ← Back
          </button>
          <h1 className="text-white font-medium">{hostname}</h1>
          <div className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-400">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
      {error && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm">
          {error}
        </div>
      )}
      <div className="flex-1 p-4">
        <div ref={terminalRef} className="h-full" />
      </div>
    </div>
  );
}
