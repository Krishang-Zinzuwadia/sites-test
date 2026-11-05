import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, Code2, Mail, MousePointer2, Pause, Play, RotateCcw, Sparkles } from 'lucide-react'
import { AvatarArt, HeroArt, StickerArt } from './components/illustrations'
import PortfolioSections from './components/portfolio-sections'
import { useAssembly } from './motion/use-assembly'
import CreationBox from './components/creation-box'
import { useAutoTour } from './motion/use-auto-tour'
import { useBoxArrival } from './motion/use-box-arrival'

const MemoPortfolioSections = memo(PortfolioSections)

function ScrollReadout() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let tick = 0
    const update = () => {
      if (tick) return
      tick = requestAnimationFrame(() => {
        const range = document.documentElement.scrollHeight - window.innerHeight
        setProgress(range > 0 ? Math.round(window.scrollY / range * 100) : 0)
        tick = 0
      })
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      cancelAnimationFrame(tick)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return <span className="scroll-progress" aria-label={`${progress}% scrolled`}>{String(progress).padStart(2, '0')}<span>%</span></span>
}

function App() {
  const root = useRef<HTMLDivElement>(null)
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [replayKey, setReplayKey] = useState(0)
  const [ready, setReady] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [active, setActive] = useState('about')
  const [time, setTime] = useState(() => new Date())
  const onReady = useCallback(() => setReady(true), [])
  useAssembly(root, motion && ready, replayKey)
  useBoxArrival(root, motion && ready, replayKey)
  const tour = useAutoTour(motion && ready, replayKey)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onPreference = () => {
      setReducedMotion(media.matches)
      if (media.matches) { setMotion(false); setReady(true); return }
      window.scrollTo({ top: 0, behavior: 'instant' })
      setReady(false)
      setReplayKey(key => key + 1)
      setMotion(true)
    }
    media.addEventListener('change', onPreference)
    const interval = window.setInterval(() => setTime(new Date()), 60_000)
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
    }, { rootMargin: '-12% 0px -65% 0px', threshold: 0 })
    root.current?.querySelectorAll('section[id]').forEach(section => observer.observe(section))
    return () => {
      media.removeEventListener('change', onPreference)
      window.clearInterval(interval)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!motion || ready) return
    window.scrollTo({ top: 0, behavior: 'instant' })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [motion, ready])

  function replay() {
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (reducedMotion) { setMotion(false); return }
    setReady(false)
    setMotion(true)
    setReplayKey(key => key + 1)
  }

  function toggleMotion() {
    if (motion) { setMotion(false); return }
    window.scrollTo({ top: 0, behavior: 'instant' })
    setReady(false)
    setReplayKey(key => key + 1)
    setMotion(true)
  }

  return (
    <div ref={root} className="site-root" data-motion={motion ? 'on' : 'off'} data-playback={tour.status === 'paused' ? 'paused' : 'playing'} data-stage={ready || !motion ? 'unpacked' : 'loading'}>
      <CreationBox enabled={motion} replayKey={replayKey} onReady={onReady} />
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-nav" data-box-arrival>
        <span className="wordmark"><span className="brand-symbol">a<span>m</span></span><span className="wordmark-divider" />portfolio<span className="edition">/ 2026</span></span>
        <nav aria-label="Portfolio chapters">
          {[['about', 'About'], ['work', 'Work'], ['contact', 'Contact']].map(([id, label]) => <span key={id} className={active === id ? 'active' : ''} aria-current={active === id ? 'location' : undefined}>{label}</span>)}
        </nav>
        <span className="nav-contact" aria-hidden="true"><ArrowUpRight size={17} /></span>
      </header>

      <main id="main" className="portfolio-shell">
        <div className="canvas-meta" id="top" data-box-arrival><span><span className="status-dot" /> OPEN TO GOOD CONVERSATIONS</span><span className="meta-right">A PERSONAL SPACE, IN PROGRESS</span></div>
        <section className="hero assembly-scene" data-intro data-scene-name="Profile" aria-labelledby="profile-name">
          <div className="hero-banner" data-assemble="art">
            <HeroArt />
            <div className="banner-caption"><span>A LITTLE WORLD OF MY OWN</span><span>EST. 2000 ↗</span></div>
          </div>
          <div className="identity-row" data-assemble="card">
            <div className="profile-avatar" data-construction-atom><AvatarArt /></div>
            <div className="profile-title"><div className="profile-eyebrow">DESIGNER <span>×</span> DEVELOPER</div><h1 id="profile-name">Alex Morgan<span className="name-period">.</span></h1><p>Thoughtful interfaces. A little unexpected.</p></div>
            <div className="profile-location"><span className="location-orbit">◎</span><span>BASED ON EARTH<br /><span className="local-clock">{new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(time)} LOCAL TIME</span></span></div>
          </div>
          <div className="hero-footnote" data-assemble="text"><span className="tiny-cross">✳</span><span>Good work is never made alone.<br /><span className="muted">Sit back. Watch a little world come together.</span></span><ArrowDown className="scroll-arrow" size={18} /></div>
        </section>

        <section className="about-section assembly-scene" id="about" data-scene-name="About" aria-labelledby="about-heading">
          <div className="section-label" data-assemble="line"><span className="section-index">01 / A LITTLE INTRODUCTION</span><span className="section-cross">+</span></div>
          <div className="about-grid">
            <h2 id="about-heading" data-assemble="text">A curious mind.<br />A maker at heart<span className="coral">.</span></h2>
            <div className="about-copy" data-assemble="text"><p>I’m Alex, a designer who codes and a developer who cares about how things feel.</p><p>I turn messy ideas into considered digital experiences. Somewhere between a sketch and a shipped product is my favorite place to be.</p><div className="currently"><span className="status-dot" /><span>Currently exploring creative development<br /><span className="muted">and the small details that make the difference.</span></span></div></div>
          </div>
          <div className="contact-strip" data-assemble="line"><span className="contact-display"><Mail size={14} /> hello@example.com</span><span className="craft-note">DESIGN · CODE · PLAY</span><span className="demo-label">CONCEPT PORTFOLIO · DEMO CONTENT</span></div>
        </section>
        <MemoPortfolioSections />
      </main>

      <aside className="margin-note" aria-hidden="true" data-box-arrival><div className="margin-line" /><span>ONE BOX. MANY HANDS.<br />A LITTLE WORLD, UNPACKED.</span><MousePointer2 className="margin-cursor" size={21} /><span className="margin-signature">a little bit of play ↘</span></aside>
      <div className="floating-sticker sticker-flower" aria-hidden="true" data-box-arrival><StickerArt kind="flower" /></div>
      <div className="floating-sticker sticker-cube" aria-hidden="true" data-box-arrival><StickerArt kind="cube" /></div>

      <div className="assembly-dock" role="region" aria-label="Animation controls" data-construction-exempt>
        <div className="collaborator-stack" aria-hidden="true"><span>M</span><span>N</span><span>L</span><span>A</span><span>E</span><span>Y</span><span className="team-count">+</span></div>
        <span className="dock-status"><span className={`status-dot ${motion && tour.playing ? '' : 'paused'}`} /><span>{!motion ? reducedMotion ? 'Reduced motion' : 'Motion off' : tour.status === 'complete' ? 'A world, unpacked' : tour.status === 'paused' ? 'Tour paused' : 'One crew, one box'}</span></span>
        <span className="dock-divider" />
        <button className="dock-button" onClick={replay} aria-label="Replay assembly from the beginning" title="Replay assembly"><RotateCcw size={14} /></button>
        <button className="dock-button" disabled={!motion || reducedMotion || tour.status === 'complete'} onClick={tour.toggle} aria-pressed={tour.playing} aria-label={tour.playing ? 'Pause automatic tour' : 'Resume automatic tour'} title={tour.status === 'complete' ? 'Tour complete — replay to start again' : tour.playing ? 'Pause automatic tour' : 'Resume automatic tour'}>{tour.playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button className="dock-button motion-switch" disabled={reducedMotion} onClick={toggleMotion} aria-pressed={motion} aria-label={motion ? 'Turn off animations' : 'Turn on animations'} title={reducedMotion ? 'Disabled by your reduced-motion preference' : motion ? 'Turn off animations' : 'Turn on animations'}><Sparkles size={13} /></button>
        <span className="dock-divider" /><ScrollReadout />
      </div>
      <div className="made-with" data-box-arrival><Code2 size={12} /> Crafted with curiosity</div>
    </div>
  )
}
export default App
