import type { TemplateSummary } from '@/types/api'
import type { DoryDocument } from '@/types/document'

/**
 * The built-in template catalogue: JSON files the site build ships under
 * /templates-data (see vite.config). They are the fallback that keeps the
 * gallery alive on static deployments with no backend — the live API is
 * always preferred when it answers.
 */
export interface StaticTemplateEntry {
  slug: string
  title: string
  category: string
  tags: string[]
  description: string
  preset: string
  width: number
  height: number
  pageCount: number
  thumb: boolean
}

const CATEGORY_NAMES: Readonly<Record<string, string>> = {
  'social-media': 'Social Media',
  presentations: 'Presentations',
  posters: 'Posters',
  flyers: 'Flyers',
  invitations: 'Invitations',
  cards: 'Cards',
  resumes: 'Resumes',
  logos: 'Logos',
  marketing: 'Marketing',
  education: 'Education',
  business: 'Business',
  'photo-collage': 'Photo Collage',
  youtube: 'YouTube',
  print: 'Print',
}

export function categoryName(slug: string): string {
  return CATEGORY_NAMES[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function orientationOf(width: number, height: number): TemplateSummary['orientation'] {
  if (width === height) return 'square'
  return width > height ? 'landscape' : 'portrait'
}

/** Presents a static entry exactly like an API template, so cards and pages don't care where it came from. */
export function staticSummary(entry: StaticTemplateEntry): TemplateSummary {
  return {
    id: entry.slug,
    slug: entry.slug,
    title: entry.title,
    category: entry.category ? { id: entry.category, slug: entry.category, name: categoryName(entry.category) } : null,
    tags: entry.tags,
    width: entry.width,
    height: entry.height,
    orientation: orientationOf(entry.width, entry.height),
    preset: entry.preset,
    page_count: entry.pageCount,
    thumbnail_url: entry.thumb ? `/templates-data/thumbs/${entry.slug}.webp` : null,
    is_featured: false,
    use_count: 0,
    created_at: '',
  }
}

export interface StaticFilters {
  category?: string
  q?: string
  orientation?: TemplateSummary['orientation']
  preset?: string
}

/** The same filters the API applies, run locally over the built-in catalogue. */
export function filterStaticTemplates(entries: readonly StaticTemplateEntry[], filters: StaticFilters): StaticTemplateEntry[] {
  const words = (filters.q ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  return entries.filter((entry) => {
    if (filters.category && entry.category !== filters.category) return false
    if (filters.preset && entry.preset !== filters.preset) return false
    if (filters.orientation && orientationOf(entry.width, entry.height) !== filters.orientation) return false
    if (words.length > 0) {
      const haystack = `${entry.title} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase()
      if (!words.every((word) => haystack.includes(word))) return false
    }
    return true
  })
}

let catalogueCache: Promise<StaticTemplateEntry[] | null> | undefined

async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } })
    if (!response.ok) return null
    return await response.json().catch(() => null)
  } catch {
    return null // No static files here (or offline): the caller falls back gracefully.
  }
}

function isEntry(value: unknown): value is StaticTemplateEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return typeof entry.slug === 'string' && typeof entry.title === 'string' && typeof entry.width === 'number' && typeof entry.height === 'number'
}

/** The whole built-in catalogue, or null when this deployment doesn't ship one. Cached for the session. */
export function loadStaticCatalogue(): Promise<StaticTemplateEntry[] | null> {
  catalogueCache ??= (async () => {
    const data = await fetchJson('/templates-data/catalogue.json')
    if (!Array.isArray(data)) return null
    const entries = data.filter(isEntry)
    return entries.length > 0 ? entries : null
  })()
  return catalogueCache
}

/** One template's document for the local editor, or null when it isn't in the built-in catalogue. */
export async function loadStaticTemplate(slug: string): Promise<{ title: string; preset: string; document: DoryDocument } | null> {
  if (!/^[\w-]{1,120}$/.test(slug)) return null
  const catalogue = await loadStaticCatalogue()
  const entry = catalogue?.find((candidate) => candidate.slug === slug)
  if (catalogue && !entry) return null // The catalogue is authoritative: the slug isn't built in.
  const data = await fetchJson(`/templates-data/${encodeURIComponent(slug)}.json`)
  if (typeof data !== 'object' || data === null) return null
  const document = data as DoryDocument
  if (!Array.isArray(document.pages) || typeof document.width !== 'number') return null
  return { title: entry?.title ?? slug, preset: entry?.preset ?? '', document }
}
