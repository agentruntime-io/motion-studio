import type { LayerTransform, TransitionType } from '../types/project'
import { applyEasing } from './easing'

export function applyTransition(
  type: TransitionType,
  progress: number,
  width: number,
  height: number,
  direction: 'in' | 'out',
): Partial<LayerTransform> {
  const t = applyEasing(progress)
  const inverse = direction === 'out' ? 1 - t : t

  switch (type) {
    case 'fade':
      return { opacity: inverse }

    case 'slideLeft':
      return {
        opacity: inverse,
        x: direction === 'in' ? width * (1 - t) : -width * t,
      }

    case 'slideRight':
      return {
        opacity: inverse,
        x: direction === 'in' ? -width * (1 - t) : width * t,
      }

    case 'slideUp':
      return {
        opacity: inverse,
        y: direction === 'in' ? height * (1 - t) : -height * t,
      }

    case 'slideDown':
      return {
        opacity: inverse,
        y: direction === 'in' ? -height * (1 - t) : height * t,
      }

    case 'zoomIn':
      return {
        opacity: inverse,
        scaleX: direction === 'in' ? 0.5 + 0.5 * t : 1 + 0.5 * t,
        scaleY: direction === 'in' ? 0.5 + 0.5 * t : 1 + 0.5 * t,
      }

    case 'zoomOut':
      return {
        opacity: inverse,
        scaleX: direction === 'in' ? 1.5 - 0.5 * t : 1 - 0.5 * t,
        scaleY: direction === 'in' ? 1.5 - 0.5 * t : 1 - 0.5 * t,
      }

    case 'wipeLeft': {
      const clip = new Path2D()
      const wipeWidth = width * inverse
      clip.rect(width - wipeWidth, 0, wipeWidth, height)
      return { opacity: 1, clipPath: clip }
    }

    case 'wipeRight': {
      const clip = new Path2D()
      const wipeWidth = width * inverse
      clip.rect(0, 0, wipeWidth, height)
      return { opacity: 1, clipPath: clip }
    }

    default:
      return { opacity: inverse }
  }
}
