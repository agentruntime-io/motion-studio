import { useEffect } from 'react'
import type { FlowLayer } from '../types/project'
import { FlowEditor } from './FlowEditor'

interface FlowEditorModalProps {
  open: boolean
  onClose: () => void
  layer: FlowLayer
  layerLabel?: string
  canvasWidth: number
  canvasHeight: number
  onUpdate: (updater: (layer: FlowLayer) => FlowLayer) => void
}

export function FlowEditorModal({
  open,
  onClose,
  layer,
  layerLabel,
  canvasWidth,
  canvasHeight,
  onUpdate,
}: FlowEditorModalProps) {
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
    <div className="flow-editor-modal-backdrop" onClick={onClose}>
      <div
        className="flow-editor-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Edit flow diagram"
      >
        <div className="flow-editor-modal-header">
          <div>
            <h2>Edit flow</h2>
            {layerLabel && <p className="flow-editor-modal-subtitle">{layerLabel}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="flow-editor-modal-body">
          <FlowEditor
            layout="expanded"
            layer={layer}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </div>
  )
}
