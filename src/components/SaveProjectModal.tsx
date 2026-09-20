import { useEffect, useMemo, useState } from 'react'
import {
  getSaveLocationLabel,
  listProjectFolders,
  normalizeProjectPath,
  prepareProjectJsonForSave,
  saveProjectToDisk,
  downloadProjectJson,
} from '../lib/projectIO'
import { getProjectRelativeDir } from '../lib/projectContext'
import { analytics } from '../lib/analytics'

interface SaveProjectModalProps {
  open: boolean
  onClose: () => void
  projectPath: string
  jsonText: string
  onSaved: (projectPath: string, jsonText: string) => void
}

export function SaveProjectModal({
  open,
  onClose,
  projectPath,
  jsonText,
  onSaved,
}: SaveProjectModalProps) {
  const [path, setPath] = useState(projectPath)
  const [folders, setFolders] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPath(projectPath || 'projects/my-video')
    setError(null)
    void listProjectFolders().then(setFolders)
  }, [open, projectPath])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose, saving])

  const saveLocation = useMemo(() => {
    const normalized = normalizeProjectPath(path)
    if (!normalized) return ''
    return `${getSaveLocationLabel(normalized)}/project.json`
  }, [path])

  const handleSelectFolder = (value: string) => {
    if (value === '__custom__') return
    setPath(value)
  }

  const handleSave = async () => {
    const normalized = normalizeProjectPath(path)
    if (!normalized) {
      setError('Enter a project folder path.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const json = prepareProjectJsonForSave(jsonText, normalized)

      try {
        await saveProjectToDisk(normalized, json)
        analytics.projectSaved('disk')
        onSaved(getProjectRelativeDir(normalized), json)
        onClose()
      } catch {
        const folderName = normalized.split('/').pop() || 'project'
        downloadProjectJson(json, `${folderName}.project.json`)
        analytics.projectSaved('download')
        onSaved(getProjectRelativeDir(normalized), json)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save project')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={() => !saving && onClose()}>
      <div className="modal save-project-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <h2>Save project</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="save-project-desc">
          Choose where to save <strong>project.json</strong>. Image paths resolve relative to this
          folder.
        </p>

        {folders.length > 0 && (
          <label className="save-project-field">
            <span>Existing projects</span>
            <select
              className="inspector-select"
              value={folders.includes(path) ? path : '__custom__'}
              onChange={(e) => handleSelectFolder(e.target.value)}
              disabled={saving}
            >
              {!folders.includes(path) && (
                <option value="__custom__">Custom path…</option>
              )}
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="save-project-field">
          <span>Save location</span>
          <input
            type="text"
            className="inspector-input"
            value={path}
            placeholder="projects/my-video"
            onChange={(e) => setPath(e.target.value)}
            disabled={saving}
          />
        </label>

        {saveLocation && (
          <p className="save-project-resolved">
            File: <code>{saveLocation}</code>
          </p>
        )}

        {error && <p className="error-message">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-accent" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save project.json'}
          </button>
        </div>
      </div>
    </div>
  )
}
