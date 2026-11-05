type Point = { x: number; y: number }

/** Find a free viewport position before the operating cursor starts its click. */
export function constructionMenuPosition(menu: HTMLElement, host: HTMLElement, anchor: Point, reserve = true) {
  const hostRect = host.getBoundingClientRect()
  const width = menu.offsetWidth || 148
  const height = menu.offsetHeight || 100
  const left = 8, top = 8
  const right = Math.max(left, innerWidth - width - 8)
  const bottom = Math.max(top, innerHeight - height - (innerWidth < 768 ? 83 : 12))
  const clamp = (point: Point): Point => ({ x: Math.max(left, Math.min(right, point.x)), y: Math.max(top, Math.min(bottom, point.y)) })
  const origin = { x: hostRect.left + anchor.x, y: hostRect.top + anchor.y }
  const occupied = Array.from(document.querySelectorAll<HTMLElement>('[data-construction-menu]'))
    .filter(other => other !== menu && (other.dataset.menuReserved === 'true' || (getComputedStyle(other).visibility !== 'hidden' && Number(getComputedStyle(other).opacity) > .03)))
    .map(other => other.getBoundingClientRect())
  const candidates = [
    clamp({ x: origin.x + 12, y: origin.y + 10 }),
    clamp({ x: origin.x - width - 12, y: origin.y + 10 }),
    clamp({ x: origin.x + 12, y: origin.y - height - 10 }),
    clamp({ x: origin.x - width - 12, y: origin.y - height - 10 }),
  ]
  // A denser fallback finds gaps between menus from concurrent crews.
  for (let y = top; y <= bottom; y += 12) {
    for (let x = left; x <= right; x += 12) candidates.push({ x, y })
    candidates.push({ x: right, y })
  }
  candidates.push({ x: left, y: bottom }, { x: right, y: bottom })
  const score = (point: Point) => {
    const overlap = occupied.reduce((area, rect) => area +
      Math.max(0, Math.min(point.x + width + 8, rect.right) - Math.max(point.x - 8, rect.left)) *
      Math.max(0, Math.min(point.y + height + 8, rect.bottom) - Math.max(point.y - 8, rect.top)), 0)
    return overlap * 1e7 + (point.x - origin.x) ** 2 + (point.y - origin.y) ** 2
  }
  let position = candidates[0], best = score(position)
  for (const candidate of candidates.slice(1)) {
    const value = score(candidate)
    if (value < best) { position = candidate; best = value }
  }
  if (reserve) menu.dataset.menuReserved = 'true'
  return { x: position.x - hostRect.left, y: position.y - hostRect.top, width, height }
}

export function releaseConstructionMenu(menu: HTMLElement) {
  delete menu.dataset.menuReserved
}
