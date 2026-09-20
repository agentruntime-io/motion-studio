import { resolveLocalFileSrc } from './projectFiles'

export interface ResolveImageOptions {
  baseUrl?: string
  projectPath?: string
}

const INLINE_SVG_PATTERN = /^\s*(<\?xml[\s\S]*?>\s*)?<svg[\s>]/i

export function isInlineSvg(src: string): boolean {
  return INLINE_SVG_PATTERN.test(src.trim())
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`
}

export function isRemoteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src.trim())
}

export function isDataOrBlobUrl(src: string): boolean {
  const trimmed = src.trim()
  return trimmed.startsWith('data:') || trimmed.startsWith('blob:')
}

export function normalizeProjectPath(projectPath?: string): string {
  if (!projectPath) return ''
  return projectPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

/**
 * Resolve image `src` values from JSON into a browser-loadable URL.
 *
 * Supported formats:
 * - HTTPS URLs: https://example.com/photo.jpg
 * - Data URLs: data:image/png;base64,...
 * - Project files: hero.jpg → /{projectPath}/hero.jpg (from repo projects/ folder)
 * - Inline SVG: "<svg xmlns=...>...</svg>"
 * - Local folder files: blob URLs when a folder is selected in the UI
 */
export function resolveImageSrc(src: string, options: ResolveImageOptions = {}): string {
  const trimmed = src.trim()
  if (!trimmed) {
    throw new Error('Image src cannot be empty')
  }

  if (isInlineSvg(trimmed)) {
    return svgToDataUrl(trimmed)
  }

  if (isDataOrBlobUrl(trimmed) || isRemoteUrl(trimmed)) {
    return trimmed
  }

  const localSrc = resolveLocalFileSrc(trimmed, options.projectPath)
  if (localSrc) {
    return localSrc
  }

  if (!options.projectPath) {
    throw new Error(
      `Relative path "${src}" requires a project folder. Use a URL, data URL, inline SVG, or open a local folder.`,
    )
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl ?? import.meta.env.BASE_URL ?? '/')
  let path = trimmed.replace(/\\/g, '/')

  if (path.startsWith('./')) {
    path = path.slice(2)
  }

  if (!path.startsWith('/')) {
    path = `/${path}`
  }

  path = applyProjectPath(path, options.projectPath)

  return `${baseUrl}${path}`
}

export function resolveProjectFile(filename: string, projectPath?: string): string {
  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL ?? '/')
  const cleanName = filename.replace(/^\/+/, '')
  let path = `/${cleanName}`
  path = applyProjectPath(path, projectPath)
  return `${baseUrl}${path}`
}

function applyProjectPath(path: string, projectPath?: string): string {
  const prefix = normalizeProjectPath(projectPath)
  if (!prefix) return path

  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized === `/${prefix}` || normalized.startsWith(`/${prefix}/`)) {
    return normalized
  }

  return `/${prefix}${normalized}`
}

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl || baseUrl === '/') return ''
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export function describeImageSrc(src: string): string {
  if (isInlineSvg(src)) return 'inline-svg'
  if (isDataOrBlobUrl(src)) return 'data-url'
  if (isRemoteUrl(src)) return 'url'
  return 'path'
}

export function getProjectDirOnDisk(projectPath: string): string {
  const normalized = normalizeProjectPath(projectPath)
  if (!normalized) return 'projects'
  if (normalized.startsWith('projects/') || normalized === 'projects') {
    return normalized
  }
  return `projects/${normalized}`
}
