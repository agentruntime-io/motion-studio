import type {
  FlowLayer,
  FlowRevealTrack,
  FlowSequenceEntry,
  FlowSequenceToken,
  FlowTrackWait,
} from '../types/project'
import { getFlowTimelineDuration, getFlowRevealState, getFlowTracks, isParallelBlock } from '../engine/flowAnimation'
import {
  edgeKey,
  formatEdgeSequenceEntry,
  parseSequenceEntry,
  suggestFlowSequence,
} from './flowUtils'

export interface FlowTimelineChip {
  key: string
  trackId: string
  entryIndex: number
  subIndex?: number
  kind: 'node' | 'edge' | 'parallel'
  label: string
  nodeId?: string
  edgeFrom?: string
  edgeTo?: string
  parallelTokens?: FlowSequenceToken[]
}

export { getFlowTracks, getFlowTimelineDuration, getFlowRevealState }

export function createFlowTrackId(existing: FlowRevealTrack[]): string {
  let index = existing.length + 1
  while (existing.some((track) => track.id === `track-${index}`)) index++
  return `track-${index}`
}

export function flattenTrackEntries(track: FlowRevealTrack): FlowSequenceToken[] {
  const tokens: FlowSequenceToken[] = []
  for (const entry of track.entries) {
    if (isParallelBlock(entry)) tokens.push(...entry.parallel)
    else tokens.push(entry)
  }
  return tokens
}

export function entryContainsToken(entry: FlowSequenceEntry, token: string): boolean {
  if (isParallelBlock(entry)) return entry.parallel.some((item) => item.includes(token))
  return entry.includes(token)
}

export function findNodeEntryIndex(track: FlowRevealTrack, nodeId: string): number {
  return track.entries.findIndex((entry) => {
    if (isParallelBlock(entry)) {
      return entry.parallel.some((item) => {
        const parsed = parseSequenceEntry(item)
        return parsed.kind === 'node' && parsed.id === nodeId
      })
    }
    const parsed = parseSequenceEntry(entry)
    return parsed.kind === 'node' && parsed.id === nodeId
  })
}

function getNodeLabel(layer: FlowLayer, nodeId: string): string {
  return layer.nodes.find((node) => node.id === nodeId)?.label ?? nodeId
}

export function describeSequenceToken(layer: FlowLayer, token: FlowSequenceToken): string {
  const parsed = parseSequenceEntry(token)
  if (parsed.kind === 'edge') {
    return `${getNodeLabel(layer, parsed.from)} → ${getNodeLabel(layer, parsed.to)}`
  }
  return getNodeLabel(layer, parsed.id)
}

export function buildTimelineChips(layer: FlowLayer, track: FlowRevealTrack): FlowTimelineChip[] {
  return track.entries.map((entry, entryIndex) => {
    if (isParallelBlock(entry)) {
      return {
        key: `${track.id}:${entryIndex}:parallel`,
        trackId: track.id,
        entryIndex,
        kind: 'parallel',
        label: `Parallel (${entry.parallel.length})`,
        parallelTokens: entry.parallel,
      }
    }

    const parsed = parseSequenceEntry(entry)
    if (parsed.kind === 'edge') {
      return {
        key: `${track.id}:${entryIndex}:edge:${parsed.from}->${parsed.to}`,
        trackId: track.id,
        entryIndex,
        kind: 'edge',
        label: describeSequenceToken(layer, entry),
        edgeFrom: parsed.from,
        edgeTo: parsed.to,
      }
    }

    return {
      key: `${track.id}:${entryIndex}:node:${parsed.id}`,
      trackId: track.id,
      entryIndex,
      kind: 'node',
      label: describeSequenceToken(layer, entry),
      nodeId: parsed.id,
    }
  })
}

function findMainPath(layer: FlowLayer): string[] {
  const nodesById = new Map(layer.nodes.map((node) => [node.id, node]))
  const inDegree = new Map<string, number>()
  for (const node of layer.nodes) inDegree.set(node.id, 0)
  for (const edge of layer.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  }

  const roots = layer.nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .sort((a, b) => a.x - b.x || a.y - b.y)

  if (roots.length === 0 && layer.nodes.length > 0) {
    return [...layer.nodes].sort((a, b) => a.x - b.x).map((node) => node.id)
  }

  let bestPath: string[] = []

  const walk = (nodeId: string, path: string[], visited: Set<string>) => {
    if (visited.has(nodeId)) return
    const nextPath = [...path, nodeId]
    if (nextPath.length > bestPath.length) bestPath = nextPath

    const outgoing = layer.edges
      .filter((edge) => edge.from === nodeId)
      .map((edge) => edge.to)
      .sort((a, b) => {
        const na = nodesById.get(a)
        const nb = nodesById.get(b)
        return (na?.x ?? 0) - (nb?.x ?? 0) || (na?.y ?? 0) - (nb?.y ?? 0)
      })

    for (const next of outgoing) {
      walk(next, nextPath, new Set([...visited, nodeId]))
    }
  }

  for (const root of roots) {
    walk(root.id, [], new Set())
  }

  if (bestPath.length === 0) {
    return suggestFlowSequence(layer)
      .filter((entry) => parseSequenceEntry(entry).kind === 'node')
      .map((entry) => (parseSequenceEntry(entry) as { kind: 'node'; id: string }).id)
  }

  return bestPath
}

function walkBranchPath(layer: FlowLayer, startId: string, exclude: Set<string>): string[] {
  const path = [startId]
  const visited = new Set([startId, ...exclude])

  let current = startId
  while (true) {
    const nextEdges = layer.edges.filter(
      (edge) => edge.from === current && !exclude.has(edge.to) && !visited.has(edge.to),
    )
    if (nextEdges.length === 0) break
    nextEdges.sort((a, b) => {
      const na = layer.nodes.find((node) => node.id === a.to)
      const nb = layer.nodes.find((node) => node.id === b.to)
      return (na?.x ?? 0) - (nb?.x ?? 0)
    })
    const next = nextEdges[0].to
    path.push(next)
    visited.add(next)
    current = next
  }

  return path
}

export function suggestFlowTracks(layer: FlowLayer): FlowRevealTrack[] {
  if (layer.nodes.length === 0) {
    return [{ id: 'main', label: 'Main', entries: [] }]
  }

  const mainPath = findMainPath(layer)
  const mainSet = new Set(mainPath)
  const mainEntries: FlowSequenceEntry[] = []

  for (let i = 0; i < mainPath.length; i++) {
    const nodeId = mainPath[i]
    if (i > 0) {
      mainEntries.push(formatEdgeSequenceEntry(mainPath[i - 1], nodeId))
    }
    mainEntries.push(nodeId)
  }

  const tracks: FlowRevealTrack[] = [{ id: 'main', label: 'Main', entries: mainEntries }]
  const waitPoints: FlowTrackWait[] = []

  for (let i = 0; i < mainPath.length; i++) {
    const nodeId = mainPath[i]
    const branchEdges = layer.edges.filter((edge) => edge.from === nodeId && !mainSet.has(edge.to))
    if (branchEdges.length === 0) continue

    const branchTrackIds: string[] = []
    branchEdges.forEach((edge, branchIndex) => {
      const branchPath = walkBranchPath(layer, edge.to, mainSet)
      const branchEntries: FlowSequenceEntry[] = [formatEdgeSequenceEntry(edge.from, edge.to)]
      for (let j = 1; j < branchPath.length; j++) {
        branchEntries.push(formatEdgeSequenceEntry(branchPath[j - 1], branchPath[j]))
        branchEntries.push(branchPath[j])
      }

      const parentEntryIndex = mainEntries.findIndex(
        (entry) => !isParallelBlock(entry) && entry === nodeId,
      )
      const trackId = `branch-${nodeId}-${branchIndex + 1}`
      branchTrackIds.push(trackId)
      tracks.push({
        id: trackId,
        label: `From ${getNodeLabel(layer, nodeId)}`,
        parallelWith: 'main',
        parallelAfterEntry: parentEntryIndex >= 0 ? parentEntryIndex : i,
        entries: branchEntries,
      })
    })

    const nextMainIndex = i + 1
    if (nextMainIndex < mainPath.length && branchTrackIds.length > 0) {
      waitPoints.push({ afterEntry: nextMainIndex, tracks: branchTrackIds })
    }
  }

  if (waitPoints.length > 0) {
    tracks[0] = { ...tracks[0], waitForTracks: waitPoints }
  }

  return tracks
}

export function syncFlowTracks(layer: FlowLayer, tracks: FlowRevealTrack[]): FlowLayer {
  const flatSequence = tracks[0] ? flattenTrackEntries(tracks[0]) : []
  return {
    ...layer,
    flowAnimation: {
      ...layer.flowAnimation,
      mode: layer.flowAnimation?.mode ?? 'sequential',
      tracks,
      sequence: flatSequence,
    },
  }
}

export function appendNodeToTracks(tracks: FlowRevealTrack[], nodeId: string): FlowRevealTrack[] {
  if (tracks.length === 0) {
    return [{ id: 'main', label: 'Main', entries: [nodeId] }]
  }
  return tracks.map((track, index) =>
    index === 0 ? { ...track, entries: [...track.entries, nodeId] } : track,
  )
}

export function removeTokenFromTracks(
  tracks: FlowRevealTrack[],
  tokenMatch: (token: string) => boolean,
): FlowRevealTrack[] {
  const next = tracks
    .map((track) => ({
      ...track,
      entries: track.entries
        .map((entry) => {
          if (isParallelBlock(entry)) {
            const parallel = entry.parallel.filter((token) => !tokenMatch(token))
            return parallel.length > 0 ? { parallel } : null
          }
          return tokenMatch(entry) ? null : entry
        })
        .filter((entry): entry is FlowSequenceEntry => entry !== null),
    }))
    .filter((track) => track.entries.length > 0 || track.id === 'main')

  if (next.length === 0) {
    return [{ id: 'main', label: 'Main', entries: [] }]
  }
  return next
}

export function appendEdgeToMainTrack(
  tracks: FlowRevealTrack[],
  from: string,
  to: string,
): FlowRevealTrack[] {
  const edgeToken = formatEdgeSequenceEntry(from, to)
  if (tracks.length === 0) {
    return [{ id: 'main', label: 'Main', entries: [edgeToken] }]
  }

  return tracks.map((track, index) => {
    if (index !== 0) return track
    const toIndex = findNodeEntryIndex(track, to)
    if (toIndex >= 0) {
      const entries = [...track.entries]
      entries.splice(toIndex, 0, edgeToken)
      return { ...track, entries }
    }
    return { ...track, entries: [...track.entries, edgeToken] }
  })
}

export function moveTrackEntry(
  tracks: FlowRevealTrack[],
  fromTrackId: string,
  fromIndex: number,
  toTrackId: string,
  toIndex: number,
): FlowRevealTrack[] {
  const fromTrack = tracks.find((track) => track.id === fromTrackId)
  if (!fromTrack) return tracks
  const entry = fromTrack.entries[fromIndex]
  if (!entry) return tracks

  const without = tracks.map((track) => {
    if (track.id !== fromTrackId) return track
    return { ...track, entries: track.entries.filter((_, index) => index !== fromIndex) }
  })

  return without.map((track) => {
    if (track.id !== toTrackId) return track
    const entries = [...track.entries]
    entries.splice(toIndex, 0, entry)
    return { ...track, entries }
  })
}

export function addParallelBlock(
  tracks: FlowRevealTrack[],
  trackId: string,
  tokens: FlowSequenceToken[],
  atIndex?: number,
): FlowRevealTrack[] {
  return tracks.map((track) => {
    if (track.id !== trackId) return track
    const block = { parallel: tokens }
    const entries = [...track.entries]
    const index = atIndex ?? entries.length
    entries.splice(index, 0, block)
    return { ...track, entries }
  })
}

export function addFlowTrack(
  tracks: FlowRevealTrack[],
  options?: { label?: string; parallelWith?: string; parallelAfterEntry?: number },
): FlowRevealTrack[] {
  const id = createFlowTrackId(tracks)
  return [
    ...tracks,
    {
      id,
      label: options?.label ?? `Lane ${tracks.length}`,
      parallelWith: options?.parallelWith,
      parallelAfterEntry: options?.parallelAfterEntry,
      entries: [],
    },
  ]
}

export function removeFlowTrack(tracks: FlowRevealTrack[], trackId: string): FlowRevealTrack[] {
  if (trackId === 'main') return tracks
  const filtered = tracks.filter((track) => track.id !== trackId)
  return filtered.length > 0 ? filtered : [{ id: 'main', label: 'Main', entries: [] }]
}

export function updateTrackForkPoint(
  tracks: FlowRevealTrack[],
  trackId: string,
  parallelAfterEntry: number,
): FlowRevealTrack[] {
  return tracks.map((track) =>
    track.id === trackId ? { ...track, parallelAfterEntry } : track,
  )
}

export function updateTrackEntry(
  tracks: FlowRevealTrack[],
  trackId: string,
  entryIndex: number,
  entry: FlowSequenceEntry,
): FlowRevealTrack[] {
  return tracks.map((track) => {
    if (track.id !== trackId) return track
    const entries = [...track.entries]
    entries[entryIndex] = entry
    return { ...track, entries }
  })
}

export function removeTrackEntry(
  tracks: FlowRevealTrack[],
  trackId: string,
  entryIndex: number,
): FlowRevealTrack[] {
  return tracks.map((track) => {
    if (track.id !== trackId) return track
    return { ...track, entries: track.entries.filter((_, index) => index !== entryIndex) }
  })
}

export function formatChipSelection(chip: FlowTimelineChip): {
  nodeIds: string[]
  edgeKeys: string[]
} {
  if (chip.kind === 'node' && chip.nodeId) {
    return { nodeIds: [chip.nodeId], edgeKeys: [] }
  }
  if (chip.kind === 'edge' && chip.edgeFrom && chip.edgeTo) {
    return { nodeIds: [], edgeKeys: [edgeKey(chip.edgeFrom, chip.edgeTo)] }
  }
  if (chip.kind === 'parallel' && chip.parallelTokens) {
    const nodeIds: string[] = []
    const edgeKeys: string[] = []
    for (const token of chip.parallelTokens) {
      const parsed = parseSequenceEntry(token)
      if (parsed.kind === 'node') nodeIds.push(parsed.id)
      else edgeKeys.push(edgeKey(parsed.from, parsed.to))
    }
    return { nodeIds, edgeKeys }
  }
  return { nodeIds: [], edgeKeys: [] }
}
