import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { VideoProject } from '../types/project'

export interface PreviewPlayerHandle {
  getCanvas: () => HTMLCanvasElement | null
}

interface PreviewPlayerProps {
  project: VideoProject
  ready: boolean
  renderFrame: (ctx: CanvasRenderingContext2D, time: number) => void
  onTimeChange?: (time: number) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

export const PreviewPlayer = forwardRef<PreviewPlayerHandle, PreviewPlayerProps>(
  function PreviewPlayer({ project, ready, renderFrame, onTimeChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const rafRef = useRef<number>(0)
    const lastTickRef = useRef<number>(0)

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
    }))

    const draw = useCallback(
      (time: number) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        renderFrame(ctx, time)
      },
      [renderFrame],
    )

    useEffect(() => {
      draw(currentTime)
    }, [currentTime, draw, ready])

    useEffect(() => {
      if (!playing || !ready) return

      lastTickRef.current = performance.now()

      const tick = (now: number) => {
        const delta = (now - lastTickRef.current) / 1000
        lastTickRef.current = now

        setCurrentTime((prev) => {
          const next = prev + delta
          if (next >= project.duration) {
            setPlaying(false)
            return project.duration
          }
          return next
        })

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(rafRef.current)
    }, [playing, ready, project.duration])

    useEffect(() => {
      onTimeChange?.(currentTime)
    }, [currentTime, onTimeChange])

    const togglePlay = () => {
      if (currentTime >= project.duration) {
        setCurrentTime(0)
      }
      setPlaying((p) => !p)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentTime(Number(e.target.value))
      setPlaying(false)
    }

    const scale = Math.min(1, 900 / project.width)

    return (
      <div className="preview-player">
        <div
          className="preview-frame"
          style={{ width: project.width * scale, height: project.height * scale }}
        >
          <canvas
            ref={canvasRef}
            width={project.width}
            height={project.height}
            style={{ width: '100%', height: '100%' }}
          />
          {!ready && <div className="preview-loading">Loading assets...</div>}
        </div>

        <div className="preview-controls">
          <button type="button" className="btn btn-primary" onClick={togglePlay} disabled={!ready}>
            {playing ? 'Pause' : currentTime >= project.duration ? 'Replay' : 'Play'}
          </button>
          <input
            type="range"
            min={0}
            max={project.duration}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="timeline-slider"
          />
          <span className="time-display">
            {formatTime(currentTime)} / {formatTime(project.duration)}
          </span>
        </div>
      </div>
    )
  },
)
