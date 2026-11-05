import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, Check, Circle, X } from 'lucide-react'
import { ProjectArt } from './Illustrations'
import './portfolio-sections.css'

type ProjectKind = 'orbit' | 'forma' | 'field' | 'mono'

type Project = {
  number: string
  name: string
  description: string
  discipline: string
  year: string
  kind: ProjectKind
  technologies: string[]
  summary: string
  problem: string
  approach: string
  outcome: string
  details: string[]
}

const projects: Project[] = [
  {
    number: '01',
    name: 'Orbit',
    description: 'A clearer picture of the everyday.',
    discipline: 'Product design · Development',
    year: '2026',
    kind: 'orbit',
    technologies: ['Next.js', 'TypeScript', 'Supabase'],
    summary: 'An approachable personal finance concept that makes everyday spending easier to understand.',
    problem: 'In this fictional brief, a budgeting app showed plenty of numbers but little useful context. The challenge was to help someone see their spending, upcoming commitments, and savings goals without feeling buried in charts.',
    approach: 'I shaped the interface around a clear monthly overview, a readable transaction list, and gentle visual hierarchy. I designed a responsive component system with explicit chart labels, accessible contrast, and useful empty states.',
    outcome: 'The prototype brings the big picture and small daily details into one calm view. A familiar visual language makes the concept approachable without relying on pressure or gamification.',
    details: ['An understandable monthly overview', 'Clear, labeled spending patterns', 'A responsive component system'],
  },
  {
    number: '02',
    name: 'Forma',
    description: 'Room for your next big idea.',
    discipline: 'Product design · Development',
    year: '2026',
    kind: 'forma',
    technologies: ['Figma', 'React', 'Motion'],
    summary: 'A playful creative workspace for collecting early ideas and seeing where they might lead.',
    problem: 'For this self-initiated concept, I explored how a digital workspace could accommodate creative work before it becomes a tidy project. References, experiments, and half-finished ideas needed room to coexist.',
    approach: 'I designed an adaptable canvas of visual project cards, personal collections, and shared spaces. A soft palette and expressive layouts give every exploration its own character, while familiar navigation keeps the system easy to follow.',
    outcome: 'A cohesive workspace concept that balances structure with room to play. The visual system supports both a personal archive and a small collaborative studio without making everything feel like a task.',
    details: ['Flexible visual project collections', 'A warm, adaptable visual identity', 'Clear personal and shared spaces'],
  },
  {
    number: '03',
    name: 'Field',
    description: 'Less scrolling. More wandering.',
    discipline: 'Web design · Development',
    year: '2025',
    kind: 'field',
    technologies: ['React', 'MDX', 'CSS'],
    summary: 'An independent outdoor journal concept for slow stories, winding trails, and a little perspective.',
    problem: 'Outdoor publishing can feel crowded with lists, ratings, and urgent recommendations. This fictional editorial brief asked for a gentler reading experience that would make people want to step away from the screen.',
    approach: 'I paired a warm editorial identity with spacious typography and a flexible story system. The responsive concept gives places and personal essays equal room, with clear navigation and carefully paced transitions between text and imagery.',
    outcome: 'A journal concept that invites exploration at the reader’s own pace. Reusable layouts support short field notes, longer essays, and visual stories while maintaining one consistent voice.',
    details: ['An expressive editorial identity', 'Flexible, readable story layouts', 'A responsive journal archive'],
  },
  {
    number: '04',
    name: 'Mono',
    description: 'Less noise. More listening.',
    discipline: 'Interaction design · Experiment',
    year: '2025',
    kind: 'mono',
    technologies: ['Web Audio', 'React', 'CSS'],
    summary: 'An ambient listening experiment for the moments when you want to settle into your work.',
    problem: 'Sound tools often become another interface to manage. I set myself a narrower challenge: make a small listening experience that feels complete with only a few meaningful controls.',
    approach: 'I explored tactile dials, subtle state changes, and a monochrome visual system. The interactive prototype uses browser audio primitives and keeps sound explicitly controlled by the listener, with clear play, pause, and volume states.',
    outcome: 'A focused interaction study in making a digital object feel familiar. Every control has a clear job, and visual feedback is quiet enough to stay out of the way.',
    details: ['An intentionally small control set', 'Browser-native audio exploration', 'Tactile, accessible interaction states'],
  },
]

const toolkitItems = [
  { name: 'React', label: 'R', category: 'Development', color: '#9ad4e7' },
  { name: 'Next.js', label: 'N', category: 'Development', color: '#e7e8df' },
  { name: 'TypeScript', label: 'TS', category: 'Development', color: '#83add4' },
  { name: 'Tailwind', label: '≈', category: 'Development', color: '#8ed1c6' },
  { name: 'Node.js', label: 'Nᵈ', category: 'Development', color: '#a8c99a' },
  { name: 'Figma', label: 'F', category: 'Design', color: '#edb5a1' },
  { name: 'Framer', label: 'Fᵣ', category: 'Design', color: '#c4b1e1' },
  { name: 'Illustrator', label: 'Ai', category: 'Design', color: '#efc289' },
  { name: 'Git', label: 'G', category: 'Tools', color: '#eea28d' },
  { name: 'VS Code', label: '⌘', category: 'Tools', color: '#97b9da' },
  { name: 'Notion', label: 'N', category: 'Tools', color: '#dfded5' },
  { name: 'Vercel', label: '▲', category: 'Tools', color: '#dfded5' },
]

const categories = ['All', 'Development', 'Design', 'Tools'] as const
type Category = typeof categories[number]

const activityWeeks = 44
const activityStart = Date.UTC(2026, 0, 5)
const activityToday = Date.UTC(2026, 10, 5)
const dayMilliseconds = 86_400_000
const activity = Array.from({ length: activityWeeks * 7 }, (_, index) => {
  const timestamp = activityStart + index * dayMilliseconds
  const seed = (index * 17 + Math.floor(index / 7) * 11 + 7) % 23
  const count = timestamp > activityToday ? 0 : seed < 7 ? 0 : seed < 12 ? 1 : seed < 17 ? 3 : seed < 21 ? 5 : 8
  const level = count === 0 ? 0 : count === 1 ? 1 : count === 3 ? 2 : count === 5 ? 3 : 4
  const date = new Date(timestamp)
  return {
    count,
    level,
    date: date.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date),
    future: timestamp > activityToday,
  }
})
const activityTotal = activity.reduce((total, day) => total + day.count, 0)
const activityMonths = Array.from({ length: activityWeeks }, (_, week) => {
  const date = new Date(activityStart + week * 7 * dayMilliseconds)
  const previous = new Date(activityStart + (week - 1) * 7 * dayMilliseconds)
  return week === 0 || date.getUTCMonth() !== previous.getUTCMonth()
    ? { week, name: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(date) }
    : null
}).filter((month): month is { week: number; name: string } => month !== null)

function SectionHeading({ number, title, note }: { number: string; title: string; note: string }) {
  return (
    <header className="ps-section-heading">
      <div className="ps-heading-title" data-assemble="text">
        <span className="ps-section-marker" aria-hidden="true"><i /><i /><i /><i /></span>
        <h2><span className="ps-section-number">{number}</span>{title}</h2>
      </div>
      <span className="ps-heading-note" data-assemble="text">{note}</span>
    </header>
  )
}

function ActivityGrid() {
  const [focusedDay, setFocusedDay] = useState(297)
  const [inspectedDay, setInspectedDay] = useState<number | null>(null)
  const dayRefs = useRef<(HTMLButtonElement | null)[]>([])

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = index + 7 < activity.length ? index + 7 : index
    else if (event.key === 'ArrowLeft') next = index >= 7 ? index - 7 : index
    else if (event.key === 'ArrowDown') next = index % 7 < 6 ? index + 1 : index
    else if (event.key === 'ArrowUp') next = index % 7 > 0 ? index - 1 : index
    else if (event.key === 'Home') next = event.ctrlKey ? 0 : index % 7
    else if (event.key === 'End') next = event.ctrlKey ? activity.length - 1 : (activityWeeks - 1) * 7 + index % 7
    else return
    event.preventDefault()
    setFocusedDay(next)
    dayRefs.current[next]?.focus()
  }

  const inspected = inspectedDay === null ? null : activity[inspectedDay]

  return (
    <div className="ps-activity-panel" data-assemble="card">
      <div className="ps-activity-intro">
        <p><strong>{activityTotal.toLocaleString('en')}</strong> little steps forward</p>
        <span className="ps-demo-label"><span />Demo activity</span>
      </div>
      <div className="ps-activity-chart">
        <div className="ps-activity-months" aria-hidden="true">
          {activityMonths.map(month => <span key={month.week} style={{ gridColumn: month.week + 1 }}>{month.name}</span>)}
        </div>
        <div className="ps-activity-body">
          <div className="ps-activity-weekdays" aria-hidden="true"><span>Mon</span><span>Wed</span><span>Fri</span></div>
          <div className="ps-activity-grid" role="grid" aria-label="Illustrative 2026 activity. Use arrow keys to explore dates." aria-rowcount={7} aria-colcount={activityWeeks} onMouseLeave={() => setInspectedDay(null)}>
            {Array.from({ length: 7 }, (_, row) => (
              <div className="ps-activity-row" role="row" key={row} aria-rowindex={row + 1}>
                {Array.from({ length: activityWeeks }, (_, week) => {
                  const index = week * 7 + row
                  const day = activity[index]
                  const description = `${day.count} ${day.count === 1 ? 'exploration' : 'explorations'} on ${day.label}${day.future ? ' (upcoming)' : ''}`
                  return <button
                    type="button"
                    role="gridcell"
                    aria-label={description}
                    aria-colindex={week + 1}
                    key={day.date}
                    ref={element => { dayRefs.current[index] = element }}
                    className={`ps-activity-day ps-activity-level-${day.level}${day.future ? ' ps-activity-future' : ''}`}
                    tabIndex={focusedDay === index ? 0 : -1}
                    onFocus={() => { setFocusedDay(index); setInspectedDay(index) }}
                    onBlur={() => setInspectedDay(null)}
                    onMouseEnter={() => setInspectedDay(index)}
                    onClick={() => setInspectedDay(index)}
                    onKeyDown={event => navigate(event, index)}
                    title={description}
                  />
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ps-activity-bottom">
        <p className="ps-activity-detail" aria-live="polite" aria-atomic="true">
          {inspected ? `${inspected.count} ${inspected.count === 1 ? 'exploration' : 'explorations'} on ${inspected.label}` : 'Making, learning, and showing up.'}
        </p>
        <div className="ps-activity-legend" aria-label="Activity scale, less to more"><span>Less</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className={`ps-activity-level-${level}`} />)}<span>More</span></div>
      </div>
    </div>
  )
}

export default function PortfolioSections() {
  const [category, setCategory] = useState<Category>('All')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const visibleTools = toolkitItems.filter(tool => category === 'All' || tool.category === category)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !selectedProject) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!dialog.open) dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('.ps-dialog-close')?.focus()
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus({ preventScroll: true })
    }
  }, [selectedProject])

  function openProject(project: Project, event: MouseEvent<HTMLButtonElement>) {
    returnFocusRef.current = event.currentTarget
    setSelectedProject(project)
  }

  function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % categories.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + categories.length) % categories.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = categories.length - 1
    else return
    event.preventDefault()
    setCategory(categories[next])
    tabRefs.current[next]?.focus()
  }

  return (
    <>
      <section className="ps-section assembly-scene" id="work" data-scene-name="Selected work" aria-label="Selected work">
        <SectionHeading number="02" title="Selected work" note="A FEW RECENT FAVORITES" />
        <div className="ps-project-grid">
          {[projects.slice(0, 2), projects.slice(2, 4)].map((row, rowIndex) => <div className="ps-project-row assembly-scene" data-scene-name={`Project row ${rowIndex + 1}`} key={rowIndex}>
          {row.map(project => (
            <article className={`ps-project ps-project-${project.kind}`} key={project.name} data-assemble="card">
              <div className="ps-project-art" aria-hidden="true"><ProjectArt kind={project.kind} /><span className="ps-project-index">{project.number} / SELECTED</span><span className="ps-project-art-arrow"><ArrowUpRight size={17} strokeWidth={1.5} /></span></div>
              <div className="ps-project-body">
                <div className="ps-project-title"><h3>{project.name}</h3><span>{project.year}</span></div>
                <p className="ps-project-description">{project.description}</p>
                <p className="ps-project-discipline">{project.discipline}</p>
                <div className="ps-project-bottom"><div className="ps-project-technologies">{project.technologies.slice(0, 2).map(technology => <span key={technology}>{technology}</span>)}</div><button type="button" className="ps-case-button" onClick={event => openProject(project, event)} aria-label={`View ${project.name} case study`}><span>View case study</span><ArrowUpRight size={14} /></button></div>
              </div>
            </article>
          ))}
          </div>)}
        </div>
        <p className="ps-work-note" data-assemble="text"><Circle size={7} fill="currentColor" /> A selection of independent concepts & experiments.</p>
      </section>

      <section className="ps-section assembly-scene" id="experience" data-scene-name="Experience" aria-label="Experience">
        <SectionHeading number="03" title="Along the way" note="EXPERIENCE" />
        <div className="ps-experience-list">
          <article className="ps-experience" data-assemble="card"><div className="ps-company-icon ps-company-independent" aria-hidden="true">am<span>✳</span></div><div className="ps-experience-main"><div className="ps-experience-topline"><h3>Independent</h3><span className="ps-current-label">NOW</span></div><p>Designer & creative developer</p><p className="ps-experience-description">Helping good people turn thoughtful ideas into digital things.</p></div><span className="ps-experience-date">2024 — Present</span></article>
          <article className="ps-experience" data-assemble="card"><div className="ps-company-icon ps-company-studio" aria-hidden="true"><span /><span /></div><div className="ps-experience-main"><div className="ps-experience-topline"><h3>Studio North</h3></div><p>Product designer</p><p className="ps-experience-description">Crafted useful, considered experiences with a small, curious team.</p></div><span className="ps-experience-date">2022 — 2024</span></article>
        </div>
      </section>

      <section className="ps-section assembly-scene" id="toolkit" data-scene-name="Toolkit" aria-label="Toolkit">
        <SectionHeading number="04" title="Tools of the trade" note="ALWAYS EXPLORING" />
        <div className="ps-toolkit-panel" data-assemble="card">
          <div className="ps-toolkit-top"><div className="ps-toolkit-tabs" role="tablist" aria-label="Toolkit categories">{categories.map((item, index) => <button type="button" role="tab" id={`toolkit-tab-${item.toLowerCase()}`} aria-selected={category === item} aria-controls="toolkit-results" tabIndex={category === item ? 0 : -1} key={item} ref={element => { tabRefs.current[index] = element }} onClick={() => setCategory(item)} onKeyDown={event => navigateTabs(event, index)}>{item}{item === 'All' && <span>{toolkitItems.length}</span>}</button>)}</div><span className="ps-toolkit-small-note">THE EVERYDAY STACK</span></div>
          <div className="ps-toolkit-grid" id="toolkit-results" role="tabpanel" aria-labelledby={`toolkit-tab-${category.toLowerCase()}`} tabIndex={0}>{visibleTools.map(tool => <div className="ps-tool" key={tool.name}><span className="ps-tool-symbol" aria-hidden="true" style={{ color: tool.color }}>{tool.label}</span><span>{tool.name}</span><span className="ps-tool-dot" aria-hidden="true" /></div>)}</div>
          <p className="ps-toolkit-note"><ArrowDown size={12} /> The best tool is the one that helps make something good.</p>
        </div>
      </section>

      <section className="ps-section assembly-scene" id="activity" data-scene-name="Activity" aria-label="Activity">
        <SectionHeading number="05" title="A little, every day" note="2026 / IN PROGRESS" />
        <ActivityGrid />
      </section>

      <section className="ps-contact assembly-scene" id="contact" data-scene-name="Contact" aria-label="Contact">
        <div className="ps-contact-rule" data-assemble="line" />
        <div className="ps-contact-overline" data-assemble="text"><span className="ps-section-number">06</span><span>HAVE SOMETHING IN MIND?</span><span className="ps-contact-spark" aria-hidden="true">✳</span></div>
        <h2 data-assemble="text">Good things start<br />with a <span>hello.</span></h2>
        <div className="ps-contact-bottom" data-assemble="text"><div><p>Have a project, an idea, or just a good story?</p><a className="ps-email-link" href="mailto:hello@example.com">hello@example.com <ArrowUpRight size={20} strokeWidth={1.5} /></a></div><a className="ps-contact-arrow" href="mailto:hello@example.com" aria-label="Say hello to Alex by email"><ArrowUpRight size={31} strokeWidth={1.3} /></a></div>
        <div className="ps-contact-status" data-assemble="text"><span />Open to good conversations & interesting projects.</div>
      </section>

      <footer className="ps-footer assembly-scene"><div className="ps-footer-line" data-assemble="line" /><div className="ps-footer-content" data-assemble="text"><span>© 2026 Alex Morgan</span><span className="ps-footer-made">A little craft. A lot of care.</span><a href="#" aria-label="Back to top">Back to top <ArrowUp size={12} /></a></div></footer>

      <dialog className="ps-case-dialog" ref={dialogRef} aria-labelledby="case-study-title" onCancel={event => { event.preventDefault(); setSelectedProject(null) }} onClick={event => { if (event.target === event.currentTarget) setSelectedProject(null) }} onKeyDown={trapDialogFocus}>
        {selectedProject && <div className="ps-case-sheet"><div className="ps-case-dialog-top"><span>CASE STUDY / {selectedProject.number}</span><button type="button" className="ps-dialog-close" aria-label="Close case study" onClick={() => setSelectedProject(null)}><X size={20} /></button></div><div className="ps-case-intro"><div className="ps-case-eyebrow">{selectedProject.discipline} <span>·</span> {selectedProject.year}</div><h2 id="case-study-title">{selectedProject.name}</h2><p>{selectedProject.summary}</p><div className="ps-case-tags">{selectedProject.technologies.map(technology => <span key={technology}>{technology}</span>)}</div></div><div className={`ps-case-art ps-project-${selectedProject.kind}`} aria-hidden="true"><ProjectArt kind={selectedProject.kind} /></div><div className="ps-case-content"><span className="ps-concept-note">Independent portfolio concept · Fictional brief</span><div className="ps-case-copy"><h3>The question</h3><p>{selectedProject.problem}</p><h3>The approach</h3><p>{selectedProject.approach}</p><h3>The result</h3><p>{selectedProject.outcome}</p></div><ul className="ps-case-details">{selectedProject.details.map(detail => <li key={detail}><Check size={14} />{detail}</li>)}</ul><div className="ps-case-end"><p>Thanks for taking a closer look.</p><button type="button" onClick={() => setSelectedProject(null)}>Back to selected work <ArrowUpRight size={14} /></button></div></div></div>}
      </dialog>
    </>
  )
}
