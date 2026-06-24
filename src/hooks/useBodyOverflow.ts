import { useEffect, useRef } from 'react'

/**
 * Manages document.body.style.overflow as a stack.
 * Multiple consumers (fullscreen, lightbox) can lock independently;
 * overflow is only restored when the last lock is released.
 */
export function useBodyOverflow(lock: boolean) {
  const lockCountRef = useRef(0)
  const previousOverflowRef = useRef<string | null>(null)

  useEffect(() => {
    if (!lock) {
      return
    }

    if (lockCountRef.current === 0) {
      previousOverflowRef.current = document.body.style.overflow
    }

    lockCountRef.current += 1
    document.body.style.overflow = 'hidden'

    return () => {
      lockCountRef.current -= 1
      if (lockCountRef.current <= 0) {
        lockCountRef.current = 0
        document.body.style.overflow = previousOverflowRef.current || ''
      }
    }
  }, [lock])
}
