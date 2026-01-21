'use client'

import { useState, useEffect } from 'react'
import { useSettings } from './SettingsContext'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings()

  // Local state for live preview
  const [terminalFontSize, setTerminalFontSize] = useState(settings.terminalFontSize)
  const [editorFontSize, setEditorFontSize] = useState(settings.editorFontSize)

  // Sync local state when settings change or modal opens
  useEffect(() => {
    if (isOpen) {
      setTerminalFontSize(settings.terminalFontSize)
      setEditorFontSize(settings.editorFontSize)
    }
  }, [isOpen, settings.terminalFontSize, settings.editorFontSize])

  const handleSave = () => {
    updateSettings({
      terminalFontSize,
      editorFontSize,
    })
    onClose()
  }

  const handleCancel = () => {
    // Reset to original values
    setTerminalFontSize(settings.terminalFontSize)
    setEditorFontSize(settings.editorFontSize)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Settings</h2>

        <div className="settings-section">
          <div className="setting-item">
            <div className="setting-header">
              <label className="setting-label">Terminal Font Size</label>
              <span className="setting-value">{terminalFontSize}px</span>
            </div>
            <input
              type="range"
              min="8"
              max="32"
              value={terminalFontSize}
              onChange={(e) => setTerminalFontSize(parseInt(e.target.value))}
              className="setting-slider"
            />
            <div className="preview-box terminal-preview">
              <span style={{ fontSize: `${terminalFontSize}px` }}>
                user@host:~$ ls -la
              </span>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <label className="setting-label">Editor Font Size</label>
              <span className="setting-value">{editorFontSize}px</span>
            </div>
            <input
              type="range"
              min="8"
              max="32"
              value={editorFontSize}
              onChange={(e) => setEditorFontSize(parseInt(e.target.value))}
              className="setting-slider"
            />
            <div className="preview-box editor-preview">
              <span style={{ fontSize: `${editorFontSize}px` }}>
                const hello = "world";
              </span>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>

        <style jsx>{`
          .settings-modal {
            max-width: 400px;
          }
          .settings-section {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .setting-item {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .setting-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .setting-label {
            color: #fff;
            font-weight: 500;
            font-size: 0.95rem;
          }
          .setting-value {
            color: #8ab4f8;
            font-size: 0.9rem;
            font-weight: 500;
            min-width: 48px;
            text-align: right;
          }
          .setting-slider {
            width: 100%;
            height: 6px;
            -webkit-appearance: none;
            appearance: none;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            outline: none;
            cursor: pointer;
          }
          .setting-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #4a7cff 0%, #3a6cef 100%);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(74, 124, 255, 0.4);
            transition: transform 0.15s, box-shadow 0.15s;
          }
          .setting-slider::-webkit-slider-thumb:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(74, 124, 255, 0.5);
          }
          .setting-slider::-webkit-slider-thumb:active {
            transform: scale(0.95);
          }
          .setting-slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #4a7cff 0%, #3a6cef 100%);
            border-radius: 50%;
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 8px rgba(74, 124, 255, 0.4);
          }
          .preview-box {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 14px 16px;
            font-family: Menlo, Monaco, "Courier New", monospace;
            color: #eee;
            overflow: hidden;
            min-height: 48px;
            display: flex;
            align-items: center;
          }
          .terminal-preview {
            background: #0f0f23;
          }
          .editor-preview {
            background: #1e1e1e;
          }
          .preview-box span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: font-size 0.1s ease-out;
          }
        `}</style>
      </div>
    </div>
  )
}
