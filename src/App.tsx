import { memo, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, Check, Code2, Copy, Mail, MousePointer2, Pause, Play, RotateCcw } from 'lucide-react'
import { AvatarArt, HeroArt, StickerArt } from './components/Illustrations'
import PortfolioSections from './components/PortfolioSections'
import { useAssembly } from './motion/useAssembly'

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
  const [copied, setCopied] = useState(false)
  const [active, setActive] = useState('about')
  const [time, setTime] = useState(() => new Date())
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useAssembly(root, motion, replayKey)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onPreference = () => { setReducedMotion(media.matches); setMotion(!media.matches) }
    media.addEventListener('change', onPreference)
    const interval = window.setInterval(() => setTime(new Date()), 60_000)
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
    }, { rootMargin: '-12% 0px -65% 0px', threshold: 0 })
    root.current?.querySelectorAll('section[id]').forEach(section => observer.observe(section))
    return () => {
      media.removeEventListener('change', onPreference)
      window.clearInterval(interval)
      clearTimeout(copyTimeout.current)
      observer.disconnect()
    }
  }, [])

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText('hello@example.com')
      setCopied(true)
      clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopied(false), 2400)
    } catch {
      window.location.href = 'mailto:hello@example.com'
    }
  }

  function replay() {
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (reducedMotion) { setMotion(false); return }
    setMotion(true)
    setReplayKey(key => key + 1)
  }

  return (
    <div ref={root} className="site-root" data-motion={motion ? 'on' : 'off'}>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-nav">
        <a className="wordmark" href="#top" aria-label="Alex Morgan home"><span className="brand-symbol">a<span>m</span></span><span className="wordmark-divider" />portfolio<span className="edition">/ 2026</span></a>
        <nav aria-label="Main navigation">
          {[['about', 'About'], ['work', 'Work'], ['contact', 'Contact']].map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? 'active' : ''} aria-current={active === id ? 'location' : undefined}>{label}</a>)}
        </nav>
        <a className="nav-contact" href="mailto:hello@example.com" aria-label="Say hello by email"><ArrowUpRight size={17} /></a>
      </header>

      <main id="main" className="portfolio-shell">
        <div className="canvas-meta" id="top"><span><span className="status-dot" /> OPEN TO GOOD CONVERSATIONS</span><span className="meta-right">A PERSONAL SPACE, IN PROGRESS</span></div>
        <section className="hero assembly-scene" data-intro data-scene-name="Profile" aria-labelledby="profile-name">
          <div className="hero-banner" data-assemble="art">
            <HeroArt />
            <div className="banner-caption"><span>A LITTLE WORLD OF MY OWN</span><span>EST. 2000 ↗</span></div>
          </div>
          <div className="identity-row" data-assemble="card">
            <div className="profile-avatar"><AvatarArt /></div>
            <div className="profile-title"><div className="profile-eyebrow">DESIGNER <span>×</span> DEVELOPER</div><h1 id="profile-name">Alex Morgan<span className="name-period">.</span></h1><p>Thoughtful interfaces. A little unexpected.</p></div>
            <div className="profile-location"><span className="location-orbit">◎</span><span>BASED ON EARTH<br /><span className="local-clock">{new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(time)} LOCAL TIME</span></span></div>
          </div>
          <div className="hero-footnote" data-assemble="text"><span className="tiny-cross">✳</span><span>Good work is never made alone.<br /><span className="muted">Scroll a little. Watch it come together.</span></span><ArrowDown className="scroll-arrow" size={18} /></div>
        </section>

        <section className="about-section assembly-scene" id="about" data-scene-name="About" aria-labelledby="about-heading">
          <div className="section-label" data-assemble="line"><span className="section-index">01 / A LITTLE INTRODUCTION</span><span className="section-cross">+</span></div>
          <div className="about-grid">
            <h2 id="about-heading" data-assemble="text">A curious mind.<br />A maker at heart<span className="coral">.</span></h2>
            <div className="about-copy" data-assemble="text"><p>I’m Alex, a designer who codes and a developer who cares about how things feel.</p><p>I turn messy ideas into considered digital experiences. Somewhere between a sketch and a shipped product is my favorite place to be.</p><div className="currently"><span className="status-dot" /><span>Currently exploring creative development<br /><span className="muted">and the small details that make the difference.</span></span></div></div>
          </div>
          <div className="contact-strip" data-assemble="line"><a href="mailto:hello@example.com"><Mail size={14} /> Let’s talk <ArrowUpRight size={13} /></a><button onClick={copyEmail} className="copy-email" aria-label="Copy demo email address">{copied ? <Check size={13} /> : <Copy size={13} />}<span aria-live="polite">{copied ? 'Copied!' : 'Copy email'}</span></button><span className="demo-label">CONCEPT PORTFOLIO · DEMO CONTENT</span></div>
        </section>
        <MemoPortfolioSections />
      </main>

      <aside className="margin-note" aria-hidden="true"><div className="margin-line" /><span>LESS SCROLLING PAST.<br />MORE COMING TOGETHER.</span><MousePointer2 className="margin-cursor" size={21} /><span className="margin-signature">a little bit of play ↘</span></aside>
      <div className="floating-sticker sticker-flower" aria-hidden="true"><StickerArt kind="flower" /></div>
      <div className="floating-sticker sticker-cube" aria-hidden="true"><StickerArt kind="cube" /></div>

      <div className="assembly-dock" role="region" aria-label="Animation controls">
        <div className="collaborator-stack" aria-hidden="true"><span>M</span><span>N</span><span>L</span><span>A</span><span>E</span><span>Y</span></div>
        <span className="dock-status"><span className={`status-dot ${motion ? '' : 'paused'}`} /><span>{motion ? '6 minds, one canvas' : reducedMotion ? 'Reduced motion' : 'Motion paused'}</span></span>
        <span className="dock-divider" />
        <button className="dock-button" onClick={replay} aria-label="Replay assembly from the beginning" title="Replay assembly"><RotateCcw size={14} /></button>
        <button className="dock-button" disabled={reducedMotion} onClick={() => setMotion(value => !value)} aria-pressed={!motion} aria-label={motion ? 'Turn off animations' : 'Turn on animations'} title={reducedMotion ? 'Disabled by your reduced-motion preference' : motion ? 'Pause animations' : 'Enable animations'}>{motion ? <Pause size={14} /> : <Play size={14} />}</button>
        <span className="dock-divider" /><ScrollReadout />
      </div>
      <div className="made-with"><Code2 size={12} /> Crafted with curiosity</div>
    </div>
  )
}
export default App
