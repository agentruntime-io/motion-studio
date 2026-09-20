import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/engine/exporter.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { exportVideoWithRenderer } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

function setup(t, { constructorError = false, recorderError = false } = {}) {
  const canvases = []
  const recorders = []
  const oldDocument = globalThis.document
  const oldRecorder = globalThis.MediaRecorder
  globalThis.document = { createElement(tag) {
    assert.equal(tag, 'canvas')
    const canvas = { width: 0, height: 0, value: 'blank', stopped: false }
    canvas.getContext = () => ({ canvas })
    canvas.captureStream = () => ({ canvas, getTracks: () => [{ stop() { canvas.stopped = true } }] })
    canvases.push(canvas)
    return canvas
  } }
  globalThis.MediaRecorder = class {
    static isTypeSupported() { return true }
    constructor(stream) {
      if (constructorError) throw new Error('Encoder unavailable')
      this.stream = stream
      this.state = 'inactive'
      this.samples = [stream.canvas.value]
      recorders.push(this)
    }
    start() {
      this.state = 'recording'
      this.interval = setInterval(() => {
        this.samples.push(this.stream.canvas.value)
        if (recorderError) this.onerror()
      }, 1)
    }
    stop() {
      this.state = 'inactive'
      clearInterval(this.interval)
      this.ondataavailable({ data: new Blob(['encoded']) })
      this.onstop()
    }
  }
  t.after(() => {
    globalThis.document = oldDocument
    globalThis.MediaRecorder = oldRecorder
  })
  return { canvases, recorders }
}

const base = { width: 1280, height: 720, duration: 0.03, fps: 100 }

test('recordings stay isolated while preview seeks and a second recording runs', async (t) => {
  const { canvases, recorders } = setup(t)
  const preview = { value: 'old scene' }
  const times = [[], []]
  const jobs = [0, 1].map((id) => exportVideoWithRenderer({
    ...base,
    renderFrame(ctx, time) {
      assert.notEqual(ctx.canvas, preview)
      times[id].push(time)
      ctx.canvas.value = `${id}:${time}`
    },
  }, () => { preview.value = 'previous scene' }))
  const blobs = await Promise.all(jobs)
  assert.equal(canvases.length, 2)
  for (let id = 0; id < 2; id++) {
    assert.deepEqual(times[id], [0, 0, 0.01, 0.02])
    assert.ok(recorders[id].samples.every((sample) => sample.startsWith(`${id}:`)))
    const sampledTimes = recorders[id].samples.map((sample) => Number(sample.split(':')[1]))
    assert.deepEqual(sampledTimes, [...sampledTimes].sort((a, b) => a - b))
    assert.equal(canvases[id].width, 1280)
    assert.equal(canvases[id].height, 720)
    assert.equal(canvases[id].stopped, true)
    assert.ok(blobs[id].size > 0)
  }
})

test('render failure rejects and releases the recording stream', async (t) => {
  const { canvases } = setup(t)
  await assert.rejects(exportVideoWithRenderer({ ...base, renderFrame(_ctx, time) {
    if (time > 0) throw new Error('Frame failed')
  } }), /Frame failed/)
  assert.equal(canvases[0].stopped, true)
})

test('recorder construction failure releases its stream', async (t) => {
  const { canvases } = setup(t, { constructorError: true })
  await assert.rejects(exportVideoWithRenderer({ ...base, renderFrame() {} }), /Encoder unavailable/)
  assert.equal(canvases[0].stopped, true)
})

test('recorder errors reject without reporting success or drawing further frames', async (t) => {
  const { canvases } = setup(t, { recorderError: true })
  const phases = []
  await assert.rejects(exportVideoWithRenderer({ ...base, renderFrame() {} }, (p) => phases.push(p.phase)), /MediaRecorder failed/)
  assert.equal(canvases[0].stopped, true)
  assert.equal(phases.includes('done'), false)
})

test('invalid timing is rejected before capture starts', async (t) => {
  const { canvases } = setup(t)
  await assert.rejects(exportVideoWithRenderer({ ...base, fps: 0, renderFrame() {} }), /must be positive/)
  assert.equal(canvases.length, 0)
})
