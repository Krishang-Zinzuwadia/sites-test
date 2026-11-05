import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { collaborators, createCursor, createToolPanel } from './DesignTools';
import { addElementConstruction } from './elementConstruction';
import { constructionMenuPosition, releaseConstructionMenu } from './menuPlacement';
import './assembly.css';

type AssemblyKind = 'text' | 'card' | 'art' | 'line';
type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type Motion = { x: number; y: number; rotation: number; scale: number; opacity: number };
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
  timeline?: gsap.core.Timeline; trigger?: ScrollTrigger; intro: boolean; introComplete?: boolean;
  onIntroProgress?: (progress: number) => void; onIntroComplete?: () => void;
  constructionCleanup?: () => void;
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
function createScene(scene: HTMLElement, targets: HTMLElement[], mobile: boolean): ScenePlan {
  const overlay = element('div', 'assembly-overlay'); overlay.dataset.assemblyOverlay = '';
  overlay.setAttribute('aria-hidden', 'true'); scene.append(overlay);
  const targetPlans = targets.map((target, index) => createTarget(target, index, mobile, overlay));
  const textPlans = targetPlans.filter(({ kind }) => kind === 'text');
  const fontTarget = textPlans[0] ?? targetPlans[0];
  const copyTarget = textPlans.find(({ target }) => target.querySelector('p')) ?? textPlans[1] ?? textPlans[0] ?? targetPlans[0];
  const copyLeaf = textLeaf(copyTarget.target);
  const ghost = element('div', 'assembly-type-ghost');
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
  return { scene, overlay, targets: targetPlans, cursors, panels, ghost, typingContent, caret, copyLeaf, copyTarget, copyWholeTarget: copyTarget.kind === 'text' || copyLeaf === copyTarget.target, fontTarget, guides, dimension, sectionOutline, textGuide, grid, proof, contrast, particles, sourceOrigins: new Map(), copyBox: { x: 0, y: 0, width: 0, height: 0 }, copy: (copyLeaf.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 180), fontFamily: '', mobile, intro: scene.hasAttribute('data-intro') };
}
function relativeBox(target: HTMLElement, scene: HTMLElement, sceneBox: DOMRect): Box {
  const rect = target.getBoundingClientRect();
  return { x: rect.left - sceneBox.left - scene.clientLeft + scene.scrollLeft, y: rect.top - sceneBox.top - scene.clientTop + scene.scrollTop, width: rect.width, height: rect.height };
}
function positionBox(node: HTMLElement, box: Box) {
  Object.assign(node.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` });
}
function measureScene(plan: ScenePlan) {
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
}
const sceneUnits = 10.4;
function sourcePoint(plan: ScenePlan, at: number, live = false): Point {
  if (!live && plan.sourceOrigins.has(at)) return plan.sourceOrigins.get(at)!;
  const source = document.querySelector<HTMLElement>('[data-creation-source]')?.getBoundingClientRect();
  const sourceX = source ? source.left + source.width / 2 : plan.mobile ? 40 : 58;
  const sourceY = source ? source.top + source.height / 2 : innerHeight - (plan.mobile ? 106 : 130);
  const scene = plan.scene.getBoundingClientRect(), documentTop = scene.top + scrollY;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const start = plan.trigger?.start ?? Math.min(maxScroll, Math.max(0, documentTop - innerHeight * 0.95));
  const end = plan.trigger?.end ?? Math.min(maxScroll, Math.max(start + 1, documentTop - innerHeight * 0.2));
  // Future scenes are measured before they are on screen. Predict the scroll
  // position at this emission, rather than accidentally using mount-time scroll.
  const birthScroll = live || plan.intro ? scrollY : start + (end - start) * Math.min(1, Math.max(0, at / sceneUnits));
  return { x: sourceX - scene.left - plan.scene.clientLeft, y: sourceY + birthScroll - documentTop - plan.scene.clientTop };
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
function optionPoint(plan: ScenePlan, kind: ToolKind, choice: string): Point {
  const panel = plan.panels[kind], option = panel.querySelector<HTMLElement>(`[data-choice="${choice}"]`);
  const scene = plan.scene.getBoundingClientRect(), rect = (option ?? panel).getBoundingClientRect();
  return { x: rect.left - scene.left + rect.width * 0.55, y: rect.top - scene.top + rect.height * 0.55 };
}
function animateScene(plan: ScenePlan, mobile: boolean) {
  const timeline = gsap.timeline({ paused: true }); plan.timeline = timeline;
  const [mia, noah, leo, ava, eli, you, finn, iris, sam, zoe, remy, kai] = plan.cursors;
  const first = plan.targets[0], component = plan.targets.find(({ kind }) => kind === 'art' || kind === 'card') ?? first;
  const alignTarget = plan.targets.find(({ kind }) => kind === 'card') ?? component;
  const captureOrigin = (at: number) => timeline.call(() => {
    if (plan.trigger?.direction === -1) { plan.sourceOrigins.delete(at); return; }
    if (!plan.sourceOrigins.has(at)) plan.sourceOrigins.set(at, sourcePoint(plan, at, true));
  }, [], at);
  const curve = (cursor: HTMLElement, destination: () => Point, start: number, duration: number, mode: 'travel' | 'birth' | 'return' = 'travel', side = 1) => {
    const progress = { value: 0 };
    let origin: Point | undefined;
    const setX = gsap.quickSetter(cursor, 'x', 'px'), setY = gsap.quickSetter(cursor, 'y', 'px'), setScale = gsap.quickSetter(cursor, 'scale');
    timeline.call(() => {
      if (mode === 'birth') {
        origin = sourcePoint(plan, start, true);
        gsap.set(cursor, { x: origin.x, y: origin.y, scale: 0.15, autoAlpha: 1 });
      } else if (!origin || plan.trigger?.direction !== -1) {
        origin = { x: Number(gsap.getProperty(cursor, 'x')), y: Number(gsap.getProperty(cursor, 'y')) };
      }
    }, [], start);
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
  const placePanel = (kind: ToolKind, capture = false) => {
    const node = plan.panels[kind], owner = menuOwners[kind];
    if (capture || !menuAnchors.has(kind)) menuAnchors.set(kind, { x: Number(gsap.getProperty(owner, 'x')), y: Number(gsap.getProperty(owner, 'y')) });
    const chosen = constructionMenuPosition(node, plan.scene, menuAnchors.get(kind)!);
    Object.assign(node.style, { left: `${chosen.x}px`, top: `${chosen.y}px` });
  };
  const menuClose = (node: HTMLElement) => { node.dataset.open = 'false'; node.classList.add('assembly-inspector-blocked'); releaseConstructionMenu(node); };
  const panel = (kind: ToolKind, start: number, end: number) => {
    const node = plan.panels[kind];
    node.dataset.constructionMenu = kind;
    gsap.set(node, { transformOrigin: '12px 12px' });
    timeline.call(() => {
      if (plan.trigger?.direction === -1) { menuClose(node); return; }
      placePanel(kind, true);
      node.classList.remove('assembly-inspector-blocked'); node.dataset.open = 'true';
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
    const lx = gsap.quickSetter(lead, 'x', 'px'), ly = gsap.quickSetter(lead, 'y', 'px');
    const hx = gsap.quickSetter(helper, 'x', 'px'), hy = gsap.quickSetter(helper, 'y', 'px');
    timeline.fromTo(progress, { value: 0 }, { value: 1, duration, ease, immediateRender: false, onUpdate: () => {
      const a = draggedPoint(plan, target, at, progress.value, x1, y1), b = draggedPoint(plan, target, at, progress.value, x2, y2);
      lx(a.x); ly(a.y); hx(b.x); hy(b.y);
    } }, at);
  };
  const selectedOptions = new Map<ToolKind, HTMLElement>();
  const choose = (kind: ToolKind, choice: string, start: number) => {
    const option = plan.panels[kind].querySelector<HTMLElement>(`[data-choice="${choice}"]`);
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
      move(owner, () => optionPoint(plan, kind, choice), at - 0.14, 0.14);
      choose(kind, choice, at);
    });
  };

  // Release the whole real crew immediately. Each early visit measures a real
  // future work point, then returns home before its next creation task.
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
    const at = index * 0.02, work = preparations[index];
    const marker = element('div', 'assembly-prep-task');
    marker.style.setProperty('--prep-color', collaborators[index].color);
    marker.textContent = preparationLabels[index];
    plan.overlay.append(marker);
    approach(cursor, work, at, index % 2 === 1);
    timeline.call(() => {
      const position = work();
      Object.assign(marker.style, { left: `${position.x}px`, top: `${position.y - 15}px` });
    }, [], at + 0.23);
    timeline.fromTo(marker, { autoAlpha: 0, scaleX: 0.3 }, { autoAlpha: 1, scaleX: 1, duration: 0.12, immediateRender: false }, at + 0.23);
    timeline.to(marker, { autoAlpha: 0, duration: 0.08 }, at + 0.38);
    returnHome(cursor, at + 0.38);
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
  depart(noah, () => optionPoint(plan, 'font', fontChoice), 4.5);
  depart(iris, () => point(plan.fontTarget, 1, 0), 3.9);

  // Leo types into an isolated decorative ghost. React's semantic text is untouched.
  const copyStart = 1.98, copyEnd = 3.2;
  approach(leo, () => ({ x: plan.copyBox.x + 3, y: plan.copyBox.y + 8 }), copyStart - 0.26);
  approach(sam, () => ({ x: plan.copyBox.x + plan.copyBox.width, y: plan.copyBox.y + plan.copyBox.height }), copyStart - 0.26, true);
  captureOrigin(copyStart - 0.22);
  timeline.fromTo(plan.ghost, { autoAlpha: 0, x: () => sourcePoint(plan, copyStart - 0.22).x - plan.copyBox.x - plan.copyBox.width / 2, y: () => sourcePoint(plan, copyStart - 0.22).y - plan.copyBox.y - plan.copyBox.height / 2, scale: 0.025 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.22, ease: 'power2.out', immediateRender: false }, copyStart - 0.22);
  timeline.fromTo(plan.caret, { opacity: 0.35 }, { opacity: 1, duration: 0.17, repeat: 9, yoyo: true, ease: 'steps(1)' }, copyStart);
  timeline.set(plan.ghost, { fontFamily: 'IBM Plex Mono, monospace' }, 1.85);
  timeline.set(plan.ghost, { fontFamily: () => plan.fontFamily }, 2.95);
  const typing = { count: 0 };
  const setCopyX = gsap.quickSetter(leo, 'x', 'px'), setCopyY = gsap.quickSetter(leo, 'y', 'px');
  timeline.fromTo(typing, { count: 0 }, { count: plan.copy.length, duration: copyEnd - copyStart, ease: `steps(${Math.max(1, plan.copy.length)})`, onUpdate: () => {
    plan.typingContent.textContent = plan.copy.slice(0, Math.round(typing.count));
    const caret = plan.caret.getBoundingClientRect(), scene = plan.scene.getBoundingClientRect();
    setCopyX(Math.min(plan.scene.clientWidth - 56, caret.left - scene.left + 7)); setCopyY(caret.top - scene.top + 10);
  } }, copyStart);
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
  const componentStart = mobile ? 2.12 : 1.65;
  const stagger = Math.min(0.16, 0.65 / plan.targets.length);
  const componentAt = componentStart + plan.targets.indexOf(component) * stagger;
  const componentDuration = component.kind === 'text' || component.kind === 'line' ? 0.8 : 1.13;
  approach(you, () => draggedPoint(plan, component, componentAt, 0, 0, 0), componentAt - 0.25, true);
  approach(kai, () => draggedPoint(plan, component, componentAt, 0, 1, 1), componentAt - 0.25);
  plan.targets.forEach((target, index) => {
    const isCopy = target === plan.copyTarget && plan.copyWholeTarget;
    const reveal = target.kind === 'text' || target.kind === 'line';
    const at = isCopy ? copyEnd : componentStart + index * stagger;
    const duration = isCopy ? 0.22 : reveal ? 0.8 : 1.13;
    const authoredLeaf = /^(H[1-3]|P|SPAN|IMG|SVG|CANVAS)$/i.test(target.target.tagName) && target.target !== plan.copyLeaf;
    gsap.set(target.target, { transformOrigin: '50% 50%', opacity: 0, willChange: 'transform, opacity' });
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
      const setX = gsap.quickSetter(maker, 'x', 'px'), setY = gsap.quickSetter(maker, 'y', 'px');
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
  const colorStart = 4.55;
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
  depart(ava, () => optionPoint(plan, 'color', colorChoice), 5.25);
  depart(zoe, () => point(component, 0, 0), 5.8);

  // Eli finishes with visible alignment axes, a measured gap, and a small snap.
  const alignStart = 5.24;
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
  [eli, remy].forEach((cursor, index) => timeline.fromTo(cursor, { x: () => point(alignTarget, index, index).x + snap, y: () => point(alignTarget, index, index).y }, { x: () => point(alignTarget, index, index).x, duration: 0.35, ease: 'power2.out', immediateRender: false }, snapAt));
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
    start: 4.05,
    end: 9.65,
    skip: [plan.copyLeaf],
  });
  timeline.duration(plan.intro ? 8 : 10);
  timeline.eventCallback('onUpdate', () => {
    if (plan.intro) plan.onIntroProgress?.(timeline.progress());
    // Keep action pills on the canvas side of the pointer on a narrow viewport.
    const host = plan.scene.getBoundingClientRect();
    plan.cursors.forEach(cursor => {
      const x = Number(gsap.getProperty(cursor, 'x')), y = Number(gsap.getProperty(cursor, 'y'));
      cursor.dataset.edge = host.left + x > innerWidth - 145 ? 'right' : 'left';
      cursor.dataset.vertical = host.top + y > innerHeight - 78 ? 'above' : 'below';
    });
    // Keep an opened inspector locked to its work point, correcting only when
    // the moving camera would otherwise carry it outside the viewport.
    Object.values(plan.panels).forEach(node => {
      if (node.dataset.open !== 'true') return;
      const rect = node.getBoundingClientRect();
      const dx = Math.max(8, Math.min(innerWidth - rect.width - 8, rect.left)) - rect.left;
      const dy = Math.max(10, Math.min(innerHeight - rect.height - (mobile ? 83 : 20), rect.top)) - rect.top;
      if (dx) node.style.left = `${parseFloat(node.style.left) + dx}px`;
      if (dy) node.style.top = `${parseFloat(node.style.top) + dy}px`;
    });
  });
  if (plan.intro) {
    timeline.eventCallback('onComplete', () => {
      plan.introComplete = true; makeReadable(plan.targets.map(({ target }) => target));
      gsap.set(plan.overlay, { autoAlpha: 0 });
      plan.onIntroComplete?.();
      document.dispatchEvent(new CustomEvent('assembly:intro-complete'));
    });
    timeline.restart(true);
  } else {
    plan.trigger = ScrollTrigger.create({ trigger: plan.scene, animation: timeline, start: 'clamp(top 95%)', end: 'clamp(top 20%)', scrub: 0.6, invalidateOnRefresh: true });
  }
}
/** Assemble natural-layout [data-assemble] children; replayKey restarts the composition. */
export function useAssembly(root: RefObject<HTMLElement | null>, enabled: boolean, replayKey: number): void {
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const allTargets = Array.from(element.querySelectorAll<HTMLElement>('[data-assemble]'));
    makeReadable(allTargets);
    if (!enabled) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    let disposed = false;
    let playbackPaused = element.dataset.playback === 'paused';
    let introFinished = false;
    let introProgress = 0;
    const context = gsap.context(() => {
      media.add({ mobile: '(max-width: 767px)', desktop: '(min-width: 768px)', reduce: '(prefers-reduced-motion: reduce)' }, (mediaContext) => {
        if (mediaContext.conditions?.reduce) {
          makeReadable(allTargets);
          return;
        }
        const mobile = Boolean(mediaContext.conditions?.mobile);
        const scenes = Array.from(element.querySelectorAll<HTMLElement>('.assembly-scene'));
        const plans: ScenePlan[] = [];
        scenes.forEach((scene) => {
          // Nested animation targets would compound transforms; the outer target owns them.
          const targets = Array.from(scene.querySelectorAll<HTMLElement>('[data-assemble]')).filter((target) =>
            target.closest('.assembly-scene') === scene && !target.parentElement?.closest('[data-assemble]'),
          );
          if (!targets.length) return;
          const plan = createScene(scene, targets, mobile);
          const savedIntroProgress = introProgress;
          plan.onIntroProgress = progress => { introProgress = progress; };
          plan.onIntroComplete = () => { introFinished = true; };
          measureScene(plan);
          animateScene(plan, mobile);
          if (plan.intro && introFinished) {
            plan.timeline?.pause().progress(1, true);
            plan.introComplete = true;
            makeReadable([...plan.targets.map(({ target }) => target), plan.copyLeaf]);
            gsap.set(plan.overlay, { autoAlpha: 0 });
          } else if (plan.intro) {
            if (savedIntroProgress > 0) plan.timeline?.delay(0).progress(savedIntroProgress, false);
            if (playbackPaused) plan.timeline?.pause();
          }
          plans.push(plan);
        });

        const measure = () => plans.forEach((plan) => {
          if (!plan.introComplete) measureScene(plan);
          // Only scrubbed timelines invalidate on refresh. Reinitializing a live
          // intro can rewind its overlapping reveal/exit tweens after fonts load.
        });
        const pauseIntro = () => { playbackPaused = true; plans.forEach(plan => { if (plan.intro && !plan.introComplete) plan.timeline?.pause(); }); };
        const resumeIntro = () => { playbackPaused = false; plans.forEach(plan => { if (plan.intro && !plan.introComplete) plan.timeline?.resume(); }); };
        document.addEventListener('assembly:playback-pause', pauseIntro);
        document.addEventListener('assembly:playback-resume', resumeIntro);
        ScrollTrigger.addEventListener('refreshInit', measure);
        let focusedPlan: ScenePlan | undefined;
        const releaseFocusedScene = () => {
          const plan = focusedPlan;
          focusedPlan = undefined;
          if (!plan || plan.intro) return;
          gsap.set(plan.overlay, { autoAlpha: 1 });
          plan.trigger?.enable(false, false);
          plan.trigger?.refresh();
        };
        const revealFocusedTarget = (target: EventTarget | null, force = false) => {
          if (!(target instanceof Element)) return;
          const plan = plans.find(({ scene }) => scene === target.closest('.assembly-scene'));
          if (!plan || (focusedPlan === plan && !force)) return;
          if (focusedPlan !== plan) releaseFocusedScene();
          focusedPlan = plan;
          // Keyboard focus can scroll straight to a clipped control. Keep its
          // scene readable for the entire focus visit, then restore normal scrub.
          plan.trigger?.disable(false, false);
          plan.timeline?.pause().progress(1, false);
          makeReadable([...plan.targets.map(({ target: node }) => node), plan.copyLeaf]);
          gsap.set(plan.overlay, { autoAlpha: 0 });
        };
        const restoreFocusedScene = () => revealFocusedTarget(document.activeElement, true);
        const onFocusIn = (event: FocusEvent) => revealFocusedTarget(event.target);
        const onFocusOut = (event: FocusEvent) => {
          if (focusedPlan && event.relatedTarget instanceof Node && focusedPlan.scene.contains(event.relatedTarget)) return;
          releaseFocusedScene();
        };
        element.addEventListener('focusin', onFocusIn);
        element.addEventListener('focusout', onFocusOut);
        ScrollTrigger.addEventListener('refresh', restoreFocusedScene);
        // A breakpoint rebuild preserves DOM focus without firing focusin again.
        revealFocusedTarget(document.activeElement);
        let pendingRefresh: gsap.core.Tween | undefined;
        let active = true;
        const requestRefresh = () => {
          if (!active || disposed) return;
          pendingRefresh?.kill();
          pendingRefresh = gsap.delayedCall(0.12, () => ScrollTrigger.refresh());
        };
        const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(requestRefresh);
        plans.forEach(({ scene, targets }) => {
          resizeObserver?.observe(scene);
          targets.forEach(({ target }) => resizeObserver?.observe(target));
        });
        const refreshFrame = requestAnimationFrame(() => {
          if (!active) return;
          ScrollTrigger.refresh();
          restoreFocusedScene();
        });
        document.fonts?.ready.then(requestRefresh);

        return () => {
          active = false;
          cancelAnimationFrame(refreshFrame);
          pendingRefresh?.kill();
          resizeObserver?.disconnect();
          ScrollTrigger.removeEventListener('refreshInit', measure);
          ScrollTrigger.removeEventListener('refresh', restoreFocusedScene);
          document.removeEventListener('assembly:playback-pause', pauseIntro);
          document.removeEventListener('assembly:playback-resume', resumeIntro);
          element.removeEventListener('focusin', onFocusIn);
          element.removeEventListener('focusout', onFocusOut);
          // GSAP reverts/kills this media context's animations and triggers. The
          // injected DOM is ours to remove, including during React StrictMode.
          plans.forEach(({ constructionCleanup, overlay }) => {
            constructionCleanup?.();
            overlay.remove();
          });
        };
      });
    }, element);

    return () => {
      disposed = true;
      media.revert();
      context.revert();
      makeReadable(allTargets);
    };
  }, [root, enabled, replayKey]);
}

