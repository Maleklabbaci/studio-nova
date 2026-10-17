import {
  Briefcase,
  Clapperboard,
  CreditCard,
  FileText,
  Film,
  Image,
  Layout,
  Mail,
  Monitor,
  Newspaper,
  PartyPopper,
  Presentation,
  Printer,
  RectangleHorizontal,
  Smartphone,
  Square,
  type LucideIcon,
} from 'lucide-react'
import { MAX_DIMENSION_PX, type DocUnit } from '@/types/document'

export type PresetCategoryId = 'social' | 'presentation' | 'print' | 'documents' | 'video' | 'etc'

export interface PresetCategory {
  id: PresetCategoryId
  label: string
}

export interface SizePreset {
  id: string
  label: string
  /** Pixel size at 96 dpi (what the document stores). */
  width: number
  height: number
  /** Display unit for rulers and the size dialog. */
  unit: DocUnit
  category: PresetCategoryId
  icon: LucideIcon
}

export const PRESET_CATEGORIES: PresetCategory[] = [
  { id: 'social', label: 'Social media' },
  { id: 'presentation', label: 'Presentation' },
  { id: 'print', label: 'Print' },
  { id: 'documents', label: 'Documents' },
  { id: 'video', label: 'Video' },
  { id: 'etc', label: 'More' },
]

export const PX_PER_INCH = 96
const MM_PER_INCH = 25.4
export const MIN_DIMENSION_PX = 1
export const MAX_DIMENSION = MAX_DIMENSION_PX

export type CustomUnit = 'px' | 'mm' | 'cm' | 'in'
export const CUSTOM_UNITS: CustomUnit[] = ['px', 'mm', 'cm', 'in']

export function unitToPx(value: number, unit: CustomUnit): number {
  switch (unit) {
    case 'in':
      return value * PX_PER_INCH
    case 'cm':
      return (value / 2.54) * PX_PER_INCH
    case 'mm':
      return (value / MM_PER_INCH) * PX_PER_INCH
    default:
      return value
  }
}

export function pxToUnit(px: number, unit: CustomUnit): number {
  switch (unit) {
    case 'in':
      return px / PX_PER_INCH
    case 'cm':
      return (px / PX_PER_INCH) * 2.54
    case 'mm':
      return (px / PX_PER_INCH) * MM_PER_INCH
    default:
      return px
  }
}

/** Rounds to a sensible display precision for the unit (px whole, others 2 decimals). */
export function formatUnitValue(value: number, unit: CustomUnit): string {
  if (unit === 'px') return String(Math.round(value))
  return String(Math.round(value * 100) / 100)
}

const mm = (w: number, h: number) => ({ width: Math.round(unitToPx(w, 'mm')), height: Math.round(unitToPx(h, 'mm')), unit: 'mm' as const })
const inch = (w: number, h: number) => ({ width: Math.round(w * PX_PER_INCH), height: Math.round(h * PX_PER_INCH), unit: 'in' as const })
const px = (w: number, h: number) => ({ width: w, height: h, unit: 'px' as const })

export const SIZE_PRESETS: SizePreset[] = [
  { id: 'instagram-post', label: 'Instagram Post', ...px(1080, 1080), category: 'social', icon: Square },
  { id: 'instagram-story', label: 'Instagram Story', ...px(1080, 1920), category: 'social', icon: Smartphone },
  { id: 'instagram-reel', label: 'Instagram Reel', ...px(1080, 1920), category: 'social', icon: Clapperboard },
  { id: 'facebook-post', label: 'Facebook Post', ...px(1200, 630), category: 'social', icon: RectangleHorizontal },
  { id: 'facebook-cover', label: 'Facebook Cover', ...px(820, 312), category: 'social', icon: Image },
  { id: 'x-post', label: 'X (Twitter) Post', ...px(1600, 900), category: 'social', icon: RectangleHorizontal },
  { id: 'x-header', label: 'X (Twitter) Header', ...px(1500, 500), category: 'social', icon: Image },
  { id: 'linkedin-post', label: 'LinkedIn Post', ...px(1200, 627), category: 'social', icon: Briefcase },
  { id: 'linkedin-banner', label: 'LinkedIn Banner', ...px(1584, 396), category: 'social', icon: Image },
  { id: 'youtube-thumbnail', label: 'YouTube Thumbnail', ...px(1280, 720), category: 'social', icon: Film },
  { id: 'youtube-banner', label: 'YouTube Banner', ...px(2560, 1440), category: 'social', icon: Image },
  { id: 'pinterest-pin', label: 'Pinterest Pin', ...px(1000, 1500), category: 'social', icon: Layout },
  { id: 'tiktok-video', label: 'TikTok Video', ...px(1080, 1920), category: 'social', icon: Smartphone },
  { id: 'presentation', label: 'Presentation (16:9)', ...px(1920, 1080), category: 'presentation', icon: Presentation },
  { id: 'presentation-4-3', label: 'Presentation (4:3)', ...px(1024, 768), category: 'presentation', icon: Presentation },
  { id: 'a4', label: 'A4 Document', ...mm(210, 297), category: 'print', icon: FileText },
  { id: 'a5', label: 'A5', ...mm(148, 210), category: 'print', icon: FileText },
  { id: 'a3', label: 'A3', ...mm(297, 420), category: 'print', icon: FileText },
  { id: 'letter', label: 'US Letter', ...inch(8.5, 11), category: 'print', icon: FileText },
  { id: 'poster', label: 'Poster (18 × 24 in)', ...inch(18, 24), category: 'print', icon: Printer },
  { id: 'flyer', label: 'Flyer (5.5 × 8.5 in)', ...inch(5.5, 8.5), category: 'print', icon: Newspaper },
  { id: 'brochure', label: 'Brochure (11 × 8.5 in)', ...inch(11, 8.5), category: 'print', icon: Newspaper },
  { id: 'business-card', label: 'Business Card (3.5 × 2 in)', ...inch(3.5, 2), category: 'print', icon: CreditCard },
  { id: 'postcard', label: 'Postcard (6 × 4 in)', ...inch(6, 4), category: 'print', icon: Mail },
  { id: 'invitation', label: 'Invitation (5 × 7 in)', ...inch(5, 7), category: 'print', icon: PartyPopper },
  { id: 'greeting-card', label: 'Greeting Card (4.25 × 5.5 in)', ...inch(4.25, 5.5), category: 'print', icon: Mail },
  { id: 'resume', label: 'Resume', ...mm(210, 297), category: 'documents', icon: Briefcase },
  { id: 'letterhead', label: 'Letterhead', ...inch(8.5, 11), category: 'documents', icon: FileText },
  { id: 'video-1080p', label: 'Video (1080p)', ...px(1920, 1080), category: 'video', icon: Monitor },
  { id: 'video-4k', label: 'Video (4K)', ...px(3840, 2160), category: 'video', icon: Monitor },
  { id: 'logo', label: 'Logo (500 × 500)', ...px(500, 500), category: 'etc', icon: Square },
]

export const DEFAULT_PRESET_ID = 'instagram-post'

/** The handful offered as one-click chips on the landing hero and dashboard home. */
export const QUICK_PRESET_IDS = ['instagram-post', 'presentation', 'poster', 'a4', 'youtube-thumbnail', 'instagram-story', 'logo'] as const

const BY_ID = new Map(SIZE_PRESETS.map((preset) => [preset.id, preset]))

export function getPreset(id: string | null | undefined): SizePreset | undefined {
  return id ? BY_ID.get(id) : undefined
}

/** "Poster (18 × 24 in)" → { name: "Poster", detail: "18 × 24 in" }; a label without a size gets the pixel size as detail. */
export function presetParts(preset: SizePreset): { name: string; detail: string } {
  const match = /^(.*?)\s*\((.*)\)$/.exec(preset.label)
  return match ? { name: match[1], detail: match[2] } : { name: preset.label, detail: `${preset.width} × ${preset.height}` }
}

/** What a design is, for its card: the size preset's name ("Instagram Post"), or its pixel size. */
export function designKind(design: { preset?: string | null; width: number; height: number }): string {
  const preset = getPreset(design.preset)
  return preset ? presetParts(preset).name : `${design.width} × ${design.height} px`
}

export function presetsByCategory(): Array<{ category: PresetCategory; presets: SizePreset[] }> {
  return PRESET_CATEGORIES.map((category) => ({ category, presets: SIZE_PRESETS.filter((preset) => preset.category === category.id) })).filter((group) => group.presets.length > 0)
}

export type CustomSizeResult =
  | { ok: true; width: number; height: number; unit: DocUnit }
  | { ok: false; error: string; field: 'width' | 'height' }

/** Validates a custom size typed in `unit`; converts to whole pixels at 96 dpi (1 … 20000). */
export function parseCustomSize(input: { width: string | number; height: string | number; unit: CustomUnit }): CustomSizeResult {
  const parse = (raw: string | number): number => (typeof raw === 'number' ? raw : Number.parseFloat(raw.replace(',', '.')))
  const entries: Array<['width' | 'height', number]> = [
    ['width', parse(input.width)],
    ['height', parse(input.height)],
  ]
  const converted = { width: 0, height: 0 }
  for (const [field, value] of entries) {
    if (!Number.isFinite(value) || value <= 0) return { ok: false, field, error: `Enter a ${field} greater than 0.` }
    const pixels = Math.round(unitToPx(value, input.unit))
    if (pixels < MIN_DIMENSION_PX) return { ok: false, field, error: `The ${field} must be at least 1 px.` }
    if (pixels > MAX_DIMENSION) {
      const max = formatUnitValue(pxToUnit(MAX_DIMENSION, input.unit), input.unit)
      return { ok: false, field, error: `The ${field} can be at most ${max} ${input.unit} (${MAX_DIMENSION.toLocaleString('en-US')} px).` }
    }
    converted[field] = pixels
  }
  return { ok: true, width: converted.width, height: converted.height, unit: input.unit === 'cm' ? 'mm' : input.unit }
}

/** Value of the other side when the aspect ratio is locked. */
export function lockedCounterpart(changed: number, ratio: number, changedIs: 'width' | 'height'): number {
  if (!Number.isFinite(changed) || !Number.isFinite(ratio) || ratio <= 0) return changed
  return changedIs === 'width' ? changed / ratio : changed * ratio
}

export interface CreateSpec {
  kind: 'size'
  width: number
  height: number
  unit: DocUnit
  presetId?: string
  title: string
}

export interface TemplateSpec {
  kind: 'template'
  slug: string
}

/** Interprets `/create?preset=…` | `?w=&h=&unit=` | `?template=…`. Falls back to the default preset. */
export function resolveCreateSpec(params: URLSearchParams): CreateSpec | TemplateSpec {
  const slug = params.get('template')
  if (slug && /^[\w-]{1,120}$/.test(slug)) return { kind: 'template', slug }
  const fallback = getPreset(DEFAULT_PRESET_ID) as SizePreset
  const preset = getPreset(params.get('preset'))
  if (preset) return { kind: 'size', width: preset.width, height: preset.height, unit: preset.unit, presetId: preset.id, title: 'Untitled design' }
  const w = params.get('w')
  const h = params.get('h')
  if (w && h) {
    const unit = (CUSTOM_UNITS as string[]).includes(params.get('unit') ?? '') ? (params.get('unit') as CustomUnit) : 'px'
    const parsed = parseCustomSize({ width: w, height: h, unit })
    if (parsed.ok) return { kind: 'size', width: parsed.width, height: parsed.height, unit: parsed.unit, title: 'Untitled design' }
  }
  return { kind: 'size', width: fallback.width, height: fallback.height, unit: fallback.unit, presetId: fallback.id, title: 'Untitled design' }
}

export function createUrl(target: { presetId: string } | { width: number; height: number; unit: CustomUnit } | { template: string }): string {
  const params = new URLSearchParams()
  if ('presetId' in target) params.set('preset', target.presetId)
  else if ('template' in target) params.set('template', target.template)
  else {
    params.set('w', String(target.width))
    params.set('h', String(target.height))
    params.set('unit', target.unit)
  }
  return `/create?${params.toString()}`
}

/** "1080 × 1080 px", "210 × 297 mm", "8.5 × 11 in". */
export function describeSize(preset: Pick<SizePreset, 'width' | 'height' | 'unit'>): string {
  const unit: CustomUnit = preset.unit
  return `${formatUnitValue(pxToUnit(preset.width, unit), unit)} × ${formatUnitValue(pxToUnit(preset.height, unit), unit)} ${unit}`
}
