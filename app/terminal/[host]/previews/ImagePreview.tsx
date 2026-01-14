'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getMimeType } from '../fileTypes'

interface ImagePreviewProps {
  content: string
  filename: string
  encoding?: string
}

export default function ImagePreview({ content, filename, encoding }: ImagePreviewProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [loaded, setLoaded] = useState(false)
  const lastPosition = useRef({ x: 0, y: 0 })
  const lastTouchDistance = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Generate data URL for the image
  const mimeType = getMimeType(filename)
  const imageSrc = encoding === 'base64'
    ? `data:${mimeType};base64,${content}`
    : content.startsWith('data:') ? content : `data:${mimeType};base64,${btoa(content)}`

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    setLoaded(true)
  }, [])

  const resetView = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const zoomIn = useCallback(() => {
    setScale(s => Math.min(s * 1.5, 10))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(s => Math.max(s / 1.5, 0.1))
  }, [])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      lastPosition.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    }
  }, [scale, position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - lastPosition.current.x,
        y: e.clientY - lastPosition.current.y,
      })
    }
  }, [isDragging, scale])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch handlers for pinch-to-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDistance.current = Math.hypot(dx, dy)
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true)
      lastPosition.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      }
    }
  }, [scale, position])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.hypot(dx, dy)
      const delta = distance / lastTouchDistance.current
      setScale(s => Math.min(Math.max(s * delta, 0.1), 10))
      lastTouchDistance.current = distance
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - lastPosition.current.x,
        y: e.touches[0].clientY - lastPosition.current.y,
      })
    }
  }, [isDragging, scale])

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null
    setIsDragging(false)
  }, [])

  // Double tap to reset
  const lastTap = useRef(0)
  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      if (scale === 1) {
        setScale(2)
      } else {
        resetView()
      }
    }
    lastTap.current = now
  }, [scale, resetView])

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(s => Math.min(Math.max(s * delta, 0.1), 10))
  }, [])

  return (
    <div className="image-preview">
      <div className="toolbar">
        <div className="file-info">
          {loaded && (
            <span className="dimensions">{dimensions.width} x {dimensions.height}</span>
          )}
          <span className="zoom-level">{Math.round(scale * 100)}%</span>
        </div>
        <div className="controls">
          <button onClick={zoomOut} title="Zoom Out">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button onClick={resetView} title="Reset View">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button onClick={zoomIn} title="Zoom In">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="image-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
        onWheel={handleWheel}
      >
        <img
          src={imageSrc}
          alt={filename}
          onLoad={handleImageLoad}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          draggable={false}
        />
      </div>

      <style jsx>{`
        .image-preview {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d0d1a;
        }
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: linear-gradient(180deg, rgba(30, 30, 50, 0.95) 0%, rgba(20, 20, 35, 0.98) 100%);
          border-bottom: 1px solid rgba(100, 100, 150, 0.2);
        }
        .file-info {
          display: flex;
          gap: 12px;
          font-size: 13px;
          color: rgba(200, 200, 220, 0.8);
        }
        .dimensions {
          color: rgba(150, 200, 255, 0.9);
        }
        .zoom-level {
          color: rgba(200, 200, 220, 0.6);
          min-width: 50px;
        }
        .controls {
          display: flex;
          gap: 4px;
        }
        .controls button {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(50, 50, 80, 0.6);
          border: 1px solid rgba(100, 100, 150, 0.3);
          border-radius: 8px;
          color: rgba(200, 200, 220, 0.9);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .controls button:active {
          transform: scale(0.95);
          background: rgba(70, 70, 110, 0.8);
        }
        .image-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          touch-action: none;
        }
        .image-container img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          transition: ${isDragging ? 'none' : 'transform 0.1s ease'};
          user-select: none;
          -webkit-user-drag: none;
        }
      `}</style>
    </div>
  )
}
