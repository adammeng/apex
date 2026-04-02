import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export function useBoardFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === targetRef.current)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [targetRef])

  async function toggleFullscreen() {
    const target = targetRef.current
    if (!target) {
      return
    }

    if (document.fullscreenElement === target) {
      await document.exitFullscreen()
      return
    }

    await target.requestFullscreen()
  }

  return {
    isFullscreen,
    toggleFullscreen,
  }
}
