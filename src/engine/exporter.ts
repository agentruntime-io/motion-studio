export interface ExportProgress {
  phase: 'rendering' | 'encoding' | 'done' | 'error'
  progress: number
  message?: string
}

export interface ExportRenderContext {
  renderAtTime: (time: number) => void
  duration: number
  fps: number
}

export async function exportVideoWithRenderer(
  canvas: HTMLCanvasElement,
  context: ExportRenderContext,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  const { renderAtTime, duration, fps } = context
  const frameDuration = 1000 / fps
  const totalFrames = Math.ceil(duration * fps)

  onProgress?.({ phase: 'rendering', progress: 0, message: 'Starting export...' })

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm'

  const stream = canvas.captureStream(fps)
  const chunks: Blob[] = []

  return new Promise((resolve, reject) => {
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onerror = () => {
      onProgress?.({ phase: 'error', progress: 0, message: 'Recording failed' })
      reject(new Error('MediaRecorder failed'))
    }

    recorder.onstop = () => {
      onProgress?.({ phase: 'done', progress: 100, message: 'Export complete' })
      resolve(new Blob(chunks, { type: mimeType.split(';')[0] }))
    }

    recorder.start(100)
    onProgress?.({ phase: 'encoding', progress: 5, message: 'Recording frames...' })

    let frame = 0

    const renderNextFrame = () => {
      if (frame > totalFrames) {
        setTimeout(() => recorder.stop(), 300)
        return
      }

      const time = Math.min(duration, frame / fps)
      renderAtTime(time)

      const progress = Math.round((frame / totalFrames) * 95)
      onProgress?.({
        phase: 'encoding',
        progress,
        message: `Frame ${frame}/${totalFrames}`,
      })

      frame += 1
      setTimeout(renderNextFrame, frameDuration)
    }

    renderNextFrame()
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
