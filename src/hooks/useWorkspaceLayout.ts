import { useCallback, useRef, useState } from 'react'

const STORAGE_KEY = 'json-video-studio.layout'

interface LayoutState {
  propertiesWidth: number
  timelineHeight: number
}

const DEFAULT_LAYOUT: LayoutState = {
  propertiesWidth: 320,
  timelineHeight: 260,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw) as Partial<LayoutState>
    return {
      propertiesWidth: clamp(parsed.propertiesWidth ?? DEFAULT_LAYOUT.propertiesWidth, 240, 640),
      timelineHeight: clamp(parsed.timelineHeight ?? DEFAULT_LAYOUT.timelineHeight, 160, 720),
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function useWorkspaceLayout() {
  const [layout, setLayout] = useState<LayoutState>(loadLayout)
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  const persistLayout = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutRef.current))
    } catch {
      // ignore storage errors
    }
  }, [])

  const resizeProperties = useCallback((delta: number) => {
    setLayout((current) => ({
      ...current,
      propertiesWidth: clamp(current.propertiesWidth + delta, 240, 640),
    }))
  }, [])

  const resizeTimeline = useCallback((delta: number) => {
    setLayout((current) => ({
      ...current,
      timelineHeight: clamp(current.timelineHeight - delta, 160, 720),
    }))
  }, [])

  return {
    propertiesWidth: layout.propertiesWidth,
    timelineHeight: layout.timelineHeight,
    resizeProperties,
    resizeTimeline,
    persistLayout,
  }
}
