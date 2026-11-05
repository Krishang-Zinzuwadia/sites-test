import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { collaborators, createCursor } from './DesignTools'
import { addElementConstruction } from './elementConstruction'

/** Even the page furniture is unpacked from the same physical source. */
export function useBoxArrival(root: RefObject<HTMLElement | null>, enabled: boolean, replayKey: number) {
  useLayoutEffect(() => {
    if (!enabled || !root.current) return
    const source = root.current.querySelector<HTMLElement>('[data-creation-source]')
    if (!source) return
    const origin = source.getBoundingClientRect()
    const page = root.current
    const overlay = document.createElement('div')
    overlay.className = 'assembly-overlay chrome-construction-overlay'
    overlay.setAttribute('aria-hidden', 'true')
    page.append(overlay)
    let cleanupLeaves: (() => void) | undefined
    const context = gsap.context(() => {
      const timeline = gsap.timeline()
      const items = Array.from(page.querySelectorAll<HTMLElement>('[data-box-arrival]'))
      const names = ['Lena', 'Owen', 'June', 'Arlo', 'Esme', 'Jules', 'Tess']
      items.forEach((item, index) => {
        const target = item.getBoundingClientRect()
        const actor = collaborators[index % collaborators.length]
        const cursor = createCursor({ ...actor, name: names[index % names.length], role: item.classList.contains('site-nav') ? 'Creating navigation' : item.classList.contains('assembly-dock') ? 'Building playback' : 'Placing the details' })
        overlay.append(cursor)
        const at = .12 + index * .11
        const moveX = gsap.quickSetter(cursor, 'x', 'px')
        const moveY = gsap.quickSetter(cursor, 'y', 'px')
        const track = () => {
          const rect = item.getBoundingClientRect()
          const scene = page.getBoundingClientRect()
          moveX(rect.right - scene.left + 4)
          moveY(rect.top - scene.top + 3)
        }
        timeline.fromTo(cursor, { autoAlpha: 0, x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 }, { autoAlpha: 1, duration: .08 }, Math.max(0, at - .08))
        timeline.from(item, {
          x: `+=${origin.left + origin.width / 2 - target.left - target.width / 2}`,
          y: `+=${origin.top + origin.height / 2 - target.top - target.height / 2}`,
          scale: .025,
          opacity: 0,
          duration: 1.15,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          onUpdate: track,
        }, at)
        timeline.to(cursor, { autoAlpha: 0, duration: .18 }, at + 1.18)
      })
      cleanupLeaves = addElementConstruction({ scene: page, overlay, timeline, targets: items, start: 2.0, end: 4.65 })
    }, page)
    return () => {
      cleanupLeaves?.()
      context.revert()
      overlay.remove()
    }
  }, [root, enabled, replayKey])
}
