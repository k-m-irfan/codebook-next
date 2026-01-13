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

    // Track baseline height - resets on orientation change
    let baselineHeight = window.innerHeight
    // Track orientation to detect changes (portrait vs landscape)
    let isLandscape = window.innerWidth > window.innerHeight

    // Threshold: keyboard is visible if viewport shrinks by more than 150px
    // This accounts for minor browser chrome changes
    const KEYBOARD_THRESHOLD = 150

    const handleResize = () => {
      // Detect orientation change
      const currentIsLandscape = window.innerWidth > window.innerHeight

      if (currentIsLandscape !== isLandscape) {
        // Orientation changed - reset baseline height
        // Use window.innerHeight as the new baseline for this orientation
        baselineHeight = window.innerHeight
        isLandscape = currentIsLandscape
      }

      // Calculate the difference between baseline and visual viewport
      // On iOS, visualViewport.height decreases when keyboard appears
      // On Android, similar behavior
      const viewportHeight = vv.height
      const offsetTop = vv.offsetTop || 0

      const heightDiff = baselineHeight - (viewportHeight + offsetTop)
      const isKeyboardVisible = heightDiff > KEYBOARD_THRESHOLD

      setState({
        keyboardHeight: isKeyboardVisible ? heightDiff : 0,
        viewportHeight: viewportHeight,
        isKeyboardVisible,
      })
    }

    // Handle orientation change event specifically
    const handleOrientationChange = () => {
      // Give browser time to update dimensions after rotation
      setTimeout(() => {
        baselineHeight = window.innerHeight
        isLandscape = window.innerWidth > window.innerHeight
        handleResize()
      }, 100)
    }

    // Listen to visualViewport resize
    vv.addEventListener('resize', handleResize)
    // Also listen to scroll (iOS may fire scroll instead of resize in some cases)
    vv.addEventListener('scroll', handleResize)
    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange)
    // Also listen to window resize for desktop/emulator orientation changes
    window.addEventListener('resize', handleResize)

    // Initial calculation
    handleResize()

    return () => {
      vv.removeEventListener('resize', handleResize)
      vv.removeEventListener('scroll', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return state
}
