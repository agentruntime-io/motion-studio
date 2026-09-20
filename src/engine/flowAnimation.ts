import type { EasingType, FlowEdge, FlowLayer } from '../types/project'
import { applyEasing } from './easing'
import { edgeKey, parseSequenceEntry } from '../lib/flowUtils'

export interface FlowRevealEvent {
  kind: 'node' | 'edge'
  id: string
  from?: string
  to?: string
  start: number
  duration: number
}

const DEFAULT_STEP_DELAY = 0.35
const DEFAULT_LINE_DURATION = 0.35
const DEFAULT_NODE_DURATION = 0.3

export function getFlowSequence(layer: FlowLayer): string[] {
  if (layer.flowAnimation?.sequence?.length) {
    return layer.flowAnimation.sequence
  }
  return layer.nodes.map((node) => node.id)
}

export function findFlowEdge(layer: FlowLayer, from: string, to: string): FlowEdge | undefined {
  return layer.edges.find((edge) => edge.from === from && edge.to === to)
}

function scheduleEdge(
  events: FlowRevealEvent[],
  animatedEdges: Set<string>,
  from: string,
  to: string,
  time: number,
  lineDuration: number,
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
  })
  animatedEdges.add(key)
  return time + lineDuration
}

export function buildFlowRevealTimeline(layer: FlowLayer): FlowRevealEvent[] {
  const anim = layer.flowAnimation
  const mode = anim?.mode ?? 'sequential'

  if (mode === 'instant') {
    return layer.nodes.map((node) => ({
      kind: 'node',
      id: node.id,
      start: 0,
      duration: 0,
    }))
  }

  const stepDelay = anim?.stepDelay ?? DEFAULT_STEP_DELAY
  const lineDuration = anim?.lineDuration ?? DEFAULT_LINE_DURATION
  const nodeDuration = anim?.nodeDuration ?? DEFAULT_NODE_DURATION
  const sequence = getFlowSequence(layer)
  const events: FlowRevealEvent[] = []

  if (mode === 'parallel') {
    const animatedEdges = new Set<string>()
    sequence.forEach((entry, index) => {
      const parsed = parseSequenceEntry(entry)
      if (parsed.kind === 'edge') {
        scheduleEdge(events, animatedEdges, parsed.from, parsed.to, index * stepDelay, lineDuration)
        return
      }
      const start = index * stepDelay
      events.push({ kind: 'node', id: parsed.id, start, duration: nodeDuration })
      layer.edges
        .filter((edge) => edge.to === parsed.id)
        .forEach((edge) => {
          scheduleEdge(events, animatedEdges, edge.from, edge.to, start, lineDuration)
        })
    })
    return events
  }

  const animatedEdges = new Set<string>()
  const revealedNodes = new Set<string>()
  let time = 0

  for (const entry of sequence) {
    const parsed = parseSequenceEntry(entry)

    if (parsed.kind === 'edge') {
      time = scheduleEdge(events, animatedEdges, parsed.from, parsed.to, time, lineDuration)
      continue
    }

    const nodeId = parsed.id
    for (const edge of layer.edges.filter(
      (item) => item.to === nodeId && revealedNodes.has(item.from),
    )) {
      time = scheduleEdge(events, animatedEdges, edge.from, edge.to, time, lineDuration)
    }

    events.push({ kind: 'node', id: nodeId, start: time, duration: nodeDuration })
    revealedNodes.add(nodeId)
    time += nodeDuration + stepDelay
  }

  return events
}

export function getFlowRevealProgress(
  localTime: number,
  start: number,
  duration: number,
  easing: EasingType = 'easeOut',
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
  edge: FlowEdge,
  localTime: number,
): number {
  const easing = layer.flowAnimation?.easing ?? 'easeOut'
  const event = buildFlowRevealTimeline(layer).find(
    (item) => item.kind === 'edge' && item.from === edge.from && item.to === edge.to,
  )
  if (!event) return 0
  return getFlowRevealProgress(localTime, event.start, event.duration, easing)
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
  edge: FlowEdge,
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
  edge?: FlowEdge,
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
