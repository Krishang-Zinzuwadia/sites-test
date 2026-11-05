type Point = { x: number; y: number }

const responses = [6, 5] as const
const normalization = responses.map(rate => 1 - (1 + rate) * Math.exp(-rate))

/**
 * A straight-line lerp with a gently damped start and finish. Evaluate damping
 * from timeline progress, rather than applying a fixed amount each frame, so
 * scrolling backwards, seeking and different refresh rates share the same path.
 * Both endpoints are exact: a cursor arrives before its click or drawing task.
 */
export function interpolateCursor(from: Point, to: Point, progress: number, helper = false): Point {
  const p = Math.min(1, Math.max(0, progress))
  if (p === 0) return { ...from }
  if (p === 1) return { ...to }
  const index = helper ? 1 : 0
  const elapsed = responses[index] * p
  const amount = (1 - (1 + elapsed) * Math.exp(-elapsed)) / normalization[index]
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  }
}
