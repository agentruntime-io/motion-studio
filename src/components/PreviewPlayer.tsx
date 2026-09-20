import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { VideoProject } from '../types/project'

export interface PreviewPlayerHandle {
  getCanvas: () => HTMLCanvasElement | null
}

interface PreviewPlayerProps {
  project: VideoProject
  ready: boolean
  renderFrame: (ctx: CanvasRenderingContext2D, time: number) => void
  prerenderUrl?: string | null
  usePrerenderPreview?: boolean
  currentTime?: number
  onCurrentTimeChange?: (time: number) => void
  onTimeChange?: (time: number) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

export const PreviewPlayer = forwardRef<PreviewPlayerHandle, PreviewPlayerProps>(
  function PreviewPlayer(
    {
      project,
      ready,
      renderFrame,
      prerenderUrl,
      usePrerenderPreview,
      currentTime: controlledTime,
      onCurrentTimeChange,
      onTimeChange,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [playing, setPlaying] = useState(false)
    const [internalTime, setInternalTime] = useState(0)
    const rafRef = useRef<number>(0)
    const lastTickRef = useRef<number>(0)
    const timeRef = useRef(0)
    const useVideo = Boolean(usePrerenderPreview && prerenderUrl)

    const currentTime = controlledTime ?? internalTime
    timeRef.current = currentTime

    const setCurrentTime = useCallback(
      (value: number | ((prev: number) => number)) => {
        const next = typeof value === 'function' ? value(timeRef.current) : value
        timeRef.current = next
        onCurrentTimeChange?.(next)
        if (controlledTime === undefined) setInternalTime(next)
      },
      [controlledTime, onCurrentTimeChange],
    )

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

    const syncVideoTime = useCallback((time: number) => {
      const video = videoRef.current
      if (!video || !useVideo) return
      if (Math.abs(video.currentTime - time) > 0.05) {
        video.currentTime = time
      }
    }, [useVideo])

    useEffect(() => {
      if (useVideo) {
        syncVideoTime(currentTime)
      } else {
        draw(currentTime)
      }
    }, [currentTime, draw, ready, syncVideoTime, useVideo])

    useEffect(() => {
      setPlaying(false)
      setCurrentTime(0)
    }, [prerenderUrl, usePrerenderPreview])

    useEffect(() => {
      const video = videoRef.current
      if (!video || !useVideo) return

      if (playing) {
        syncVideoTime(currentTime)
        void video.play().catch(() => setPlaying(false))
      } else {
        video.pause()
        syncVideoTime(currentTime)
      }
    }, [playing, useVideo, syncVideoTime, currentTime])

    useEffect(() => {
      if (!playing || useVideo || !ready) return

      lastTickRef.current = performance.now()

      const tick = (now: number) => {
        const delta = (now - lastTickRef.current) / 1000
        lastTickRef.current = now

        const next = timeRef.current + delta
        if (next >= project.duration) {
          setPlaying(false)
          setCurrentTime(project.duration)
          return
        }

        setCurrentTime(next)
        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(rafRef.current)
    }, [playing, ready, project.duration, setCurrentTime, useVideo])

    useEffect(() => {
      const video = videoRef.current
      if (!video || !useVideo || !playing) return

      const onTimeUpdate = () => {
        const time = video.currentTime
        setCurrentTime(time)
        if (time >= project.duration - 0.05) {
          setPlaying(false)
          video.pause()
        }
      }

      video.addEventListener('timeupdate', onTimeUpdate)
      return () => video.removeEventListener('timeupdate', onTimeUpdate)
    }, [playing, project.duration, useVideo])

    useEffect(() => {
      onTimeChange?.(currentTime)
    }, [currentTime, onTimeChange])

    const togglePlay = () => {
      if (currentTime >= project.duration) {
        setCurrentTime(0)
        syncVideoTime(0)
      }
      setPlaying((p) => !p)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value)
      setCurrentTime(value)
      syncVideoTime(value)
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
            style={{
              width: '100%',
              height: '100%',
              display: useVideo ? 'none' : 'block',
            }}
          />
          {useVideo && prerenderUrl && (
            <video
              ref={videoRef}
              src={prerenderUrl}
              className="preview-video"
              playsInline
              preload="auto"
            />
          )}
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
