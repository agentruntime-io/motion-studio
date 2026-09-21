import type { Layer, Scene, VideoProject } from '../types/project'
import { ensureLayerIds } from './layerUtils'

function cloneLayerForScene(layer: Layer, sceneId: string, sceneOffset: number): Layer {
  const next: Layer = {
    ...layer,
    start: sceneOffset + layer.start,
  }
  if (layer.id) {
    next.id = `${sceneId}:${layer.id}`
  }
  return next
}

export function compileScenesToTimeline(project: VideoProject): VideoProject {
  if (!project.scenes?.length) {
    return ensureLayerIds({
      ...project,
      schemaVersion: project.schemaVersion ?? '1.0',
    })
  }

  const flatLayers: Layer[] = []
  let offset = 0

  for (const [index, scene] of project.scenes.entries()) {
    const sceneId = scene.id ?? `scene-${index + 1}`
    for (const layer of scene.layers) {
      flatLayers.push(cloneLayerForScene(layer, sceneId, offset))
    }
    offset += scene.duration
  }

  return ensureLayerIds({
    ...project,
    schemaVersion: project.schemaVersion ?? '1.0',
    duration: offset,
    layers: flatLayers,
  })
}

export function getSceneSummary(scenes: Scene[]): { sceneCount: number; totalDuration: number } {
  return {
    sceneCount: scenes.length,
    totalDuration: scenes.reduce((sum, scene) => sum + scene.duration, 0),
  }
}
