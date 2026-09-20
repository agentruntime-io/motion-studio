import { useCallback, useEffect, useRef, useState } from 'react'
import type { VideoProject } from '../types/project'
import { ensureLayerIds, projectToJson } from '../lib/layerUtils'

const MAX_HISTORY = 50
const DEBOUNCE_MS = 400

export type HistoryMode = boolean | 'debounced' | 'none'

export function useProjectHistory(initial: VideoProject, initialJson: string) {
  const [project, setProject] = useState<VideoProject>(() => ensureLayerIds(initial))
  const [jsonText, setJsonText] = useState(initialJson)
  const [past, setPast] = useState<VideoProject[]>([])
  const [future, setFuture] = useState<VideoProject[]>([])

  const projectRef = useRef(project)
  projectRef.current = project

  const dragSnapshotRef = useRef<VideoProject | null>(null)
  const debounceSnapshotRef = useRef<VideoProject | null>(null)
  const debounceTimerRef = useRef<number | null>(null)

  const pushPast = useCallback((snapshot: VideoProject) => {
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), snapshot])
    setFuture([])
  }, [])

  const flushDebounce = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (debounceSnapshotRef.current) {
      pushPast(debounceSnapshotRef.current)
      debounceSnapshotRef.current = null
    }
  }, [pushPast])

  const applyProject = useCallback(
    (next: VideoProject, history: HistoryMode = true) => {
      const withIds = ensureLayerIds(next)

      if (history === true) {
        flushDebounce()
        pushPast(projectRef.current)
      } else if (history === 'debounced') {
        if (!debounceSnapshotRef.current) {
          debounceSnapshotRef.current = projectRef.current
        }
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = window.setTimeout(() => {
          if (debounceSnapshotRef.current) {
            pushPast(debounceSnapshotRef.current)
            debounceSnapshotRef.current = null
          }
          debounceTimerRef.current = null
        }, DEBOUNCE_MS)
      }

      setProject(withIds)
      setJsonText(projectToJson(withIds))
    },
    [flushDebounce, pushPast],
  )

  const replaceProject = useCallback((next: VideoProject, json?: string, resetHistory = true) => {
    flushDebounce()
    const withIds = ensureLayerIds(next)
    setProject(withIds)
    setJsonText(json ?? projectToJson(withIds))
    if (resetHistory) {
      setPast([])
      setFuture([])
    }
  }, [flushDebounce])

  const undo = useCallback(() => {
    flushDebounce()
    setPast((p) => {
      if (p.length === 0) return p
      const previous = p[p.length - 1]
      setFuture((f) => [projectRef.current, ...f])
      const withIds = ensureLayerIds(previous)
      setProject(withIds)
      setJsonText(projectToJson(withIds))
      return p.slice(0, -1)
    })
  }, [flushDebounce])

  const redo = useCallback(() => {
    flushDebounce()
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setPast((p) => [...p, projectRef.current])
      const withIds = ensureLayerIds(next)
      setProject(withIds)
      setJsonText(projectToJson(withIds))
      return f.slice(1)
    })
  }, [flushDebounce])

  const beginDrag = useCallback(() => {
    flushDebounce()
    dragSnapshotRef.current = projectRef.current
  }, [flushDebounce])

  const endDrag = useCallback(() => {
    const snapshot = dragSnapshotRef.current
    dragSnapshotRef.current = null
    if (!snapshot) return
    if (JSON.stringify(snapshot) !== JSON.stringify(projectRef.current)) {
      pushPast(snapshot)
    }
  }, [pushPast])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return

      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if (event.key === 'z' && event.shiftKey) {
        event.preventDefault()
        redo()
      } else if (event.key === 'y') {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [redo, undo])

  return {
    project,
    jsonText,
    setJsonText,
    applyProject,
    replaceProject,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    beginDrag,
    endDrag,
  }
}
