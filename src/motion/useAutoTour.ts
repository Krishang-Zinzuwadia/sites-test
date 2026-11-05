import { useCallback, useEffect, useRef, useState } from 'react'

/** A real scrolling camera, independent of any individual assembly timeline. */
export function useAutoTour(enabled: boolean, replayKey: number) {
  const [requested, setRequested] = useState(true)
  const [introDone, setIntroDone] = useState(false)
  const [complete, setComplete] = useState(false)
  const frame = useRef(0)

  const pause = useCallback(() => {
    setRequested(false)
    document.dispatchEvent(new CustomEvent('assembly:playback-pause'))
  }, [])

  const resume = useCallback(() => {
    setComplete(false)
    setRequested(true)
    document.dispatchEvent(new CustomEvent('assembly:playback-resume'))
  }, [])

  useEffect(() => {
    setRequested(true)
    setIntroDone(false)
    setComplete(false)
  }, [replayKey])

  useEffect(() => {
    const finishIntro = () => setIntroDone(true)
    document.addEventListener('assembly:intro-complete', finishIntro)
    return () => document.removeEventListener('assembly:intro-complete', finishIntro)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const takeControl = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.assembly-dock')) return
      if (event.type === 'keydown') {
        const key = (event as KeyboardEvent).key
        if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Tab', 'Escape'].includes(key)) return
      }
      pause()
    }
    const interact = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('.assembly-dock')) return
      if (event.target.closest('a, button, input, textarea, select, [role="tab"]')) pause()
    }
    window.addEventListener('wheel', takeControl, { passive: true })
    window.addEventListener('touchstart', takeControl, { passive: true })
    window.addEventListener('keydown', takeControl)
    window.addEventListener('pointerdown', interact)
    return () => {
      window.removeEventListener('wheel', takeControl)
      window.removeEventListener('touchstart', takeControl)
      window.removeEventListener('keydown', takeControl)
      window.removeEventListener('pointerdown', interact)
    }
  }, [enabled, pause])

  useEffect(() => {
    if (!enabled || !introDone || !requested || complete) return
    let previous = 0
    let position = window.scrollY
    document.documentElement.classList.add('auto-tour-running')
    const advance = (now: number) => {
      const elapsed = previous ? Math.min((now - previous) / 1000, .05) : 0
      previous = now
      if (document.hidden || document.querySelector('dialog[open]')) {
        frame.current = requestAnimationFrame(advance)
        return
      }
      const end = Math.max(0, document.documentElement.scrollHeight - innerHeight)
      const speed = Math.max(66, Math.min(90, innerHeight * .08))
      position = Math.min(end, position + speed * elapsed)
      window.scrollTo({ top: position, behavior: 'instant' })
      if (position >= end - 1) {
        setComplete(true)
        return
      }
      frame.current = requestAnimationFrame(advance)
    }
    frame.current = requestAnimationFrame(advance)
    return () => {
      cancelAnimationFrame(frame.current)
      document.documentElement.classList.remove('auto-tour-running')
    }
  }, [enabled, introDone, requested, complete])

  return {
    playing: enabled && requested && !complete,
    status: complete ? 'complete' : !requested ? 'paused' : !introDone ? 'intro' : 'playing',
    toggle: requested && !complete ? pause : resume,
    pause,
  }
}
