import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { collaborators, createCursor } from './design-tools'
import { addElementConstruction } from './element-construction'
import { getCreationSourcePoint, getMotionRect, retainMotionFrame } from './motion-frame'
import { cancelMotionRead, queueMotionRead } from './motion-read'
import { MOTION_PLAYBACK_RATE } from './motion-tempo'

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
    let disposed = false
    const readKeys: object[] = []
    const context = gsap.context(() => {
      timeline = gsap.timeline().timeScale(MOTION_PLAYBACK_RATE)
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
        const readKey = {}
        readKeys.push(readKey)
        const sourcePoint = () => getCreationSourcePoint(page)
        const targetPoint = () => {
          const rect = getMotionRect(item, true)
          const scene = getMotionRect(page)
          return { x: rect.right - scene.left - page.clientLeft + page.scrollLeft + 4, y: rect.top - scene.top - page.clientTop + page.scrollTop + 3 }
        }
        const track = () => {
          queueMotionRead(readKey, () => {
            if (disposed) return
            const position = targetPoint()
            return () => {
              if (disposed) return
              moveX(position.x)
              moveY(position.y)
            }
          })
        }
        activeTimeline.fromTo(cursor, { autoAlpha: 0, scale: .18, x: () => sourcePoint().x, y: () => sourcePoint().y }, { autoAlpha: 1, scale: 1, duration: .16, ease: 'sine.out' }, Math.max(0, at - .08))
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
        let departure: { x: number; y: number } | undefined
        activeTimeline.to(returnFlight, {
          progress: 1,
          duration: .62,
          ease: 'sine.inOut',
          onStart: () => {
            cancelMotionRead(readKey)
            departure = targetPoint()
            const action = cursor.querySelector('.assembly-cursor-action')
            if (action) action.textContent = 'Back to the box'
          },
          onUpdate: () => {
            const destination = sourcePoint()
            const from = departure ??= targetPoint()
            const t = returnFlight.progress
            const bend = Math.sin(Math.PI * t) * Math.min(80, Math.abs(destination.y - from.y) * .14 + 24)
            moveX(from.x + (destination.x - from.x) * t + bend)
            moveY(from.y + (destination.y - from.y) * t - bend * .4)
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
      disposed = true
      readKeys.forEach(cancelMotionRead)
      document.removeEventListener('assembly:playback-pause', pause)
      document.removeEventListener('assembly:playback-resume', resume)
      cleanupLeaves?.()
      context.revert()
      overlay.remove()
      releaseFrame()
    }
  }, [root, enabled, replayKey])
}
