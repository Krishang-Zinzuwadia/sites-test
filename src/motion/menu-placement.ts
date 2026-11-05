import { getMotionRect, getMotionViewport, invalidateMotionFrame } from './motion-frame'

type Point = { x: number; y: number }
const reservations = new WeakSet<HTMLElement>()

/** Find a free viewport position before the operating cursor starts its click. */
export function constructionMenuPosition(menu: HTMLElement, host: HTMLElement, anchor: Point, reserve = true) {
  const hostRect = getMotionRect(host)
  const viewport = getMotionViewport()
  const width = menu.offsetWidth || 148
  const height = menu.offsetHeight || 100
  const left = 8, top = 8
  const right = Math.max(left, viewport.width - width - 8)
  const bottom = Math.max(top, viewport.height - height - (viewport.width < 768 ? 83 : 12))
  const origin = { x: hostRect.left + anchor.x, y: hostRect.top + anchor.y }
  const occupied: DOMRect[] = []
  for (const other of document.querySelectorAll<HTMLElement>('[data-construction-menu]')) {
    if (other === menu) continue
    let visible = reservations.has(other) || other.dataset.menuReserved === 'true'
    if (!visible) {
      const style = getComputedStyle(other)
      visible = style.visibility !== 'hidden' && Number(style.opacity) > .03
    }
    // Menu reveal transforms can change earlier in the same ticker frame.
    // Preserve collision scoring against the actual current rectangle.
    if (visible) occupied.push(getMotionRect(other, true))
  }
  let positionX = Math.max(left, Math.min(right, origin.x + 12))
  let positionY = Math.max(top, Math.min(bottom, origin.y + 10))
  let best = Infinity
  const consider = (x: number, y: number) => {
    let overlap = 0
    for (const rect of occupied) {
      overlap += Math.max(0, Math.min(x + width + 8, rect.right) - Math.max(x - 8, rect.left)) *
        Math.max(0, Math.min(y + height + 8, rect.bottom) - Math.max(y - 8, rect.top))
    }
    const score = overlap * 1e7 + (x - origin.x) ** 2 + (y - origin.y) ** 2
    if (score < best) { positionX = x; positionY = y; best = score }
  }
  const preferred = (x: number, y: number) => consider(Math.max(left, Math.min(right, x)), Math.max(top, Math.min(bottom, y)))
  // Preserve the exact candidate order and score, including tie behavior, while
  // scoring the dense fallback directly instead of allocating a point per slot.
  preferred(origin.x + 12, origin.y + 10)
  preferred(origin.x - width - 12, origin.y + 10)
  preferred(origin.x + 12, origin.y - height - 10)
  preferred(origin.x - width - 12, origin.y - height - 10)
  for (let y = top; y <= bottom; y += 12) {
    for (let x = left; x <= right; x += 12) consider(x, y)
    consider(right, y)
  }
  consider(left, bottom)
  consider(right, bottom)
  if (reserve) {
    reservations.add(menu)
    if (menu.dataset.menuReserved !== 'true') menu.dataset.menuReserved = 'true'
    // The caller applies this position immediately. A second opener in this
    // frame must see those new coordinates rather than an earlier cached rect.
    invalidateMotionFrame(menu)
  }
  return { x: positionX - hostRect.left, y: positionY - hostRect.top, width, height }
}

export function releaseConstructionMenu(menu: HTMLElement) {
  reservations.delete(menu)
  if (menu.dataset.menuReserved !== undefined) delete menu.dataset.menuReserved
  invalidateMotionFrame(menu)
}
