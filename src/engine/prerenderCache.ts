export interface PrerenderEntry {
  projectPath: string
  fingerprint: string
  blob: Blob
  url: string
}

let entry: PrerenderEntry | null = null

export function getPrerenderEntry(): PrerenderEntry | null {
  return entry
}

export function getPrerenderUrl(fingerprint: string, projectPath: string): string | null {
  if (!entry) return null
  if (entry.projectPath !== projectPath || entry.fingerprint !== fingerprint) return null
  return entry.url
}

export function isPrerenderStale(fingerprint: string, projectPath: string): boolean {
  if (!entry) return false
  if (entry.projectPath !== projectPath) return false
  return entry.fingerprint !== fingerprint
}

export function hasPrerenderForProject(projectPath: string): boolean {
  return entry?.projectPath === projectPath
}

export function setPrerender(projectPath: string, fingerprint: string, blob: Blob): string {
  clearPrerender()
  const url = URL.createObjectURL(blob)
  entry = { projectPath, fingerprint, blob, url }
  return url
}

export function clearPrerender(): void {
  if (entry) {
    URL.revokeObjectURL(entry.url)
    entry = null
  }
}

export function clearPrerenderForProject(projectPath: string): void {
  if (entry?.projectPath === projectPath) {
    clearPrerender()
  }
}

export function computeProjectFingerprint(
  projectPath: string,
  project: unknown,
  localFilesVersion: number,
  jsonText: string,
): string {
  return JSON.stringify({ projectPath, localFilesVersion, jsonText, project })
}
