import { useEffect } from 'react'
import { JsonEditor } from './JsonEditor'
import { ProjectPathPanel } from './ProjectPathPanel'

interface JsonPanelProps {
  open: boolean
  onClose: () => void
  jsonText: string
  onChange: (value: string) => void
  error: string | null
  onApply: () => void
  onReset: () => void
  projectPath: string
  onProjectPathChange: (path: string) => void
  onLoadProject: (json: string, path?: string) => void
  onLocalFolderLoaded: () => void
  onError: (message: string | null) => void
}

export function JsonPanel({
  open,
  onClose,
  jsonText,
  onChange,
  error,
  onApply,
  onReset,
  projectPath,
  onProjectPathChange,
  onLoadProject,
  onLocalFolderLoaded,
  onError,
}: JsonPanelProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="json-drawer-backdrop" onClick={onClose}>
      <aside
        className="json-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Project JSON"
      >
        <div className="json-drawer-header">
          <h2>Project JSON</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="json-drawer-body">
          <ProjectPathPanel
            projectPath={projectPath}
            onProjectPathChange={onProjectPathChange}
            onLoadProject={onLoadProject}
            onLocalFolderLoaded={onLocalFolderLoaded}
            onError={onError}
          />
          <JsonEditor
            value={jsonText}
            onChange={onChange}
            error={error}
            onApply={onApply}
            onReset={onReset}
          />
        </div>
      </aside>
    </div>
  )
}
