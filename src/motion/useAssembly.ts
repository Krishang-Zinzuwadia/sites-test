import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { collaborators, createCursor, createToolPanel } from './DesignTools';
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
  copyBox: Box; copy: string; fontFamily: string; mobile: boolean;
  timeline?: gsap.core.Timeline; trigger?: ScrollTrigger; intro: boolean; introComplete?: boolean;
};

const motionProperties = ['transform', 'translate', 'rotate', 'scale', 'opacity', 'visibility', 'clip-path', 'will-change', 'filter'];
function makeReadable(targets: HTMLElement[]) {
  for (const target of targets) for (const property of motionProperties) target.style.removeProperty(property);
}
function startingMotion(kind: AssemblyKind, index: number, mobile: boolean): Motion {
  const d = mobile ? 0.42 : 1;
  if (kind === 'text' || kind === 'line') return { x: 0, y: 10 * d, rotation: 0, scale: 1, opacity: 0 };
  return { x: (index % 2 ? 88 : -84) * d, y: (kind === 'art' ? 46 : 64) * d, rotation: (index % 2 ? 4 : -4) * d, scale: kind === 'art' ? 0.91 : 0.97, opacity: 0 };
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
    if (action) action.textContent = ({ layout: 'Drawing frames', type: 'Choosing a typeface', copy: 'Writing the story', color: 'Choosing a palette', spacing: 'Aligning · 16px gap', components: 'Placing components' } as Record<string, string>)[actor.role];
    return cursor;
  });
  const panels = Object.fromEntries((['layout', 'text', 'font', 'color', 'spacing'] as ToolKind[]).map(kind => [kind, createToolPanel(kind)])) as Record<ToolKind, HTMLDivElement>;
  overlay.append(sectionOutline, guides, ghost, ...Object.values(panels), ...cursors);
  return { scene, overlay, targets: targetPlans, cursors, panels, ghost, typingContent, caret, copyLeaf, copyTarget, copyWholeTarget: copyTarget.kind === 'text' || copyLeaf === copyTarget.target, fontTarget, guides, dimension, sectionOutline, copyBox: { x: 0, y: 0, width: 0, height: 0 }, copy: (copyLeaf.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 180), fontFamily: '', mobile, intro: scene.hasAttribute('data-intro') };
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
  const alignBox = plan.targets.find(({ kind }) => kind === 'card' || kind === 'art')?.box ?? plan.targets[plan.targets.length - 1].box;
  positionBox(plan.guides, { x: alignBox.x - 10, y: alignBox.y - 10, width: alignBox.width + 20, height: alignBox.height + 20 });
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
function point(target: TargetPlan, x = 0.5, y = 0.5): Point { return { x: target.box.x + target.box.width * x, y: target.box.y + target.box.height * y }; }
function optionPoint(plan: ScenePlan, kind: ToolKind, choice: string): Point {
  const panel = plan.panels[kind], option = panel.querySelector<HTMLElement>(`[data-choice="${choice}"]`);
  const scene = plan.scene.getBoundingClientRect(), rect = (option ?? panel).getBoundingClientRect();
  return { x: rect.left - scene.left + rect.width * 0.55, y: rect.top - scene.top + rect.height * 0.55 };
}
function animateScene(plan: ScenePlan, mobile: boolean) {
  const timeline = gsap.timeline({ paused: true }); plan.timeline = timeline;
  const [mia, noah, leo, ava, eli, you] = plan.cursors;
  const first = plan.targets[0], component = plan.targets.find(({ kind }) => kind === 'art' || kind === 'card') ?? first;
  const alignTarget = plan.targets.find(({ kind }) => kind === 'card') ?? component;
  const approach = (cursor: HTMLElement, getPoint: () => Point, start: number, fromRight = false) => {
    timeline.fromTo(cursor, { autoAlpha: 0, x: () => getPoint().x + (fromRight ? 42 : -42), y: () => getPoint().y - 24 }, { autoAlpha: 1, x: () => getPoint().x, y: () => getPoint().y, duration: 0.23, ease: 'power2.out' }, start);
  };
  const move = (cursor: HTMLElement, getPoint: () => Point, start: number, duration = 0.28) => timeline.to(cursor, { x: () => getPoint().x, y: () => getPoint().y, duration, ease: 'power2.inOut' }, start);
  const depart = (cursor: HTMLElement, getPoint: () => Point, start: number) => timeline.to(cursor, { autoAlpha: 0, x: () => getPoint().x + 34, y: () => getPoint().y - 30, duration: 0.24, ease: 'power2.in' }, start);
  const panel = (kind: ToolKind, start: number, end: number) => {
    timeline.fromTo(plan.panels[kind], { autoAlpha: 0, y: 8, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out' }, start);
    timeline.to(plan.panels[kind], { autoAlpha: 0, y: -5, duration: 0.17 }, end);
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

  // Mia establishes actual empty frame bounds before anybody places content.
  approach(mia, () => point(first, 0, 0), 0.04);
  timeline.fromTo(plan.sectionOutline, { autoAlpha: 0, clipPath: 'inset(0 100% 100% 0)' }, { autoAlpha: 1, clipPath: 'inset(0 0% 0% 0)', duration: 0.8 }, 0.22);
  plan.targets.forEach((target, index) => {
    const at = 0.24 + index * Math.min(0.1, 0.5 / plan.targets.length);
    timeline.fromTo(target.wireframe, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.04 }, at);
    timeline.fromTo(target.stroke, { strokeDashoffset: 1 }, { strokeDashoffset: 0, autoRound: false, duration: 0.75, ease: 'none' }, at);
  });
  move(mia, () => point(first, 1, 0), 0.27, 0.24); move(mia, () => point(first, 1, 1), 0.51, 0.24);
  move(mia, () => point(first, 0, 1), 0.75, 0.24);
  panel('layout', 0.82, mobile ? 1.45 : 3.3); move(mia, () => optionPoint(plan, 'layout', 'frame'), 1.03); choose('layout', 'frame', 1.29);
  move(mia, () => point(plan.targets[plan.targets.length - 1], 0, 1), 1.55, mobile ? 0.3 : 1.4);
  depart(mia, () => point(plan.targets[plan.targets.length - 1], 0, 1), mobile ? 1.94 : 3.65);

  // Noah makes a text box, then chooses a real typeface in the properties panel.
  const fontChoice = /plex|mono/i.test(plan.fontFamily) ? 'plex' : /dm sans/i.test(plan.fontFamily) ? 'dm-sans' : 'manrope';
  approach(noah, () => point(plan.fontTarget, 0.08, 0.05), mobile ? 0.62 : 0.48, true);
  panel('text', 0.78, 1.37); move(noah, () => optionPoint(plan, 'text', 'text'), 0.94); choose('text', 'text', 1.17);
  panel('font', 1.42, mobile ? 2.32 : 3.7); move(noah, () => optionPoint(plan, 'font', 'plex'), 1.6); choose('font', 'plex', 1.88);
  move(noah, () => optionPoint(plan, 'font', fontChoice), 2.02); choose('font', fontChoice, 2.27);
  depart(noah, () => optionPoint(plan, 'font', fontChoice), mobile ? 2.52 : 3.88);

  // Leo types into an isolated decorative ghost. React's semantic text is untouched.
  const copyStart = mobile ? 1.94 : 1.57, copyEnd = 3.94;
  approach(leo, () => ({ x: plan.copyBox.x + 3, y: plan.copyBox.y + 8 }), copyStart - 0.26);
  timeline.fromTo(plan.ghost, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, copyStart);
  timeline.fromTo(plan.caret, { opacity: 0.35 }, { opacity: 1, duration: 0.17, repeat: 9, yoyo: true, ease: 'steps(1)' }, copyStart);
  timeline.set(plan.ghost, { fontFamily: 'IBM Plex Mono, monospace' }, 1.85);
  timeline.set(plan.ghost, { fontFamily: () => plan.fontFamily }, 2.3);
  const typing = { count: 0 };
  const setCopyX = gsap.quickSetter(leo, 'x', 'px'), setCopyY = gsap.quickSetter(leo, 'y', 'px');
  timeline.fromTo(typing, { count: 0 }, { count: plan.copy.length, duration: copyEnd - copyStart, ease: `steps(${Math.max(1, plan.copy.length)})`, onUpdate: () => {
    plan.typingContent.textContent = plan.copy.slice(0, Math.round(typing.count));
    const caret = plan.caret.getBoundingClientRect(), scene = plan.scene.getBoundingClientRect();
    setCopyX(Math.min(plan.scene.clientWidth - 56, caret.left - scene.left + 7)); setCopyY(caret.top - scene.top + 10);
  } }, copyStart);
  timeline.to(plan.ghost, { autoAlpha: 0, duration: 0.18 }, copyEnd + 0.12);
  if (!plan.copyWholeTarget) {
    // A card's artwork and shell can be placed while its copy is still being
    // written. Only conceal the corresponding leaf, never the entire card.
    timeline.fromTo(plan.copyLeaf, { opacity: 0 }, { opacity: 1, duration: 0.18 }, copyEnd + 0.02);
  }
  depart(leo, () => ({ x: Math.min(plan.scene.clientWidth - 75, plan.copyBox.x + plan.copyBox.width), y: plan.copyBox.y + plan.copyBox.height }), 4.25);

  // You place the actual components into Mia's finished frames.
  const componentStart = mobile ? 2.12 : 1.65;
  approach(you, () => ({ x: point(component, 0.65, 0.22).x + component.motion.x, y: point(component, 0.65, 0.22).y + component.motion.y }), componentStart - 0.25, true);
  plan.targets.forEach((target, index) => {
    const isCopy = target === plan.copyTarget && plan.copyWholeTarget;
    const reveal = target.kind === 'text' || target.kind === 'line';
    const at = isCopy ? copyEnd : componentStart + index * Math.min(0.16, 0.65 / plan.targets.length);
    const duration = isCopy ? 0.22 : reveal ? 0.8 : 1.13;
    gsap.set(target.target, { transformOrigin: '50% 50%', willChange: 'transform, opacity' });
    timeline.fromTo(target.target, { ...target.motion, ...(reveal ? { clipPath: 'inset(0 100% 0 0)' } : {}) }, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, ...(reveal ? { clipPath: 'inset(0 0% 0 0)' } : {}), duration, ease: reveal ? 'steps(16)' : 'power2.inOut' }, at);
    timeline.fromTo(target.shell, { x: target.motion.x, y: target.motion.y, rotation: target.motion.rotation, scale: target.motion.scale }, { x: 0, y: 0, rotation: 0, scale: 1, duration, ease: 'power2.inOut' }, at);
    timeline.fromTo(target.frame, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, at);
    timeline.to(target.frame, { autoAlpha: 0, duration: 0.16 }, at + duration + 0.14);
    timeline.to(target.wireframe, { autoAlpha: 0, duration: 0.2 }, at + duration - 0.05);
  });
  move(you, () => point(component, 0.65, 0.22), componentStart, 1.13);
  move(you, () => point(alignTarget, 0.85, 0.7), 3.0, 0.65);
  depart(you, () => point(alignTarget, 0.85, 0.7), mobile ? 4.1 : 4.65);

  // Ava tries a palette and applies it to a real accent, preserving its final color.
  const colorStart = mobile ? 3.27 : 2.28;
  const accent = plan.scene.querySelector<HTMLElement>('[data-color-target], .coral, .name-period, .ps-section-number') ?? textLeaf(plan.fontTarget.target);
  const finalColor = getComputedStyle(accent).color;
  const rgb = (finalColor.match(/[\d.]+/g) ?? ['168', '201', '154']).slice(0, 3).map(Number);
  const palette = [{ choice: 'sage', rgb: [168, 201, 154] }, { choice: 'coral', rgb: [241, 135, 102] }, { choice: 'cream', rgb: [237, 236, 229] }, { choice: 'lavender', rgb: [183, 160, 236] }];
  const colorChoice = palette.reduce((best, swatch) => swatch.rgb.reduce((sum, value, i) => sum + (value - rgb[i]) ** 2, 0) < best.rgb.reduce((sum, value, i) => sum + (value - rgb[i]) ** 2, 0) ? swatch : best).choice;
  approach(ava, () => point(component, 0.88, 0.12), colorStart - 0.22, true);
  panel('color', colorStart, mobile ? 4.3 : 4.45);
  move(ava, () => optionPoint(plan, 'color', 'lavender'), colorStart + 0.2); choose('color', 'lavender', colorStart + 0.46);
  move(ava, () => optionPoint(plan, 'color', colorChoice), colorStart + 0.64); choose('color', colorChoice, colorStart + 0.91);
  timeline.fromTo(accent, { color: '#b7a0ec' }, { color: finalColor, duration: 0.55 }, colorStart + 0.55);
  timeline.fromTo(component.target, { filter: 'hue-rotate(22deg) saturate(.7)' }, { filter: 'hue-rotate(0deg) saturate(1)', duration: 0.65, immediateRender: false }, colorStart + 0.5);
  depart(ava, () => optionPoint(plan, 'color', colorChoice), mobile ? 4.47 : 4.7);

  // Eli finishes with visible alignment axes, a measured gap, and a small snap.
  const alignStart = mobile ? 4.27 : 3.12;
  approach(eli, () => point(alignTarget, 0, 0.5), alignStart - 0.24);
  panel('spacing', alignStart, 5.22);
  timeline.fromTo(plan.guides, { autoAlpha: 0, scaleX: 0.4 }, { autoAlpha: 1, scaleX: 1, duration: 0.25 }, alignStart);
  move(eli, () => optionPoint(plan, 'spacing', 'left'), alignStart + 0.2); choose('spacing', 'left', alignStart + 0.46);
  move(eli, () => optionPoint(plan, 'spacing', 'gap16'), alignStart + 0.59); choose('spacing', 'gap16', alignStart + 0.86);
  timeline.fromTo([alignTarget.target, alignTarget.shell], { x: mobile ? 5 : 10 }, { x: 0, duration: 0.35, ease: 'power2.out', immediateRender: false }, Math.max(4.28, alignStart + 0.58));
  move(eli, () => point(alignTarget, 0, 1), 4.92, 0.28);
  timeline.to(plan.guides, { autoAlpha: 0, duration: 0.2 }, 5.35);
  timeline.to(plan.sectionOutline, { autoAlpha: 0, duration: 0.2 }, 5.35);
  depart(eli, () => point(alignTarget, 0, 1), 5.48);
  timeline.to({}, { duration: 0.15 }, 5.72);
  timeline.duration(plan.intro ? 5.2 : 6);
  if (mobile) timeline.eventCallback('onUpdate', () => {
    // Keep action pills on the canvas side of the pointer on a narrow viewport.
    plan.cursors.forEach(cursor => { cursor.dataset.edge = Number(gsap.getProperty(cursor, 'x')) > plan.scene.clientWidth - 145 ? 'right' : 'left'; });
  });
  if (plan.intro) {
    timeline.eventCallback('onComplete', () => {
      plan.introComplete = true; makeReadable(plan.targets.map(({ target }) => target));
      gsap.set(plan.overlay, { autoAlpha: 0 });
    });
    timeline.play(0);
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
          measureScene(plan);
          animateScene(plan, mobile);
          plans.push(plan);
        });

        const measure = () => plans.forEach((plan) => {
          if (!plan.introComplete) measureScene(plan);
          // Only scrubbed timelines invalidate on refresh. Reinitializing a live
          // intro can rewind its overlapping reveal/exit tweens after fonts load.
        });
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
          element.removeEventListener('focusin', onFocusIn);
          element.removeEventListener('focusout', onFocusOut);
          // GSAP reverts/kills this media context's animations and triggers. The
          // injected DOM is ours to remove, including during React StrictMode.
          plans.forEach(({ overlay }) => overlay.remove());
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

