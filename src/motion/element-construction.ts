import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { collaborators, createCursor, type Collaborator } from './design-tools'
import { addSpecialConstruction } from './special-construction'
import { constructionMenuPosition, keepConstructionMenuInView, releaseConstructionMenu } from './menu-placement'
import { getMotionRect, getCreationSourcePoint, invalidateMotionFrame } from './motion-frame'
import { queueMotionRead, cancelMotionRead } from './motion-read'
import './element-construction.css'

type ElementConstructionOptions = {
  scene: HTMLElement
  overlay: HTMLElement
  timeline: gsap.core.Timeline
  targets: HTMLElement[]
  start?: number
  end?: number
  skip?: HTMLElement[]
}

type Piece = HTMLElement | SVGElement
type Box = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }
type Worker = {
  actor: Collaborator; cursor: HTMLDivElement; load: number; artwork: boolean; jobs: Job[]
  action: HTMLElement | null; setX: (value: number) => void; setY: (value: number) => void
  x: number; y: number; label: string; edge: string; vertical: string; revision: number
}
type Job = {
  leaf: Piece
  kind: 'copy' | 'formatted' | 'art'
  text: string
  action: string
  worker: Worker
  at: number
  weight: number
  box: Box
  workBox: Box
  frame: HTMLDivElement
  ghost?: HTMLDivElement
  copy?: HTMLSpanElement
  caret: HTMLSpanElement
  menu?: HTMLDivElement
  paste?: HTMLDivElement
  pulse?: HTMLDivElement
  menuBox?: Box
  pasted: boolean
  progress: { write: number }
  typedCount: number
  caretPositions: Map<number, Point>
  natural: { x: number; y: number; scaleX: number; scaleY: number }
}

const atomicSelector = '[data-construction-atom], svg, img, canvas'
const excludedSelector = '.assembly-overlay, [data-construction-exempt], [data-build-tech], [data-build-grid], script, style, noscript, template'
const imageSelector = 'svg, img, canvas, [data-construction-atom="icon"]'
const typeProperties = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch',
  'font-variant', 'font-feature-settings', 'line-height', 'letter-spacing',
  'text-transform', 'text-align', 'text-indent', 'text-decoration',
  'word-spacing', 'white-space', 'overflow-wrap', 'word-break', 'color',
] as const

function makeNode<T extends keyof HTMLElementTagNameMap>(tag: T, className: string): HTMLElementTagNameMap[T] {
  const node = document.createElement(tag)
  node.className = className
  node.setAttribute('aria-hidden', 'true')
  return node
}

function directText(node: Element): boolean {
  return Array.from(node.childNodes).some(child => child.nodeType === Node.TEXT_NODE && Boolean(child.textContent?.trim()))
}

function paintedEmptyLeaf(node: Element): boolean {
  if (!(node instanceof HTMLElement) || node.children.length || directText(node)) return false
  const style = getComputedStyle(node)
  const rect = node.getBoundingClientRect()
  if (!rect.width || !rect.height || rect.width > 48 || rect.height > 48) return false
  const painted = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent'
  const bordered = ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(style[`border${side}Width` as 'borderTopWidth']) > 0)
  return painted || bordered || style.backgroundImage !== 'none'
}

/** The first meaningful piece owns its inline formatting and atomic descendants. */
function inventory(scene: HTMLElement, targets: HTMLElement[], skip: HTMLElement[]): Piece[] {
  const selected: Piece[] = []
  const seen = new Set<Element>()
  const claimedAtoms: Element[] = []
  const visit = (node: Element, root: HTMLElement) => {
    if (seen.has(node) || claimedAtoms.some(atom => atom.contains(node)) || node.matches(excludedSelector) || skip.some(excluded => excluded === node || excluded.contains(node))) return
    seen.add(node)
    const owningScene = node.closest('.assembly-scene')
    if (owningScene && owningScene !== scene) return
    // Special construction owns the entire toolkit and chart subtree.
    if (node.closest('[data-build-tech], [data-build-grid]')) return
    const atomic = (node.matches(atomicSelector) && !node.matches('.ps-activity-chart, .ps-tool')) || paintedEmptyLeaf(node)
    const text = node instanceof HTMLElement && directText(node)
    // A bare text or image target is itself a piece. The primary choreography
    // leaves these tags to us, while it continues drawing their empty frames.
    const leafTarget = /^(H[1-3]|P|SPAN|IMG|SVG|CANVAS)$/i.test(node.tagName)
    if ((node !== root || leafTarget) && (atomic || text)) {
      // Do not create hidden DOM, or descendants of an already selected atom.
      const style = getComputedStyle(node)
      if (style.display === 'none' || !node.getClientRects().length) return
      selected.push(node as Piece)
      if (atomic) claimedAtoms.push(node)
      // A formatted text run may contain an image. Keep that image hidden until
      // a separate paste job, after its containing text run is complete.
      if (text && !atomic) {
        for (const image of Array.from(node.querySelectorAll(atomicSelector))) {
          if (seen.has(image) || image.closest('[data-build-tech], [data-build-grid]') || skip.some(excluded => excluded.contains(image))) continue
          const ancestor = image.parentElement?.closest(atomicSelector)
          if (ancestor && node.contains(ancestor)) continue
          if (getComputedStyle(image).display === 'none' || !image.getClientRects().length) continue
          seen.add(image)
          claimedAtoms.push(image)
          selected.push(image as Piece)
        }
      }
      return
    }
    for (const child of Array.from(node.children)) visit(child, root)
  }
  for (const target of targets) visit(target, target)
  return selected
}

function numericProperty(node: Piece, property: string, fallback: number): number {
  const value = Number(gsap.getProperty(node, property))
  return Number.isFinite(value) ? value : fallback
}

function actionFor(leaf: Piece, art: boolean, text: string): string {
  if (art) {
    if (leaf.matches('svg') && (leaf.getBoundingClientRect().width < 50 || leaf.classList.contains('lucide'))) return 'Pasting icon'
    if (leaf.matches('img, canvas') || /art|avatar|chart|grid|illustration/.test(leaf.getAttribute('class') ?? '')) return 'Pasting artwork'
    return 'Pasting a detail'
  }
  if (leaf.matches('h1, h2, h3')) return 'Writing headline'
  if (leaf.matches('p') || text.length > 58) return 'Writing the story'
  if (/symbol|spark|cross|orbit/.test(leaf.getAttribute('class') ?? '')) return 'Placing a symbol'
  if (/technology|technologies|tool|label|index|date|status|year|caption/.test(leaf.getAttribute('class') ?? '') || text.length < 28) return 'Writing a label'
  return 'Writing the details'
}

/**
 * Build a card's real leaf content only after its empty frame has arrived.
 * All semantic nodes stay in place; only decorative ghosts contain changing text.
 * Call inside the assembly GSAP context and before normalizing its duration.
 */
export function addElementConstruction({ scene, overlay, timeline, targets, start = 4.05, end = 9.05, skip = [] }: ElementConstructionOptions): () => void {
  const hasTech = Array.from(scene.querySelectorAll('[data-build-tech]')).some(node => node.closest('.assembly-scene') === scene)
  // Toolkit icon menus receive their own later window. Generic image menus
  // finish first, so only one context menu is ever asking for attention.
  const specialCleanup = scene.matches('.assembly-scene')
    ? addSpecialConstruction({ scene, overlay, timeline, start: hasTech ? start + (end - start) * 0.24 : start, end })
    : () => undefined
  const leaves = inventory(scene, targets, skip)
  if (!leaves.length) return specialCleanup
  const layer = makeNode('div', 'element-builder-layer')
  layer.inert = true
  overlay.append(layer)
  const assignments = [
    ['Dara', 'Leo', false], ['Lina', 'Noah', false], ['Tobin', 'Sam', false], ['Nell', 'Iris', false],
    ['Eden', 'Leo', false], ['Rafi', 'Noah', false], ['Milo', 'Sam', false], ['Uma', 'Iris', false],
    ['Jade', 'You', true], ['Nico', 'Kai', true], ['Ari', 'You', true], ['Cleo', 'Kai', true],
  ] as const
  const workers: Worker[] = assignments.map(([name, model, artwork]) => {
    const baseActor = collaborators.find(collaborator => collaborator.name === model)!
    const actor = { ...baseActor, name }
    const cursor = createCursor(actor)
    cursor.classList.add('element-builder-cursor')
    layer.append(cursor)
    return {
      actor, cursor, load: 0, artwork, jobs: [], action: cursor.querySelector<HTMLElement>('.assembly-cursor-action'),
      setX: gsap.quickSetter(cursor, 'x', 'px') as (value: number) => void,
      setY: gsap.quickSetter(cursor, 'y', 'px') as (value: number) => void,
      x: NaN, y: NaN, label: '', edge: '', vertical: '', revision: 0,
    }
  })
  const jobs: Job[] = []
  const artQueues = Array.from({ length: innerWidth < 768 ? 1 : 2 }, () => 0)
  // The large image gives a card its identity. Paste it before small corner
  // icons consume the same clipboard lane, while the copy crew works in parallel.
  const primaryArtwork = new Set(leaves.filter(leaf => {
    if (!(leaf.matches(imageSelector) || (leaf.matches(atomicSelector) && leaf.querySelector(imageSelector))) || leaf.classList.contains('lucide')) return false
    const rect = leaf.getBoundingClientRect()
    return (rect.width > 64 || rect.height > 64) && !leaves.some(other => other !== leaf && other.contains(leaf))
  }))
  const orderedLeaves = [...leaves.filter(leaf => primaryArtwork.has(leaf)), ...leaves.filter(leaf => !primaryArtwork.has(leaf))]
  let primaryArtworkReady = 0
  for (const leaf of orderedLeaves) {
    const text = (leaf.textContent ?? '').replace(/\s+/g, ' ').trim()
    const art = leaf.matches(atomicSelector) || paintedEmptyLeaf(leaf)
    const pasted = art && (leaf.matches(imageSelector) || Boolean(leaf.querySelector(imageSelector)))
    const formatted = !art && leaf.children.length > 0
    const available = workers.filter(worker => worker.artwork === art)
    const ancestor = jobs.find(job => job.leaf.contains(leaf))
    const lane = artQueues.reduce((best, value, index) => value < artQueues[best] ? index : best, 0)
    const ready = Math.max(ancestor ? ancestor.at + ancestor.weight + 0.18 : 0, pasted ? artQueues[lane] : 0, pasted && !primaryArtwork.has(leaf) ? primaryArtworkReady : 0)
    const worker = available.reduce((best, next) => Math.max(next.load, ready) < Math.max(best.load, ready) ? next : best)
    const weight = art ? pasted ? 1.65 : 0.8 : Math.min(2, 1.15 + text.length / 130)
    const at = Math.max(worker.load, ready)
    // Reserve a complete return trip and a short in-box handoff before this
    // collaborator can leave for another assignment.
    worker.load = at + weight + 0.85 + 0.18
    if (pasted) artQueues[lane] = at + weight + 0.18
    if (primaryArtwork.has(leaf)) primaryArtworkReady = Math.max(primaryArtworkReady, at + weight + .18)
    const frame = makeNode('div', 'element-builder-frame')
    frame.style.setProperty('--element-builder-color', worker.actor.color)
    const caret = makeNode('span', 'element-builder-caret')
    let ghost: HTMLDivElement | undefined
    let copy: HTMLSpanElement | undefined
    let menu: HTMLDivElement | undefined
    let paste: HTMLDivElement | undefined
    let pulse: HTMLDivElement | undefined
    if (!art && !formatted) {
      ghost = makeNode('div', 'element-builder-ghost')
      copy = makeNode('span', 'element-builder-copy')
      ghost.append(copy, caret)
      layer.append(ghost)
    } else if (formatted) {
      caret.classList.add('element-builder-caret--positioned')
      frame.append(caret)
    }
    if (pasted) {
      menu = makeNode('div', 'element-builder-context-menu')
      menu.dataset.constructionMenu = ''
      menu.dataset.menuActive = 'false'
      menu.classList.add('construction-menu-inactive')
      const heading = makeNode('div', 'element-builder-context-heading')
      heading.textContent = 'CLIPBOARD'
      const cut = makeNode('div', 'element-builder-context-row element-builder-context-row--muted')
      cut.innerHTML = '<span>Cut</span><kbd>⌘ X</kbd>'
      const copyRow = makeNode('div', 'element-builder-context-row element-builder-context-row--muted')
      copyRow.innerHTML = '<span>Copy</span><kbd>⌘ C</kbd>'
      paste = makeNode('div', 'element-builder-context-row element-builder-context-row--paste')
      paste.innerHTML = '<span><i>↳</i> Paste</span><kbd>⌘ V</kbd>'
      menu.append(heading, cut, copyRow, paste)
      pulse = makeNode('div', 'element-builder-click-pulse')
      pulse.style.setProperty('--element-builder-color', worker.actor.color)
      layer.append(menu, pulse)
    }
    layer.append(frame)
    const job: Job = {
      leaf, text, kind: art ? 'art' : formatted ? 'formatted' : 'copy', action: actionFor(leaf, art, text),
      worker, at, weight, box: { x: 0, y: 0, width: 0, height: 0 }, workBox: { x: 0, y: 0, width: 0, height: 0 }, frame, ghost, copy, caret, menu, paste, pulse, pasted,
      progress: { write: 0 },
      typedCount: -1, caretPositions: new Map(),
      natural: { x: numericProperty(leaf, 'x', 0), y: numericProperty(leaf, 'y', 0), scaleX: numericProperty(leaf, 'scaleX', 1), scaleY: numericProperty(leaf, 'scaleY', 1) },
    }
    jobs.push(job)
    worker.jobs.push(job)
  }
  const span = Math.max(0.15, end - start)
  const unit = span * (hasTech ? 0.22 : 1) / Math.max(1, ...workers.map(worker => worker.load))
  let disposed = false

  const relativeRect = (rect: DOMRect, host = getMotionRect(scene)): Box => {
    return { x: rect.left - host.left - scene.clientLeft + scene.scrollLeft, y: rect.top - host.top - scene.clientTop + scene.scrollTop, width: rect.width, height: rect.height }
  }
  const placedBoxes = new WeakMap<HTMLElement, Box>()
  const placeBox = (node: HTMLElement, box: Box) => {
    const previous = placedBoxes.get(node)
    if (previous && previous.x === box.x && previous.y === box.y && previous.width === box.width && previous.height === box.height) return
    Object.assign(node.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${Math.max(1, box.width)}px`, height: `${Math.max(1, box.height)}px` })
    placedBoxes.set(node, { ...box })
  }
  const liveSource = (): Point => getCreationSourcePoint(scene)
  const setCursor = (job: Job, x: number, y: number, actionText = job.action) => {
    if (disposed) return
    const host = getMotionRect(scene)
    const worker = job.worker, cursor = worker.cursor
    ++worker.revision
    if (worker.x !== x) { worker.setX(x); worker.x = x }
    if (worker.y !== y) { worker.setY(y); worker.y = y }
    if (worker.label !== actionText) { if (worker.action) worker.action.textContent = actionText; worker.label = actionText }
    const edge = host.left + x > innerWidth - 145 ? 'right' : 'left'
    const vertical = host.top + y > innerHeight - 75 ? 'above' : 'below'
    if (worker.edge !== edge) { cursor.dataset.edge = edge; worker.edge = edge }
    if (worker.vertical !== vertical) { cursor.dataset.vertical = vertical; worker.vertical = vertical }
  }
  const render = (job: Job) => {
    if (disposed) return
    const { box, progress, kind } = job
    placeBox(job.frame, box)
    if (kind === 'copy' && job.copy && job.ghost) {
      const count = Math.round(job.text.length * progress.write)
      if (job.typedCount !== count) { job.copy.textContent = job.text.slice(0, count); job.typedCount = count }
      const point = job.caretPositions.get(count)
      if (point) {
        cancelMotionRead(job)
        setCursor(job, point.x, point.y)
      } else {
        const revision = job.worker.revision
        queueMotionRead(job, () => {
          if (disposed || job.typedCount !== count || job.worker.revision !== revision) return
          const caret = relativeRect(job.caret.getBoundingClientRect())
          const measured = { x: caret.x + 3, y: caret.y + Math.min(caret.height, 13) }
          job.caretPositions.set(count, measured)
          return () => {
            if (!disposed && job.typedCount === count && job.worker.revision === revision) setCursor(job, measured.x, measured.y)
          }
        })
      }
    } else if (kind === 'formatted') {
      const left = `${box.width * progress.write}px`
      if (job.caret.style.left !== left) job.caret.style.left = left
      setCursor(job, box.x + box.width * progress.write, box.y + Math.min(box.height, 18))
    }
  }
  const cursorPoint = (worker: Worker): Point => {
    const source = liveSource()
    return { x: Number.isFinite(worker.x) ? worker.x : source.x, y: Number.isFinite(worker.y) ? worker.y : source.y }
  }
  const anchor = (job: Job): Point => job.kind === 'art'
    ? { x: job.box.x + job.box.width / 2, y: job.box.y + job.box.height / 2 }
    : { x: job.box.x + 2, y: job.box.y + Math.min(16, job.box.height / 2) }
  const placeMenu = (job: Job, lock = false): Box => {
    if (job.menuBox && !lock && job.menu?.dataset.menuReserved === 'true') {
      job.menuBox = keepConstructionMenuInView(job.menu, scene, job.menuBox)
      placeBox(job.menu, job.menuBox)
      return job.menuBox
    }
    const point = anchor(job)
    const box = job.menu ? constructionMenuPosition(job.menu, scene, point, lock, job.workBox) : { ...point, width: 148, height: 100 }
    job.menuBox = box
    if (job.menu) placeBox(job.menu, box)
    if (job.pulse) Object.assign(job.pulse.style, { left: `${point.x - 9}px`, top: `${point.y - 9}px` })
    return box
  }
  const pastePoint = (job: Job): Point => {
    const box = placeMenu(job)
    return { x: box.x + 64, y: box.y + 82 }
  }
  let geometryRevision = 0
  const curvedTravel = (job: Job, from: () => Point, to: () => Point, at: number, duration: number, action: string) => {
    const travel = { value: 0 }
    let origin: Point | undefined
    let originRevision = -1
    const flightOrigin = () => {
      if (!origin || originRevision !== geometryRevision) {
        origin = from()
        originRevision = geometryRevision
      }
      return origin
    }
    timeline.call(flightOrigin, [], at)
    timeline.fromTo(travel, { value: 0 }, {
      value: 1, duration, ease: 'power2.inOut', immediateRender: false,
      onUpdate: () => {
        if (disposed) return
        const departure = flightOrigin()
        const target = to(), t = travel.value, inverse = 1 - t
        const distance = Math.hypot(target.x - departure.x, target.y - departure.y)
        const bend = Math.min(82, Math.max(12, distance * 0.16)) * (job.worker.artwork ? -1 : 1)
        const controlX = (departure.x + target.x) / 2 + bend
        const controlY = (departure.y + target.y) / 2 - Math.abs(bend)
        setCursor(job,
          inverse * inverse * departure.x + 2 * inverse * t * controlX + t * t * target.x,
          inverse * inverse * departure.y + 2 * inverse * t * controlY + t * t * target.y,
          action,
        )
      },
    }, at)
  }
  const measure = () => {
    if (disposed) return
    // A refresh may occur while a parent or an artwork leaf is still in flight.
    // Measure the final layout, then put every live inline transform back exactly.
    const measured = Array.from(new Set<Piece>([...targets, ...leaves]))
    const saved = measured.map(node => ({ value: node.style.getPropertyValue('transform'), priority: node.style.getPropertyPriority('transform') }))
    measured.forEach(node => node.style.setProperty('transform', 'none', 'important'))
    try {
      const host = scene.getBoundingClientRect()
      const paddingProperties = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']
      const measurements = jobs.map(job => {
        const box = relativeRect(job.leaf.getBoundingClientRect(), host)
        const type = job.ghost || job.kind === 'formatted' ? getComputedStyle(job.leaf) : undefined
        return {
          job, box, workBox: relativeRect((job.leaf.closest<HTMLElement>('[data-assemble]') ?? job.leaf).getBoundingClientRect(), host), typography: job.ghost ? typeProperties.map(property => type!.getPropertyValue(property)) : [],
          padding: job.ghost ? paddingProperties.map(property => type!.getPropertyValue(property)) : [],
          borderWidth: type?.borderWidth ?? '', caretHeight: Math.min(box.height, parseFloat(type?.fontSize ?? '0') * 1.05),
        }
      })
      measurements.forEach(({ job, box, workBox, typography, padding, borderWidth, caretHeight }) => {
        job.box = box
        job.workBox = workBox
        cancelMotionRead(job)
        job.caretPositions.clear()
        placeBox(job.frame, job.box)
        if (job.ghost) {
          placeBox(job.ghost, job.box)
          typeProperties.forEach((property, index) => job.ghost!.style.setProperty(property, typography[index]))
          // Mirror the content box, including padded labels and buttons.
          paddingProperties.forEach((property, index) => job.ghost!.style.setProperty(property, padding[index]))
          job.ghost.style.boxSizing = 'border-box'
          job.ghost.style.borderWidth = borderWidth
          job.ghost.style.borderStyle = 'solid'
          job.ghost.style.borderColor = 'transparent'
        }
        if (job.kind === 'formatted') {
          job.caret.style.height = `${caretHeight}px`
        }
        // Hidden menus only need a collision search when the cursor opens them.
        // A currently reserved menu remains locked to its explicit Paste target.
        if (job.menu?.dataset.menuReserved !== 'true') job.menuBox = undefined
      })
    } finally {
      measured.forEach((node, index) => {
        if (saved[index].value) node.style.setProperty('transform', saved[index].value, saved[index].priority)
        else node.style.removeProperty('transform')
      })
      invalidateMotionFrame()
      ++geometryRevision
    }
  }
  measure()
  const cursorSnapshot = new Map<Worker, Point>()
  const captureCursors = () => {
    if (disposed) return
    cursorSnapshot.clear()
    workers.forEach(worker => {
      const x = Number(gsap.getProperty(worker.cursor, 'x')), y = Number(gsap.getProperty(worker.cursor, 'y'))
      if (Number.isFinite(x) && Number.isFinite(y)) cursorSnapshot.set(worker, { x, y })
    })
  }
  const restoreCursors = () => {
    if (disposed) return
    jobs.forEach(job => cancelMotionRead(job))
    cursorSnapshot.forEach((point, worker) => {
      ++worker.revision
      worker.x = point.x
      worker.y = point.y
      worker.setX(point.x)
      worker.setY(point.y)
    })
    cursorSnapshot.clear()
  }
  ScrollTrigger.addEventListener('refreshInit', captureCursors)
  ScrollTrigger.addEventListener('refreshInit', measure)
  ScrollTrigger.addEventListener('refresh', restoreCursors)
  document.fonts?.addEventListener('loadingdone', measure)
  gsap.set(leaves, { opacity: 0 })
  gsap.set(workers.map(worker => worker.cursor), { autoAlpha: 0, scale: 0.3 })
  gsap.set(jobs.flatMap(job => [job.frame, ...(job.ghost ? [job.ghost] : []), ...(job.menu ? [job.menu] : []), ...(job.pulse ? [job.pulse] : [])]), { autoAlpha: 0 })

  const menuWindows: { job: Job; open: number; close: number }[] = []
  const menuState = (job: Job, active: boolean) => {
    if (!job.menu) return
    if (job.menu.dataset.menuActive !== String(active)) {
      job.menu.dataset.menuActive = String(active)
      job.menu.classList.toggle('construction-menu-inactive', !active)
    } else if (!active && job.menu.dataset.menuReserved !== 'true') return
    if (active) placeMenu(job, job.menu.dataset.menuReserved !== 'true')
    else {
      releaseConstructionMenu(job.menu)
      job.menuBox = undefined
    }
  }
  for (const job of jobs) {
    const at = start + job.at * unit
    const duration = job.weight * unit
    const flight = Math.min(duration * 0.3, 0.3)
    const writing = Math.max(0.02, duration - flight - 0.025 * unit)
    const workStart = at + flight
    const handoff = workStart + writing
    const taskNumber = job.worker.jobs.indexOf(job) + 1
    timeline.call(() => {
      cancelMotionRead(job)
      const point = liveSource()
      setCursor(job, point.x, point.y, `Task ${taskNumber} · ${job.action}`)
    }, [], at)
    timeline.fromTo(job.worker.cursor, { autoAlpha: 0, scale: 0.18, x: () => liveSource().x, y: () => liveSource().y }, { autoAlpha: 1, scale: 1, duration: Math.min(0.06, flight * 0.35), immediateRender: false }, at)
    curvedTravel(job, liveSource, () => anchor(job), at, flight, `Task ${taskNumber} · ${job.action}`)

    if (job.kind === 'art' && job.pasted) {
      const clickAt = workStart + writing * 0.52
      menuWindows.push({ job, open: workStart + writing * .08, close: clickAt + writing * .22 })
      timeline.call(() => {
        placeMenu(job, true)
        const point = anchor(job)
        setCursor(job, point.x, point.y, 'Right click')
      }, [], workStart)
      if (job.pulse) timeline.fromTo(job.pulse, { autoAlpha: 1, scale: 0.25 }, { autoAlpha: 0, scale: 1.65, duration: writing * 0.24, ease: 'power2.out', immediateRender: false }, workStart)
      if (job.menu) {
        timeline.fromTo(job.menu, { autoAlpha: 0, scale: 0.97, y: -3 }, {
          autoAlpha: 1, scale: 1, y: 0, duration: writing * 0.12, ease: 'power2.out', immediateRender: false,
          onStart: () => { menuState(job, true); document.dispatchEvent(new CustomEvent('assembly:menu-open', { detail: { menu: job.menu, owner: job.worker.cursor } })) },
          onReverseComplete: () => menuState(job, false),
        }, workStart + writing * 0.08)
      }
      curvedTravel(job, () => anchor(job), () => pastePoint(job), workStart + writing * 0.2, writing * 0.32, 'Choose Paste')
      timeline.call(() => {
        const point = pastePoint(job)
        setCursor(job, point.x, point.y, job.action)
      }, [], clickAt)
      if (job.paste) {
        timeline.fromTo(job.paste, { backgroundColor: 'rgba(168,201,154,0)', color: '#e8e9e1' }, { backgroundColor: '#a8c99a', color: '#20251d', duration: writing * 0.12, immediateRender: false }, workStart + writing * 0.32)
        timeline.fromTo(job.paste, { scale: 1 }, { scale: 0.96, duration: writing * 0.045, repeat: 1, yoyo: true, immediateRender: false }, clickAt)
      }
      timeline.fromTo(job.frame, { autoAlpha: 0 }, { autoAlpha: 0.85, duration: writing * 0.08, immediateRender: false }, clickAt)
      timeline.fromTo(job.leaf, {
        x: job.natural.x, y: job.natural.y,
        scaleX: job.natural.scaleX * 0.98, scaleY: job.natural.scaleY * 0.98, opacity: 0,
      }, {
        ...job.natural, opacity: 1, duration: writing * 0.38, ease: 'power2.out', immediateRender: false,
      }, clickAt)
      if (job.menu) timeline.to(job.menu, {
        autoAlpha: 0, scale: 0.98, duration: writing * 0.12, immediateRender: false,
        onComplete: () => {
          menuState(job, false)
          document.dispatchEvent(new CustomEvent('assembly:menu-close', { detail: { menu: job.menu, owner: job.worker.cursor } }))
        },
        onReverseComplete: () => menuState(job, true),
      }, clickAt + writing * 0.1)
    } else if (job.kind === 'art') {
      timeline.fromTo(job.frame, { autoAlpha: 0 }, { autoAlpha: 0.85, duration: writing * 0.1, immediateRender: false }, workStart)
      const draw = { value: 0 }
      timeline.fromTo(job.leaf, { opacity: 0, scaleX: job.natural.scaleX * 0.04 }, {
        opacity: 1, scaleX: job.natural.scaleX, duration: writing, ease: 'power1.inOut', immediateRender: false,
      }, workStart)
      timeline.fromTo(draw, { value: 0 }, {
        value: 1, duration: writing, ease: 'power1.inOut', immediateRender: false,
        onUpdate: () => setCursor(job, job.box.x + job.box.width * draw.value, job.box.y + job.box.height, 'Drawing a detail'),
      }, workStart)
    } else {
      timeline.fromTo(job.frame, { autoAlpha: 0 }, { autoAlpha: 0.85, duration: Math.min(0.035, writing * 0.1), immediateRender: false }, workStart)
      if (job.ghost) {
        timeline.fromTo(job.ghost, { autoAlpha: 0 }, { autoAlpha: 1, duration: Math.min(0.025, writing * 0.08), immediateRender: false }, workStart)
      } else {
        timeline.fromTo(job.leaf, { opacity: 1, clipPath: 'inset(0 100% 0 0)' }, {
          opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: writing,
          ease: `steps(${Math.max(1, job.text.length)})`, immediateRender: false,
        }, workStart)
      }
      timeline.fromTo(job.progress, { write: 0 }, {
        write: 1, duration: writing, ease: `steps(${Math.max(1, job.text.length)})`, immediateRender: false,
        onUpdate: () => render(job),
      }, workStart)
      timeline.call(() => cancelMotionRead(job), [], handoff)
      timeline.set(job.leaf, { opacity: 1 }, handoff)
      if (job.ghost) timeline.set(job.ghost, { autoAlpha: 0 }, handoff)
    }
    timeline.to(job.frame, { autoAlpha: 0, duration: Math.max(0.012, 0.08 * unit), immediateRender: false }, handoff)
    const returnAt = start + (job.at + job.weight) * unit
    const returnDuration = .75 * unit
    timeline.call(() => cancelMotionRead(job), [], returnAt)
    curvedTravel(job, () => cursorPoint(job.worker), liveSource, returnAt, returnDuration, 'Task complete · back to the box')
    timeline.to(job.worker.cursor, { scale: 0.18, autoAlpha: 0, duration: .08 * unit, immediateRender: false }, returnAt + returnDuration)
  }

  // A time-derived guard also runs after fast seeks which skip individual
  // open/close callbacks. It never hides a menu during its real Paste task.
  const menuClock = { value: 0 }
  timeline.to(menuClock, { value: 1, duration: timeline.duration(), ease: 'none', onUpdate: () => {
    const time = timeline.time()
    menuWindows.forEach(({ job, open, close }) => menuState(job, time >= open && time < close))
  } }, 0)

  return () => {
    disposed = true
    jobs.forEach(job => { cancelMotionRead(job); if (job.menu) releaseConstructionMenu(job.menu) })
    specialCleanup()
    ScrollTrigger.removeEventListener('refreshInit', captureCursors)
    ScrollTrigger.removeEventListener('refreshInit', measure)
    ScrollTrigger.removeEventListener('refresh', restoreCursors)
    document.fonts?.removeEventListener('loadingdone', measure)
    layer.remove()
  }
}
