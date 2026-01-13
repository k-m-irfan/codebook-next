'use client'

import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react'

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
  { label: 'CTRL', type: 'modifier', value: 'ctrl' },
  { label: 'TAB', type: 'special', value: '\t' },      // Tab for completion
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
  { label: 'HOME', type: 'special', value: '\x01' },  // Ctrl+A - beginning of line
  { label: 'END', type: 'special', value: '\x05' },   // Ctrl+E - end of line
  { label: 'PGUP', type: 'special', value: '\x1b[5~' }, // Page up (works in less/vim)
  { label: 'PGDN', type: 'special', value: '\x1b[6~' }, // Page down (works in less/vim)
  { label: 'SHIFT', type: 'modifier', value: 'shift' },
  { label: 'ALT', type: 'modifier', value: 'alt' },
  { label: 'ESC', type: 'special', value: '\x1b' },
]

const TAP_THRESHOLD = 10 // Max movement in pixels to consider it a tap
const STORAGE_KEY = 'quickkeys-usage'

// Load usage data from localStorage
function loadUsageData(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Save usage data to localStorage
function saveUsageData(usage: Record<string, number>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage))
  } catch {
    // Ignore storage errors
  }
}

const QuickKeysPanel = forwardRef<QuickKeysPanelRef, QuickKeysPanelProps>(
  function QuickKeysPanel({ onKeyPress, onModifierChange }, ref) {
    const [modifiers, setModifiers] = useState<Modifiers>({
      ctrl: false,
      alt: false,
      shift: false,
    })

    // Track key usage for sorting
    const [keyUsage, setKeyUsage] = useState<Record<string, number>>({})

    // Load usage data on mount
    useEffect(() => {
      setKeyUsage(loadUsageData())
    }, [])

    // Sort keys by usage frequency (most used first)
    const sortedKeys = useMemo(() => {
      return [...QUICK_KEYS].sort((a, b) => {
        const usageA = keyUsage[a.label] || 0
        const usageB = keyUsage[b.label] || 0
        return usageB - usageA
      })
    }, [keyUsage])

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

    // Update usage count for a key
    const incrementUsage = useCallback((label: string) => {
      setKeyUsage(prev => {
        const updated = { ...prev, [label]: (prev[label] || 0) + 1 }
        saveUsageData(updated)
        return updated
      })
    }, [])

    const handleKeyPress = useCallback((key: QuickKey) => {
      // Track usage
      incrementUsage(key.label)

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
    }, [modifiers, onKeyPress, incrementUsage])

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
        {sortedKeys.map((key) => (
          <button
            key={key.label}
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
            gap: 8px;
            padding: 8px 12px;
            padding-left: max(12px, env(safe-area-inset-left, 12px));
            padding-right: max(12px, env(safe-area-inset-right, 12px));
            background: linear-gradient(180deg, rgba(30, 30, 50, 0.95) 0%, rgba(20, 20, 35, 0.98) 100%);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-top: 1px solid rgba(100, 100, 150, 0.2);
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
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
            min-width: 48px;
            height: 40px;
            padding: 0 14px;
            background: linear-gradient(180deg, rgba(50, 50, 80, 0.8) 0%, rgba(35, 35, 60, 0.9) 100%);
            border: 1px solid rgba(100, 100, 150, 0.3);
            border-radius: 10px;
            color: rgba(220, 220, 240, 0.95);
            font-size: 14px;
            font-weight: 500;
            font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          }
          .quick-key:active {
            background: linear-gradient(180deg, rgba(70, 70, 110, 0.9) 0%, rgba(50, 50, 85, 0.95) 100%);
            transform: scale(0.92);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          }
          .quick-key.modifier {
            background: linear-gradient(180deg, rgba(35, 35, 55, 0.8) 0%, rgba(25, 25, 40, 0.9) 100%);
            color: rgba(150, 150, 180, 0.9);
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.5px;
            min-width: 52px;
          }
          .quick-key.modifier.active {
            background: linear-gradient(180deg, rgba(74, 144, 226, 0.85) 0%, rgba(50, 100, 180, 0.9) 100%);
            border-color: rgba(100, 160, 240, 0.5);
            color: #fff;
            box-shadow: 0 2px 8px rgba(74, 144, 226, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15);
          }
          .quick-key.modifier.active:active {
            background: linear-gradient(180deg, rgba(60, 120, 200, 0.9) 0%, rgba(40, 80, 160, 0.95) 100%);
          }
        `}</style>
      </div>
    )
  }
)

export default QuickKeysPanel
