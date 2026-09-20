import type { EasingType, KeyframeProperty, KeyframeValue, Layer, SelectedKeyframeRef } from '../types/project'
import {
  getAvailableKeyframeProperties,
  getLayerKeyframes,
  isNumericKeyframeProperty,
  KEYFRAME_PROPERTY_LABELS,
  removeKeyframe,
  scaleKeyframesToDuration,
  upsertKeyframe,
} from '../lib/keyframes'
import { getKeyframeValueAtTime } from '../engine/keyframeEngine'
import { KEYFRAME_PRESETS } from '../lib/keyframePresets'
import { KeyframeGraph } from './KeyframeGraph'

interface KeyframeEditorProps {
  layer: Layer
  layerId: string
  currentTime: number
  autoKeyframe: boolean
  selectedKeyframe: SelectedKeyframeRef | null
  onSelectKeyframe: (ref: SelectedKeyframeRef | null) => void
  onToggleAutoKeyframe: () => void
  onUpdate: (updater: (layer: Layer) => Layer) => void
}

const EASING_OPTIONS: EasingType[] = ['linear', 'easeIn', 'easeOut', 'easeInOut']

export function KeyframeEditor({
  layer,
  layerId,
  currentTime,
  autoKeyframe,
  selectedKeyframe,
  onSelectKeyframe,
  onToggleAutoKeyframe,
  onUpdate,
}: KeyframeEditorProps) {
  if (layer.type === 'audio') return null

  const keyframes = getLayerKeyframes(layer)
  const localTime = Math.max(0, Math.min(layer.duration, currentTime - layer.start))
  const inClip = currentTime >= layer.start && currentTime <= layer.start + layer.duration
  const keyframeCount = keyframes?.tracks.reduce((sum, track) => sum + track.keyframes.length, 0) ?? 0
  const properties = getAvailableKeyframeProperties(layer)

  const patch = (updater: (layer: Layer) => Layer) => onUpdate(updater)

  const applyPreset = (presetId: string) => {
    const preset = KEYFRAME_PRESETS.find((item) => item.id === presetId)
    if (!preset) return

    patch((current) => {
      if (preset.keyframes.tracks.length === 0) {
        const { keyframes: _k, ...rest } = current
        return rest
      }
      return {
        ...current,
        keyframes: scaleKeyframesToDuration(preset.keyframes, current.duration),
      }
    })
  }

  const addKeyframeAtPlayhead = (property: KeyframeProperty, value?: KeyframeValue) => {
    if (!inClip) return
    patch((current) => {
      const currentData = getLayerKeyframes(current)
      const next = upsertKeyframe(currentData, property, {
        t: localTime,
        value: value ?? getKeyframeValueAtTime(current, property, localTime),
        easing: 'easeInOut',
      })
      return { ...current, keyframes: next }
    })
    onSelectKeyframe({ layerId, property, t: localTime })
  }

  const addAllAtPlayhead = () => {
    properties.forEach((property) => addKeyframeAtPlayhead(property))
  }

  const deleteKeyframe = (property: KeyframeProperty, time: number) => {
    patch((current) => {
      const next = removeKeyframe(getLayerKeyframes(current), property, time)
      if (!next) {
        const { keyframes: _k, ...rest } = current
        return rest
      }
      return { ...current, keyframes: next }
    })
    if (
      selectedKeyframe?.layerId === layerId &&
      selectedKeyframe.property === property &&
      Math.abs(selectedKeyframe.t - time) < 0.05
    ) {
      onSelectKeyframe(null)
    }
  }

  return (
    <div className="keyframe-editor">
      <div className="keyframe-toolbar">
        <button
          type="button"
          className="btn btn-primary btn-keyframe-add"
          disabled={!inClip}
          title="Add keyframes for all properties at playhead (K)"
          onClick={addAllAtPlayhead}
        >
          + Keyframe {inClip ? `@ ${localTime.toFixed(2)}s` : ''}
        </button>
        <button
          type="button"
          className={`auto-keyframe-badge ${autoKeyframe ? 'on' : ''}`}
          title="Toggle auto-keyframe mode"
          onClick={onToggleAutoKeyframe}
        >
          Auto-key {autoKeyframe ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="keyframe-presets">
        {KEYFRAME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`keyframe-preset ${keyframes?.name === preset.keyframes.name ? 'selected' : ''} ${preset.id === 'none' ? 'keyframe-preset-clear' : ''}`}
            title={preset.label}
            onClick={() => applyPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="keyframe-meta">
        <span>{keyframes?.name ?? 'Custom keyframes'}</span>
        <span>{keyframeCount} keyframe{keyframeCount === 1 ? '' : 's'}</span>
      </div>

      {keyframes?.tracks.map((track) => (
        <div key={track.property} className="keyframe-track">
          <div className="keyframe-track-header">
            <span>{KEYFRAME_PROPERTY_LABELS[track.property]}</span>
            <button
              type="button"
              className="btn btn-ghost btn-keyframe-add"
              disabled={!inClip}
              onClick={() => addKeyframeAtPlayhead(track.property)}
            >
              + KF
            </button>
          </div>

          <KeyframeGraph
            track={track}
            duration={layer.duration}
            selectedTime={
              selectedKeyframe?.layerId === layerId && selectedKeyframe.property === track.property
                ? selectedKeyframe.t
                : undefined
            }
            onSelectTime={(time) => onSelectKeyframe({ layerId, property: track.property, t: time })}
          />

          <div className="keyframe-keyframe-list">
            {[...track.keyframes]
              .sort((a, b) => a.t - b.t)
              .map((keyframe) => {
                const selected =
                  selectedKeyframe?.layerId === layerId &&
                  selectedKeyframe.property === track.property &&
                  Math.abs(selectedKeyframe.t - keyframe.t) < 0.05

                return (
                  <div
                    key={`${track.property}-${keyframe.t}`}
                    className={`keyframe-keyframe-row ${selected ? 'selected' : ''}`}
                    onClick={() => onSelectKeyframe({ layerId, property: track.property, t: keyframe.t })}
                  >
                    <input
                      type="number"
                      className="inspector-input"
                      step={0.05}
                      min={0}
                      max={layer.duration}
                      value={keyframe.t}
                      onChange={(e) =>
                        patch((current) => {
                          const next = removeKeyframe(getLayerKeyframes(current), track.property, keyframe.t)
                          return {
                            ...current,
                            keyframes: upsertKeyframe(next, track.property, {
                              ...keyframe,
                              t: Math.max(0, Math.min(layer.duration, Number(e.target.value))),
                            }),
                          }
                        })
                      }
                    />
                    {isNumericKeyframeProperty(track.property) ? (
                      <input
                        type="number"
                        className="inspector-input"
                        step={track.property === 'opacity' || track.property === 'scale' ? 0.01 : 1}
                        value={Number(keyframe.value)}
                        onChange={(e) =>
                          patch((current) => ({
                            ...current,
                            keyframes: upsertKeyframe(getLayerKeyframes(current), track.property, {
                              ...keyframe,
                              value: Number(e.target.value),
                            }),
                          }))
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        className="inspector-input"
                        value={String(keyframe.value)}
                        onChange={(e) =>
                          patch((current) => ({
                            ...current,
                            keyframes: upsertKeyframe(getLayerKeyframes(current), track.property, {
                              ...keyframe,
                              value: e.target.value,
                            }),
                          }))
                        }
                      />
                    )}
                    <select
                      className="inspector-select"
                      value={keyframe.easing ?? 'easeInOut'}
                      onChange={(e) =>
                        patch((current) => ({
                          ...current,
                          keyframes: upsertKeyframe(getLayerKeyframes(current), track.property, {
                            ...keyframe,
                            easing: e.target.value as EasingType,
                          }),
                        }))
                      }
                    >
                      {EASING_OPTIONS.map((easing) => (
                        <option key={easing} value={easing}>
                          {easing}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost btn-keyframe-delete"
                      title="Delete keyframe"
                      onClick={(event) => {
                        event.stopPropagation()
                        deleteKeyframe(track.property, keyframe.t)
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
          </div>
        </div>
      ))}

      <div className="keyframe-add-track">
        <span>Add property</span>
        <div className="keyframe-add-track-buttons">
          {properties.map((property) => (
            <button
              key={property}
              type="button"
              className="btn btn-ghost btn-keyframe-add"
              disabled={!inClip}
              title={`Add ${KEYFRAME_PROPERTY_LABELS[property]} keyframe at playhead`}
              onClick={() => addKeyframeAtPlayhead(property)}
            >
              {KEYFRAME_PROPERTY_LABELS[property]}
            </button>
          ))}
        </div>
      </div>

      {!keyframes?.tracks.length && (
        <p className="keyframe-hint">
          Pick a preset or press <strong>K</strong> / <strong>+ Keyframe</strong> while the playhead is
          inside this clip.
        </p>
      )}
    </div>
  )
}

export function maybeAutoKeyframeLayer(
  layer: Layer,
  property: KeyframeProperty,
  localTime: number,
  value: KeyframeValue,
  enabled: boolean,
): Layer {
  if (!enabled || layer.type === 'audio') return layer
  const next = upsertKeyframe(getLayerKeyframes(layer), property, {
    t: localTime,
    value,
    easing: 'easeInOut',
  })
  return { ...layer, keyframes: next }
}
