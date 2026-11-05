import gsap from 'gsap';

type Point = { x: number; y: number };
type Viewport = { width: number; height: number; scrollX: number; scrollY: number };

let tickerFrame = -1;
let rectangles = new WeakMap<Element, DOMRect>();
let sourcePoints = new WeakMap<HTMLElement, Point>();
let sourceElement: HTMLElement | null | undefined;
let sourceLookupFrame = -1;
let viewport: Viewport | undefined;
let scrollLimit: number | undefined;
let subscribers = 0;

function beginFrame() {
  if (tickerFrame === gsap.ticker.frame) return;
  tickerFrame = gsap.ticker.frame;
  rectangles = new WeakMap();
  sourcePoints = new WeakMap();
  viewport = undefined;
  scrollLimit = undefined;
}

/** Call after geometry-changing writes; natural-layout measurements stay uncached. */
export function invalidateMotionFrame(element?: Element): void {
  if (element) {
    rectangles.delete(element);
    sourcePoints = new WeakMap();
    return;
  }
  tickerFrame = -1;
  rectangles = new WeakMap();
  sourcePoints = new WeakMap();
  viewport = undefined;
  scrollLimit = undefined;
  sourceLookupFrame = -1;
  if (sourceElement && !sourceElement.isConnected) sourceElement = undefined;
}

/** A live element is read at most once per GSAP frame unless explicitly invalidated. */
export function getMotionRect(element: Element, fresh = false): DOMRect {
  beginFrame();
  const cached = fresh ? undefined : rectangles.get(element);
  if (cached) return cached;
  if (fresh) {
    sourcePoints.delete(element as HTMLElement);
    if (element === sourceElement) sourcePoints = new WeakMap();
  }
  const rect = element.getBoundingClientRect();
  rectangles.set(element, rect);
  return rect;
}

export function getMotionViewport(): Viewport {
  beginFrame();
  return viewport ??= { width: innerWidth, height: innerHeight, scrollX, scrollY };
}

/** The scroll height is only needed for a future scene's predicted emission. */
export function getMotionScrollLimit(): number {
  beginFrame();
  return scrollLimit ??= Math.max(0, document.documentElement.scrollHeight - getMotionViewport().height);
}

export function getCreationSourcePoint(scene: HTMLElement): Point {
  beginFrame();
  const cached = sourcePoints.get(scene);
  if (cached) return cached;
  if (sourceElement === undefined || (sourceElement && !sourceElement.isConnected) || (sourceElement === null && sourceLookupFrame !== tickerFrame)) {
    sourceElement = document.querySelector<HTMLElement>('[data-creation-source]');
    sourceLookupFrame = tickerFrame;
  }
  const source = sourceElement ? getMotionRect(sourceElement) : undefined;
  const host = getMotionRect(scene), view = getMotionViewport();
  const point = {
    x: (source ? source.left + source.width / 2 : view.width < 768 ? 40 : 58) - host.left - scene.clientLeft + scene.scrollLeft,
    y: (source ? source.top + source.height / 2 : view.height - (view.width < 768 ? 106 : 130)) - host.top - scene.clientTop + scene.scrollTop,
  };
  sourcePoints.set(scene, point);
  return point;
}

const invalidateViewport = () => invalidateMotionFrame();

/** Scroll also invalidates while GSAP sleeps; listeners exist only with an owner. */
export function retainMotionFrame(): () => void {
  if (subscribers++ === 0) {
    window.addEventListener('scroll', invalidateViewport, { passive: true });
    window.addEventListener('resize', invalidateViewport, { passive: true });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--subscribers === 0) {
      window.removeEventListener('scroll', invalidateViewport);
      window.removeEventListener('resize', invalidateViewport);
      sourceElement = undefined;
      sourceLookupFrame = -1;
      invalidateMotionFrame();
    }
  };
}
