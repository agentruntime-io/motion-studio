import { useCallback, useEffect, useMemo, useState } from 'react'
import type { VideoProject } from '../types/project'
import type { ExportProgress } from '../engine/exporter'
import { exportVideoWithRenderer } from '../engine/exporter'
import {
  clearPrerender,
  computeProjectFingerprint,
  getPrerenderUrl,
  isPrerenderStale,
  setPrerender,
} from '../engine/prerenderCache'

interface UsePrerenderOptions {
  projectPath: string
  project: VideoProject
  localFilesVersion: number
  jsonText: string
  ready: boolean
  renderFrame: (ctx: CanvasRenderingContext2D, time: number) => void
}

export function usePrerender({
  projectPath,
  project,
  localFilesVersion,
  jsonText,
  ready,
  renderFrame,
}: UsePrerenderOptions) {
  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [version, setVersion] = useState(0)

  const fingerprint = useMemo(
    () => computeProjectFingerprint(projectPath, project, localFilesVersion, jsonText),
    [projectPath, project, localFilesVersion, jsonText],
  )

  const prerenderUrl = useMemo(() => {
    void version
    return getPrerenderUrl(fingerprint, projectPath)
  }, [fingerprint, projectPath, version])

  const stale = useMemo(() => {
    void version
    return isPrerenderStale(fingerprint, projectPath)
  }, [fingerprint, projectPath, version])

  const usePrerenderPreview = Boolean(prerenderUrl)

  useEffect(() => {
    return () => {
      clearPrerender()
    }
  }, [])

  useEffect(() => {
    clearPrerender()
    setVersion((v) => v + 1)
  }, [projectPath])

  const runPrerender = useCallback(async () => {
    if (!ready || rendering) return

    setRendering(true)
    setProgress({ phase: 'rendering', progress: 0, message: 'Pre-rendering…' })

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

      setPrerender(projectPath, fingerprint, blob)
      setVersion((v) => v + 1)
    } catch (err) {
      setProgress({
        phase: 'error',
        progress: 0,
        message: err instanceof Error ? err.message : 'Pre-render failed',
      })
    } finally {
      setRendering(false)
    }
  }, [fingerprint, project.width, project.height, project.duration, project.fps, projectPath, ready, renderFrame, rendering])

  return {
    prerenderUrl,
    usePrerenderPreview,
    stale,
    rendering,
    progress,
    runPrerender,
  }
}
