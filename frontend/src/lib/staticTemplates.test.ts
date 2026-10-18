import { categoryName, filterStaticTemplates, staticSummary, type StaticTemplateEntry } from './staticTemplates'

const entry = (overrides: Partial<StaticTemplateEntry> = {}): StaticTemplateEntry => ({
  slug: 'factory-promo-coffee-shop-bold',
  title: 'Maison Café — Promo post (Bold)',
  category: 'social-media',
  tags: ['promo', 'instagram', 'coffee'],
  description: 'A bold promo post for Maison Café.',
  preset: 'instagram-post',
  width: 1080,
  height: 1080,
  pageCount: 1,
  thumb: true,
  ...overrides,
})

describe('static template catalogue', () => {
  it('presents an entry like an API template, thumbnail included', () => {
    const summary = staticSummary(entry())
    expect(summary.slug).toBe('factory-promo-coffee-shop-bold')
    expect(summary.category).toEqual({ id: 'social-media', slug: 'social-media', name: 'Social Media' })
    expect(summary.orientation).toBe('square')
    expect(summary.thumbnail_url).toBe('/templates-data/thumbs/factory-promo-coffee-shop-bold.webp')
    expect(staticSummary(entry({ thumb: false })).thumbnail_url).toBeNull()
    expect(staticSummary(entry({ width: 1920, height: 1080 })).orientation).toBe('landscape')
    expect(staticSummary(entry({ width: 794, height: 1123 })).orientation).toBe('portrait')
  })

  it('names categories the way the backend does', () => {
    expect(categoryName('youtube')).toBe('YouTube')
    expect(categoryName('photo-collage')).toBe('Photo Collage')
    expect(categoryName('some-new-thing')).toBe('Some New Thing')
  })

  it('filters by category, preset, orientation and every search word', () => {
    const entries = [
      entry(),
      entry({ slug: 'cv', title: 'Designer resume', category: 'resumes', preset: 'resume', width: 794, height: 1123, tags: ['cv', 'job'], description: 'A clean A4 resume.' }),
      entry({ slug: 'slide', title: 'Pitch slide', category: 'presentations', preset: 'presentation', width: 1920, height: 1080, tags: ['deck'], description: 'A wide pitch deck slide.' }),
    ]
    expect(filterStaticTemplates(entries, {}).map((e) => e.slug)).toHaveLength(3)
    expect(filterStaticTemplates(entries, { category: 'resumes' }).map((e) => e.slug)).toEqual(['cv'])
    expect(filterStaticTemplates(entries, { preset: 'instagram-post' }).map((e) => e.slug)).toEqual(['factory-promo-coffee-shop-bold'])
    expect(filterStaticTemplates(entries, { orientation: 'landscape' }).map((e) => e.slug)).toEqual(['slide'])
    expect(filterStaticTemplates(entries, { q: 'promo café' }).map((e) => e.slug)).toEqual(['factory-promo-coffee-shop-bold'])
    expect(filterStaticTemplates(entries, { q: 'promo resume' })).toHaveLength(0)
  })
})
