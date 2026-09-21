import { describeImageSrc, isRemoteUrl, resolveImageSrc, type ResolveImageOptions } from './resolveImageSrc'

const imageCache = new Map<string, HTMLImageElement>()
const videoCache = new Map<string, HTMLVideoElement>()

export async function loadImage(src: string, options: ResolveImageOptions = {}): Promise<HTMLImageElement> {
  const cacheKey = `${options.projectPath ?? ''}|${options.baseUrl ?? ''}|${src}`
  const cached = imageCache.get(cacheKey)
  if (cached) return cached

  const resolvedSrc = resolveImageSrc(src, options)

  return new Promise((resolve, reject) => {
    const img = new Image()

    if (isRemoteUrl(resolvedSrc)) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => {
      imageCache.set(cacheKey, img)
      resolve(img)
    }

    img.onerror = () => {
      const kind = describeImageSrc(src)
      reject(new Error(`Failed to load ${kind} image: ${src} (resolved: ${resolvedSrc})`))
    }

    img.src = resolvedSrc
  })
}

export async function preloadProjectAssets(
  sources: string[],
  options: ResolveImageOptions = {},
): Promise<void> {
  const unique = [...new Set(sources.filter(Boolean))]
  await Promise.all(unique.map((src) => loadImage(src, options)))
}

export async function loadVideo(src: string, options: ResolveImageOptions = {}): Promise<HTMLVideoElement> {
  const cacheKey = `${options.projectPath ?? ''}|${options.baseUrl ?? ''}|${src}`
  const cached = videoCache.get(cacheKey)
  if (cached) return cached

  const resolvedSrc = resolveImageSrc(src, options)

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'

    const finish = () => {
      videoCache.set(cacheKey, video)
      resolve(video)
    }

    video.onloadeddata = finish
    video.onerror = () => {
      reject(new Error(`Failed to load video: ${src} (resolved: ${resolvedSrc})`))
    }

    video.src = resolvedSrc
  })
}

export function seekVideo(video: HTMLVideoElement, timeSec: number): void {
  if (Math.abs(video.currentTime - timeSec) > 0.03) {
    video.currentTime = timeSec
  }
}

export function clearAssetCache(): void {
  imageCache.clear()
  videoCache.clear()
}

export function createGradientDataUrl(
  width: number,
  height: number,
  colors: [string, string],
  label?: string,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, colors[0])
  gradient.addColorStop(1, colors[1])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = `bold ${Math.floor(width * 0.06)}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, width / 2, height / 2)
  }

  return canvas.toDataURL('image/png')
}

export { resolveImageSrc, describeImageSrc, isInlineSvg, isRemoteUrl } from './resolveImageSrc'
