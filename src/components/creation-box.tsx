import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { MOTION_PLAYBACK_RATE } from '../motion/motion-tempo'
import './creation-box.css'

type CreationBoxProps = {
  enabled: boolean
  replayKey: number
  onReady: () => void
}

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
    const lid = source.querySelector('.creation-box__lid')
    const glow = source.querySelector('.creation-box__glow')
    const ring = source.querySelector('.creation-box__ring')
    const echo = source.querySelector('.creation-box__echo')
    const aperture = source.querySelector('.creation-box__energy')
    const openLid = { x: -2, y: -23, rotation: -9 }
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
      gsap.set(art, { x: 0, y: 0, scale: 1, rotation: 0 })
      gsap.set(lid, { ...openLid, opacity: 1, transformOrigin: '50% 60%' })
      gsap.set(aperture, { opacity: .35, scale: 1 })
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
      gsap.set(lid, { opacity: 1, x: 0, y: 0, rotation: 0, transformOrigin: '50% 60%' })
      gsap.set(aperture, { opacity: 0 })
      gsap.set(overlayRef.current, { opacity: 1, visibility: 'visible' })
      gsap.set('.creation-loader__progress-fill', { scaleX: 0 })
      gsap.set('.creation-box__label', { opacity: 0 })
      const meter = { value: 0 }
      if (progressRef.current) progressRef.current.textContent = '00'

      opening = gsap.timeline().timeScale(MOTION_PLAYBACK_RATE)
      opening
        .fromTo('.creation-loader__copy', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'power2.out' }, 0)
        .to(meter, {
          value: 100,
          duration: 1.25,
          ease: 'power2.inOut',
          onUpdate: () => {
            const next = String(Math.round(meter.value)).padStart(2, '0')
            if (progressRef.current && progressRef.current.textContent !== next) progressRef.current.textContent = next
          },
        }, 0)
        .to('.creation-loader__progress-fill', { scaleX: 1, duration: 1.25, ease: 'power2.inOut' }, 0)
        .to(art, { y: 2, scaleX: 1.025, scaleY: .965, duration: .23, ease: 'power2.inOut' }, 1.02)
        .to(lid, { ...openLid, duration: .48, ease: 'power3.out' }, 1.25)
        .to(art, { y: 0, scaleX: 1, scaleY: 1, duration: .35, ease: 'power2.out' }, 1.25)
        .fromTo(aperture, { scale: .6, opacity: 0 }, { scale: 1, opacity: .6, duration: .35, ease: 'power2.out' }, 1.25)
        .fromTo(ring, { scale: .7, opacity: .4 }, { scale: 1.9, opacity: 0, duration: .6, ease: 'power2.out' }, 1.27)
        .fromTo(echo, { scale: .7, opacity: .22 }, { scale: 1.65, opacity: 0, duration: .5, ease: 'power2.out' }, 1.38)
        .fromTo(glow, { scale: .8, opacity: .25 }, { scale: 1.35, opacity: 0, duration: .55, ease: 'power2.out' }, 1.27)
        .to(aperture, { opacity: .3, duration: .35 }, 1.63)
        .to('.creation-loader__copy, .creation-loader__footer', { opacity: 0, y: -6, duration: .25 }, 1.48)
        .to(overlayRef.current, { opacity: 0, duration: .4, ease: 'power2.inOut' }, 1.6)
        .to(source, { x: 0, y: 0, scale: 1, duration: .58, ease: 'power3.inOut' }, 1.46)
        .to('.creation-box__label', { opacity: 1, duration: .22 }, 1.82)
        .call(finish, [], 2.05)
    })

    const spawn = () => {
      if (!isReady || !motionAllowed || disposed) return
      const now = performance.now()
      if (now - lastSpawn < 450) return
      lastSpawn = now
      closing?.kill()
      bursts?.kill()
      ctx.add(() => {
        gsap.killTweensOf([art, glow, lid, aperture])
        gsap.to(lid, { ...openLid, opacity: 1, duration: .25 / MOTION_PLAYBACK_RATE, ease: 'power2.out' })
        const label = source.querySelector('.creation-box__label')
        if (label) label.textContent = 'THE IDEA BOX'
        bursts = gsap.timeline().timeScale(MOTION_PLAYBACK_RATE)
          .fromTo(art, { scale: 1 }, { scale: 1.035, duration: .2, yoyo: true, repeat: 1, ease: 'sine.inOut' })
          .fromTo(glow, { scale: .8, opacity: .16 }, { scale: 1.2, opacity: 0, duration: .45, ease: 'sine.out' }, 0)
          .fromTo(aperture, { opacity: .6 }, { opacity: .3, duration: .45, ease: 'sine.out' }, 0)
      })
    }
    const settle = () => {
      if (!isReady || !motionAllowed || disposed) return
      closing?.kill()
      ctx.add(() => {
        closing = gsap.timeline({ delay: 1.1 / MOTION_PLAYBACK_RATE }).timeScale(MOTION_PLAYBACK_RATE)
          .to(lid, { y: 0, x: 0, rotation: 0, duration: .5, ease: 'power2.inOut' })
          .to(aperture, { opacity: 0, duration: .3 }, '<')
          .fromTo(art, { y: 0 }, { y: 1, scaleY: .985, duration: .16, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '-=.06')
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
        <svg className="creation-box__ring" viewBox="0 0 100 100" fill="none"><path d="M50 5L94 27V73L50 95L6 73V27L50 5Z" stroke="currentColor" strokeWidth=".7" /></svg>
        <svg className="creation-box__echo" viewBox="0 0 100 100" fill="none"><path d="M50 5L94 27V73L50 95L6 73V27L50 5Z" stroke="currentColor" strokeWidth=".6" /></svg>
        <div className="creation-box__art">
          <svg viewBox="0 -8 128 140" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="64" cy="121" rx="47" ry="6" fill="#000" opacity=".22" />
            <path d="M12 46L64 20L116 46L64 72L12 46Z" fill="#72816A" stroke="#87957B" strokeWidth="1" strokeLinejoin="round" />
            <path d="M20 46L64 24L108 46L64 68L20 46Z" fill="#253022" />
            <path className="creation-box__energy" d="M28 46L64 28L100 46L64 64L28 46Z" fill="#B8D4A0" />
            <path d="M12 46L64 72V116L12 90V46Z" fill="#DCDCCB" stroke="#B4B9A3" strokeWidth="1" strokeLinejoin="round" />
            <path d="M64 72L116 46V90L64 116V72Z" fill="#9DAF8C" stroke="#7F9271" strokeWidth="1" strokeLinejoin="round" />
            <path d="M64 74V113" stroke="#E4E7CE" strokeOpacity=".3" />
            <path d="M32 71L45 77.5V86L32 79.5V71Z" fill="#ED8A6A" />
            <path d="M83 77L98 69.5V74L83 81.5V77Z" fill="#647A55" />
            <g className="creation-box__lid">
              <path d="M12 39L64 13L116 39V47L64 73L12 47V39Z" fill="#A8B999" stroke="#7B8D6F" strokeWidth="1" strokeLinejoin="round" />
              <path d="M12 39L64 65V73L12 47V39Z" fill="#C2CEAF" />
              <path d="M12 39L64 13L116 39L64 65L12 39Z" fill="#E7E6D7" stroke="#C8CDB8" strokeWidth="1" strokeLinejoin="round" />
              <path d="M18 39L64 16L110 39" stroke="#F4F2E6" strokeOpacity=".8" strokeLinecap="round" />
              <path d="M55 37L64 32.5L73 37L64 41.5L55 37Z" fill="#A4BD91" />
            </g>
          </svg>
        </div>
        <span className="creation-box__label">THE IDEA BOX</span>
      </div>
    </div>
  )
}
