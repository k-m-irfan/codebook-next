'use client'

import { useState, useEffect } from 'react'

interface KeyboardState {
  keyboardHeight: number
  viewportHeight: number
  isKeyboardVisible: boolean
}

/**
 * Custom hook to detect mobile keyboard visibility and height
 * using the visualViewport API.
 *
 * Returns keyboard height, viewport height, and visibility state
 */
export function useKeyboardHeight(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    keyboardHeight: 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    isKeyboardVisible: false,
  })

  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') return

    const vv = window.visualViewport
    if (!vv) {
      // Fallback for browsers without visualViewport (very rare now)
      setState({
        keyboardHeight: 0,
        viewportHeight: window.innerHeight,
        isKeyboardVisible: false,
      })
      return
    }

    // Store initial height to detect keyboard
    const initialHeight = window.innerHeight
    // Threshold: keyboard is visible if viewport shrinks by more than 150px
    // This accounts for minor browser chrome changes
    const KEYBOARD_THRESHOLD = 150

    const handleResize = () => {
      // Calculate the difference between full window and visual viewport
      // On iOS, visualViewport.height decreases when keyboard appears
      // On Android, similar behavior
      const viewportHeight = vv.height
      const offsetTop = vv.offsetTop || 0

      const heightDiff = initialHeight - (viewportHeight + offsetTop)
      const isKeyboardVisible = heightDiff > KEYBOARD_THRESHOLD

      setState({
        keyboardHeight: isKeyboardVisible ? heightDiff : 0,
        viewportHeight: viewportHeight,
        isKeyboardVisible,
      })
    }

    // Listen to visualViewport resize
    vv.addEventListener('resize', handleResize)
    // Also listen to scroll (iOS may fire scroll instead of resize in some cases)
    vv.addEventListener('scroll', handleResize)

    // Initial calculation
    handleResize()

    return () => {
      vv.removeEventListener('resize', handleResize)
      vv.removeEventListener('scroll', handleResize)
    }
  }, [])

  return state
}
