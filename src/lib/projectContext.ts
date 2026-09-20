import type { VideoProject } from '../types/project'

export interface ProjectLoadContext {
  projectPath: string
  localFilesVersion?: number
}

export const DEFAULT_PROJECT_PATH = 'projects/demo-reel'

export const PROJECT_PATH_STORAGE_KEY = 'json-video-studio.projectPath'

declare const __WORKSPACE_ROOT__: string

export function getEffectiveProjectPath(
  project: VideoProject,
  context?: ProjectLoadContext,
): string {
  const fromProject = project.projectPath?.trim()
  const fromContext = context?.projectPath?.trim()
  return fromProject || fromContext || DEFAULT_PROJECT_PATH
}

export function buildResolveOptions(project: VideoProject, context?: ProjectLoadContext) {
  return {
    projectPath: getEffectiveProjectPath(project, context),
  }
}

export function loadStoredProjectPath(): string {
  try {
    return localStorage.getItem(PROJECT_PATH_STORAGE_KEY) || DEFAULT_PROJECT_PATH
  } catch {
    return DEFAULT_PROJECT_PATH
  }
}

export function saveStoredProjectPath(path: string): void {
  try {
    localStorage.setItem(PROJECT_PATH_STORAGE_KEY, path || DEFAULT_PROJECT_PATH)
  } catch {
    // ignore storage errors
  }
}

export function getAbsoluteProjectDir(projectPath: string): string {
  const relative = getProjectRelativeDir(projectPath)
  const root = typeof __WORKSPACE_ROOT__ !== 'undefined' ? __WORKSPACE_ROOT__ : ''
  if (!root) return relative
  return joinFilesystemPath(root, relative)
}

export function getProjectRelativeDir(projectPath: string): string {
  const normalized = projectPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized) return 'projects'
  if (normalized.startsWith('projects/') || normalized === 'projects') {
    return normalized
  }
  return `projects/${normalized}`
}

function joinFilesystemPath(root: string, relative: string): string {
  const useBackslash = root.includes('\\')
  const sep = useBackslash ? '\\' : '/'
  const cleanRoot = root.replace(/[/\\]+$/, '')
  const cleanRelative = relative.replace(/[/\\]+/g, sep)
  return `${cleanRoot}${sep}${cleanRelative}`
}
