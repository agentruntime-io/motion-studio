import posthog from 'posthog-js'
import type { VideoProject } from '../types/project'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com'

let enabled = false

export type ProjectLoadSource = 'disk' | 'file' | 'local_folder' | 'reset'

function capture(event: string, properties?: Record<string, string | number | boolean>) {
  if (!enabled) return
  posthog.capture(event, properties)
}

export function projectMetrics(project: VideoProject) {
  const layerTypes: Record<string, number> = {}
  for (const layer of project.layers) {
    layerTypes[layer.type] = (layerTypes[layer.type] ?? 0) + 1
  }

  return {
    layer_count: project.layers.length,
    width: project.width,
    height: project.height,
    fps: project.fps,
    duration_sec: project.duration,
    has_flow_layer: (layerTypes.flow ?? 0) > 0,
    layer_type_image: layerTypes.image ?? 0,
    layer_type_video: layerTypes.video ?? 0,
    layer_type_title: layerTypes.title ?? 0,
    layer_type_overlay: layerTypes.overlay ?? 0,
    layer_type_audio: layerTypes.audio ?? 0,
    layer_type_flow: layerTypes.flow ?? 0,
  }
}

export function initAnalytics() {
  if (!POSTHOG_KEY) return
  if (import.meta.env.DEV && import.meta.env.VITE_POSTHOG_DEV !== 'true') return

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
  })

  enabled = true
}

export const analytics = {
  projectLoaded(source: ProjectLoadSource, project: VideoProject) {
    capture('project_loaded', { source, ...projectMetrics(project) })
  },

  jsonApplied(project: VideoProject) {
    capture('json_applied', projectMetrics(project))
  },

  jsonPanelOpened() {
    capture('json_panel_opened')
  },

  exportModalOpened(project: VideoProject) {
    capture('export_modal_opened', projectMetrics(project))
  },

  exportStarted(project: VideoProject) {
    capture('export_started', projectMetrics(project))
  },

  exportCompleted(project: VideoProject) {
    capture('export_completed', projectMetrics(project))
  },

  exportFailed(project: VideoProject, reason: string) {
    capture('export_failed', { ...projectMetrics(project), reason })
  },

  previewPlayed(project: VideoProject) {
    capture('preview_played', projectMetrics(project))
  },

  projectSaved(method: 'disk' | 'download') {
    capture('project_saved', { method })
  },

  localFolderImported(fileCount: number) {
    capture('local_folder_imported', { file_count: fileCount })
  },

  flowEditorOpened(nodeCount: number, edgeCount: number) {
    capture('flow_editor_opened', { node_count: nodeCount, edge_count: edgeCount })
  },

  prerenderStarted(project: VideoProject) {
    capture('prerender_started', projectMetrics(project))
  },

  prerenderCompleted(project: VideoProject) {
    capture('prerender_completed', projectMetrics(project))
  },

  prerenderFailed(project: VideoProject, reason: string) {
    capture('prerender_failed', { ...projectMetrics(project), reason })
  },

  layerAdded(kind: string, project: VideoProject) {
    capture('layer_added', { kind, ...projectMetrics(project) })
  },
}
