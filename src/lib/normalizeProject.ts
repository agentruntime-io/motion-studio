import type { VideoProject } from '../types/project'
import { compileScenesToTimeline } from './compileScenes'
import { ensureLayerIds } from './layerUtils'
import { validateProjectObject, formatValidationIssues } from './validateProject'

export function validateAndPrepareProject(project: VideoProject): VideoProject {
  const withVersion: VideoProject = {
    schemaVersion: project.schemaVersion ?? '1.0',
    ...project,
  }

  const issues = validateProjectObject(withVersion)
  if (issues.length > 0) {
    throw new Error(formatValidationIssues(issues))
  }

  if (withVersion.scenes?.length) {
    return {
      ...withVersion,
      scenes: withVersion.scenes.map((scene) => ({
        ...scene,
        layers: ensureLayerIds({ ...withVersion, layers: scene.layers }).layers,
      })),
      layers: withVersion.layers ?? [],
    }
  }

  if (!Array.isArray(withVersion.layers)) {
    throw new Error('Invalid project JSON: requires layers[] or scenes[]')
  }

  return ensureLayerIds(withVersion)
}

/** Flatten scenes into a render-ready timeline without mutating authoring JSON. */
export function compileForRender(project: VideoProject): VideoProject {
  if (project.scenes?.length) {
    return compileScenesToTimeline(project)
  }
  return ensureLayerIds({
    ...project,
    schemaVersion: project.schemaVersion ?? '1.0',
  })
}

/** @deprecated Use validateAndPrepareProject or compileForRender */
export function normalizeProject(project: VideoProject): VideoProject {
  return validateAndPrepareProject(project)
}
