import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { collaborators, createCursor, type Collaborator } from './DesignTools'
import './specialConstruction.css'

type SpecialConstructionOptions = {
  scene: HTMLElement
  overlay: HTMLElement
  timeline: gsap.core.Timeline
  start?: number
  end?: number
}

type Point = { x: number; y: number }
type Box = Point & { width: number; height: number }
type Worker = { actor: Collaborator; cursor: HTMLDivElement; last?: () => Point; finish: number }
type Tile = {
  node: HTMLElement; icon: HTMLElement; name: HTMLElement; dot: HTMLElement | null
  box: Box; iconBox: Box; nameBox: Box; fill: string; border: string; radius: number
  outline: SVGRectElement; ghost: HTMLDivElement; copy: HTMLSpanElement; caret: HTMLSpanElement
  menu: HTMLDivElement; paste: HTMLDivElement; pulse: HTMLDivElement; menuBox?: Box
  worker: Worker; text: string
}
type Cell = { node: HTMLElement; index: number; box: Box; fill: string; opacity: number; outline: SVGRectElement }

const svgNamespace = 'http://www.w3.org/2000/svg'
const blankBox = (): Box => ({ x: 0, y: 0, width: 1, height: 1 })

/** Each real tile and activity cell is authored in place; semantic text never changes. */
export function addSpecialConstruction({ scene, overlay, timeline, start = 4.05, end = 9.05 }: SpecialConstructionOptions): () => void {
  const owns = (node: HTMLElement) => node.closest('.assembly-scene') === scene
  const tools = Array.from(scene.querySelectorAll<HTMLElement>('[data-build-tech]')).filter(owns)
  const grids = Array.from(scene.querySelectorAll<HTMLElement>('[data-build-grid]')).filter(owns)
  if (!tools.length && !grids.length) return () => {}

  const layer = document.createElement('div')
  layer.className = 'special-builder-layer'
  layer.setAttribute('aria-hidden', 'true')
  layer.inert = true
  overlay.append(layer)
  const drawing = document.createElementNS(svgNamespace, 'svg')
  drawing.classList.add('special-builder-drawing')
  drawing.setAttribute('aria-hidden', 'true')
  layer.append(drawing)
  let disposed = false

  const make = (className: string) => {
    const node = document.createElement('div')
    node.className = className
    node.setAttribute('aria-hidden', 'true')
    layer.append(node)
    return node
  }
  const rect = (color: string) => {
    const node = document.createElementNS(svgNamespace, 'rect')
    node.classList.add('special-builder-outline')
    node.setAttribute('pathLength', '1')
    node.setAttribute('stroke', color)
    drawing.append(node)
    return node
  }
  const relative = (rect: DOMRect): Box => {
    const host = scene.getBoundingClientRect()
    return { x: rect.left - host.left - scene.clientLeft + scene.scrollLeft, y: rect.top - host.top - scene.clientTop + scene.scrollTop, width: rect.width, height: rect.height }
  }
  const liveSource = (): Point => {
    const source = document.querySelector<HTMLElement>('[data-creation-source]')?.getBoundingClientRect()
    const host = scene.getBoundingClientRect()
    return {
      x: (source ? source.left + source.width / 2 : 45) - host.left - scene.clientLeft + scene.scrollLeft,
      y: (source ? source.top + source.height / 2 : innerHeight - 115) - host.top - scene.clientTop + scene.scrollTop,
    }
  }
  const place = (node: HTMLElement, box: Box) => Object.assign(node.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` })
  const placeRect = (node: SVGRectElement, box: Box, radius: number) => {
    node.setAttribute('x', String(box.x + .5))
    node.setAttribute('y', String(box.y + .5))
    node.setAttribute('width', String(Math.max(.5, box.width - 1)))
    node.setAttribute('height', String(Math.max(.5, box.height - 1)))
    node.setAttribute('rx', String(radius))
  }
  const pointOn = (outline: SVGRectElement, progress: number): Point => {
    const point = outline.getPointAtLength(outline.getTotalLength() * Math.min(1, Math.max(0, progress)))
    return { x: point.x, y: point.y }
  }
  const worker = (name: string, model: string, painter = false): Worker => {
    const original = collaborators.find(actor => actor.name === model) ?? collaborators[0]
    const actor = { ...original, name }
    const cursor = createCursor(actor)
    cursor.classList.add('special-builder-cursor', 'assembly-cursor--helper')
    if (painter) cursor.classList.add('special-builder-painter')
    layer.append(cursor)
    gsap.set(cursor, { autoAlpha: 0 })
    return { actor, cursor, finish: start }
  }
  const setCursor = (person: Worker, point: Point, action: string) => {
    if (disposed) return
    gsap.set(person.cursor, { x: point.x, y: point.y })
    const label = person.cursor.querySelector<HTMLElement>('.assembly-cursor-action')
    if (label && label.textContent !== action) label.textContent = action
    const host = scene.getBoundingClientRect()
    person.cursor.dataset.edge = host.left + point.x > innerWidth - 145 ? 'right' : 'left'
    person.cursor.dataset.vertical = host.top + point.y > innerHeight - 75 ? 'above' : 'below'
  }
  // Known endpoints, rather than cached current positions, make reverse scrubbing repeatable.
  const travel = (person: Worker, from: () => Point, to: () => Point, at: number, duration: number, action: string) => {
    const progress = { value: 0 }
    timeline.fromTo(progress, { value: 0 }, {
      value: 1, duration, ease: 'power2.inOut', immediateRender: false,
      onUpdate: () => {
        const a = from(), b = to(), t = progress.value, inverse = 1 - t
        const bend = Math.min(64, Math.max(7, Math.hypot(b.x - a.x, b.y - a.y) * .12))
        setCursor(person, {
          x: inverse * inverse * a.x + 2 * inverse * t * ((a.x + b.x) / 2 + bend) + t * t * b.x,
          y: inverse * inverse * a.y + 2 * inverse * t * ((a.y + b.y) / 2 - bend) + t * t * b.y,
        }, action)
      },
    }, at)
  }
  const arrive = (person: Worker, to: () => Point, at: number, duration: number, action: string) => {
    if (!person.last) {
      timeline.set(person.cursor, { x: () => liveSource().x, y: () => liveSource().y }, at)
      timeline.fromTo(person.cursor, { autoAlpha: 0, scale: .18 }, { autoAlpha: 1, scale: 1, duration: .035, immediateRender: false }, at)
      travel(person, liveSource, to, at + .035, Math.max(.02, duration - .035), action)
    } else travel(person, person.last, to, at, duration, action)
  }
  const returnHome = (person: Worker) => {
    if (!person.last) return
    travel(person, person.last, liveSource, person.finish, .54, 'Back to the source')
    timeline.to(person.cursor, { autoAlpha: 0, scale: .18, duration: .06, immediateRender: false }, person.finish + .54)
  }
  const draw = (person: Worker, outline: SVGRectElement, at: number, duration: number, action: string) => {
    const progress = { value: 0 }
    gsap.set(outline, { autoAlpha: 0, strokeDashoffset: 1 })
    timeline.fromTo(outline, { autoAlpha: 0 }, { autoAlpha: 1, duration: .012, immediateRender: false }, at)
    timeline.fromTo(progress, { value: 0 }, {
      value: 1, duration, ease: 'none', immediateRender: false,
      onUpdate: () => {
        outline.style.strokeDashoffset = String(1 - progress.value)
        setCursor(person, pointOn(outline, progress.value), action)
      },
    }, at)
    timeline.to(outline, { autoAlpha: 0, duration: Math.min(.07, duration / 3), immediateRender: false }, at + duration)
  }
  const pulse = (tile: Tile, point: () => Point, at: number) => {
    timeline.set(tile.pulse, { left: () => point().x, top: () => point().y }, at)
    timeline.fromTo(tile.pulse, { autoAlpha: 0, scale: .5 }, { autoAlpha: 1, scale: 1.1, duration: .045, immediateRender: false }, at)
    timeline.to(tile.pulse, { autoAlpha: 0, scale: 1.5, duration: .045, immediateRender: false }, at + .045)
  }

  const techWorkers = tools.length ? [worker('Arlo', 'Kai'), worker('Tessa', 'Ava'), worker('Pia', 'Remy'), worker('Ivo', 'Finn')] : []
  const tiles: Tile[] = tools.flatMap((node, index) => {
    const icon = node.querySelector<HTMLElement>('[data-tech-icon]')
    const name = node.querySelector<HTMLElement>('[data-tech-name]')
    if (!icon || !name) return []
    const person = techWorkers[index % techWorkers.length]
    const style = getComputedStyle(node)
    const ghost = make('special-builder-type-ghost')
    const copy = document.createElement('span')
    const caret = document.createElement('span')
    caret.className = 'special-builder-type-caret'
    ghost.append(copy, caret)
    const menu = make('special-builder-paste-menu')
    menu.dataset.constructionMenu = ''
    menu.innerHTML = '<div class="special-builder-menu-heading">CLIPBOARD</div><div class="special-builder-menu-row is-muted"><span>Cut</span><kbd>⌘ X</kbd></div><div class="special-builder-menu-row is-muted"><span>Copy</span><kbd>⌘ C</kbd></div><div class="special-builder-menu-row is-paste"><span>↳ &nbsp;Paste</span><kbd>⌘ V</kbd></div>'
    const click = make('special-builder-click-pulse')
    click.style.setProperty('--special-color', person.actor.color)
    return [{ node, icon, name, dot: node.querySelector<HTMLElement>('[data-tech-dot]'), box: blankBox(), iconBox: blankBox(), nameBox: blankBox(), fill: style.backgroundColor, border: style.borderTopColor, radius: parseFloat(style.borderTopLeftRadius) || 6, outline: rect(person.actor.color), ghost, copy, caret, menu, paste: menu.querySelector<HTMLDivElement>('.is-paste')!, pulse: click, worker: person, text: name.textContent ?? '' }]
  })
  const cells: Cell[] = grids.flatMap(grid => Array.from(grid.querySelectorAll<HTMLElement>('[data-build-cell]')).map(node => {
    const style = getComputedStyle(node)
    return { node, index: Number(node.dataset.buildCell), box: blankBox(), fill: style.backgroundColor, opacity: Number(style.opacity), outline: rect('#a8c99a') }
  }))

  const measure = () => {
    if (disposed) return
    const ancestors = new Set<HTMLElement>()
    for (const root of [...tools, ...grids]) {
      let parent: HTMLElement | null = root
      while (parent && parent !== scene) { ancestors.add(parent); parent = parent.parentElement }
    }
    const saved = Array.from(ancestors, node => ({ node, value: node.style.getPropertyValue('transform'), priority: node.style.getPropertyPriority('transform') }))
    saved.forEach(({ node }) => node.style.setProperty('transform', 'none', 'important'))
    try {
      tiles.forEach(tile => {
        tile.box = relative(tile.node.getBoundingClientRect())
        tile.iconBox = relative(tile.icon.getBoundingClientRect())
        tile.nameBox = relative(tile.name.getBoundingClientRect())
        placeRect(tile.outline, tile.box, tile.radius)
        place(tile.ghost, tile.nameBox)
        const typography = getComputedStyle(tile.name)
        for (const property of ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color']) tile.ghost.style.setProperty(property, typography.getPropertyValue(property))
        tile.menuBox = undefined
      })
      cells.forEach(cell => { cell.box = relative(cell.node.getBoundingClientRect()); placeRect(cell.outline, cell.box, 1) })
    } finally {
      saved.forEach(({ node, value, priority }) => value ? node.style.setProperty('transform', value, priority) : node.style.removeProperty('transform'))
    }
  }
  measure()
  ScrollTrigger.addEventListener('refreshInit', measure)

  const iconPoint = (tile: Tile): Point => ({ x: tile.iconBox.x + tile.iconBox.width / 2, y: tile.iconBox.y + tile.iconBox.height / 2 })
  const lockMenu = (tile: Tile) => {
    const host = scene.getBoundingClientRect(), anchor = iconPoint(tile)
    const width = Math.min(148, innerWidth - 16), height = 100
    const left = 8 - host.left, top = 8 - host.top
    const bottomReserve = innerWidth < 768 ? 83 : 8
    const right = innerWidth - host.left - width - 8, bottom = innerHeight - host.top - height - bottomReserve
    const clamp = (x: number, y: number): Box => ({ x: Math.max(left, Math.min(right, x)), y: Math.max(top, Math.min(bottom, y)), width, height })
    const candidates = [clamp(anchor.x + 8, anchor.y + 8), clamp(anchor.x - width - 8, anchor.y + 8), clamp(anchor.x + 8, anchor.y - height - 8), clamp(anchor.x - width - 8, anchor.y - height - 8), clamp(left, top), clamp(right, top), clamp(left, bottom), clamp(right, bottom)]
    const otherMenus = Array.from(document.querySelectorAll<HTMLElement>('[data-construction-menu]')).filter(menu => menu !== tile.menu && getComputedStyle(menu).visibility !== 'hidden' && Number(getComputedStyle(menu).opacity) > .05).map(menu => menu.getBoundingClientRect())
    const score = (candidate: Box) => otherMenus.reduce((sum, other) => sum + Math.max(0, Math.min(candidate.x + host.left + width + 5, other.right) - Math.max(candidate.x + host.left - 5, other.left)) * Math.max(0, Math.min(candidate.y + host.top + height + 5, other.bottom) - Math.max(candidate.y + host.top - 5, other.top)), 0)
    tile.menuBox = candidates.reduce((best, next) => score(next) < score(best) ? next : best)
    place(tile.menu, tile.menuBox)
  }
  const menuEvent = (tile: Tile, action: 'open' | 'close') => {
    if (!disposed) document.dispatchEvent(new CustomEvent(`assembly:menu-${action}`, { detail: { menu: tile.menu, owner: tile.worker.cursor } }))
  }

  const span = Math.max(.8, end - start)
  const menuStep = tiles.length > 1 ? (span - .86) / (tiles.length - 1) : 0
  tiles.forEach((tile, index) => {
    const at = start + .46 + index * menuStep
    const begin = at - .46
    const person = tile.worker
    const origin = () => pointOn(tile.outline, 0)
    const afterOutline = () => pointOn(tile.outline, 1)
    const nameStart = (): Point => ({ x: tile.nameBox.x, y: tile.nameBox.y + tile.nameBox.height * .65 })
    const nameEnd = (): Point => ({ x: tile.nameBox.x + tile.nameBox.width, y: tile.nameBox.y + tile.nameBox.height * .65 })
    const pastePoint = (): Point => { if (!tile.menuBox) lockMenu(tile); return { x: tile.menuBox!.x + 63, y: tile.menuBox!.y + 82 } }
    gsap.set(tile.node, { backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)' })
    gsap.set([tile.icon, tile.name, ...(tile.dot ? [tile.dot] : [])], { opacity: 0 })
    gsap.set([tile.ghost, tile.menu, tile.pulse], { autoAlpha: 0 })
    arrive(person, origin, begin, .15, `Draw ${tile.text} tile`)
    draw(person, tile.outline, begin + .15, .22, `Draw ${tile.text} tile`)
    timeline.fromTo(tile.node, { backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)' }, { backgroundColor: tile.fill, borderColor: tile.border, duration: .065, immediateRender: false }, begin + .35)
    travel(person, afterOutline, () => iconPoint(tile), begin + .37, .06, `Right click · ${tile.text}`)
    pulse(tile, () => iconPoint(tile), begin + .43)
    timeline.fromTo(tile.menu, { autoAlpha: 0 }, {
      autoAlpha: 1, duration: .025, immediateRender: false,
      onStart: () => { lockMenu(tile); menuEvent(tile, 'open') },
      onReverseComplete: () => menuEvent(tile, 'close'),
    }, at)
    travel(person, () => iconPoint(tile), pastePoint, at + .025, .085, `Paste ${tile.text} icon`)
    timeline.fromTo(tile.paste, { backgroundColor: 'rgba(168,201,154,0)' }, { backgroundColor: 'rgba(168,201,154,.22)', duration: .025, immediateRender: false }, at + .105)
    pulse(tile, pastePoint, at + .115)
    // The asset appears at its final coordinates only after the explicit Paste click.
    timeline.fromTo(tile.icon, { opacity: 0, scale: .98 }, { opacity: 1, scale: 1, duration: .06, ease: 'power1.out', immediateRender: false }, at + .12)
    timeline.to(tile.menu, { autoAlpha: 0, duration: .025, immediateRender: false, onComplete: () => menuEvent(tile, 'close'), onReverseComplete: () => menuEvent(tile, 'open') }, at + .18)
    travel(person, pastePoint, nameStart, at + .205, .065, `Type ${tile.text}`)
    const writing = { value: 0 }
    timeline.fromTo(tile.ghost, { autoAlpha: 0 }, { autoAlpha: 1, duration: .001, immediateRender: false }, at + .27)
    timeline.fromTo(writing, { value: 0 }, {
      value: 1, duration: .12, ease: `steps(${Math.max(1, tile.text.length)})`, immediateRender: false,
      onUpdate: () => {
        tile.copy.textContent = tile.text.slice(0, Math.round(tile.text.length * writing.value))
        const caret = relative(tile.caret.getBoundingClientRect())
        setCursor(person, { x: caret.x, y: caret.y + caret.height * .7 }, `Type ${tile.text}`)
      },
    }, at + .27)
    timeline.fromTo(tile.name, { opacity: 0 }, { opacity: 1, duration: .001, immediateRender: false }, at + .39)
    timeline.to(tile.ghost, { autoAlpha: 0, duration: .001, immediateRender: false }, at + .39)
    if (tile.dot) timeline.fromTo(tile.dot, { opacity: 0 }, { opacity: .8, duration: .025, immediateRender: false }, at + .375)
    person.last = nameEnd
    person.finish = at + .4
  })
  techWorkers.forEach(returnHome)

  if (cells.length) {
    const painters = [worker('Jun', 'Ava', true), worker('Sol', 'Eli', true), worker('Bea', 'Finn', true), worker('Otto', 'Zoe', true), worker('Luz', 'Remy', true), worker('Ash', 'Kai', true)]
    const maxWeek = Math.max(...cells.map(cell => Math.floor(cell.index / 7))) + 1
    const ordered = [...cells].sort((a, b) => {
      const aWeek = Math.floor(a.index / 7), bWeek = Math.floor(b.index / 7)
      return aWeek - bWeek || (aWeek % 2 ? b.index % 7 - a.index % 7 : a.index % 7 - b.index % 7)
    })
    painters.forEach((person, workerIndex) => {
      const assigned = ordered.filter(cell => Math.min(painters.length - 1, Math.floor(Math.floor(cell.index / 7) / maxWeek * painters.length)) === workerIndex)
      const unit = (span - .25) / Math.max(1, assigned.length)
      assigned.forEach((cell, index) => {
        const at = start + .25 + index * unit
        cell.outline.setAttribute('stroke', person.actor.color)
        gsap.set(cell.node, { opacity: 0, backgroundColor: 'rgba(0,0,0,0)' })
        const origin = () => pointOn(cell.outline, 0)
        if (!person.last) arrive(person, origin, start, .25, 'Draw activity squares')
        else travel(person, person.last, origin, at, unit * .27, 'Draw activity squares')
        draw(person, cell.outline, at + unit * .27, unit * .48, 'Draw activity squares')
        timeline.fromTo(cell.node, { opacity: 0, backgroundColor: 'rgba(0,0,0,0)' }, { opacity: cell.opacity, backgroundColor: cell.fill, duration: unit * .25, ease: 'none', immediateRender: false }, at + unit * .75)
        person.last = () => pointOn(cell.outline, 1)
        person.finish = at + unit
      })
      returnHome(person)
    })
  }

  return () => {
    disposed = true
    ScrollTrigger.removeEventListener('refreshInit', measure)
    layer.remove()
  }
}
