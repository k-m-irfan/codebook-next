'use client'

import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface NotebookPreviewProps {
  content: string
  filename: string
}

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw'
  source: string[]
  outputs?: NotebookOutput[]
  execution_count?: number | null
}

interface NotebookOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error'
  text?: string[]
  data?: {
    'text/plain'?: string[]
    'text/html'?: string[]
    'image/png'?: string
    'image/jpeg'?: string
    'application/json'?: any
  }
  name?: string
  ename?: string
  evalue?: string
  traceback?: string[]
}

interface Notebook {
  cells: NotebookCell[]
  metadata?: {
    kernelspec?: {
      display_name?: string
      language?: string
    }
    language_info?: {
      name?: string
    }
  }
}

export default function NotebookPreview({ content, filename }: NotebookPreviewProps) {
  const [collapsedCells, setCollapsedCells] = useState<Set<number>>(new Set())

  const notebook = useMemo<Notebook | null>(() => {
    try {
      return JSON.parse(content)
    } catch (e) {
      console.error('Failed to parse notebook:', e)
      return null
    }
  }, [content])

  const toggleCell = (index: number) => {
    setCollapsedCells(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const renderSource = (source: string[]) => {
    return Array.isArray(source) ? source.join('') : source
  }

  const renderOutput = (output: NotebookOutput, key: number) => {
    if (output.output_type === 'stream') {
      return (
        <pre key={key} className="output-stream">
          {output.text?.join('') || ''}
        </pre>
      )
    }

    if (output.output_type === 'error') {
      return (
        <pre key={key} className="output-error">
          {output.traceback?.join('\n') || `${output.ename}: ${output.evalue}`}
        </pre>
      )
    }

    if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
      const data = output.data
      if (!data) return null

      // Handle images
      if (data['image/png']) {
        return (
          <div key={key} className="output-image">
            <img src={`data:image/png;base64,${data['image/png']}`} alt="Output" />
          </div>
        )
      }
      if (data['image/jpeg']) {
        return (
          <div key={key} className="output-image">
            <img src={`data:image/jpeg;base64,${data['image/jpeg']}`} alt="Output" />
          </div>
        )
      }

      // Handle HTML
      if (data['text/html']) {
        const html = Array.isArray(data['text/html']) ? data['text/html'].join('') : data['text/html']
        return (
          <div
            key={key}
            className="output-html"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      }

      // Handle plain text
      if (data['text/plain']) {
        const text = Array.isArray(data['text/plain']) ? data['text/plain'].join('') : data['text/plain']
        return (
          <pre key={key} className="output-text">
            {text}
          </pre>
        )
      }
    }

    return null
  }

  if (!notebook) {
    return (
      <div className="notebook-preview">
        <div className="error-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>Failed to parse notebook file</p>
        </div>
        <style jsx>{`
          .notebook-preview {
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

  const language = notebook.metadata?.kernelspec?.language ||
                   notebook.metadata?.language_info?.name ||
                   'python'

  return (
    <div className="notebook-preview">
      <div className="notebook-header">
        <span className="kernel-badge">
          {notebook.metadata?.kernelspec?.display_name || language}
        </span>
        <span className="cell-count">{notebook.cells?.length || 0} cells</span>
      </div>

      <div className="cells-container">
        {notebook.cells?.map((cell, index) => (
          <div key={index} className={`cell ${cell.cell_type}`}>
            <div className="cell-header" onClick={() => toggleCell(index)}>
              <span className="cell-type-badge">{cell.cell_type}</span>
              {cell.cell_type === 'code' && cell.execution_count != null && (
                <span className="execution-count">[{cell.execution_count}]</span>
              )}
              <button className="collapse-btn">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ transform: collapsedCells.has(index) ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>

            {!collapsedCells.has(index) && (
              <div className="cell-content">
                {cell.cell_type === 'markdown' ? (
                  <div className="markdown-content">
                    <ReactMarkdown>{renderSource(cell.source)}</ReactMarkdown>
                  </div>
                ) : cell.cell_type === 'code' ? (
                  <>
                    <pre className="code-content">
                      <code>{renderSource(cell.source)}</code>
                    </pre>
                    {cell.outputs && cell.outputs.length > 0 && (
                      <div className="outputs">
                        {cell.outputs.map((output, i) => renderOutput(output, i))}
                      </div>
                    )}
                  </>
                ) : (
                  <pre className="raw-content">
                    {renderSource(cell.source)}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .notebook-preview {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d0d1a;
        }
        .notebook-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: linear-gradient(180deg, rgba(30, 30, 50, 0.95) 0%, rgba(20, 20, 35, 0.98) 100%);
          border-bottom: 1px solid rgba(100, 100, 150, 0.2);
        }
        .kernel-badge {
          padding: 4px 10px;
          background: rgba(80, 120, 200, 0.3);
          border-radius: 12px;
          font-size: 12px;
          color: rgba(150, 200, 255, 0.9);
        }
        .cell-count {
          font-size: 12px;
          color: rgba(150, 150, 180, 0.7);
        }
        .cells-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cell {
          background: rgba(25, 25, 40, 0.8);
          border: 1px solid rgba(80, 80, 120, 0.3);
          border-radius: 8px;
          overflow: hidden;
        }
        .cell.code {
          border-left: 3px solid rgba(80, 150, 255, 0.6);
        }
        .cell.markdown {
          border-left: 3px solid rgba(100, 200, 100, 0.6);
        }
        .cell.raw {
          border-left: 3px solid rgba(150, 150, 150, 0.6);
        }
        .cell-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(30, 30, 50, 0.5);
          cursor: pointer;
        }
        .cell-header:active {
          background: rgba(40, 40, 60, 0.6);
        }
        .cell-type-badge {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(80, 80, 120, 0.4);
          color: rgba(180, 180, 200, 0.8);
        }
        .execution-count {
          font-size: 11px;
          color: rgba(100, 150, 255, 0.7);
          font-family: monospace;
        }
        .collapse-btn {
          margin-left: auto;
          background: none;
          border: none;
          color: rgba(150, 150, 180, 0.6);
          cursor: pointer;
          padding: 4px;
        }
        .collapse-btn svg {
          transition: transform 0.2s ease;
        }
        .cell-content {
          padding: 0;
        }
        .markdown-content {
          padding: 12px 16px;
          color: rgba(220, 220, 240, 0.9);
          font-size: 14px;
          line-height: 1.6;
        }
        .markdown-content :global(h1),
        .markdown-content :global(h2),
        .markdown-content :global(h3) {
          margin-top: 0;
          color: rgba(240, 240, 255, 0.95);
        }
        .markdown-content :global(code) {
          background: rgba(60, 60, 90, 0.5);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Menlo', 'Monaco', monospace;
          font-size: 13px;
        }
        .markdown-content :global(pre) {
          background: rgba(20, 20, 35, 0.8);
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
        }
        .markdown-content :global(pre code) {
          background: none;
          padding: 0;
        }
        .markdown-content :global(a) {
          color: rgba(100, 180, 255, 0.9);
        }
        .markdown-content :global(ul),
        .markdown-content :global(ol) {
          padding-left: 24px;
        }
        .code-content {
          margin: 0;
          padding: 12px 16px;
          background: rgba(15, 15, 25, 0.6);
          font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(200, 200, 220, 0.9);
          overflow-x: auto;
        }
        .code-content code {
          white-space: pre;
        }
        .outputs {
          border-top: 1px solid rgba(80, 80, 120, 0.2);
          background: rgba(20, 20, 35, 0.4);
        }
        .output-stream,
        .output-text {
          margin: 0;
          padding: 10px 16px;
          font-family: 'Menlo', 'Monaco', monospace;
          font-size: 12px;
          color: rgba(180, 180, 200, 0.9);
          white-space: pre-wrap;
          word-break: break-all;
        }
        .output-error {
          margin: 0;
          padding: 10px 16px;
          font-family: 'Menlo', 'Monaco', monospace;
          font-size: 12px;
          color: rgba(255, 100, 100, 0.9);
          background: rgba(100, 30, 30, 0.2);
          white-space: pre-wrap;
          word-break: break-all;
        }
        .output-image {
          padding: 10px 16px;
        }
        .output-image img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        }
        .output-html {
          padding: 10px 16px;
          color: rgba(200, 200, 220, 0.9);
          overflow-x: auto;
        }
        .output-html :global(table) {
          border-collapse: collapse;
          margin: 8px 0;
        }
        .output-html :global(th),
        .output-html :global(td) {
          border: 1px solid rgba(80, 80, 120, 0.4);
          padding: 6px 10px;
          text-align: left;
        }
        .output-html :global(th) {
          background: rgba(40, 40, 60, 0.5);
        }
        .raw-content {
          margin: 0;
          padding: 12px 16px;
          font-family: 'Menlo', 'Monaco', monospace;
          font-size: 13px;
          color: rgba(180, 180, 200, 0.8);
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  )
}
