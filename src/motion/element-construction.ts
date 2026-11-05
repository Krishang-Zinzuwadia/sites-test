import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { collaborators, createCursor, type Collaborator } from './design-tools'
import { addSpecialConstruction } from './special-construction'
import { constructionMenuPosition, releaseConstructionMenu } from './menu-placement'
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
type Worker = { actor: Collaborator; cursor: HTMLDivElement; load: number; artwork: boolean; jobs: Job[] }
type Job = {
  leaf: Piece
  kind: 'copy' | 'formatted' | 'art'
  text: string
  action: string
  worker: Worker
  at: number
  weight: number
  box: Box
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
  const visit = (node: Element, root: HTMLElement) => {
    if (seen.has(node) || node.matches(excludedSelector) || skip.some(excluded => excluded === node || excluded.contains(node))) return
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
      if (style.display !== 'none' && node.getClientRects().length) selected.push(node as Piece)
      // A formatted text run may contain an image. Keep that image hidden until
      // a separate paste job, after its containing text run is complete.
      if (text && !atomic) {
        for (const image of Array.from(node.querySelectorAll(imageSelector))) {
          if (seen.has(image) || image.closest('[data-build-tech], [data-build-grid]') || skip.some(excluded => excluded.contains(image))) continue
          const ancestor = image.parentElement?.closest(imageSelector)
          if (ancestor && node.contains(ancestor)) continue
          seen.add(image)
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
    return { actor, cursor, load: 0, artwork, jobs: [] }
  })
  const jobs: Job[] = []
  const artQueues = Array.from({ length: innerWidth < 768 ? 1 : 2 }, () => 0)
  for (const leaf of leaves) {
    const text = (leaf.textContent ?? '').replace(/\s+/g, ' ').trim()
    const art = leaf.matches(atomicSelector) || paintedEmptyLeaf(leaf)
    const pasted = art && (leaf.matches(imageSelector) || Boolean(leaf.querySelector(imageSelector)))
    const formatted = !art && leaf.children.length > 0
    const available = workers.filter(worker => worker.artwork === art)
    const ancestor = jobs.find(job => job.leaf.contains(leaf))
    const lane = artQueues.reduce((best, value, index) => value < artQueues[best] ? index : best, 0)
    const ready = Math.max(ancestor ? ancestor.at + ancestor.weight + 0.18 : 0, pasted ? artQueues[lane] : 0)
    const worker = available.reduce((best, next) => Math.max(next.load, ready) < Math.max(best.load, ready) ? next : best)
    const weight = art ? pasted ? 1.65 : 0.8 : Math.min(2, 1.15 + text.length / 130)
    const at = Math.max(worker.load, ready)
    // Reserve a complete return trip and a short in-box handoff before this
    // collaborator can leave for another assignment.
    worker.load = at + weight + 0.85 + 0.18
    if (pasted) artQueues[lane] = at + weight + 0.18
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
      worker, at, weight, box: { x: 0, y: 0, width: 0, height: 0 }, frame, ghost, copy, caret, menu, paste, pulse, pasted,
      progress: { write: 0 },
      natural: { x: numericProperty(leaf, 'x', 0), y: numericProperty(leaf, 'y', 0), scaleX: numericProperty(leaf, 'scaleX', 1), scaleY: numericProperty(leaf, 'scaleY', 1) },
    }
    jobs.push(job)
    worker.jobs.push(job)
  }
  const span = Math.max(0.15, end - start)
  const unit = span * (hasTech ? 0.22 : 1) / Math.max(1, ...workers.map(worker => worker.load))
  let disposed = false

  const relativeRect = (rect: DOMRect): Box => {
    const host = scene.getBoundingClientRect()
    return { x: rect.left - host.left - scene.clientLeft + scene.scrollLeft, y: rect.top - host.top - scene.clientTop + scene.scrollTop, width: rect.width, height: rect.height }
  }
  const placeBox = (node: HTMLElement, box: Box) => {
    Object.assign(node.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${Math.max(1, box.width)}px`, height: `${Math.max(1, box.height)}px` })
  }
  const liveSource = (): Point => {
    const sourceBox = document.querySelector<HTMLElement>('[data-creation-source]')?.getBoundingClientRect()
    const host = scene.getBoundingClientRect()
    return {
      x: (sourceBox ? sourceBox.left + sourceBox.width / 2 : 45) - host.left - scene.clientLeft + scene.scrollLeft,
      y: (sourceBox ? sourceBox.top + sourceBox.height / 2 : innerHeight - 115) - host.top - scene.clientTop + scene.scrollTop,
    }
  }
  const setCursor = (job: Job, x: number, y: number, actionText = job.action) => {
    if (disposed) return
    const cursor = job.worker.cursor
    gsap.set(cursor, { x, y })
    const action = cursor.querySelector<HTMLElement>('.assembly-cursor-action')
    if (action && action.textContent !== actionText) action.textContent = actionText
    const host = scene.getBoundingClientRect()
    cursor.dataset.edge = host.left + x > innerWidth - 145 ? 'right' : 'left'
    cursor.dataset.vertical = host.top + y > innerHeight - 75 ? 'above' : 'below'
  }
  const render = (job: Job) => {
    if (disposed) return
    const { box, progress, kind } = job
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
    }
  }
  const cursorPoint = (worker: Worker): Point => ({ x: numericProperty(worker.cursor, 'x', 0), y: numericProperty(worker.cursor, 'y', 0) })
  const anchor = (job: Job): Point => job.kind === 'art'
    ? { x: job.box.x + job.box.width / 2, y: job.box.y + job.box.height / 2 }
    : { x: job.box.x + 2, y: job.box.y + Math.min(16, job.box.height / 2) }
  const placeMenu = (job: Job, lock = false): Box => {
    if (job.menuBox && !lock && job.menu && getComputedStyle(job.menu).visibility !== 'hidden' && Number(getComputedStyle(job.menu).opacity) > 0.01) return job.menuBox
    const point = anchor(job)
    const box = job.menu ? constructionMenuPosition(job.menu, scene, point, lock) : { ...point, width: 148, height: 100 }
    job.menuBox = box
    if (job.menu) placeBox(job.menu, box)
    if (job.pulse) Object.assign(job.pulse.style, { left: `${point.x - 9}px`, top: `${point.y - 9}px` })
    return box
  }
  const pastePoint = (job: Job): Point => {
    const box = placeMenu(job)
    return { x: box.x + 64, y: box.y + 82 }
  }
  const curvedTravel = (job: Job, from: () => Point, to: () => Point, at: number, duration: number, action: string) => {
    const travel = { value: 0 }
    let origin: Point | undefined
    timeline.call(() => { origin ??= from() }, [], at)
    timeline.fromTo(travel, { value: 0 }, {
      value: 1, duration, ease: 'power2.inOut', immediateRender: false,
      onUpdate: () => {
        if (disposed) return
        origin ??= from()
        const target = to(), t = travel.value, inverse = 1 - t
        const distance = Math.hypot(target.x - origin.x, target.y - origin.y)
        const bend = Math.min(82, Math.max(12, distance * 0.16)) * (job.worker.artwork ? -1 : 1)
        const controlX = (origin.x + target.x) / 2 + bend
        const controlY = (origin.y + target.y) / 2 - Math.abs(bend)
        setCursor(job,
          inverse * inverse * origin.x + 2 * inverse * t * controlX + t * t * target.x,
          inverse * inverse * origin.y + 2 * inverse * t * controlY + t * t * target.y,
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
      jobs.forEach(job => {
        job.box = relativeRect(job.leaf.getBoundingClientRect())
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
        if (job.menu) placeMenu(job)
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
  gsap.set(workers.map(worker => worker.cursor), { autoAlpha: 0, scale: 0.3 })
  gsap.set(jobs.flatMap(job => [job.frame, ...(job.ghost ? [job.ghost] : []), ...(job.menu ? [job.menu] : []), ...(job.pulse ? [job.pulse] : [])]), { autoAlpha: 0 })

  for (const job of jobs) {
    const at = start + job.at * unit
    const duration = job.weight * unit
    const flight = Math.min(duration * 0.3, 0.3)
    const writing = Math.max(0.02, duration - flight - 0.025 * unit)
    const workStart = at + flight
    const handoff = workStart + writing
    const taskNumber = job.worker.jobs.indexOf(job) + 1
    timeline.call(() => {
      const point = liveSource()
      setCursor(job, point.x, point.y, `Task ${taskNumber} · ${job.action}`)
    }, [], at)
    timeline.fromTo(job.worker.cursor, { autoAlpha: 0, scale: 0.18 }, { autoAlpha: 1, scale: 1, duration: Math.min(0.06, flight * 0.35), immediateRender: false }, at)
    curvedTravel(job, liveSource, () => anchor(job), at, flight, `Task ${taskNumber} · ${job.action}`)

    if (job.kind === 'art' && job.pasted) {
      const clickAt = workStart + writing * 0.52
      timeline.call(() => {
        placeMenu(job, true)
        const point = anchor(job)
        setCursor(job, point.x, point.y, 'Right click')
      }, [], workStart)
      if (job.pulse) timeline.fromTo(job.pulse, { autoAlpha: 1, scale: 0.25 }, { autoAlpha: 0, scale: 1.65, duration: writing * 0.24, ease: 'power2.out', immediateRender: false }, workStart)
      if (job.menu) {
        timeline.fromTo(job.menu, { autoAlpha: 0, scale: 0.97, y: -3 }, {
          autoAlpha: 1, scale: 1, y: 0, duration: writing * 0.12, ease: 'power2.out', immediateRender: false,
          onStart: () => document.dispatchEvent(new CustomEvent('assembly:menu-open', { detail: { menu: job.menu, owner: job.worker.cursor } })),
          onReverseComplete: () => { if (job.menu) releaseConstructionMenu(job.menu) },
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
          if (job.menu) releaseConstructionMenu(job.menu)
          document.dispatchEvent(new CustomEvent('assembly:menu-close', { detail: { menu: job.menu, owner: job.worker.cursor } }))
        },
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
      timeline.set(job.leaf, { opacity: 1 }, handoff)
      if (job.ghost) timeline.set(job.ghost, { autoAlpha: 0 }, handoff)
    }
    timeline.to(job.frame, { autoAlpha: 0, duration: Math.max(0.012, 0.08 * unit), immediateRender: false }, handoff)
    const returnAt = start + (job.at + job.weight) * unit
    const returnDuration = .75 * unit
    curvedTravel(job, () => cursorPoint(job.worker), liveSource, returnAt, returnDuration, 'Task complete · back to the box')
    timeline.to(job.worker.cursor, { scale: 0.18, autoAlpha: 0, duration: .08 * unit, immediateRender: false }, returnAt + returnDuration)
  }

  return () => {
    disposed = true
    specialCleanup()
    ScrollTrigger.removeEventListener('refreshInit', measure)
    layer.remove()
  }
}
