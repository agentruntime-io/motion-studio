import Ajv2020 from 'ajv/dist/2020.js'
import schema from '../../schema/motion-studio.schema.json'
import type { VideoProject } from '../types/project'

export interface ValidationIssue {
  path: string
  message: string
}

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateSchema = ajv.compile(schema)

function formatAjvPath(instancePath: string, missingProperty?: string): string {
  if (!instancePath && missingProperty) return missingProperty
  const base = instancePath.replace(/^\//, '').replace(/\//g, '.')
  if (missingProperty) {
    return base ? `${base}.${missingProperty}` : missingProperty
  }
  return base || '(root)'
}

export function validateProjectObject(project: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!validateSchema(project)) {
    for (const error of validateSchema.errors ?? []) {
      issues.push({
        path: formatAjvPath(error.instancePath, error.params.missingProperty as string | undefined),
        message: error.message ?? 'Invalid value',
      })
    }
  }

  const typed = project as VideoProject
  if (typed && typeof typed === 'object') {
    issues.push(...validateLayerSemantics(typed))
  }

  return issues
}

function validateLayerSemantics(project: VideoProject): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const layerGroups: Array<{ prefix: string; layers: VideoProject['layers'] }> = []

  if (project.scenes?.length) {
    project.scenes.forEach((scene, index) => {
      layerGroups.push({
        prefix: `scenes[${index}].layers`,
        layers: scene.layers ?? [],
      })
    })
  } else if (project.layers) {
    layerGroups.push({ prefix: 'layers', layers: project.layers })
  }

  for (const group of layerGroups) {
    group.layers.forEach((layer, index) => {
      const path = `${group.prefix}[${index}]`
      if (layer.duration <= 0) {
        issues.push({ path: `${path}.duration`, message: 'must be > 0' })
      }
      if (layer.start < 0) {
        issues.push({ path: `${path}.start`, message: 'must be >= 0' })
      }
      if (layer.type === 'video') {
        if (layer.trimEnd !== undefined && layer.trimEnd <= (layer.trimStart ?? 0)) {
          issues.push({ path: `${path}.trimEnd`, message: 'must be greater than trimStart' })
        }
      }
    })
  }

  return issues
}

export function validateProjectJson(json: string): ValidationIssue[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return [{ path: '(root)', message: 'Invalid JSON syntax' }]
  }
  return validateProjectObject(parsed)
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return ''
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}

export function assertValidProjectJson(json: string): VideoProject {
  const issues = validateProjectJson(json)
  if (issues.length > 0) {
    throw new Error(formatValidationIssues(issues))
  }
  return JSON.parse(json) as VideoProject
}
