import type { FlowLayer, VideoProject } from '../types/project'
import { computeLayerTransform } from './animations'
import {
  buildEdgePath,
  getEdgeRevealProgress,
  getFlowNode,
  getFlowNodeSize,
  getFlowNodeStyle,
  getFlowRevealState,
  getNodeRevealProgress,
} from './flowAnimation'
import { drawAnimatedStroke, edgeKey, hasFlowNodeNumber } from '../lib/flowUtils'

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawAnimatedEdgePath(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  progress: number,
): void {
  drawAnimatedStroke(ctx, points, progress)
}

function drawStepNode(
  ctx: CanvasRenderingContext2D,
  node: FlowLayer['nodes'][number],
  layer: FlowLayer,
  progress: number,
  images: Map<string, HTMLImageElement>,
): void {
  const theme = layer.theme ?? {}
  const { width, height } = getFlowNodeSize(node, 'step')
  const cx = node.x + width / 2
  const cy = node.y + height / 2
  const scale = 0.6 + progress * 0.4

  ctx.save()
  ctx.globalAlpha *= progress
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)

  if (node.image) {
    const image = images.get(node.image)
    if (image) {
      roundRect(ctx, node.x, node.y, width, height, 10)
      ctx.save()
      ctx.clip()
      ctx.drawImage(image, node.x, node.y, width, height)
      ctx.restore()
      roundRect(ctx, node.x, node.y, width, height, 10)
      ctx.strokeStyle = theme.cardBorder ?? '#e2e8f0'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  } else if (hasFlowNodeNumber(node)) {
    ctx.fillStyle = theme.badgeColor ?? node.color ?? '#2563eb'
    ctx.beginPath()
    ctx.arc(cx, cy, Math.min(width, height) / 2, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${Math.floor(height * 0.42)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(node.number), cx, cy + 1)
  }

  ctx.fillStyle = theme.labelColor ?? '#64748b'
  ctx.font = `500 ${Math.max(13, height * 0.28)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  if (hasFlowNodeNumber(node)) {
    ctx.textBaseline = 'top'
    ctx.fillText(node.label, cx, node.y + height + 8)
  } else {
    ctx.textBaseline = 'middle'
    ctx.fillText(node.label, cx, cy)
  }

  ctx.restore()
}

function drawCardNode(
  ctx: CanvasRenderingContext2D,
  node: FlowLayer['nodes'][number],
  layer: FlowLayer,
  progress: number,
): void {
  const theme = layer.theme ?? {}
  const { width, height } = getFlowNodeSize(node, 'card')
  const cx = node.x + width / 2
  const cy = node.y + height / 2
  const scale = 0.75 + progress * 0.25

  ctx.save()
  ctx.globalAlpha *= progress
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)

  ctx.fillStyle = theme.cardBackground ?? '#ffffff'
  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 6
  roundRect(ctx, node.x, node.y, width, height, 14)
  ctx.fill()
  ctx.shadowColor = 'transparent'

  ctx.strokeStyle = theme.cardBorder ?? '#e2e8f0'
  ctx.lineWidth = 1.5
  roundRect(ctx, node.x, node.y, width, height, 14)
  ctx.stroke()

  const badgeR = 16
  const badgeCx = cx
  const badgeCy = node.y + 18
  if (hasFlowNodeNumber(node)) {
    ctx.fillStyle = theme.badgeColor ?? node.color ?? '#2563eb'
    ctx.beginPath()
    ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = '700 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(node.number), badgeCx, badgeCy + 1)
  }

  ctx.fillStyle = theme.labelColor ?? '#334155'
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(node.label, cx, hasFlowNodeNumber(node) ? node.y + 40 : node.y + 24, width - 20)

  if (node.subtitle) {
    ctx.fillStyle = theme.subtitleColor ?? '#64748b'
    ctx.font = '400 12px system-ui, sans-serif'
    ctx.fillText(node.subtitle, cx, node.y + 62, width - 20)
  }

  ctx.restore()
}

function drawN8nNode(
  ctx: CanvasRenderingContext2D,
  node: FlowLayer['nodes'][number],
  layer: FlowLayer,
  progress: number,
): void {
  const theme = layer.theme ?? {}
  const { width, height } = getFlowNodeSize(node, 'n8n')
  const cx = node.x + width / 2
  const cy = node.y + height / 2
  const scale = 0.8 + progress * 0.2

  ctx.save()
  ctx.globalAlpha *= progress
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)

  ctx.fillStyle = theme.n8nBackground ?? '#1e1e1e'
  roundRect(ctx, node.x, node.y, width, height, 10)
  ctx.fill()

  ctx.strokeStyle = theme.n8nBorder ?? '#404040'
  ctx.lineWidth = 1.5
  roundRect(ctx, node.x, node.y, width, height, 10)
  ctx.stroke()

  const iconSize = 40
  const iconX = node.x + 12
  const iconY = node.y + (height - iconSize) / 2
  ctx.fillStyle = node.color ?? '#ff6d5a'
  roundRect(ctx, iconX, iconY, iconSize, iconSize, 8)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 18px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(node.icon ?? '⚡', iconX + iconSize / 2, iconY + iconSize / 2)

  const textX = iconX + iconSize + 12
  ctx.fillStyle = theme.labelColor ?? '#f8fafc'
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(node.label, textX, node.y + 16, width - iconSize - 28)

  if (node.subtitle) {
    ctx.fillStyle = theme.subtitleColor ?? '#94a3b8'
    ctx.font = '400 12px system-ui, sans-serif'
    ctx.fillText(node.subtitle, textX, node.y + 38, width - iconSize - 28)
  }

  ctx.fillStyle = theme.n8nBorder ?? '#64748b'
  ctx.beginPath()
  ctx.arc(node.x, cy, 4, 0, Math.PI * 2)
  ctx.arc(node.x + width, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawFlowNode(
  ctx: CanvasRenderingContext2D,
  node: FlowLayer['nodes'][number],
  layer: FlowLayer,
  localTime: number,
  images: Map<string, HTMLImageElement>,
  progressOverride?: number,
): void {
  const progress = progressOverride ?? getNodeRevealProgress(layer, node.id, localTime)
  if (progress <= 0) return

  const style = getFlowNodeStyle(node, layer) ?? 'step'
  switch (style) {
    case 'card':
      drawCardNode(ctx, node, layer, progress)
      break
    case 'n8n':
      drawN8nNode(ctx, node, layer, progress)
      break
    default:
      drawStepNode(ctx, node, layer, progress, images)
  }
}

export function collectFlowImageSources(layer: FlowLayer): string[] {
  return layer.nodes.flatMap((node) => (node.image ? [node.image] : []))
}

export function drawFlowLayer(
  ctx: CanvasRenderingContext2D,
  layer: FlowLayer,
  project: VideoProject,
  time: number,
  images: Map<string, HTMLImageElement>,
): void {
  const bounds = {
    x: layer.x ?? 0,
    y: layer.y ?? 0,
    width: layer.width ?? project.width,
    height: layer.height ?? project.height,
  }

  const { transform } = computeLayerTransform(
    time,
    layer.start,
    layer.duration,
    bounds.x,
    bounds.y,
    layer.opacity ?? 1,
    project.width,
    project.height,
    layer.transition,
    layer.animation,
    layer,
  )

  if (transform.opacity <= 0) return

  const localTime = time - layer.start
  const theme = layer.theme ?? {}
  const highlightActive = layer.flowAnimation?.highlightActive !== false
  const revealState = highlightActive ? getFlowRevealState(layer, localTime) : null
  const hasActiveFocus =
    revealState !== null &&
    revealState.activeNodeIds.size + revealState.activeEdgeKeys.size > 0

  ctx.save()
  ctx.globalAlpha = transform.opacity
  ctx.translate(transform.x - bounds.x, transform.y - bounds.y)

  ctx.strokeStyle = theme.lineColor ?? '#cbd5e1'
  ctx.lineWidth = theme.lineWidth ?? 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const edge of layer.edges) {
    const from = getFlowNode(layer, edge.from)
    const to = getFlowNode(layer, edge.to)
    if (!from || !to) continue

    const progress = getEdgeRevealProgress(layer, edge, localTime)
    if (progress <= 0) continue

    ctx.save()
    const key = edgeKey(edge.from, edge.to)
    if (hasActiveFocus) {
      if (revealState!.activeEdgeKeys.has(key)) {
        ctx.globalAlpha = transform.opacity
      } else if (revealState!.revealedEdgeKeys.has(key)) {
        ctx.globalAlpha = transform.opacity * 0.45
      } else {
        ctx.globalAlpha = transform.opacity * progress
      }
    }

    const path = buildEdgePath(from, to, layer, edge)
    drawAnimatedEdgePath(ctx, path, progress)
    ctx.restore()
  }

  for (const node of layer.nodes) {
    const progress = getNodeRevealProgress(layer, node.id, localTime)
    if (progress <= 0) continue

    ctx.save()
    if (hasActiveFocus) {
      if (revealState!.activeNodeIds.has(node.id)) {
        ctx.globalAlpha = transform.opacity
      } else if (revealState!.revealedNodeIds.has(node.id)) {
        ctx.globalAlpha = transform.opacity * 0.45
      } else {
        ctx.globalAlpha = transform.opacity * progress
      }
    }

    drawFlowNode(ctx, node, layer, localTime, images, progress)
    ctx.restore()
  }

  ctx.restore()
}
