import { ArrowDown, ArrowUpRight, Circle } from 'lucide-react'
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
  },
  {
    number: '02',
    name: 'Forma',
    description: 'Room for your next big idea.',
    discipline: 'Product design · Development',
    year: '2026',
    kind: 'forma',
    technologies: ['Figma', 'React', 'Motion'],
  },
  {
    number: '03',
    name: 'Field',
    description: 'Less scrolling. More wandering.',
    discipline: 'Web design · Development',
    year: '2025',
    kind: 'field',
    technologies: ['React', 'MDX', 'CSS'],
  },
  {
    number: '04',
    name: 'Mono',
    description: 'Less noise. More listening.',
    discipline: 'Interaction design · Experiment',
    year: '2025',
    kind: 'mono',
    technologies: ['Web Audio', 'React', 'CSS'],
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
        <span className="ps-section-marker" data-construction-atom aria-hidden="true"><i /><i /><i /><i /></span>
        <h2><span className="ps-section-number">{number}</span>{title}</h2>
      </div>
      <span className="ps-heading-note" data-assemble="text">{note}</span>
    </header>
  )
}

function ActivityGrid() {
  return (
    <div className="ps-activity-panel" data-assemble="card">
      <div className="ps-activity-intro">
        <p><strong>{activityTotal.toLocaleString('en')}</strong> little steps forward</p>
        <span className="ps-demo-label"><span />Demo activity</span>
      </div>
      <div className="ps-activity-chart" data-construction-atom>
        <div className="ps-activity-months" aria-hidden="true">
          {activityMonths.map(month => <span key={month.week} style={{ gridColumn: month.week + 1 }}>{month.name}</span>)}
        </div>
        <div className="ps-activity-body">
          <div className="ps-activity-weekdays" aria-hidden="true"><span>Mon</span><span>Wed</span><span>Fri</span></div>
          <div className="ps-activity-grid" role="img" aria-label={`Demo activity for 2026, showing ${activityTotal} fictional explorations across 44 weeks.`}>
            {Array.from({ length: 7 }, (_, row) => (
              <div className="ps-activity-row" key={row} aria-hidden="true">
                {Array.from({ length: activityWeeks }, (_, week) => {
                  const index = week * 7 + row
                  const day = activity[index]
                  return <span
                    key={day.date}
                    className={`ps-activity-day ps-activity-level-${day.level}${day.future ? ' ps-activity-future' : ''}`}
                  />
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ps-activity-bottom">
        <p className="ps-activity-detail">Making, learning, and showing up.</p>
        <div className="ps-activity-legend" aria-label="Activity scale, less to more"><span>Less</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className={`ps-activity-level-${level}`} />)}<span>More</span></div>
      </div>
    </div>
  )
}

export default function PortfolioSections() {
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
                <div className="ps-project-bottom"><div className="ps-project-technologies">{project.technologies.slice(0, 2).map(technology => <span key={technology}>{technology}</span>)}</div><span className="ps-project-status">CONCEPT / {project.number}</span></div>
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
          <article className="ps-experience" data-assemble="card"><div className="ps-company-icon ps-company-independent" data-construction-atom aria-hidden="true">am<span>✳</span></div><div className="ps-experience-main"><div className="ps-experience-topline"><h3>Independent</h3><span className="ps-current-label">NOW</span></div><p>Designer & creative developer</p><p className="ps-experience-description">Helping good people turn thoughtful ideas into digital things.</p></div><span className="ps-experience-date">2024 — Present</span></article>
          <article className="ps-experience" data-assemble="card"><div className="ps-company-icon ps-company-studio" data-construction-atom aria-hidden="true"><span /><span /></div><div className="ps-experience-main"><div className="ps-experience-topline"><h3>Studio North</h3></div><p>Product designer</p><p className="ps-experience-description">Crafted useful, considered experiences with a small, curious team.</p></div><span className="ps-experience-date">2022 — 2024</span></article>
        </div>
      </section>

      <section className="ps-section assembly-scene" id="toolkit" data-scene-name="Toolkit" aria-label="Toolkit">
        <SectionHeading number="04" title="Tools of the trade" note="ALWAYS EXPLORING" />
        <div className="ps-toolkit-panel" data-assemble="card">
          <div className="ps-toolkit-top"><div className="ps-toolkit-tabs" aria-label="Toolkit categories; all tools shown">{categories.map(item => <span className={`ps-toolkit-tab${item === 'All' ? ' is-selected' : ''}`} key={item}>{item}{item === 'All' && <span>{toolkitItems.length}</span>}</span>)}</div><span className="ps-toolkit-small-note">THE EVERYDAY STACK</span></div>
          <div className="ps-toolkit-grid" id="toolkit-results">{toolkitItems.map(tool => <div className="ps-tool" data-construction-atom key={tool.name}><span className="ps-tool-symbol" aria-hidden="true" style={{ color: tool.color }}>{tool.label}</span><span>{tool.name}</span><span className="ps-tool-dot" aria-hidden="true" /></div>)}</div>
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
        <div className="ps-contact-bottom" data-assemble="text"><div><p>Have a project, an idea, or just a good story?</p><span className="ps-email-display">hello@example.com <ArrowUpRight size={20} strokeWidth={1.5} aria-hidden="true" /></span></div><span className="ps-contact-arrow" aria-hidden="true"><ArrowUpRight size={31} strokeWidth={1.3} /></span></div>
        <div className="ps-contact-status" data-assemble="text"><span />Open to good conversations & interesting projects.</div>
      </section>

      <footer className="ps-footer assembly-scene"><div className="ps-footer-line" data-assemble="line" /><div className="ps-footer-content" data-assemble="text"><span>© 2026 Alex Morgan</span><span className="ps-footer-made">A little craft. A lot of care.</span><span className="ps-footer-end">END OF CANVAS</span></div></footer>
    </>
  )
}
