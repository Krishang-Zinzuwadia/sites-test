import './design-tools.css'

export type Collaborator = {
  name: string
  color: string
  role: string
}

export const collaborators: Collaborator[] = [
  { name: 'Mia', color: '#f18766', role: 'layout' },
  { name: 'Noah', color: '#b7a0ec', role: 'type' },
  { name: 'Leo', color: '#a8c99a', role: 'copy' },
  { name: 'Ava', color: '#8dced2', role: 'color' },
  { name: 'Eli', color: '#e5c278', role: 'spacing' },
  { name: 'You', color: '#df9fbb', role: 'components' },
]

export function createCursor(actor: Collaborator): HTMLDivElement {
  const cursor = document.createElement('div')
  cursor.className = 'assembly-cursor'
  cursor.dataset.collaborator = actor.name
  cursor.style.setProperty('--collaborator-color', actor.color)
  cursor.setAttribute('aria-hidden', 'true')
  cursor.innerHTML = `<svg class="assembly-cursor-arrow" viewBox="0 0 20 25" aria-hidden="true"><path d="M2 2 3.6 20.2 8.6 15.5 12.2 23 15.5 21.4 11.9 14 18.4 13.6 2 2Z"/></svg><span class="assembly-cursor-name"></span><span class="assembly-cursor-action"></span>`
  cursor.querySelector('.assembly-cursor-name')!.textContent = actor.name
  cursor.querySelector('.assembly-cursor-action')!.textContent = actor.role
  return cursor
}

type ToolKind = 'layout' | 'text' | 'font' | 'color' | 'spacing'

const icon = (content: string) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`

const icons = {
  layout: icon('<path d="M5 2v12M11 2v12M2 5h12M2 11h12"/>'),
  text: icon('<path d="M3 4V2h10v2M8 2v12M5 14h6"/>'),
  font: icon('<path d="m2 13 4-10 4 10M3.5 9h5M11 7h3v6M14 9c-4-.6-4 4 0 3"/>'),
  color: icon('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11Z" fill="currentColor" stroke="none"/>'),
  spacing: icon('<path d="M2 3v10M14 3v10M5 5h6v6H5zM1 8h3M12 8h3"/>'),
  alignLeft: icon('<path d="M2 2v12M5 5h8M5 8h5M5 11h8"/>'),
  alignCenter: icon('<path d="M8 2v12M3 5h10M5 8h6M3 11h10"/>'),
  alignRight: icon('<path d="M14 2v12M3 5h8M6 8h5M3 11h8"/>'),
  alignTop: icon('<path d="M2 2h12M5 5v8M8 5v5M11 5v8"/>'),
  alignMiddle: icon('<path d="M2 8h12M5 3v10M8 5v6M11 3v10"/>'),
  alignBottom: icon('<path d="M2 14h12M5 3v8M8 6v5M11 3v8"/>'),
}

const field = (label: string, value: string) => `<div class="design-tool-field"><span>${label}</span><b>${value}</b></div>`
const option = (choice: string, content: string, extraClass = '') => `<div class="design-tool-option ${extraClass}" data-choice="${choice}">${content}</div>`

const panelContents: Record<ToolKind, { title: string; body: string; footer: string }> = {
  layout: {
    title: 'Create frame',
    body: `<div class="design-tool-section-label">FRAME</div><div class="design-tool-fields">${field('X', '0')}${field('Y', '0')}${field('W', '760')}${field('H', '238')}</div>${option('frame', `${icons.layout}<span>Create frame</span><span class="design-tool-key">F</span>`, 'design-tool-primary')}`,
    footer: 'Frame 01 · Freeform',
  },
  text: {
    title: 'Add text',
    body: `${option('text', `${icons.text}<span>Text box</span><span class="design-tool-key">T</span>`)}<div class="design-tool-text-preview"><span class="design-tool-placeholder">Type something<span class="design-tool-caret"></span></span></div><div class="design-tool-fields">${field('Size', '36')}${field('Line', '115%')}</div>`,
    footer: 'Click anywhere to type',
  },
  font: {
    title: 'Typography',
    body: `<div class="design-tool-section-label">FONT FAMILY</div>${option('manrope', '<span>Manrope</span><span class="design-tool-sample">Ag</span>', 'design-tool-font-manrope')}${option('dm-sans', '<span>DM Sans</span><span class="design-tool-sample">Ag</span>', 'design-tool-font-dm')}${option('plex', '<span>IBM Plex Mono</span><span class="design-tool-sample">Ag</span>', 'design-tool-font-plex')}<div class="design-tool-type-meta"><span>Medium</span><span>500</span></div>`,
    footer: 'A little character goes a long way',
  },
  color: {
    title: 'Fill & color',
    body: `<div class="design-tool-section-label">DOCUMENT COLORS</div><div class="design-tool-swatches"><div class="design-tool-swatch" data-choice="sage" style="--swatch:#a8c99a"><span></span></div><div class="design-tool-swatch" data-choice="coral" style="--swatch:#f18766"><span></span></div><div class="design-tool-swatch" data-choice="cream" style="--swatch:#edece5"><span></span></div><div class="design-tool-swatch" data-choice="lavender" style="--swatch:#b7a0ec"><span></span></div></div><div class="design-tool-color-value"><i></i><span>A8C99A</span><b>100%</b></div>`,
    footer: 'Warm, a little unexpected',
  },
  spacing: {
    title: 'Align & arrange',
    body: `<div class="design-tool-section-label">ALIGNMENT</div><div class="design-tool-alignments">${option('left', icons.alignLeft)}${option('center', icons.alignCenter)}${option('right', icons.alignRight)}${option('top', icons.alignTop)}${option('middle', icons.alignMiddle)}${option('bottom', icons.alignBottom)}</div><div class="design-tool-spacing-row"><span>Item gap</span>${option('gap16', '<span>↔</span><b>16</b>')}</div>`,
    footer: 'Everything in its place',
  },
}

export function createToolPanel(kind: ToolKind): HTMLDivElement {
  const panel = document.createElement('div')
  const { title, body, footer } = panelContents[kind]
  panel.className = `design-tool-panel design-tool-panel--${kind}`
  panel.dataset.tool = kind
  panel.setAttribute('aria-hidden', 'true')
  panel.inert = true
  panel.innerHTML = `<div class="design-tool-heading">${icons[kind]}<span>${title}</span><i>···</i></div><div class="design-tool-body">${body}</div><div class="design-tool-footer"><span class="design-tool-status-dot"></span>${footer}</div>`
  return panel
}
