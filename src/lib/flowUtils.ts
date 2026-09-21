import type { FlowLayer, FlowNode } from '../types/project'

export interface PathPoint {
  x: number
  y: number
}

export function edgeKey(from: string, to: string): string {
  return `${from}->${to}`
}

export function parseSequenceEntry(
  entry: string,
): { kind: 'node'; id: string } | { kind: 'edge'; from: string; to: string } {
  if (entry.startsWith('edge:')) {
    const rest = entry.slice(5)
    const split = rest.indexOf('->')
    if (split >= 0) {
      return { kind: 'edge', from: rest.slice(0, split), to: rest.slice(split + 2) }
    }
  }
  return { kind: 'node', id: entry }
}

export function formatEdgeSequenceEntry(from: string, to: string): string {
  return `edge:${from}->${to}`
}

export function hasFlowNodeNumber(node: FlowNode): boolean {
  if (node.number === undefined || node.number === null) return false
  return String(node.number).trim().length > 0
}

export function suggestFlowSequence(layer: FlowLayer): string[] {
  const inDegree = new Map<string, number>()
  for (const node of layer.nodes) inDegree.set(node.id, 0)
  for (const edge of layer.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  }

  const queue = layer.nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
  const result: string[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const id = queue.shift()
    if (!id || visited.has(id)) continue
    visited.add(id)
    result.push(id)

    for (const edge of layer.edges.filter((item) => item.from === id)) {
      const next = (inDegree.get(edge.to) ?? 1) - 1
      inDegree.set(edge.to, next)
      if (next === 0) queue.push(edge.to)
    }
  }

  for (const node of layer.nodes) {
    if (!visited.has(node.id)) result.push(node.id)
  }

  return result
}

export function polylineLength(points: PathPoint[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return length
}

export function tracePath(ctx: CanvasRenderingContext2D, points: PathPoint[]): void {
  if (points.length === 0) return
  ctx.beginPath()
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
}

/** SVG-style stroke reveal using canvas line dash offset */
export function drawAnimatedStroke(
  ctx: CanvasRenderingContext2D,
  points: PathPoint[],
  progress: number,
): void {
  if (points.length < 2 || progress <= 0) return

  const totalLength = polylineLength(points)
  if (totalLength <= 0) return

  if (progress >= 1) {
    tracePath(ctx, points)
    ctx.stroke()
    return
  }

  ctx.setLineDash([totalLength, totalLength])
  ctx.lineDashOffset = totalLength * (1 - progress)
  tracePath(ctx, points)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineDashOffset = 0
}

export function pathToSvgD(points: PathPoint[]): string {
  if (points.length === 0) return ''
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

export function createFlowNodeId(existing: FlowLayer['nodes']): string {
  let index = existing.length + 1
  while (existing.some((node) => node.id === `node-${index}`)) index++
  return `node-${index}`
}
