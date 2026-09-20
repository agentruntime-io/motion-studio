import type { EasingType, KeyframeTrack } from '../types/project'
import { sampleEasingCurve } from '../engine/keyframeEngine'
import { KEYFRAME_PROPERTY_COLORS, KEYFRAME_PROPERTY_LABELS } from '../lib/keyframes'

interface KeyframeGraphProps {
  track: KeyframeTrack
  duration: number
  selectedTime?: number
  onSelectTime?: (time: number) => void
}

export function KeyframeGraph({ track, duration, selectedTime, onSelectTime }: KeyframeGraphProps) {
  const keyframes = [...track.keyframes].sort((a, b) => a.t - b.t)
  if (keyframes.length === 0) return null

  const numericValues = keyframes.map((kf) => Number(kf.value))
  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const valueSpan = Math.max(maxValue - minValue, 0.001)

  const width = 280
  const height = 72
  const pad = 8

  const points = keyframes.map((kf) => {
    const x = pad + (kf.t / Math.max(duration, 0.001)) * (width - pad * 2)
    const y = height - pad - ((Number(kf.value) - minValue) / valueSpan) * (height - pad * 2)
    return { x, y, kf }
  })

  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="keyframe-graph">
      <div className="keyframe-graph-header">
        <span style={{ color: KEYFRAME_PROPERTY_COLORS[track.property] }}>
          {KEYFRAME_PROPERTY_LABELS[track.property]}
        </span>
        <span className="keyframe-graph-range">
          {minValue.toFixed(2)} – {maxValue.toFixed(2)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="keyframe-graph-svg"
        onClick={(event) => {
          if (!onSelectTime) return
          const rect = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - rect.left
          const ratio = (x - pad) / (width - pad * 2)
          onSelectTime(Math.max(0, Math.min(duration, ratio * duration)))
        }}
      >
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        {[0.25, 0.5, 0.75].map((mark) => (
          <line
            key={mark}
            x1={pad + mark * (width - pad * 2)}
            x2={pad + mark * (width - pad * 2)}
            y1={pad}
            y2={height - pad}
            stroke="rgba(255,255,255,0.08)"
          />
        ))}
        {points.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke={KEYFRAME_PROPERTY_COLORS[track.property]}
            strokeWidth={2}
          />
        )}
        {points.map((point) => (
          <g key={`${track.property}-${point.kf.t}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={selectedTime !== undefined && Math.abs(selectedTime - point.kf.t) < 0.05 ? 6 : 4}
              fill={KEYFRAME_PROPERTY_COLORS[track.property]}
              stroke="#fff"
              strokeWidth={1}
            />
          </g>
        ))}
      </svg>
      {keyframes.map((kf) => (
        <div key={`${track.property}-ease-${kf.t}`} className="keyframe-easing-row">
          <EasingPreview easing={kf.easing ?? 'easeInOut'} />
          <span>t={kf.t.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

function EasingPreview({ easing }: { easing: EasingType }) {
  return (
    <svg viewBox="0 0 40 20" className="easing-preview" aria-hidden>
      <polyline
        points={sampleEasingCurve(easing)}
        fill="none"
        stroke="#4fd1c5"
        strokeWidth={1.5}
      />
    </svg>
  )
}
