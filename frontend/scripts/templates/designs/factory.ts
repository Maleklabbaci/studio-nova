import { DocBuilder } from '../kit'
import { PALETTES } from '../palette'
import type { FontKey } from '../fontPalette'
import type { TemplateDesign } from '../registry'

/**
 * The template factory: a handful of proven layouts, crossed with business
 * themes, colour palettes and font pairings to produce the long tail of the
 * catalogue (5 layouts x 8 themes x 3 styles = 120 designs). Every generated
 * design goes through the same build as the hand-made starters — contrast
 * is checked, ids are stable, and `templates:build` renders its thumbnail.
 * Texts are short on purpose: they are placeholders a user replaces, and
 * the layout — not the wording — is what a template sells.
 */

export interface Theme {
  id: string
  brand: string
  headline: string
  sub: string
  cta: string
  badge: string
  quote: string
  event: string
  date: string
  place: string
  video: string
  videoTag: string
  tags: string[]
}

export const THEMES: readonly Theme[] = [
  {
    id: 'coffee-shop', brand: 'Maison Café', headline: 'Fresh croissants, every morning', sub: 'Baked at dawn, served warm all day.', cta: 'Order ahead', badge: '-20%',
    quote: 'Life begins after coffee.', event: 'Latte art night', date: 'Fri 18 Oct · 19:00', place: 'Maison Café, rue des Fleurs', video: 'Inside our roastery', videoTag: 'BEHIND THE SCENES', tags: ['coffee', 'cafe', 'bakery', 'food'],
  },
  {
    id: 'fashion', brand: 'Atelier Lina', headline: 'The autumn collection is here', sub: 'Soft layers, honest fabrics, made to last.', cta: 'Shop the look', badge: 'NEW',
    quote: 'Style is a way to say who you are.', event: 'Autumn trunk show', date: 'Sat 26 Oct · 11:00', place: 'Atelier Lina, Old Town', video: 'Autumn lookbook 2026', videoTag: 'LOOKBOOK', tags: ['fashion', 'boutique', 'clothing', 'style'],
  },
  {
    id: 'fitness', brand: 'Pulse Gym', headline: 'Stronger every single week', sub: 'Coaching, community and real progress.', cta: 'Try a free week', badge: 'FREE',
    quote: 'Your only limit is you.', event: 'Open training day', date: 'Sun 3 Nov · 09:00', place: 'Pulse Gym, North Gate', video: '7-day strength plan', videoTag: 'WORKOUT', tags: ['gym', 'fitness', 'sport', 'health'],
  },
  {
    id: 'beauty', brand: 'Glow Studio', headline: 'Your skin, but luminous', sub: 'Gentle care rituals, visible results.', cta: 'Book a session', badge: '-30%',
    quote: 'Beauty begins with care.', event: 'Glow evening', date: 'Thu 7 Nov · 18:30', place: 'Glow Studio, Centre', video: 'My evening routine', videoTag: 'ROUTINE', tags: ['beauty', 'salon', 'skincare', 'spa'],
  },
  {
    id: 'restaurant', brand: 'Saveurs', headline: 'Taste the season, fresh daily', sub: 'Local produce, recipes that change weekly.', cta: 'Reserve a table', badge: 'NEW MENU',
    quote: 'Good food is a celebration.', event: 'Harvest dinner', date: 'Fri 15 Nov · 20:00', place: 'Saveurs, Market Square', video: 'Meet our chef', videoTag: 'KITCHEN DIARY', tags: ['restaurant', 'food', 'dinner', 'chef'],
  },
  {
    id: 'real-estate', brand: 'Horizon Immobilier', headline: 'Homes that feel like you', sub: 'Visit this week, move in this season.', cta: 'Book a visit', badge: 'EXCLUSIVE',
    quote: 'Home is where the story begins.', event: 'Open house weekend', date: 'Sat 23 Nov · 10:00', place: 'Horizon, Lake District', video: 'Tour this family home', videoTag: 'HOME TOUR', tags: ['real estate', 'house', 'property', 'home'],
  },
  {
    id: 'music', brand: 'Nébula Live', headline: 'One night, pure energy', sub: 'Live sets, warm lights, loud hearts.', cta: 'Get tickets', badge: 'LIVE',
    quote: 'Music is the shortest route to joy.', event: 'Nébula Live session', date: 'Sat 30 Nov · 21:00', place: 'Le Hangar, Port District', video: 'Live at Le Hangar', videoTag: 'LIVE SESSION', tags: ['music', 'concert', 'event', 'party'],
  },
  {
    id: 'bakery', brand: 'Four Doré', headline: 'Warm bread, happy mornings', sub: 'Sourdough, brioche and cakes to order.', cta: 'See today’s menu', badge: 'FRESH',
    quote: 'Happiness smells like warm bread.', event: 'Baking workshop', date: 'Wed 4 Dec · 15:00', place: 'Four Doré, Bakery Lane', video: 'Baking with us', videoTag: 'WORKSHOP', tags: ['bakery', 'bread', 'pastry', 'food'],
  },
]

export type VariantId = 'bold' | 'light' | 'pop'
export const VARIANTS: readonly { id: VariantId; label: string }[] = [
  { id: 'bold', label: 'Bold' },
  { id: 'light', label: 'Light' },
  { id: 'pop', label: 'Pop' },
]

export const PALETTE_KEYS = Object.keys(PALETTES) as (keyof typeof PALETTES)[]
const HEADING_FONTS: readonly FontKey[] = ['anton', 'montserrat', 'playfair', 'bebas', 'poppins', 'oswald']
const BODY_FONTS: readonly FontKey[] = ['inter', 'manrope', 'dmSans', 'lora', 'josefin']

export interface Style {
  bg: string
  ink: string
  soft: string
  accent: string
  pill: string
  pillText: string
  card: string
}

export function styleFor(palette: (typeof PALETTES)[keyof typeof PALETTES], variant: VariantId): Style {
  switch (variant) {
    case 'bold':
      return { bg: palette[950], ink: palette[50], soft: palette[200], accent: palette[500], pill: palette[500], pillText: '#ffffff', card: palette[900] }
    case 'light':
      return { bg: palette[50], ink: palette[950], soft: palette[800], accent: palette[600], pill: palette[700], pillText: palette[50], card: palette[100] }
    case 'pop':
      return { bg: palette[600], ink: '#ffffff', soft: palette[100], accent: palette[950], pill: palette[950], pillText: palette[50], card: palette[700] }
  }
}

export function fontsFor(seed: number): { heading: FontKey; body: FontKey } {
  return { heading: HEADING_FONTS[seed % HEADING_FONTS.length], body: BODY_FONTS[seed % BODY_FONTS.length] }
}

/** Anton/Bebas ship a single weight: never ask them for bold. */
export function headingBold(font: FontKey): boolean {
  return font !== 'anton' && font !== 'bebas'
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export type Build = (doc: DocBuilder, theme: Theme, style: Style, fonts: { heading: FontKey; body: FontKey }) => void

const promoPost: Build = (doc, theme, s, f) => {
  const p = doc.page('Promo', { type: 'solid', color: s.bg })
  // Tucked into the top-right corner but fully in page: every object must
  // stay inside its page (the engine clamps nothing; Magic Resize and the
  // template tests require in-bounds objects).
  p.circle({ name: 'Accent disc', cx: 780, cy: 290, r: 280, fill: s.accent, opacity: 0.9 })
  p.circle({ name: 'Small disc', cx: 120, cy: 920, r: 120, fill: s.accent, opacity: 0.55 })
  p.placeholder({ name: 'Photo', x: 590, y: 330, w: 400, h: 470, mask: 'rounded', maskRadius: 0.08 })
  p.text({ name: 'Brand', x: 80, y: 90, w: 700, text: theme.brand, font: f.body, size: 30, bold: true, color: s.soft, on: s.bg, upper: true, spacing: 240 })
  p.text({ name: 'Headline', x: 76, y: 200, w: 620, text: theme.headline, font: f.heading, size: 84, bold: headingBold(f.heading), color: s.ink, on: s.bg, lh: 1.05 })
  p.text({ name: 'Subline', x: 80, y: 560, w: 480, text: theme.sub, font: f.body, size: 34, color: s.soft, on: s.bg, lh: 1.25 })
  p.circle({ name: 'Badge disc', cx: 205, cy: 775, r: 88, fill: s.pill })
  p.text({ name: 'Badge', x: 105, y: 745, w: 200, text: theme.badge, font: f.heading, size: 34, bold: headingBold(f.heading), color: s.pillText, on: s.pill, align: 'center' })
  p.rect({ name: 'Button', x: 360, y: 720, w: 330, h: 104, fill: s.pill, radius: 52 })
  p.text({ name: 'Button label', x: 360, y: 752, w: 330, text: theme.cta, font: f.body, size: 30, bold: true, color: s.pillText, on: s.pill, align: 'center' })
  p.text({ name: 'Handle', x: 80, y: 985, w: 600, text: `@${slugify(theme.brand)}`, font: f.body, size: 24, color: s.soft, on: s.bg })
}

const quotePost: Build = (doc, theme, s, f) => {
  const p = doc.page('Quote', { type: 'solid', color: s.bg })
  p.line({ name: 'Rule', x1: 440, y1: 240, x2: 640, y2: 240, color: s.accent, width: 6 })
  p.text({ name: 'Quote', x: 140, y: 330, w: 800, text: theme.quote, font: f.heading === 'anton' || f.heading === 'bebas' ? 'playfair' : f.heading, size: 72, color: s.ink, on: s.bg, align: 'center', lh: 1.15 })
  p.text({ name: 'Brand', x: 0, y: 760, w: 1080, text: theme.brand, font: f.body, size: 26, bold: true, color: s.soft, on: s.bg, align: 'center', upper: true, spacing: 320 })
  p.text({ name: 'Handle', x: 0, y: 975, w: 1080, text: `@${slugify(theme.brand)}`, font: f.body, size: 24, color: s.soft, on: s.bg, align: 'center' })
}

const eventStory: Build = (doc, theme, s, f) => {
  const p = doc.page('Story', { type: 'solid', color: s.bg })
  p.placeholder({ name: 'Photo', x: 70, y: 120, w: 940, h: 760, mask: 'rounded', maskRadius: 0.05 })
  p.text({ name: 'Kicker', x: 80, y: 960, w: 900, text: 'You are invited', font: f.body, size: 32, bold: true, color: s.soft, on: s.bg, upper: true, spacing: 300 })
  p.text({ name: 'Event', x: 76, y: 1030, w: 930, text: theme.event, font: f.heading, size: 96, bold: headingBold(f.heading), color: s.ink, on: s.bg, lh: 1.05 })
  p.rect({ name: 'Info card', x: 80, y: 1420, w: 920, h: 200, fill: s.card, radius: 28 })
  p.text({ name: 'Date', x: 120, y: 1460, w: 840, text: theme.date, font: f.body, size: 38, bold: true, color: s.ink, on: s.card })
  p.text({ name: 'Place', x: 120, y: 1530, w: 840, text: theme.place, font: f.body, size: 32, color: s.soft, on: s.card })
  p.rect({ name: 'Button', x: 80, y: 1700, w: 430, h: 112, fill: s.pill, radius: 56 })
  p.text({ name: 'Button label', x: 80, y: 1738, w: 430, text: theme.cta, font: f.body, size: 32, bold: true, color: s.pillText, on: s.pill, align: 'center' })
}

const eventPoster: Build = (doc, theme, s, f) => {
  const p = doc.page('Poster', { type: 'solid', color: s.bg })
  p.rect({ name: 'Top band', x: 0, y: 0, w: 1080, h: 150, fill: s.accent })
  p.text({ name: 'Brand', x: 0, y: 52, w: 1080, text: theme.brand, font: f.body, size: 34, bold: true, color: s.pillText === '#ffffff' ? '#ffffff' : s.soft, on: s.accent, align: 'center', upper: true, spacing: 300, decorative: true })
  p.placeholder({ name: 'Photo', x: 90, y: 230, w: 900, h: 560, mask: 'rounded', maskRadius: 0.04 })
  p.text({ name: 'Event', x: 86, y: 860, w: 910, text: theme.event, font: f.heading, size: 92, bold: headingBold(f.heading), color: s.ink, on: s.bg, lh: 1.05 })
  p.line({ name: 'Rule', x1: 90, y1: 1090, x2: 420, y2: 1090, color: s.accent, width: 7 })
  p.text({ name: 'Date', x: 90, y: 1130, w: 900, text: theme.date, font: f.body, size: 40, bold: true, color: s.ink, on: s.bg })
  p.text({ name: 'Place', x: 90, y: 1200, w: 900, text: theme.place, font: f.body, size: 34, color: s.soft, on: s.bg })
  p.text({ name: 'Foot', x: 90, y: 1330, w: 900, text: `${theme.cta} · @${slugify(theme.brand)}`, font: f.body, size: 28, color: s.soft, on: s.bg })
}

const youtubeThumb: Build = (doc, theme, s, f) => {
  const p = doc.page('Thumbnail', { type: 'solid', color: s.bg })
  p.circle({ name: 'Accent disc', cx: 1035, cy: 245, r: 225, fill: s.accent, opacity: 0.85 })
  p.placeholder({ name: 'Photo', x: 790, y: 90, w: 420, h: 540, mask: 'rounded', maskRadius: 0.07 })
  p.rect({ name: 'Tag chip', x: 70, y: 80, w: 360, h: 74, fill: s.pill, radius: 37 })
  p.text({ name: 'Tag', x: 70, y: 99, w: 360, text: theme.videoTag, font: f.body, size: 26, bold: true, color: s.pillText, on: s.pill, align: 'center', spacing: 120 })
  p.text({ name: 'Title', x: 66, y: 210, w: 680, text: theme.video, font: f.heading, size: 92, bold: headingBold(f.heading), color: s.ink, on: s.bg, lh: 1.02 })
  p.text({ name: 'Brand', x: 70, y: 620, w: 600, text: theme.brand, font: f.body, size: 30, bold: true, color: s.soft, on: s.bg, upper: true, spacing: 220 })
}

const ARCHETYPES: readonly { id: string; label: string; category: string; preset?: string; width: number; height: number; tags: string[]; build: Build }[] = [
  { id: 'promo', label: 'Promo post', category: 'social-media', preset: 'instagram-post', width: 1080, height: 1080, tags: ['promo', 'instagram', 'post', 'sale'], build: promoPost },
  { id: 'quote', label: 'Quote post', category: 'social-media', preset: 'instagram-post', width: 1080, height: 1080, tags: ['quote', 'instagram', 'post', 'inspiration'], build: quotePost },
  { id: 'story', label: 'Event story', category: 'social-media', preset: 'instagram-story', width: 1080, height: 1920, tags: ['story', 'event', 'instagram', 'invitation'], build: eventStory },
  { id: 'poster', label: 'Event poster', category: 'posters', width: 1080, height: 1440, tags: ['poster', 'event', 'print'], build: eventPoster },
  { id: 'youtube', label: 'YouTube thumbnail', category: 'youtube', preset: 'youtube-thumbnail', width: 1280, height: 720, tags: ['youtube', 'thumbnail', 'video'], build: youtubeThumb },
]

function makeDesign(archetype: (typeof ARCHETYPES)[number], theme: Theme, variant: (typeof VARIANTS)[number], seed: number): TemplateDesign {
  const palette = PALETTES[PALETTE_KEYS[seed % PALETTE_KEYS.length]]
  const style = styleFor(palette, variant.id)
  const fonts = fontsFor(seed)
  const slug = `factory-${archetype.id}-${theme.id}-${variant.id}`
  return {
    slug,
    title: `${theme.brand} — ${archetype.label} (${variant.label})`,
    category: archetype.category,
    tags: [...archetype.tags, ...theme.tags, variant.id],
    description: `A ${variant.label.toLowerCase()} ${archetype.label.toLowerCase()} for ${theme.brand}: ${theme.headline.charAt(0).toLowerCase()}${theme.headline.slice(1)} Replace the photo slot, wording and colours to make it yours.`,
    ...(archetype.preset ? { preset: archetype.preset } : {}),
    build() {
      const doc = new DocBuilder(slug, { width: archetype.width, height: archetype.height, unit: 'px', ...(archetype.preset ? { presetId: archetype.preset } : {}) })
      archetype.build(doc, theme, style, fonts)
      return doc
    },
  }
}

/** 5 layouts x 8 themes x 3 styles, in a stable order. */
export const FACTORY_DESIGNS: readonly TemplateDesign[] = ARCHETYPES.flatMap((archetype, a) =>
  THEMES.flatMap((theme, t) => VARIANTS.map((variant, v) => makeDesign(archetype, theme, variant, a * 31 + t * 7 + v * 3))),
)
