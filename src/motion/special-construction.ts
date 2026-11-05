import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { collaborators, createCursor, type Collaborator } from './design-tools'
import { constructionMenuPosition, keepConstructionMenuInView, releaseConstructionMenu } from './menu-placement'
import { getMotionRect, getCreationSourcePoint, invalidateMotionFrame } from './motion-frame'
import { queueMotionRead, cancelMotionRead } from './motion-read'
import './special-construction.css'

type SpecialConstructionOptions = {
  scene: HTMLElement
  overlay: HTMLElement
  timeline: gsap.core.Timeline
  start?: number
  end?: number
}

type Point = { x: number; y: number }
type Box = Point & { width: number; height: number }
type Worker = {
  actor: Collaborator; cursor: HTMLDivElement; last?: () => Point; finish: number
  action: HTMLElement | null; setX: (value: number) => void; setY: (value: number) => void
  x: number; y: number; label: string; edge: string; vertical: string; revision: number
}
type Tile = {
  node: HTMLElement; icon: HTMLElement; name: HTMLElement; dot: HTMLElement | null
  box: Box; iconBox: Box; nameBox: Box; fill: string; border: string; radius: number
  outline: SVGRectElement; ghost: HTMLDivElement; copy: HTMLSpanElement; caret: HTMLSpanElement
  menu: HTMLDivElement; paste: HTMLDivElement; pulse: HTMLDivElement; menuBox?: Box
  worker: Worker; text: string
  typedCount: number; caretPositions: Map<number, Point>
}
type Cell = { node: HTMLElement; index: number; box: Box; fill: string; opacity: number; outline: SVGRectElement; dragWidth: number; dragHeight: number; dragRadius: number }

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
  const relative = (rect: DOMRect, host = getMotionRect(scene)): Box => {
    return { x: rect.left - host.left - scene.clientLeft + scene.scrollLeft, y: rect.top - host.top - scene.clientTop + scene.scrollTop, width: rect.width, height: rect.height }
  }
  const liveSource = (): Point => getCreationSourcePoint(scene)
  const place = (node: HTMLElement, box: Box) => Object.assign(node.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` })
  const placeRect = (node: SVGRectElement, box: Box, radius: number) => {
    node.setAttribute('x', String(box.x + .5))
    node.setAttribute('y', String(box.y + .5))
    node.setAttribute('width', String(Math.max(.5, box.width - 1)))
    node.setAttribute('height', String(Math.max(.5, box.height - 1)))
    node.setAttribute('rx', String(radius))
  }
  const outlineGeometry = new WeakMap<SVGRectElement, { length: number; start: Point; end: Point; progress: number; point: Point }>()
  const cacheOutline = (outline: SVGRectElement) => {
    const length = outline.getTotalLength()
    const start = outline.getPointAtLength(0), end = outline.getPointAtLength(length)
    outlineGeometry.set(outline, { length, start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y }, progress: 0, point: { x: start.x, y: start.y } })
  }
  const pointOn = (outline: SVGRectElement, progress: number): Point => {
    const geometry = outlineGeometry.get(outline)!
    const value = Math.min(1, Math.max(0, progress))
    if (value === 0) return geometry.start
    if (value === 1) return geometry.end
    if (value !== geometry.progress) {
      const point = outline.getPointAtLength(geometry.length * value)
      geometry.point = { x: point.x, y: point.y }
      geometry.progress = value
    }
    return geometry.point
  }
  const workers: Worker[] = []
  const worker = (name: string, model: string, painter = false): Worker => {
    const original = collaborators.find(actor => actor.name === model) ?? collaborators[0]
    const actor = { ...original, name }
    const cursor = createCursor(actor)
    cursor.classList.add('special-builder-cursor', 'assembly-cursor--helper')
    if (painter) cursor.classList.add('special-builder-painter')
    layer.append(cursor)
    gsap.set(cursor, { autoAlpha: 0 })
    const person: Worker = {
      actor, cursor, finish: start, action: cursor.querySelector<HTMLElement>('.assembly-cursor-action'),
      setX: gsap.quickSetter(cursor, 'x', 'px') as (value: number) => void,
      setY: gsap.quickSetter(cursor, 'y', 'px') as (value: number) => void,
      x: NaN, y: NaN, label: '', edge: '', vertical: '', revision: 0,
    }
    workers.push(person)
    return person
  }
  const setCursor = (person: Worker, point: Point, action: string) => {
    if (disposed) return
    const host = getMotionRect(scene)
    ++person.revision
    if (person.x !== point.x) { person.setX(point.x); person.x = point.x }
    if (person.y !== point.y) { person.setY(point.y); person.y = point.y }
    if (person.label !== action) { if (person.action) person.action.textContent = action; person.label = action }
    const edge = host.left + point.x > innerWidth - 145 ? 'right' : 'left'
    const vertical = host.top + point.y > innerHeight - 75 ? 'above' : 'below'
    if (person.edge !== edge) { person.cursor.dataset.edge = edge; person.edge = edge }
    if (person.vertical !== vertical) { person.cursor.dataset.vertical = vertical; person.vertical = vertical }
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
      timeline.call(() => setCursor(person, liveSource(), action), [], at)
      timeline.fromTo(person.cursor, { autoAlpha: 0, scale: .18, x: () => liveSource().x, y: () => liveSource().y }, { autoAlpha: 1, scale: 1, duration: .035, immediateRender: false }, at)
      travel(person, liveSource, to, at + .035, Math.max(.02, duration - .035), action)
    } else travel(person, person.last, to, at, duration, action)
  }
  const returnHome = (person: Worker, flight = .54, shrink = .06, readKey?: object) => {
    if (!person.last) return
    if (readKey) timeline.call(() => cancelMotionRead(readKey), [], person.finish)
    travel(person, person.last, liveSource, person.finish, flight, 'Back to the source')
    timeline.to(person.cursor, { autoAlpha: 0, scale: .18, duration: shrink, immediateRender: false }, person.finish + flight)
  }
  const draw = (person: Worker, outline: SVGRectElement, at: number, duration: number, action: string) => {
    const progress = { value: 0 }
    gsap.set(outline, { autoAlpha: 0, strokeDashoffset: 1 })
    timeline.fromTo(outline, { autoAlpha: 0 }, { autoAlpha: 1, duration: .012, immediateRender: false }, at)
    timeline.fromTo(progress, { value: 0 }, {
      value: 1, duration, ease: 'none', immediateRender: false,
      onUpdate: () => {
        const offset = String(1 - progress.value)
        if (outline.style.strokeDashoffset !== offset) outline.style.strokeDashoffset = offset
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
    menu.dataset.menuActive = 'false'
    menu.classList.add('construction-menu-inactive')
    menu.innerHTML = '<div class="special-builder-menu-heading">CLIPBOARD</div><div class="special-builder-menu-row is-muted"><span>Cut</span><kbd>⌘ X</kbd></div><div class="special-builder-menu-row is-muted"><span>Copy</span><kbd>⌘ C</kbd></div><div class="special-builder-menu-row is-paste"><span>↳ &nbsp;Paste</span><kbd>⌘ V</kbd></div>'
    const click = make('special-builder-click-pulse')
    click.style.setProperty('--special-color', person.actor.color)
    return [{ node, icon, name, dot: node.querySelector<HTMLElement>('[data-tech-dot]'), box: blankBox(), iconBox: blankBox(), nameBox: blankBox(), fill: style.backgroundColor, border: style.borderTopColor, radius: parseFloat(style.borderTopLeftRadius) || 6, outline: rect(person.actor.color), ghost, copy, caret, menu, paste: menu.querySelector<HTMLDivElement>('.is-paste')!, pulse: click, worker: person, text: name.textContent ?? '', typedCount: -1, caretPositions: new Map<number, Point>() }]
  })
  const cells: Cell[] = grids.flatMap(grid => Array.from(grid.querySelectorAll<HTMLElement>('[data-build-cell]')).map(node => {
    const style = getComputedStyle(node)
    return { node, index: Number(node.dataset.buildCell), box: blankBox(), fill: style.backgroundColor, opacity: Number(style.opacity), outline: rect('#a8c99a'), dragWidth: NaN, dragHeight: NaN, dragRadius: NaN }
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
      const host = scene.getBoundingClientRect()
      const typographyProperties = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color']
      const tileMeasurements = tiles.map(tile => {
        const typography = getComputedStyle(tile.name)
        return {
          tile, box: relative(tile.node.getBoundingClientRect(), host),
          iconBox: relative(tile.icon.getBoundingClientRect(), host), nameBox: relative(tile.name.getBoundingClientRect(), host),
          typography: typographyProperties.map(property => typography.getPropertyValue(property)),
        }
      })
      const cellMeasurements = cells.map(cell => ({ cell, box: relative(cell.node.getBoundingClientRect(), host) }))
      // Read the entire natural layout before writing any overlay geometry.
      tileMeasurements.forEach(({ tile, box, iconBox, nameBox, typography }) => {
        tile.box = box
        tile.iconBox = iconBox
        tile.nameBox = nameBox
        placeRect(tile.outline, tile.box, tile.radius)
        place(tile.ghost, tile.nameBox)
        typographyProperties.forEach((property, index) => tile.ghost.style.setProperty(property, typography[index]))
        if (tile.menu.dataset.menuReserved !== 'true') tile.menuBox = undefined
        cancelMotionRead(tile)
        tile.caretPositions.clear()
      })
      cellMeasurements.forEach(({ cell, box }) => {
        cell.box = box
        placeRect(cell.outline, cell.box, 1)
        cell.dragWidth = cell.box.width - 1; cell.dragHeight = cell.box.height - 1; cell.dragRadius = 1
      })
      tiles.forEach(tile => cacheOutline(tile.outline))
    } finally {
      saved.forEach(({ node, value, priority }) => value ? node.style.setProperty('transform', value, priority) : node.style.removeProperty('transform'))
      invalidateMotionFrame()
    }
  }
  measure()
  const cursorSnapshot = new Map<Worker, Point>()
  const captureCursors = () => {
    if (disposed) return
    cursorSnapshot.clear()
    workers.forEach(person => {
      const x = Number(gsap.getProperty(person.cursor, 'x')), y = Number(gsap.getProperty(person.cursor, 'y'))
      if (Number.isFinite(x) && Number.isFinite(y)) cursorSnapshot.set(person, { x, y })
    })
  }
  const restoreCursors = () => {
    if (disposed) return
    tiles.forEach(tile => cancelMotionRead(tile))
    cursorSnapshot.forEach((point, person) => {
      ++person.revision
      person.x = point.x
      person.y = point.y
      person.setX(point.x)
      person.setY(point.y)
    })
    cursorSnapshot.clear()
  }
  ScrollTrigger.addEventListener('refreshInit', captureCursors)
  ScrollTrigger.addEventListener('refreshInit', measure)
  ScrollTrigger.addEventListener('refresh', restoreCursors)
  document.fonts?.addEventListener('loadingdone', measure)

  const iconPoint = (tile: Tile): Point => ({ x: tile.iconBox.x + tile.iconBox.width / 2, y: tile.iconBox.y + tile.iconBox.height / 2 })
  const lockMenu = (tile: Tile) => {
    tile.menuBox = constructionMenuPosition(tile.menu, scene, iconPoint(tile), true, tile.box)
    place(tile.menu, tile.menuBox)
  }
  const placeLockedMenu = (tile: Tile) => {
    if (!tile.menuBox || (tile.menu.dataset.menuActive === 'true' && tile.menu.dataset.menuReserved !== 'true')) lockMenu(tile)
    tile.menuBox = keepConstructionMenuInView(tile.menu, scene, tile.menuBox!)
    place(tile.menu, tile.menuBox)
  }
  const menuState = (tile: Tile, active: boolean) => {
    if (tile.menu.dataset.menuActive !== String(active)) {
      tile.menu.dataset.menuActive = String(active)
      tile.menu.classList.toggle('construction-menu-inactive', !active)
    } else if (!active && tile.menu.dataset.menuReserved !== 'true') return
    if (active) placeLockedMenu(tile)
    // Retain the final Paste coordinates for the cursor's trip to the name.
    // Releasing a closed menu must not relocate that outbound trip.
    else releaseConstructionMenu(tile.menu)
  }
  const menuEvent = (tile: Tile, action: 'open' | 'close') => {
    menuState(tile, action === 'open')
    if (!disposed) document.dispatchEvent(new CustomEvent(`assembly:menu-${action}`, { detail: { menu: tile.menu, owner: tile.worker.cursor } }))
  }

  const span = Math.max(.8, end - start)
  const menuStep = tiles.length > 1 ? (span - .86) / (tiles.length - 1) : 0
  const menuWindows: { tile: Tile; open: number; close: number }[] = []
  tiles.forEach((tile, index) => {
    const at = start + .46 + index * menuStep
    menuWindows.push({ tile, open: at, close: at + .205 })
    const begin = at - .46
    const person = tile.worker
    const origin = () => pointOn(tile.outline, 0)
    const afterOutline = () => pointOn(tile.outline, 1)
    const nameStart = (): Point => ({ x: tile.nameBox.x, y: tile.nameBox.y + tile.nameBox.height * .65 })
    const nameEnd = (): Point => ({ x: tile.nameBox.x + tile.nameBox.width, y: tile.nameBox.y + tile.nameBox.height * .65 })
    const pastePoint = (): Point => { placeLockedMenu(tile); return { x: tile.menuBox!.x + 63, y: tile.menuBox!.y + 82 } }
    gsap.set(tile.node, { backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)' })
    gsap.set([tile.icon, tile.name, ...(tile.dot ? [tile.dot] : [])], { opacity: 0 })
    gsap.set([tile.ghost, tile.menu, tile.pulse], { autoAlpha: 0 })
    timeline.call(() => cancelMotionRead(tile), [], begin)
    arrive(person, origin, begin, .15, `Draw ${tile.text} tile`)
    draw(person, tile.outline, begin + .15, .22, `Draw ${tile.text} tile`)
    timeline.fromTo(tile.node, { backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)' }, { backgroundColor: tile.fill, borderColor: tile.border, duration: .065, immediateRender: false }, begin + .35)
    travel(person, afterOutline, () => iconPoint(tile), begin + .37, .06, `Right click · ${tile.text}`)
    pulse(tile, () => iconPoint(tile), begin + .43)
    timeline.fromTo(tile.menu, { autoAlpha: 0 }, {
      autoAlpha: 1, duration: .025, immediateRender: false,
      onStart: () => menuEvent(tile, 'open'),
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
        const count = Math.round(tile.text.length * writing.value)
        if (tile.typedCount !== count) { tile.copy.textContent = tile.text.slice(0, count); tile.typedCount = count }
        const point = tile.caretPositions.get(count)
        if (point) {
          cancelMotionRead(tile)
          setCursor(person, point, `Type ${tile.text}`)
        } else {
          const revision = person.revision
          queueMotionRead(tile, () => {
            if (disposed || tile.typedCount !== count || person.revision !== revision) return
            const caret = relative(tile.caret.getBoundingClientRect())
            const measured = { x: caret.x, y: caret.y + caret.height * .7 }
            tile.caretPositions.set(count, measured)
            return () => {
              if (!disposed && tile.typedCount === count && person.revision === revision) setCursor(person, measured, `Type ${tile.text}`)
            }
          })
        }
      },
    }, at + .27)
    timeline.call(() => cancelMotionRead(tile), [], at + .39)
    timeline.fromTo(tile.name, { opacity: 0 }, { opacity: 1, duration: .001, immediateRender: false }, at + .39)
    timeline.to(tile.ghost, { autoAlpha: 0, duration: .001, immediateRender: false }, at + .39)
    if (tile.dot) timeline.fromTo(tile.dot, { opacity: 0 }, { opacity: .8, duration: .025, immediateRender: false }, at + .375)
    person.last = nameEnd
    person.finish = at + .4
    returnHome(person, index + techWorkers.length < tiles.length ? .18 : .54, index + techWorkers.length < tiles.length ? .025 : .06, tile)
    person.last = undefined
  })

  if (cells.length) {
    const builderNames = ['Jun', 'Sol', 'Bea', 'Otto', 'Luz', 'Ash', 'Inez', 'Keir', 'Nia', 'Theo', 'Veda', 'Wren']
    const coloristNames = ['Cora', 'Ezra', 'Faye', 'Hugo', 'Indi', 'Juno', 'Kian', 'Leni', 'Noor', 'Oren', 'Rhea', 'Sage']
    const models = ['Ava', 'Eli', 'Finn', 'Zoe', 'Remy', 'Kai', 'Mia', 'Noah', 'Leo', 'Iris', 'Sam', 'You']
    const builders = builderNames.map((name, index) => {
      const person = worker(name, models[index], true)
      person.cursor.classList.add('special-grid-builder')
      return person
    })
    const colorists = coloristNames.map((name, index) => {
      const person = worker(name, models[(index + 3) % models.length], true)
      person.cursor.classList.add('special-grid-colorist')
      const swatch = document.createElement('span')
      swatch.className = 'special-grid-paint-swatch'
      person.cursor.append(swatch)
      const selection = make('special-grid-selection')
      selection.innerHTML = '<i></i><i></i><i></i><i></i>'
      selection.style.setProperty('--special-color', person.actor.color)
      const click = make('special-grid-select-pulse')
      click.style.setProperty('--special-color', person.actor.color)
      gsap.set([selection, click], { autoAlpha: 0 })
      return { person, swatch, selection, click }
    })
    const maxWeek = Math.max(...cells.map(cell => Math.floor(cell.index / 7))) + 1
    const ordered = [...cells].sort((a, b) => {
      const aWeek = Math.floor(a.index / 7), bWeek = Math.floor(b.index / 7)
      return aWeek - bWeek || (aWeek % 2 ? b.index % 7 - a.index % 7 : a.index % 7 - b.index % 7)
    })
    const strips = builders.map((_, workerIndex) => ordered.filter(cell => Math.min(builders.length - 1, Math.floor(Math.floor(cell.index / 7) / maxWeek * builders.length)) === workerIndex))
    const taskSize = 7
    const taskCount = Math.max(...strips.map(strip => Math.ceil(strip.length / taskSize)))
    const crewStagger = .01
    const handoffLag = .24
    const taskPeriod = (span - crewStagger * (builders.length - 1) - handoffLag) / taskCount
    const entry = Math.min(.20, taskPeriod * .20)
    const quickReturn = Math.min(.20, taskPeriod * .20)
    const unit = (taskPeriod - entry - quickReturn - .025) / taskSize
    const neutral = '#30382b'

    strips.forEach((assigned, crewIndex) => {
      const builder = builders[crewIndex]
      const { person: colorist, swatch, selection, click } = colorists[crewIndex]
      const groups = Array.from({ length: Math.ceil(assigned.length / taskSize) }, (_, groupIndex) => assigned.slice(groupIndex * taskSize, (groupIndex + 1) * taskSize))
      groups.forEach((group, groupIndex) => {
        const taskAt = start + crewIndex * crewStagger + groupIndex * taskPeriod
        group.forEach((cell, cellIndex) => {
          const buildAt = taskAt + entry + cellIndex * unit
          const colorAt = buildAt + handoffLag
          const topLeft = (): Point => ({ x: cell.box.x + .5, y: cell.box.y + .5 })
          const bottomRight = (): Point => ({ x: cell.box.x + cell.box.width - .5, y: cell.box.y + cell.box.height - .5 })
          const center = (): Point => ({ x: cell.box.x + cell.box.width / 2, y: cell.box.y + cell.box.height / 2 })
          const number = String(cell.index + 1).padStart(3, '0')
          const paintLabel = '#' + (cell.fill.match(/\d+/g)?.slice(0, 3).map(channel => Number(channel).toString(16).padStart(2, '0')).join('').toUpperCase() ?? '30382B')
          cell.outline.classList.add('special-grid-drag-rect')
          cell.outline.setAttribute('stroke', builder.actor.color)
          gsap.set(cell.outline, { autoAlpha: 0 })
          gsap.set(cell.node, { opacity: 0, backgroundColor: 'rgba(0,0,0,0)' })

          // A task is one complete seven-day column, followed by a source-box visit.
          if (!cellIndex) arrive(builder, topLeft, taskAt, entry, `Rectangle strip ${groupIndex + 1}`)
          else travel(builder, builder.last!, topLeft, buildAt, unit * .24, `Draw square ${number}`)
          const dragAt = buildAt + unit * .24
          const dragging = { value: 0 }
          timeline.fromTo(cell.outline, { autoAlpha: 0 }, { autoAlpha: 1, duration: unit * .04, immediateRender: false }, dragAt)
          timeline.fromTo(dragging, { value: 0 }, {
            value: 1, duration: unit * .48, ease: 'none', immediateRender: false,
            onUpdate: () => {
              const draggedWidth = (cell.box.width - 1) * dragging.value
              const draggedHeight = (cell.box.height - 1) * dragging.value
              const width = Math.max(.5, draggedWidth)
              const height = Math.max(.5, draggedHeight)
              const radius = Math.min(1, width / 2, height / 2)
              if (cell.dragWidth !== width) { cell.outline.setAttribute('width', String(width)); cell.dragWidth = width }
              if (cell.dragHeight !== height) { cell.outline.setAttribute('height', String(height)); cell.dragHeight = height }
              if (cell.dragRadius !== radius) { cell.outline.setAttribute('rx', String(radius)); cell.dragRadius = radius }
              setCursor(builder, { x: cell.box.x + .5 + draggedWidth, y: cell.box.y + .5 + draggedHeight }, `Drag square ${number}`)
            },
          }, dragAt)
          // Releasing the diagonal drag places a neutral, still-unpainted real square.
          timeline.fromTo(cell.node, { opacity: 0, backgroundColor: neutral }, { opacity: 1, backgroundColor: neutral, duration: unit * .08, immediateRender: false }, buildAt + unit * .72)
          timeline.to(cell.outline, { autoAlpha: 0, duration: unit * .1, immediateRender: false }, buildAt + unit * .8)
          builder.last = bottomRight
          builder.finish = buildAt + unit

          if (!cellIndex) {
            arrive(colorist, center, taskAt + handoffLag, entry, `Color strip ${groupIndex + 1}`)
            timeline.set(swatch, { backgroundColor: cell.fill }, taskAt + handoffLag)
          } else travel(colorist, colorist.last!, center, colorAt, unit * .24, `Select square ${number}`)
          timeline.set(swatch, { backgroundColor: cell.fill }, colorAt)
          const clickAt = colorAt + unit * .24
          timeline.set(selection, { left: () => cell.box.x - 2, top: () => cell.box.y - 2, width: () => cell.box.width + 4, height: () => cell.box.height + 4 }, clickAt)
          timeline.set(click, { left: () => center().x, top: () => center().y }, clickAt)
          timeline.fromTo(selection, { autoAlpha: 0 }, { autoAlpha: 1, duration: unit * .04, immediateRender: false }, clickAt)
          timeline.fromTo(click, { autoAlpha: 0, scale: .45 }, {
            autoAlpha: 1, scale: 1.1, duration: unit * .09, immediateRender: false,
            onUpdate: () => setCursor(colorist, center(), `Select square ${number}`),
          }, clickAt)
          timeline.to(click, { autoAlpha: 0, scale: 1.7, duration: unit * .09, immediateRender: false }, clickAt + unit * .09)
          // The explicit selection click must finish before the final color is applied.
          timeline.fromTo(cell.node, { opacity: 1, backgroundColor: neutral }, {
            opacity: cell.opacity, backgroundColor: cell.fill, duration: unit * .32, ease: 'none', immediateRender: false,
            onUpdate: () => setCursor(colorist, center(), `Paint ${paintLabel}`),
          }, colorAt + unit * .42)
          timeline.to(selection, { autoAlpha: 0, duration: unit * .18, immediateRender: false }, colorAt + unit * .76)
          colorist.last = center
          colorist.finish = colorAt + unit
        })
        const isLastTask = groupIndex === groups.length - 1
        returnHome(builder, isLastTask ? .54 : quickReturn, isLastTask ? .06 : .02)
        returnHome(colorist, isLastTask ? .54 : quickReturn, isLastTask ? .06 : .02)
        builder.last = undefined
        colorist.last = undefined
      })
    })
  }

  const menuClock = { value: 0 }
  timeline.to(menuClock, { value: 1, duration: timeline.duration(), ease: 'none', onUpdate: () => {
    const time = timeline.time()
    menuWindows.forEach(({ tile, open, close }) => menuState(tile, time >= open && time < close))
  } }, 0)

  return () => {
    disposed = true
    tiles.forEach(tile => { cancelMotionRead(tile); releaseConstructionMenu(tile.menu) })
    ScrollTrigger.removeEventListener('refreshInit', captureCursors)
    ScrollTrigger.removeEventListener('refreshInit', measure)
    ScrollTrigger.removeEventListener('refresh', restoreCursors)
    document.fonts?.removeEventListener('loadingdone', measure)
    layer.remove()
  }
}
