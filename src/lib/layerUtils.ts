import type {
  AnimationType,
  Layer,
  TransitionType,
  VideoProject,
} from '../types/project'
export const TRANSITION_OPTIONS: TransitionType[] = [
  'fade',
  'slideLeft',
  'slideRight',
  'slideUp',
  'slideDown',
  'zoomIn',
  'zoomOut',
  'wipeLeft',
  'wipeRight',
]

export const ANIMATION_OPTIONS: AnimationType[] = [
  'fadeIn',
  'fadeOut',
  'slideInLeft',
  'slideInRight',
  'slideInUp',
  'slideInDown',
  'scaleIn',
  'scaleOut',
  'bounce',
]

export type TrackKind = 'video' | 'title' | 'overlay' | 'audio'

export type AddLayerKind = TrackKind

export interface TimelineTrack {
  id: string
  kind: TrackKind
  label: string
  layers: Layer[]
}

const TRACK_DEFS: { kind: TrackKind; id: string; label: string }[] = [
  { kind: 'video', id: 'video', label: 'Video' },
  { kind: 'title', id: 'title', label: 'Titles' },
  { kind: 'overlay', id: 'overlay', label: 'Overlays' },
  { kind: 'audio', id: 'audio', label: 'Audio' },
]

export function getTrackKindLabel(kind: TrackKind): string {
  return TRACK_DEFS.find((t) => t.kind === kind)?.label ?? kind
}

export const ADD_LAYER_OPTIONS: { kind: AddLayerKind; label: string; short: string }[] = [
  { kind: 'video', label: 'Video clip', short: 'Video' },
  { kind: 'title', label: 'Title', short: 'Title' },
  { kind: 'overlay', label: 'Overlay', short: 'Overlay' },
  { kind: 'audio', label: 'Audio', short: 'Audio' },
]

export function getLayerId(layer: Layer, index: number): string {
  return layer.id ?? `layer-${index}`
}

export function ensureLayerIds(project: VideoProject): VideoProject {
  return {
    ...project,
    layers: project.layers.map((layer, index) => ({
      ...layer,
      id: getLayerId(layer, index),
    })),
  }
}

export function getLayerLabel(layer: Layer): string {
  switch (layer.type) {
    case 'image':
      if (layer.src.startsWith('data:')) return 'Image'
      if (layer.src.startsWith('<svg')) return 'SVG'
      return layer.src.split('/').pop()?.split('?')[0] ?? 'Image'
    case 'video':
      return layer.src.split('/').pop()?.split('?')[0] ?? 'Video clip'
    case 'title':
      return layer.text.length > 18 ? `${layer.text.slice(0, 18)}…` : layer.text
    case 'overlay':
      if (layer.overlayType === 'text') {
        const t = layer.text ?? 'Text'
        return t.length > 18 ? `${t.slice(0, 18)}…` : t
      }
      if (layer.overlayType === 'image') return layer.src?.split('/').pop() ?? 'Image'
      return layer.shape ?? 'Shape'
    case 'audio':
      if (!layer.src) return 'Audio'
      return layer.src.split('/').pop()?.split('?')[0] ?? 'Audio'
    case 'flow':
      return layer.nodes.length === 1
        ? layer.nodes[0].label
        : `Flow (${layer.nodes.length} nodes)`
    default:
      return 'Layer'
  }
}

export function getLayerColor(layer: Layer): string {
  switch (layer.type) {
    case 'image':
      return '#365d4a'
    case 'video':
      return '#2563eb'
    case 'title':
      return '#63527e'
    case 'overlay':
      if (layer.overlayType === 'text') return '#405f78'
      if (layer.overlayType === 'image') return '#845d42'
      return '#475569'
    case 'audio':
      return '#0f766e'
    case 'flow':
      return '#0891b2'
    default:
      return '#334155'
  }
}

export function getTrackKind(layer: Layer): TrackKind {
  if (layer.type === 'image' || layer.type === 'video') return 'video'
  if (layer.type === 'title') return 'title'
  if (layer.type === 'audio') return 'audio'
  if (layer.type === 'flow') return 'overlay'
  return 'overlay'
}

export function buildTracks(layers: Layer[]): TimelineTrack[] {
  const sorted = [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  const kindCounts: Record<TrackKind, number> = {
    video: 0,
    title: 0,
    overlay: 0,
    audio: 0,
  }

  return sorted.map((layer) => {
    const kind = getTrackKind(layer)
    kindCounts[kind] += 1
    const index = layers.indexOf(layer)
    const layerId = getLayerId(layer, index)
    const typeName =
      kind === 'video' ? 'Video' : kind === 'title' ? 'Title' : kind === 'audio' ? 'Audio' : 'Overlay'

    return {
      id: layerId,
      kind,
      label: `${typeName} ${kindCounts[kind]}`,
      layers: [layer],
    }
  })
}

export function createDefaultLayer(
  kind: AddLayerKind,
  project: VideoProject,
  startTime: number,
): Layer {
  const start = clamp(startTime, 0, Math.max(0, project.duration - 0.5))
  const duration = Math.max(0.5, Math.min(3, project.duration - start))
  const id = `${kind}-${Math.random().toString(36).slice(2, 8)}`

  switch (kind) {
    case 'video':
      return {
        id,
        type: 'video',
        src: '',
        start,
        duration,
        width: project.width,
        height: project.height,
        zIndex: 0,
        fit: 'cover',
        playbackRate: 1,
        volume: 1,
        loop: false,
      }
    case 'title':
      return {
        id,
        type: 'title',
        text: 'New Title',
        start,
        duration,
        x: 0,
        y: project.height * 0.4,
        width: project.width,
        height: 100,
        zIndex: 10,
        style: {
          fontSize: 48,
          fontWeight: '700',
          color: '#ffffff',
          align: 'center',
        },
      }
    case 'overlay':
      return {
        id,
        type: 'overlay',
        overlayType: 'text',
        text: 'New overlay',
        start,
        duration,
        x: 40,
        y: project.height - 80,
        width: 400,
        height: 56,
        zIndex: 20,
        style: {
          fontSize: 24,
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.55)',
          padding: 12,
          borderRadius: 8,
        },
      }
    case 'audio':
      return {
        id,
        type: 'audio',
        src: '',
        start,
        duration,
        volume: 1,
        zIndex: -1,
      }
  }
}

export function addImageLayer(project: VideoProject, startTime: number): VideoProject {
  const start = clamp(startTime, 0, Math.max(0, project.duration - 0.5))
  const duration = Math.max(0.5, Math.min(3, project.duration - start))
  const layer: Layer = {
    id: `image-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    src: '',
    start,
    duration,
    width: project.width,
    height: project.height,
    zIndex: 0,
    fit: 'cover',
  }
  return { ...project, layers: [...project.layers, layer] }
}

export function addLayer(
  project: VideoProject,
  kind: AddLayerKind,
  startTime: number,
): VideoProject {
  const layer = createDefaultLayer(kind, project, startTime)
  return { ...project, layers: [...project.layers, layer] }
}

export function removeLayer(project: VideoProject, layerId: string): VideoProject {
  const index = findLayerIndex(project, layerId)
  if (index < 0) return project
  return {
    ...project,
    layers: project.layers.filter((_, i) => i !== index),
  }
}

export function findLayerIndex(project: VideoProject, layerId: string): number {
  return project.layers.findIndex((layer, index) => getLayerId(layer, index) === layerId)
}

export function updateLayer(
  project: VideoProject,
  layerId: string,
  updater: (layer: Layer) => Layer,
): VideoProject {
  const index = findLayerIndex(project, layerId)
  if (index < 0) return project
  const layers = [...project.layers]
  layers[index] = updater(layers[index])
  return { ...project, layers }
}

export function duplicateLayer(project: VideoProject, layerId: string, startTime: number): VideoProject {
  const index = findLayerIndex(project, layerId)
  if (index < 0) return project
  const source = project.layers[index]
  const copy = {
    ...structuredClone(source),
    id: `${source.type}-${Math.random().toString(36).slice(2, 8)}`,
    start: clamp(startTime, 0, Math.max(0, project.duration - source.duration)),
    x: (source.x ?? 0) + 24,
    y: (source.y ?? 0) + 24,
  }
  return { ...project, layers: [...project.layers, copy] }
}

export function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const f = Math.floor((seconds % 1) * 100)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function projectToJson(project: VideoProject): string {
  return JSON.stringify(project, null, 2)
}
