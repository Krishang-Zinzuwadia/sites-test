import { useCallback, useEffect, useRef, useState } from 'react'

/** A real scrolling camera, independent of any individual assembly timeline. */
export function useAutoTour(enabled: boolean, replayKey: number) {
  const [requested, setRequested] = useState(true)
  const [introDone, setIntroDone] = useState(false)
  const [complete, setComplete] = useState(false)
  const [assemblyFlow, setAssemblyFlow] = useState<'scroll' | 'playing' | 'complete'>('scroll')
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
    const readFlow = () => {
      const state = document.querySelector<HTMLElement>('.site-root')?.dataset.assemblyFlow
      const flow = state === 'playing' || state === 'complete' ? state : 'scroll'
      setAssemblyFlow(flow)
      if (flow !== 'complete') setComplete(false)
    }
    document.addEventListener('assembly:intro-complete', finishIntro)
    document.addEventListener('assembly:flow-state', readFlow)
    readFlow()
    return () => {
      document.removeEventListener('assembly:intro-complete', finishIntro)
      document.removeEventListener('assembly:flow-state', readFlow)
    }
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
    if (assemblyFlow === 'playing') return
    if (assemblyFlow === 'complete') {
      setComplete(true)
      document.dispatchEvent(new CustomEvent('assembly:tour-complete'))
      return
    }
    let previous = 0
    let position = window.scrollY
    let velocity = Math.max(90, Math.min(116, innerHeight * .12))
    const toolkit = document.getElementById('toolkit')
    let viewportHeight = innerHeight
    let end = 0
    let toolkitTop = Infinity
    let toolkitBottom = -Infinity
    const measure = () => {
      viewportHeight = innerHeight
      end = Math.max(0, document.documentElement.scrollHeight - viewportHeight)
      if (toolkit) {
        const rect = toolkit.getBoundingClientRect()
        toolkitTop = rect.top + window.scrollY
        toolkitBottom = rect.bottom + window.scrollY
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(document.documentElement)
    window.addEventListener('resize', measure)
    document.documentElement.classList.add('auto-tour-running')
    const advance = (now: number) => {
      const elapsed = previous ? Math.min((now - previous) / 1000, .05) : 0
      previous = now
      if (document.hidden) {
        frame.current = requestAnimationFrame(advance)
        return
      }
      // Assembly owns a timed crew sequence when there is no scrolling room.
      // A resize can be measured here before its flow-state event is delivered.
      if (end <= 1) {
        frame.current = requestAnimationFrame(advance)
        return
      }
      const inspectingTools = toolkitTop - position < viewportHeight && toolkitBottom - position > viewportHeight * .2
      const desiredSpeed = inspectingTools ? 62 : Math.max(90, Math.min(116, viewportHeight * .12))
      velocity += (desiredSpeed - velocity) * Math.min(1, elapsed * 3)
      position = Math.min(end, position + velocity * elapsed)
      window.scrollTo({ top: position, behavior: 'instant' })
      if (position >= end - 1) {
        setComplete(true)
        document.dispatchEvent(new CustomEvent('assembly:tour-complete'))
        return
      }
      frame.current = requestAnimationFrame(advance)
    }
    frame.current = requestAnimationFrame(advance)
    return () => {
      cancelAnimationFrame(frame.current)
      observer.disconnect()
      window.removeEventListener('resize', measure)
      document.documentElement.classList.remove('auto-tour-running')
    }
  }, [enabled, introDone, requested, complete, assemblyFlow])

  return {
    playing: enabled && requested && !complete,
    status: complete ? 'complete' : !requested ? 'paused' : !introDone ? 'intro' : 'playing',
    toggle: requested && !complete ? pause : resume,
    pause,
  }
}
