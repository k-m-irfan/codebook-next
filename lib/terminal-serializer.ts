// Terminal buffer serialization utilities
// Serialize and restore xterm.js terminal content

import type { Terminal } from '@xterm/xterm'

// Serialize terminal buffer to string (up to 5000 lines)
export function serializeTerminalBuffer(term: Terminal): string {
  try {
    const buffer = term.buffer.active
    const lines: string[] = []

    // Get last 5000 lines from scrollback + viewport
    const totalLines = buffer.length
    const startLine = Math.max(0, totalLines - 5000)

    for (let i = startLine; i < totalLines; i++) {
      const line = buffer.getLine(i)
      if (line) {
        // translateToString(true) trims trailing whitespace
        lines.push(line.translateToString(true))
      }
    }

    return lines.join('\n')
  } catch (e) {
    console.error('Failed to serialize terminal buffer:', e)
    return ''
  }
}

// Restore terminal content by writing it to the terminal
export function restoreTerminalBuffer(term: Terminal, content: string): void {
  if (!content) return

  try {
    // Write the content to restore scrollback
    // Add newlines to simulate original output
    term.write(content)
    // Scroll to bottom after restore
    term.scrollToBottom()
  } catch (e) {
    console.error('Failed to restore terminal buffer:', e)
  }
}
