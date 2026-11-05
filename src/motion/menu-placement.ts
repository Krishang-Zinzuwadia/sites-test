import { getMotionRect, getMotionViewport, invalidateMotionFrame } from './motion-frame'

type Point = { x: number; y: number }
type Box = Point & { width: number; height: number }
type Rectangle = { left: number; top: number; right: number; bottom: number }
const reservations = new WeakMap<HTMLElement, Rectangle>()
const chromeByRoot = new WeakMap<Element, { header: HTMLElement | null; dock: HTMLElement | null }>()

function viewportBounds(host: HTMLElement, width: number, height: number) {
  const viewport = getMotionViewport(), visual = window.visualViewport
  const root = host.closest('.site-root') ?? document.documentElement
  let chrome = chromeByRoot.get(root)
  if (!chrome || (chrome.header && !chrome.header.isConnected) || (chrome.dock && !chrome.dock.isConnected)) {
    chrome = { header: root.querySelector<HTMLElement>('.site-nav'), dock: root.querySelector<HTMLElement>('.assembly-dock') }
    chromeByRoot.set(root, chrome)
  }
  const visualLeft = visual?.offsetLeft ?? 0, visualTop = visual?.offsetTop ?? 0
  const visualRight = visualLeft + (visual?.width ?? viewport.width)
  const visualBottom = visualTop + (visual?.height ?? viewport.height)
  const left = visualLeft + 8
  const top = visualTop + (chrome.header?.offsetHeight ?? 0) + 10
  const dock = chrome.dock ? getMotionRect(chrome.dock) : undefined
  const usableBottom = dock && dock.top < visualBottom && dock.bottom > top ? Math.min(visualBottom - 8, dock.top - 10) : visualBottom - 10
  return { left, top, right: Math.max(left, visualRight - width - 8), bottom: Math.max(top, usableBottom - height) }
}

function viewportBox(box: Box, host: HTMLElement, hostRect: DOMRect): Rectangle {
  const left = hostRect.left + host.clientLeft - host.scrollLeft + box.x
  const top = hostRect.top + host.clientTop - host.scrollTop + box.y
  return { left, top, right: left + box.width, bottom: top + box.height }
}

function overlapArea(x: number, y: number, width: number, height: number, rect: Rectangle, gap = 0) {
  return Math.max(0, Math.min(x + width + gap, rect.right) - Math.max(x - gap, rect.left)) *
    Math.max(0, Math.min(y + height + gap, rect.bottom) - Math.max(y - gap, rect.top))
}

/** Find a free viewport position before the operating cursor starts its click. */
export function constructionMenuPosition(menu: HTMLElement, host: HTMLElement, anchor: Point, reserve = true, workBox?: Box) {
  const hostRect = getMotionRect(host)
  const width = menu.offsetWidth || 148, height = menu.offsetHeight || 100
  const { left, top, right, bottom } = viewportBounds(host, width, height)
  const origin = { x: hostRect.left + host.clientLeft - host.scrollLeft + anchor.x, y: hostRect.top + host.clientTop - host.scrollTop + anchor.y }
  const work = workBox ? viewportBox(workBox, host, hostRect) : { left: origin.x - 24, top: origin.y - 24, right: origin.x + 24, bottom: origin.y + 24 }
  const occupied: Rectangle[] = []
  for (const other of document.querySelectorAll<HTMLElement>('[data-construction-menu]')) {
    if (other === menu || other.dataset.menuActive === 'false' || !other.isConnected) continue
    const style = getComputedStyle(other)
    const reserved = reservations.get(other)
    // Hidden scene overlays must not reserve space in the next scene.
    const overlay = other.closest<HTMLElement>('.assembly-overlay')
    if ((!reserved && style.visibility === 'hidden') || (overlay && (getComputedStyle(overlay).visibility === 'hidden' || Number(getComputedStyle(overlay).opacity) < .03))) continue
    if (reserved) occupied.push(reserved)
    else if (Number(style.opacity) > .03) occupied.push(getMotionRect(other, true))
  }
  let positionX = left, positionY = top, best = Infinity
  const consider = (x: number, y: number) => {
    let overlap = 0
    for (const rect of occupied) overlap += overlapArea(x, y, width, height, rect, 8)
    const coveredWork = overlapArea(x, y, width, height, work, 10)
    const coveredAnchor = overlapArea(x, y, width, height, { left: origin.x - 18, top: origin.y - 18, right: origin.x + 18, bottom: origin.y + 18 })
    const score = overlap * 1e8 + coveredAnchor * 1e7 + coveredWork * 1e5 + (x - origin.x) ** 2 + (y - origin.y) ** 2
    if (score < best) { positionX = x; positionY = y; best = score }
  }
  const preferred = (x: number, y: number) => consider(Math.max(left, Math.min(right, x)), Math.max(top, Math.min(bottom, y)))
  preferred(work.right + 12, origin.y - height / 2)
  preferred(work.left - width - 12, origin.y - height / 2)
  preferred(origin.x - width / 2, work.bottom + 12)
  preferred(origin.x - width / 2, work.top - height - 12)
  preferred(origin.x + 12, origin.y + 10)
  preferred(origin.x - width - 12, origin.y + 10)
  for (let y = top; y <= bottom; y += 16) {
    for (let x = left; x <= right; x += 16) consider(x, y)
    consider(right, y)
  }
  consider(left, bottom)
  consider(right, bottom)
  if (reserve) {
    reservations.set(menu, { left: positionX, top: positionY, right: positionX + width, bottom: positionY + height })
    menu.dataset.menuReserved = 'true'
    invalidateMotionFrame(menu)
  }
  return { x: positionX - hostRect.left - host.clientLeft + host.scrollLeft, y: positionY - hostRect.top - host.clientTop + host.scrollTop, width, height }
}

/** Preserve the chosen Paste target, correcting only for the moving viewport. */
export function keepConstructionMenuInView(menu: HTMLElement, host: HTMLElement, box: Box): Box {
  const hostRect = getMotionRect(host), rect = viewportBox(box, host, hostRect)
  const bounds = viewportBounds(host, box.width, box.height)
  const x = Math.max(bounds.left, Math.min(bounds.right, rect.left))
  const y = Math.max(bounds.top, Math.min(bounds.bottom, rect.top))
  const next = { ...box, x: box.x + x - rect.left, y: box.y + y - rect.top }
  if (menu.dataset.menuReserved === 'true') reservations.set(menu, { left: x, top: y, right: x + box.width, bottom: y + box.height })
  return next
}

export function releaseConstructionMenu(menu: HTMLElement) {
  reservations.delete(menu)
  if (menu.dataset.menuReserved !== undefined) delete menu.dataset.menuReserved
  invalidateMotionFrame(menu)
}
