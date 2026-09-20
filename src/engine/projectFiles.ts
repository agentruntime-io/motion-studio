const localFileUrls = new Map<string, string>()
let localFolderName = ''

function normalizeFileKey(key: string): string {
  return key.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()
}

export function setLocalProjectFiles(files: FileList | File[], folderName?: string): number {
  clearLocalProjectFiles()
  localFolderName = folderName ?? 'local'

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/') && !file.name.endsWith('.svg')) continue

    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const blobUrl = URL.createObjectURL(file)

    localFileUrls.set(normalizeFileKey(relativePath), blobUrl)
    localFileUrls.set(normalizeFileKey(file.name), blobUrl)

    const withoutTopFolder = relativePath.includes('/')
      ? relativePath.slice(relativePath.indexOf('/') + 1)
      : relativePath
    localFileUrls.set(normalizeFileKey(withoutTopFolder), blobUrl)
  }

  return localFileUrls.size
}

export function clearLocalProjectFiles(): void {
  for (const url of new Set(localFileUrls.values())) {
    URL.revokeObjectURL(url)
  }
  localFileUrls.clear()
  localFolderName = ''
}

export function hasLocalProjectFiles(): boolean {
  return localFileUrls.size > 0
}

export function getLocalFolderName(): string {
  return localFolderName
}

export function resolveLocalFileSrc(src: string, projectPath?: string): string | null {
  if (localFileUrls.size === 0) return null

  const candidates = new Set<string>()
  const trimmed = src.trim().replace(/\\/g, '/')

  candidates.add(normalizeFileKey(trimmed))
  candidates.add(normalizeFileKey(trimmed.replace(/^\.\//, '')))

  if (projectPath) {
    const prefix = projectPath.replace(/^\/+|\/+$/g, '')
    if (trimmed.startsWith(`${prefix}/`)) {
      candidates.add(normalizeFileKey(trimmed.slice(prefix.length + 1)))
    }
  }

  const basename = trimmed.split('/').pop()
  if (basename) candidates.add(normalizeFileKey(basename))

  for (const key of candidates) {
    const url = localFileUrls.get(key)
    if (url) return url
  }

  return null
}

export async function loadLocalProjectJson(files: FileList | File[]): Promise<string | null> {
  const jsonFile = Array.from(files).find(
    (file) => file.name === 'project.json' || file.name.endsWith('.video.json'),
  )
  if (!jsonFile) return null
  return jsonFile.text()
}

export function getLocalFileCount(): number {
  return new Set(localFileUrls.values()).size
}
