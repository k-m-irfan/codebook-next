'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getMimeType } from '../fileTypes'

interface VideoPreviewProps {
  content: string
  filename: string
  encoding?: string
}

export default function VideoPreview({ content, filename, encoding }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Generate data URL for the video
  const mimeType = getMimeType(filename)
  const videoSrc = encoding === 'base64'
    ? `data:${mimeType};base64,${content}`
    : content

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
  }, [isPlaying])

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.volume = vol
      setVolume(vol)
      setIsMuted(vol === 0)
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    if (isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    } else {
      videoRef.current.muted = true
      setIsMuted(true)
    }
  }, [isMuted])

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleError = useCallback(() => {
    setError('Failed to load video. The file may be too large or corrupted.')
  }, [])

  return (
    <div ref={containerRef} className="video-preview">
      {error ? (
        <div className="error-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="video-container" onClick={togglePlay}>
            <video
              ref={videoRef}
              src={videoSrc}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={handleError}
              playsInline
            />
            {!isPlaying && (
              <div className="play-overlay">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            )}
          </div>

          <div className="controls">
            <button className="play-btn" onClick={togglePlay}>
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            <span className="time">{formatTime(currentTime)}</span>

            <input
              type="range"
              className="seek-bar"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              step={0.1}
            />

            <span className="time">{formatTime(duration)}</span>

            <button className="volume-btn" onClick={toggleMute}>
              {isMuted || volume === 0 ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>

            <input
              type="range"
              className="volume-bar"
              min={0}
              max={1}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              step={0.1}
            />

            <button className="fullscreen-btn" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .video-preview {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d0d1a;
        }
        .video-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
          overflow: hidden;
        }
        video {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .play-overlay {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          color: white;
          pointer-events: none;
        }
        .controls {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: linear-gradient(180deg, rgba(30, 30, 50, 0.95) 0%, rgba(20, 20, 35, 0.98) 100%);
          border-top: 1px solid rgba(100, 100, 150, 0.2);
        }
        .controls button {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(50, 50, 80, 0.6);
          border: 1px solid rgba(100, 100, 150, 0.3);
          border-radius: 8px;
          color: rgba(200, 200, 220, 0.9);
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .controls button:active {
          transform: scale(0.95);
          background: rgba(70, 70, 110, 0.8);
        }
        .time {
          font-size: 12px;
          color: rgba(200, 200, 220, 0.7);
          font-family: monospace;
          min-width: 40px;
        }
        .seek-bar {
          flex: 1;
          height: 4px;
          -webkit-appearance: none;
          background: rgba(100, 100, 150, 0.3);
          border-radius: 2px;
          cursor: pointer;
        }
        .seek-bar::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          background: #4a90e2;
          border-radius: 50%;
          cursor: pointer;
        }
        .volume-bar {
          width: 60px;
          height: 4px;
          -webkit-appearance: none;
          background: rgba(100, 100, 150, 0.3);
          border-radius: 2px;
          cursor: pointer;
        }
        .volume-bar::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          background: #4a90e2;
          border-radius: 50%;
          cursor: pointer;
        }
        .error-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          color: rgba(200, 100, 100, 0.8);
        }
        .error-state p {
          font-size: 14px;
          text-align: center;
          max-width: 300px;
        }
        @media (max-width: 480px) {
          .volume-bar {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
