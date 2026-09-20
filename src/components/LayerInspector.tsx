import type { Layer } from '../types/project'
import type { TransitionType, AnimationType } from '../types/project'

interface LayerInspectorProps {
  layer: Layer | null
  layerId: string | null
  onUpdate: (layerId: string, updater: (layer: Layer) => Layer) => void
  onDelete: (layerId: string) => void
}

export function LayerInspector({ layer, layerId, onUpdate, onDelete }: LayerInspectorProps) {
  if (!layer || !layerId) {
    return (
      <div className="layer-inspector layer-inspector-empty">
        <p>Select a clip on the timeline to edit properties.</p>
      </div>
    )
  }

  const patch = (updater: (layer: Layer) => Layer) => onUpdate(layerId, updater)
  const textStyle =
    layer.type === 'title' || layer.type === 'overlay' ? layer.style : undefined

  return (
    <div className="layer-inspector">
      <div className="inspector-header">
        <h3>Layer properties</h3>
        <span className="inspector-type">{layer.type}</span>
      </div>

      {(layer.type === 'image' || layer.type === 'audio') && (
        <InspectorSection title="Source">
          <Field label={layer.type === 'audio' ? 'Audio file' : 'Image / video'}>
            <input
              type="text"
              className="inspector-input"
              value={layer.src}
              placeholder="path/to/file.mp3 or URL"
              onChange={(e) =>
                patch((l) =>
                  l.type === 'image' || l.type === 'audio'
                    ? { ...l, src: e.target.value }
                    : l,
                )
              }
            />
          </Field>
          {layer.type === 'image' && (
            <Field label="Fit">
              <select
                className="inspector-select"
                value={layer.fit ?? 'cover'}
                onChange={(e) =>
                  patch((l) =>
                    l.type === 'image'
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
                  patch((l) =>
                    l.type === 'title' || l.type === 'overlay'
                      ? { ...l, style: { ...l.style, color: e.target.value } }
                      : l,
                  )
                }
              />
              <input
                type="text"
                className="inspector-input"
                value={textStyle?.color ?? '#ffffff'}
                onChange={(e) =>
                  patch((l) =>
                    l.type === 'title' || l.type === 'overlay'
                      ? { ...l, style: { ...l.style, color: e.target.value } }
                      : l,
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
                patch((l) =>
                  l.type === 'title' || l.type === 'overlay'
                    ? { ...l, style: { ...l.style, fontSize: Number(e.target.value) } }
                    : l,
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
                patch((l) =>
                  l.type === 'overlay'
                    ? {
                        ...l,
                        style: {
                          ...l.style,
                          backgroundColor: e.target.value || undefined,
                        },
                      }
                    : l,
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
