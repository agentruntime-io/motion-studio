import type {
  FlowAnimationConfig,
  FlowLayer,
  FlowParallelBlock,
  FlowRevealTrack,
  FlowSequenceEntry,
  FlowSequenceToken,
} from '../types/project'
import { applyEasing } from './easing'
import { edgeKey, parseSequenceEntry, suggestFlowSequence } from '../lib/flowUtils'

export interface FlowRevealEvent {
  kind: 'node' | 'edge'
  id: string
  from?: string
  to?: string
  start: number
  duration: number
  trackId?: string
}

const DEFAULT_STEP_DELAY = 0.35
const DEFAULT_LINE_DURATION = 0.35
const DEFAULT_NODE_DURATION = 0.3

export function isParallelBlock(entry: FlowSequenceEntry): entry is FlowParallelBlock {
  return typeof entry === 'object' && entry !== null && 'parallel' in entry
}

function getTiming(config?: FlowAnimationConfig) {
  return {
    stepDelay: config?.stepDelay ?? DEFAULT_STEP_DELAY,
    lineDuration: config?.lineDuration ?? DEFAULT_LINE_DURATION,
    nodeDuration: config?.nodeDuration ?? DEFAULT_NODE_DURATION,
  }
}

export function getFlowTracks(layer: FlowLayer): FlowRevealTrack[] {
  const anim = layer.flowAnimation
  if (anim?.tracks?.length) return anim.tracks

  const entries = anim?.sequence?.length ? anim.sequence : suggestFlowSequence(layer)
  return [{ id: 'main', label: 'Main', entries }]
}

function scheduleEdge(
  events: FlowRevealEvent[],
  animatedEdges: Set<string>,
  from: string,
  to: string,
  time: number,
  lineDuration: number,
  trackId?: string,
): number {
  const key = edgeKey(from, to)
  if (animatedEdges.has(key)) return time
  events.push({
    kind: 'edge',
    id: key,
    from,
    to,
    start: time,
    duration: lineDuration,
    trackId,
  })
  animatedEdges.add(key)
  return time + lineDuration
}

function compileTokenEvents(
  token: FlowSequenceToken,
  layer: FlowLayer,
  time: number,
  timing: ReturnType<typeof getTiming>,
  animatedEdges: Set<string>,
  revealedNodes: Set<string>,
  trackId: string,
): { events: FlowRevealEvent[]; end: number } {
  const events: FlowRevealEvent[] = []
  const parsed = parseSequenceEntry(token)

  if (parsed.kind === 'edge') {
    const end = scheduleEdge(events, animatedEdges, parsed.from, parsed.to, time, timing.lineDuration, trackId)
    return { events, end }
  }

  let cursor = time
  for (const edge of layer.edges) {
    if (edge.to === parsed.id && revealedNodes.has(edge.from)) {
      cursor = scheduleEdge(events, animatedEdges, edge.from, edge.to, cursor, timing.lineDuration, trackId)
    }
  }

  events.push({
    kind: 'node',
    id: parsed.id,
    start: cursor,
    duration: timing.nodeDuration,
    trackId,
  })
  revealedNodes.add(parsed.id)
  return { events, end: cursor + timing.nodeDuration }
}

export interface FlowTimelineBlockLayout {
  trackId: string
  entryIndex: number
  start: number
  end: number
  activeEnd: number
}

export interface FlowTimelineLayout {
  duration: number
  blocks: FlowTimelineBlockLayout[]
}

function compileTrackBlockLayouts(
  track: FlowRevealTrack,
  layer: FlowLayer,
  trackStart: number,
  waitBeforeEntry: (entryIndex: number) => number,
  timing: ReturnType<typeof getTiming>,
): FlowTimelineBlockLayout[] {
  const blocks: FlowTimelineBlockLayout[] = []
  const animatedEdges = new Set<string>()
  const revealedNodes = new Set<string>()
  let time = trackStart

  for (let entryIndex = 0; entryIndex < track.entries.length; entryIndex++) {
    const waitUntil = waitBeforeEntry(entryIndex)
    if (waitUntil > time) time = waitUntil

    const entryStart = time
    const entry = track.entries[entryIndex]

    if (isParallelBlock(entry)) {
      let maxEnd = time
      for (const token of entry.parallel) {
        const compiled = compileTokenEvents(
          token,
          layer,
          time,
          timing,
          animatedEdges,
          revealedNodes,
          track.id,
        )
        maxEnd = Math.max(maxEnd, compiled.end)
      }
      time = maxEnd + timing.stepDelay
      blocks.push({
        trackId: track.id,
        entryIndex,
        start: entryStart,
        end: time,
        activeEnd: maxEnd,
      })
      continue
    }

    const parsed = parseSequenceEntry(entry)
    if (parsed.kind === 'edge') {
      time = scheduleEdge(
        [],
        animatedEdges,
        parsed.from,
        parsed.to,
        time,
        timing.lineDuration,
        track.id,
      )
      const activeEnd = time
      time += timing.stepDelay
      blocks.push({ trackId: track.id, entryIndex, start: entryStart, end: time, activeEnd })
      continue
    }

    const compiled = compileTokenEvents(
      entry,
      layer,
      time,
      timing,
      animatedEdges,
      revealedNodes,
      track.id,
    )
    time = compiled.end + timing.stepDelay
    blocks.push({
      trackId: track.id,
      entryIndex,
      start: entryStart,
      end: time,
      activeEnd: compiled.end,
    })
  }

  return blocks
}

export function getFlowTimelineLayout(layer: FlowLayer): FlowTimelineLayout {
  const anim = layer.flowAnimation
  const timing = getTiming(anim)
  const tracks = getFlowTracks(layer)
  const memo = new Map<string, number>()
  const blocks: FlowTimelineBlockLayout[] = []

  for (const track of tracks) {
    const trackStart = getTrackAnchorTime(tracks, track, layer, timing, memo)
    const waitBeforeEntry = buildWaitResolver(track, tracks, layer, timing, memo)
    blocks.push(...compileTrackBlockLayouts(track, layer, trackStart, waitBeforeEntry, timing))
  }

  const duration = blocks.length > 0 ? Math.max(...blocks.map((block) => block.end)) : 0
  return { duration, blocks }
}

function compileTrackEvents(
  track: FlowRevealTrack,
  layer: FlowLayer,
  trackStart: number,
  waitBeforeEntry: (entryIndex: number) => number,
  timing: ReturnType<typeof getTiming>,
  animatedEdges: Set<string>,
): FlowRevealEvent[] {
  const events: FlowRevealEvent[] = []
  const revealedNodes = new Set<string>()
  let time = trackStart

  for (let entryIndex = 0; entryIndex < track.entries.length; entryIndex++) {
    const waitUntil = waitBeforeEntry(entryIndex)
    if (waitUntil > time) time = waitUntil

    const entry = track.entries[entryIndex]

    if (isParallelBlock(entry)) {
      let maxEnd = time
      for (const token of entry.parallel) {
        const compiled = compileTokenEvents(
          token,
          layer,
          time,
          timing,
          animatedEdges,
          revealedNodes,
          track.id,
        )
        events.push(...compiled.events)
        maxEnd = Math.max(maxEnd, compiled.end)
      }
      time = maxEnd + timing.stepDelay
      continue
    }

    const parsed = parseSequenceEntry(entry)
    if (parsed.kind === 'edge') {
      time = scheduleEdge(events, animatedEdges, parsed.from, parsed.to, time, timing.lineDuration, track.id)
      time += timing.stepDelay
      continue
    }

    const compiled = compileTokenEvents(
      entry,
      layer,
      time,
      timing,
      animatedEdges,
      revealedNodes,
      track.id,
    )
    events.push(...compiled.events)
    time = compiled.end + timing.stepDelay
  }

  return events
}

function computeTrackLocalEndTimes(
  track: FlowRevealTrack,
  layer: FlowLayer,
  timing: ReturnType<typeof getTiming>,
): number[] {
  const animatedEdges = new Set<string>()
  const endTimes: number[] = []
  let time = 0
  const revealedNodes = new Set<string>()

  for (const entry of track.entries) {
    if (isParallelBlock(entry)) {
      let maxEnd = time
      for (const token of entry.parallel) {
        const compiled = compileTokenEvents(token, layer, time, timing, animatedEdges, revealedNodes, track.id)
        maxEnd = Math.max(maxEnd, compiled.end)
      }
      time = maxEnd + timing.stepDelay
      endTimes.push(time)
      continue
    }

    const parsed = parseSequenceEntry(entry)
    if (parsed.kind === 'edge') {
      time += timing.lineDuration + timing.stepDelay
      endTimes.push(time)
      continue
    }

    const compiled = compileTokenEvents(entry, layer, time, timing, animatedEdges, revealedNodes, track.id)
    time = compiled.end + timing.stepDelay
    endTimes.push(time)
  }

  return endTimes
}

function getTrackAnchorTime(
  tracks: FlowRevealTrack[],
  track: FlowRevealTrack,
  layer: FlowLayer,
  timing: ReturnType<typeof getTiming>,
  memo: Map<string, number>,
): number {
  if (memo.has(track.id)) return memo.get(track.id)!

  if (!track.parallelWith) {
    memo.set(track.id, 0)
    return 0
  }

  const parent = tracks.find((item) => item.id === track.parallelWith)
  if (!parent) {
    memo.set(track.id, 0)
    return 0
  }

  const parentStart = getTrackAnchorTime(tracks, parent, layer, timing, memo)
  const parentEnds = computeTrackLocalEndTimes(parent, layer, timing)
  const anchorIndex = track.parallelAfterEntry ?? 0
  const anchorEnd = anchorIndex > 0 ? parentEnds[anchorIndex - 1] ?? 0 : 0
  const start = parentStart + anchorEnd
  memo.set(track.id, start)
  return start
}

function getTrackEndTime(
  tracks: FlowRevealTrack[],
  trackId: string,
  layer: FlowLayer,
  timing: ReturnType<typeof getTiming>,
  memo: Map<string, number>,
): number {
  const track = tracks.find((item) => item.id === trackId)
  if (!track) return 0
  const start = getTrackAnchorTime(tracks, track, layer, timing, memo)
  const localEnds = computeTrackLocalEndTimes(track, layer, timing)
  return start + (localEnds.length > 0 ? localEnds[localEnds.length - 1] : 0)
}

function buildWaitResolver(
  track: FlowRevealTrack,
  tracks: FlowRevealTrack[],
  layer: FlowLayer,
  timing: ReturnType<typeof getTiming>,
  memo: Map<string, number>,
): (entryIndex: number) => number {
  const waits = track.waitForTracks ?? []
  return (entryIndex: number) => {
    const waitRule = waits.find((item) => item.afterEntry + 1 === entryIndex)
    if (!waitRule) return 0
    return Math.max(
      0,
      ...waitRule.tracks.map((trackId) => getTrackEndTime(tracks, trackId, layer, timing, memo)),
    )
  }
}

function compileLegacySequence(layer: FlowLayer, timing: ReturnType<typeof getTiming>): FlowRevealEvent[] {
  const anim = layer.flowAnimation
  const mode = anim?.mode ?? 'sequential'
  const sequence = anim?.sequence?.length
    ? anim.sequence
    : layer.nodes.map((node) => node.id)

  if (mode === 'instant') {
    return layer.nodes.map((node) => ({
      kind: 'node',
      id: node.id,
      start: 0,
      duration: 0,
    }))
  }

  const events: FlowRevealEvent[] = []
  const animatedEdges = new Set<string>()
  const revealedNodes = new Set<string>()

  if (mode === 'parallel') {
    sequence.forEach((entry, index) => {
      const parsed = parseSequenceEntry(entry)
      const start = index * timing.stepDelay
      if (parsed.kind === 'edge') {
        scheduleEdge(events, animatedEdges, parsed.from, parsed.to, start, timing.lineDuration)
        return
      }
      events.push({ kind: 'node', id: parsed.id, start, duration: timing.nodeDuration })
      for (const edge of layer.edges.filter((item) => item.to === parsed.id)) {
        scheduleEdge(events, animatedEdges, edge.from, edge.to, start, timing.lineDuration)
      }
    })
    return events
  }

  let time = 0
  for (const entry of sequence) {
    const parsed = parseSequenceEntry(entry)
    if (parsed.kind === 'edge') {
      time = scheduleEdge(events, animatedEdges, parsed.from, parsed.to, time, timing.lineDuration)
      time += timing.stepDelay
      continue
    }

    for (const edge of layer.edges.filter(
      (item) => item.to === parsed.id && revealedNodes.has(item.from),
    )) {
      time = scheduleEdge(events, animatedEdges, edge.from, edge.to, time, timing.lineDuration)
    }

    events.push({ kind: 'node', id: parsed.id, start: time, duration: timing.nodeDuration })
    revealedNodes.add(parsed.id)
    time += timing.nodeDuration + timing.stepDelay
  }

  return events
}

export function buildFlowRevealTimeline(layer: FlowLayer): FlowRevealEvent[] {
  const anim = layer.flowAnimation
  const timing = getTiming(anim)

  if (anim?.mode === 'instant') {
    return layer.nodes.map((node) => ({
      kind: 'node',
      id: node.id,
      start: 0,
      duration: 0,
    }))
  }

  const tracks = getFlowTracks(layer)
  const useLegacyParallel = anim?.mode === 'parallel' && !anim?.tracks?.length

  if (useLegacyParallel) {
    return compileLegacySequence(layer, timing)
  }

  const memo = new Map<string, number>()
  const animatedEdges = new Set<string>()
  const allEvents: FlowRevealEvent[] = []

  for (const track of tracks) {
    const trackStart = getTrackAnchorTime(tracks, track, layer, timing, memo)
    const waitBeforeEntry = buildWaitResolver(track, tracks, layer, timing, memo)
    allEvents.push(
      ...compileTrackEvents(track, layer, trackStart, waitBeforeEntry, timing, animatedEdges),
    )
  }

  return allEvents.sort((a, b) => a.start - b.start || (a.kind === 'edge' ? -1 : 1))
}

export function getFlowTimelineDuration(layer: FlowLayer): number {
  const events = buildFlowRevealTimeline(layer)
  if (events.length === 0) return 0
  return Math.max(...events.map((event) => event.start + event.duration))
}

export function getFlowRevealProgress(
  localTime: number,
  start: number,
  duration: number,
  easing: import('../types/project').EasingType = 'easeOut',
): number {
  if (duration <= 0) return localTime >= start ? 1 : 0
  if (localTime <= start) return 0
  if (localTime >= start + duration) return 1
  return applyEasing((localTime - start) / duration, easing)
}

export function getNodeRevealProgress(
  layer: FlowLayer,
  nodeId: string,
  localTime: number,
): number {
  const easing = layer.flowAnimation?.easing ?? 'easeOut'
  const event = buildFlowRevealTimeline(layer).find(
    (item) => item.kind === 'node' && item.id === nodeId,
  )
  if (!event) return layer.flowAnimation?.mode === 'instant' ? 1 : 0
  return getFlowRevealProgress(localTime, event.start, event.duration, easing)
}

export function getEdgeRevealProgress(
  layer: FlowLayer,
  edge: import('../types/project').FlowEdge,
  localTime: number,
): number {
  const easing = layer.flowAnimation?.easing ?? 'easeOut'
  const event = buildFlowRevealTimeline(layer).find(
    (item) => item.kind === 'edge' && item.from === edge.from && item.to === edge.to,
  )
  if (!event) return 0
  return getFlowRevealProgress(localTime, event.start, event.duration, easing)
}

export function getFlowRevealState(
  layer: FlowLayer,
  localTime: number,
): {
  activeNodeIds: Set<string>
  activeEdgeKeys: Set<string>
  revealedNodeIds: Set<string>
  revealedEdgeKeys: Set<string>
  futureNodeIds: Set<string>
  futureEdgeKeys: Set<string>
} {
  const events = buildFlowRevealTimeline(layer)
  const activeNodeIds = new Set<string>()
  const activeEdgeKeys = new Set<string>()
  const revealedNodeIds = new Set<string>()
  const revealedEdgeKeys = new Set<string>()
  const futureNodeIds = new Set<string>()
  const futureEdgeKeys = new Set<string>()

  for (const event of events) {
    const end = event.start + event.duration
    const isActive = localTime >= event.start && localTime < end + 0.001
    const isRevealed = localTime >= end

    if (event.kind === 'node') {
      if (isActive) activeNodeIds.add(event.id)
      else if (isRevealed) revealedNodeIds.add(event.id)
      else futureNodeIds.add(event.id)
    } else if (event.from && event.to) {
      const key = edgeKey(event.from, event.to)
      if (isActive) activeEdgeKeys.add(key)
      else if (isRevealed) revealedEdgeKeys.add(key)
      else futureEdgeKeys.add(key)
    }
  }

  return {
    activeNodeIds,
    activeEdgeKeys,
    revealedNodeIds,
    revealedEdgeKeys,
    futureNodeIds,
    futureEdgeKeys,
  }
}

export function getFlowNode(layer: FlowLayer, id: string) {
  return layer.nodes.find((node) => node.id === id)
}

export function getFlowNodeStyle(node: FlowLayer['nodes'][number], layer: FlowLayer) {
  return node.style ?? layer.defaultNodeStyle ?? 'step'
}

export function getFlowNodeSize(
  node: FlowLayer['nodes'][number],
  style: NonNullable<FlowLayer['nodes'][number]['style']>,
): { width: number; height: number } {
  if (node.width && node.height) return { width: node.width, height: node.height }
  switch (style) {
    case 'card':
      return { width: node.width ?? 200, height: node.height ?? 96 }
    case 'n8n':
      return { width: node.width ?? 220, height: node.height ?? 72 }
    default:
      return { width: node.width ?? 56, height: node.height ?? 56 }
  }
}

export interface FlowAnchor {
  x: number
  y: number
}

export function getFlowNodeAnchor(
  node: FlowLayer['nodes'][number],
  layer: FlowLayer,
  side: 'in' | 'out',
): FlowAnchor {
  const style = getFlowNodeStyle(node, layer) ?? 'step'
  const { width, height } = getFlowNodeSize(node, style)

  switch (style) {
    case 'n8n':
      return {
        x: side === 'in' ? node.x : node.x + width,
        y: node.y + height / 2,
      }
    case 'card':
      return {
        x: node.x + width / 2,
        y: node.y + (side === 'out' ? height / 2 : height * 0.35),
      }
    default:
      return { x: node.x + width / 2, y: node.y + height / 2 }
  }
}

function computeBranchWaypoints(
  layer: FlowLayer,
  edge: import('../types/project').FlowEdge,
  start: FlowAnchor,
  end: FlowAnchor,
): { x: number; y: number }[] {
  const siblings = layer.edges.filter((item) => item.from === edge.from)
  const index = siblings.findIndex((item) => item.to === edge.to)
  const count = siblings.length

  if (count <= 1) {
    const midX = start.x + (end.x - start.x) * 0.5
    return [
      { x: midX, y: start.y },
      { x: midX, y: end.y },
    ]
  }

  const spread = Math.max(28, Math.abs(end.y - start.y) * 0.35)
  const offsetY = (index - (count - 1) / 2) * spread
  const midX = start.x + Math.max(48, (end.x - start.x) * 0.42)

  return [
    { x: midX, y: start.y + offsetY },
    { x: midX, y: end.y },
  ]
}

export function buildEdgePath(
  from: FlowLayer['nodes'][number],
  to: FlowLayer['nodes'][number],
  layer: FlowLayer,
  edge?: import('../types/project').FlowEdge,
): { x: number; y: number }[] {
  const start = getFlowNodeAnchor(from, layer, 'out')
  const end = getFlowNodeAnchor(to, layer, 'in')

  if (edge?.points?.length) {
    return [start, ...edge.points, end]
  }

  const fromStyle = getFlowNodeStyle(from, layer) ?? 'step'
  const toStyle = getFlowNodeStyle(to, layer) ?? 'step'

  if (fromStyle === 'n8n' || toStyle === 'n8n') {
    const edgeDef = edge ?? { from: from.id, to: to.id }
    const waypoints = computeBranchWaypoints(layer, edgeDef, start, end)
    return [start, ...waypoints, end]
  }

  return [start, end]
}

export { polylineLength } from '../lib/flowUtils'
