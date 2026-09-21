import { useState } from 'react'
import type { KeyframeProperty, KeyframeValue, Layer, SelectedKeyframeRef } from '../types/project'
import type { TransitionType, AnimationType } from '../types/project'
import { KeyframeEditor, maybeAutoKeyframeLayer } from './KeyframeEditor'
import { FlowEditorModal } from './FlowEditorModal'
import { analytics } from '../lib/analytics'

interface LayerInspectorProps {
  layer: Layer | null
  layerId: string | null
  projectWidth: number
  projectHeight: number
  currentTime: number
  autoKeyframe: boolean
  selectedKeyframe: SelectedKeyframeRef | null
  onSelectKeyframe: (ref: SelectedKeyframeRef | null) => void
  onToggleAutoKeyframe: () => void
  onUpdate: (layerId: string, updater: (layer: Layer) => Layer) => void
  onDelete: (layerId: string) => void
}

export function LayerInspector({
  layer,
  layerId,
  projectWidth,
  projectHeight,
  currentTime,
  autoKeyframe,
  selectedKeyframe,
  onSelectKeyframe,
  onToggleAutoKeyframe,
  onUpdate,
  onDelete,
}: LayerInspectorProps) {
  const [flowEditorOpen, setFlowEditorOpen] = useState(false)

  if (!layer || !layerId) {
    return (
      <div className="layer-inspector layer-inspector-empty">
        <p>Select a clip on the timeline to edit properties.</p>
      </div>
    )
  }

  const patch = (updater: (layer: Layer) => Layer) => onUpdate(layerId, updater)
  const localTime = Math.max(0, Math.min(layer.duration, currentTime - layer.start))
  const inClip = currentTime >= layer.start && currentTime <= layer.start + layer.duration
  const textStyle =
    layer.type === 'title' || layer.type === 'overlay' ? layer.style : undefined

  const patchAuto = (
    updater: (layer: Layer) => Layer,
    autoProps?: { property: KeyframeProperty; getValue: (layer: Layer) => KeyframeValue }[],
  ) => {
    patch((current) => {
      let next = updater(current)
      if (autoKeyframe && inClip && autoProps) {
        for (const { property, getValue } of autoProps) {
          next = maybeAutoKeyframeLayer(next, property, localTime, getValue(next), true)
        }
      }
      return next
    })
  }

  return (
    <div className="layer-inspector">
      <div className="inspector-header">
        <h3>Layer properties</h3>
        <span className="inspector-type">{layer.type}</span>
      </div>

      {(layer.type === 'image' || layer.type === 'video' || layer.type === 'audio') && (
        <InspectorSection title="Source">
          <Field
            label={
              layer.type === 'audio'
                ? 'Audio file'
                : layer.type === 'video'
                  ? 'Video file'
                  : 'Image file'
            }
          >
            <input
              type="text"
              className="inspector-input"
              value={layer.src}
              placeholder={
                layer.type === 'audio'
                  ? 'path/to/file.mp3 or URL'
                  : layer.type === 'video'
                    ? 'path/to/clip.mp4 or URL'
                    : 'path/to/image.jpg or URL'
              }
              onChange={(e) =>
                patch((l) =>
                  l.type === 'image' || l.type === 'video' || l.type === 'audio'
                    ? { ...l, src: e.target.value }
                    : l,
                )
              }
            />
          </Field>
          {(layer.type === 'image' || layer.type === 'video') && (
            <Field label="Fit">
              <select
                className="inspector-select"
                value={layer.fit ?? 'cover'}
                onChange={(e) =>
                  patch((l) =>
                    l.type === 'image' || l.type === 'video'
                      ? { ...l, fit: e.target.value as 'cover' | 'contain' | 'fill' }
                      : l,
                  )
                }
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
              </select>
            </Field>
          )}
          {layer.type === 'video' && (
            <>
              <Field label="Trim start (s)">
                <input
                  type="number"
                  className="inspector-input"
                  min={0}
                  step={0.1}
                  value={layer.trimStart ?? 0}
                  onChange={(e) =>
                    patch((l) =>
                      l.type === 'video'
                        ? { ...l, trimStart: Number(e.target.value) }
                        : l,
                    )
                  }
                />
              </Field>
              <Field label="Trim end (s)">
                <input
                  type="number"
                  className="inspector-input"
                  min={0}
                  step={0.1}
                  value={layer.trimEnd ?? ''}
                  placeholder="auto"
                  onChange={(e) =>
                    patch((l) =>
                      l.type === 'video'
                        ? {
                            ...l,
                            trimEnd: e.target.value === '' ? undefined : Number(e.target.value),
                          }
                        : l,
                    )
                  }
                />
              </Field>
              <Field label="Playback rate">
                <input
                  type="number"
                  className="inspector-input"
                  min={0.1}
                  step={0.1}
                  value={layer.playbackRate ?? 1}
                  onChange={(e) =>
                    patch((l) =>
                      l.type === 'video'
                        ? { ...l, playbackRate: Number(e.target.value) }
                        : l,
                    )
                  }
                />
              </Field>
              <Field label="Loop">
                <label className="inspector-checkbox">
                  <input
                    type="checkbox"
                    checked={layer.loop ?? false}
                    onChange={(e) =>
                      patch((l) =>
                        l.type === 'video' ? { ...l, loop: e.target.checked } : l,
                      )
                    }
                  />
                  Loop clip
                </label>
              </Field>
            </>
          )}
          {layer.type === 'audio' && (
            <Field label="Volume">
              <div className="inspector-range-row">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={layer.volume ?? 1}
                  onChange={(e) =>
                    patch((l) =>
                      l.type === 'audio'
                        ? { ...l, volume: Number(e.target.value) }
                        : l,
                    )
                  }
                />
                <span className="inspector-range-value">{(layer.volume ?? 1).toFixed(2)}</span>
              </div>
            </Field>
          )}
        </InspectorSection>
      )}

      {layer.type === 'overlay' && (
        <InspectorSection title="Overlay">
          <Field label="Type">
            <select
              className="inspector-select"
              value={layer.overlayType}
              onChange={(e) =>
                patch((l) =>
                  l.type === 'overlay'
                    ? {
                        ...l,
                        overlayType: e.target.value as 'text' | 'image' | 'shape',
                      }
                    : l,
                )
              }
            >
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="shape">Shape</option>
            </select>
          </Field>
          {layer.overlayType === 'image' && (
            <Field label="Image src">
              <input
                type="text"
                className="inspector-input"
                value={layer.src ?? ''}
                onChange={(e) =>
                  patch((l) => (l.type === 'overlay' ? { ...l, src: e.target.value } : l))
                }
              />
            </Field>
          )}
          {layer.overlayType === 'shape' && (
            <Field label="Shape">
              <select
                className="inspector-select"
                value={layer.shape ?? 'rectangle'}
                onChange={(e) =>
                  patch((l) =>
                    l.type === 'overlay'
                      ? { ...l, shape: e.target.value as 'rectangle' | 'circle' }
                      : l,
                  )
                }
              >
                <option value="rectangle">Rectangle</option>
                <option value="circle">Circle</option>
              </select>
            </Field>
          )}
        </InspectorSection>
      )}

      <InspectorSection title="Timing">
        <Field label="Start (s)">
          <input
            type="number"
            className="inspector-input"
            step={0.1}
            min={0}
            value={layer.start}
            onChange={(e) =>
              patch((l) => ({ ...l, start: Math.max(0, Number(e.target.value)) }))
            }
          />
        </Field>
        <Field label="Duration (s)">
          <input
            type="number"
            className="inspector-input"
            step={0.1}
            min={0.1}
            value={layer.duration}
            onChange={(e) =>
              patch((l) => ({ ...l, duration: Math.max(0.1, Number(e.target.value)) }))
            }
          />
        </Field>
      </InspectorSection>

      {layer.type !== 'audio' && (
        <InspectorSection title="Transform">
          <Field label="Opacity">
            <div className="inspector-range-row">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={layer.opacity ?? 1}
                onChange={(e) =>
                  patchAuto(
                    (l) => ({ ...l, opacity: Number(e.target.value) }),
                    [{ property: 'opacity', getValue: (l) => l.opacity ?? 1 }],
                  )
                }
              />
              <span className="inspector-range-value">{(layer.opacity ?? 1).toFixed(2)}</span>
            </div>
          </Field>
          <Field label="X">
            <input
              type="number"
              className="inspector-input"
              value={layer.x ?? 0}
              onChange={(e) =>
                patchAuto(
                  (l) => ({ ...l, x: Number(e.target.value) }),
                  [{ property: 'x', getValue: (l) => l.x ?? 0 }],
                )
              }
            />
          </Field>
          <Field label="Y">
            <input
              type="number"
              className="inspector-input"
              value={layer.y ?? 0}
              onChange={(e) =>
                patchAuto(
                  (l) => ({ ...l, y: Number(e.target.value) }),
                  [{ property: 'y', getValue: (l) => l.y ?? 0 }],
                )
              }
            />
          </Field>
          <Field label="Width">
            <input
              type="number"
              className="inspector-input"
              min={0}
              value={layer.width ?? 0}
              onChange={(e) =>
                patchAuto(
                  (l) => ({ ...l, width: Number(e.target.value) }),
                  [{ property: 'width', getValue: (l) => l.width ?? 0 }],
                )
              }
            />
          </Field>
          <Field label="Height">
            <input
              type="number"
              className="inspector-input"
              min={0}
              value={layer.height ?? 0}
              onChange={(e) =>
                patchAuto(
                  (l) => ({ ...l, height: Number(e.target.value) }),
                  [{ property: 'height', getValue: (l) => l.height ?? 0 }],
                )
              }
            />
          </Field>
          <Field label="Rotation">
            <input
              type="number"
              className="inspector-input"
              value={layer.rotation ?? 0}
              onChange={(e) =>
                patchAuto(
                  (l) => ({ ...l, rotation: Number(e.target.value) }),
                  [{ property: 'rotation', getValue: (l) => l.rotation ?? 0 }],
                )
              }
            />
          </Field>
        </InspectorSection>
      )}

      {(layer.type === 'title' || (layer.type === 'overlay' && layer.overlayType === 'text')) && (
        <InspectorSection title="Text">
          <Field label="Content">
            <input
              type="text"
              className="inspector-input"
              value={layer.type === 'title' ? layer.text : (layer.text ?? '')}
              onChange={(e) =>
                patch((l) => {
                  if (l.type === 'title') return { ...l, text: e.target.value }
                  if (l.type === 'overlay') return { ...l, text: e.target.value }
                  return l
                })
              }
            />
          </Field>
          <Field label="Color">
            <div className="color-field">
              <input
                type="color"
                value={normalizeColor(textStyle?.color ?? '#ffffff')}
                onChange={(e) =>
                  patchAuto(
                    (l) =>
                      l.type === 'title' || l.type === 'overlay'
                        ? { ...l, style: { ...l.style, color: e.target.value } }
                        : l,
                    [{ property: 'color', getValue: (l) => (l.type === 'title' || l.type === 'overlay' ? l.style?.color ?? '#ffffff' : '#ffffff') }],
                  )
                }
              />
              <input
                type="text"
                className="inspector-input"
                value={textStyle?.color ?? '#ffffff'}
                onChange={(e) =>
                  patchAuto(
                    (l) =>
                      l.type === 'title' || l.type === 'overlay'
                        ? { ...l, style: { ...l.style, color: e.target.value } }
                        : l,
                    [{ property: 'color', getValue: (l) => (l.type === 'title' || l.type === 'overlay' ? l.style?.color ?? '#ffffff' : '#ffffff') }],
                  )
                }
              />
            </div>
          </Field>
          <Field label="Font size">
            <input
              type="number"
              className="inspector-input"
              min={8}
              value={textStyle?.fontSize ?? 48}
              onChange={(e) =>
                patchAuto(
                  (l) =>
                    l.type === 'title' || l.type === 'overlay'
                      ? { ...l, style: { ...l.style, fontSize: Number(e.target.value) } }
                      : l,
                  [{ property: 'fontSize', getValue: (l) => (l.type === 'title' || l.type === 'overlay' ? l.style?.fontSize ?? 48 : 48) }],
                )
              }
            />
          </Field>
          <Field label="Background">
            <input
              type="text"
              className="inspector-input"
              value={
                layer.type === 'overlay'
                  ? (layer.style?.backgroundColor ?? '')
                  : ''
              }
              placeholder="rgba(0,0,0,0.5)"
              disabled={layer.type !== 'overlay'}
              onChange={(e) =>
                patchAuto(
                  (l) =>
                    l.type === 'overlay'
                      ? {
                          ...l,
                          style: {
                            ...l.style,
                            backgroundColor: e.target.value || undefined,
                          },
                        }
                      : l,
                  [{ property: 'backgroundColor', getValue: (l) => (l.type === 'overlay' ? l.style?.backgroundColor ?? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.5)') }],
                )
              }
            />
          </Field>
        </InspectorSection>
      )}

      <InspectorSection title="Transition">
        <Field label="In">
          <select
            className="inspector-select"
            value={layer.transition?.in ?? ''}
            onChange={(e) =>
              patch((l) => ({
                ...l,
                transition: {
                  ...l.transition,
                  in: (e.target.value || undefined) as TransitionType | undefined,
                },
              }))
            }
          >
            <option value="">None</option>
            {TRANSITIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Out">
          <select
            className="inspector-select"
            value={layer.transition?.out ?? ''}
            onChange={(e) =>
              patch((l) => ({
                ...l,
                transition: {
                  ...l.transition,
                  out: (e.target.value || undefined) as TransitionType | undefined,
                },
              }))
            }
          >
            <option value="">None</option>
            {TRANSITIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duration (s)">
          <input
            type="number"
            className="inspector-input"
            step={0.1}
            min={0}
            value={layer.transition?.duration ?? 0.5}
            onChange={(e) =>
              patch((l) => ({
                ...l,
                transition: { ...l.transition, duration: Number(e.target.value) },
              }))
            }
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Animation">
        <Field label="In">
          <select
            className="inspector-select"
            value={layer.animation?.in ?? ''}
            onChange={(e) =>
              patch((l) => ({
                ...l,
                animation: {
                  ...l.animation,
                  in: (e.target.value || undefined) as AnimationType | undefined,
                },
              }))
            }
          >
            <option value="">None</option>
            {ANIMATIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Out">
          <select
            className="inspector-select"
            value={layer.animation?.out ?? ''}
            onChange={(e) =>
              patch((l) => ({
                ...l,
                animation: {
                  ...l.animation,
                  out: (e.target.value || undefined) as AnimationType | undefined,
                },
              }))
            }
          >
            <option value="">None</option>
            {ANIMATIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duration (s)">
          <input
            type="number"
            className="inspector-input"
            step={0.1}
            min={0}
            value={layer.animation?.duration ?? 0.6}
            onChange={(e) =>
              patch((l) => ({
                ...l,
                animation: { ...l.animation, duration: Number(e.target.value) },
              }))
            }
          />
        </Field>
      </InspectorSection>

      {layer.type === 'flow' && (
        <InspectorSection title="Flow diagram">
          <Field label="Default style">
            <select
              className="inspector-select"
              value={layer.defaultNodeStyle ?? 'step'}
              onChange={(e) =>
                patch((l) =>
                  l.type === 'flow'
                    ? { ...l, defaultNodeStyle: e.target.value as 'step' | 'card' | 'n8n' }
                    : l,
                )
              }
            >
              <option value="step">Step (numbered circles)</option>
              <option value="card">Card (badge + label)</option>
              <option value="n8n">n8n (automation node)</option>
            </select>
          </Field>
          <Field label="Animation">
            <select
              className="inspector-select"
              value={layer.flowAnimation?.mode ?? 'sequential'}
              onChange={(e) =>
                patch((l) =>
                  l.type === 'flow'
                    ? {
                        ...l,
                        flowAnimation: {
                          ...l.flowAnimation,
                          mode: e.target.value as 'sequential' | 'parallel' | 'instant',
                        },
                      }
                    : l,
                )
              }
            >
              <option value="sequential">Sequential draw</option>
              <option value="parallel">Parallel stagger</option>
              <option value="instant">Instant</option>
            </select>
          </Field>
          <Field label="Step delay">
            <input
              type="number"
              className="inspector-input"
              step={0.05}
              min={0}
              value={layer.flowAnimation?.stepDelay ?? 0.35}
              onChange={(e) =>
                patch((l) =>
                  l.type === 'flow'
                    ? {
                        ...l,
                        flowAnimation: { ...l.flowAnimation, stepDelay: Number(e.target.value) },
                      }
                    : l,
                )
              }
            />
          </Field>
          <Field label="Line draw">
            <input
              type="number"
              className="inspector-input"
              step={0.05}
              min={0}
              value={layer.flowAnimation?.lineDuration ?? 0.35}
              onChange={(e) =>
                patch((l) =>
                  l.type === 'flow'
                    ? {
                        ...l,
                        flowAnimation: { ...l.flowAnimation, lineDuration: Number(e.target.value) },
                      }
                    : l,
                )
              }
            />
          </Field>
          <Field label="Node pop">
            <input
              type="number"
              className="inspector-input"
              step={0.05}
              min={0}
              value={layer.flowAnimation?.nodeDuration ?? 0.3}
              onChange={(e) =>
                patch((l) =>
                  l.type === 'flow'
                    ? {
                        ...l,
                        flowAnimation: { ...l.flowAnimation, nodeDuration: Number(e.target.value) },
                      }
                    : l,
                )
              }
            />
          </Field>
          <Field label="Highlight active">
            <label className="inspector-checkbox">
              <input
                type="checkbox"
                checked={layer.flowAnimation?.highlightActive !== false}
                onChange={(e) =>
                  patch((l) =>
                    l.type === 'flow'
                      ? {
                          ...l,
                          flowAnimation: {
                            ...l.flowAnimation,
                            highlightActive: e.target.checked,
                          },
                        }
                      : l,
                  )
                }
              />
              <span>Dim previous steps while animating</span>
            </label>
          </Field>
          <div className="flow-inspector-actions">
            <p className="flow-inspector-hint">
              {layer.nodes.length} nodes · {layer.edges.length} edges
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFlowEditorOpen(true)
                analytics.flowEditorOpened(layer.nodes.length, layer.edges.length)
              }}
            >
              Edit flow…
            </button>
          </div>
        </InspectorSection>
      )}

      {layer.type === 'flow' && (
        <FlowEditorModal
          open={flowEditorOpen}
          onClose={() => setFlowEditorOpen(false)}
          layer={layer}
          layerLabel={layer.nodes.length === 1 ? layer.nodes[0].label : `${layer.nodes.length} nodes`}
          canvasWidth={projectWidth}
          canvasHeight={projectHeight}
          onUpdate={(updater) =>
            patch((current) => (current.type === 'flow' ? updater(current) : current))
          }
        />
      )}

      {layer.type !== 'audio' && layer.type !== 'flow' && (
        <InspectorSection title="Keyframes">
          <KeyframeEditor
            layer={layer}
            layerId={layerId}
            currentTime={currentTime}
            autoKeyframe={autoKeyframe}
            selectedKeyframe={selectedKeyframe}
            onSelectKeyframe={onSelectKeyframe}
            onToggleAutoKeyframe={onToggleAutoKeyframe}
            onUpdate={(updater) => patch(updater)}
          />
        </InspectorSection>
      )}

      <div className="inspector-actions">
        <button
          type="button"
          className="btn btn-ghost btn-delete-layer"
          onClick={() => onDelete(layerId)}
        >
          Delete layer
        </button>
      </div>
    </div>
  )
}

const TRANSITIONS: TransitionType[] = [
  'fade',
  'slideLeft',
  'slideRight',
  'slideUp',
  'slideDown',
  'zoomIn',
  'zoomOut',
  'wipeLeft',
  'wipeRight',
]

const ANIMATIONS: AnimationType[] = [
  'fadeIn',
  'fadeOut',
  'slideInLeft',
  'slideInRight',
  'slideInUp',
  'slideInDown',
  'scaleIn',
  'scaleOut',
  'bounce',
]

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="inspector-section" open>
      <summary>{title}</summary>
      <div className="inspector-fields">{children}</div>
    </details>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function normalizeColor(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const c = color.slice(1)
    return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`
  }
  return '#ffffff'
}
