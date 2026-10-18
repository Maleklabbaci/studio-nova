import { FACTORY_DESIGNS, styleFor } from './designs/factory'
import { FACTORY_FORMAT_DESIGNS } from './designs/factoryFormats'
import { DESIGNS } from './designs'
import { contrast } from './kit'
import { PALETTES } from './palette'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

describe('template factory', () => {
  it('generates 120 designs: 5 layouts x 8 themes x 3 styles', () => {
    expect(FACTORY_DESIGNS).toHaveLength(120)
    for (const id of ['promo', 'quote', 'story', 'poster', 'youtube']) {
      expect(FACTORY_DESIGNS.filter((d) => d.slug.startsWith(`factory-${id}-`))).toHaveLength(24)
    }
  })

  it('has unique, valid slugs and titles, with no clash against the hand-made starters', () => {
    const slugs = FACTORY_DESIGNS.map((d) => d.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(new Set(FACTORY_DESIGNS.map((d) => d.title)).size).toBe(FACTORY_DESIGNS.length)
    for (const slug of slugs) expect(slug).toMatch(SLUG)
    const starter = new Set(DESIGNS.slice(0, 10).map((d) => d.slug))
    for (const slug of slugs) expect(starter.has(slug)).toBe(false)
    expect(DESIGNS).toHaveLength(310)
  })

  it('carries the catalogue facts the gallery needs', () => {
    for (const design of FACTORY_DESIGNS) {
      expect(design.title.length).toBeGreaterThan(3)
      expect(design.description.length).toBeGreaterThan(20)
      expect(design.tags.length).toBeGreaterThanOrEqual(5)
      expect(['social-media', 'posters', 'youtube']).toContain(design.category)
      expect(typeof design.build).toBe('function')
    }
  })
  it('keeps every text colour readable in all 33 palette x style combinations', () => {
    // Same thresholds as kit's text(): 4.5 for body text, 3 for large text.
    for (const palette of Object.values(PALETTES)) {
      for (const variant of ['bold', 'light', 'pop'] as const) {
        const s = styleFor(palette, variant)
        // Every factory text is set large (>= 24 px), where the kit requires 3:1.
        expect(contrast(s.ink, s.bg)).toBeGreaterThanOrEqual(3)
        expect(contrast(s.soft, s.bg)).toBeGreaterThanOrEqual(3)
        expect(contrast(s.ink, s.card)).toBeGreaterThanOrEqual(3)
        expect(contrast(s.soft, s.card)).toBeGreaterThanOrEqual(3)
        expect(contrast(s.pillText, s.pill)).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

describe('template formats factory', () => {
  it('generates 180 designs: 6 formats x 8 themes x 3 styles, plus resumes and certificates', () => {
    expect(FACTORY_FORMAT_DESIGNS).toHaveLength(180)
    for (const id of ['facebook', 'slide', 'flyer', 'invitation', 'card', 'logo']) {
      expect(FACTORY_FORMAT_DESIGNS.filter((d) => d.slug.startsWith(`factory-${id}-`))).toHaveLength(24)
    }
    expect(FACTORY_FORMAT_DESIGNS.filter((d) => d.slug.startsWith('factory-resume-'))).toHaveLength(18)
    expect(FACTORY_FORMAT_DESIGNS.filter((d) => d.slug.startsWith('factory-certificate-'))).toHaveLength(18)
  })

  it('uses the exact preset sizes the create flow offers', () => {
    const byPreset = new Map<string, number>()
    for (const design of FACTORY_FORMAT_DESIGNS) {
      if (design.preset) byPreset.set(design.preset, (byPreset.get(design.preset) ?? 0) + 1)
    }
    expect(Object.fromEntries(byPreset)).toEqual({
      'facebook-post': 24,
      presentation: 24,
      flyer: 24,
      invitation: 24,
      'business-card': 24,
      logo: 24,
      resume: 18,
    })
  })

  it('has unique slugs across the whole catalogue and valid categories', () => {
    const all = DESIGNS.map((d) => d.slug)
    expect(new Set(all).size).toBe(all.length)
    for (const design of FACTORY_FORMAT_DESIGNS) {
      expect(design.slug).toMatch(SLUG)
      expect(['social-media', 'presentations', 'flyers', 'invitations', 'cards', 'logos', 'resumes', 'education']).toContain(design.category)
    }
  })

  it('keeps the resume accent readable on white for small text', () => {
    for (const palette of Object.values(PALETTES)) {
      expect(contrast(palette[700], '#ffffff')).toBeGreaterThanOrEqual(4.5)
    }
  })
})
