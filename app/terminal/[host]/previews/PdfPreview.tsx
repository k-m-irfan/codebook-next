'use client'

import { useMemo } from 'react'

interface PdfPreviewProps {
  content: string
  filename: string
  encoding?: string
}

export default function PdfPreview({ content, filename, encoding }: PdfPreviewProps) {
  // Generate data URL for the PDF
  const pdfDataUrl = useMemo(() => {
    if (encoding === 'base64') {
      return `data:application/pdf;base64,${content}`
    }
    // If not base64, try to create base64 from string
    try {
      return `data:application/pdf;base64,${btoa(content)}`
    } catch {
      return null
    }
  }, [content, encoding])

  if (!pdfDataUrl) {
    return (
      <div className="pdf-preview">
        <div className="error-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>Failed to load PDF</p>
        </div>
        <style jsx>{`
          .pdf-preview {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0d0d1a;
          }
          .error-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            color: rgba(200, 100, 100, 0.8);
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="pdf-preview">
      <div className="pdf-header">
        <div className="file-info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="filename">{filename}</span>
        </div>
        <a
          href={pdfDataUrl}
          download={filename}
          className="download-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </a>
      </div>

      <div className="pdf-container">
        <object
          data={pdfDataUrl}
          type="application/pdf"
          width="100%"
          height="100%"
        >
          <div className="fallback">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p>PDF preview not available in this browser</p>
            <a href={pdfDataUrl} download={filename} className="fallback-download">
              Download PDF
            </a>
          </div>
        </object>
      </div>

      <style jsx>{`
        .pdf-preview {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d0d1a;
        }
        .pdf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: linear-gradient(180deg, rgba(30, 30, 50, 0.95) 0%, rgba(20, 20, 35, 0.98) 100%);
          border-bottom: 1px solid rgba(100, 100, 150, 0.2);
        }
        .file-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .filename {
          font-size: 14px;
          color: rgba(200, 200, 220, 0.9);
        }
        .download-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(50, 50, 80, 0.6);
          border: 1px solid rgba(100, 100, 150, 0.3);
          border-radius: 8px;
          color: rgba(200, 200, 220, 0.9);
          font-size: 13px;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .download-btn:active {
          transform: scale(0.95);
          background: rgba(70, 70, 110, 0.8);
        }
        .pdf-container {
          flex: 1;
          overflow: hidden;
        }
        .pdf-container object {
          display: block;
          background: white;
        }
        .fallback {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 16px;
          color: rgba(150, 150, 180, 0.8);
          padding: 40px;
          text-align: center;
        }
        .fallback p {
          font-size: 14px;
          margin: 0;
        }
        .fallback-download {
          display: inline-flex;
          align-items: center;
          padding: 10px 20px;
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.8) 0%, rgba(50, 100, 180, 0.9) 100%);
          border-radius: 8px;
          color: white;
          font-size: 14px;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .fallback-download:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  )
}
