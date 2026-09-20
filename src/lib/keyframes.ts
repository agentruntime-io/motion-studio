import type {
  Keyframe,
  KeyframeProperty,
  KeyframeValue,
  Layer,
  LayerKeyframes,
} from '../types/project'

export function getLayerKeyframes(layer: Layer): LayerKeyframes | undefined {
  return layer.keyframes
}

export function clampLayerKeyframes(layer: Layer): Layer {
  const keyframes = getLayerKeyframes(layer)
  if (!keyframes) return layer

  const clamped: LayerKeyframes = {
    ...keyframes,
    tracks: keyframes.tracks
      .map((track) => ({
        ...track,
        keyframes: track.keyframes
          .filter((kf) => kf.t >= 0 && kf.t <= layer.duration)
          .sort((a, b) => a.t - b.t),
      }))
      .filter((track) => track.keyframes.length > 0),
  }

  if (clamped.tracks.length === 0) {
    const { keyframes: _k, ...rest } = layer
    return rest
  }

  return { ...layer, keyframes: clamped }
}

export function countKeyframes(keyframes?: LayerKeyframes): number {
  if (!keyframes) return 0
  return keyframes.tracks.reduce((sum, track) => sum + track.keyframes.length, 0)
}

export function flattenKeyframeMarkers(layer: Layer): { property: KeyframeProperty; t: number }[] {
  const data = getLayerKeyframes(layer)
  if (!data) return []
  return data.tracks.flatMap((track) =>
    track.keyframes.map((kf) => ({ property: track.property, t: kf.t })),
  )
}

export function upsertKeyframe(
  keyframes: LayerKeyframes | undefined,
  property: KeyframeProperty,
  keyframe: Keyframe,
): LayerKeyframes {
  const current: LayerKeyframes = keyframes ?? { tracks: [] }
  const tracks = current.tracks.map((track) => ({
    ...track,
    keyframes: [...track.keyframes],
  }))

  const index = tracks.findIndex((track) => track.property === property)
  if (index >= 0) {
    const existing = tracks[index].keyframes.findIndex(
      (kf) => Math.abs(kf.t - keyframe.t) < 0.05,
    )
    if (existing >= 0) {
      tracks[index].keyframes[existing] = keyframe
    } else {
      tracks[index].keyframes.push(keyframe)
    }
  } else {
    tracks.push({ property, keyframes: [keyframe] })
  }

  return { ...current, tracks }
}

export function removeKeyframe(
  keyframes: LayerKeyframes | undefined,
  property: KeyframeProperty,
  time: number,
): LayerKeyframes | undefined {
  if (!keyframes) return undefined

  const tracks = keyframes.tracks
    .map((track) => {
      if (track.property !== property) return track
      return {
        ...track,
        keyframes: track.keyframes.filter((kf) => Math.abs(kf.t - time) >= 0.05),
      }
    })
    .filter((track) => track.keyframes.length > 0)

  if (tracks.length === 0) return undefined
  return { ...keyframes, tracks }
}

export function moveKeyframeTime(
  keyframes: LayerKeyframes | undefined,
  property: KeyframeProperty,
  fromTime: number,
  toTime: number,
  duration: number,
): LayerKeyframes | undefined {
  if (!keyframes) return undefined
  const track = keyframes.tracks.find((item) => item.property === property)
  const keyframe = track?.keyframes.find((kf) => Math.abs(kf.t - fromTime) < 0.05)
  if (!keyframe) return keyframes

  const without = removeKeyframe(keyframes, property, fromTime)
  return upsertKeyframe(without, property, {
    ...keyframe,
    t: Math.max(0, Math.min(duration, toTime)),
  })
}

export function scaleKeyframesToDuration(
  keyframes: LayerKeyframes,
  duration: number,
): LayerKeyframes {
  return {
    ...keyframes,
    tracks: keyframes.tracks.map((track) => ({
      ...track,
      keyframes: track.keyframes.map((keyframe) => ({
        ...keyframe,
        t: keyframe.t * duration,
      })),
    })),
  }
}

export const KEYFRAME_PROPERTY_LABELS: Record<KeyframeProperty, string> = {
  opacity: 'Opacity',
  x: 'Position X',
  y: 'Position Y',
  scale: 'Scale',
  rotation: 'Rotation',
  width: 'Width',
  height: 'Height',
  color: 'Text color',
  fontSize: 'Font size',
  backgroundColor: 'Background',
}

export const NUMERIC_KEYFRAME_PROPERTIES: KeyframeProperty[] = [
  'opacity',
  'x',
  'y',
  'scale',
  'rotation',
  'width',
  'height',
  'fontSize',
]

export const COLOR_KEYFRAME_PROPERTIES: KeyframeProperty[] = ['color', 'backgroundColor']

export const KEYFRAME_PROPERTY_COLORS: Record<KeyframeProperty, string> = {
  opacity: '#f472b6',
  x: '#60a5fa',
  y: '#34d399',
  scale: '#fbbf24',
  rotation: '#a78bfa',
  width: '#fb923c',
  height: '#fdba74',
  color: '#f87171',
  fontSize: '#c084fc',
  backgroundColor: '#94a3b8',
}

export function isNumericKeyframeProperty(property: KeyframeProperty): boolean {
  return NUMERIC_KEYFRAME_PROPERTIES.includes(property)
}

export function propertyAllowedOnLayer(layer: Layer, property: KeyframeProperty): boolean {
  if (layer.type === 'audio' || layer.type === 'flow') return false
  if (property === 'color' || property === 'fontSize') {
    return layer.type === 'title' || (layer.type === 'overlay' && layer.overlayType === 'text')
  }
  if (property === 'backgroundColor') {
    return layer.type === 'overlay'
  }
  return true
}

export function getAvailableKeyframeProperties(layer: Layer): KeyframeProperty[] {
  return (Object.keys(KEYFRAME_PROPERTY_LABELS) as KeyframeProperty[]).filter((property) =>
    propertyAllowedOnLayer(layer, property),
  )
}

export function getDefaultKeyframeValue(layer: Layer, property: KeyframeProperty): KeyframeValue {
  switch (property) {
    case 'opacity':
      return layer.opacity ?? 1
    case 'x':
    case 'y':
      return 0
    case 'scale':
      return 1
    case 'rotation':
      return 0
    case 'width':
      return layer.width ?? 0
    case 'height':
      return layer.height ?? 0
    case 'color':
      if (layer.type === 'title' || layer.type === 'overlay') {
        return layer.style?.color ?? '#ffffff'
      }
      return '#ffffff'
    case 'fontSize':
      if (layer.type === 'title' || layer.type === 'overlay') {
        return layer.style?.fontSize ?? 48
      }
      return 48
    case 'backgroundColor':
      if (layer.type === 'overlay') {
        return layer.style?.backgroundColor ?? 'rgba(0,0,0,0.5)'
      }
      return 'rgba(0,0,0,0.5)'
    default:
      return 0
  }
}

export function cloneLayerKeyframes(keyframes?: LayerKeyframes): LayerKeyframes | null {
  if (!keyframes) return null
  return JSON.parse(JSON.stringify(keyframes)) as LayerKeyframes
}

export function pasteKeyframesOntoLayer(
  layer: Layer,
  clipboard: LayerKeyframes,
  timeOffset = 0,
): Layer {
  const merged: LayerKeyframes = cloneLayerKeyframes(getLayerKeyframes(layer)) ?? { tracks: [] }

  for (const track of clipboard.tracks) {
    if (!propertyAllowedOnLayer(layer, track.property)) continue
    for (const keyframe of track.keyframes) {
      const next = upsertKeyframe(merged, track.property, {
        ...keyframe,
        t: Math.max(0, Math.min(layer.duration, keyframe.t + timeOffset)),
      })
      merged.tracks = next.tracks
      if (next.name) merged.name = next.name
    }
  }

  return { ...layer, keyframes: merged }
}
