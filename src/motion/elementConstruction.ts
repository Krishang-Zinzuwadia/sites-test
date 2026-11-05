import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { collaborators, createCursor, type Collaborator } from './DesignTools'
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
type Worker = { actor: Collaborator; cursor: HTMLDivElement; load: number; artwork: boolean }
type Job = {
  leaf: Piece
  kind: 'copy' | 'formatted' | 'art'
  text: string
  action: string
  worker: Worker
  at: number
  weight: number
  box: Box
  origin?: Point
  frame: HTMLDivElement
  ghost?: HTMLDivElement
  copy?: HTMLSpanElement
  caret: HTMLSpanElement
  progress: { flight: number; write: number }
  natural: { x: number; y: number; scaleX: number; scaleY: number }
}

const atomicSelector = '[data-construction-atom], svg, img, canvas'
const excludedSelector = '.assembly-overlay, script, style, noscript, template'
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
  const visit = (node: Element, root: HTMLElement) => {
    if (seen.has(node) || node.matches(excludedSelector) || skip.some(excluded => excluded === node || excluded.contains(node))) return
    seen.add(node)
    const owningScene = node.closest('.assembly-scene')
    if (owningScene && owningScene !== scene) return
    const atomic = node.matches(atomicSelector) || paintedEmptyLeaf(node)
    const text = node instanceof HTMLElement && directText(node)
    // A bare text or image target is itself a piece. The primary choreography
    // leaves these tags to us, while it continues drawing their empty frames.
    const leafTarget = /^(H[1-3]|P|SPAN|IMG|SVG|CANVAS)$/i.test(node.tagName)
    if ((node !== root || leafTarget) && (atomic || text)) {
      // Do not create hidden DOM, or descendants of an already selected atom.
      const style = getComputedStyle(node)
      if (style.display !== 'none' && node.getClientRects().length) selected.push(node as Piece)
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
    if (leaf.matches('svg') && (leaf.getBoundingClientRect().width < 50 || leaf.classList.contains('lucide'))) return 'Placing icon'
    if (leaf.matches('img, canvas') || /art|avatar|chart|grid|illustration/.test(leaf.getAttribute('class') ?? '')) return 'Placing artwork'
    return 'Drawing detail'
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
export function addElementConstruction({ scene, overlay, timeline, targets, start = 4.05, end = 5.62, skip = [] }: ElementConstructionOptions): () => void {
  const leaves = inventory(scene, targets, skip)
  if (!leaves.length) return () => undefined
  const layer = makeNode('div', 'element-builder-layer')
  layer.inert = true
  overlay.append(layer)
  const workerNames = ['Leo', 'Noah', 'Sam', 'Iris', 'You', 'Kai']
  const workers: Worker[] = workerNames.map(name => {
    const actor = collaborators.find(collaborator => collaborator.name === name)!
    const cursor = createCursor(actor)
    cursor.classList.add('element-builder-cursor')
    layer.append(cursor)
    return { actor, cursor, load: 0, artwork: name === 'You' || name === 'Kai' }
  })
  const jobs: Job[] = leaves.map(leaf => {
    const text = (leaf.textContent ?? '').replace(/\s+/g, ' ').trim()
    const art = leaf.matches(atomicSelector) || paintedEmptyLeaf(leaf)
    const formatted = !art && leaf.children.length > 0
    const available = workers.filter(worker => worker.artwork === art)
    const worker = available.reduce((best, next) => next.load < best.load ? next : best)
    const weight = art ? 1 : Math.min(1.9, 0.9 + text.length / 120)
    const at = worker.load
    worker.load += weight + 0.12
    const frame = makeNode('div', 'element-builder-frame')
    frame.style.setProperty('--element-builder-color', worker.actor.color)
    const caret = makeNode('span', 'element-builder-caret')
    let ghost: HTMLDivElement | undefined
    let copy: HTMLSpanElement | undefined
    if (!art && !formatted) {
      ghost = makeNode('div', 'element-builder-ghost')
      copy = makeNode('span', 'element-builder-copy')
      ghost.append(copy, caret)
      layer.append(ghost)
    } else if (formatted) {
      caret.classList.add('element-builder-caret--positioned')
      frame.append(caret)
    }
    layer.append(frame)
    return {
      leaf, text, kind: art ? 'art' : formatted ? 'formatted' : 'copy', action: actionFor(leaf, art, text),
      worker, at, weight, box: { x: 0, y: 0, width: 0, height: 0 }, frame, ghost, copy, caret,
      progress: { flight: 0, write: 0 },
      natural: { x: numericProperty(leaf, 'x', 0), y: numericProperty(leaf, 'y', 0), scaleX: numericProperty(leaf, 'scaleX', 1), scaleY: numericProperty(leaf, 'scaleY', 1) },
    }
  })
  const span = Math.max(0.15, end - start)
  const unit = span / Math.max(...workers.map(worker => worker.load))
  let disposed = false

  const relativeRect = (rect: DOMRect): Box => {
    const host = scene.getBoundingClientRect()
    return { x: rect.left - host.left - scene.clientLeft + scene.scrollLeft, y: rect.top - host.top - scene.clientTop + scene.scrollTop, width: rect.width, height: rect.height }
  }
  const placeBox = (node: HTMLElement, box: Box) => {
    Object.assign(node.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${Math.max(1, box.width)}px`, height: `${Math.max(1, box.height)}px` })
  }
  const source = (job: Job): Point => {
    if (job.origin) return job.origin
    const sourceBox = document.querySelector<HTMLElement>('[data-creation-source]')?.getBoundingClientRect()
    const host = scene.getBoundingClientRect()
    job.origin = {
      x: (sourceBox ? sourceBox.left + sourceBox.width / 2 : 45) - host.left - scene.clientLeft + scene.scrollLeft,
      y: (sourceBox ? sourceBox.top + sourceBox.height / 2 : innerHeight - 115) - host.top - scene.clientTop + scene.scrollTop,
    }
    return job.origin
  }
  const setCursor = (job: Job, x: number, y: number) => {
    if (disposed) return
    const cursor = job.worker.cursor
    gsap.set(cursor, { x, y })
    const action = cursor.querySelector<HTMLElement>('.assembly-cursor-action')
    if (action && action.textContent !== job.action) action.textContent = job.action
    const host = scene.getBoundingClientRect()
    cursor.dataset.edge = host.left + x > innerWidth - 145 ? 'right' : 'left'
    cursor.dataset.vertical = host.top + y > innerHeight - 75 ? 'above' : 'below'
  }
  const render = (job: Job) => {
    if (disposed) return
    const { box, progress, kind } = job
    if (progress.flight < 1) {
      const origin = source(job)
      const amount = progress.flight
      const scale = 0.04 + amount * 0.96
      const centerX = origin.x + (box.x + box.width / 2 - origin.x) * amount
      const centerY = origin.y + (box.y + box.height / 2 - origin.y) * amount
      placeBox(job.frame, { x: centerX - box.width * scale / 2, y: centerY - box.height * scale / 2, width: box.width * scale, height: box.height * scale })
      setCursor(job, centerX + box.width * scale / 2, centerY + box.height * scale / 2)
      return
    }
    placeBox(job.frame, box)
    if (kind === 'copy' && job.copy && job.ghost) {
      const count = Math.round(job.text.length * progress.write)
      job.copy.textContent = job.text.slice(0, count)
      const caret = job.caret.getBoundingClientRect()
      const point = relativeRect(caret)
      setCursor(job, point.x + 3, point.y + Math.min(point.height, 13))
    } else if (kind === 'formatted') {
      job.caret.style.left = `${box.width * progress.write}px`
      setCursor(job, box.x + box.width * progress.write, box.y + Math.min(box.height, 18))
    } else {
      const actual = relativeRect(job.leaf.getBoundingClientRect())
      placeBox(job.frame, actual)
      setCursor(job, actual.x + actual.width, actual.y + actual.height)
    }
  }
  const measure = () => {
    if (disposed) return
    // A refresh may occur while a parent or an artwork leaf is still in flight.
    // Measure the final layout, then put every live inline transform back exactly.
    const measured = Array.from(new Set<Piece>([...targets, ...leaves]))
    const saved = measured.map(node => ({ value: node.style.getPropertyValue('transform'), priority: node.style.getPropertyPriority('transform') }))
    measured.forEach(node => node.style.setProperty('transform', 'none', 'important'))
    try {
      jobs.forEach(job => {
        job.box = relativeRect(job.leaf.getBoundingClientRect())
        job.origin = undefined
        placeBox(job.frame, job.box)
        if (job.ghost) {
          placeBox(job.ghost, job.box)
          const type = getComputedStyle(job.leaf)
          typeProperties.forEach(property => job.ghost!.style.setProperty(property, type.getPropertyValue(property)))
          // Mirror the content box, including padded labels and buttons.
          for (const side of ['top', 'right', 'bottom', 'left']) job.ghost.style.setProperty(`padding-${side}`, type.getPropertyValue(`padding-${side}`))
          job.ghost.style.boxSizing = 'border-box'
          job.ghost.style.borderWidth = type.borderWidth
          job.ghost.style.borderStyle = 'solid'
          job.ghost.style.borderColor = 'transparent'
        }
        if (job.kind === 'formatted') {
          const type = getComputedStyle(job.leaf)
          job.caret.style.height = `${Math.min(job.box.height, parseFloat(type.fontSize) * 1.05)}px`
        }
      })
    } finally {
      measured.forEach((node, index) => {
        if (saved[index].value) node.style.setProperty('transform', saved[index].value, saved[index].priority)
        else node.style.removeProperty('transform')
      })
    }
  }
  measure()
  ScrollTrigger.addEventListener('refreshInit', measure)
  gsap.set(leaves, { opacity: 0 })
  gsap.set(workers.map(worker => worker.cursor), { autoAlpha: 0 })
  gsap.set(jobs.flatMap(job => [job.frame, ...(job.ghost ? [job.ghost] : [])]), { autoAlpha: 0 })

  for (const job of jobs) {
    const at = start + job.at * unit
    const duration = job.weight * unit
    const flight = Math.min(duration * 0.36, 0.14)
    const writing = Math.max(0.02, duration - flight - 0.025 * unit)
    const handoff = at + flight + writing
    // Origins are captured when this piece is emitted, never at mount-time.
    timeline.call(() => { job.origin = undefined; source(job) }, [], at)
    timeline.fromTo(job.worker.cursor, { autoAlpha: 0 }, { autoAlpha: 1, duration: Math.min(0.025, duration * 0.1), immediateRender: false }, at)
    timeline.fromTo(job.frame, { autoAlpha: 0 }, { autoAlpha: 0.85, duration: Math.min(0.025, duration * 0.1), immediateRender: false }, at)
    timeline.fromTo(job.progress, { flight: 0 }, { flight: 1, duration: flight, ease: 'power2.inOut', immediateRender: false, onUpdate: () => render(job) }, at)

    if (job.kind === 'art') {
      timeline.fromTo(job.leaf, {
        x: () => job.natural.x + source(job).x - job.box.x - job.box.width / 2,
        y: () => job.natural.y + source(job).y - job.box.y - job.box.height / 2,
        scaleX: job.natural.scaleX * 0.04, scaleY: job.natural.scaleY * 0.04, opacity: 1, transformOrigin: '50% 50%',
      }, {
        ...job.natural, opacity: 1, duration: flight + writing, ease: 'power2.inOut', immediateRender: false,
        onUpdate: () => {
          const rect = relativeRect(job.leaf.getBoundingClientRect())
          placeBox(job.frame, rect)
          setCursor(job, rect.x + rect.width, rect.y + rect.height)
        },
      }, at)
    } else {
      if (job.ghost) {
        timeline.fromTo(job.ghost, {
          autoAlpha: 0, x: () => source(job).x - job.box.x - job.box.width / 2,
          y: () => source(job).y - job.box.y - job.box.height / 2, scale: 0.04,
        }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: flight, ease: 'power2.inOut', immediateRender: false }, at)
      } else {
        timeline.fromTo(job.leaf, { opacity: 1, clipPath: 'inset(0 100% 0 0)' }, {
          opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: writing,
          ease: `steps(${Math.max(1, job.text.length)})`, immediateRender: false,
        }, at + flight)
      }
      timeline.fromTo(job.progress, { write: 0 }, {
        write: 1, duration: writing, ease: `steps(${Math.max(1, job.text.length)})`, immediateRender: false,
        onUpdate: () => render(job),
      }, at + flight)
      timeline.set(job.leaf, { opacity: 1 }, handoff)
      if (job.ghost) timeline.set(job.ghost, { autoAlpha: 0 }, handoff)
    }
    timeline.to([job.frame, job.worker.cursor], { autoAlpha: 0, duration: Math.max(0.012, 0.08 * unit), immediateRender: false }, handoff)
  }

  return () => {
    disposed = true
    ScrollTrigger.removeEventListener('refreshInit', measure)
    layer.remove()
  }
}
