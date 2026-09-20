import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Layer, LayerKeyframes, SelectedKeyframeRef } from './types/project'
import { sampleProject, sampleProjectJson, parseProjectJson } from './data/sampleProject'
import { useVideoRenderer } from './hooks/useVideoRenderer'
import { useProjectHistory } from './hooks/useProjectHistory'
import { PreviewPlayer, type PreviewPlayerHandle } from './components/PreviewPlayer'
import { PrerenderButton } from './components/PrerenderButton'
import { ExportModal } from './components/ExportModal'
import { JsonPanel } from './components/JsonPanel'
import { SaveProjectModal } from './components/SaveProjectModal'
import { Timeline } from './components/Timeline'
import { LayerInspector } from './components/LayerInspector'
import { ResizeHandle } from './components/ResizeHandle'
import { usePrerender } from './hooks/usePrerender'
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout'
import { loadStoredProjectPath, saveStoredProjectPath } from './lib/projectContext'
import { isEditableTarget, readProjectJsonFile } from './lib/projectIO'
import {
  addLayer,
  findLayerIndex,
  getLayerId,
  removeLayer,
  updateLayer,
  type AddLayerKind,
} from './lib/layerUtils'
import {
  clampLayerKeyframes,
  cloneLayerKeyframes,
  getAvailableKeyframeProperties,
  getLayerKeyframes,
  pasteKeyframesOntoLayer,
  removeKeyframe,
  moveKeyframeTime,
} from './lib/keyframes'
import { upsertKeyframeAtPlayhead } from './engine/keyframeEngine'
import type { KeyframeProperty } from './types/project'
import './App.css'

function App() {
  const [parseError, setParseError] = useState<string | null>(null)
  const [projectPath, setProjectPath] = useState(loadStoredProjectPath)
  const [localFilesVersion, setLocalFilesVersion] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [selectedKeyframe, setSelectedKeyframe] = useState<SelectedKeyframeRef | null>(null)
  const [autoKeyframe, setAutoKeyframe] = useState(false)
  const [keyframeClipboard, setKeyframeClipboard] = useState<LayerKeyframes | null>(null)
  const previewRef = useRef<PreviewPlayerHandle>(null)
  const openFileRef = useRef<HTMLInputElement>(null)
  const {
    propertiesWidth,
    timelineHeight,
    resizeProperties,
    resizeTimeline,
    persistLayout,
  } = useWorkspaceLayout()

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

  const projectRef = useRef(project)
  projectRef.current = project

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
    setSelectedKeyframe(null)
    setCurrentTime(0)
  }

  const handleLoadProject = useCallback(
    (json: string, path?: string) => {
      const parsed = parseProjectJson(json)
      replaceProject(parsed, json, true)
      setSelectedLayerId(null)
      setSelectedKeyframe(null)
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

  const handleOpenProjectFile = useCallback(() => {
    openFileRef.current?.click()
  }, [])

  const handleProjectFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      try {
        const json = await readProjectJsonFile(file)
        handleLoadProject(json)
        setSaveNotice(`Opened ${file.name}`)
        setParseError(null)
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to open project file')
      }
    },
    [handleLoadProject],
  )

  const handleProjectSaved = useCallback(
    (path: string, json: string) => {
      const normalized = path.replace(/^\/+|\/+$/g, '')
      setProjectPath(normalized)
      saveStoredProjectPath(normalized)
      replaceProject(parseProjectJson(json), json, false)
      setSaveNotice(`Saved to ${normalized}/project.json`)
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
        updateLayer(projectRef.current, layerId, (layer) =>
          clampLayerKeyframes({
            ...layer,
            ...patch,
          }),
        ),
        'none',
      )
    },
    [applyProject],
  )

  const handleMoveKeyframe = useCallback(
    (layerId: string, property: KeyframeProperty, fromTime: number, toTime: number) => {
      const rounded = Math.round(toTime * 100) / 100
      applyProject(
        updateLayer(projectRef.current, layerId, (layer) => {
          const next = moveKeyframeTime(
            getLayerKeyframes(layer),
            property,
            fromTime,
            rounded,
            layer.duration,
          )
          if (!next) return layer
          return { ...layer, keyframes: next }
        }),
        true,
      )
      setSelectedKeyframe({ layerId, property, t: rounded })
    },
    [applyProject],
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
      setSelectedKeyframe(null)
    },
    [applyProject, project],
  )

  const selectedLayer = useMemo(() => {
    if (!selectedLayerId) return null
    const index = findLayerIndex(project, selectedLayerId)
    return index >= 0 ? project.layers[index] : null
  }, [project, selectedLayerId])

  const motionPathLayer = useMemo(() => {
    if (!selectedLayer || selectedLayer.type === 'audio') return null
    const data = getLayerKeyframes(selectedLayer)
    const hasMotion = data?.tracks.some(
      (track) =>
        (track.property === 'x' || track.property === 'y') && track.keyframes.length > 0,
    )
    return hasMotion ? selectedLayer : null
  }, [selectedLayer])

  const addKeyframesAtPlayhead = useCallback(() => {
    if (!selectedLayerId || !selectedLayer || selectedLayer.type === 'audio') return
    const localTime = Math.max(0, Math.min(selectedLayer.duration, currentTime - selectedLayer.start))
    const inClip =
      currentTime >= selectedLayer.start && currentTime <= selectedLayer.start + selectedLayer.duration
    if (!inClip) return

    applyProject(
      updateLayer(project, selectedLayerId, (layer) => {
        let next = layer
        for (const property of getAvailableKeyframeProperties(layer)) {
          next = upsertKeyframeAtPlayhead(next, property, localTime)
        }
        return next
      }),
      true,
    )
  }, [applyProject, currentTime, project, selectedLayer, selectedLayerId])

  const deleteSelectedKeyframe = useCallback(() => {
    if (!selectedKeyframe) return
    applyProject(
      updateLayer(project, selectedKeyframe.layerId, (layer) => {
        const next = removeKeyframe(
          getLayerKeyframes(layer),
          selectedKeyframe.property,
          selectedKeyframe.t,
        )
        if (!next) {
          const { keyframes: _k, ...rest } = layer
          return rest
        }
        return { ...layer, keyframes: next }
      }),
      true,
    )
    setSelectedKeyframe(null)
  }, [applyProject, project, selectedKeyframe])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && !isEditableTarget(event.target)) {
        if (event.key === 's') {
          event.preventDefault()
          setSaveOpen(true)
          return
        }
        if (event.key === 'o') {
          event.preventDefault()
          handleOpenProjectFile()
          return
        }
      }

      if (isEditableTarget(event.target)) return

      if (event.key === 'k' || event.key === 'K') {
        event.preventDefault()
        addKeyframesAtPlayhead()
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedKeyframe) {
        event.preventDefault()
        deleteSelectedKeyframe()
        return
      }

      if (!mod || isEditableTarget(event.target)) return

      if (event.key === 'c' && selectedLayer) {
        const copied = cloneLayerKeyframes(getLayerKeyframes(selectedLayer))
        if (copied) {
          event.preventDefault()
          setKeyframeClipboard(copied)
        }
      } else if (event.key === 'v' && selectedLayerId && keyframeClipboard) {
        event.preventDefault()
        applyProject(
          updateLayer(project, selectedLayerId, (layer) =>
            pasteKeyframesOntoLayer(layer, keyframeClipboard),
          ),
          true,
        )
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    addKeyframesAtPlayhead,
    applyProject,
    deleteSelectedKeyframe,
    handleOpenProjectFile,
    keyframeClipboard,
    project,
    selectedKeyframe,
    selectedLayer,
    selectedLayerId,
  ])

  const displayError = parseError ?? loadError

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">▶</span>
          <div className="brand-copy">
            <h1>Motion Studio</h1>
            <span className="brand-tagline">Your ideas, in motion.</span>
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
          <div className="header-file-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleOpenProjectFile}
              title="Open project.json (Ctrl+O)"
            >
              Open
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSaveOpen(true)}
              title="Save project.json (Ctrl+S)"
            >
              Save
            </button>
          </div>
          <button
            type="button"
            className={`btn btn-ghost btn-json ${jsonOpen ? 'active' : ''}`}
            onClick={() => setJsonOpen(true)}
          >
            JSON
          </button>
          <button
            type="button"
            className="btn btn-accent btn-export"
            onClick={() => setExportOpen(true)}
            disabled={!ready}
          >
            Export video ↗
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

      <SaveProjectModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        projectPath={projectPath}
        jsonText={jsonText}
        onSaved={handleProjectSaved}
      />

      <input
        ref={openFileRef}
        type="file"
        accept=".json,application/json"
        className="hidden-input"
        onChange={(event) => void handleProjectFileSelected(event)}
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

      <div className="project-bar">
        <div className="project-breadcrumb"><span>Workspace</span><span>/</span><strong>{projectPath?.split('/').pop() || 'Untitled project'}</strong><span className="project-format">PROJECT</span></div>
        <div className="project-meta"><span>{project.width} × {project.height}</span><span>{project.fps} fps</span><span>{project.duration}s</span></div>
        <span className="local-status" role="status">{saveNotice || '● Local workspace'}</span>
      </div>
      <main className="app-main">
        <section
          className="panel properties-panel"
          style={{ width: propertiesWidth }}
        >
          <div className="panel-header">
            <h2>Inspector</h2><span className="panel-caption">{selectedLayer ? selectedLayer.type : 'Project'}</span>
          </div>
          {!selectedLayer && <div className="project-overview">
            <div className="overview-art" aria-hidden="true"><span>m</span><i /><i /></div>
            <h3>Make something move.</h3>
            <p>Start with a layer. Turn it into a story.</p>
            <div className="quick-add-grid">
              <button onClick={() => handleAddLayer('video')}><span>▧</span>Visual<span>+</span></button>
              <button onClick={() => handleAddLayer('title')}><span>T</span>Title<span>+</span></button>
              <button onClick={() => handleAddLayer('overlay')}><span>◇</span>Overlay<span>+</span></button>
              <button onClick={() => handleAddLayer('audio')}><span>♫</span>Audio<span>+</span></button>
            </div>
            <div className="composition-details"><h4>COMPOSITION</h4><dl><div><dt>Canvas</dt><dd>{project.width} × {project.height}</dd></div><div><dt>Frame rate</dt><dd>{project.fps} fps</dd></div><div><dt>Duration</dt><dd>{project.duration} seconds</dd></div><div><dt>Layers</dt><dd>{project.layers.length}</dd></div></dl></div>
          </div>}
          {selectedLayer && <LayerInspector
            layer={selectedLayer}
            layerId={selectedLayerId}
            projectWidth={project.width}
            projectHeight={project.height}
            currentTime={currentTime}
            autoKeyframe={autoKeyframe}
            selectedKeyframe={selectedKeyframe}
            onSelectKeyframe={setSelectedKeyframe}
            onToggleAutoKeyframe={() => setAutoKeyframe((value) => !value)}
            onUpdate={handleLayerUpdate}
            onDelete={handleDeleteLayer}
          />}
          <div className="inspector-footer"><span>↖ Select a clip to fine-tune it</span><a href="https://agentruntime.io" target="_blank" rel="noreferrer">Made by AgentRuntime ↗</a></div>
        </section>

        <ResizeHandle
          direction="horizontal"
          ariaLabel="Resize properties panel"
          onDrag={resizeProperties}
          onDragEnd={persistLayout}
        />

        <section className="panel workspace-panel">
          <div className="workspace-preview">
            <div className="panel-header preview-panel-header">
              <div className="preview-heading"><h2>Preview</h2><span>Composition</span></div>
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
              motionPathLayer={motionPathLayer}
              prerenderUrl={prerenderUrl}
              usePrerenderPreview={usePrerenderPreview}
              currentTime={currentTime}
              onCurrentTimeChange={setCurrentTime}
            />
          </div>

          <ResizeHandle
            direction="vertical"
            ariaLabel="Resize timeline panel"
            onDrag={resizeTimeline}
            onDragEnd={persistLayout}
          />

          <div className="workspace-timeline" style={{ height: timelineHeight }}>
            <Timeline
              project={project}
              currentTime={currentTime}
              selectedLayerId={selectedLayerId}
              selectedKeyframe={selectedKeyframe}
              onSelectLayer={setSelectedLayerId}
              onSelectKeyframe={setSelectedKeyframe}
              onSeek={setCurrentTime}
              onUpdateLayer={handleTimelineUpdate}
              onMoveKeyframe={handleMoveKeyframe}
              onAddLayer={handleAddLayer}
              onLayerDragStart={beginDrag}
              onLayerDragEnd={endDrag}
            />
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
