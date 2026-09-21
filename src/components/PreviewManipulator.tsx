import { useEffect, useMemo, useRef, useState } from 'react'
import type { Layer, VideoProject } from '../types/project'
import { compileForRender } from '../lib/normalizeProject'
import {
  canvasPointFromEvent,
  getLayerHitRect,
  hitTestLayersAtTime,
  snapValue,
  type LayerHitRect,
} from '../lib/hitTest'
import { findLayerIndex, getLayerId } from '../lib/layerUtils'

type DragMode = 'move' | 'resize-se'

interface PreviewManipulatorProps {
  project: VideoProject
  canvas: HTMLCanvasElement | null
  currentTime: number
  selectedLayerId: string | null
  onSelectLayer: (layerId: string | null) => void
  onUpdateLayer: (layerId: string, patch: Partial<Layer>) => void
}

export function PreviewManipulator({
  project,
  canvas,
  currentTime,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
}: PreviewManipulatorProps) {
  const renderProject = useMemo(() => compileForRender(project), [project])
  const [drag, setDrag] = useState<{
    mode: DragMode
    layerId: string
    startX: number
    startY: number
    originX: number
    originY: number
    originWidth: number
    originHeight: number
  } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag

  const selectedRect = useMemo(() => {
    if (!selectedLayerId) return null
    const index = findLayerIndex(renderProject, selectedLayerId)
    if (index < 0) return null
    const layer = renderProject.layers[index]
    return getLayerHitRect(layer, renderProject, currentTime, selectedLayerId)
  }, [renderProject, selectedLayerId, currentTime])

  useEffect(() => {
    if (!canvas) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const point = canvasPointFromEvent(canvas, event)
      const hit = hitTestLayersAtTime(renderProject, currentTime, point, getLayerId)
      if (!hit) {
        onSelectLayer(null)
        return
      }

      onSelectLayer(hit.layerId)
      const layer = hit.layer
      setDrag({
        mode: 'move',
        layerId: hit.layerId,
        startX: point.x,
        startY: point.y,
        originX: layer.x ?? 0,
        originY: layer.y ?? 0,
        originWidth: layer.width ?? renderProject.width,
        originHeight: layer.height ?? renderProject.height,
      })
      canvas.setPointerCapture(event.pointerId)
      event.preventDefault()
    }

    const handlePointerMove = (event: PointerEvent) => {
      const active = dragRef.current
      if (!active || !canvas) return
      const point = canvasPointFromEvent(canvas, event)

      if (active.mode === 'move') {
        const dx = point.x - active.startX
        const dy = point.y - active.startY
        onUpdateLayer(active.layerId, {
          x: snapValue(active.originX + dx),
          y: snapValue(active.originY + dy),
        })
      } else {
        const width = Math.max(24, snapValue(active.originWidth + (point.x - active.startX)))
        const height = Math.max(24, snapValue(active.originHeight + (point.y - active.startY)))
        onUpdateLayer(active.layerId, { width, height })
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (dragRef.current) {
        setDrag(null)
        canvas.releasePointerCapture(event.pointerId)
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [canvas, currentTime, onSelectLayer, onUpdateLayer, renderProject])

  if (!canvas || !selectedRect) return null

  const scaleX = canvas.clientWidth / canvas.width
  const scaleY = canvas.clientHeight / canvas.height

  const boxStyle = {
    left: selectedRect.x * scaleX,
    top: selectedRect.y * scaleY,
    width: selectedRect.width * scaleX,
    height: selectedRect.height * scaleY,
  }

  const startResize = (event: React.PointerEvent) => {
    event.stopPropagation()
    if (!selectedLayerId) return
    const layer = renderProject.layers[findLayerIndex(renderProject, selectedLayerId)]
    const point = canvasPointFromEvent(canvas, event)
    setDrag({
      mode: 'resize-se',
      layerId: selectedLayerId,
      startX: point.x,
      startY: point.y,
      originX: layer.x ?? 0,
      originY: layer.y ?? 0,
      originWidth: layer.width ?? renderProject.width,
      originHeight: layer.height ?? renderProject.height,
    })
    canvas.setPointerCapture(event.pointerId)
  }

  return (
    <div className="preview-manipulator" aria-hidden="true">
      <div className="preview-selection-box" style={boxStyle}>
        <button
          type="button"
          className="preview-resize-handle"
          onPointerDown={startResize}
          aria-label="Resize layer"
        />
      </div>
    </div>
  )
}

export type { LayerHitRect }
