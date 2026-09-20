import { useEffect, useRef, useState } from 'react'
import {
  getLocalFileCount,
  getLocalFolderName,
  hasLocalProjectFiles,
  loadLocalProjectJson,
  setLocalProjectFiles,
} from '../engine/projectFiles'
import { resolveProjectFile } from '../engine/resolveImageSrc'
import {
  getAbsoluteProjectDir,
  saveStoredProjectPath,
} from '../lib/projectContext'
import { parseProjectJson } from '../data/sampleProject'
import { analytics, type ProjectLoadSource } from '../lib/analytics'

interface ProjectPathPanelProps {
  projectPath: string
  onProjectPathChange: (path: string) => void
  onLoadProject: (json: string, path?: string, source?: ProjectLoadSource) => void
  onLocalFolderLoaded: () => void
  onError: (message: string | null) => void
}

export async function fetchProjectJson(projectPath: string): Promise<string> {
  const url = resolveProjectFile('project.json', projectPath)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`No project.json in ${getAbsoluteProjectDir(projectPath)}`)
  }
  return response.text()
}

export function ProjectPathPanel({
  projectPath,
  onProjectPathChange,
  onLoadProject,
  onLocalFolderLoaded,
  onError,
}: ProjectPathPanelProps) {
  const [loading, setLoading] = useState(false)
  const [localFolder, setLocalFolder] = useState<string | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const absolutePath = getAbsoluteProjectDir(projectPath)

  const handlePathChange = (value: string) => {
    const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    onProjectPathChange(normalized)
    saveStoredProjectPath(normalized)
    onError(null)
  }

  const loadFromDisk = async (path: string = projectPath) => {
    setLoading(true)
    onError(null)

    try {
      const json = await fetchProjectJson(path)
      parseProjectJson(json)
      onLoadProject(json, path)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load project.json')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFromDisk(projectPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    setLoading(true)
    onError(null)

    try {
      const folderName =
        (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] ??
        'local-folder'

      const indexed = setLocalProjectFiles(files, folderName)
      if (indexed === 0) {
        throw new Error('No image or SVG files found in the selected folder')
      }

      setLocalFolder(`${folderName} (${getLocalFileCount()} files)`)

      const json = await loadLocalProjectJson(files)
      if (json) {
        parseProjectJson(json)
        onLoadProject(json, projectPath, 'local_folder')
      }

      analytics.localFolderImported(indexed)
      onLocalFolderLoaded()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to read local folder')
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="project-path-panel">
      <div className="panel-header">
        <h2>Project folder</h2>
      </div>

      <p className="project-path-desc">Relative image paths resolve from this folder.</p>

      <div className="project-path-row">
        <label className="field-label" htmlFor="project-path-input">
          Folder
        </label>
        <input
          id="project-path-input"
          className="project-path-input"
          type="text"
          value={projectPath}
          placeholder="projects/my-video"
          onChange={(e) => handlePathChange(e.target.value)}
          onBlur={() => void loadFromDisk()}
        />
      </div>

      <p className="project-path-resolved">
        <code>{absolutePath}</code>
      </p>

      <div className="project-path-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => loadFromDisk()}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Reload project.json'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => folderInputRef.current?.click()}
          disabled={loading}
          title="Import a local folder with assets and project.json"
        >
          Import folder…
        </button>
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden-input"
          onChange={handleFolderSelect}
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      </div>

      {(localFolder || hasLocalProjectFiles()) && (
        <p className="project-path-local">
          Open folder: <strong>{localFolder ?? getLocalFolderName()}</strong>
        </p>
      )}
    </div>
  )
}
