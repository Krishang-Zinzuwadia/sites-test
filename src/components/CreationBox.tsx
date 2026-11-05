import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import './creation-box.css'

type CreationBoxProps = {
  enabled: boolean
  replayKey: number
  onReady: () => void
}

const shardColors = ['#a8c99a', '#f18766', '#e8e5d5', '#b9add2', '#d5bd7d', '#8eb8b0']

/** The same physical box is both the opening title and every scene's origin. */
export default function CreationBox({ enabled, replayKey, onReady }: CreationBoxProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)
  const readyRef = useRef(onReady)
  const [loading, setLoading] = useState(enabled)
  readyRef.current = onReady

  useLayoutEffect(() => {
    const root = rootRef.current
    const source = sourceRef.current
    if (!root || !source) return

    let disposed = false
    let isReady = false
    const motionAllowed = enabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let opening: gsap.core.Timeline | undefined
    let bursts: gsap.core.Timeline | undefined
    let closing: gsap.core.Timeline | undefined
    let resizeFrame = 0
    let lastSpawn = -Infinity
    const ctx = gsap.context(() => {}, root)
    const art = source.querySelector('.creation-box__art')
    const flaps = source.querySelectorAll('.creation-box__flap')
    const lid = source.querySelector('.creation-box__lid')
    const sparks = source.querySelectorAll('.creation-box__shard')
    const glow = source.querySelector('.creation-box__glow')
    const ring = source.querySelector('.creation-box__ring')
    const echo = source.querySelector('.creation-box__echo')
    const fragments = source.querySelectorAll('.creation-box__fragment')
    const finish = () => {
      if (disposed || isReady) return
      isReady = true
      source.dataset.ready = 'true'
      setLoading(false)
      readyRef.current()
    }

    source.dataset.ready = 'false'
    const label = source.querySelector('.creation-box__label')
    if (label) label.textContent = 'THE IDEA BOX'
    setLoading(motionAllowed)

    ctx.add(() => {
      gsap.set(source, { x: 0, y: 0, scale: 1, opacity: 1 })
      gsap.set(flaps, { scale: 1, rotation: 0, opacity: 1 })
      gsap.set(lid, { opacity: 0 })
      gsap.set(sparks, { x: 0, y: 0, opacity: 0, scale: 0 })
      gsap.set(fragments, { x: 0, y: 0, opacity: 0, scale: .1 })
      gsap.set([glow, ring, echo], { opacity: 0 })

      if (!motionAllowed) {
        finish()
        return
      }

      const rect = source.getBoundingClientRect()
      const introScale = window.innerWidth < 641 ? 3.4 : 2.65
      const introX = window.innerWidth / 2 - (rect.left + rect.width / 2)
      const introY = window.innerHeight * 0.48 - (rect.top + rect.height / 2)
      gsap.set(source, { x: introX, y: introY, scale: introScale })
      gsap.set(flaps, { scale: 0.12, opacity: 0, transformOrigin: '50% 100%' })
      gsap.set(lid, { opacity: 1, x: 0, y: 0, rotation: 0, transformOrigin: '50% 60%' })
      gsap.set(overlayRef.current, { opacity: 1, visibility: 'visible' })
      gsap.set('.creation-loader__progress-fill', { scaleX: 0 })
      gsap.set('.creation-box__label', { opacity: 0 })
      const meter = { value: 0 }
      if (progressRef.current) progressRef.current.textContent = '00'

      opening = gsap.timeline()
      opening
        .fromTo('.creation-loader__copy', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: 'power2.out' }, 0)
        .to(meter, {
          value: 100,
          duration: 1.6,
          ease: 'power2.inOut',
          onUpdate: () => {
            if (progressRef.current) progressRef.current.textContent = String(Math.round(meter.value)).padStart(2, '0')
          },
        }, 0)
        .to('.creation-loader__progress-fill', { scaleX: 1, duration: 1.6, ease: 'power2.inOut' }, 0)
        .fromTo('.creation-box__energy', { opacity: 0, scale: 0.5 }, { opacity: 0.85, scale: 1, duration: 1.35, ease: 'power2.in' }, 0.15)
        .to(art, { y: 2, scaleX: 1.04, scaleY: .94, duration: .25, ease: 'sine.inOut' }, 1.23)
        .to(art, { y: -4, scaleX: .98, scaleY: 1.05, duration: .18, ease: 'power2.out' }, 1.48)
        .to(lid, { x: 7, y: -45, rotation: -24, opacity: 0, duration: .66, ease: 'power3.out' }, 1.51)
        .to(flaps, { scale: 1, opacity: 1, duration: 0.6, stagger: 0.06, ease: 'back.out(1.3)' }, 1.56)
        .fromTo(ring, { scale: .25, opacity: .8, rotationX: 58 }, { scale: 3.8, opacity: 0, duration: 1.05, ease: 'power3.out' }, 1.55)
        .fromTo(echo, { scale: .2, opacity: .55, rotationX: 58 }, { scale: 3, opacity: 0, duration: .95, ease: 'power2.out' }, 1.69)
        .fromTo(glow, { scale: .5, opacity: .75 }, { scale: 2.4, opacity: 0, duration: .9, ease: 'power2.out' }, 1.55)
        .to(fragments, {
          x: (i: number) => Math.cos(-Math.PI + i * Math.PI / (fragments.length - 1)) * (50 + i % 3 * 14),
          y: (i: number) => -34 - Math.sin(i * Math.PI / (fragments.length - 1)) * (55 + i % 2 * 14),
          rotation: (i: number) => (i % 2 ? 1 : -1) * (10 + i * 5),
          scale: 1,
          opacity: .9,
          duration: .58,
          stagger: .018,
          ease: 'power3.out',
        }, 1.56)
        .to(fragments, { y: '-=12', opacity: 0, scale: 1.12, duration: .32, stagger: .018, ease: 'sine.in' }, 2.02)
        .to('.creation-box__energy', { opacity: 0, duration: 0.5 }, 1.7)
        .to(sparks, {
          x: (i: number) => Math.cos((i / sparks.length) * Math.PI * 2) * (42 + (i % 3) * 13),
          y: (i: number) => Math.sin((i / sparks.length) * Math.PI * 2) * 50 - 18,
          rotation: (i: number) => i * 61,
          scale: 1,
          opacity: 1,
          duration: 0.38,
          ease: 'power3.out',
        }, 1.57)
        .to(sparks, { opacity: 0, scale: 0.3, duration: 0.4, ease: 'power2.in' }, 1.9)
        .to('.creation-loader__copy, .creation-loader__footer', { opacity: 0, y: -8, duration: 0.3 }, 1.88)
        .to(overlayRef.current, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 1.98)
        .to(source, { x: 0, y: 0, scale: 1, duration: 0.62, ease: 'power3.inOut' }, 1.82)
        .to(art, { y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: .4, ease: 'sine.inOut' }, 1.9)
        .to('.creation-box__label', { opacity: 1, duration: 0.3 }, 2.22)
        .call(finish, [], 2.46)
    })

    const spawn = () => {
      if (!isReady || !motionAllowed || disposed) return
      const now = performance.now()
      if (now - lastSpawn < 200) return
      lastSpawn = now
      closing?.kill()
      bursts?.kill()
      ctx.add(() => {
        gsap.killTweensOf([art, glow, lid, ...flaps, ...sparks])
        gsap.set(lid, { opacity: 0 })
        gsap.to(flaps, { scale: 1, opacity: 1, duration: .3, ease: 'sine.out' })
        const label = source.querySelector('.creation-box__label')
        if (label) label.textContent = 'THE IDEA BOX'
        bursts = gsap.timeline()
          .fromTo(art, { scale: 1 }, { scale: 1.12, duration: 0.13, yoyo: true, repeat: 1, ease: 'sine.inOut' })
          .fromTo(glow, { scale: 0.6, opacity: 0.32 }, { scale: 1.6, opacity: 0, duration: 0.55, ease: 'power2.out' }, 0)
          .fromTo(sparks, { x: 0, y: -5, scale: 0.4, opacity: 0.8 }, {
            x: (i: number) => Math.cos((i / sparks.length) * Math.PI * 2) * (23 + i % 3 * 7),
            y: (i: number) => -18 - Math.abs(Math.sin((i / sparks.length) * Math.PI * 2)) * (24 + i % 4 * 7),
            rotation: (i: number) => i * 48,
            scale: 0.8,
            duration: 0.48,
            ease: 'power2.out',
          }, 0)
          .to(sparks, { opacity: 0, scale: 0.15, duration: 0.24 }, 0.23)
      })
    }
    const settle = () => {
      if (!isReady || !motionAllowed || disposed) return
      closing?.kill()
      ctx.add(() => {
        closing = gsap.timeline({ delay: 1.1 })
          .to(flaps, { scale: .12, opacity: 0, duration: .5, stagger: .06, ease: 'sine.inOut' })
          .fromTo(lid, { y: -18, x: 2, rotation: -8, opacity: 0 }, { y: 0, x: 0, rotation: 0, opacity: 1, duration: .5, ease: 'power2.out' }, '-=.22')
          .fromTo(art, { y: 0 }, { y: 2, scaleY: .97, duration: .15, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '-=.06')
          .call(() => {
            const label = source.querySelector('.creation-box__label')
            if (label) label.textContent = 'IDEAS, ASSEMBLED'
          })
      })
    }
    const resize = () => {
      // A resize during the title settles the box before consumers read its rect.
      if (isReady) return
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        opening?.progress(1)
      })
    }
    document.addEventListener('assembly:spawn', spawn)
    document.addEventListener('assembly:tour-complete', settle)
    window.addEventListener('resize', resize)
    return () => {
      disposed = true
      cancelAnimationFrame(resizeFrame)
      document.removeEventListener('assembly:spawn', spawn)
      document.removeEventListener('assembly:tour-complete', settle)
      window.removeEventListener('resize', resize)
      opening?.kill()
      bursts?.kill()
      closing?.kill()
      ctx.revert()
    }
  }, [enabled, replayKey])

  return (
    <div className="creation-box-root" ref={rootRef}>
      <div className={`creation-loader${loading ? ' is-active' : ''}`} ref={overlayRef} aria-hidden={!loading}>
        <div className="creation-loader__grain" aria-hidden="true" />
        <div className="creation-loader__corner" aria-hidden="true"><span>K<span className="creation-loader__asterisk">✳</span></span><span>IDEAS, GIVEN FORM.</span></div>
        <div className="creation-loader__copy" role="status" aria-live="polite" aria-atomic="true">
          <p className="creation-loader__eyebrow">A LITTLE IMAGINATION GOES A LONG WAY</p>
          <h2>A world of possibilities<span>.</span></h2>
          <span className="creation-loader__sr">Unpacking the canvas.</span>
        </div>
        <div className="creation-loader__footer" aria-hidden="true">
          <div className="creation-loader__progress-caption"><span>UNPACKING THE CANVAS</span><span><span ref={progressRef}>00</span> <span className="creation-loader__percent">/ 100</span></span></div>
          <div className="creation-loader__progress-track"><div className="creation-loader__progress-fill" /></div>
          <span className="creation-loader__footnote">EVERYTHING STARTS WITH AN IDEA.</span>
        </div>
      </div>
      <div ref={sourceRef} data-creation-source data-ready="false" className={`creation-box${loading ? ' is-loading' : ''}`} aria-hidden="true">
        <div className="creation-box__glow" />
        <div className="creation-box__ring" />
        <div className="creation-box__echo" />
        <div className="creation-box__art">
          <svg viewBox="-12 -14 152 154" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="64" cy="124" rx="49" ry="10" fill="#000" opacity=".2" />
            <path d="M10 57L64 30L118 57L64 84L10 57Z" fill="#343E2D" stroke="#171916" strokeWidth="1.4" />
            <path d="M20 58L64 37L108 58L64 78L20 58Z" fill="#526044" />
            <g className="creation-box__energy">
              <path d="M40 57L64 45L88 57L64 69L40 57Z" fill="#D9E6B2" />
              <path d="M64 55V9M47 58L29 26M81 58L99 26" stroke="#D9E6B2" strokeWidth="2" strokeLinecap="round" opacity=".55" />
            </g>
            <g className="creation-box__flap"><path d="M10 57L64 30L44 3L-10 30L10 57Z" fill="#D8DFBC" stroke="#7C8D65" strokeWidth="1.2" strokeLinejoin="round" /><path d="M10 57L64 30" stroke="#63774E" strokeWidth="1.6" /><path d="M-1 30L42 9" stroke="#F2F0DD" strokeWidth="1.1" opacity=".65" /></g>
            <g className="creation-box__flap"><path d="M64 30L118 57L139 31L85 4L64 30Z" fill="#A8C99A" stroke="#6B815C" strokeWidth="1.2" strokeLinejoin="round" /><path d="M64 30L118 57" stroke="#63774E" strokeWidth="1.6" /><path d="M87 10L130 32" stroke="#D6E2BE" strokeWidth="1.1" opacity=".7" /></g>
            <path d="M10 57L64 84V124L10 97V57Z" fill="#E5E2CE" stroke="#9D9F87" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M64 84L118 57V97L64 124V84Z" fill="#B5C29B" stroke="#7C8D65" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M17 65L56 85M17 70L35 79" stroke="#F8F4E4" strokeWidth="1.3" opacity=".85" />
            <path d="M87 73L100 67V84L87 90V73Z" fill="#F18766" />
            <path d="M89.5 76L97 72.3M89.5 79L95 76.3" stroke="#9E5641" strokeWidth=".9" />
            <path d="M29 87L42 93V105L29 99V87Z" fill="#36452F" />
            <path d="M35.5 91.5V100M32 94L39 97.5M32 98L39 94" stroke="#C2D4A4" strokeWidth="1.1" strokeLinecap="round" />
            <g className="creation-box__lid"><path d="M10 57L64 30L118 57L64 84L10 57Z" fill="#DCDDC4" stroke="#869271" strokeWidth="1.4" strokeLinejoin="round" /><path d="M10 57L64 30L88 42L34 69L10 57Z" fill="#C0D1A9" /><path d="M49 37L104 64L91 70L36 43L49 37Z" fill="#EDE8D2" /><path d="M64 42L81 50L64 59L47 50L64 42Z" fill="#F18766" /><path d="M64 46V55M60 48L68 52M60 52L68 48" stroke="#86513E" strokeWidth="1.2" strokeLinecap="round" /></g>
          </svg>
        </div>
        {Array.from({ length: 24 }, (_, i) => <span key={i} className={`creation-box__shard creation-box__shard--${i % 3}`} style={{ backgroundColor: shardColors[i % shardColors.length] }} />)}
        {Array.from({ length: 7 }, (_, i) => <span key={`fragment-${i}`} className={`creation-box__fragment creation-box__fragment--${i % 3}`} style={{ color: shardColors[i % shardColors.length] }}>{i % 3 === 1 ? 'T' : i % 3 === 2 ? '✳' : ''}</span>)}
        <span className="creation-box__label">THE IDEA BOX</span>
      </div>
    </div>
  )
}
