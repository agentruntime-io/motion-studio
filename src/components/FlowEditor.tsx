import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FlowLayer, FlowNode, FlowNodeStyle } from '../types/project'
import {
  buildEdgePath,
  getFlowNodeAnchor,
  getFlowNodeSize,
  getFlowNodeStyle,
} from '../engine/flowAnimation'
import {
  createFlowNodeId,
  edgeKey,
  pathToSvgD,
  suggestFlowSequence,
  hasFlowNodeNumber,
} from '../lib/flowUtils'

interface FlowEditorProps {
  layer: FlowLayer
  canvasWidth: number
  canvasHeight: number
  onUpdate: (updater: (layer: FlowLayer) => FlowLayer) => void
  /** compact = properties panel; expanded = full modal */
  layout?: 'compact' | 'expanded'
}

type EditorMode = 'select' | 'connect'

export function FlowEditor({
  layer,
  canvasWidth,
  canvasHeight,
  onUpdate,
  layout = 'compact',
}: FlowEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<EditorMode>('select')
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeKeys, setSelectedEdgeKeys] = useState<string[]>([])
  const [connectFromId, setConnectFromId] = useState<string | null>(null)
  const [connectPreview, setConnectPreview] = useState<{ x: number; y: number } | null>(null)
  const [dragState, setDragState] = useState<{
    nodeId: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const [waypointDrag, setWaypointDrag] = useState<{
    edgeKey: string
    pointIndex: number
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const [viewportWidth, setViewportWidth] = useState(360)
  const [viewportHeight, setViewportHeight] = useState(300)

  useEffect(() => {
    const node = layout === 'expanded' ? canvasWrapRef.current : containerRef.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setViewportWidth(entry.contentRect.width)
      if (layout === 'expanded') {
        setViewportHeight(entry.contentRect.height)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [layout])

  const scale =
    layout === 'expanded'
      ? Math.min(1, viewportWidth / canvasWidth, viewportHeight / canvasHeight)
      : Math.min(1, viewportWidth / canvasWidth, 300 / canvasHeight)

  const patch = useCallback(
    (updater: (current: FlowLayer) => FlowLayer) => onUpdate(updater),
    [onUpdate],
  )

  const clientToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasWrapRef.current?.querySelector('.flow-editor-canvas')
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return {
        x: Math.round((clientX - rect.left) / scale),
        y: Math.round((clientY - rect.top) / scale),
      }
    },
    [scale],
  )

  const completeConnection = useCallback(
    (from: string, to: string) => {
      if (from === to) return
      patch((current) => {
        if (current.edges.some((edge) => edge.from === from && edge.to === to)) return current
        return { ...current, edges: [...current.edges, { from, to }] }
      })
      setConnectFromId(null)
      setConnectPreview(null)
      setMode('select')
    },
    [patch],
  )

  const clearSelection = useCallback(() => {
    setSelectedNodeIds([])
    setSelectedEdgeKeys([])
  }, [])

  const selectNode = useCallback((nodeId: string, additive: boolean) => {
    setSelectedEdgeKeys([])
    setSelectedNodeIds((prev) => {
      if (additive) {
        return prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
      }
      return [nodeId]
    })
  }, [])

  const selectEdge = useCallback((key: string, additive: boolean) => {
    setSelectedNodeIds([])
    setSelectedEdgeKeys((prev) => {
      if (additive) {
        return prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
      }
      return [key]
    })
  }, [])

  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null
    return layer.nodes.find((node) => node.id === selectedNodeIds[0]) ?? null
  }, [layer.nodes, selectedNodeIds])

  const selectedEdge = useMemo(() => {
    if (selectedEdgeKeys.length !== 1) return null
    return (
      layer.edges.find((edge) => edgeKey(edge.from, edge.to) === selectedEdgeKeys[0]) ?? null
    )
  }, [layer.edges, selectedEdgeKeys])

  const addNode = (style: FlowNodeStyle) => {
    const id = createFlowNodeId(layer.nodes)
    patch((current) => {
      const node: FlowNode = {
        id,
        style,
        label: style === 'n8n' ? 'New Node' : 'Step',
        number: current.nodes.length + 1,
        icon: style === 'n8n' ? '⚡' : undefined,
        x: 80 + current.nodes.length * 40,
        y: 120 + current.nodes.length * 24,
      }
      return {
        ...current,
        nodes: [...current.nodes, node],
        flowAnimation: {
          ...current.flowAnimation,
          sequence: [...(current.flowAnimation?.sequence ?? suggestFlowSequence(current)), id],
        },
      }
    })
    setSelectedNodeIds([id])
    setSelectedEdgeKeys([])
  }

  const deleteSelected = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      const ids = new Set(selectedNodeIds)
      patch((current) => ({
        ...current,
        nodes: current.nodes.filter((node) => !ids.has(node.id)),
        edges: current.edges.filter((edge) => !ids.has(edge.from) && !ids.has(edge.to)),
        flowAnimation: {
          ...current.flowAnimation,
          sequence: (current.flowAnimation?.sequence ?? suggestFlowSequence(current)).filter(
            (entry) => !selectedNodeIds.some((id) => entry.includes(id)),
          ),
        },
      }))
      clearSelection()
      return
    }
    if (selectedEdgeKeys.length > 0) {
      const keys = new Set(selectedEdgeKeys)
      patch((current) => ({
        ...current,
        edges: current.edges.filter((edge) => !keys.has(edgeKey(edge.from, edge.to))),
      }))
      clearSelection()
    }
  }, [clearSelection, patch, selectedEdgeKeys, selectedNodeIds])

  const autoSequence = () => {
    patch((current) => ({
      ...current,
      flowAnimation: { ...current.flowAnimation, sequence: suggestFlowSequence(current) },
    }))
  }

  const handleNodePointerDown = (event: React.PointerEvent, node: FlowNode) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    selectNode(node.id, event.shiftKey)

    if (mode === 'connect') {
      if (!connectFromId) {
        setConnectFromId(node.id)
        setConnectPreview(clientToCanvas(event.clientX, event.clientY))
      }
      return
    }

    setDragState({
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: node.x,
      origY: node.y,
    })
  }

  const handleNodePointerUp = (event: React.PointerEvent, node: FlowNode) => {
    if (mode !== 'connect' || !connectFromId) return
    event.stopPropagation()
    if (connectFromId !== node.id) {
      completeConnection(connectFromId, node.id)
    }
  }

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (mode === 'connect' && connectFromId) {
        setConnectPreview(clientToCanvas(event.clientX, event.clientY))
      }

      if (dragState) {
        const dx = (event.clientX - dragState.startX) / scale
        const dy = (event.clientY - dragState.startY) / scale
        patch((current) => ({
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === dragState.nodeId
              ? {
                  ...node,
                  x: Math.round(dragState.origX + dx),
                  y: Math.round(dragState.origY + dy),
                }
              : node,
          ),
        }))
      }

      if (waypointDrag) {
        const dx = (event.clientX - waypointDrag.startX) / scale
        const dy = (event.clientY - waypointDrag.startY) / scale
        patch((current) => ({
          ...current,
          edges: current.edges.map((edge) => {
            if (edgeKey(edge.from, edge.to) !== waypointDrag.edgeKey) return edge
            const points = [...(edge.points ?? [{ x: waypointDrag.origX, y: waypointDrag.origY }])]
            points[waypointDrag.pointIndex] = {
              x: Math.round(waypointDrag.origX + dx),
              y: Math.round(waypointDrag.origY + dy),
            }
            return { ...edge, points }
          }),
        }))
      }
    },
    [clientToCanvas, connectFromId, dragState, mode, patch, scale, waypointDrag],
  )

  const handlePointerUp = useCallback(() => {
    setDragState(null)
    setWaypointDrag(null)
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }
      deleteSelected()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelected])

  const ensureEdgeWaypoint = (edge: FlowLayer['edges'][number]) => {
    if (edge.points?.length) return edge.points[0]
    const from = layer.nodes.find((node) => node.id === edge.from)
    const to = layer.nodes.find((node) => node.id === edge.to)
    if (!from || !to) return { x: 0, y: 0 }
    const points = buildEdgePath(from, to, layer, edge)
    if (points.length <= 2) return points[0] ?? { x: 0, y: 0 }
    return points[1]
  }

  const connectFromNode = useMemo(
    () => (connectFromId ? layer.nodes.find((node) => node.id === connectFromId) ?? null : null),
    [connectFromId, layer.nodes],
  )

  return (
    <div
      className={`flow-editor ${layout === 'expanded' ? 'flow-editor-expanded' : ''} ${mode === 'connect' ? 'flow-editor-connect-mode' : ''}`}
      ref={containerRef}
    >
      <div className="flow-editor-toolbar">
        <button
          type="button"
          className={`btn btn-ghost ${mode === 'select' ? 'active' : ''}`}
          onClick={() => {
            setMode('select')
            setConnectFromId(null)
            setConnectPreview(null)
          }}
        >
          Select
        </button>
        <button
          type="button"
          className={`btn btn-ghost ${mode === 'connect' ? 'active' : ''}`}
          onClick={() => {
            setMode('connect')
            setConnectFromId(null)
            setConnectPreview(null)
          }}
        >
          Connect
        </button>
        <button type="button" className="btn btn-ghost" onClick={autoSequence}>
          Auto sequence
        </button>
        <button type="button" className="btn btn-ghost" onClick={deleteSelected}>
          Delete
        </button>
      </div>

      <div className="flow-editor-add">
        <span>Add node:</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addNode('step')}>
          Step
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addNode('card')}>
          Card
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addNode('n8n')}>
          n8n
        </button>
      </div>

      {mode === 'connect' && (
        <p className="flow-editor-hint">
          {connectFromId
            ? 'Drag to the target node and release — dashed line shows the connection'
            : 'Press on the start node, drag to the end node, and release'}
        </p>
      )}

      <div ref={canvasWrapRef} className="flow-editor-canvas-wrap">
        <div
          className="flow-editor-canvas"
          style={{
            width: canvasWidth * scale,
            height: canvasHeight * scale,
          }}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return
            clearSelection()
            if (mode === 'connect') {
              setConnectFromId(null)
              setConnectPreview(null)
            }
          }}
        >
          <svg
            className="flow-editor-edges"
            width={canvasWidth * scale}
            height={canvasHeight * scale}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          >
            {layer.edges.map((edge) => {
              const from = layer.nodes.find((node) => node.id === edge.from)
              const to = layer.nodes.find((node) => node.id === edge.to)
              if (!from || !to) return null
              const path = buildEdgePath(from, to, layer, edge)
              const key = edgeKey(edge.from, edge.to)
              const selected = selectedEdgeKeys.includes(key)
              return (
                <path
                  key={key}
                  d={pathToSvgD(path)}
                  className={`flow-editor-edge ${selected ? 'selected' : ''}`}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    selectEdge(key, event.shiftKey)
                  }}
                />
              )
            })}
            {connectFromNode && connectPreview && (
              <line
                x1={getFlowNodeAnchor(connectFromNode, layer, 'out').x}
                y1={getFlowNodeAnchor(connectFromNode, layer, 'out').y}
                x2={connectPreview.x}
                y2={connectPreview.y}
                className="flow-editor-preview-edge"
              />
            )}
          </svg>

          {layer.edges.map((edge) => {
            const key = edgeKey(edge.from, edge.to)
            if (selectedEdgeKeys.length !== 1 || selectedEdgeKeys[0] !== key) return null
            const waypoint = ensureEdgeWaypoint(edge)
            return (
              <button
                key={`${edge.from}-${edge.to}-wp`}
                type="button"
                className="flow-editor-waypoint"
                style={{
                  left: waypoint.x * scale - 6,
                  top: waypoint.y * scale - 6,
                }}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  setWaypointDrag({
                    edgeKey: edgeKey(edge.from, edge.to),
                    pointIndex: 0,
                    startX: event.clientX,
                    startY: event.clientY,
                    origX: waypoint.x,
                    origY: waypoint.y,
                  })
                }}
                aria-label="Drag edge waypoint"
              />
            )
          })}

          {layer.nodes.map((node) => {
            const style = getFlowNodeStyle(node, layer) ?? 'step'
            const { width, height } = getFlowNodeSize(node, style)
            const selected = selectedNodeIds.includes(node.id)
            const connectSource = connectFromId === node.id
            const showNumber = hasFlowNodeNumber(node)
            const anchorIn = getFlowNodeAnchor(node, layer, 'in')
            const anchorOut = getFlowNodeAnchor(node, layer, 'out')

            return (
              <div
                key={node.id}
                className={`flow-editor-node flow-editor-node-${style} ${selected ? 'selected' : ''} ${connectSource ? 'connect-source' : ''} ${style === 'step' && !showNumber ? 'flow-editor-node-step-no-number' : ''}`}
                style={{
                  left: node.x * scale,
                  top: node.y * scale,
                  width: width * scale,
                  height: height * scale,
                }}
                onPointerDown={(event) => handleNodePointerDown(event, node)}
                onPointerUp={(event) => handleNodePointerUp(event, node)}
                onClick={(event) => event.stopPropagation()}
              >
                <span className="flow-editor-node-label">{node.label}</span>
                {style === 'step' && showNumber && (
                  <span className="flow-editor-node-badge">{node.number}</span>
                )}
                {style === 'n8n' && (
                  <span className="flow-editor-node-icon">{node.icon ?? '⚡'}</span>
                )}
                <span
                  className="flow-editor-port flow-editor-port-in"
                  style={{
                    left: (anchorIn.x - node.x) * scale,
                    top: (anchorIn.y - node.y) * scale,
                  }}
                />
                <span
                  className="flow-editor-port flow-editor-port-out"
                  style={{
                    left: (anchorOut.x - node.x) * scale,
                    top: (anchorOut.y - node.y) * scale,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flow-editor-props-dock">
        <p className="flow-editor-props-title">
          {selectedNodeIds.length > 1
            ? `${selectedNodeIds.length} nodes selected`
            : selectedNode
              ? `Node · ${selectedNode.label}`
              : selectedEdgeKeys.length > 1
                ? `${selectedEdgeKeys.length} edges selected`
                : selectedEdge
                  ? `Edge · ${selectedEdge.from} → ${selectedEdge.to}`
                  : 'Selection'}
        </p>

        {selectedNode ? (
          <div className="flow-editor-props">
            <Field label="Label">
              <input
                className="inspector-input"
                value={selectedNode.label}
                onChange={(e) =>
                  patch((current) => ({
                    ...current,
                    nodes: current.nodes.map((node) =>
                      node.id === selectedNode.id ? { ...node, label: e.target.value } : node,
                    ),
                  }))
                }
              />
            </Field>
            <Field label="Style">
              <select
                className="inspector-select"
                value={selectedNode.style ?? layer.defaultNodeStyle ?? 'step'}
                onChange={(e) =>
                  patch((current) => ({
                    ...current,
                    nodes: current.nodes.map((node) =>
                      node.id === selectedNode.id
                        ? { ...node, style: e.target.value as FlowNodeStyle }
                        : node,
                    ),
                  }))
                }
              >
                <option value="step">Step</option>
                <option value="card">Card</option>
                <option value="n8n">n8n</option>
              </select>
            </Field>
            {(selectedNode.style ?? layer.defaultNodeStyle ?? 'step') !== 'n8n' && (
              <Field label="Number">
                <input
                  className="inspector-input"
                  value={selectedNode.number ?? ''}
                  onChange={(e) =>
                    patch((current) => ({
                      ...current,
                      nodes: current.nodes.map((node) =>
                        node.id === selectedNode.id
                          ? { ...node, number: e.target.value }
                          : node,
                      ),
                    }))
                  }
                />
              </Field>
            )}
            {(selectedNode.style ?? layer.defaultNodeStyle) === 'n8n' && (
              <>
                <Field label="Subtitle">
                  <input
                    className="inspector-input"
                    value={selectedNode.subtitle ?? ''}
                    onChange={(e) =>
                      patch((current) => ({
                        ...current,
                        nodes: current.nodes.map((node) =>
                          node.id === selectedNode.id
                            ? { ...node, subtitle: e.target.value }
                            : node,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label="Icon">
                  <input
                    className="inspector-input"
                    value={selectedNode.icon ?? ''}
                    onChange={(e) =>
                      patch((current) => ({
                        ...current,
                        nodes: current.nodes.map((node) =>
                          node.id === selectedNode.id ? { ...node, icon: e.target.value } : node,
                        ),
                      }))
                    }
                  />
                </Field>
              </>
            )}
          </div>
        ) : selectedEdgeKeys.length > 1 ? (
          <p className="flow-editor-props-empty">
            Multiple edges selected. Shift+click to adjust selection. Delete removes all selected
            edges.
          </p>
        ) : selectedEdge ? (
          <p className="flow-editor-props-empty">
            Drag the orange waypoint on the canvas to adjust this connection path.
          </p>
        ) : selectedNodeIds.length > 1 ? (
          <p className="flow-editor-props-empty">
            Multiple nodes selected. Shift+click to adjust selection. Delete removes all selected
            nodes.
          </p>
        ) : (
          <p className="flow-editor-props-empty">
            Select a node or edge on the canvas. Shift+click to select multiple of the same kind.
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="inspector-field flow-editor-field">
      <span>{label}</span>
      {children}
    </label>
  )
}
