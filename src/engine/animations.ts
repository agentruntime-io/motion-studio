import type {
  AnimationConfig,
  AnimationType,
  EasingType,
  Layer,
  LayerTransform,
  TransitionType,
} from '../types/project'
import { applyEasing, bounceOut } from './easing'
import { applyTransition } from './transitions'
import { applyLayerKeyframes } from './keyframeEngine'
import { getLayerKeyframes } from '../lib/keyframes'

export function computeLayerTransform(
  time: number,
  start: number,
  duration: number,
  baseX: number,
  baseY: number,
  baseOpacity: number,
  canvasWidth: number,
  canvasHeight: number,
  transition?: { in?: TransitionType; out?: TransitionType; duration?: number },
  animation?: AnimationConfig,
  layer?: Layer,
): { transform: LayerTransform; bounds: { width?: number; height?: number }; style: { color?: string; fontSize?: number; backgroundColor?: string } } {
  const end = start + duration
  const transitionDuration = transition?.duration ?? 0.5
  const animationDuration = animation?.duration ?? 0.6
  const easing = animation?.easing ?? 'easeInOut'

  let transform: LayerTransform = {
    opacity: baseOpacity,
    x: baseX,
    y: baseY,
    scaleX: 1,
    scaleY: 1,
  }

  if (time < start || time > end) {
    return {
      transform: { ...transform, opacity: 0 },
      bounds: {},
      style: {},
    }
  }

  const localTime = time - start
  const timeToEnd = end - time

  if (transition?.in && localTime < transitionDuration) {
    const progress = localTime / transitionDuration
    const delta = applyTransitionDelta(transition.in, progress, canvasWidth, canvasHeight, 'in', easing)
    transform = mergeTransform(transform, delta)
  } else if (animation?.in && localTime < animationDuration) {
    const progress = localTime / animationDuration
    const delta = applyAnimationDelta(animation.in, progress, canvasWidth, canvasHeight, 'in', easing)
    transform = mergeTransform(transform, delta)
  }

  if (transition?.out && timeToEnd < transitionDuration) {
    const progress = 1 - timeToEnd / transitionDuration
    const delta = applyTransitionDelta(transition.out, progress, canvasWidth, canvasHeight, 'out', easing)
    transform = mergeTransform(transform, delta)
  } else if (animation?.out && timeToEnd < animationDuration) {
    const progress = 1 - timeToEnd / animationDuration
    const delta = applyAnimationDelta(animation.out, progress, canvasWidth, canvasHeight, 'out', easing)
    transform = mergeTransform(transform, delta)
  }

  const keyframed = layer
    ? applyLayerKeyframes(transform, time, layer, baseOpacity, getLayerKeyframes(layer))
    : { transform, bounds: {}, style: {} }

  return keyframed
}

function applyTransitionDelta(
  type: TransitionType,
  progress: number,
  width: number,
  height: number,
  direction: 'in' | 'out',
  easing: EasingType,
): Partial<LayerTransform> {
  return applyTransition(type, applyEasing(progress, easing), width, height, direction)
}

function applyAnimationDelta(
  type: AnimationType,
  progress: number,
  width: number,
  height: number,
  direction: 'in' | 'out',
  easing: EasingType,
): Partial<LayerTransform> {
  const t = type === 'bounce' && direction === 'in'
    ? bounceOut(applyEasing(progress, easing))
    : applyEasing(progress, easing)
  const inverse = direction === 'out' ? 1 - t : t

  switch (type) {
    case 'fadeIn':
    case 'fadeOut':
      return { opacity: inverse }

    case 'slideInLeft':
      return { opacity: inverse, x: width * 0.3 * (1 - t) * (direction === 'in' ? 1 : -1) }
    case 'slideInRight':
      return { opacity: inverse, x: -width * 0.3 * (1 - t) * (direction === 'in' ? 1 : -1) }
    case 'slideInUp':
      return { opacity: inverse, y: height * 0.2 * (1 - t) * (direction === 'in' ? 1 : -1) }
    case 'slideInDown':
      return { opacity: inverse, y: -height * 0.2 * (1 - t) * (direction === 'in' ? 1 : -1) }

    case 'scaleIn':
      return {
        opacity: inverse,
        scaleX: direction === 'in' ? 0.3 + 0.7 * t : 1 - 0.7 * t,
        scaleY: direction === 'in' ? 0.3 + 0.7 * t : 1 - 0.7 * t,
      }
    case 'scaleOut':
      return {
        opacity: inverse,
        scaleX: direction === 'out' ? t : 1,
        scaleY: direction === 'out' ? t : 1,
      }

    case 'bounce':
      return {
        opacity: inverse,
        y: direction === 'in' ? -height * 0.15 * (1 - t) : height * 0.15 * t,
        scaleX: 0.8 + 0.2 * t,
        scaleY: 0.8 + 0.2 * t,
      }

    default:
      return { opacity: inverse }
  }
}

function mergeTransform(base: LayerTransform, delta: Partial<LayerTransform>): LayerTransform {
  return {
    opacity: (delta.opacity ?? 1) * base.opacity,
    x: base.x + (delta.x ?? 0),
    y: base.y + (delta.y ?? 0),
    scaleX: base.scaleX * (delta.scaleX ?? 1),
    scaleY: base.scaleY * (delta.scaleY ?? 1),
    clipPath: delta.clipPath ?? base.clipPath,
  }
}
