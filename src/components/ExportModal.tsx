import { useEffect, useState } from 'react'
import type { VideoProject } from '../types/project'
import type { ExportProgress } from '../engine/exporter'
import { downloadBlob, exportVideoWithRenderer } from '../engine/exporter'
import { analytics } from '../lib/analytics'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  project: VideoProject
  ready: boolean
  renderFrame: (ctx: CanvasRenderingContext2D, time: number) => void
}

export function ExportModal({
  open,
  onClose,
  project,
  ready,
  renderFrame,
}: ExportModalProps) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !exporting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, exporting, onClose])

  useEffect(() => {
    if (!open) {
      setProgress(null)
    }
  }, [open])

  const handleExport = async () => {
    if (!ready || exporting) return

    setExporting(true)
    setProgress({ phase: 'rendering', progress: 0 })
    analytics.exportStarted(project)

    try {
      const blob = await exportVideoWithRenderer(
        {
          duration: project.duration,
          fps: project.fps,
          width: project.width,
          height: project.height,
          renderFrame,
        },
        setProgress,
      )

      const name = (project.name ?? 'video').replace(/\s+/g, '-').toLowerCase()
      downloadBlob(blob, `${name}.webm`)
      analytics.exportCompleted(project)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      analytics.exportFailed(project, message)
      setProgress({
        phase: 'error',
        progress: 0,
        message,
      })
    } finally {
      setExporting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!exporting) onClose()
      }}
      role="presentation"
    >
      <div
        className="modal export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="export-modal-title">Export Video</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={exporting}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="export-desc">
          Renders all frames from your JSON timeline and downloads a WebM video.
        </p>

        <dl className="export-meta">
          <div>
            <dt>Format</dt>
            <dd>WebM (VP9/VP8)</dd>
          </div>
          <div>
            <dt>Resolution</dt>
            <dd>
              {project.width}×{project.height}
            </dd>
          </div>
          <div>
            <dt>Frame rate</dt>
            <dd>{project.fps} fps</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{project.duration}s</dd>
          </div>
        </dl>

        {!ready && (
          <p className="export-warning">Preview must be ready before exporting.</p>
        )}

        {progress && (
          <div className={`export-status status-${progress.phase}`}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress.progress}%` }} />
            </div>
            <span>{progress.message ?? progress.phase}</span>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={handleExport}
            disabled={!ready || exporting}
          >
            {exporting ? 'Exporting…' : 'Download WebM'}
          </button>
        </div>
      </div>
    </div>
  )
}
