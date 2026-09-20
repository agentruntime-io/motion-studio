import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyframeProperty, Layer, SelectedKeyframeRef, VideoProject } from '../types/project'
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
import {
  countKeyframes,
  flattenKeyframeMarkers,
  getLayerKeyframes,
} from '../lib/keyframes'

interface TimelineProps {
  project: VideoProject
  currentTime: number
  selectedLayerId: string | null
  selectedKeyframe: SelectedKeyframeRef | null
  onSelectLayer: (layerId: string | null) => void
  onSelectKeyframe: (ref: SelectedKeyframeRef | null) => void
  onSeek: (time: number) => void
  onUpdateLayer: (layerId: string, patch: { start?: number; duration?: number }) => void
  onMoveKeyframe: (layerId: string, property: KeyframeProperty, fromTime: number, toTime: number) => void
  onAddLayer: (kind: AddLayerKind) => void
  onLayerDragStart: () => void
  onLayerDragEnd: () => void
}

const TRACK_HEIGHT = 52
const MIN_CLIP_WIDTH = 24
const SCROLL_EDGE_ZONE = 56
const SCROLL_MARGIN = 32
const MAX_SCROLL_STEP = 18

type ClipDragMode = 'move' | 'resize-start' | 'resize-end'

type DragState =
  | {
      kind: 'clip'
      mode: ClipDragMode
      layerId: string
      startX: number
      origStart: number
      origDuration: number
    }
  | {
      kind: 'keyframe'
      layerId: string
      property: KeyframeProperty
      startX: number
      origT: number
      currentT: number
      layerDuration: number
    }

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
  selectedKeyframe,
  onSelectLayer,
  onSelectKeyframe,
  onSeek,
  onUpdateLayer,
  onMoveKeyframe,
  onAddLayer,
  onLayerDragStart,
  onLayerDragEnd,
}: TimelineProps) {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(80)
  const bodyRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const seekDragRef = useRef(false)
  const keyframeDragMovedRef = useRef(false)
  const pixelsPerSecondRef = useRef(pixelsPerSecond)
  pixelsPerSecondRef.current = pixelsPerSecond

  const [keyframeDragPreview, setKeyframeDragPreview] = useState<{
    layerId: string
    property: KeyframeProperty
    origT: number
    previewT: number
  } | null>(null)

  const onMoveKeyframeRef = useRef(onMoveKeyframe)
  onMoveKeyframeRef.current = onMoveKeyframe
  const onLayerDragEndRef = useRef(onLayerDragEnd)
  onLayerDragEndRef.current = onLayerDragEnd
  const onSelectKeyframeRef = useRef(onSelectKeyframe)
  onSelectKeyframeRef.current = onSelectKeyframe

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

  const startClipDrag = (
    e: React.MouseEvent,
    mode: ClipDragMode,
    layer: Layer,
    layerId: string,
  ) => {
    e.stopPropagation()
    onSelectLayer(layerId)
    onLayerDragStart()
    dragRef.current = {
      kind: 'clip',
      mode,
      layerId,
      startX: e.clientX,
      origStart: layer.start,
      origDuration: layer.duration,
    }
  }

  const startKeyframeDrag = (
    e: React.PointerEvent,
    layer: Layer,
    layerId: string,
    property: KeyframeProperty,
    time: number,
  ) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    keyframeDragMovedRef.current = false
    onSelectLayer(layerId)
    onSelectKeyframe({ layerId, property, t: time })
    onLayerDragStart()

    const startX = e.clientX
    const drag: Extract<DragState, { kind: 'keyframe' }> = {
      kind: 'keyframe',
      layerId,
      property,
      startX,
      origT: time,
      currentT: time,
      layerDuration: layer.duration,
    }
    dragRef.current = drag
    setKeyframeDragPreview({ layerId, property, origT: time, previewT: time })

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== e.pointerId) return
      const active = dragRef.current
      if (!active || active.kind !== 'keyframe') return

      const delta = (moveEvent.clientX - startX) / pixelsPerSecondRef.current
      const previewT = clamp(active.origT + delta, 0, active.layerDuration)
      keyframeDragMovedRef.current =
        keyframeDragMovedRef.current || Math.abs(previewT - active.origT) > 0.01
      dragRef.current = { ...active, currentT: previewT }
      setKeyframeDragPreview({
        layerId: active.layerId,
        property: active.property,
        origT: active.origT,
        previewT,
      })
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== e.pointerId) return

      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)

      const active = dragRef.current
      dragRef.current = null
      setKeyframeDragPreview(null)
      onLayerDragEndRef.current()

      if (active?.kind === 'keyframe' && keyframeDragMovedRef.current) {
        const rounded = Math.round(active.currentT * 100) / 100
        onMoveKeyframeRef.current(active.layerId, active.property, active.origT, rounded)
        onSelectKeyframeRef.current({
          layerId: active.layerId,
          property: active.property,
          t: rounded,
        })
      }
      keyframeDragMovedRef.current = false
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  const getMarkerTime = (
    layerId: string,
    marker: { property: KeyframeProperty; t: number },
  ): number => {
    if (
      keyframeDragPreview &&
      keyframeDragPreview.layerId === layerId &&
      keyframeDragPreview.property === marker.property &&
      Math.abs(keyframeDragPreview.origT - marker.t) < 0.05
    ) {
      return keyframeDragPreview.previewT
    }
    return marker.t
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

      if (drag.kind === 'clip') {
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
      } else if (drag.kind === 'keyframe') {
        // Keyframe drags use pointer listeners in startKeyframeDrag.
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
                  const keyframeData = getLayerKeyframes(layer)
                  const markers = layer.type !== 'audio' ? flattenKeyframeMarkers(layer) : []

                  return (
                    <div
                      key={layerId}
                      className="timeline-clip-stack"
                      style={{ left, width }}
                    >
                      <div
                        className={`timeline-clip ${selected ? 'selected' : ''} ${layer.type === 'audio' ? 'timeline-clip-audio' : ''}`}
                        style={{ backgroundColor: color }}
                        onMouseDown={(e) => startClipDrag(e, 'move', layer, layerId)}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectLayer(layerId)
                        }}
                      >
                        <div
                          className="clip-handle clip-handle-start"
                          onMouseDown={(e) => startClipDrag(e, 'resize-start', layer, layerId)}
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
                            {keyframeData?.name && (
                              <span className="clip-badge clip-badge-keyframe" title="Keyframe preset">
                                ◇ {keyframeData.name}
                              </span>
                            )}
                            {!keyframeData?.name && countKeyframes(keyframeData) > 0 && (
                              <span className="clip-badge clip-badge-keyframe" title="Keyframes">
                                ◇ {countKeyframes(keyframeData)} kf
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
                          onMouseDown={(e) => startClipDrag(e, 'resize-end', layer, layerId)}
                        />
                      </div>

                      {markers.length > 0 && (
                        <div className="timeline-keyframe-row">
                          {markers.map((marker) => {
                            const displayT = getMarkerTime(layerId, marker)
                            const markerSelected =
                              selectedKeyframe?.layerId === layerId &&
                              selectedKeyframe.property === marker.property &&
                              (Math.abs(selectedKeyframe.t - marker.t) < 0.05 ||
                                (keyframeDragPreview &&
                                  keyframeDragPreview.layerId === layerId &&
                                  keyframeDragPreview.property === marker.property &&
                                  Math.abs(keyframeDragPreview.origT - marker.t) < 0.05))

                            return (
                              <button
                                key={`${marker.property}-${marker.t}`}
                                type="button"
                                className={`timeline-keyframe-marker timeline-keyframe-${marker.property} ${markerSelected ? 'selected' : ''}`}
                                style={{ left: `${(displayT / layer.duration) * 100}%` }}
                                title={`${marker.property} @ ${displayT.toFixed(2)}s`}
                                onPointerDown={(event) =>
                                  startKeyframeDrag(event, layer, layerId, marker.property, marker.t)
                                }
                                onClick={(event) => {
                                  if (keyframeDragMovedRef.current) {
                                    event.preventDefault()
                                    return
                                  }
                                  event.stopPropagation()
                                  onSelectLayer(layerId)
                                  onSelectKeyframe({
                                    layerId,
                                    property: marker.property,
                                    t: marker.t,
                                  })
                                }}
                              />
                            )
                          })}
                        </div>
                      )}
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
