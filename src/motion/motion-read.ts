import gsap from 'gsap'

type MotionWrite = () => void
type MotionRead = () => void | MotionWrite
type Entry = { version: number; read: MotionRead }

const reads = new Map<object, Entry>()
const versions = new WeakMap<object, number>()
let pendingListener: ReturnType<typeof gsap.ticker.add> | undefined
let scheduled = false
let generation = 0

function report(error: unknown) {
  // A failed reader must not prevent the once-listener from removing itself.
  queueMicrotask(() => { throw error })
}

function flush() {
  pendingListener = undefined
  scheduled = false
  const batch = Array.from(reads)
  reads.clear()
  const writes: Array<{ key: object; version: number; write: MotionWrite }> = []
  for (const [key, entry] of batch) {
    if (versions.get(key) !== entry.version) continue
    try {
      const write = entry.read()
      if (write) writes.push({ key, version: entry.version, write })
    } catch (error) { report(error) }
  }
  for (const { key, version, write } of writes) {
    if (versions.get(key) !== version) continue
    try { write() } catch (error) { report(error) }
  }
}

/**
 * Batch live layout reads after GSAP's animation updates, then apply all writes.
 * Installed GSAP's ticker iterates its live listener-array length; add(..., true)
 * appends a once-listener, so a call from updateRoot flushes this same frame.
 * No persistent listener, requestAnimationFrame, timeout, or extra frame is used.
 */
export function queueMotionRead(key: object, read: MotionRead): void {
  const version = (versions.get(key) ?? 0) + 1
  versions.set(key, version)
  reads.set(key, { version, read })
  if (scheduled) return
  scheduled = true
  const ticket = ++generation
  let invoked = false
  const listener = gsap.ticker.add(() => {
    invoked = true
    if (ticket !== generation) return
    flush()
  }, true)
  // add() may synchronously wake a sleeping ticker and consume the callback.
  if (!invoked && ticket === generation) pendingListener = listener
}

/** Cancel both an unread entry and any already-measured pending write. */
export function cancelMotionRead(key: object): void {
  versions.set(key, (versions.get(key) ?? 0) + 1)
  reads.delete(key)
  if (!reads.size && scheduled) {
    ++generation
    scheduled = false
    if (pendingListener) gsap.ticker.remove(pendingListener)
    pendingListener = undefined
  }
}
