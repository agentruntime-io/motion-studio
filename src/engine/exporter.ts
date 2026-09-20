export interface ExportProgress {
  phase: 'rendering' | 'encoding' | 'done' | 'error'
  progress: number
  message?: string
}

export interface ExportRenderContext {
  renderFrame: (ctx: CanvasRenderingContext2D, time: number) => void
  width: number
  height: number
  duration: number
  fps: number
}

export async function exportVideoWithRenderer(
  context: ExportRenderContext,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  const { renderFrame, width, height, duration, fps } = context
  if (![width, height, duration, fps].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Export dimensions, duration and frame rate must be positive')
  }
  // Each recording owns its surface. Preview playback, seeking and other exports
  // must never be able to repaint the canvas being recorded.
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create export canvas')
  const frameDuration = 1000 / fps
  const totalFrames = Math.ceil(duration * fps)
  onProgress?.({ phase: 'rendering', progress: 0, message: 'Starting export...' })

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm'

  // Initialize before capture starts so an empty/stale first frame cannot leak in.
  renderFrame(ctx, 0)
  const stream = canvas.captureStream(fps)
  const chunks: Blob[] = []

  return new Promise((resolve, reject) => {
    let recorder: MediaRecorder | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const cleanup = () => {
      clearTimeout(timer)
      for (const track of stream.getTracks()) track.stop()
    }
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      const message = error instanceof Error ? error.message : 'Recording failed'
      onProgress?.({ phase: 'error', progress: 0, message })
      reject(new Error(message))
    }

    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onerror = () => fail(new Error('MediaRecorder failed'))
      recorder.onstop = () => {
        if (settled) return
        settled = true
        cleanup()
        onProgress?.({ phase: 'done', progress: 100, message: 'Export complete' })
        resolve(new Blob(chunks, { type: mimeType.split(';')[0] }))
      }
      recorder.start(100)
      let frame = 0
      const renderNextFrame = () => {
        if (settled) return
        try {
          // Valid frames are 0 .. totalFrames - 1. Rendering at duration can
          // introduce an empty frame when all scene exit animations have ended.
          if (frame >= totalFrames) {
            recorder!.stop()
            return
          }
          renderFrame(ctx, frame / fps)
          frame += 1
          onProgress?.({
            phase: 'encoding',
            progress: Math.round((frame / totalFrames) * 95),
            message: `Frame ${frame}/${totalFrames}`,
          })
          // Hold the last frame for its interval too, without an extra 300ms tail.
          timer = setTimeout(renderNextFrame, frameDuration)
        } catch (error) {
          fail(error)
        }
      }
      renderNextFrame()
    } catch (error) {
      fail(error)
    }
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
