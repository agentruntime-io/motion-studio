import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Layer, VideoProject } from '../types/project'
import {
  ADD_LAYER_OPTIONS,
  buildTracks,
  clamp,
  formatTimecode,
  getLayerColor,
  getLayerId,
  getLayerLabel,
  type AddLayerKind,
} from '../lib/layerUtils'

interface TimelineProps {
  project: VideoProject
  currentTime: number
  selectedLayerId: string | null
  onSelectLayer: (layerId: string | null) => void
  onSeek: (time: number) => void
  onUpdateLayer: (layerId: string, patch: { start?: number; duration?: number }) => void
  onAddLayer: (kind: AddLayerKind) => void
  onLayerDragStart: () => void
  onLayerDragEnd: () => void
}

const TRACK_HEIGHT = 44
const MIN_CLIP_WIDTH = 24
const SCROLL_EDGE_ZONE = 56
const SCROLL_MARGIN = 32
const MAX_SCROLL_STEP = 18

type DragMode = 'move' | 'resize-start' | 'resize-end'

function ensureTimelineFollowsPlayhead(
  scrollEl: HTMLDivElement,
  playheadPx: number,
  clientX?: number,
) {
  const { scrollLeft, clientWidth, scrollWidth } = scrollEl
  const maxScroll = Math.max(0, scrollWidth - clientWidth)
  const visibleStart = scrollLeft
  const visibleEnd = scrollLeft + clientWidth

  if (playheadPx < visibleStart + SCROLL_MARGIN) {
    scrollEl.scrollLeft = Math.max(0, playheadPx - SCROLL_MARGIN)
    return
  }

  if (playheadPx > visibleEnd - SCROLL_MARGIN) {
    scrollEl.scrollLeft = Math.min(maxScroll, playheadPx - clientWidth + SCROLL_MARGIN)
    return
  }

  if (clientX === undefined) return

  const rect = scrollEl.getBoundingClientRect()
  if (clientX < rect.left + SCROLL_EDGE_ZONE) {
    const intensity = 1 - Math.max(0, clientX - rect.left) / SCROLL_EDGE_ZONE
    scrollEl.scrollLeft = Math.max(0, scrollLeft - MAX_SCROLL_STEP * intensity)
  } else if (clientX > rect.right - SCROLL_EDGE_ZONE) {
    const intensity = 1 - Math.max(0, rect.right - clientX) / SCROLL_EDGE_ZONE
    scrollEl.scrollLeft = Math.min(maxScroll, scrollLeft + MAX_SCROLL_STEP * intensity)
  }
}

export function Timeline({
  project,
  currentTime,
  selectedLayerId,
  onSelectLayer,
  onSeek,
  onUpdateLayer,
  onAddLayer,
  onLayerDragStart,
  onLayerDragEnd,
}: TimelineProps) {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(80)
  const bodyRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: DragMode
    layerId: string
    startX: number
    origStart: number
    origDuration: number
  } | null>(null)
  const seekDragRef = useRef(false)

  const tracks = useMemo(() => buildTracks(project.layers), [project.layers])
  const timelineWidth = Math.max(project.duration * pixelsPerSecond, 400)

  const seekToClientX = useCallback(
    (clientX: number) => {
      const scrollEl = bodyRef.current
      const rect = scrollEl?.getBoundingClientRect()
      if (!rect || !scrollEl) return

      const x = clientX - rect.left + scrollEl.scrollLeft
      const time = clamp(x / pixelsPerSecond, 0, project.duration)
      onSeek(time)
      ensureTimelineFollowsPlayhead(scrollEl, time * pixelsPerSecond, clientX)
    },
    [onSeek, pixelsPerSecond, project.duration],
  )

  const rulerMarks = useMemo(() => {
    const marks: number[] = []
    const step = project.duration > 30 ? 5 : project.duration > 15 ? 2 : 1
    for (let t = 0; t <= project.duration; t += step) marks.push(t)
    return marks
  }, [project.duration])

  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('timeline-track-row')) {
      return
    }
    seekToClientX(e.clientX)
  }

  const startPlayheadDrag = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    seekDragRef.current = true
    seekToClientX(e.clientX)
  }

  const startDrag = (
    e: React.MouseEvent,
    mode: DragMode,
    layer: Layer,
    layerId: string,
  ) => {
    e.stopPropagation()
    onSelectLayer(layerId)
    onLayerDragStart()
    dragRef.current = {
      mode,
      layerId,
      startX: e.clientX,
      origStart: layer.start,
      origDuration: layer.duration,
    }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (seekDragRef.current) {
        seekToClientX(e.clientX)
        return
      }

      const drag = dragRef.current
      if (!drag) return
      const delta = (e.clientX - drag.startX) / pixelsPerSecond

      if (drag.mode === 'move') {
        const start = clamp(drag.origStart + delta, 0, project.duration - drag.origDuration)
        onUpdateLayer(drag.layerId, { start: Math.round(start * 100) / 100 })
      } else if (drag.mode === 'resize-start') {
        const end = drag.origStart + drag.origDuration
        const start = clamp(drag.origStart + delta, 0, end - 0.1)
        onUpdateLayer(drag.layerId, {
          start: Math.round(start * 100) / 100,
          duration: Math.round((end - start) * 100) / 100,
        })
      } else if (drag.mode === 'resize-end') {
        const duration = clamp(drag.origDuration + delta, 0.1, project.duration - drag.origStart)
        onUpdateLayer(drag.layerId, { duration: Math.round(duration * 100) / 100 })
      }
    }

    const onUp = () => {
      if (dragRef.current) {
        onLayerDragEnd()
      }
      dragRef.current = null
      seekDragRef.current = false
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onLayerDragEnd, onUpdateLayer, pixelsPerSecond, project.duration, seekToClientX])

  useEffect(() => {
    if (seekDragRef.current) return
    const scrollEl = bodyRef.current
    if (!scrollEl) return
    ensureTimelineFollowsPlayhead(scrollEl, currentTime * pixelsPerSecond)
  }, [currentTime, pixelsPerSecond])

  useEffect(() => {
    const scrollEl = bodyRef.current
    const labelsEl = labelsRef.current
    if (!scrollEl || !labelsEl) return

    const syncLabels = () => {
      labelsEl.scrollTop = scrollEl.scrollTop
    }

    syncLabels()
    scrollEl.addEventListener('scroll', syncLabels)
    return () => scrollEl.removeEventListener('scroll', syncLabels)
  }, [tracks.length])

  const playheadLeft = currentTime * pixelsPerSecond

  return (
    <div className="timeline">
      <div className="timeline-toolbar">
        <span className="timeline-title">Timeline</span>
        <div className="timeline-add-layers">
          <span className="timeline-add-label">Add</span>
          {ADD_LAYER_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              className={`btn btn-ghost btn-add-layer btn-add-layer-${option.kind}`}
              title={`Add ${option.label}`}
              onClick={() => onAddLayer(option.kind)}
            >
              + {option.short}
            </button>
          ))}
        </div>
        <div className="timeline-zoom">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPixelsPerSecond((p) => Math.max(40, p - 20))}>
            −
          </button>
          <span>{Math.round(pixelsPerSecond)}px/s</span>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPixelsPerSecond((p) => Math.min(160, p + 20))}>
            +
          </button>
        </div>
        <span className="timeline-timecode">{formatTimecode(currentTime)}</span>
      </div>

      <div className="timeline-shell">
        <div className="timeline-labels" ref={labelsRef}>
          <div className="timeline-label-spacer" />
          {tracks.map((track) => (
            <div key={track.id} className="timeline-track-label" style={{ height: TRACK_HEIGHT }}>
              <span className="track-label-text">{track.label}</span>
              <button
                type="button"
                className="btn-track-add"
                title={`Add ${track.label.toLowerCase()} layer`}
                onClick={() => onAddLayer(track.kind)}
              >
                +
              </button>
            </div>
          ))}
        </div>

        <div className="timeline-scroll" ref={bodyRef} onClick={handleBodyClick}>
          <div className="timeline-canvas" style={{ width: timelineWidth }}>
            <div className="timeline-ruler" onMouseDown={startPlayheadDrag}>
              {rulerMarks.map((t) => (
                <div
                  key={t}
                  className="timeline-ruler-mark"
                  style={{ left: t * pixelsPerSecond }}
                >
                  <span>{formatTimecode(t).slice(0, 5)}</span>
                </div>
              ))}
            </div>

            {tracks.map((track) => (
              <div
                key={track.id}
                className="timeline-track-row"
                style={{ height: TRACK_HEIGHT }}
              >
                {track.layers.map((layer) => {
                  const index = project.layers.indexOf(layer)
                  const layerId = getLayerId(layer, index)
                  const left = layer.start * pixelsPerSecond
                  const width = Math.max(layer.duration * pixelsPerSecond, MIN_CLIP_WIDTH)
                  const selected = selectedLayerId === layerId
                  const color = getLayerColor(layer)

                  return (
                    <div
                      key={layerId}
                      className={`timeline-clip ${selected ? 'selected' : ''} ${layer.type === 'audio' ? 'timeline-clip-audio' : ''}`}
                      style={{
                        left,
                        width,
                        backgroundColor: color,
                      }}
                      onMouseDown={(e) => startDrag(e, 'move', layer, layerId)}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectLayer(layerId)
                      }}
                    >
                      <div
                        className="clip-handle clip-handle-start"
                        onMouseDown={(e) => startDrag(e, 'resize-start', layer, layerId)}
                      />
                      <div className="clip-body">
                        <span className="clip-label">{getLayerLabel(layer)}</span>
                        <div className="clip-badges">
                          {layer.transition?.in && (
                            <span className="clip-badge clip-badge-transition" title={`Transition in: ${layer.transition.in}`}>
                              ◆ {layer.transition.in}
                            </span>
                          )}
                          {layer.animation?.in && (
                            <span className="clip-badge clip-badge-animation" title={`Animation in: ${layer.animation.in}`}>
                              ✦ {layer.animation.in}
                            </span>
                          )}
                          {layer.transition?.out && (
                            <span className="clip-badge clip-badge-transition-out" title={`Transition out: ${layer.transition.out}`}>
                              ◆ {layer.transition.out}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className="clip-handle clip-handle-end"
                        onMouseDown={(e) => startDrag(e, 'resize-end', layer, layerId)}
                      />
                    </div>
                  )
                })}
              </div>
            ))}

            <div
              className="timeline-playhead"
              style={{ left: playheadLeft }}
              onMouseDown={startPlayheadDrag}
            >
              <div className="timeline-playhead-head" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
