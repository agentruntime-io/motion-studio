import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical'
  onDrag: (delta: number) => void
  onDragEnd?: () => void
  ariaLabel: string
}

export function ResizeHandle({ direction, onDrag, onDragEnd, ariaLabel }: ResizeHandleProps) {
  const draggingRef = useRef(false)
  const [active, setActive] = useState(false)

  const startDrag = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      draggingRef.current = true
      setActive(true)

      let lastX = event.clientX
      let lastY = event.clientY

      const onMove = (moveEvent: MouseEvent) => {
        if (!draggingRef.current) return
        const delta =
          direction === 'horizontal'
            ? moveEvent.clientX - lastX
            : moveEvent.clientY - lastY
        lastX = moveEvent.clientX
        lastY = moveEvent.clientY
        onDrag(delta)
      }

      const onUp = () => {
        draggingRef.current = false
        setActive(false)
        onDragEnd?.()
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [direction, onDrag, onDragEnd],
  )

  useEffect(() => {
    if (!active) return
    document.body.classList.add('is-resizing')
    return () => document.body.classList.remove('is-resizing')
  }, [active])

  return (
    <div
      className={`resize-handle resize-handle-${direction} ${active ? 'active' : ''}`}
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-label={ariaLabel}
      onMouseDown={startDrag}
    />
  )
}
