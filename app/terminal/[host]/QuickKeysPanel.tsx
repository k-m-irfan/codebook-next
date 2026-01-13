'use client'

import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'

interface Modifiers {
  ctrl: boolean
  alt: boolean
  shift: boolean
}

export interface QuickKeysPanelRef {
  resetModifiers: () => void
}

interface QuickKeysPanelProps {
  onKeyPress: (key: string) => void
  onModifierChange?: (modifiers: Modifiers) => void
}

interface QuickKey {
  label: string
  type: 'char' | 'modifier' | 'special'
  value: string
}

const QUICK_KEYS: QuickKey[] = [
  { label: 'ctrl', type: 'modifier', value: 'ctrl' },
  { label: 'tab', type: 'special', value: '\t' },      // Tab for completion
  { label: '~', type: 'char', value: '~' },
  { label: '-', type: 'char', value: '-' },
  { label: '(', type: 'char', value: '(' },
  { label: ')', type: 'char', value: ')' },
  { label: '|', type: 'char', value: '|' },
  { label: '>', type: 'char', value: '>' },
  { label: '[', type: 'char', value: '[' },
  { label: ']', type: 'char', value: ']' },
  { label: ':', type: 'char', value: ':' },
  { label: ';', type: 'char', value: ';' },
  // Readline shortcuts for terminal line editing
  { label: 'home', type: 'special', value: '\x01' },  // Ctrl+A - beginning of line
  { label: 'end', type: 'special', value: '\x05' },   // Ctrl+E - end of line
  { label: 'pgup', type: 'special', value: '\x1b[5~' }, // Page up (works in less/vim)
  { label: 'pgdn', type: 'special', value: '\x1b[6~' }, // Page down (works in less/vim)
  { label: 'shift', type: 'modifier', value: 'shift' },
  { label: 'alt', type: 'modifier', value: 'alt' },
  { label: 'esc', type: 'special', value: '\x1b' },
]

const TAP_THRESHOLD = 10 // Max movement in pixels to consider it a tap

const QuickKeysPanel = forwardRef<QuickKeysPanelRef, QuickKeysPanelProps>(
  function QuickKeysPanel({ onKeyPress, onModifierChange }, ref) {
    const [modifiers, setModifiers] = useState<Modifiers>({
      ctrl: false,
      alt: false,
      shift: false,
    })

    // Track touch start position for tap vs swipe detection
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)

    // Expose reset method to parent
    useImperativeHandle(ref, () => ({
      resetModifiers: () => {
        setModifiers({ ctrl: false, alt: false, shift: false })
      }
    }), [])

    // Notify parent of modifier changes
    useEffect(() => {
      onModifierChange?.(modifiers)
    }, [modifiers, onModifierChange])

    const handleKeyPress = useCallback((key: QuickKey) => {
      if (key.type === 'modifier') {
        // Toggle modifier state
        setModifiers(prev => ({
          ...prev,
          [key.value]: !prev[key.value as keyof Modifiers],
        }))
        return
      }

      let keyToSend = key.value

      // Apply modifiers for character keys
      if (key.type === 'char') {
        if (modifiers.ctrl) {
          // Convert to control character (Ctrl+A = \x01, Ctrl+C = \x03, etc.)
          const charCode = key.value.toLowerCase().charCodeAt(0)
          if (charCode >= 97 && charCode <= 122) {
            // a-z
            keyToSend = String.fromCharCode(charCode - 96)
          }
        } else if (modifiers.alt) {
          // Alt + char = ESC + char
          keyToSend = '\x1b' + key.value
        } else if (modifiers.shift) {
          // Shift for letters (uppercase)
          keyToSend = key.value.toUpperCase()
        }
      }

      // Send the key
      onKeyPress(keyToSend)

      // Clear modifiers after use
      if (modifiers.ctrl || modifiers.alt || modifiers.shift) {
        setModifiers({ ctrl: false, alt: false, shift: false })
      }
    }, [modifiers, onKeyPress])

    const handleTouchStart = useCallback((e: React.TouchEvent, _key: QuickKey) => {
      e.stopPropagation()
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }, [])

    const handleTouchEnd = useCallback((e: React.TouchEvent, key: QuickKey) => {
      e.preventDefault()
      e.stopPropagation()

      // Check if it was a tap (not a swipe)
      if (touchStartRef.current && e.changedTouches[0]) {
        const touch = e.changedTouches[0]
        const deltaX = Math.abs(touch.clientX - touchStartRef.current.x)
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)

        // Only trigger if movement was small (tap, not swipe)
        if (deltaX < TAP_THRESHOLD && deltaY < TAP_THRESHOLD) {
          handleKeyPress(key)
        }
      }

      touchStartRef.current = null
    }, [handleKeyPress])

    return (
      <div
        className="quick-keys-panel"
        onMouseDown={(e) => e.preventDefault()}
      >
        {QUICK_KEYS.map((key, index) => (
          <button
            key={index}
            className={`quick-key ${key.type === 'modifier' ? 'modifier' : ''} ${
              key.type === 'modifier' && modifiers[key.value as keyof Modifiers] ? 'active' : ''
            }`}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleKeyPress(key)
            }}
            onTouchStart={(e) => handleTouchStart(e, key)}
            onTouchEnd={(e) => handleTouchEnd(e, key)}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {key.label}
          </button>
        ))}

        <style jsx>{`
          .quick-keys-panel {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px;
            padding-left: max(8px, env(safe-area-inset-left, 8px));
            padding-right: max(8px, env(safe-area-inset-right, 8px));
            background: #1a1a2e;
            border-top: 1px solid #2a2a4a;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .quick-keys-panel::-webkit-scrollbar {
            display: none;
          }
          .quick-key {
            flex-shrink: 0;
            min-width: 44px;
            height: 36px;
            padding: 0 12px;
            background: #252545;
            border: 1px solid #3a3a6a;
            border-radius: 6px;
            color: #ccc;
            font-size: 13px;
            font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }
          .quick-key:active {
            background: #3a3a5a;
            transform: scale(0.95);
          }
          .quick-key.modifier {
            background: #1e1e3e;
            color: #888;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .quick-key.modifier.active {
            background: #4a4a8a;
            border-color: #6a6aba;
            color: #fff;
          }
        `}</style>
      </div>
    )
  }
)

export default QuickKeysPanel
