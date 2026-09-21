import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FlowLayer, FlowRevealTrack, FlowSequenceEntry } from '../types/project'
import { getFlowTimelineDuration, getFlowTimelineLayout, isParallelBlock } from '../engine/flowAnimation'
import { edgeKey, formatEdgeSequenceEntry } from '../lib/flowUtils'
import {
  addFlowTrack,
  addParallelBlock,
  buildTimelineChips,
  formatChipSelection,
  getFlowTracks,
  moveTrackEntry,
  removeFlowTrack,
  removeTrackEntry,
  suggestFlowTracks,
  syncFlowTracks,
  updateTrackForkPoint,
  type FlowTimelineChip,
} from '../lib/flowTimeline'

interface FlowRevealTimelineProps {
  layer: FlowLayer
  onUpdate: (updater: (layer: FlowLayer) => FlowLayer) => void
  previewTime: number
  onPreviewTimeChange: (time: number) => void
  previewPlaying: boolean
  onPreviewPlayingChange: (playing: boolean) => void
  selectedNodeIds: string[]
  selectedEdgeKeys: string[]
  onSelectNodes: (nodeIds: string[]) => void
  onSelectEdges: (edgeKeys: string[]) => void
}

interface DragState {
  trackId: string
  entryIndex: number
}

const LABEL_WIDTH = 92
const PX_PER_SECOND = 100
const MIN_TIMELINE_WIDTH = 480

export function FlowRevealTimeline({
  layer,
  onUpdate,
  previewTime,
  onPreviewTimeChange,
  previewPlaying,
  onPreviewPlayingChange,
  selectedNodeIds,
  selectedEdgeKeys,
  onSelectNodes,
  onSelectEdges,
}: FlowRevealTimelineProps) {
  const tracks = useMemo(() => getFlowTracks(layer), [layer])
  const duration = useMemo(() => getFlowTimelineDuration(layer), [layer])
  const layout = useMemo(() => getFlowTimelineLayout(layer), [layer])
  const chipsByTrack = useMemo(
    () => new Map(tracks.map((track) => [track.id, buildTimelineChips(layer, track)])),
    [layer, tracks],
  )

  const [selectedChip, setSelectedChip] = useState<FlowTimelineChip | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<{ trackId: string; index: number } | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const previewTimeRef = useRef(previewTime)
  const gridRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const dropTargetRef = useRef<{ trackId: string; index: number } | null>(null)
  const tracksRef = useRef(tracks)

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  const contentWidth = Math.max(MIN_TIMELINE_WIDTH, Math.ceil(duration * PX_PER_SECOND) + 40)
  const playheadLeft = LABEL_WIDTH + previewTime * PX_PER_SECOND

  useEffect(() => {
    previewTimeRef.current = previewTime
  }, [previewTime])

  const patchTracks = useCallback(
    (nextTracks: FlowRevealTrack[]) => {
      onUpdate((current) => (current.type === 'flow' ? syncFlowTracks(current, nextTracks) : current))
    },
    [onUpdate],
  )

  useEffect(() => {
    if (!previewPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    lastTickRef.current = performance.now()
    const tick = (now: number) => {
      const dt = (now - lastTickRef.current) / 1000
      lastTickRef.current = now
      const next = previewTimeRef.current + dt
      if (next >= duration) {
        onPreviewPlayingChange(false)
        onPreviewTimeChange(duration)
        return
      }
      onPreviewTimeChange(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [duration, onPreviewPlayingChange, onPreviewTimeChange, previewPlaying])

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const grid = gridRef.current
      if (!grid) return previewTimeRef.current
      const rect = grid.getBoundingClientRect()
      const x = clientX - rect.left - LABEL_WIDTH + grid.scrollLeft
      return Math.max(0, Math.min(duration, x / PX_PER_SECOND))
    },
    [duration],
  )

  const scrubToClientX = useCallback(
    (clientX: number) => {
      onPreviewPlayingChange(false)
      onPreviewTimeChange(timeFromClientX(clientX))
    },
    [onPreviewPlayingChange, onPreviewTimeChange, timeFromClientX],
  )

  useEffect(() => {
    if (!scrubbing) return
    const onMove = (event: PointerEvent) => scrubToClientX(event.clientX)
    const onUp = () => setScrubbing(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [scrubbing, scrubToClientX])

  const autoLayoutTracks = () => {
    patchTracks(suggestFlowTracks(layer))
  }

  const handleChipSelect = (chip: FlowTimelineChip) => {
    setSelectedChip(chip)
    const { nodeIds, edgeKeys } = formatChipSelection(chip)
    onSelectNodes(nodeIds)
    onSelectEdges(edgeKeys)
  }

  const chipForBlock = (trackId: string, entryIndex: number) =>
    chipsByTrack.get(trackId)?.find((chip) => chip.entryIndex === entryIndex) ?? null

  const isChipSelected = (chip: FlowTimelineChip | null) => {
    if (!chip) return false
    if (selectedChip?.key === chip.key) return true
    if (chip.kind === 'node' && chip.nodeId) return selectedNodeIds.includes(chip.nodeId)
    if (chip.kind === 'edge' && chip.edgeFrom && chip.edgeTo) {
      return selectedEdgeKeys.includes(edgeKey(chip.edgeFrom, chip.edgeTo))
    }
    return false
  }

  const handleDeleteSelected = () => {
    if (!selectedChip) return
    const next = removeTrackEntry(tracks, selectedChip.trackId, selectedChip.entryIndex)
    patchTracks(next)
    setSelectedChip(null)
  }

  const handleAddTrack = () => {
    patchTracks(addFlowTrack(tracks, { label: `Lane ${tracks.length + 1}` }))
  }

  const handleAddBranchTrack = () => {
    const anchorTrack = tracks[0]
    if (!anchorTrack) return
    const parallelAfterEntry =
      selectedChip?.trackId === anchorTrack.id ? selectedChip.entryIndex : 0
    patchTracks(
      addFlowTrack(tracks, {
        label: `Branch ${tracks.length}`,
        parallelWith: anchorTrack.id,
        parallelAfterEntry,
      }),
    )
  }

  const forkOptionsForTrack = (track: FlowRevealTrack) => {
    if (!track.parallelWith) return []
    const parent = tracks.find((item) => item.id === track.parallelWith)
    if (!parent) return []
    const chips = buildTimelineChips(layer, parent)
    return chips.map((chip, index) => ({
      value: index,
      label: index === 0 ? 'From start' : `From "${chip.label}"`,
    }))
  }

  const handleAddNodeEntry = (trackId: string, nodeId: string) => {
    patchTracks(
      tracks.map((track) =>
        track.id === trackId ? { ...track, entries: [...track.entries, nodeId] } : track,
      ),
    )
  }

  const handleAddEdgeEntry = (trackId: string, from: string, to: string) => {
    patchTracks(
      tracks.map((track) =>
        track.id === trackId
          ? { ...track, entries: [...track.entries, formatEdgeSequenceEntry(from, to)] }
          : track,
      ),
    )
  }

  const handleAddParallelFromSelection = (trackId: string) => {
    const tokens: string[] = []
    for (const nodeId of selectedNodeIds) tokens.push(nodeId)
    for (const key of selectedEdgeKeys) {
      const split = key.indexOf('->')
      if (split >= 0) tokens.push(formatEdgeSequenceEntry(key.slice(0, split), key.slice(split + 2)))
    }
    if (tokens.length < 2) return
    patchTracks(addParallelBlock(tracks, trackId, tokens))
  }

  const computeDropIndex = useCallback(
    (trackId: string, clientX: number, trackElement: HTMLElement) => {
      const trackBlocks = layout.blocks.filter((block) => block.trackId === trackId)
      const rect = trackElement.getBoundingClientRect()
      const time = (clientX - rect.left) / PX_PER_SECOND
      if (trackBlocks.length === 0) return 0
      for (let index = 0; index < trackBlocks.length; index += 1) {
        const block = trackBlocks[index]
        const midpoint = (block.start + block.end) / 2
        if (time < midpoint) return index
      }
      return trackBlocks.length
    },
    [layout.blocks],
  )

  const clearDragState = useCallback(() => {
    dragStateRef.current = null
    dropTargetRef.current = null
    setDragState(null)
    setDropTarget(null)
  }, [])

  const finishDrag = useCallback(
    (explicitTarget?: { trackId: string; index: number }) => {
      const from = dragStateRef.current
      const to = explicitTarget ?? dropTargetRef.current
      if (from && to) {
        let targetIndex = to.index
        if (from.trackId === to.trackId && from.entryIndex < targetIndex) {
          targetIndex -= 1
        }
        patchTracks(
          moveTrackEntry(
            tracksRef.current,
            from.trackId,
            from.entryIndex,
            to.trackId,
            targetIndex,
          ),
        )
      }
      clearDragState()
    },
    [clearDragState, patchTracks],
  )

  const beginDrag = useCallback((state: DragState, event: React.DragEvent) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `${state.trackId}:${state.entryIndex}`)
    dragStateRef.current = state
    dropTargetRef.current = null
    setDragState(state)
    setDropTarget(null)
  }, [])

  const updateDropTarget = useCallback((target: { trackId: string; index: number }) => {
    dropTargetRef.current = target
    setDropTarget(target)
  }, [])

  const rulerTicks = useMemo(() => {
    const step = duration <= 4 ? 0.5 : duration <= 10 ? 1 : 2
    const ticks: number[] = []
    for (let t = 0; t <= duration + 0.001; t += step) ticks.push(Number(t.toFixed(2)))
    return ticks
  }, [duration])

  const unplacedNodes = layer.nodes.filter((node) =>
    tracks.every((track) => !track.entries.some((entry) => entryContainsNode(entry, node.id))),
  )

  const unplacedEdges = layer.edges.filter((edge) => {
    const token = formatEdgeSequenceEntry(edge.from, edge.to)
    return tracks.every((track) => !track.entries.some((entry) => entryContainsToken(entry, token)))
  })

  return (
    <div className="flow-reveal-timeline">
      <div className="flow-reveal-toolbar">
        <span className="flow-reveal-title">Reveal timeline</span>
        <div className="flow-reveal-toolbar-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (previewPlaying) {
                onPreviewPlayingChange(false)
              } else {
                if (previewTime >= duration) onPreviewTimeChange(0)
                onPreviewPlayingChange(true)
              }
            }}
          >
            {previewPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onPreviewTimeChange(0)
              onPreviewPlayingChange(false)
            }}
          >
            Reset
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={autoLayoutTracks}>
            Auto layout
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Independent lane — steps begin at 0s, not tied to Main"
            onClick={handleAddTrack}
          >
            Add lane
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Fork lane — starts after a step on Main (select a Main step first to set the fork point)"
            onClick={handleAddBranchTrack}
          >
            Add branch lane
          </button>
          {selectedChip && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleDeleteSelected}>
              Remove step
            </button>
          )}
        </div>
        <span className="flow-reveal-time">
          {previewTime.toFixed(2)}s / {duration.toFixed(2)}s
        </span>
      </div>

      <p className="flow-reveal-lane-help">
        <strong>Lane</strong> starts at 0s on its own. <strong>Branch lane</strong> forks from Main —
        pick when it starts with the lane dropdown (not by dragging left).
      </p>

      <div className="flow-reveal-time-shell">
        <div className="flow-reveal-time-hscroll" ref={gridRef}>
          <div className="flow-reveal-time-grid" style={{ width: LABEL_WIDTH + contentWidth }}>
            <div className="flow-reveal-time-header">
              <div className="flow-reveal-time-corner" style={{ width: LABEL_WIDTH }} />
              <div className="flow-reveal-time-ruler" style={{ width: contentWidth }}>
                {rulerTicks.map((tick) => (
                  <span
                    key={tick}
                    className="flow-reveal-ruler-tick"
                    style={{ left: tick * PX_PER_SECOND }}
                  >
                    <span className="flow-reveal-ruler-line" />
                    <span className="flow-reveal-ruler-label">{tick}s</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flow-reveal-time-body">
              {tracks.map((track) => {
                const trackBlocks = layout.blocks.filter((block) => block.trackId === track.id)
                const forkOptions = forkOptionsForTrack(track)
                return (
                  <div key={track.id} className="flow-reveal-time-row">
                    <div className="flow-reveal-time-label" style={{ width: LABEL_WIDTH }}>
                      <span>{track.label ?? track.id}</span>
                      {track.parallelWith ? (
                        <>
                          <span className="flow-reveal-lane-meta">Branch of {track.parallelWith}</span>
                          {forkOptions.length > 0 && (
                            <select
                              className="inspector-select flow-reveal-fork-select"
                              value={track.parallelAfterEntry ?? 0}
                              title="When this branch lane starts relative to the parent lane"
                              onChange={(event) =>
                                patchTracks(
                                  updateTrackForkPoint(
                                    tracks,
                                    track.id,
                                    Number(event.target.value),
                                  ),
                                )
                              }
                            >
                              {forkOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </>
                      ) : track.id !== 'main' ? (
                        <span className="flow-reveal-lane-meta">Independent · 0s</span>
                      ) : null}
                      {track.id !== 'main' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm flow-reveal-lane-delete"
                          onClick={() => patchTracks(removeFlowTrack(tracks, track.id))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                <div
                  className={`flow-reveal-time-track ${dropTarget?.trackId === track.id ? 'drop-target' : ''}`}
                  style={{ width: contentWidth }}
                  onPointerDown={(event) => {
                    if (event.target !== event.currentTarget) return
                    setScrubbing(true)
                    scrubToClientX(event.clientX)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    updateDropTarget({
                      trackId: track.id,
                      index: computeDropIndex(track.id, event.clientX, event.currentTarget),
                    })
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    finishDrag({
                      trackId: track.id,
                      index: computeDropIndex(track.id, event.clientX, event.currentTarget),
                    })
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return
                    if (dropTargetRef.current?.trackId === track.id) {
                      dropTargetRef.current = null
                      setDropTarget(null)
                    }
                  }}
                >
                  {trackBlocks.length === 0 && (
                    <span className="flow-reveal-lane-empty">
                      {dragState ? 'Drop step here' : 'Add steps to this lane'}
                    </span>
                  )}
                  {trackBlocks.map((block, index) => {
                    const chip = chipForBlock(track.id, block.entryIndex)
                    if (!chip) return null
                    const width = Math.max(28, (block.end - block.start) * PX_PER_SECOND - 4)
                    const isActive =
                      previewTime >= block.start && previewTime < block.activeEnd + 0.001
                    const isPast = previewTime >= block.end
                    const isDragging =
                      dragState?.trackId === track.id && dragState.entryIndex === block.entryIndex
                    return (
                      <div
                        key={`${track.id}-${block.entryIndex}`}
                        className={`flow-reveal-block-wrap ${isDragging ? 'dragging' : ''}`}
                        style={{
                          left: block.start * PX_PER_SECOND + 2,
                          width,
                        }}
                        draggable
                        onDragStart={(event) =>
                          beginDrag({ trackId: track.id, entryIndex: block.entryIndex }, event)
                        }
                        onDragEnd={() => clearDragState()}
                      >
                        {dropTarget?.trackId === track.id && dropTarget.index === index && (
                          <span className="flow-reveal-drop-marker flow-reveal-drop-marker-block" />
                        )}
                        <div
                          role="button"
                          tabIndex={0}
                          className={`flow-reveal-block flow-reveal-block-${chip.kind} ${isChipSelected(chip) ? 'selected' : ''} ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                          onClick={() => handleChipSelect(chip)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleChipSelect(chip)
                            }
                          }}
                          title={chip.label}
                        >
                          {chip.kind === 'edge' && <span className="flow-reveal-chip-icon">↪</span>}
                          {chip.kind === 'parallel' && (
                            <span className="flow-reveal-chip-icon">∥</span>
                          )}
                          <span className="flow-reveal-block-label">{chip.label}</span>
                        </div>
                      </div>
                    )
                  })}
                  {dropTarget?.trackId === track.id && trackBlocks.length === 0 && (
                    <span
                      className="flow-reveal-drop-marker flow-reveal-drop-marker-block"
                      style={{ left: 2 }}
                    />
                  )}
                  {dropTarget?.trackId === track.id &&
                    dropTarget.index === trackBlocks.length && (
                      <span
                        className="flow-reveal-drop-marker flow-reveal-drop-marker-block"
                        style={{ left: (trackBlocks.at(-1)?.end ?? 0) * PX_PER_SECOND + 2 }}
                      />
                    )}
                    </div>
                  </div>
                )
              })}

              <div className="flow-reveal-playhead" style={{ left: playheadLeft }}>
                <button
                  type="button"
                  className="flow-reveal-playhead-handle"
                  aria-label="Scrub reveal timeline"
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    setScrubbing(true)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <details className="flow-reveal-organize">
      <summary>Add items to lanes</summary>
      <div className="flow-reveal-lane-add-row">
        {tracks.map((track) => (
          <div key={`${track.id}-add`} className="flow-reveal-lane-add">
            <span className="flow-reveal-lane-add-name">{track.label ?? track.id}:</span>
            <select
              className="inspector-select flow-reveal-add-select"
              aria-label={`Add node to ${track.label ?? track.id}`}
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value
                if (!value) return
                handleAddNodeEntry(track.id, value)
                event.target.value = ''
              }}
            >
              <option value="">+ Node…</option>
              {layer.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
            <select
              className="inspector-select flow-reveal-add-select"
              aria-label={`Add edge to ${track.label ?? track.id}`}
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value
                if (!value) return
                const split = value.indexOf('->')
                if (split >= 0) {
                  handleAddEdgeEntry(track.id, value.slice(0, split), value.slice(split + 2))
                }
                event.target.value = ''
              }}
            >
              <option value="">+ Edge…</option>
              {layer.edges.map((edge) => (
                <option key={edgeKey(edge.from, edge.to)} value={edgeKey(edge.from, edge.to)}>
                  {edge.from} → {edge.to}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={selectedNodeIds.length + selectedEdgeKeys.length < 2}
              onClick={() => handleAddParallelFromSelection(track.id)}
            >
              + Parallel
            </button>
          </div>
        ))}
      </div>

      {(unplacedNodes.length > 0 || unplacedEdges.length > 0) && (
        <div className="flow-reveal-unplaced">
          <span>Not in timeline:</span>
          {unplacedNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleAddNodeEntry('main', node.id)}
            >
              + {node.label}
            </button>
          ))}
          {unplacedEdges.map((edge) => (
            <button
              key={edgeKey(edge.from, edge.to)}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleAddEdgeEntry('main', edge.from, edge.to)}
            >
              + {edge.from}→{edge.to}
            </button>
          ))}
        </div>
      )}
      </details>
    </div>
  )
}

function entryContainsNode(entry: FlowSequenceEntry, nodeId: string): boolean {
  if (isParallelBlock(entry)) {
    return entry.parallel.some((token: string) => token === nodeId || token.includes(nodeId))
  }
  return entry === nodeId || entry.includes(nodeId)
}

function entryContainsToken(entry: FlowSequenceEntry, token: string): boolean {
  if (isParallelBlock(entry)) return entry.parallel.includes(token)
  return entry === token
}
