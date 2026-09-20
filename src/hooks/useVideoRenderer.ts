import { useCallback, useEffect, useState } from 'react'
import type { Layer, VideoProject } from '../types/project'
import type { ProjectLoadContext } from '../lib/projectContext'
import { buildResolveOptions } from '../lib/projectContext'
import { createRenderer, VideoRenderer } from '../engine/renderer'

export interface RenderFrameOptions {
  motionPathLayer?: Layer | null
}

export function useVideoRenderer(project: VideoProject | null, context?: ProjectLoadContext) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renderer, setRenderer] = useState<VideoRenderer | null>(null)

  const contextKey = JSON.stringify(context ?? {})

  useEffect(() => {
    if (!project) return

    let cancelled = false
    setReady(false)
    setError(null)

    const resolveOptions = buildResolveOptions(project, context)

    createRenderer(project, resolveOptions)
      .then((renderer) => {
        if (cancelled) return
        setRenderer(renderer)
        setReady(true)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load project')
        setReady(false)
      })

    return () => {
      cancelled = true
    }
  }, [project, contextKey])

  const renderFrame = useCallback(
    (ctx: CanvasRenderingContext2D, time: number, options?: RenderFrameOptions) => {
      renderer?.renderFrame(ctx, time, options)
    },
    [renderer],
  )

  const reload = useCallback(async () => {
    if (!project) return
    setReady(false)
    setError(null)
    try {
      const renderer = await createRenderer(project, buildResolveOptions(project, context))
      setRenderer(renderer)
      setReady(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
      setReady(false)
    }
  }, [project, contextKey])

  return { ready, error, renderFrame, reload }
}
