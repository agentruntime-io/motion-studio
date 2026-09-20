import { getAbsoluteProjectDir, getProjectRelativeDir } from './projectContext'
import { parseProjectJson } from '../data/sampleProject'

export function normalizeProjectPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

export function downloadProjectJson(json: string, filename = 'project.json'): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function listProjectFolders(): Promise<string[]> {
  try {
    const response = await fetch('/api/projects')
    if (!response.ok) return []
    const data = (await response.json()) as string[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function saveProjectToDisk(
  projectPath: string,
  json: string,
): Promise<{ path: string; relativePath: string }> {
  const response = await fetch('/api/project/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath: normalizeProjectPath(projectPath), json }),
  })

  if (!response.ok) {
    let message = 'Save failed'
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  return response.json() as Promise<{ path: string; relativePath: string }>
}

export function prepareProjectJsonForSave(
  jsonText: string,
  projectPath: string,
): string {
  const parsed = parseProjectJson(jsonText)
  parsed.projectPath = getProjectRelativeDir(normalizeProjectPath(projectPath))
  return `${JSON.stringify(parsed, null, 2)}\n`
}

export function getSaveLocationLabel(projectPath: string): string {
  return getAbsoluteProjectDir(normalizeProjectPath(projectPath))
}

export async function readProjectJsonFile(file: File): Promise<string> {
  return file.text()
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}
