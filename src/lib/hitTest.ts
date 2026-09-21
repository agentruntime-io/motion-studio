import type { Layer, VideoProject } from '../types/project'
import { computeLayerTransform } from '../engine/animations'

export interface LayerHitRect {
  layerId: string
  layer: Layer
  x: number
  y: number
  width: number
  height: number
}

function getLayerBounds(layer: Layer, project: VideoProject) {
  return {
    x: layer.x ?? 0,
    y: layer.y ?? 0,
    width: layer.width ?? project.width,
    height: layer.height ?? project.height,
  }
}

export function getLayerHitRect(
  layer: Layer,
  project: VideoProject,
  time: number,
  layerId: string,
): LayerHitRect | null {
  if (time < layer.start || time > layer.start + layer.duration) return null
  if (layer.type === 'audio') return null

  const bounds = getLayerBounds(layer, project)
  const { transform, bounds: keyBounds } = computeLayerTransform(
    time,
    layer.start,
    layer.duration,
    bounds.x,
    bounds.y,
    layer.opacity ?? 1,
    project.width,
    project.height,
    layer.transition,
    layer.animation,
    layer,
  )

  if (transform.opacity <= 0) return null

  const width = keyBounds.width ?? bounds.width
  const height = keyBounds.height ?? bounds.height
  const scaleX = Math.abs(transform.scaleX)
  const scaleY = Math.abs(transform.scaleY)

  return {
    layerId,
    layer,
    x: bounds.x + transform.x,
    y: bounds.y + transform.y,
    width: width * scaleX,
    height: height * scaleY,
  }
}

export function hitTestLayersAtTime(
  project: VideoProject,
  time: number,
  point: { x: number; y: number },
  getLayerId: (layer: Layer, index: number) => string,
): LayerHitRect | null {
  const sorted = [...project.layers]
    .map((layer, index) => ({ layer, index }))
    .sort((a, b) => (b.layer.zIndex ?? 0) - (a.layer.zIndex ?? 0))

  for (const { layer, index } of sorted) {
    const rect = getLayerHitRect(layer, project, time, getLayerId(layer, index))
    if (!rect) continue
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    ) {
      return rect
    }
  }

  return null
}

export function canvasPointFromEvent(
  canvas: HTMLCanvasElement,
  event: { clientX: number; clientY: number },
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

export const SNAP_GRID = 8

export function snapValue(value: number, grid = SNAP_GRID): number {
  return Math.round(value / grid) * grid
}
