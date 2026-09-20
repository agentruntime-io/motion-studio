interface PrerenderButtonProps {
  onPrerender: () => void
  rendering: boolean
  stale: boolean
  ready: boolean
  progress?: number
}

export function PrerenderButton({
  onPrerender,
  rendering,
  stale,
  ready,
  progress,
}: PrerenderButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-prerender"
      onClick={onPrerender}
      disabled={!ready || rendering}
      title={
        stale
          ? 'Pre-render outdated — click to refresh'
          : rendering
            ? 'Pre-rendering…'
            : 'Pre-render for accurate playback'
      }
    >
      {rendering ? `Pre-render ${progress ?? 0}%` : 'Pre-render'}
      {stale && !rendering && (
        <span className="prerender-stale-icon" aria-label="Pre-render outdated">
          ●
        </span>
      )}
    </button>
  )
}
