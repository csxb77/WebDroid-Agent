import { useCallback, useEffect, useRef } from 'react'
import { CursorMotion, type CursorFrame, type CursorPoint, type ViewportSize } from '../lib/cursorMotion'

export const CURSOR_SIZE = 24

export type AgentCursorProps = {
  cursor: CursorPoint | null
  isVisible: boolean
  viewportSize: ViewportSize
  onArrived?: (moveSequence: number) => void
}

export function AgentCursor({ cursor, isVisible, viewportSize, onArrived }: AgentCursorProps) {
  const cursorRef = useRef<HTMLDivElement | null>(null)
  const motionRef = useRef<CursorMotion | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const turnKeyRef = useRef<string | null>(null)

  const applyFrame = useCallback(
    (frame: CursorFrame) => {
      const el = cursorRef.current
      if (!el) return

      el.style.opacity = frame.opacity
      el.style.filter = frame.filter
      el.style.transform = frame.transform

      if (frame.arrivedMoveSequence != null) {
        onArrived?.(frame.arrivedMoveSequence)
      }
      if (frame.shouldContinue) {
        scheduleNextFrame()
      }
    },
    [onArrived],
  )

  const tick = useCallback(() => {
    if (!motionRef.current) return
    applyFrame(motionRef.current.tick())
  }, [applyFrame])

  const scheduleNextFrame = useCallback(() => {
    if (animFrameRef.current != null) return
    animFrameRef.current = requestAnimationFrame(() => {
      animFrameRef.current = null
      tick()
    })
  }, [tick])

  useEffect(() => {
    const motion = motionRef.current ?? new CursorMotion()
    motionRef.current = motion

    const turnKey = `${isVisible}:${cursor?.x ?? 'none'}:${cursor?.y ?? 'none'}`
    turnKeyRef.current = turnKey

    applyFrame(
      motion.setState({
        cursor,
        isVisible,
        turnKey,
        viewportSize,
      }),
    )
  }, [cursor, isVisible, viewportSize, applyFrame])

  useEffect(() => {
    return () => {
      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [])

  return (
    <div className="agent-cursor" ref={cursorRef} data-testid="agent-cursor">
      <img
        alt=""
        draggable={false}
        height={CURSOR_SIZE}
        src="/images/cursor-chat.png"
        width={23}
      />
    </div>
  )
}
