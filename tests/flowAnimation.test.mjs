import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

async function readTs(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
}

function stripImports(code) {
  return code
    .replace(/^import type .*;\s*$/gm, '')
    .replace(/^import .* from ['"].*['"];\s*$/gm, '')
    .replace(/^export \{[^}]+\} from ['"].*['"];\s*$/gm, '')
}

const easingCode = stripImports(transpile(await readTs('../src/engine/easing.ts')))
const flowUtilsCode = stripImports(transpile(await readTs('../src/lib/flowUtils.ts')))
const flowAnimationCode = stripImports(transpile(await readTs('../src/engine/flowAnimation.ts')))

const bundle = `
${easingCode}
${flowUtilsCode}
${flowAnimationCode}
`

const { buildFlowRevealTimeline, getFlowTimelineDuration } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`
)

const baseLayer = {
  type: 'flow',
  id: 'flow-1',
  start: 0,
  duration: 10,
  nodes: [
    { id: 'n1', label: 'One', number: 1, x: 0, y: 0 },
    { id: 'n2', label: 'Two', number: 2, x: 100, y: 0 },
    { id: 'n3', label: 'Three', number: 3, x: 200, y: 0 },
    { id: 'a', label: 'Side A', number: 4, x: 100, y: 80 },
  ],
  edges: [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n2', to: 'a' },
  ],
}

test('buildFlowRevealTimeline compiles main track sequentially', () => {
  const layer = {
    ...baseLayer,
    flowAnimation: {
      tracks: [
        {
          id: 'main',
          entries: ['n1', 'edge:n1->n2', 'n2', 'edge:n2->n3', 'n3'],
        },
      ],
    },
  }

  const events = buildFlowRevealTimeline(layer)
  const nodeEvents = events.filter((event) => event.kind === 'node')
  assert.equal(nodeEvents.length, 3)
  assert.ok(nodeEvents[0].start <= nodeEvents[1].start)
  assert.ok(nodeEvents[1].start <= nodeEvents[2].start)
})

test('parallel block starts edge and node at same time', () => {
  const layer = {
    ...baseLayer,
    flowAnimation: {
      stepDelay: 0,
      lineDuration: 0.2,
      nodeDuration: 0.2,
      tracks: [
        {
          id: 'main',
          entries: [{ parallel: ['edge:n2->a', 'a'] }],
        },
      ],
    },
  }

  const events = buildFlowRevealTimeline(layer)
  const edge = events.find((event) => event.kind === 'edge')
  const node = events.find((event) => event.kind === 'node' && event.id === 'a')
  assert.ok(edge)
  assert.ok(node)
  assert.equal(edge.start, node.start)
})

test('branch lane and join gate compile with absolute timing', () => {
  const layer = {
    ...baseLayer,
    flowAnimation: {
      stepDelay: 0,
      lineDuration: 0.2,
      nodeDuration: 0.2,
      tracks: [
        {
          id: 'main',
          entries: ['n1', 'n2', 'n3'],
          waitForTracks: [{ afterEntry: 1, tracks: ['branch'] }],
        },
        {
          id: 'branch',
          parallelWith: 'main',
          parallelAfterEntry: 1,
          entries: ['edge:n2->a', 'a'],
        },
      ],
    },
  }

  const duration = getFlowTimelineDuration(layer)
  assert.ok(duration > 0.4)

  const events = buildFlowRevealTimeline(layer)
  const n3 = events.find((event) => event.kind === 'node' && event.id === 'n3')
  const branchNode = events.find((event) => event.kind === 'node' && event.id === 'a')
  assert.ok(n3)
  assert.ok(branchNode)
  assert.ok(n3.start >= branchNode.start + branchNode.duration)
})
