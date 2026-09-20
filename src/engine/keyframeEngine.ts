import type {
  EasingType,
  KeyframeBoundsOverrides,
  KeyframeProperty,
  KeyframeStyleOverrides,
  KeyframeTrack,
  KeyframeValue,
  Layer,
  LayerKeyframes,
  LayerTransform,
} from '../types/project'
import { applyEasing } from './easing'
import {
  getDefaultKeyframeValue,
  getLayerKeyframes,
  isNumericKeyframeProperty,
  upsertKeyframe,
} from '../lib/keyframes'

function parseColor(color: string): [number, number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex.padEnd(6, '0').slice(0, 6)
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return [r, g, b, 1]
  }

  const rgba = color.match(/rgba?\(([^)]+)\)/i)
  if (rgba) {
    const parts = rgba[1].split(',').map((part) => parseFloat(part.trim()))
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1]
  }

  return [255, 255, 255, 1]
}

function formatColor(r: number, g: number, b: number, a: number): string {
  if (a < 0.999) {
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`
  }
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function interpolateColor(start: string, end: string, progress: number): string {
  const [r1, g1, b1, a1] = parseColor(start)
  const [r2, g2, b2, a2] = parseColor(end)
  return formatColor(
    r1 + (r2 - r1) * progress,
    g1 + (g2 - g1) * progress,
    b1 + (b2 - b1) * progress,
    a1 + (a2 - a1) * progress,
  )
}

export function interpolateKeyframeTrack(
  track: KeyframeTrack,
  localTime: number,
): KeyframeValue | undefined {
  const keyframes = [...track.keyframes].sort((a, b) => a.t - b.t)
  if (keyframes.length === 0) return undefined
  if (keyframes.length === 1) return keyframes[0].value

  if (localTime <= keyframes[0].t) return keyframes[0].value
  if (localTime >= keyframes[keyframes.length - 1].t) {
    return keyframes[keyframes.length - 1].value
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const start = keyframes[i]
    const end = keyframes[i + 1]
    if (localTime < start.t || localTime > end.t) continue

    const span = end.t - start.t
    if (span <= 0) return end.value

    const progress = (localTime - start.t) / span
    const eased = applyEasing(progress, end.easing ?? start.easing ?? 'easeInOut')

    if (isNumericKeyframeProperty(track.property)) {
      const a = Number(start.value)
      const b = Number(end.value)
      return a + (b - a) * eased
    }

    return interpolateColor(String(start.value), String(end.value), eased)
  }

  return keyframes[keyframes.length - 1].value
}

export function getKeyframeValueAtTime(
  layer: Layer,
  property: KeyframeProperty,
  localTime: number,
): KeyframeValue {
  const data = getLayerKeyframes(layer)
  const track = data?.tracks.find((item) => item.property === property)
  if (track) {
    const value = interpolateKeyframeTrack(track, localTime)
    if (value !== undefined) return value
  }
  return getDefaultKeyframeValue(layer, property)
}

export interface KeyframeApplyResult {
  transform: LayerTransform
  bounds: KeyframeBoundsOverrides
  style: KeyframeStyleOverrides
}

export function applyLayerKeyframes(
  transform: LayerTransform,
  time: number,
  layer: Layer,
  baseOpacity: number,
  keyframes?: LayerKeyframes,
): KeyframeApplyResult {
  const data = keyframes ?? getLayerKeyframes(layer)
  const bounds: KeyframeBoundsOverrides = {}
  const style: KeyframeStyleOverrides = {}
  let result: LayerTransform = { ...transform }

  if (!data?.tracks?.length) {
    return { transform: result, bounds, style }
  }

  const localTime = time - layer.start
  if (localTime < 0 || localTime > layer.duration) {
    return { transform: result, bounds, style }
  }

  for (const track of data.tracks) {
    const value = interpolateKeyframeTrack(track, localTime)
    if (value === undefined) continue

    switch (track.property) {
      case 'opacity':
        result.opacity = Number(value) * baseOpacity
        break
      case 'x':
        result.x += Number(value)
        break
      case 'y':
        result.y += Number(value)
        break
      case 'scale': {
        const scale = Number(value)
        result.scaleX *= scale
        result.scaleY *= scale
        break
      }
      case 'rotation':
        result.rotation = (result.rotation ?? 0) + Number(value)
        break
      case 'width':
        bounds.width = Number(value)
        break
      case 'height':
        bounds.height = Number(value)
        break
      case 'color':
        style.color = String(value)
        break
      case 'fontSize':
        style.fontSize = Number(value)
        break
      case 'backgroundColor':
        style.backgroundColor = String(value)
        break
    }
  }

  return { transform: result, bounds, style }
}

export function getMotionPathPoints(layer: Layer): { x: number; y: number; t: number }[] {
  const data = getLayerKeyframes(layer)
  if (!data) return []

  const xTrack = data.tracks.find((track) => track.property === 'x')
  const yTrack = data.tracks.find((track) => track.property === 'y')
  if (!xTrack && !yTrack) return []

  const times = new Set<number>()
  xTrack?.keyframes.forEach((kf) => times.add(kf.t))
  yTrack?.keyframes.forEach((kf) => times.add(kf.t))

  const baseX = layer.x ?? 0
  const baseY = layer.y ?? 0

  return [...times]
    .sort((a, b) => a - b)
    .map((t) => ({
      t,
      x: baseX + Number(getKeyframeValueAtTime(layer, 'x', t)),
      y: baseY + Number(getKeyframeValueAtTime(layer, 'y', t)),
    }))
}

export function sampleEasingCurve(easing: EasingType, samples = 16): string {
  const points: string[] = []
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 40
    const y = 18 - applyEasing(i / (samples - 1), easing) * 16
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points.join(' ')
}

export function upsertKeyframeAtPlayhead(
  layer: Layer,
  property: KeyframeProperty,
  localTime: number,
  value?: KeyframeValue,
): Layer {
  const current = getLayerKeyframes(layer)
  const next = upsertKeyframe(current, property, {
    t: localTime,
    value: value ?? getKeyframeValueAtTime(layer, property, localTime),
    easing: 'easeInOut',
  })
  return { ...layer, keyframes: next, workflow: undefined }
}
