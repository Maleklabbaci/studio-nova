import { contrast, DocBuilder } from '../kit'
import { PALETTES } from '../palette'
import type { TemplateDesign } from '../registry'
import { fontsFor, headingBold, PALETTE_KEYS, slugify, styleFor, THEMES, VARIANTS, type Build, type Theme } from './factory'

/**
 * The formats factory: the document types a Canva-style catalogue is browsed
 * by — Facebook post, presentation slide, flyer, invitation, business card,
 * logo, resume and certificate — each generated at the exact size of the
 * matching Studio Nova preset, crossed with the same business themes,
 * palettes and styles as the social factory. Sizes are pixels at 96 dpi,
 * exactly like the hand-made starters (business card 336x192, A4 794x1123).
 */

/** Black or white, whichever reads better on `bg` (always >= ~4.58:1). */
function bestOn(bg: string): string {
  return contrast('#ffffff', bg) >= contrast('#111111', bg) ? '#ffffff' : '#111111'
}

/** `preferred` when it is safely readable on `bg`, else the best of black/white. Small text needs 4.5:1. */
function readable(bg: string, preferred: string): string {
  return contrast(preferred, bg) >= 4.6 ? preferred : bestOn(bg)
}

function initials(brand: string): string {
  return brand
    .split(/\s+/)
    .filter((word) => /[A-Za-zÀ-ÿ]/.test(word.charAt(0)))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

const facebookPost: Build = (doc, theme, s, f) => {
  const p = doc.page('Facebook post', { type: 'solid', color: s.bg })
  p.placeholder({ name: 'Photo', x: 730, y: 0, w: 470, h: 630 })
  p.text({ name: 'Brand', x: 60, y: 60, w: 600, text: theme.brand, font: f.body, size: 24, bold: true, color: readable(s.bg, s.soft), on: s.bg, upper: true, spacing: 240 })
  p.text({ name: 'Headline', x: 56, y: 140, w: 640, text: theme.headline, font: f.heading, size: 60, bold: headingBold(f.heading), color: readable(s.bg, s.ink), on: s.bg, lh: 1.08 })
  p.text({ name: 'Subline', x: 60, y: 360, w: 600, text: theme.sub, font: f.body, size: 26, color: readable(s.bg, s.soft), on: s.bg, lh: 1.3 })
  p.rect({ name: 'Button', x: 60, y: 480, w: 300, h: 84, fill: s.pill, radius: 42 })
  p.text({ name: 'Button label', x: 60, y: 505, w: 300, text: theme.cta, font: f.body, size: 26, bold: true, color: readable(s.pill, s.pillText), on: s.pill, align: 'center' })
}

const slideTitle: Build = (doc, theme, s, f) => {
  const p = doc.page('Title slide', { type: 'solid', color: s.bg })
  p.circle({ name: 'Accent disc', cx: 1760, cy: 130, r: 330, fill: s.accent, opacity: 0.85 })
  p.placeholder({ name: 'Photo', x: 1230, y: 190, w: 560, h: 700, mask: 'rounded', maskRadius: 0.06 })
  p.text({ name: 'Brand', x: 110, y: 120, w: 900, text: theme.brand, font: f.body, size: 30, bold: true, color: readable(s.bg, s.soft), on: s.bg, upper: true, spacing: 320 })
  p.text({ name: 'Title', x: 104, y: 260, w: 1020, text: theme.headline, font: f.heading, size: 108, bold: headingBold(f.heading), color: readable(s.bg, s.ink), on: s.bg, lh: 1.04 })
  p.text({ name: 'Subtitle', x: 110, y: 640, w: 900, text: theme.sub, font: f.body, size: 38, color: readable(s.bg, s.soft), on: s.bg, lh: 1.3 })
  p.line({ name: 'Rule', x1: 110, y1: 830, x2: 430, y2: 830, color: s.accent, width: 8 })
  p.text({ name: 'Meta', x: 110, y: 870, w: 900, text: `${theme.date} · ${theme.place}`, font: f.body, size: 28, color: readable(s.bg, s.soft), on: s.bg })
}

const flyer: Build = (doc, theme, s, f) => {
  const p = doc.page('Flyer', { type: 'solid', color: s.bg })
  p.placeholder({ name: 'Photo', x: 0, y: 0, w: 528, h: 300 })
  p.rect({ name: 'Badge', x: 28, y: 24, w: 150, h: 52, fill: s.pill, radius: 26 })
  p.text({ name: 'Badge label', x: 28, y: 38, w: 150, text: theme.badge, font: f.body, size: 19, bold: true, color: readable(s.pill, s.pillText), on: s.pill, align: 'center' })
  p.text({ name: 'Headline', x: 26, y: 330, w: 476, text: theme.headline, font: f.heading, size: 44, bold: headingBold(f.heading), color: readable(s.bg, s.ink), on: s.bg, lh: 1.08 })
  p.text({ name: 'Subline', x: 28, y: 480, w: 470, text: theme.sub, font: f.body, size: 19, color: readable(s.bg, s.soft), on: s.bg, lh: 1.35 })
  p.line({ name: 'Rule', x1: 28, y1: 580, x2: 180, y2: 580, color: s.accent, width: 5 })
  p.text({ name: 'Date', x: 28, y: 605, w: 470, text: theme.date, font: f.body, size: 21, bold: true, color: readable(s.bg, s.ink), on: s.bg })
  p.text({ name: 'Place', x: 28, y: 640, w: 470, text: theme.place, font: f.body, size: 18, color: readable(s.bg, s.soft), on: s.bg })
  p.rect({ name: 'Button', x: 28, y: 716, w: 250, h: 64, fill: s.pill, radius: 32 })
  p.text({ name: 'Button label', x: 28, y: 736, w: 250, text: theme.cta, font: f.body, size: 20, bold: true, color: readable(s.pill, s.pillText), on: s.pill, align: 'center' })
}

const invitation: Build = (doc, theme, s, f) => {
  const p = doc.page('Invitation', { type: 'solid', color: s.bg })
  p.rect({ name: 'Frame', x: 22, y: 22, w: 436, h: 628, fill: s.bg, stroke: s.accent, strokeWidth: 3 })
  p.text({ name: 'Kicker', x: 40, y: 92, w: 400, text: 'You are invited', font: f.body, size: 17, bold: true, color: readable(s.bg, s.soft), on: s.bg, align: 'center', upper: true, spacing: 340 })
  p.text({ name: 'Event', x: 36, y: 170, w: 408, text: theme.event, font: f.heading === 'anton' || f.heading === 'bebas' ? 'playfair' : f.heading, size: 42, color: readable(s.bg, s.ink), on: s.bg, align: 'center', lh: 1.15 })
  p.line({ name: 'Rule', x1: 190, y1: 330, x2: 290, y2: 330, color: s.accent, width: 3 })
  p.text({ name: 'Date', x: 40, y: 362, w: 400, text: theme.date, font: f.body, size: 20, bold: true, color: readable(s.bg, s.ink), on: s.bg, align: 'center' })
  p.text({ name: 'Place', x: 40, y: 400, w: 400, text: theme.place, font: f.body, size: 17, color: readable(s.bg, s.soft), on: s.bg, align: 'center' })
  p.text({ name: 'Host', x: 40, y: 480, w: 400, text: `Hosted by ${theme.brand}`, font: f.body, size: 16, color: readable(s.bg, s.soft), on: s.bg, align: 'center' })
  p.rect({ name: 'Button', x: 130, y: 548, w: 220, h: 58, fill: s.pill, radius: 29 })
  p.text({ name: 'Button label', x: 130, y: 565, w: 220, text: theme.cta, font: f.body, size: 18, bold: true, color: readable(s.pill, s.pillText), on: s.pill, align: 'center' })
}

const businessCard: Build = (doc, theme, s, f) => {
  const p = doc.page('Card front', { type: 'solid', color: s.bg })
  p.rect({ name: 'Side band', x: 0, y: 0, w: 14, h: 192, fill: s.accent })
  p.text({ name: 'Brand', x: 36, y: 34, w: 280, text: theme.brand, font: f.heading, size: 24, bold: headingBold(f.heading), color: readable(s.bg, s.ink), on: s.bg })
  p.text({ name: 'Tagline', x: 36, y: 72, w: 280, text: theme.badge.charAt(0) + theme.badge.slice(1).toLowerCase() + ' · ' + theme.tags[0], font: f.body, size: 12, color: readable(s.bg, s.soft), on: s.bg, upper: true, spacing: 140 })
  p.line({ name: 'Rule', x1: 36, y1: 112, x2: 120, y2: 112, color: s.accent, width: 3 })
  p.text({ name: 'Contact', x: 36, y: 130, w: 290, text: `hello@${slugify(theme.brand)}.com`, font: f.body, size: 13, color: readable(s.bg, s.ink), on: s.bg })
  p.text({ name: 'Handle', x: 36, y: 152, w: 290, text: `@${slugify(theme.brand)} · ${theme.place}`, font: f.body, size: 11, color: readable(s.bg, s.soft), on: s.bg })
}

const logoMark: Build = (doc, theme, s, f) => {
  const p = doc.page('Logo', { type: 'solid', color: s.bg })
  p.circle({ name: 'Monogram disc', cx: 250, cy: 205, r: 118, fill: s.pill })
  p.text({ name: 'Monogram', x: 100, y: 128, w: 300, text: initials(theme.brand), font: f.heading, size: 104, bold: headingBold(f.heading), color: readable(s.pill, s.pillText), on: s.pill, align: 'center' })
  p.text({ name: 'Brand', x: 20, y: 356, w: 460, text: theme.brand, font: f.heading, size: 40, bold: headingBold(f.heading), color: readable(s.bg, s.ink), on: s.bg, align: 'center', upper: true, spacing: 160 })
  p.text({ name: 'Descriptor', x: 20, y: 420, w: 460, text: theme.tags[0], font: f.body, size: 19, color: readable(s.bg, s.soft), on: s.bg, align: 'center', upper: true, spacing: 420 })
}

interface FormatArchetype {
  id: string
  label: string
  category: string
  preset: string
  width: number
  height: number
  tags: string[]
  build: Build
}

const FORMATS: readonly FormatArchetype[] = [
  { id: 'facebook', label: 'Facebook post', category: 'social-media', preset: 'facebook-post', width: 1200, height: 630, tags: ['facebook', 'post', 'social'], build: facebookPost },
  { id: 'slide', label: 'Presentation slide', category: 'presentations', preset: 'presentation', width: 1920, height: 1080, tags: ['presentation', 'slides', 'deck', 'pitch'], build: slideTitle },
  { id: 'flyer', label: 'Flyer', category: 'flyers', preset: 'flyer', width: 528, height: 816, tags: ['flyer', 'print', 'promo'], build: flyer },
  { id: 'invitation', label: 'Invitation', category: 'invitations', preset: 'invitation', width: 480, height: 672, tags: ['invitation', 'event', 'print'], build: invitation },
  { id: 'card', label: 'Business card', category: 'cards', preset: 'business-card', width: 336, height: 192, tags: ['business card', 'contact', 'print'], build: businessCard },
  { id: 'logo', label: 'Logo', category: 'logos', preset: 'logo', width: 500, height: 500, tags: ['logo', 'brand', 'monogram'], build: logoMark },
]

function makeFormatDesign(archetype: FormatArchetype, theme: Theme, variant: (typeof VARIANTS)[number], seed: number): TemplateDesign {
  const palette = PALETTES[PALETTE_KEYS[seed % PALETTE_KEYS.length]]
  const style = styleFor(palette, variant.id)
  const fonts = fontsFor(seed)
  const slug = `factory-${archetype.id}-${theme.id}-${variant.id}`
  return {
    slug,
    title: `${theme.brand} — ${archetype.label} (${variant.label})`,
    category: archetype.category,
    tags: [...archetype.tags, ...theme.tags, variant.id],
    description: `A ${variant.label.toLowerCase()} ${archetype.label.toLowerCase()} for ${theme.brand}, at the exact ${archetype.preset} size (${archetype.width} x ${archetype.height}). Replace the wording, photo slot and colours to make it yours.`,
    preset: archetype.preset,
    build() {
      const doc = new DocBuilder(slug, { width: archetype.width, height: archetype.height, unit: 'px', presetId: archetype.preset })
      archetype.build(doc, theme, style, fonts)
      return doc
    },
  }
}

/* ------------------------------------------------------------------ resumes */

interface Profession {
  id: string
  name: string
  role: string
  summary: string
  skills: string[]
}

const PROFESSIONS: readonly Profession[] = [
  { id: 'designer', name: 'Nadia Benali', role: 'Product designer', summary: 'Designer with 6 years shaping web and mobile products, from first sketch to design system.', skills: ['Product design', 'Design systems', 'Prototyping', 'User research'] },
  { id: 'developer', name: 'Karim Haddad', role: 'Software developer', summary: 'Full-stack developer who ships reliable services and clean, tested interfaces.', skills: ['TypeScript', 'Python', 'APIs', 'Testing'] },
  { id: 'chef', name: 'Sofia Marino', role: 'Head chef', summary: 'Chef trained in seasonal cuisine, leading kitchen teams and menus for busy restaurants.', skills: ['Menu design', 'Team leading', 'Pastry', 'Cost control'] },
  { id: 'teacher', name: 'Amelia Laurent', role: 'Primary teacher', summary: 'Patient, organised teacher who builds warm classrooms where every child progresses.', skills: ['Lesson planning', 'Class management', 'Assessment', 'Parent contact'] },
  { id: 'marketer', name: 'Lucas Meyer', role: 'Marketing lead', summary: 'Marketer growing brands with honest content, measured campaigns and clear reporting.', skills: ['Content', 'Campaigns', 'SEO', 'Analytics'] },
  { id: 'nurse', name: 'Ines Kaci', role: 'Registered nurse', summary: 'Nurse with hospital and community experience, calm under pressure and precise in care.', skills: ['Patient care', 'Triage', 'Records', 'Teamwork'] },
]

const RESUME_INK = '#26282c'
const RESUME_MUTED = '#5c5f66'
const RESUME_PAPER = '#ffffff'

function makeResume(profession: Profession, variant: (typeof VARIANTS)[number], seed: number): TemplateDesign {
  const palette = PALETTES[PALETTE_KEYS[seed % PALETTE_KEYS.length]]
  const slug = `factory-resume-${profession.id}-${variant.id}`
  return {
    slug,
    title: `${profession.role} resume (${variant.label})`,
    category: 'resumes',
    tags: ['resume', 'cv', 'job', 'career', 'a4', variant.id],
    description: `A clean one-page A4 resume for a ${profession.role.toLowerCase()}: coloured sidebar with contact and skills, experience on white. Replace every line with your own story.`,
    preset: 'resume',
    build() {
      const doc = new DocBuilder(slug, { width: 794, height: 1123, unit: 'mm', presetId: 'resume' })
      const p = doc.page('Resume', { type: 'solid', color: RESUME_PAPER })
      const sidebar = variant.id === 'bold' ? palette[900] : variant.id === 'pop' ? palette[600] : palette[100]
      const onSidebar = bestOn(sidebar)
      const accent = palette[700]
      p.rect({ name: 'Sidebar', x: 0, y: 0, w: 250, h: 1123, fill: sidebar })
      p.placeholder({ name: 'Photo', x: 55, y: 52, w: 140, h: 140, mask: 'circle' })
      p.text({ name: 'Side name', x: 28, y: 224, w: 196, text: profession.name, font: 'montserrat', size: 21, bold: true, color: onSidebar, on: sidebar, align: 'center', lh: 1.2 })
      p.text({ name: 'Side role', x: 28, y: 292, w: 196, text: profession.role, font: 'inter', size: 13, color: onSidebar, on: sidebar, align: 'center', upper: true, spacing: 120 })
      p.text({ name: 'Contact heading', x: 30, y: 380, w: 190, text: 'Contact', font: 'montserrat', size: 13, bold: true, color: onSidebar, on: sidebar, upper: true, spacing: 200 })
      p.text({ name: 'Contact', x: 30, y: 416, w: 192, text: `hello@${slugify(profession.name)}.com\n+213 555 01 02\nAlgiers, DZ`, font: 'inter', size: 12.5, color: onSidebar, on: sidebar, lh: 1.5 })
      p.text({ name: 'Skills heading', x: 30, y: 540, w: 190, text: 'Skills', font: 'montserrat', size: 13, bold: true, color: onSidebar, on: sidebar, upper: true, spacing: 200 })
      profession.skills.forEach((skill, i) => {
        const y = 582 + i * 58
        p.text({ name: `Skill ${i + 1}`, x: 30, y, w: 190, text: skill, font: 'inter', size: 12.5, color: onSidebar, on: sidebar })
        p.rect({ name: `Skill bar ${i + 1}`, x: 30, y: y + 26, w: 170, h: 5, fill: onSidebar, opacity: 0.25, radius: 2 })
        p.rect({ name: `Skill level ${i + 1}`, x: 30, y: y + 26, w: 100 + ((seed + i * 23) % 65), h: 5, fill: onSidebar, radius: 2 })
      })
      p.text({ name: 'Name', x: 286, y: 64, w: 460, text: profession.name, font: 'montserrat', size: 34, bold: true, color: RESUME_INK, on: RESUME_PAPER })
      p.text({ name: 'Role', x: 286, y: 116, w: 460, text: profession.role, font: 'inter', size: 16, color: accent, on: RESUME_PAPER, upper: true, spacing: 160 })
      p.line({ name: 'Rule', x1: 286, y1: 160, x2: 400, y2: 160, color: accent, width: 3 })
      p.text({ name: 'Profile heading', x: 286, y: 196, w: 460, text: 'Profile', font: 'montserrat', size: 14, bold: true, color: RESUME_INK, on: RESUME_PAPER, upper: true, spacing: 200 })
      p.text({ name: 'Profile', x: 286, y: 230, w: 452, text: profession.summary, font: 'inter', size: 13.5, color: RESUME_MUTED, on: RESUME_PAPER, lh: 1.55 })
      p.text({ name: 'Experience heading', x: 286, y: 330, w: 460, text: 'Experience', font: 'montserrat', size: 14, bold: true, color: RESUME_INK, on: RESUME_PAPER, upper: true, spacing: 200 })
      const jobs: readonly [string, string, string][] = [
        ['Senior ' + profession.role.charAt(0).toLowerCase() + profession.role.slice(1), '2022 — now', 'Led the work end to end: planning, delivery and the review loop with the whole team.'],
        [profession.role, '2019 — 2022', 'Owned day-to-day delivery, kept quality high and documented everything clearly.'],
        ['Junior ' + profession.role.charAt(0).toLowerCase() + profession.role.slice(1), '2017 — 2019', 'Learned the craft on real projects, with mentoring and steady progress.'],
      ]
      jobs.forEach(([role, dates, summary], i) => {
        const y = 368 + i * 148
        p.circle({ name: `Job dot ${i + 1}`, cx: 294, cy: y + 9, r: 5, fill: accent })
        p.text({ name: `Job role ${i + 1}`, x: 316, y, w: 430, text: role, font: 'montserrat', size: 15.5, bold: true, color: RESUME_INK, on: RESUME_PAPER })
        p.text({ name: `Job dates ${i + 1}`, x: 316, y: y + 28, w: 430, text: dates, font: 'inter', size: 12, color: accent, on: RESUME_PAPER })
        p.text({ name: `Job summary ${i + 1}`, x: 316, y: y + 56, w: 424, text: summary, font: 'inter', size: 13, color: RESUME_MUTED, on: RESUME_PAPER, lh: 1.5 })
      })
      p.text({ name: 'Education heading', x: 286, y: 830, w: 460, text: 'Education', font: 'montserrat', size: 14, bold: true, color: RESUME_INK, on: RESUME_PAPER, upper: true, spacing: 200 })
      p.text({ name: 'Education', x: 286, y: 864, w: 452, text: 'Degree in the field, with honours.\nCertifications and short courses, 2016 — 2024.', font: 'inter', size: 13, color: RESUME_MUTED, on: RESUME_PAPER, lh: 1.55 })
      return doc
    },
  }
}

/* -------------------------------------------------------------- certificates */

interface Occasion {
  id: string
  title: string
  line: string
}

const OCCASIONS: readonly Occasion[] = [
  { id: 'achievement', title: 'Certificate of Achievement', line: 'For outstanding work and dedication throughout the programme.' },
  { id: 'excellence', title: 'Excellence Award', line: 'In recognition of excellent results and exemplary attitude.' },
  { id: 'appreciation', title: 'Certificate of Appreciation', line: 'With gratitude for generous help and valued contribution.' },
  { id: 'training', title: 'Training Certificate', line: 'For successfully completing the full training programme.' },
  { id: 'participation', title: 'Certificate of Participation', line: 'For taking part with energy, curiosity and good spirit.' },
  { id: 'diploma', title: 'Diploma', line: 'Having satisfied all the requirements of the course of study.' },
]

function makeCertificate(occasion: Occasion, variant: (typeof VARIANTS)[number], seed: number): TemplateDesign {
  const palette = PALETTES[PALETTE_KEYS[seed % PALETTE_KEYS.length]]
  const slug = `factory-certificate-${occasion.id}-${variant.id}`
  const dark = variant.id === 'bold'
  const bg = dark ? palette[950] : '#ffffff'
  const ink = dark ? palette[50] : RESUME_INK
  const muted = dark ? palette[200] : RESUME_MUTED
  const accent = dark ? palette[300] : palette[700]
  return {
    slug,
    title: `${occasion.title} (${variant.label})`,
    category: 'education',
    tags: ['certificate', 'diploma', 'award', 'a4', 'print', variant.id],
    description: `An A4 landscape ${occasion.title.toLowerCase()} with a fine double border and a seal: replace the name, the line and the signatures.`,
    build() {
      const doc = new DocBuilder(slug, { width: 1123, height: 794, unit: 'mm' })
      const p = doc.page('Certificate', { type: 'solid', color: bg })
      p.rect({ name: 'Outer frame', x: 36, y: 36, w: 1051, h: 722, fill: bg, stroke: accent, strokeWidth: 3 })
      p.rect({ name: 'Inner frame', x: 52, y: 52, w: 1019, h: 690, fill: bg, stroke: accent, strokeWidth: 1 })
      p.circle({ name: 'Seal', cx: 561, cy: 196, r: 52, fill: accent })
      p.text({ name: 'Seal star', x: 511, y: 158, w: 100, text: '★', font: 'inter', size: 52, color: bestOn(accent), on: accent, align: 'center', decorative: true })
      p.text({ name: 'Title', x: 100, y: 286, w: 923, text: occasion.title, font: 'playfair', size: 54, bold: true, color: ink, on: bg, align: 'center' })
      p.text({ name: 'Presented', x: 100, y: 386, w: 923, text: 'Proudly presented to', font: 'inter', size: 19, color: muted, on: bg, align: 'center', upper: true, spacing: 300 })
      p.text({ name: 'Recipient', x: 100, y: 440, w: 923, text: 'Amelia Laurent', font: 'greatVibes', size: 76, color: accent, on: bg, align: 'center' })
      p.line({ name: 'Name rule', x1: 362, y1: 556, x2: 761, y2: 556, color: accent, width: 1.5 })
      p.text({ name: 'Line', x: 190, y: 584, w: 743, text: occasion.line, font: 'lora', size: 20, italic: true, color: muted, on: bg, align: 'center', lh: 1.4 })
      p.text({ name: 'Date', x: 110, y: 668, w: 300, text: '18 October 2026', font: 'inter', size: 16, color: muted, on: bg })
      p.text({ name: 'Signature', x: 713, y: 652, w: 300, text: 'Studio Nova', font: 'greatVibes', size: 34, color: ink, on: bg, align: 'right' })
      p.text({ name: 'Signature role', x: 713, y: 700, w: 300, text: 'Director', font: 'inter', size: 14, color: muted, on: bg, align: 'right', upper: true, spacing: 200 })
      return doc
    },
  }
}

/** 6 formats x 8 themes x 3 styles + 18 resumes + 18 certificates = 180 designs. */
export const FACTORY_FORMAT_DESIGNS: readonly TemplateDesign[] = [
  ...FORMATS.flatMap((archetype, a) => THEMES.flatMap((theme, t) => VARIANTS.map((variant, v) => makeFormatDesign(archetype, theme, variant, 101 + a * 31 + t * 7 + v * 3)))),
  ...PROFESSIONS.flatMap((profession, i) => VARIANTS.map((variant, v) => makeResume(profession, variant, 211 + i * 13 + v * 5))),
  ...OCCASIONS.flatMap((occasion, i) => VARIANTS.map((variant, v) => makeCertificate(occasion, variant, 307 + i * 13 + v * 5))),
]
