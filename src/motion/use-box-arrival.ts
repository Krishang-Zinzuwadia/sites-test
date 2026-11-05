import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { collaborators, createCursor } from './design-tools'
import { addElementConstruction } from './element-construction'
import { getMotionRect, retainMotionFrame } from './motion-frame'

/** Even the page furniture is unpacked from the same physical source. */
export function useBoxArrival(root: RefObject<HTMLElement | null>, enabled: boolean, replayKey: number) {
  useLayoutEffect(() => {
    if (!enabled || !root.current) return
    const source = root.current.querySelector<HTMLElement>('[data-creation-source]')
    if (!source) return
    const page = root.current
    const releaseFrame = retainMotionFrame()
    const overlay = document.createElement('div')
    overlay.className = 'assembly-overlay chrome-construction-overlay'
    overlay.setAttribute('aria-hidden', 'true')
    page.append(overlay)
    let cleanupLeaves: (() => void) | undefined
    let timeline: gsap.core.Timeline | undefined
    const context = gsap.context(() => {
      timeline = gsap.timeline()
      const activeTimeline = timeline
      const items = Array.from(page.querySelectorAll<HTMLElement>('[data-box-arrival]')).filter(item => !item.closest('[data-construction-exempt]'))
      const names = ['Lena', 'Owen', 'June', 'Arlo', 'Esme', 'Jules', 'Tess']
      items.forEach((item, index) => {
        const target = item.getBoundingClientRect()
        const origin = source.getBoundingClientRect()
        const actor = collaborators[index % collaborators.length]
        const cursor = createCursor({ ...actor, name: names[index % names.length], role: item.classList.contains('site-nav') ? 'Creating navigation' : 'Placing the details' })
        overlay.append(cursor)
        const at = .03 + index * .025
        const moveX = gsap.quickSetter(cursor, 'x', 'px')
        const moveY = gsap.quickSetter(cursor, 'y', 'px')
        const point = { x: 0, y: 0 }
        const sourcePoint = () => {
          const box = getMotionRect(source)
          const scene = getMotionRect(page)
          return { x: box.left + box.width / 2 - scene.left, y: box.top + box.height * .4 - scene.top }
        }
        const track = () => {
          const rect = getMotionRect(item, true)
          const scene = getMotionRect(page)
          point.x = rect.right - scene.left + 4
          point.y = rect.top - scene.top + 3
          moveX(point.x)
          moveY(point.y)
        }
        const birth = sourcePoint()
        activeTimeline.fromTo(cursor, { autoAlpha: 0, scale: .18, x: birth.x, y: birth.y }, { autoAlpha: 1, scale: 1, duration: .16, ease: 'sine.out' }, Math.max(0, at - .08))
        activeTimeline.from(item, {
          x: `+=${origin.left + origin.width / 2 - target.left - target.width / 2}`,
          y: `+=${origin.top + origin.height / 2 - target.top - target.height / 2}`,
          scale: .025,
          opacity: 0,
          duration: 1.15,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          onUpdate: track,
        }, at)
        const returnFlight = { progress: 0 }
        let departure = { ...point }
        activeTimeline.to(returnFlight, {
          progress: 1,
          duration: .62,
          ease: 'sine.inOut',
          onStart: () => {
            departure = { ...point }
            const action = cursor.querySelector('.assembly-cursor-action')
            if (action) action.textContent = 'Back to the box'
          },
          onUpdate: () => {
            const destination = sourcePoint()
            const t = returnFlight.progress
            const bend = Math.sin(Math.PI * t) * Math.min(80, Math.abs(destination.y - departure.y) * .14 + 24)
            moveX(departure.x + (destination.x - departure.x) * t + bend)
            moveY(departure.y + (destination.y - departure.y) * t - bend * .4)
          },
        }, at + 1.25)
        activeTimeline.to(cursor, { scale: .16, autoAlpha: 0, duration: .12, ease: 'power2.in' }, at + 1.78)
      })
      cleanupLeaves = addElementConstruction({ scene: page, overlay, timeline: activeTimeline, targets: items, start: 1.9, end: 5.1 })
    }, page)
    const pause = () => timeline?.pause()
    const resume = () => timeline?.resume()
    document.addEventListener('assembly:playback-pause', pause)
    document.addEventListener('assembly:playback-resume', resume)
    if (page.dataset.playback === 'paused') pause()
    return () => {
      document.removeEventListener('assembly:playback-pause', pause)
      document.removeEventListener('assembly:playback-resume', resume)
      cleanupLeaves?.()
      context.revert()
      overlay.remove()
      releaseFrame()
    }
  }, [root, enabled, replayKey])
}
