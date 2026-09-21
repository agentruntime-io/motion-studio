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

export type ExportFormat = 'webm' | 'mp4'

function assertExportContext(context: ExportRenderContext): void {
  const { width, height, duration, fps } = context
  if (![width, height, duration, fps].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Export dimensions, duration and frame rate must be positive')
  }
}

export async function exportVideoWithRenderer(
  context: ExportRenderContext,
  onProgress?: (progress: ExportProgress) => void,
  format: ExportFormat = 'webm',
): Promise<Blob> {
  if (format === 'mp4') {
    return exportMp4WithRenderer(context, onProgress)
  }
  return exportWebmWithRenderer(context, onProgress)
}

async function exportWebmWithRenderer(
  context: ExportRenderContext,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  const { renderFrame, width, height, duration, fps } = context
  assertExportContext(context)
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

async function exportMp4WithRenderer(
  context: ExportRenderContext,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  const { renderFrame, width, height, duration, fps } = context
  assertExportContext(context)

  if (typeof VideoEncoder === 'undefined') {
    throw new Error('MP4 export requires WebCodecs (VideoEncoder). Try WebM instead.')
  }

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create export canvas')

  const totalFrames = Math.ceil(duration * fps)
  const frameDurationUs = Math.round(1_000_000 / fps)
  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width,
      height,
    },
    fastStart: 'in-memory',
  })

  let encoderError: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error('VideoEncoder failed')
    },
  })

  const codec = VideoEncoder.isConfigSupported({
    codec: 'avc1.42E01E',
    width,
    height,
    bitrate: 8_000_000,
  })
    .then((result) => (result.supported ? 'avc1.42E01E' : 'avc1.42001E'))
    .catch(() => 'avc1.42E01E')

  encoder.configure({
    codec: await codec,
    width,
    height,
    bitrate: 8_000_000,
  })

  onProgress?.({ phase: 'rendering', progress: 0, message: 'Starting MP4 export...' })
  renderFrame(ctx, 0)

  for (let frame = 0; frame < totalFrames; frame += 1) {
    if (encoderError) throw encoderError
    renderFrame(ctx, frame / fps)
    const videoFrame = new VideoFrame(canvas, {
      timestamp: frame * frameDurationUs,
      duration: frameDurationUs,
    })
    encoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 })
    videoFrame.close()
    onProgress?.({
      phase: 'encoding',
      progress: Math.round(((frame + 1) / totalFrames) * 95),
      message: `Frame ${frame + 1}/${totalFrames}`,
    })
  }

  await encoder.flush()
  muxer.finalize()
  onProgress?.({ phase: 'done', progress: 100, message: 'Export complete' })
  return new Blob([target.buffer], { type: 'video/mp4' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
