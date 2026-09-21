import type {
  ImageLayer,
  Layer,
  OverlayLayer,
  OverlayStyle,
  TextStyle,
  TitleLayer,
  VideoLayer,
  VideoProject,
} from '../types/project'
import type { ResolveImageOptions } from './resolveImageSrc'
import { loadImage, loadVideo, seekVideo } from './assetLoader'
import { computeLayerTransform } from './animations'
import { applyCanvasEffects } from './effects'
import { collectFlowImageSources, drawFlowLayer } from './flowRenderer'
import { getMotionPathPoints } from './keyframeEngine'
import { mergeOverlayStyle, mergeTextStyle, resolveProjectBackground } from '../lib/themeUtils'

function collectImageSources(layers: Layer[]): string[] {
  return layers.flatMap((layer) => {
    if (layer.type === 'image' && layer.src) return [layer.src]
    if (layer.type === 'overlay' && layer.overlayType === 'image' && layer.src) {
      return [layer.src]
    }
    if (layer.type === 'flow') return collectFlowImageSources(layer)
    return []
  })
}

function collectVideoSources(layers: Layer[]): string[] {
  return layers.flatMap((layer) => (layer.type === 'video' && layer.src ? [layer.src] : []))
}

function getLayerBounds(
  layer: Layer,
  project: VideoProject,
): { x: number; y: number; width: number; height: number } {
  return {
    x: layer.x ?? 0,
    y: layer.y ?? 0,
    width: layer.width ?? project.width,
    height: layer.height ?? project.height,
  }
}

function applyTextStyle(ctx: CanvasRenderingContext2D, style: TextStyle | undefined): void {
  const s = style ?? {}
  ctx.font = `${s.fontWeight ?? 'bold'} ${s.fontSize ?? 48}px ${s.fontFamily ?? 'system-ui, sans-serif'}`
  ctx.fillStyle = s.color ?? '#ffffff'
  ctx.textAlign = s.align ?? 'center'
  ctx.textBaseline = s.baseline ?? 'middle'

  if (s.shadow) {
    ctx.shadowColor = s.shadow.color ?? 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = s.shadow.blur ?? 8
    ctx.shadowOffsetX = s.shadow.offsetX ?? 2
    ctx.shadowOffsetY = s.shadow.offsetY ?? 2
  } else {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }
}

function drawMediaInBounds(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  mediaWidth: number,
  mediaHeight: number,
  width: number,
  height: number,
  fit: 'cover' | 'contain' | 'fill',
): void {
  let drawWidth = width
  let drawHeight = height
  let drawX = 0
  let drawY = 0

  if (fit === 'cover' || fit === 'contain') {
    const scale =
      fit === 'cover'
        ? Math.max(width / mediaWidth, height / mediaHeight)
        : Math.min(width / mediaWidth, height / mediaHeight)
    drawWidth = mediaWidth * scale
    drawHeight = mediaHeight * scale
    drawX = (width - drawWidth) / 2
    drawY = (height - drawHeight) / 2
  }

  ctx.drawImage(media, drawX, drawY, drawWidth, drawHeight)
}

function drawRasterLayer(
  ctx: CanvasRenderingContext2D,
  layer: ImageLayer | VideoLayer,
  project: VideoProject,
  time: number,
  media: CanvasImageSource,
  mediaWidth: number,
  mediaHeight: number,
): void {
  const bounds = getLayerBounds(layer, project)
  const { transform, bounds: keyBounds } = computeLayerTransform(
    time,
    layer.start,
    layer.duration,
    bounds.x,
    bounds.y,
    layer.opacity ?? 1,
    project.width,
    project.height,
    layer.transition,
    layer.animation,
    layer,
  )

  if (transform.opacity <= 0) return

  const width = keyBounds.width ?? bounds.width
  const height = keyBounds.height ?? bounds.height
  const centerX = bounds.x + width / 2 + transform.x
  const centerY = bounds.y + height / 2 + transform.y

  applyCanvasEffects(ctx, layer.effects, () => {
    ctx.save()
    ctx.globalAlpha = transform.opacity

    if (transform.clipPath) {
      ctx.clip(transform.clipPath)
    }

    ctx.translate(centerX, centerY)
    ctx.rotate(((layer.rotation ?? 0) + (transform.rotation ?? 0)) * Math.PI / 180)
    ctx.scale(transform.scaleX, transform.scaleY)
    ctx.translate(-width / 2, -height / 2)

    drawMediaInBounds(ctx, media, mediaWidth, mediaHeight, width, height, layer.fit ?? 'cover')
    ctx.restore()
  })
}

function getVideoPlaybackTime(layer: VideoLayer, localTime: number, videoDuration: number): number {
  const trimStart = layer.trimStart ?? 0
  const trimEnd = layer.trimEnd ?? videoDuration
  const rate = layer.playbackRate ?? 1
  const span = Math.max(0.001, trimEnd - trimStart)
  const shifted = localTime * rate
  if (layer.loop) {
    return trimStart + (shifted % span)
  }
  return trimStart + Math.min(span, shifted)
}

function drawTitleLayer(
  ctx: CanvasRenderingContext2D,
  layer: TitleLayer,
  project: VideoProject,
  time: number,
): void {
  const bounds = getLayerBounds(layer, project)
  const { transform, bounds: keyBounds, style } = computeLayerTransform(
    time,
    layer.start,
    layer.duration,
    bounds.x,
    bounds.y,
    layer.opacity ?? 1,
    project.width,
    project.height,
    layer.transition,
    layer.animation,
    layer,
  )

  if (transform.opacity <= 0) return

  const width = keyBounds.width ?? bounds.width
  const height = keyBounds.height ?? bounds.height
  const mergedStyle = mergeTextStyle(project.theme, layer.style, style)

  applyCanvasEffects(ctx, layer.effects, () => {
    ctx.save()
    ctx.globalAlpha = transform.opacity

    const centerX = bounds.x + width / 2 + transform.x
    const centerY = bounds.y + height / 2 + transform.y

    ctx.translate(centerX, centerY)
    ctx.rotate(((layer.rotation ?? 0) + (transform.rotation ?? 0)) * Math.PI / 180)
    ctx.scale(transform.scaleX, transform.scaleY)

    applyTextStyle(ctx, mergedStyle)
    ctx.fillText(layer.text, 0, 0)
    ctx.restore()
  })
}

function drawOverlayLayer(
  ctx: CanvasRenderingContext2D,
  layer: OverlayLayer,
  project: VideoProject,
  time: number,
  images: Map<string, HTMLImageElement>,
): void {
  const bounds = getLayerBounds(layer, project)
  const { transform, bounds: keyBounds, style: keyStyle } = computeLayerTransform(
    time,
    layer.start,
    layer.duration,
    bounds.x,
    bounds.y,
    layer.opacity ?? 1,
    project.width,
    project.height,
    layer.transition,
    layer.animation,
    layer,
  )

  if (transform.opacity <= 0) return

  const width = keyBounds.width ?? bounds.width
  const height = keyBounds.height ?? bounds.height
  const style: OverlayStyle = mergeOverlayStyle(project.theme, layer.style, keyStyle)

  applyCanvasEffects(ctx, layer.effects, () => {
    ctx.save()
    ctx.globalAlpha = transform.opacity

    const x = bounds.x + transform.x
    const y = bounds.y + transform.y

    ctx.translate(x + width / 2, y + height / 2)
    ctx.rotate(((layer.rotation ?? 0) + (transform.rotation ?? 0)) * Math.PI / 180)
    ctx.scale(transform.scaleX, transform.scaleY)
    ctx.translate(-width / 2, -height / 2)

    if (layer.overlayType === 'shape') {
      ctx.fillStyle = style.backgroundColor ?? 'rgba(255,255,255,0.2)'
      if (layer.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const radius = style.borderRadius ?? 8
        roundRect(ctx, 0, 0, width, height, radius)
        ctx.fill()
        if (style.borderWidth) {
          ctx.strokeStyle = style.borderColor ?? '#ffffff'
          ctx.lineWidth = style.borderWidth
          ctx.stroke()
        }
      }
    }

    if (layer.overlayType === 'text' && layer.text) {
      if (style.backgroundColor) {
        ctx.fillStyle = style.backgroundColor
        roundRect(ctx, 0, 0, width, height, style.borderRadius ?? 8)
        ctx.fill()
      }
      applyTextStyle(ctx, style)
      ctx.fillText(layer.text, width / 2, height / 2)
    }

    if (layer.overlayType === 'image' && layer.src) {
      const image = images.get(layer.src)
      if (image) {
        ctx.drawImage(image, 0, 0, width, height)
      }
    }

    ctx.restore()
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export function drawMotionPath(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  project: VideoProject,
): void {
  const points = getMotionPathPoints(layer)
  if (points.length < 2) return

  ctx.save()
  ctx.strokeStyle = 'rgba(79, 209, 197, 0.85)'
  ctx.fillStyle = '#4fd1c5'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  points.forEach((point, index) => {
    const cx = point.x + (layer.width ?? project.width) / 2
    const cy = point.y + (layer.height ?? project.height) / 2
    if (index === 0) ctx.moveTo(cx, cy)
    else ctx.lineTo(cx, cy)
  })
  ctx.stroke()
  ctx.setLineDash([])
  points.forEach((point) => {
    const cx = point.x + (layer.width ?? project.width) / 2
    const cy = point.y + (layer.height ?? project.height) / 2
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
}

export class VideoRenderer {
  private project: VideoProject
  private images = new Map<string, HTMLImageElement>()
  private videos = new Map<string, HTMLVideoElement>()
  private loaded = false
  private resolveOptions: ResolveImageOptions

  constructor(project: VideoProject, resolveOptions: ResolveImageOptions = {}) {
    this.project = project
    this.resolveOptions = resolveOptions
  }

  async load(): Promise<void> {
    const imageSources = collectImageSources(this.project.layers)
    const videoSources = collectVideoSources(this.project.layers)

    await Promise.all([
      ...imageSources.map(async (src) => {
        const img = await loadImage(src, this.resolveOptions)
        this.images.set(src, img)
      }),
      ...videoSources.map(async (src) => {
        const video = await loadVideo(src, this.resolveOptions)
        this.videos.set(src, video)
      }),
    ])
    this.loaded = true
  }

  renderFrame(
    ctx: CanvasRenderingContext2D,
    time: number,
    options?: { motionPathLayer?: Layer | null },
  ): void {
    if (!this.loaded) return

    const { width, height, layers } = this.project
    const backgroundColor = resolveProjectBackground(this.project)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    const sorted = [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

    for (const layer of sorted) {
      if (time < layer.start || time > layer.start + layer.duration) continue

      switch (layer.type) {
        case 'image': {
          const image = this.images.get(layer.src)
          if (image) {
            drawRasterLayer(ctx, layer, this.project, time, image, image.width, image.height)
          }
          break
        }
        case 'video': {
          const video = this.videos.get(layer.src)
          if (video) {
            const localTime = time - layer.start
            const playbackTime = getVideoPlaybackTime(layer, localTime, video.duration || 0)
            seekVideo(video, playbackTime)
            drawRasterLayer(ctx, layer, this.project, time, video, video.videoWidth, video.videoHeight)
          }
          break
        }
        case 'title':
          drawTitleLayer(ctx, layer, this.project, time)
          break
        case 'overlay':
          drawOverlayLayer(ctx, layer, this.project, time, this.images)
          break
        case 'flow':
          drawFlowLayer(ctx, layer, this.project, time, this.images)
          break
        case 'audio':
          break
      }
    }

    if (options?.motionPathLayer) {
      drawMotionPath(ctx, options.motionPathLayer, this.project)
    }
  }

  updateProject(project: VideoProject): void {
    this.project = project
    this.loaded = false
    this.images.clear()
    this.videos.clear()
  }
}

export async function createRenderer(
  project: VideoProject,
  resolveOptions: ResolveImageOptions = {},
): Promise<VideoRenderer> {
  const renderer = new VideoRenderer(project, resolveOptions)
  await renderer.load()
  return renderer
}
