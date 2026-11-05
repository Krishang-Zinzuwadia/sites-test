import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { collaborators, createCursor, createToolPanel } from './design-tools';
import { addElementConstruction } from './element-construction';
import { constructionMenuPosition, keepConstructionMenuInView, releaseConstructionMenu } from './menu-placement';
import { getCreationSourcePoint, getMotionRect, getMotionScrollLimit, getMotionViewport, invalidateMotionFrame, retainMotionFrame } from './motion-frame';
import { cancelMotionRead, queueMotionRead } from './motion-read';
import './assembly.css';

type AssemblyKind = 'text' | 'card' | 'art' | 'line';
type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type Motion = { x: number; y: number; rotation: number; scale: number; opacity: number };
type CursorControl = {
  x: number; y: number; revision: number; edge: string; vertical: string;
  setX: (value: number) => void; setY: (value: number) => void;
  setScale: (value: number) => void;
};
type ToolKind = 'layout' | 'text' | 'font' | 'color' | 'spacing';
type TargetPlan = {
  target: HTMLElement; kind: AssemblyKind; shell: HTMLDivElement; frame: HTMLDivElement;
  wireframe: HTMLDivElement; stroke: SVGRectElement; box: Box; motion: Motion;
};
type ScenePlan = {
  scene: HTMLElement; overlay: HTMLDivElement; targets: TargetPlan[];
  cursors: HTMLDivElement[]; panels: Record<ToolKind, HTMLDivElement>;
  ghost: HTMLDivElement; typingContent: HTMLSpanElement; caret: HTMLSpanElement;
  copyLeaf: HTMLElement; copyTarget: TargetPlan; copyWholeTarget: boolean; fontTarget: TargetPlan;
  guides: HTMLDivElement; dimension: HTMLSpanElement; sectionOutline: HTMLDivElement;
  textGuide: HTMLDivElement; grid: HTMLDivElement; proof: HTMLDivElement; contrast: HTMLDivElement;
  particles: HTMLSpanElement[];
  sourceOrigins: Map<number, Point>;
  copyBox: Box; copy: string; fontFamily: string; mobile: boolean;
  timeline?: gsap.core.Timeline; trigger?: ScrollTrigger; intro: boolean; introComplete?: boolean; timed?: boolean;
  onIntroProgress?: (progress: number) => void; onIntroHandoff?: () => void; onIntroComplete?: () => void;
  onTimedProgress?: () => void;
  constructionCleanup?: () => void;
  invalidateCaret?: () => void;
  captureCursorControls?: () => void;
  syncCursorControls?: () => void;
};

const motionProperties = ['transform', 'translate', 'rotate', 'scale', 'opacity', 'visibility', 'clip-path', 'will-change', 'filter'];
function makeReadable(targets: HTMLElement[]) {
  for (const target of targets) for (const property of motionProperties) target.style.removeProperty(property);
}
function startingMotion(kind: AssemblyKind, index: number, mobile: boolean): Motion {
  return { x: 0, y: 0, rotation: (index % 2 ? 4 : -4) * (mobile || kind === 'line' ? 0.5 : 1), scale: 0.025, opacity: 0 };
}
function element<T extends keyof HTMLElementTagNameMap>(tag: T, className: string) {
  const node = document.createElement(tag); node.className = className; return node;
}
function createTarget(target: HTMLElement, index: number, mobile: boolean, overlay: HTMLDivElement): TargetPlan {
  const value = target.dataset.assemble;
  const kind: AssemblyKind = value === 'text' || value === 'art' || value === 'line' ? value : 'card';
  const shell = element('div', 'assembly-target-overlay');
  shell.style.setProperty('--collaborator-color', '#df9fbb');
  const frame = element('div', 'assembly-selection');
  for (const corner of ['nw', 'ne', 'se', 'sw']) frame.append(element('i', `assembly-resize-handle assembly-resize-handle--${corner}`));
  shell.append(frame);
  const wireframe = element('div', 'assembly-wireframe');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
  const stroke = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  for (const [key, val] of Object.entries({ x: '.4', y: '.4', width: '99.2', height: '99.2', pathLength: '1', rx: '.4' })) stroke.setAttribute(key, val);
  stroke.classList.add('assembly-draw-stroke'); svg.append(stroke);
  const label = element('span', 'assembly-frame-label'); label.textContent = `${kind === 'text' ? 'TEXT' : 'FRAME'} ${String(index + 1).padStart(2, '0')}`;
  wireframe.append(svg, label); overlay.append(wireframe, shell);
  return { target, kind, shell, frame, wireframe, stroke, box: { x: 0, y: 0, width: 0, height: 0 }, motion: startingMotion(kind, index, mobile) };
}
function textLeaf(target: HTMLElement): HTMLElement {
  const leaf = target.querySelector<HTMLElement>('p') ?? target.querySelector<HTMLElement>('h1, h2, h3');
  if (leaf) return leaf;
  return Array.from(target.querySelectorAll<HTMLElement>('span')).find(node => !node.children.length && (node.textContent?.trim().length ?? 0) > 8) ?? target;
}
function authoredCopy(leaf: HTMLElement): { text: string; explicitBreaks: boolean } {
  const explicitBreaks = Boolean(leaf.querySelector('br'));
  if (!explicitBreaks) return { text: (leaf.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 180), explicitBreaks };
  const copy = leaf.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  return {
    text: (copy.textContent ?? '').split(/\r?\n/).map(line => line.replace(/[^\S\r\n]+/g, ' ').trim()).join('\n').trim().slice(0, 180),
    explicitBreaks,
  };
}
function createScene(scene: HTMLElement, targets: HTMLElement[], mobile: boolean): ScenePlan {
  const overlay = element('div', 'assembly-overlay'); overlay.dataset.assemblyOverlay = '';
  overlay.setAttribute('aria-hidden', 'true'); scene.append(overlay);
  const targetPlans = targets.map((target, index) => createTarget(target, index, mobile, overlay));
  const textPlans = targetPlans.filter(({ kind }) => kind === 'text');
  const fontTarget = textPlans[0] ?? targetPlans[0];
  const copyTarget = textPlans.find(({ target }) => target.querySelector('p')) ?? textPlans[1] ?? textPlans[0] ?? targetPlans[0];
  const copyLeaf = textLeaf(copyTarget.target);
  const copy = authoredCopy(copyLeaf);
  const ghost = element('div', 'assembly-type-ghost');
  if (copy.explicitBreaks) ghost.style.whiteSpace = 'pre-line';
  const typingContent = element('span', 'assembly-typed-copy'); typingContent.dataset.typingContent = '';
  const caret = element('span', 'assembly-type-caret'); ghost.append(typingContent, caret);
  const guides = element('div', 'assembly-alignment-guides');
  guides.append(element('i', 'assembly-guide-vertical'), element('i', 'assembly-guide-horizontal'));
  const dimension = element('span', 'assembly-dimension'); dimension.textContent = '↔ 16 px'; guides.append(dimension);
  const sectionOutline = element('div', 'assembly-section-outline');
  const sceneLabel = element('span', 'assembly-section-tag'); sceneLabel.textContent = scene.dataset.sceneName ?? 'AUTO LAYOUT'; sectionOutline.append(sceneLabel);
  const cursors = collaborators.map(actor => {
    const cursor = createCursor(actor);
    const action = cursor.querySelector<HTMLElement>('.assembly-cursor-action');
    if (action) action.textContent = ({ layout: 'Drawing frames', type: 'Choosing a typeface', copy: 'Writing the story', color: 'Choosing a palette', spacing: 'Aligning · 16px gap', components: 'Placing components', frame: 'Resizing the frame', textbox: 'Creating a text box', proof: 'Proofreading together', contrast: 'Checking contrast', grid: 'Snapping to the grid', assets: 'Delivering artwork' } as Record<string, string>)[actor.role] ?? actor.role;
    return cursor;
  });
  const panels = Object.fromEntries((['layout', 'text', 'font', 'color', 'spacing'] as ToolKind[]).map(kind => [kind, createToolPanel(kind)])) as Record<ToolKind, HTMLDivElement>;
  const textGuide = element('div', 'assembly-text-box-guide');
  const grid = element('div', 'assembly-pair-grid');
  const proof = element('div', 'assembly-proof-check'); proof.textContent = '✓ Copy checked';
  const contrast = element('div', 'assembly-contrast-check'); contrast.textContent = 'Aa · Contrast checked ✓';
  const particles = Array.from({ length: 24 }, (_, index) => {
    const particle = element('span', 'assembly-origin-particle');
    particle.style.setProperty('--spark-color', collaborators[index % collaborators.length].color);
    return particle;
  });
  overlay.append(sectionOutline, guides, grid, textGuide, ghost, proof, contrast, ...Object.values(panels), ...particles, ...cursors);
  return { scene, overlay, targets: targetPlans, cursors, panels, ghost, typingContent, caret, copyLeaf, copyTarget, copyWholeTarget: copyTarget.kind === 'text' || copyLeaf === copyTarget.target, fontTarget, guides, dimension, sectionOutline, textGuide, grid, proof, contrast, particles, sourceOrigins: new Map(), copyBox: { x: 0, y: 0, width: 0, height: 0 }, copy: copy.text, fontFamily: '', mobile, intro: scene.hasAttribute('data-intro') };
}
function relativeBox(target: HTMLElement, scene: HTMLElement, sceneBox: DOMRect): Box {
  const rect = target.getBoundingClientRect();
  return { x: rect.left - sceneBox.left - scene.clientLeft + scene.scrollLeft, y: rect.top - sceneBox.top - scene.clientTop + scene.scrollTop, width: rect.width, height: rect.height };
}
function positionBox(node: HTMLElement, box: Box) {
  Object.assign(node.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` });
}
function measureScene(plan: ScenePlan) {
  plan.captureCursorControls?.();
  invalidateMotionFrame();
  plan.sourceOrigins.clear();
  // Temporarily remove only the transforms we own; restore the identical values
  // so a refresh measures finished layout without changing GSAP's live cache.
  const saved = plan.targets.map(({ target }) => ({ value: target.style.getPropertyValue('transform'), priority: target.style.getPropertyPriority('transform') }));
  plan.targets.forEach(({ target }) => target.style.setProperty('transform', 'none', 'important'));
  const sceneBox = plan.scene.getBoundingClientRect();
  plan.targets.forEach(target => {
    target.box = relativeBox(target.target, plan.scene, sceneBox);
    positionBox(target.shell, target.box); positionBox(target.wireframe, target.box);
  });
  plan.copyBox = relativeBox(plan.copyLeaf, plan.scene, sceneBox);
  positionBox(plan.ghost, plan.copyBox);
  const type = getComputedStyle(plan.copyLeaf);
  Object.assign(plan.ghost.style, { fontFamily: type.fontFamily, fontSize: type.fontSize, fontWeight: type.fontWeight, lineHeight: type.lineHeight, letterSpacing: type.letterSpacing, textTransform: type.textTransform, color: type.color, textAlign: type.textAlign });
  plan.fontFamily = type.fontFamily;
  positionBox(plan.textGuide, plan.fontTarget.box);
  Object.assign(plan.proof.style, { left: `${plan.copyBox.x}px`, top: `${plan.copyBox.y + plan.copyBox.height + 5}px` });
  const alignBox = plan.targets.find(({ kind }) => kind === 'card' || kind === 'art')?.box ?? plan.targets[plan.targets.length - 1].box;
  positionBox(plan.guides, { x: alignBox.x - 10, y: alignBox.y - 10, width: alignBox.width + 20, height: alignBox.height + 20 });
  positionBox(plan.grid, alignBox);
  Object.assign(plan.contrast.style, { left: `${alignBox.x + 8}px`, top: `${alignBox.y + alignBox.height - 23}px` });
  const anchors: Record<ToolKind, Box> = { layout: plan.targets[0].box, text: plan.fontTarget.box, font: plan.fontTarget.box, color: alignBox, spacing: alignBox };
  Object.entries(plan.panels).forEach(([key, panel]) => {
    const kind = key as ToolKind, anchor = anchors[kind], width = panel.offsetWidth || (plan.mobile ? 150 : 164);
    let x = Math.max(8, Math.min(plan.scene.clientWidth - width - 8, anchor.x + anchor.width - width));
    if (!plan.mobile && (kind === 'font' || kind === 'color') && sceneBox.right + width + 24 < innerWidth) x = plan.scene.clientWidth + 16;
    if (!plan.mobile && kind === 'layout' && sceneBox.left - width - 24 > 0) x = -width - 16;
    const y = Math.max(8, anchor.y + Math.min(anchor.height, 40) + (kind === 'font' ? 22 : 12));
    Object.assign(panel.style, { left: `${x}px`, top: `${y}px` });
  });
  plan.targets.forEach(({ target }, i) => {
    if (saved[i].value) target.style.setProperty('transform', saved[i].value, saved[i].priority);
    else target.style.removeProperty('transform');
  });
  plan.invalidateCaret?.();
  invalidateMotionFrame();
}
const sceneUnits = 10.4;
const viewportChrome = new WeakMap<Element, { header: HTMLElement | null; dock: HTMLElement | null }>();
function usableViewport(scene: HTMLElement) {
  const root = scene.closest('.site-root') ?? document.documentElement;
  let chrome = viewportChrome.get(root);
  if (!chrome || (chrome.header && !chrome.header.isConnected) || (chrome.dock && !chrome.dock.isConnected)) {
    chrome = { header: root.querySelector<HTMLElement>('.site-nav'), dock: root.querySelector<HTMLElement>('.assembly-dock') };
    viewportChrome.set(root, chrome);
  }
  const view = getMotionViewport(), visual = window.visualViewport;
  const visualTop = visual?.offsetTop ?? 0, visualBottom = visualTop + (visual?.height ?? view.height);
  // Reserve natural sticky-header height even while its box-arrival transform is
  // in flight; that temporary visual transform must not move the scene triggers.
  const top = visualTop + (chrome.header?.offsetHeight ?? 0) + 12;
  const dock = chrome.dock ? getMotionRect(chrome.dock) : undefined;
  const bottom = dock && dock.top < visualBottom && dock.bottom > top ? Math.min(visualBottom - 12, dock.top - 12) : visualBottom - 12;
  return { top, bottom: Math.max(top + 120, bottom), height: Math.max(120, bottom - top) };
}
function sceneViewportLines(scene: HTMLElement, mobile: boolean) {
  const band = usableViewport(scene);
  return { start: band.top + band.height * (mobile ? 0.65 : 0.75), end: band.top + band.height * (mobile ? 0.4 : 0.45), band };
}
function sceneScrollBounds(scene: HTMLElement, mobile: boolean) {
  const rect = getMotionRect(scene), view = getMotionViewport(), limit = getMotionScrollLimit();
  const top = rect.top + view.scrollY, lines = sceneViewportLines(scene, mobile);
  const minimum = Math.min(160, Math.max(64, lines.band.height * 0.18));
  const naturalStart = top - lines.start;
  let end = Math.min(limit, Math.max(0, top + rect.height - lines.end));
  // Tall windows can already contain whole scenes before scrolling starts.
  // Give them a real construction interval rather than a zero-length trigger.
  if (naturalStart <= 0) end = Math.min(limit, Math.max(end, minimum));
  let start = Math.min(end, Math.max(0, naturalStart));
  if (end - start < minimum) {
    // The footer finishes inside the actual page bounds; no artificial blank
    // half-screen is needed below it to move it through the central trigger.
    const firstVisible = Math.min(end, Math.max(0, top - lines.band.bottom));
    start = Math.min(start, Math.max(firstVisible, end - minimum));
  }
  return { start, end: Math.max(start + 0.001, end) };
}
function sourcePoint(plan: ScenePlan, at: number, live = false): Point {
  if (!live && plan.sourceOrigins.has(at)) return plan.sourceOrigins.get(at)!;
  const source = getCreationSourcePoint(plan.scene);
  if (live || plan.intro || plan.timed) return source;
  const view = getMotionViewport();
  // ScrollTrigger can exist before refresh has assigned both numeric bounds.
  // Its presence alone does not mean the fallback geometry is unnecessary.
  const bounds = plan.trigger?.start == null || plan.trigger?.end == null ? sceneScrollBounds(plan.scene, plan.mobile) : undefined;
  const start = plan.trigger?.start ?? bounds!.start;
  const end = plan.trigger?.end ?? bounds!.end;
  // Future scenes are measured before they are on screen. Predict the scroll
  // position at this emission, rather than accidentally using mount-time scroll.
  const birthScroll = start + (end - start) * Math.min(1, Math.max(0, at / sceneUnits));
  return { x: source.x, y: source.y + birthScroll - view.scrollY };
}
function sourceMotion(plan: ScenePlan, target: TargetPlan, at: number): Motion {
  const source = sourcePoint(plan, at);
  return { ...target.motion, x: source.x - target.box.x - target.box.width / 2, y: source.y - target.box.y - target.box.height / 2 };
}
function draggedPoint(plan: ScenePlan, target: TargetPlan, at: number, progress: number, cornerX: number, cornerY: number): Point {
  const motion = sourceMotion(plan, target, at);
  if (progress === 0 && !plan.sourceOrigins.has(at)) {
    const live = sourcePoint(plan, at, true);
    motion.x = live.x - target.box.x - target.box.width / 2;
    motion.y = live.y - target.box.y - target.box.height / 2;
  }
  const scale = motion.scale + (1 - motion.scale) * progress;
  const angle = motion.rotation * (1 - progress) * Math.PI / 180;
  const localX = (cornerX - 0.5) * target.box.width * scale, localY = (cornerY - 0.5) * target.box.height * scale;
  return { x: target.box.x + target.box.width / 2 + motion.x * (1 - progress) + localX * Math.cos(angle) - localY * Math.sin(angle), y: target.box.y + target.box.height / 2 + motion.y * (1 - progress) + localX * Math.sin(angle) + localY * Math.cos(angle) };
}
function point(target: TargetPlan, x = 0.5, y = 0.5): Point { return { x: target.box.x + target.box.width * x, y: target.box.y + target.box.height * y }; }
function optionPoint(plan: ScenePlan, option: HTMLElement): Point {
  const scene = getMotionRect(plan.scene), rect = getMotionRect(option);
  return { x: rect.left - scene.left + rect.width * 0.55, y: rect.top - scene.top + rect.height * 0.55 };
}
function animateScene(plan: ScenePlan, mobile: boolean) {
  const timeline = gsap.timeline({ paused: true }); plan.timeline = timeline;
  const [mia, noah, leo, ava, eli, you, finn, iris, sam, zoe, remy, kai] = plan.cursors;
  const cursorControls = new Map<HTMLElement, CursorControl>();
  const cursorControl = (cursor: HTMLElement) => {
    let control = cursorControls.get(cursor);
    if (!control) {
      const writeX = gsap.quickSetter(cursor, 'x', 'px'), writeY = gsap.quickSetter(cursor, 'y', 'px'), writeScale = gsap.quickSetter(cursor, 'scale');
      const state: CursorControl = {
        x: 0, y: 0, revision: 0, edge: '', vertical: '',
        setX: (value: number) => { state.x = value; state.revision++; writeX(value); },
        setY: (value: number) => { state.y = value; state.revision++; writeY(value); },
        setScale: (value: number) => writeScale(value),
      };
      control = state;
      cursorControls.set(cursor, state);
    }
    return control;
  };
  const cursorSnapshot = new Map<CursorControl, Point>();
  plan.captureCursorControls = () => {
    cursorSnapshot.clear();
    cursorControls.forEach((control, cursor) => {
      const x = Number(gsap.getProperty(cursor, 'x')), y = Number(gsap.getProperty(cursor, 'y'));
      if (Number.isFinite(x) && Number.isFinite(y)) cursorSnapshot.set(control, { x, y });
    });
  };
  plan.syncCursorControls = () => {
    // Revert can mutate both the transform and the flight's live cache.
    // Restore the pose frozen before refresh began, even while paused.
    cursorSnapshot.forEach((point, control) => {
      control.setX(point.x);
      control.setY(point.y);
    });
    cursorSnapshot.clear();
  };
  const writeCursorLabels = (cursor: HTMLElement, control: CursorControl, left: number, top: number, width: number, height: number) => {
    const edge = left + control.x > width - 145 ? 'right' : 'left';
    const vertical = top + control.y > height - 78 ? 'above' : 'below';
    if (edge !== control.edge) { control.edge = edge; cursor.dataset.edge = edge; }
    if (vertical !== control.vertical) { control.vertical = vertical; cursor.dataset.vertical = vertical; }
  };
  const panelEntries = Object.entries(plan.panels) as [ToolKind, HTMLDivElement][];
  const panelRects = new Map<HTMLElement, DOMRect>();
  const options = new Map<string, HTMLElement>();
  const panelOptions = new Map<HTMLElement, HTMLElement[]>();
  panelEntries.forEach(([kind, node]) => {
    const entries = Array.from(node.querySelectorAll<HTMLElement>('[data-choice]'));
    panelOptions.set(node, entries);
    entries.forEach(option => options.set(`${kind}:${option.dataset.choice}`, option));
  });
  const optionPosition = (kind: ToolKind, choice: string) => optionPoint(plan, options.get(`${kind}:${choice}`) ?? plan.panels[kind]);
  const invalidatePanel = (node: HTMLElement) => {
    invalidateMotionFrame(node);
    panelOptions.get(node)?.forEach(option => invalidateMotionFrame(option));
  };
  const first = plan.targets[0], component = plan.targets.find(({ kind }) => kind === 'art' || kind === 'card') ?? first;
  const alignTarget = plan.targets.find(({ kind }) => kind === 'card') ?? component;
  const captureOrigin = (at: number) => timeline.call(() => {
    if (!plan.timed && plan.trigger?.direction === -1) { plan.sourceOrigins.delete(at); return; }
    if (!plan.sourceOrigins.has(at)) plan.sourceOrigins.set(at, sourcePoint(plan, at, true));
  }, [], at);
  const curve = (cursor: HTMLElement, destination: () => Point, start: number, duration: number, mode: 'travel' | 'birth' | 'return' = 'travel', side = 1) => {
    const progress = { value: 0 };
    let origin: Point | undefined;
    const control = cursorControl(cursor), setX = control.setX, setY = control.setY, setScale = control.setScale;
    timeline.call(() => {
      if (cursor === leo) cancelMotionRead(plan.caret);
      if (mode === 'birth') {
        origin = sourcePoint(plan, start, true);
        setX(origin.x); setY(origin.y);
      } else if (!origin || plan.trigger?.direction !== -1) {
        origin = { x: control.x, y: control.y };
      }
    }, [], start);
    if (mode === 'birth') {
      // Position belongs to the timeline itself: refresh/seek can suppress calls,
      // but must never reveal a cursor at its default scene-top coordinates.
      timeline.fromTo(cursor, {
        x: () => sourcePoint(plan, start, true).x,
        y: () => sourcePoint(plan, start, true).y,
        scale: 0.15, autoAlpha: 0,
      }, { autoAlpha: 1, scale: 1, duration: Math.min(0.035, duration * 0.15), immediateRender: false }, start);
    }
    timeline.fromTo(progress, { value: 0 }, { value: 1, duration, ease: 'power1.inOut', immediateRender: false, onUpdate: () => {
      const from = origin ?? sourcePoint(plan, start, true), to = destination(), p = progress.value;
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const bend = Math.min(74, Math.max(8, distance * 0.14));
      const control = { x: (from.x + to.x) / 2 + bend * 0.35 * side, y: (from.y + to.y) / 2 - bend };
      setX((1 - p) ** 2 * from.x + 2 * (1 - p) * p * control.x + p * p * to.x);
      setY((1 - p) ** 2 * from.y + 2 * (1 - p) * p * control.y + p * p * to.y);
      if (mode === 'birth') setScale(0.15 + 0.85 * Math.min(1, p * 4));
      if (mode === 'return') setScale(1 - 0.86 * Math.max(0, (p - 0.76) / 0.24));
    } }, start);
    if (mode === 'return') timeline.set(cursor, { autoAlpha: 0 }, start + duration);
  };
  const approach = (cursor: HTMLElement, getPoint: () => Point, start: number, fromRight = false) => curve(cursor, getPoint, start, 0.23, 'birth', fromRight ? -1 : 1);
  const move = (cursor: HTMLElement, getPoint: () => Point, start: number, duration = 0.28) => curve(cursor, getPoint, start, duration);
  const depart = (cursor: HTMLElement, _getPoint: () => Point, start: number) => curve(cursor, () => sourcePoint(plan, start, true), start, 0.65, 'return');
  const returnHome = (cursor: HTMLElement, start: number) => curve(cursor, () => sourcePoint(plan, start, true), start, 0.4, 'return');
  const menuOwners: Record<ToolKind, HTMLDivElement> = { layout: mia, text: noah, font: noah, color: ava, spacing: eli };
  const menuAnchors = new Map<ToolKind, Point>();
  const menuWindows: { kind: ToolKind; start: number; end: number }[] = [];
  const placePanel = (kind: ToolKind, capture = false) => {
    const node = plan.panels[kind], owner = menuOwners[kind];
    if (capture || !menuAnchors.has(kind)) {
      const control = cursorControl(owner);
      menuAnchors.set(kind, { x: control.x, y: control.y });
    }
    const work = kind === 'layout' ? first : kind === 'text' || kind === 'font' ? plan.fontTarget : kind === 'color' ? component : alignTarget;
    const chosen = constructionMenuPosition(node, plan.scene, menuAnchors.get(kind)!, true, work.box);
    Object.assign(node.style, { left: `${chosen.x}px`, top: `${chosen.y}px` });
    invalidatePanel(node);
  };
  const menuClose = (node: HTMLElement) => { node.dataset.open = 'false'; node.dataset.menuActive = 'false'; node.classList.add('assembly-inspector-blocked'); releaseConstructionMenu(node); };
  const panel = (kind: ToolKind, start: number, end: number) => {
    const node = plan.panels[kind];
    menuWindows.push({ kind, start, end: end + 0.08 });
    node.dataset.constructionMenu = kind;
    gsap.set(node, { transformOrigin: '12px 12px' });
    timeline.call(() => {
      if (plan.trigger?.direction === -1) { menuClose(node); return; }
      placePanel(kind, true);
      node.classList.remove('assembly-inspector-blocked'); node.dataset.open = 'true'; node.dataset.menuActive = 'true';
      document.dispatchEvent(new CustomEvent('assembly:menu-open', { detail: { menu: node, owner: plan.scene } }));
    }, [], start);
    timeline.fromTo(node, { autoAlpha: 0, x: 0, y: 5, scale: 0.95 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.15, ease: 'power2.out', immediateRender: false }, start);
    timeline.to(node, { autoAlpha: 0, scale: 0.98, duration: 0.08 }, end);
    timeline.call(() => {
      if (plan.trigger?.direction === -1) { node.classList.remove('assembly-inspector-blocked'); node.dataset.open = 'true'; }
      else menuClose(node);
      document.dispatchEvent(new CustomEvent('assembly:menu-close', { detail: { menu: node, owner: plan.scene } }));
    }, [], end + 0.08);
  };
  let burstIndex = 0;
  const burst = (at: number, target: TargetPlan, targetIndex: number) => {
    const group = burstIndex++ % 3;
    plan.particles.slice(group * 8, group * 8 + 8).forEach((particle, index) => {
      const angle = index * Math.PI / 4, radius = mobile ? 16 : 24;
      timeline.set(particle, { left: () => sourcePoint(plan, at).x, top: () => sourcePoint(plan, at).y }, at);
      timeline.fromTo(particle, { x: 0, y: 0, scale: 0.8, autoAlpha: 1 }, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, scale: 0, autoAlpha: 0, duration: 0.28, ease: 'power2.out', immediateRender: false }, at);
    });
    timeline.call(() => {
      if (plan.trigger?.direction === -1) return;
      document.dispatchEvent(new CustomEvent('assembly:spawn', { detail: { scene: plan.scene.dataset.sceneName ?? plan.scene.id, target: targetIndex, kind: target.kind } }));
    }, [], at);
  };
  const trackPair = (lead: HTMLElement, helper: HTMLElement, target: TargetPlan, at: number, duration: number, x1 = 0, y1 = 0, x2 = 1, y2 = 1, ease = 'power2.inOut') => {
    const progress = { value: 0 };
    const leadControl = cursorControl(lead), helperControl = cursorControl(helper);
    const lx = leadControl.setX, ly = leadControl.setY, hx = helperControl.setX, hy = helperControl.setY;
    timeline.fromTo(progress, { value: 0 }, { value: 1, duration, ease, immediateRender: false, onUpdate: () => {
      const a = draggedPoint(plan, target, at, progress.value, x1, y1), b = draggedPoint(plan, target, at, progress.value, x2, y2);
      lx(a.x); ly(a.y); hx(b.x); hy(b.y);
    } }, at);
  };
  const selectedOptions = new Map<ToolKind, HTMLElement>();
  const choose = (kind: ToolKind, choice: string, start: number) => {
    const option = options.get(`${kind}:${choice}`);
    if (!option) return;
    const previous = selectedOptions.get(kind);
    if (previous && previous !== option) timeline.set(previous, { attr: { 'data-selected': 'false' }, backgroundColor: 'rgba(168,201,154,0)', boxShadow: 'inset 0 0 0 1px rgba(168,201,154,0)' }, start);
    timeline.set(option, { attr: { 'data-selected': 'true' } }, start);
    selectedOptions.set(kind, option);
    timeline.fromTo(option, { backgroundColor: 'rgba(168,201,154,0)', boxShadow: 'inset 0 0 0 1px rgba(168,201,154,0)' }, { backgroundColor: 'rgba(168,201,154,.19)', boxShadow: 'inset 0 0 0 1px rgba(168,201,154,.8)', duration: 0.13 }, start);
    timeline.to(option, { scale: 0.96, duration: 0.07, yoyo: true, repeat: 1 }, start);
  };
  const inspect = (kind: ToolKind, owner: HTMLElement, anchor: () => Point, open: number, close: number, choices: { choice: string; at: number }[], approachDuration = 0.24) => {
    if (approachDuration > 0) move(owner, anchor, open - approachDuration, approachDuration);
    timeline.to(owner, { scale: 0.86, duration: 0.045, yoyo: true, repeat: 1 }, open - 0.09);
    panel(kind, open, close);
    choices.forEach(({ choice, at }) => {
      move(owner, () => optionPosition(kind, choice), at - 0.14, 0.14);
      choose(kind, choice, at);
    });
  };

  // Release the whole real crew immediately. Each early visit measures a real
  // future work point, then returns home before its next creation task.
  const copyStart = 1.98, copyEnd = 3.2;
  const componentStart = mobile ? 2.12 : 1.65;
  const stagger = Math.min(0.16, 0.65 / plan.targets.length);
  const componentAt = componentStart + plan.targets.indexOf(component) * stagger;
  const componentDuration = component.kind === 'text' || component.kind === 'line' ? 0.8 : 1.13;
  const colorStart = 4.55, alignStart = 5.24;
  const firstApproaches = [Infinity, 1.15, copyStart - 0.26, colorStart - 0.25, alignStart - 0.24, componentAt - 0.25, Infinity, 1.15, copyStart - 0.26, colorStart - 0.25, alignStart - 0.24, componentAt - 0.25];
  const preparations = [
    () => point(first, 0, 0), () => point(plan.fontTarget, 0, 0),
    () => ({ x: plan.copyBox.x, y: plan.copyBox.y }), () => point(component, 0.88, 0.12),
    () => point(alignTarget, 0, 0.5), () => point(component, 0, 0),
    () => point(first, 1, 1), () => point(plan.fontTarget, 1, 1),
    () => ({ x: plan.copyBox.x + plan.copyBox.width, y: plan.copyBox.y + plan.copyBox.height }),
    () => point(component, 0, 1), () => point(alignTarget, 1, 0.5), () => point(component, 1, 1),
  ];
  const preparationLabels = ['Frame', 'Type bounds', 'Copy length', 'Palette', 'Spacing', 'Asset size', 'Resize', 'Text bounds', 'Proof', 'Contrast', 'Grid', 'Delivery'];
  plan.cursors.slice(0, 12).forEach((cursor, index) => {
    if (index === 0 || index === 6) return;
    const at = index * 0.045, work = preparations[index];
    const returnAt = Math.min(at + 0.55 + index * 0.05, firstApproaches[index] - 0.44 - (index % 4) * 0.005);
    const marker = element('div', 'assembly-prep-task');
    marker.style.setProperty('--prep-color', collaborators[index].color);
    marker.textContent = preparationLabels[index];
    plan.overlay.append(marker);
    approach(cursor, work, at, index % 2 === 1);
    timeline.call(() => {
      const position = work();
      Object.assign(marker.style, { left: `${position.x}px`, top: `${position.y - 15}px` });
    }, [], at + 0.23);
    timeline.fromTo(marker, { autoAlpha: 0, scaleX: 0.3 }, { autoAlpha: 1, scaleX: 1, duration: 0.08, immediateRender: false }, at + 0.23);
    timeline.to(marker, { autoAlpha: 0, duration: 0.06 }, returnAt - 0.06);
    returnHome(cursor, returnAt);
  });

  // Mia establishes actual empty frame bounds before anybody places content.
  approach(mia, () => sourcePoint(plan, 0.24, true), 0.01);
  approach(finn, () => sourcePoint(plan, 0.24, true), 0.12, true);
  captureOrigin(0.22);
  timeline.fromTo(plan.sectionOutline, { autoAlpha: 0, x: () => sourcePoint(plan, 0.22).x - plan.scene.clientWidth / 2, y: () => sourcePoint(plan, 0.22).y - plan.scene.offsetHeight / 2, scale: 0.025, clipPath: 'inset(0 100% 100% 0)' }, { autoAlpha: 1, x: 0, y: 0, scale: 1, clipPath: 'inset(0 0% 0% 0)', duration: 0.8, immediateRender: false }, 0.22);
  plan.targets.forEach((target, index) => {
    const at = 0.24 + index * Math.min(0.1, 0.5 / plan.targets.length);
    captureOrigin(at);
    timeline.fromTo(target.wireframe, { autoAlpha: 0, x: () => sourceMotion(plan, target, at).x, y: () => sourceMotion(plan, target, at).y, scale: 0.025, rotation: target.motion.rotation }, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'power2.inOut', immediateRender: false }, at);
    timeline.fromTo(target.stroke, { strokeDashoffset: 1 }, { strokeDashoffset: 0, autoRound: false, duration: 0.75, ease: 'none' }, at);
    burst(at, target, index);
  });
  trackPair(mia, finn, first, 0.24, 0.55);
  returnHome(mia, 0.8); returnHome(finn, 0.8);
  approach(mia, () => point(first, 0.75, 0), 1.2);
  inspect('layout', mia, () => point(first, 0.75, 0), 1.45, 1.98, [{ choice: 'frame', at: 1.74 }], 0);
  returnHome(mia, 2.1);
  const lastFrame = plan.targets[plan.targets.length - 1];
  approach(mia, () => point(lastFrame, 0, 1), 2.55);
  approach(finn, () => point(lastFrame, 1, 0), 2.55, true);
  timeline.fromTo(lastFrame.frame, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, immediateRender: false }, 2.8);
  timeline.to(lastFrame.frame, { autoAlpha: 0, duration: 0.15 }, 3.25);
  depart(mia, () => point(lastFrame, 0, 1), 3.3);
  depart(finn, () => point(lastFrame, 1, 0), 3.3);

  // Noah makes a text box, then chooses a real typeface in the properties panel.
  const fontChoice = /plex|mono/i.test(plan.fontFamily) ? 'plex' : /dm sans/i.test(plan.fontFamily) ? 'dm-sans' : 'manrope';
  approach(noah, () => sourcePoint(plan, 1.4, true), 1.15, true);
  approach(iris, () => sourcePoint(plan, 1.4, true), 1.15);
  captureOrigin(1.4);
  timeline.fromTo(plan.textGuide, { autoAlpha: 0, x: () => sourceMotion(plan, plan.fontTarget, 1.4).x, y: () => sourceMotion(plan, plan.fontTarget, 1.4).y, scale: 0.025, rotation: plan.fontTarget.motion.rotation }, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: 0.5, ease: 'power2.inOut', immediateRender: false }, 1.4);
  trackPair(noah, iris, plan.fontTarget, 1.4, 0.5);
  returnHome(noah, 1.92); returnHome(iris, 1.92);
  approach(noah, () => point(plan.fontTarget, 0, 0), 2.32);
  inspect('text', noah, () => point(plan.fontTarget, 0, 0), 2.58, 3.11, [{ choice: 'text', at: 2.87 }], 0);
  returnHome(noah, 3.2);
  approach(noah, () => point(plan.fontTarget, 0.1, 0.05), 3.6);
  inspect('font', noah, () => point(plan.fontTarget, 0.1, 0.05), 3.86, 4.39, [{ choice: fontChoice, at: 4.15 }], 0);
  approach(iris, () => point(plan.fontTarget, 0.85, 0), 3.0);
  timeline.fromTo(plan.textGuide, { scaleX: 0.85 }, { scaleX: 1, transformOrigin: 'left center', duration: 0.45, immediateRender: false }, 3.23);
  move(iris, () => point(plan.fontTarget, 1, 0), 3.23, 0.45);
  timeline.to(plan.textGuide, { autoAlpha: 0, duration: 0.2 }, 4.0);
  depart(noah, () => optionPosition('font', fontChoice), 4.5);
  depart(iris, () => point(plan.fontTarget, 1, 0), 3.9);

  // Leo types into an isolated decorative ghost. React's semantic text is untouched.
  let typedCount = -1;
  let caretSceneWidth = 0;
  let caretPoint: Point | undefined;
  const invalidateCaret = () => { cancelMotionRead(plan.caret); caretPoint = undefined; invalidateMotionFrame(plan.caret); };
  plan.invalidateCaret = invalidateCaret;
  approach(leo, () => ({ x: plan.copyBox.x + 3, y: plan.copyBox.y + 8 }), copyStart - 0.26);
  approach(sam, () => ({ x: plan.copyBox.x + plan.copyBox.width, y: plan.copyBox.y + plan.copyBox.height }), copyStart - 0.26, true);
  captureOrigin(copyStart - 0.22);
  timeline.fromTo(plan.ghost, { autoAlpha: 0, x: () => sourcePoint(plan, copyStart - 0.22).x - plan.copyBox.x - plan.copyBox.width / 2, y: () => sourcePoint(plan, copyStart - 0.22).y - plan.copyBox.y - plan.copyBox.height / 2, scale: 0.025 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.22, ease: 'power2.out', immediateRender: false }, copyStart - 0.22);
  timeline.fromTo(plan.caret, { opacity: 0.35 }, { opacity: 1, duration: 0.17, repeat: 9, yoyo: true, ease: 'steps(1)' }, copyStart);
  timeline.set(plan.ghost, { fontFamily: 'IBM Plex Mono, monospace' }, 1.85);
  timeline.call(invalidateCaret, [], 1.85);
  timeline.set(plan.ghost, { fontFamily: () => plan.fontFamily }, 2.95);
  timeline.call(invalidateCaret, [], 2.95);
  const typing = { count: 0 };
  const copyControl = cursorControl(leo), setCopyX = copyControl.setX, setCopyY = copyControl.setY;
  timeline.fromTo(typing, { count: 0 }, { count: plan.copy.length, duration: copyEnd - copyStart, ease: `steps(${Math.max(1, plan.copy.length)})`, onUpdate: () => {
    const count = Math.round(typing.count), sceneWidth = plan.scene.clientWidth;
    if (sceneWidth !== caretSceneWidth) { caretSceneWidth = sceneWidth; caretPoint = undefined; }
    if (count !== typedCount) {
      typedCount = count;
      plan.typingContent.textContent = plan.copy.slice(0, count);
      caretPoint = undefined;
    }
    if (!caretPoint) {
      const revision = copyControl.revision;
      queueMotionRead(plan.caret, () => {
        if (copyControl.revision !== revision || typedCount !== count) return;
        // Read all changed ghosts together at the same ticker tail, before any
        // queued caret cursor writes. Glyph wrapping remains the authority.
        const caret = getMotionRect(plan.caret, true), scene = getMotionRect(plan.scene), view = getMotionViewport();
        const position = { x: Math.min(sceneWidth - 56, caret.left - scene.left + 7), y: caret.top - scene.top + 10 };
        return () => {
          if (copyControl.revision !== revision || typedCount !== count) return;
          caretPoint = position;
          setCopyX(position.x); setCopyY(position.y);
          writeCursorLabels(leo, copyControl, scene.left, scene.top, view.width, view.height);
        };
      });
    } else {
      cancelMotionRead(plan.caret);
      setCopyX(caretPoint.x); setCopyY(caretPoint.y);
    }
  } }, copyStart);
  timeline.call(() => cancelMotionRead(plan.caret), [], copyEnd + 0.12);
  timeline.to(plan.ghost, { autoAlpha: 0, duration: 0.18 }, copyEnd + 0.12);
  move(sam, () => ({ x: plan.copyBox.x + 8, y: plan.copyBox.y + plan.copyBox.height }), copyStart + 0.1, copyEnd - copyStart - 0.1);
  timeline.fromTo(plan.proof, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.15 }, copyEnd);
  timeline.to(plan.proof, { autoAlpha: 0, duration: 0.16 }, 3.5);
  if (!plan.copyWholeTarget) {
    // A card's artwork and shell can be placed while its copy is still being
    // written. Only conceal the corresponding leaf, never the entire card.
    timeline.fromTo(plan.copyLeaf, { opacity: 0 }, { opacity: 1, duration: 0.18 }, copyEnd + 0.02);
  }
  depart(leo, () => ({ x: Math.min(plan.scene.clientWidth - 75, plan.copyBox.x + plan.copyBox.width), y: plan.copyBox.y + plan.copyBox.height }), 3.36);
  depart(sam, () => ({ x: plan.copyBox.x + 8, y: plan.copyBox.y + plan.copyBox.height }), 3.36);

  // You place the actual components into Mia's finished frames.
  approach(you, () => draggedPoint(plan, component, componentAt, 0, 0, 0), componentAt - 0.25, true);
  approach(kai, () => draggedPoint(plan, component, componentAt, 0, 1, 1), componentAt - 0.25);
  plan.targets.forEach((target, index) => {
    const isCopy = target === plan.copyTarget && plan.copyWholeTarget;
    const reveal = target.kind === 'text' || target.kind === 'line';
    const at = isCopy ? copyEnd : componentStart + index * stagger;
    const duration = isCopy ? 0.22 : reveal ? 0.8 : 1.13;
    const authoredLeaf = /^(H[1-3]|P|SPAN|IMG|SVG|CANVAS)$/i.test(target.target.tagName) && target.target !== plan.copyLeaf;
    gsap.set(target.target, { transformOrigin: '50% 50%', opacity: 0 });
    if (!authoredLeaf) {
      timeline.set(target.target, { willChange: 'transform, opacity' }, Math.max(0, at - 0.12));
      timeline.set(target.target, { willChange: 'auto' }, at + duration + 0.15);
    }
    captureOrigin(at);
    // Bare semantic targets are written/placed by their own leaf worker later;
    // only their empty frame participates in the earlier container handoff.
    if (!authoredLeaf) timeline.fromTo(target.target, { ...target.motion, x: () => sourceMotion(plan, target, at).x, y: () => sourceMotion(plan, target, at).y, ...(reveal ? { clipPath: 'inset(0 100% 0 0)' } : {}) }, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, ...(reveal ? { clipPath: 'inset(0 0% 0 0)' } : {}), duration, ease: 'power2.inOut', immediateRender: false }, at);
    if (!authoredLeaf && target !== component && !isCopy) {
      const crew = ['Ada', 'Sol', 'June', 'Max', 'Rin', 'Bea', 'Jules', 'Tao'];
      const maker = createCursor({ name: crew[index % crew.length], color: collaborators[(index + 6) % collaborators.length].color, role: 'frame' });
      maker.classList.add('assembly-container-maker');
      const action = maker.querySelector<HTMLElement>('.assembly-cursor-action');
      if (action) action.textContent = target.kind === 'line' ? 'Drawing this section' : 'Building this frame';
      plan.overlay.append(maker);
      plan.cursors.push(maker);
      approach(maker, () => draggedPoint(plan, target, at, 0, 1, 1), at - 0.24);
      const grip = { progress: 0 };
      const control = cursorControl(maker), setX = control.setX, setY = control.setY;
      timeline.fromTo(grip, { progress: 0 }, { progress: 1, duration, ease: 'power2.inOut', immediateRender: false, onUpdate: () => {
        const corner = draggedPoint(plan, target, at, grip.progress, 1, 1);
        setX(corner.x); setY(corner.y);
      } }, at);
      depart(maker, () => point(target, 1, 1), at + duration + 0.1);
    }
    timeline.fromTo(target.shell, { x: () => sourceMotion(plan, target, at).x, y: () => sourceMotion(plan, target, at).y, rotation: target.motion.rotation, scale: target.motion.scale }, { x: 0, y: 0, rotation: 0, scale: 1, duration, ease: 'power2.inOut', immediateRender: false }, at);
    timeline.fromTo(target.frame, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, at);
    timeline.to(target.frame, { autoAlpha: 0, duration: 0.16 }, at + duration + 0.14);
    timeline.to(target.wireframe, { autoAlpha: 0, duration: 0.2 }, at + duration - 0.05);
    burst(at, target, index);
  });
  trackPair(you, kai, component, componentAt, componentDuration);
  const componentDone = componentAt + componentDuration;
  returnHome(you, componentDone + 0.08); returnHome(kai, componentDone + 0.08);
  const checkAt = componentDone + 0.53;
  approach(you, () => point(alignTarget, 0, 0), checkAt);
  approach(kai, () => point(alignTarget, 1, 1), checkAt, true);
  timeline.fromTo(alignTarget.frame, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, immediateRender: false }, checkAt + 0.24);
  timeline.to(alignTarget.frame, { autoAlpha: 0, duration: 0.12 }, checkAt + 0.52);
  depart(you, () => point(alignTarget, 0, 0), checkAt + 0.65);
  depart(kai, () => point(alignTarget, 1, 1), checkAt + 0.65);

  // Ava tries a palette and applies it to a real accent, preserving its final color.
  const accent = plan.scene.querySelector<HTMLElement>('[data-color-target], .coral, .name-period, .ps-section-number') ?? textLeaf(plan.fontTarget.target);
  const finalColor = getComputedStyle(accent).color;
  const rgb = (finalColor.match(/[\d.]+/g) ?? ['168', '201', '154']).slice(0, 3).map(Number);
  const palette = [{ choice: 'sage', rgb: [168, 201, 154] }, { choice: 'coral', rgb: [241, 135, 102] }, { choice: 'cream', rgb: [237, 236, 229] }, { choice: 'lavender', rgb: [183, 160, 236] }];
  const colorChoice = palette.reduce((best, swatch) => swatch.rgb.reduce((sum, value, i) => sum + (value - rgb[i]) ** 2, 0) < best.rgb.reduce((sum, value, i) => sum + (value - rgb[i]) ** 2, 0) ? swatch : best).choice;
  approach(ava, () => point(component, 0.88, 0.12), colorStart - 0.25, true);
  approach(zoe, () => point(component, 0, 1), colorStart - 0.25);
  inspect('color', ava, () => point(component, 0.88, 0.12), colorStart, 5.08, [{ choice: colorChoice, at: 4.84 }], 0);
  timeline.fromTo(accent, { color: '#b7a0ec' }, { color: finalColor, duration: 0.28 }, 4.84);
  timeline.fromTo(component.target, { filter: 'hue-rotate(22deg) saturate(.7)' }, { filter: 'hue-rotate(0deg) saturate(1)', duration: 0.35, immediateRender: false }, 4.84);
  move(zoe, () => point(component, 0, 0), colorStart + 0.2, 0.55);
  timeline.fromTo(plan.contrast, { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: 0.18 }, colorStart + 0.75);
  timeline.to(plan.contrast, { autoAlpha: 0, duration: 0.18 }, 5.8);
  depart(ava, () => optionPosition('color', colorChoice), 5.25);
  depart(zoe, () => point(component, 0, 0), 5.8);

  // Eli finishes with visible alignment axes, a measured gap, and a small snap.
  approach(eli, () => point(alignTarget, 0, 0.5), alignStart - 0.24);
  approach(remy, () => point(alignTarget, 1, 0.5), alignStart - 0.24, true);
  inspect('spacing', eli, () => point(alignTarget, 0, 0.5), alignStart, 5.99, [{ choice: 'left', at: 5.53 }, { choice: 'gap16', at: 5.76 }], 0);
  timeline.fromTo(plan.guides, { autoAlpha: 0, scaleX: 0.4 }, { autoAlpha: 1, scaleX: 1, duration: 0.25 }, alignStart);
  timeline.fromTo(plan.grid, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, alignStart);
  returnHome(eli, 6.1); returnHome(remy, 6.1);
  approach(eli, () => point(alignTarget, 0, 0), 6.55);
  approach(remy, () => point(alignTarget, 1, 1), 6.55, true);
  const snapAt = 6.9, snap = mobile ? 5 : 10;
  timeline.fromTo([alignTarget.target, alignTarget.shell], { x: snap }, { x: 0, duration: 0.35, ease: 'power2.out', immediateRender: false }, snapAt);
  [eli, remy].forEach((cursor, index) => {
    const control = cursorControl(cursor);
    const alignment = { offset: snap };
    timeline.fromTo(alignment, { offset: snap }, { offset: 0, duration: 0.35, ease: 'power2.out', immediateRender: false, onUpdate: () => {
      const corner = point(alignTarget, index, index);
      control.setX(corner.x + alignment.offset); control.setY(corner.y);
    } }, snapAt);
  });
  timeline.to(plan.guides, { autoAlpha: 0, duration: 0.2 }, 7.35);
  timeline.to(plan.grid, { autoAlpha: 0, duration: 0.2 }, 7.35);
  timeline.to(plan.sectionOutline, { autoAlpha: 0, duration: 0.2 }, 5.35);
  depart(eli, () => point(alignTarget, 0, 0), 7.5);
  depart(remy, () => point(alignTarget, 1, 1), 7.5);
  timeline.to({}, { duration: 0.1 }, 10.3);
  plan.constructionCleanup = addElementConstruction({
    scene: plan.scene,
    overlay: plan.overlay,
    timeline,
    targets: plan.targets.map(({ target }) => target),
    start: 3.15,
    end: 9.65,
    skip: [plan.copyLeaf],
    onPrimaryArtworkReady: plan.intro ? plan.onIntroHandoff : undefined,
  });
  timeline.duration(plan.intro ? 8 : 10);
  timeline.eventCallback('onUpdate', () => {
    if (plan.intro) plan.onIntroProgress?.(timeline.progress());
    const time = timeline.time();
    panelEntries.forEach(([kind, node]) => {
      const active = menuWindows.some(window => window.kind === kind && time >= window.start && time < window.end);
      if (!active) {
        if (node.dataset.open !== 'false') menuClose(node);
      } else if (node.dataset.open !== 'true') {
        placePanel(kind, true);
        node.dataset.open = 'true'; node.dataset.menuActive = 'true';
        node.classList.remove('assembly-inspector-blocked');
      }
    });
    // Keep action pills on the canvas side of the pointer on a narrow viewport.
    const host = getMotionRect(plan.scene), view = getMotionViewport();
    // Collect geometry before data-attribute or clamp writes can dirty style.
    panelEntries.forEach(([, node]) => {
      if (node.dataset.open === 'true') panelRects.set(node, getMotionRect(node));
    });
    cursorControls.forEach((control, cursor) => {
      writeCursorLabels(cursor, control, host.left, host.top, view.width, view.height);
    });
    // Keep an opened inspector locked to its work point, correcting only when
    // the moving camera would otherwise carry it outside the viewport.
    panelEntries.forEach(([, node]) => {
      if (node.dataset.open !== 'true') return;
      const rect = panelRects.get(node)!;
      const current = { x: parseFloat(node.style.left), y: parseFloat(node.style.top), width: rect.width, height: rect.height };
      const next = keepConstructionMenuInView(node, plan.scene, current);
      if (next.x !== current.x) node.style.left = `${next.x}px`;
      if (next.y !== current.y) node.style.top = `${next.y}px`;
      if (next.x !== current.x || next.y !== current.y) invalidatePanel(node);
    });
    plan.onTimedProgress?.();
  });
  if (plan.intro) {
    timeline.eventCallback('onComplete', () => {
      cancelMotionRead(plan.caret);
      plan.introComplete = true; makeReadable(plan.targets.map(({ target }) => target));
      gsap.set(plan.overlay, { autoAlpha: 0 });
      plan.onIntroComplete?.();
      document.dispatchEvent(new CustomEvent('assembly:intro-complete'));
    });
    timeline.restart(true);
  } else {
    plan.trigger = ScrollTrigger.create({
      trigger: plan.scene, animation: timeline,
      start: () => sceneScrollBounds(plan.scene, mobile).start,
      end: () => sceneScrollBounds(plan.scene, mobile).end,
      scrub: 0.6, invalidateOnRefresh: true,
    });
  }
}
/** Assemble natural-layout [data-assemble] children; replayKey restarts the composition. */
export function useAssembly(root: RefObject<HTMLElement | null>, enabled: boolean, replayKey: number): void {
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const flowStatus = element.dataset;
    const allTargets = Array.from(element.querySelectorAll<HTMLElement>('[data-assemble]'));
    makeReadable(allTargets);
    invalidateMotionFrame();
    if (!enabled) return;

    gsap.registerPlugin(ScrollTrigger);
    const releaseMotionFrame = retainMotionFrame();
    const media = gsap.matchMedia();
    let disposed = false;
    let playbackPaused = element.dataset.playback === 'paused';
    let introFinished = false;
    let introReleased = false;
    let introProgress = 0;
    const timedProgress = new Map<HTMLElement, number>();
    const context = gsap.context(() => {
      media.add({ mobile: '(max-width: 767px)', desktop: '(min-width: 768px)', reduce: '(prefers-reduced-motion: reduce)' }, (mediaContext) => {
        invalidateMotionFrame();
        if (mediaContext.conditions?.reduce) {
          makeReadable(allTargets);
          return;
        }
        type Size = { width: number; height: number };
        type SceneRecord = {
          scene: HTMLElement; targets: HTMLElement[]; plan?: ScenePlan;
          building: boolean; observer?: ResizeObserver; sizes: Map<HTMLElement, Size>;
        };
        const mobile = Boolean(mediaContext.conditions?.mobile);
        const plans: ScenePlan[] = [];
        const records = Array.from(element.querySelectorAll<HTMLElement>('.assembly-scene')).map(scene => ({
          scene, targets: [] as HTMLElement[], building: false, sizes: new Map<HTMLElement, Size>(),
        } as SceneRecord));
        const byScene = new Map(records.map(record => [record.scene, record]));
        allTargets.forEach(target => {
          const scene = target.closest<HTMLElement>('.assembly-scene');
          if (scene && !target.parentElement?.closest('[data-assemble]')) byScene.get(scene)?.targets.push(target);
        });
        const pending = new Set(records.filter(record => record.targets.length));
        const initialScroll = scrollY;
        let hasObservedMovement = false;
        let lastObservedScroll = initialScroll;
        let movementDirection = 1;
        const prewarmRecords: SceneRecord[] = [];
        let prewarmStarted = false;
        let visiblePendingCount = 0;
        let active = true;
        let focusedPlan: ScenePlan | undefined;
        let idleHandle: number | undefined;
        let idleTimer: number | undefined;
        let idleFrame: number | undefined;
        let nearFrame: number | undefined;
        let idleBudgetStarted = 0;
        let pendingRefresh: gsap.core.Tween | undefined;
        let noScroll = getMotionScrollLimit() <= 1;
        if (!noScroll) timedProgress.clear();
        const timedPlans = new Set<ScenePlan>();
        let advancingTimedPlayback = false;
        const publishFlow = (state: 'scroll' | 'playing' | 'complete') => {
          const groups = records.filter(record => record.targets.length && !record.scene.hasAttribute('data-intro'));
          const progress = state === 'complete' ? 100 : state === 'scroll' ? 0 : Math.round(100 * groups.reduce((sum, record) => sum + (record.plan?.timeline?.progress() ?? timedProgress.get(record.scene) ?? 0), 0) / Math.max(1, groups.length));
          if (element.dataset.assemblyFlow === state && element.dataset.assemblyFlowProgress === String(progress)) return;
          element.dataset.assemblyFlow = state;
          element.dataset.assemblyFlowProgress = String(progress);
          document.dispatchEvent(new CustomEvent('assembly:flow-state', { detail: { state, progress } }));
        };
        publishFlow(noScroll ? 'playing' : 'scroll');

        // With the entire page in view there is no scroll distance to scrub.
        // Keep the same crews and jobs, with up to three scenes overlapping.
        function advanceTimedPlayback() {
          if (!active || disposed || !noScroll || !introReleased || advancingTimedPlayback) return;
          if (playbackPaused) return;
          publishFlow(flowStatus.assemblyFlow === 'complete' ? 'complete' : 'playing');
          timedPlans.forEach(plan => { if (plan.timeline?.progress() === 1) timedPlans.delete(plan); });
          if (timedPlans.size >= 3) return;
          const latest = Array.from(timedPlans).pop();
          if (latest?.timeline && latest.timeline.progress() < 0.4) return;
          advancingTimedPlayback = true;
          try {
            while (true) {
              const record = records.find(next => next.targets.length && !next.scene.hasAttribute('data-intro') && !next.building && (!next.plan || !timedPlans.has(next.plan)) && (!next.plan?.timeline || next.plan.timeline.progress() < 1));
              if (!record) {
                publishFlow(timedPlans.size ? 'playing' : 'complete');
                return;
              }
              publishFlow('playing');
              const plan = record.plan ?? buildRecord(record);
              if (!plan?.timeline) return;
              if (plan.timeline.progress() >= 1) continue;
              plan.trigger?.disable(false, false);
              timedPlans.add(plan);
              plan.timeline.play();
              return;
            }
          } finally {
            advancingTimedPlayback = false;
          }
        }
        const syncPlaybackMode = () => {
          const nextNoScroll = getMotionScrollLimit() <= 1;
          if (nextNoScroll === noScroll) {
            if (noScroll) advanceTimedPlayback();
            return;
          }
          noScroll = nextNoScroll;
          timedPlans.forEach(plan => plan.timeline?.pause());
          timedPlans.clear();
          if (!noScroll) timedProgress.clear();
          publishFlow(noScroll ? 'playing' : 'scroll');
          plans.forEach(plan => {
            if (plan.intro) return;
            plan.timed = noScroll;
            if (noScroll) {
              plan.trigger?.disable(false, false);
              plan.timeline?.pause();
            } else {
              plan.trigger?.enable(false, false);
              plan.trigger?.refresh();
              plan.trigger?.update();
            }
          });
          if (noScroll) advanceTimedPlayback();
        };
        const resizePlayback = () => {
          invalidateMotionFrame();
          syncPlaybackMode();
        };
        window.addEventListener('resize', resizePlayback);
        const sizeOf = (node: HTMLElement): Size => ({ width: node.offsetWidth, height: node.offsetHeight });
        const sameSize = (a: Size | undefined, b: Size) => Boolean(a && a.width === b.width && a.height === b.height);
        const captureSizes = (record: SceneRecord) => {
          record.sizes.set(record.scene, sizeOf(record.scene));
          record.targets.forEach(target => record.sizes.set(target, sizeOf(target)));
        };
        // Pending content keeps its real layout and keyboard semantics. Only its
        // owned root paint is hidden, so nested scenes can be prepared separately.
        gsap.set(Array.from(pending).flatMap(record => record.targets), { opacity: 0 });
        pending.forEach(record => { record.scene.dataset.assemblyPending = 'true'; });

        const requestRefresh = mediaContext.add('refreshAssemblyGeometry', () => {
          if (!active || disposed) return;
          pendingRefresh?.kill();
          pendingRefresh = gsap.delayedCall(0.12, () => {
            pendingRefresh = undefined;
            if (active && !disposed) ScrollTrigger.refresh();
          });
        }) as () => void;
        const nearestPendingRecord = (visibleOnly = false) => {
          const band = usableViewport(element), center = (band.top + band.bottom) / 2;
          let best: SceneRecord | undefined, bestRank = Infinity, bestDistance = Infinity;
          if (visibleOnly) visiblePendingCount = 0;
          for (const record of pending) {
            if (record.building) continue;
            const rect = getMotionRect(record.scene);
            const visible = rect.bottom > band.top && rect.top < band.bottom;
            if (visibleOnly && !visible) continue;
            if (visibleOnly) visiblePendingCount++;
            const nextUp = movementDirection < 0 ? rect.bottom <= band.top : rect.top >= band.bottom;
            const rank = visible ? 0 : nextUp ? 1 : 2;
            const distance = visible ? Math.abs((Math.max(rect.top, band.top) + Math.min(rect.bottom, band.bottom)) / 2 - center)
              : nextUp ? movementDirection < 0 ? band.top - rect.bottom : rect.top - band.bottom
                : Math.min(Math.abs(rect.top - band.bottom), Math.abs(rect.bottom - band.top));
            if (rank < bestRank || (rank === bestRank && distance < bestDistance)) {
              best = record; bestRank = rank; bestDistance = distance;
            }
          }
          return best;
        };
        const nextIdleRecord = () => {
          while (prewarmRecords.length && !pending.has(prewarmRecords[0])) prewarmRecords.shift();
          if (prewarmRecords.length) return prewarmRecords[0];
          if (!introReleased && !hasObservedMovement) return undefined;
          return nearestPendingRecord();
        };
        const runIdleBuild = (deadline?: IdleDeadline) => {
          idleHandle = undefined;
          idleTimer = undefined;
          idleFrame = undefined;
          if (!active || disposed) return;
          const record = nextIdleRecord();
          if (!record) return;
          // Never turn a single idle callback into an all-scenes construction batch.
          if (deadline && !deadline.didTimeout && deadline.timeRemaining() < 8 && performance.now() - idleBudgetStarted < 900) {
            queueIdleBuild();
            return;
          }
          buildRecord(record);
          if (prewarmRecords[0] === record) prewarmRecords.shift();
          idleBudgetStarted = 0;
          queueIdleBuild();
        };
        function queueIdleBuild() {
          if (!active || disposed || !nextIdleRecord() || idleHandle !== undefined || idleTimer !== undefined || idleFrame !== undefined) return;
          if (!idleBudgetStarted) idleBudgetStarted = performance.now();
          if (typeof window.requestIdleCallback === 'function') idleHandle = window.requestIdleCallback(runIdleBuild, { timeout: 750 });
          else idleTimer = window.setTimeout(() => {
            idleTimer = undefined;
            idleFrame = requestAnimationFrame(() => runIdleBuild());
          }, introReleased ? 32 : 120);
        }

        // Idle, intersection, and focus callbacks execute after this media callback
        // returns. The wrapper keeps every later GSAP object in the same context.
        const buildRecord = mediaContext.add('buildAssemblyScene', (record: SceneRecord): ScenePlan | undefined => {
          if (!active || disposed || record.building) return record.plan;
          if (record.plan) return record.plan;
          record.building = true;
          try {
            const plan = createScene(record.scene, record.targets, mobile);
            plan.timed = noScroll && !plan.intro;
            if (!plan.intro) plan.onTimedProgress = () => { if (noScroll) advanceTimedPlayback(); };
            record.plan = plan;
            const savedIntroProgress = introProgress;
            plan.onIntroProgress = progress => {
              introProgress = progress;
              if (progress >= 0.55 && !prewarmStarted && !introFinished) {
                prewarmStarted = true;
                // The first handoff must be ready even on a tall viewport where
                // a later heading happens to sit closer to the visual center.
                prewarmRecords.push(...records.slice(records.indexOf(record) + 1).filter(next => pending.has(next)).slice(0, 2));
                queueIdleBuild();
              }
            };
            plan.onIntroHandoff = () => {
              if (introReleased) return;
              introReleased = true;
              queueIdleBuild();
              advanceTimedPlayback();
              document.dispatchEvent(new CustomEvent('assembly:intro-handoff'));
            };
            plan.onIntroComplete = () => {
              introFinished = true;
              plan.onIntroHandoff?.();
              queueIdleBuild();
              advanceTimedPlayback();
            };
            measureScene(plan);
            animateScene(plan, mobile);
            plans.push(plan);
            pending.delete(record);
            delete record.scene.dataset.assemblyPending;
            if (plan.intro && introFinished) {
              plan.timeline?.pause().progress(1, true);
              plan.introComplete = true;
              makeReadable([...plan.targets.map(({ target }) => target), plan.copyLeaf]);
              gsap.set(plan.overlay, { autoAlpha: 0 });
            } else if (plan.intro) {
              if (savedIntroProgress > 0) plan.timeline?.delay(0).progress(savedIntroProgress, false);
              if (playbackPaused) plan.timeline?.pause();
            } else {
              plan.timeline?.eventCallback('onComplete', () => {
                if (noScroll && timedPlans.delete(plan)) {
                  advanceTimedPlayback();
                }
              });
              if (noScroll) {
                plan.trigger?.disable(false, false);
                plan.timeline?.pause();
                const savedProgress = timedProgress.get(plan.scene);
                if (savedProgress !== undefined) plan.timeline?.progress(savedProgress, false);
              } else {
                // No layout was inserted: only this new trigger needs its first read.
                // Updating now also handles a manual jump past its end before idle ran.
                plan.trigger?.refresh();
                plan.trigger?.update();
              }
            }
            captureSizes(record);
            if (typeof ResizeObserver !== 'undefined') {
              record.observer = new ResizeObserver(entries => {
                if (!active) return;
                let changed = false;
                entries.forEach(({ target }) => {
                  const node = target as HTMLElement, size = sizeOf(node);
                  if (!sameSize(record.sizes.get(node), size)) changed = true;
                  record.sizes.set(node, size);
                });
                // Initial observer deliveries match the captured size and do not
                // cause another global refresh while the opening is playing.
                if (changed) requestRefresh();
              });
              record.observer.observe(record.scene);
              record.targets.forEach(target => record.observer!.observe(target));
            }
            return plan;
          } finally {
            record.building = false;
            if (noScroll) advanceTimedPlayback();
          }
        }) as (record: SceneRecord) => ScenePlan | undefined;

        const measure = () => {
          plans.forEach(plan => { if (!plan.introComplete) measureScene(plan); });
          records.forEach(record => { if (record.plan) captureSizes(record); });
        };
        const pauseIntro = () => {
          playbackPaused = true;
          plans.forEach(plan => { if ((plan.intro && !plan.introComplete) || timedPlans.has(plan)) plan.timeline?.pause(); });
        };
        const resumeIntro = () => {
          playbackPaused = false;
          plans.forEach(plan => { if (plan.intro && !plan.introComplete) plan.timeline?.resume(); });
          timedPlans.forEach(plan => plan.timeline?.resume());
          advanceTimedPlayback();
        };
        document.addEventListener('assembly:playback-pause', pauseIntro);
        document.addEventListener('assembly:playback-resume', resumeIntro);
        ScrollTrigger.addEventListener('refreshInit', measure);
        const releaseFocusedScene = mediaContext.add('releaseAssemblyFocus', () => {
          const plan = focusedPlan;
          focusedPlan = undefined;
          if (!plan || plan.intro) return;
          gsap.set(plan.overlay, { autoAlpha: 1 });
          if (noScroll) { advanceTimedPlayback(); return; }
          plan.trigger?.enable(false, false);
          plan.trigger?.refresh();
        }) as () => void;
        const revealFocusedTarget = mediaContext.add('revealAssemblyFocus', (target: EventTarget | null, force = false) => {
          if (!(target instanceof Element)) return;
          const scene = target.closest<HTMLElement>('.assembly-scene');
          const record = scene ? byScene.get(scene) : undefined;
          const plan = record?.targets.length ? buildRecord(record) : undefined;
          if (!plan || (focusedPlan === plan && !force)) return;
          if (focusedPlan !== plan) releaseFocusedScene();
          focusedPlan = plan;
          plan.trigger?.disable(false, false);
          plan.timeline?.pause().progress(1, false);
          makeReadable([...plan.targets.map(({ target: node }) => node), plan.copyLeaf]);
          gsap.set(plan.overlay, { autoAlpha: 0 });
        }) as (target: EventTarget | null, force?: boolean) => void;
        const restoreFocusedScene = () => {
          pendingRefresh?.kill();
          pendingRefresh = undefined;
          plans.forEach(plan => plan.syncCursorControls?.());
          syncPlaybackMode();
          revealFocusedTarget(document.activeElement, true);
        };
        const onFocusIn = (event: FocusEvent) => revealFocusedTarget(event.target);
        const onFocusOut = (event: FocusEvent) => {
          if (focusedPlan && event.relatedTarget instanceof Node && focusedPlan.scene.contains(event.relatedTarget)) return;
          releaseFocusedScene();
        };
        element.addEventListener('focusin', onFocusIn);
        element.addEventListener('focusout', onFocusOut);
        ScrollTrigger.addEventListener('refresh', restoreFocusedScene);

        const scanNearby = () => {
          nearFrame = undefined;
          if (!active || disposed || !pending.size) return;
          const view = getMotionViewport();
          hasObservedMovement ||= Math.abs(view.scrollY - initialScroll) > 1;
          if (hasObservedMovement) {
            const record = nearestPendingRecord(true);
            if (record) {
              // Catch up one visible group per paint, never a tall-viewport batch.
              const moreVisible = visiblePendingCount > 1;
              buildRecord(record);
              if (moreVisible) nearFrame = requestAnimationFrame(scanNearby);
            }
          }
          queueIdleBuild();
        };
        const scheduleNearScan = () => {
          hasObservedMovement ||= Math.abs(scrollY - initialScroll) > 1;
          const delta = scrollY - lastObservedScroll;
          if (Math.abs(delta) > 0.5) movementDirection = delta < 0 ? -1 : 1;
          lastObservedScroll = scrollY;
          if (!active || nearFrame !== undefined) return;
          nearFrame = requestAnimationFrame(scanNearby);
        };
        window.addEventListener('scroll', scheduleNearScan, { passive: true });
        const intersectionObserver = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) queueIdleBuild();
        }, { rootMargin: '120% 0px 180% 0px' });
        pending.forEach(record => intersectionObserver?.observe(record.scene));

        const introRecord = records.find(record => record.targets.length && record.scene.hasAttribute('data-intro'));
        if (introRecord) buildRecord(introRecord);
        else introFinished = true;
        if (noScroll) advanceTimedPlayback();
        // Retained focus survives a media rebuild without another focusin event.
        revealFocusedTarget(document.activeElement);
        document.fonts?.ready.then(() => {
          if (!active || disposed) return;
          let changed = false;
          records.forEach(record => {
            if (!record.plan) return;
            record.plan.invalidateCaret?.();
            for (const node of [record.scene, ...record.targets]) {
              const size = sizeOf(node);
              if (!sameSize(record.sizes.get(node), size)) changed = true;
              record.sizes.set(node, size);
            }
          });
          if (changed) requestRefresh();
        });
        queueIdleBuild();

        return () => {
          active = false;
          if (noScroll) plans.forEach(plan => { if (!plan.intro && plan.timeline) timedProgress.set(plan.scene, plan.timeline.progress()); });
          if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
          if (idleTimer !== undefined) clearTimeout(idleTimer);
          for (const frame of [idleFrame, nearFrame]) if (frame !== undefined) cancelAnimationFrame(frame);
          pendingRefresh?.kill();
          intersectionObserver?.disconnect();
          records.forEach(record => {
            record.observer?.disconnect();
            delete record.scene.dataset.assemblyPending;
          });
          ScrollTrigger.removeEventListener('refreshInit', measure);
          ScrollTrigger.removeEventListener('refresh', restoreFocusedScene);
          document.removeEventListener('assembly:playback-pause', pauseIntro);
          document.removeEventListener('assembly:playback-resume', resumeIntro);
          element.removeEventListener('focusin', onFocusIn);
          element.removeEventListener('focusout', onFocusOut);
          window.removeEventListener('scroll', scheduleNearScan);
          window.removeEventListener('resize', resizePlayback);
          plans.forEach(({ constructionCleanup, overlay, caret }) => { cancelMotionRead(caret); constructionCleanup?.(); overlay.remove(); });
          invalidateMotionFrame();
          delete element.dataset.assemblyFlow;
          delete element.dataset.assemblyFlowProgress;
        };
      });
    }, element);

    return () => {
      disposed = true;
      media.revert();
      context.revert();
      makeReadable(allTargets);
      invalidateMotionFrame();
      releaseMotionFrame();
    };
  }, [root, enabled, replayKey]);
}
