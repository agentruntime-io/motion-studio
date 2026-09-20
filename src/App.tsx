import { useCallback, useMemo, useRef, useState } from 'react'
import type { Layer } from './types/project'
import { sampleProject, sampleProjectJson, parseProjectJson } from './data/sampleProject'
import { useVideoRenderer } from './hooks/useVideoRenderer'
import { useProjectHistory } from './hooks/useProjectHistory'
import { PreviewPlayer, type PreviewPlayerHandle } from './components/PreviewPlayer'
import { PrerenderButton } from './components/PrerenderButton'
import { ExportModal } from './components/ExportModal'
import { JsonPanel } from './components/JsonPanel'
import { Timeline } from './components/Timeline'
import { LayerInspector } from './components/LayerInspector'
import { usePrerender } from './hooks/usePrerender'
import { loadStoredProjectPath, saveStoredProjectPath } from './lib/projectContext'
import {
  addLayer,
  findLayerIndex,
  getLayerId,
  removeLayer,
  updateLayer,
  type AddLayerKind,
} from './lib/layerUtils'
import './App.css'

function App() {
  const [parseError, setParseError] = useState<string | null>(null)
  const [projectPath, setProjectPath] = useState(loadStoredProjectPath)
  const [localFilesVersion, setLocalFilesVersion] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const previewRef = useRef<PreviewPlayerHandle>(null)

  const {
    project,
    jsonText,
    setJsonText,
    applyProject,
    replaceProject,
    undo,
    redo,
    canUndo,
    canRedo,
    beginDrag,
    endDrag,
  } = useProjectHistory(sampleProject, sampleProjectJson)

  const loadContext = useMemo(
    () => ({
      projectPath,
      localFilesVersion,
    }),
    [projectPath, localFilesVersion],
  )

  const { ready, error: loadError, renderFrame } = useVideoRenderer(project, loadContext)

  const getCanvas = useCallback(() => previewRef.current?.getCanvas() ?? null, [])

  const {
    prerenderUrl,
    usePrerenderPreview,
    stale: prerenderStale,
    rendering: prerenderRendering,
    progress: prerenderProgress,
    runPrerender,
  } = usePrerender({
    projectPath,
    project,
    localFilesVersion,
    jsonText,
    ready,
    renderFrame,
    getCanvas,
  })

  const handleApply = useCallback(() => {
    try {
      const parsed = parseProjectJson(jsonText)
      if (parsed.projectPath && parsed.projectPath !== projectPath) {
        setProjectPath(parsed.projectPath.replace(/^\/+|\/+$/g, ''))
      }
      applyProject(parsed, true)
      setParseError(null)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON')
    }
  }, [applyProject, jsonText, projectPath])

  const handleReset = () => {
    replaceProject(sampleProject, sampleProjectJson, true)
    setParseError(null)
    setSelectedLayerId(null)
    setCurrentTime(0)
  }

  const handleLoadProject = useCallback(
    (json: string, path?: string) => {
      const parsed = parseProjectJson(json)
      replaceProject(parsed, json, true)
      setSelectedLayerId(null)
      setCurrentTime(0)
      if (path) {
        const normalized = path.replace(/^\/+|\/+$/g, '')
        setProjectPath(normalized)
        saveStoredProjectPath(normalized)
      } else if (parsed.projectPath) {
        const normalized = parsed.projectPath.replace(/^\/+|\/+$/g, '')
        setProjectPath(normalized)
        saveStoredProjectPath(normalized)
      }
      setParseError(null)
    },
    [replaceProject],
  )

  const handleLayerUpdate = useCallback(
    (layerId: string, updater: (layer: Layer) => Layer) => {
      applyProject(updateLayer(project, layerId, updater), 'debounced')
    },
    [applyProject, project],
  )

  const handleTimelineUpdate = useCallback(
    (layerId: string, patch: { start?: number; duration?: number }) => {
      applyProject(
        updateLayer(project, layerId, (layer) => ({
          ...layer,
          ...patch,
        })),
        'none',
      )
    },
    [applyProject, project],
  )

  const handleAddLayer = useCallback(
    (kind: AddLayerKind) => {
      const next = addLayer(project, kind, currentTime)
      const index = next.layers.length - 1
      const newLayer = next.layers[index]
      applyProject(next, true)
      setSelectedLayerId(getLayerId(newLayer, index))
    },
    [applyProject, project, currentTime],
  )

  const handleDeleteLayer = useCallback(
    (layerId: string) => {
      applyProject(removeLayer(project, layerId), true)
      setSelectedLayerId(null)
    },
    [applyProject, project],
  )

  const selectedLayer = useMemo(() => {
    if (!selectedLayerId) return null
    const index = findLayerIndex(project, selectedLayerId)
    return index >= 0 ? project.layers[index] : null
  }, [project, selectedLayerId])

  const displayError = parseError ?? loadError

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">▶</span>
          <div>
            <h1>JSON Video Studio</h1>
            <p>Generate videos from JSON — images, transitions, overlays, animations & effects</p>
          </div>
        </div>
        <div className="header-right">
          <div className="header-history">
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↷
            </button>
          </div>
          <button
            type="button"
            className={`btn btn-ghost btn-json ${jsonOpen ? 'active' : ''}`}
            onClick={() => setJsonOpen(true)}
          >
            JSON
          </button>
          <div className="project-meta">
            {projectPath && <span>{projectPath}</span>}
            <span>{project.width}×{project.height}</span>
            <span>{project.fps} fps</span>
            <span>{project.duration}s</span>
            <span>{project.layers.length} layers</span>
          </div>
          <button
            type="button"
            className="btn btn-accent btn-export"
            onClick={() => setExportOpen(true)}
            disabled={!ready}
          >
            Export
          </button>
        </div>
      </header>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        project={project}
        ready={ready}
        renderFrame={renderFrame}
        previewRef={previewRef}
      />

      <JsonPanel
        open={jsonOpen}
        onClose={() => setJsonOpen(false)}
        jsonText={jsonText}
        onChange={setJsonText}
        error={displayError}
        onApply={handleApply}
        onReset={handleReset}
        projectPath={projectPath}
        onProjectPathChange={setProjectPath}
        onLoadProject={handleLoadProject}
        onLocalFolderLoaded={() => setLocalFilesVersion((v) => v + 1)}
        onError={setParseError}
      />

      <main className="app-main">
        <section className="panel properties-panel">
          <div className="panel-header">
            <h2>Properties</h2>
          </div>
          <LayerInspector
            layer={selectedLayer}
            layerId={selectedLayerId}
            onUpdate={handleLayerUpdate}
            onDelete={handleDeleteLayer}
          />
        </section>

        <section className="panel workspace-panel">
          <div className="panel-header preview-panel-header">
            <h2>Preview</h2>
            <div className="preview-panel-actions">
              {ready && <span className="badge badge-success">Ready</span>}
              <PrerenderButton
                onPrerender={runPrerender}
                rendering={prerenderRendering}
                stale={prerenderStale}
                ready={ready}
                progress={prerenderProgress?.progress}
              />
            </div>
          </div>
          <PreviewPlayer
            ref={previewRef}
            project={project}
            ready={ready}
            renderFrame={renderFrame}
            prerenderUrl={prerenderUrl}
            usePrerenderPreview={usePrerenderPreview}
            currentTime={currentTime}
            onCurrentTimeChange={setCurrentTime}
          />
          <Timeline
            project={project}
            currentTime={currentTime}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onSeek={setCurrentTime}
            onUpdateLayer={handleTimelineUpdate}
            onAddLayer={handleAddLayer}
            onLayerDragStart={beginDrag}
            onLayerDragEnd={endDrag}
          />
        </section>
      </main>
    </div>
  )
}

export default App
