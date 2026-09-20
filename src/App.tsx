import { useCallback, useMemo, useRef, useState } from 'react'
import type { VideoProject } from './types/project'
import { sampleProject, sampleProjectJson, parseProjectJson } from './data/sampleProject'
import { useVideoRenderer } from './hooks/useVideoRenderer'
import { JsonEditor } from './components/JsonEditor'
import { PreviewPlayer, type PreviewPlayerHandle } from './components/PreviewPlayer'
import { ExportModal } from './components/ExportModal'
import { ProjectPathPanel } from './components/ProjectPathPanel'
import { loadStoredProjectPath, saveStoredProjectPath } from './lib/projectContext'
import './App.css'

function App() {
  const [jsonText, setJsonText] = useState(sampleProjectJson)
  const [project, setProject] = useState<VideoProject>(sampleProject)
  const [parseError, setParseError] = useState<string | null>(null)
  const [projectPath, setProjectPath] = useState(loadStoredProjectPath)
  const [localFilesVersion, setLocalFilesVersion] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const previewRef = useRef<PreviewPlayerHandle>(null)

  const loadContext = useMemo(
    () => ({
      projectPath,
      localFilesVersion,
    }),
    [projectPath, localFilesVersion],
  )

  const { ready, error: loadError, renderFrame } = useVideoRenderer(project, loadContext)

  const handleApply = useCallback(() => {
    try {
      const parsed = parseProjectJson(jsonText)
      if (parsed.projectPath && parsed.projectPath !== projectPath) {
        setProjectPath(parsed.projectPath.replace(/^\/+|\/+$/g, ''))
      }
      setProject(parsed)
      setParseError(null)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON')
    }
  }, [jsonText, projectPath])

  const handleReset = () => {
    setJsonText(sampleProjectJson)
    setProject(sampleProject)
    setParseError(null)
  }

  const handleLoadProject = useCallback((json: string, path?: string) => {
    const parsed = parseProjectJson(json)
    setJsonText(json)
    setProject(parsed)
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
  }, [])

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

      <main className="app-main">
        <section className="panel editor-panel">
          <ProjectPathPanel
            projectPath={projectPath}
            onProjectPathChange={setProjectPath}
            onLoadProject={handleLoadProject}
            onLocalFolderLoaded={() => setLocalFilesVersion((v) => v + 1)}
            onError={setParseError}
          />
          <JsonEditor
            value={jsonText}
            onChange={setJsonText}
            error={displayError}
            onApply={handleApply}
            onReset={handleReset}
          />
        </section>

        <section className="panel preview-panel">
          <div className="panel-header">
            <h2>Preview</h2>
            {ready && <span className="badge badge-success">Ready</span>}
          </div>
          <PreviewPlayer
            ref={previewRef}
            project={project}
            ready={ready}
            renderFrame={renderFrame}
          />
        </section>
      </main>
    </div>
  )
}

export default App
