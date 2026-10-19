/**
 * The generated starter templates (`backend/data/templates/*.json`) loaded through the editor's own document path:
 * `migrateDocument`, `deserializeObjects` and `serializeObjects`. They must open without a console error, rebuild every
 * object, round-trip, and survive being applied to a design of another size.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StaticCanvas } from 'fabric'
import { createBlankDocument } from '@/lib/document'
import type { DocObject, DoryDocument, SlotSpec } from '@/types/document'
import { installImageStub } from '@/editor/test/imageStub'
import { migrateDocument } from '@/editor/engine/migrations'
import { rotatedBounds } from '@/editor/engine/geometry'
import { objectCenter } from '@/editor/engine/magicResize'
import { type LoadContext, deserializeObjects, serializeObjects } from '@/editor/engine/serialization'
import { applyTemplate } from '@/editor/panels/templateOps'
import { FONT_PICKS, type FontPick } from './fontPalette'

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/data/templates')
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')) as { templates: { slug: string; fonts: string[] }[] }
const documents = manifest.templates.map((entry) => ({ ...entry, doc: JSON.parse(readFileSync(join(directory, `${entry.slug}.json`), 'utf8')) as DoryDocument }))

const context: LoadContext = { resolveSrc: async (src) => src, ensureFonts: async () => undefined }

const walk = (objects: readonly DocObject[]): DocObject[] => objects.flatMap((o) => [o, ...(Array.isArray(o.objects) ? walk(o.objects as DocObject[]) : [])])

async function rebuild(objects: DocObject[], width: number, height: number): Promise<{ canvas: StaticCanvas; out: DocObject[] }> {
  const canvas = new StaticCanvas(document.createElement('canvas'), { width, height, renderOnAddRemove: false })
  canvas.add(...(await deserializeObjects(objects, context)))
  return { canvas, out: serializeObjects(canvas) }
}

describe('starter templates', () => {
  let restoreImages: () => void
  beforeAll(() => {
    restoreImages = installImageStub()
  })
  afterAll(() => restoreImages())

  it('are the ten the manifest lists', () => {
    expect(documents.map((d) => d.slug)).toMatchInlineSnapshot(`
      [
        "bold-sale-announcement",
        "serif-quote-card",
        "rooftop-event-story",
        "modern-pitch-deck",
        "night-bloom-concert-poster",
        "grand-opening-flyer",
        "botanical-celebration-invitation",
        "modern-resume",
        "bold-youtube-thumbnail",
        "clean-business-card",
        "factory-promo-coffee-shop-bold",
        "factory-promo-coffee-shop-light",
        "factory-promo-coffee-shop-pop",
        "factory-promo-fashion-bold",
        "factory-promo-fashion-light",
        "factory-promo-fashion-pop",
        "factory-promo-fitness-bold",
        "factory-promo-fitness-light",
        "factory-promo-fitness-pop",
        "factory-promo-beauty-bold",
        "factory-promo-beauty-light",
        "factory-promo-beauty-pop",
        "factory-promo-restaurant-bold",
        "factory-promo-restaurant-light",
        "factory-promo-restaurant-pop",
        "factory-promo-real-estate-bold",
        "factory-promo-real-estate-light",
        "factory-promo-real-estate-pop",
        "factory-promo-music-bold",
        "factory-promo-music-light",
        "factory-promo-music-pop",
        "factory-promo-bakery-bold",
        "factory-promo-bakery-light",
        "factory-promo-bakery-pop",
        "factory-quote-coffee-shop-bold",
        "factory-quote-coffee-shop-light",
        "factory-quote-coffee-shop-pop",
        "factory-quote-fashion-bold",
        "factory-quote-fashion-light",
        "factory-quote-fashion-pop",
        "factory-quote-fitness-bold",
        "factory-quote-fitness-light",
        "factory-quote-fitness-pop",
        "factory-quote-beauty-bold",
        "factory-quote-beauty-light",
        "factory-quote-beauty-pop",
        "factory-quote-restaurant-bold",
        "factory-quote-restaurant-light",
        "factory-quote-restaurant-pop",
        "factory-quote-real-estate-bold",
        "factory-quote-real-estate-light",
        "factory-quote-real-estate-pop",
        "factory-quote-music-bold",
        "factory-quote-music-light",
        "factory-quote-music-pop",
        "factory-quote-bakery-bold",
        "factory-quote-bakery-light",
        "factory-quote-bakery-pop",
        "factory-story-coffee-shop-bold",
        "factory-story-coffee-shop-light",
        "factory-story-coffee-shop-pop",
        "factory-story-fashion-bold",
        "factory-story-fashion-light",
        "factory-story-fashion-pop",
        "factory-story-fitness-bold",
        "factory-story-fitness-light",
        "factory-story-fitness-pop",
        "factory-story-beauty-bold",
        "factory-story-beauty-light",
        "factory-story-beauty-pop",
        "factory-story-restaurant-bold",
        "factory-story-restaurant-light",
        "factory-story-restaurant-pop",
        "factory-story-real-estate-bold",
        "factory-story-real-estate-light",
        "factory-story-real-estate-pop",
        "factory-story-music-bold",
        "factory-story-music-light",
        "factory-story-music-pop",
        "factory-story-bakery-bold",
        "factory-story-bakery-light",
        "factory-story-bakery-pop",
        "factory-poster-coffee-shop-bold",
        "factory-poster-coffee-shop-light",
        "factory-poster-coffee-shop-pop",
        "factory-poster-fashion-bold",
        "factory-poster-fashion-light",
        "factory-poster-fashion-pop",
        "factory-poster-fitness-bold",
        "factory-poster-fitness-light",
        "factory-poster-fitness-pop",
        "factory-poster-beauty-bold",
        "factory-poster-beauty-light",
        "factory-poster-beauty-pop",
        "factory-poster-restaurant-bold",
        "factory-poster-restaurant-light",
        "factory-poster-restaurant-pop",
        "factory-poster-real-estate-bold",
        "factory-poster-real-estate-light",
        "factory-poster-real-estate-pop",
        "factory-poster-music-bold",
        "factory-poster-music-light",
        "factory-poster-music-pop",
        "factory-poster-bakery-bold",
        "factory-poster-bakery-light",
        "factory-poster-bakery-pop",
        "factory-youtube-coffee-shop-bold",
        "factory-youtube-coffee-shop-light",
        "factory-youtube-coffee-shop-pop",
        "factory-youtube-fashion-bold",
        "factory-youtube-fashion-light",
        "factory-youtube-fashion-pop",
        "factory-youtube-fitness-bold",
        "factory-youtube-fitness-light",
        "factory-youtube-fitness-pop",
        "factory-youtube-beauty-bold",
        "factory-youtube-beauty-light",
        "factory-youtube-beauty-pop",
        "factory-youtube-restaurant-bold",
        "factory-youtube-restaurant-light",
        "factory-youtube-restaurant-pop",
        "factory-youtube-real-estate-bold",
        "factory-youtube-real-estate-light",
        "factory-youtube-real-estate-pop",
        "factory-youtube-music-bold",
        "factory-youtube-music-light",
        "factory-youtube-music-pop",
        "factory-youtube-bakery-bold",
        "factory-youtube-bakery-light",
        "factory-youtube-bakery-pop",
        "factory-facebook-coffee-shop-bold",
        "factory-facebook-coffee-shop-light",
        "factory-facebook-coffee-shop-pop",
        "factory-facebook-fashion-bold",
        "factory-facebook-fashion-light",
        "factory-facebook-fashion-pop",
        "factory-facebook-fitness-bold",
        "factory-facebook-fitness-light",
        "factory-facebook-fitness-pop",
        "factory-facebook-beauty-bold",
        "factory-facebook-beauty-light",
        "factory-facebook-beauty-pop",
        "factory-facebook-restaurant-bold",
        "factory-facebook-restaurant-light",
        "factory-facebook-restaurant-pop",
        "factory-facebook-real-estate-bold",
        "factory-facebook-real-estate-light",
        "factory-facebook-real-estate-pop",
        "factory-facebook-music-bold",
        "factory-facebook-music-light",
        "factory-facebook-music-pop",
        "factory-facebook-bakery-bold",
        "factory-facebook-bakery-light",
        "factory-facebook-bakery-pop",
        "factory-slide-coffee-shop-bold",
        "factory-slide-coffee-shop-light",
        "factory-slide-coffee-shop-pop",
        "factory-slide-fashion-bold",
        "factory-slide-fashion-light",
        "factory-slide-fashion-pop",
        "factory-slide-fitness-bold",
        "factory-slide-fitness-light",
        "factory-slide-fitness-pop",
        "factory-slide-beauty-bold",
        "factory-slide-beauty-light",
        "factory-slide-beauty-pop",
        "factory-slide-restaurant-bold",
        "factory-slide-restaurant-light",
        "factory-slide-restaurant-pop",
        "factory-slide-real-estate-bold",
        "factory-slide-real-estate-light",
        "factory-slide-real-estate-pop",
        "factory-slide-music-bold",
        "factory-slide-music-light",
        "factory-slide-music-pop",
        "factory-slide-bakery-bold",
        "factory-slide-bakery-light",
        "factory-slide-bakery-pop",
        "factory-flyer-coffee-shop-bold",
        "factory-flyer-coffee-shop-light",
        "factory-flyer-coffee-shop-pop",
        "factory-flyer-fashion-bold",
        "factory-flyer-fashion-light",
        "factory-flyer-fashion-pop",
        "factory-flyer-fitness-bold",
        "factory-flyer-fitness-light",
        "factory-flyer-fitness-pop",
        "factory-flyer-beauty-bold",
        "factory-flyer-beauty-light",
        "factory-flyer-beauty-pop",
        "factory-flyer-restaurant-bold",
        "factory-flyer-restaurant-light",
        "factory-flyer-restaurant-pop",
        "factory-flyer-real-estate-bold",
        "factory-flyer-real-estate-light",
        "factory-flyer-real-estate-pop",
        "factory-flyer-music-bold",
        "factory-flyer-music-light",
        "factory-flyer-music-pop",
        "factory-flyer-bakery-bold",
        "factory-flyer-bakery-light",
        "factory-flyer-bakery-pop",
        "factory-invitation-coffee-shop-bold",
        "factory-invitation-coffee-shop-light",
        "factory-invitation-coffee-shop-pop",
        "factory-invitation-fashion-bold",
        "factory-invitation-fashion-light",
        "factory-invitation-fashion-pop",
        "factory-invitation-fitness-bold",
        "factory-invitation-fitness-light",
        "factory-invitation-fitness-pop",
        "factory-invitation-beauty-bold",
        "factory-invitation-beauty-light",
        "factory-invitation-beauty-pop",
        "factory-invitation-restaurant-bold",
        "factory-invitation-restaurant-light",
        "factory-invitation-restaurant-pop",
        "factory-invitation-real-estate-bold",
        "factory-invitation-real-estate-light",
        "factory-invitation-real-estate-pop",
        "factory-invitation-music-bold",
        "factory-invitation-music-light",
        "factory-invitation-music-pop",
        "factory-invitation-bakery-bold",
        "factory-invitation-bakery-light",
        "factory-invitation-bakery-pop",
        "factory-card-coffee-shop-bold",
        "factory-card-coffee-shop-light",
        "factory-card-coffee-shop-pop",
        "factory-card-fashion-bold",
        "factory-card-fashion-light",
        "factory-card-fashion-pop",
        "factory-card-fitness-bold",
        "factory-card-fitness-light",
        "factory-card-fitness-pop",
        "factory-card-beauty-bold",
        "factory-card-beauty-light",
        "factory-card-beauty-pop",
        "factory-card-restaurant-bold",
        "factory-card-restaurant-light",
        "factory-card-restaurant-pop",
        "factory-card-real-estate-bold",
        "factory-card-real-estate-light",
        "factory-card-real-estate-pop",
        "factory-card-music-bold",
        "factory-card-music-light",
        "factory-card-music-pop",
        "factory-card-bakery-bold",
        "factory-card-bakery-light",
        "factory-card-bakery-pop",
        "factory-logo-coffee-shop-bold",
        "factory-logo-coffee-shop-light",
        "factory-logo-coffee-shop-pop",
        "factory-logo-fashion-bold",
        "factory-logo-fashion-light",
        "factory-logo-fashion-pop",
        "factory-logo-fitness-bold",
        "factory-logo-fitness-light",
        "factory-logo-fitness-pop",
        "factory-logo-beauty-bold",
        "factory-logo-beauty-light",
        "factory-logo-beauty-pop",
        "factory-logo-restaurant-bold",
        "factory-logo-restaurant-light",
        "factory-logo-restaurant-pop",
        "factory-logo-real-estate-bold",
        "factory-logo-real-estate-light",
        "factory-logo-real-estate-pop",
        "factory-logo-music-bold",
        "factory-logo-music-light",
        "factory-logo-music-pop",
        "factory-logo-bakery-bold",
        "factory-logo-bakery-light",
        "factory-logo-bakery-pop",
        "factory-resume-designer-bold",
        "factory-resume-designer-light",
        "factory-resume-designer-pop",
        "factory-resume-developer-bold",
        "factory-resume-developer-light",
        "factory-resume-developer-pop",
        "factory-resume-chef-bold",
        "factory-resume-chef-light",
        "factory-resume-chef-pop",
        "factory-resume-teacher-bold",
        "factory-resume-teacher-light",
        "factory-resume-teacher-pop",
        "factory-resume-marketer-bold",
        "factory-resume-marketer-light",
        "factory-resume-marketer-pop",
        "factory-resume-nurse-bold",
        "factory-resume-nurse-light",
        "factory-resume-nurse-pop",
        "factory-certificate-achievement-bold",
        "factory-certificate-achievement-light",
        "factory-certificate-achievement-pop",
        "factory-certificate-excellence-bold",
        "factory-certificate-excellence-light",
        "factory-certificate-excellence-pop",
        "factory-certificate-appreciation-bold",
        "factory-certificate-appreciation-light",
        "factory-certificate-appreciation-pop",
        "factory-certificate-training-bold",
        "factory-certificate-training-light",
        "factory-certificate-training-pop",
        "factory-certificate-participation-bold",
        "factory-certificate-participation-light",
        "factory-certificate-participation-pop",
        "factory-certificate-diploma-bold",
        "factory-certificate-diploma-light",
        "factory-certificate-diploma-pop",
      ]
    `)
  })

  it('have the object counts they were designed with (top-level objects per page)', () => {
    const counts = Object.fromEntries(documents.map((d) => [d.slug, d.doc.pages.map((p) => p.objects.length)]))
    expect(counts).toMatchInlineSnapshot(`
      {
        "bold-sale-announcement": [
          19,
        ],
        "bold-youtube-thumbnail": [
          8,
        ],
        "botanical-celebration-invitation": [
          20,
        ],
        "clean-business-card": [
          3,
          12,
        ],
        "factory-card-bakery-bold": [
          6,
        ],
        "factory-card-bakery-light": [
          6,
        ],
        "factory-card-bakery-pop": [
          6,
        ],
        "factory-card-beauty-bold": [
          6,
        ],
        "factory-card-beauty-light": [
          6,
        ],
        "factory-card-beauty-pop": [
          6,
        ],
        "factory-card-coffee-shop-bold": [
          6,
        ],
        "factory-card-coffee-shop-light": [
          6,
        ],
        "factory-card-coffee-shop-pop": [
          6,
        ],
        "factory-card-fashion-bold": [
          6,
        ],
        "factory-card-fashion-light": [
          6,
        ],
        "factory-card-fashion-pop": [
          6,
        ],
        "factory-card-fitness-bold": [
          6,
        ],
        "factory-card-fitness-light": [
          6,
        ],
        "factory-card-fitness-pop": [
          6,
        ],
        "factory-card-music-bold": [
          6,
        ],
        "factory-card-music-light": [
          6,
        ],
        "factory-card-music-pop": [
          6,
        ],
        "factory-card-real-estate-bold": [
          6,
        ],
        "factory-card-real-estate-light": [
          6,
        ],
        "factory-card-real-estate-pop": [
          6,
        ],
        "factory-card-restaurant-bold": [
          6,
        ],
        "factory-card-restaurant-light": [
          6,
        ],
        "factory-card-restaurant-pop": [
          6,
        ],
        "factory-certificate-achievement-bold": [
          12,
        ],
        "factory-certificate-achievement-light": [
          12,
        ],
        "factory-certificate-achievement-pop": [
          12,
        ],
        "factory-certificate-appreciation-bold": [
          12,
        ],
        "factory-certificate-appreciation-light": [
          12,
        ],
        "factory-certificate-appreciation-pop": [
          12,
        ],
        "factory-certificate-diploma-bold": [
          12,
        ],
        "factory-certificate-diploma-light": [
          12,
        ],
        "factory-certificate-diploma-pop": [
          12,
        ],
        "factory-certificate-excellence-bold": [
          12,
        ],
        "factory-certificate-excellence-light": [
          12,
        ],
        "factory-certificate-excellence-pop": [
          12,
        ],
        "factory-certificate-participation-bold": [
          12,
        ],
        "factory-certificate-participation-light": [
          12,
        ],
        "factory-certificate-participation-pop": [
          12,
        ],
        "factory-certificate-training-bold": [
          12,
        ],
        "factory-certificate-training-light": [
          12,
        ],
        "factory-certificate-training-pop": [
          12,
        ],
        "factory-facebook-bakery-bold": [
          6,
        ],
        "factory-facebook-bakery-light": [
          6,
        ],
        "factory-facebook-bakery-pop": [
          6,
        ],
        "factory-facebook-beauty-bold": [
          6,
        ],
        "factory-facebook-beauty-light": [
          6,
        ],
        "factory-facebook-beauty-pop": [
          6,
        ],
        "factory-facebook-coffee-shop-bold": [
          6,
        ],
        "factory-facebook-coffee-shop-light": [
          6,
        ],
        "factory-facebook-coffee-shop-pop": [
          6,
        ],
        "factory-facebook-fashion-bold": [
          6,
        ],
        "factory-facebook-fashion-light": [
          6,
        ],
        "factory-facebook-fashion-pop": [
          6,
        ],
        "factory-facebook-fitness-bold": [
          6,
        ],
        "factory-facebook-fitness-light": [
          6,
        ],
        "factory-facebook-fitness-pop": [
          6,
        ],
        "factory-facebook-music-bold": [
          6,
        ],
        "factory-facebook-music-light": [
          6,
        ],
        "factory-facebook-music-pop": [
          6,
        ],
        "factory-facebook-real-estate-bold": [
          6,
        ],
        "factory-facebook-real-estate-light": [
          6,
        ],
        "factory-facebook-real-estate-pop": [
          6,
        ],
        "factory-facebook-restaurant-bold": [
          6,
        ],
        "factory-facebook-restaurant-light": [
          6,
        ],
        "factory-facebook-restaurant-pop": [
          6,
        ],
        "factory-flyer-bakery-bold": [
          10,
        ],
        "factory-flyer-bakery-light": [
          10,
        ],
        "factory-flyer-bakery-pop": [
          10,
        ],
        "factory-flyer-beauty-bold": [
          10,
        ],
        "factory-flyer-beauty-light": [
          10,
        ],
        "factory-flyer-beauty-pop": [
          10,
        ],
        "factory-flyer-coffee-shop-bold": [
          10,
        ],
        "factory-flyer-coffee-shop-light": [
          10,
        ],
        "factory-flyer-coffee-shop-pop": [
          10,
        ],
        "factory-flyer-fashion-bold": [
          10,
        ],
        "factory-flyer-fashion-light": [
          10,
        ],
        "factory-flyer-fashion-pop": [
          10,
        ],
        "factory-flyer-fitness-bold": [
          10,
        ],
        "factory-flyer-fitness-light": [
          10,
        ],
        "factory-flyer-fitness-pop": [
          10,
        ],
        "factory-flyer-music-bold": [
          10,
        ],
        "factory-flyer-music-light": [
          10,
        ],
        "factory-flyer-music-pop": [
          10,
        ],
        "factory-flyer-real-estate-bold": [
          10,
        ],
        "factory-flyer-real-estate-light": [
          10,
        ],
        "factory-flyer-real-estate-pop": [
          10,
        ],
        "factory-flyer-restaurant-bold": [
          10,
        ],
        "factory-flyer-restaurant-light": [
          10,
        ],
        "factory-flyer-restaurant-pop": [
          10,
        ],
        "factory-invitation-bakery-bold": [
          9,
        ],
        "factory-invitation-bakery-light": [
          9,
        ],
        "factory-invitation-bakery-pop": [
          9,
        ],
        "factory-invitation-beauty-bold": [
          9,
        ],
        "factory-invitation-beauty-light": [
          9,
        ],
        "factory-invitation-beauty-pop": [
          9,
        ],
        "factory-invitation-coffee-shop-bold": [
          9,
        ],
        "factory-invitation-coffee-shop-light": [
          9,
        ],
        "factory-invitation-coffee-shop-pop": [
          9,
        ],
        "factory-invitation-fashion-bold": [
          9,
        ],
        "factory-invitation-fashion-light": [
          9,
        ],
        "factory-invitation-fashion-pop": [
          9,
        ],
        "factory-invitation-fitness-bold": [
          9,
        ],
        "factory-invitation-fitness-light": [
          9,
        ],
        "factory-invitation-fitness-pop": [
          9,
        ],
        "factory-invitation-music-bold": [
          9,
        ],
        "factory-invitation-music-light": [
          9,
        ],
        "factory-invitation-music-pop": [
          9,
        ],
        "factory-invitation-real-estate-bold": [
          9,
        ],
        "factory-invitation-real-estate-light": [
          9,
        ],
        "factory-invitation-real-estate-pop": [
          9,
        ],
        "factory-invitation-restaurant-bold": [
          9,
        ],
        "factory-invitation-restaurant-light": [
          9,
        ],
        "factory-invitation-restaurant-pop": [
          9,
        ],
        "factory-logo-bakery-bold": [
          4,
        ],
        "factory-logo-bakery-light": [
          4,
        ],
        "factory-logo-bakery-pop": [
          4,
        ],
        "factory-logo-beauty-bold": [
          4,
        ],
        "factory-logo-beauty-light": [
          4,
        ],
        "factory-logo-beauty-pop": [
          4,
        ],
        "factory-logo-coffee-shop-bold": [
          4,
        ],
        "factory-logo-coffee-shop-light": [
          4,
        ],
        "factory-logo-coffee-shop-pop": [
          4,
        ],
        "factory-logo-fashion-bold": [
          4,
        ],
        "factory-logo-fashion-light": [
          4,
        ],
        "factory-logo-fashion-pop": [
          4,
        ],
        "factory-logo-fitness-bold": [
          4,
        ],
        "factory-logo-fitness-light": [
          4,
        ],
        "factory-logo-fitness-pop": [
          4,
        ],
        "factory-logo-music-bold": [
          4,
        ],
        "factory-logo-music-light": [
          4,
        ],
        "factory-logo-music-pop": [
          4,
        ],
        "factory-logo-real-estate-bold": [
          4,
        ],
        "factory-logo-real-estate-light": [
          4,
        ],
        "factory-logo-real-estate-pop": [
          4,
        ],
        "factory-logo-restaurant-bold": [
          4,
        ],
        "factory-logo-restaurant-light": [
          4,
        ],
        "factory-logo-restaurant-pop": [
          4,
        ],
        "factory-poster-bakery-bold": [
          8,
        ],
        "factory-poster-bakery-light": [
          8,
        ],
        "factory-poster-bakery-pop": [
          8,
        ],
        "factory-poster-beauty-bold": [
          8,
        ],
        "factory-poster-beauty-light": [
          8,
        ],
        "factory-poster-beauty-pop": [
          8,
        ],
        "factory-poster-coffee-shop-bold": [
          8,
        ],
        "factory-poster-coffee-shop-light": [
          8,
        ],
        "factory-poster-coffee-shop-pop": [
          8,
        ],
        "factory-poster-fashion-bold": [
          8,
        ],
        "factory-poster-fashion-light": [
          8,
        ],
        "factory-poster-fashion-pop": [
          8,
        ],
        "factory-poster-fitness-bold": [
          8,
        ],
        "factory-poster-fitness-light": [
          8,
        ],
        "factory-poster-fitness-pop": [
          8,
        ],
        "factory-poster-music-bold": [
          8,
        ],
        "factory-poster-music-light": [
          8,
        ],
        "factory-poster-music-pop": [
          8,
        ],
        "factory-poster-real-estate-bold": [
          8,
        ],
        "factory-poster-real-estate-light": [
          8,
        ],
        "factory-poster-real-estate-pop": [
          8,
        ],
        "factory-poster-restaurant-bold": [
          8,
        ],
        "factory-poster-restaurant-light": [
          8,
        ],
        "factory-poster-restaurant-pop": [
          8,
        ],
        "factory-promo-bakery-bold": [
          11,
        ],
        "factory-promo-bakery-light": [
          11,
        ],
        "factory-promo-bakery-pop": [
          11,
        ],
        "factory-promo-beauty-bold": [
          11,
        ],
        "factory-promo-beauty-light": [
          11,
        ],
        "factory-promo-beauty-pop": [
          11,
        ],
        "factory-promo-coffee-shop-bold": [
          11,
        ],
        "factory-promo-coffee-shop-light": [
          11,
        ],
        "factory-promo-coffee-shop-pop": [
          11,
        ],
        "factory-promo-fashion-bold": [
          11,
        ],
        "factory-promo-fashion-light": [
          11,
        ],
        "factory-promo-fashion-pop": [
          11,
        ],
        "factory-promo-fitness-bold": [
          11,
        ],
        "factory-promo-fitness-light": [
          11,
        ],
        "factory-promo-fitness-pop": [
          11,
        ],
        "factory-promo-music-bold": [
          11,
        ],
        "factory-promo-music-light": [
          11,
        ],
        "factory-promo-music-pop": [
          11,
        ],
        "factory-promo-real-estate-bold": [
          11,
        ],
        "factory-promo-real-estate-light": [
          11,
        ],
        "factory-promo-real-estate-pop": [
          11,
        ],
        "factory-promo-restaurant-bold": [
          11,
        ],
        "factory-promo-restaurant-light": [
          11,
        ],
        "factory-promo-restaurant-pop": [
          11,
        ],
        "factory-quote-bakery-bold": [
          4,
        ],
        "factory-quote-bakery-light": [
          4,
        ],
        "factory-quote-bakery-pop": [
          4,
        ],
        "factory-quote-beauty-bold": [
          4,
        ],
        "factory-quote-beauty-light": [
          4,
        ],
        "factory-quote-beauty-pop": [
          4,
        ],
        "factory-quote-coffee-shop-bold": [
          4,
        ],
        "factory-quote-coffee-shop-light": [
          4,
        ],
        "factory-quote-coffee-shop-pop": [
          4,
        ],
        "factory-quote-fashion-bold": [
          4,
        ],
        "factory-quote-fashion-light": [
          4,
        ],
        "factory-quote-fashion-pop": [
          4,
        ],
        "factory-quote-fitness-bold": [
          4,
        ],
        "factory-quote-fitness-light": [
          4,
        ],
        "factory-quote-fitness-pop": [
          4,
        ],
        "factory-quote-music-bold": [
          4,
        ],
        "factory-quote-music-light": [
          4,
        ],
        "factory-quote-music-pop": [
          4,
        ],
        "factory-quote-real-estate-bold": [
          4,
        ],
        "factory-quote-real-estate-light": [
          4,
        ],
        "factory-quote-real-estate-pop": [
          4,
        ],
        "factory-quote-restaurant-bold": [
          4,
        ],
        "factory-quote-restaurant-light": [
          4,
        ],
        "factory-quote-restaurant-pop": [
          4,
        ],
        "factory-resume-chef-bold": [
          39,
        ],
        "factory-resume-chef-light": [
          39,
        ],
        "factory-resume-chef-pop": [
          39,
        ],
        "factory-resume-designer-bold": [
          39,
        ],
        "factory-resume-designer-light": [
          39,
        ],
        "factory-resume-designer-pop": [
          39,
        ],
        "factory-resume-developer-bold": [
          39,
        ],
        "factory-resume-developer-light": [
          39,
        ],
        "factory-resume-developer-pop": [
          39,
        ],
        "factory-resume-marketer-bold": [
          39,
        ],
        "factory-resume-marketer-light": [
          39,
        ],
        "factory-resume-marketer-pop": [
          39,
        ],
        "factory-resume-nurse-bold": [
          39,
        ],
        "factory-resume-nurse-light": [
          39,
        ],
        "factory-resume-nurse-pop": [
          39,
        ],
        "factory-resume-teacher-bold": [
          39,
        ],
        "factory-resume-teacher-light": [
          39,
        ],
        "factory-resume-teacher-pop": [
          39,
        ],
        "factory-slide-bakery-bold": [
          7,
        ],
        "factory-slide-bakery-light": [
          7,
        ],
        "factory-slide-bakery-pop": [
          7,
        ],
        "factory-slide-beauty-bold": [
          7,
        ],
        "factory-slide-beauty-light": [
          7,
        ],
        "factory-slide-beauty-pop": [
          7,
        ],
        "factory-slide-coffee-shop-bold": [
          7,
        ],
        "factory-slide-coffee-shop-light": [
          7,
        ],
        "factory-slide-coffee-shop-pop": [
          7,
        ],
        "factory-slide-fashion-bold": [
          7,
        ],
        "factory-slide-fashion-light": [
          7,
        ],
        "factory-slide-fashion-pop": [
          7,
        ],
        "factory-slide-fitness-bold": [
          7,
        ],
        "factory-slide-fitness-light": [
          7,
        ],
        "factory-slide-fitness-pop": [
          7,
        ],
        "factory-slide-music-bold": [
          7,
        ],
        "factory-slide-music-light": [
          7,
        ],
        "factory-slide-music-pop": [
          7,
        ],
        "factory-slide-real-estate-bold": [
          7,
        ],
        "factory-slide-real-estate-light": [
          7,
        ],
        "factory-slide-real-estate-pop": [
          7,
        ],
        "factory-slide-restaurant-bold": [
          7,
        ],
        "factory-slide-restaurant-light": [
          7,
        ],
        "factory-slide-restaurant-pop": [
          7,
        ],
        "factory-story-bakery-bold": [
          8,
        ],
        "factory-story-bakery-light": [
          8,
        ],
        "factory-story-bakery-pop": [
          8,
        ],
        "factory-story-beauty-bold": [
          8,
        ],
        "factory-story-beauty-light": [
          8,
        ],
        "factory-story-beauty-pop": [
          8,
        ],
        "factory-story-coffee-shop-bold": [
          8,
        ],
        "factory-story-coffee-shop-light": [
          8,
        ],
        "factory-story-coffee-shop-pop": [
          8,
        ],
        "factory-story-fashion-bold": [
          8,
        ],
        "factory-story-fashion-light": [
          8,
        ],
        "factory-story-fashion-pop": [
          8,
        ],
        "factory-story-fitness-bold": [
          8,
        ],
        "factory-story-fitness-light": [
          8,
        ],
        "factory-story-fitness-pop": [
          8,
        ],
        "factory-story-music-bold": [
          8,
        ],
        "factory-story-music-light": [
          8,
        ],
        "factory-story-music-pop": [
          8,
        ],
        "factory-story-real-estate-bold": [
          8,
        ],
        "factory-story-real-estate-light": [
          8,
        ],
        "factory-story-real-estate-pop": [
          8,
        ],
        "factory-story-restaurant-bold": [
          8,
        ],
        "factory-story-restaurant-light": [
          8,
        ],
        "factory-story-restaurant-pop": [
          8,
        ],
        "factory-youtube-bakery-bold": [
          6,
        ],
        "factory-youtube-bakery-light": [
          6,
        ],
        "factory-youtube-bakery-pop": [
          6,
        ],
        "factory-youtube-beauty-bold": [
          6,
        ],
        "factory-youtube-beauty-light": [
          6,
        ],
        "factory-youtube-beauty-pop": [
          6,
        ],
        "factory-youtube-coffee-shop-bold": [
          6,
        ],
        "factory-youtube-coffee-shop-light": [
          6,
        ],
        "factory-youtube-coffee-shop-pop": [
          6,
        ],
        "factory-youtube-fashion-bold": [
          6,
        ],
        "factory-youtube-fashion-light": [
          6,
        ],
        "factory-youtube-fashion-pop": [
          6,
        ],
        "factory-youtube-fitness-bold": [
          6,
        ],
        "factory-youtube-fitness-light": [
          6,
        ],
        "factory-youtube-fitness-pop": [
          6,
        ],
        "factory-youtube-music-bold": [
          6,
        ],
        "factory-youtube-music-light": [
          6,
        ],
        "factory-youtube-music-pop": [
          6,
        ],
        "factory-youtube-real-estate-bold": [
          6,
        ],
        "factory-youtube-real-estate-light": [
          6,
        ],
        "factory-youtube-real-estate-pop": [
          6,
        ],
        "factory-youtube-restaurant-bold": [
          6,
        ],
        "factory-youtube-restaurant-light": [
          6,
        ],
        "factory-youtube-restaurant-pop": [
          6,
        ],
        "grand-opening-flyer": [
          15,
        ],
        "modern-pitch-deck": [
          12,
          17,
          23,
        ],
        "modern-resume": [
          64,
        ],
        "night-bloom-concert-poster": [
          17,
        ],
        "rooftop-event-story": [
          16,
        ],
        "serif-quote-card": [
          3,
        ],
      }
    `)
  })

  describe.each(documents)('$slug', ({ slug, doc, fonts }) => {
    it('opens through the editor without a console message and keeps its shape', () => {
      const messages = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')]
      const migrated = migrateDocument(structuredClone(doc))
      expect(migrated.pages).toHaveLength(doc.pages.length)
      expect([migrated.width, migrated.height, migrated.unit]).toEqual([doc.width, doc.height, doc.unit])
      expect(migrated.pages.map((p) => p.objects.length)).toEqual(doc.pages.map((p) => p.objects.length))
      for (const spy of messages) expect(spy).not.toHaveBeenCalled()
      vi.restoreAllMocks()
    })

    it('rebuilds every object and writes it back in the same order, with the same names and ids', async () => {
      const messages = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')]
      for (const page of doc.pages) {
        const { canvas, out } = await rebuild(page.objects, doc.width, doc.height)
        expect(canvas.getObjects()).toHaveLength(page.objects.length)
        expect(out.map((o) => [o.id, o.type, o.name, o.locked ?? false])).toEqual(page.objects.map((o) => [o.id, o.type, o.name, o.locked ?? false]))
        // Nothing fell back to the "unavailable" stand-in, which would keep the raw JSON.
        for (const live of canvas.getObjects()) expect((live as unknown as { rawDoc?: unknown }).rawDoc).toBeUndefined()
        canvas.dispose()
      }
      for (const spy of messages) expect(spy).not.toHaveBeenCalled()
      vi.restoreAllMocks()
    })

    it('is stable: writing a rebuilt page again changes nothing but measured text sizes', async () => {
      for (const page of doc.pages) {
        const first = await rebuild(page.objects, doc.width, doc.height)
        const second = await rebuild(first.out, doc.width, doc.height)
        expect(second.out).toEqual(first.out)
        first.canvas.dispose()
        second.canvas.dispose()
      }
    })

    it('keeps every object inside its page', async () => {
      for (const page of doc.pages) {
        const { canvas } = await rebuild(page.objects.filter((o) => o.type !== 'textbox'), doc.width, doc.height)
        for (const live of canvas.getObjects()) {
          // A framed photo is larger than its frame and clipped to it: what shows is the frame.
          const slot = (live as unknown as { slot?: SlotSpec }).slot
          const box = slot ? rotatedBounds(slot.cx, slot.cy, slot.width, slot.height, slot.angle) : live.getBoundingRect()
          const name = String((live as unknown as { name?: string }).name)
          // A stroke is measured with half its width on either side of the path; that is not paint outside the page.
          const slack = (live.stroke ? live.strokeWidth / 2 : 0) + 0.6
          expect(box.left, `${name} left`).toBeGreaterThanOrEqual(-slack)
          expect(box.top, `${name} top`).toBeGreaterThanOrEqual(-slack)
          expect(box.left + box.width, `${name} right`).toBeLessThanOrEqual(doc.width + slack)
          expect(box.top + box.height, `${name} bottom`).toBeLessThanOrEqual(doc.height + slack)
        }
        canvas.dispose()
      }
    })

    it('uses only palette fonts at weights the catalogue installs, and the manifest names exactly those', () => {
      const palette = new Map<string, FontPick>(Object.values(FONT_PICKS).map((pick) => [pick.family, pick]))
      const used = new Set<string>()
      for (const object of doc.pages.flatMap((p) => walk(p.objects)).filter((o) => o.type === 'textbox')) {
        const family = String(object.fontFamily).split(',')[0].replace(/"/g, '').trim()
        const pick = palette.get(family)
        expect(pick, `${slug}: ${family} is not in the palette`).toBeDefined()
        expect(pick?.weights as readonly number[], `${family} ${String(object.fontWeight)}`).toContain(object.fontWeight)
        used.add(family)
      }
      expect([...used].sort()).toEqual([...fonts].sort())
    })

    it.each([
      ['an Instagram post', 1080, 1080],
      ['an A4 page', 794, 1123],
      ['a 16:9 slide', 1920, 1080],
    ])('survives being applied to %s', (_label, width, height) => {
      const target = createBlankDocument(width, height)
      const applied = applyTemplate({ ...target, pages: [{ ...target.pages[0], objects: [{ id: 'x', type: 'rect', left: 1, top: 1, width: 1, height: 1 }] }] }, target.pages[0].id, doc, 'replace')
      expect(applied).not.toBeNull()
      const page = applied?.doc.pages[0]
      expect(page?.objects).toHaveLength(doc.pages[0].objects.length)
      for (const object of page?.objects ?? []) {
        const centre = objectCenter(object)
        const w = Math.abs(Number(object.width ?? 0) * Number(object.scaleX ?? 1))
        const h = Math.abs(Number(object.height ?? 0) * Number(object.scaleY ?? 1))
        const slot = object.slot as SlotSpec | undefined
        const box = slot ? rotatedBounds(slot.cx, slot.cy, slot.width, slot.height, slot.angle) : rotatedBounds(centre.x, centre.y, w, h, Number(object.angle ?? 0))
        expect(Number.isFinite(box.left + box.top + box.width + box.height), String(object.name)).toBe(true)
        expect(box.left, `${String(object.name)} left`).toBeGreaterThanOrEqual(-1)
        expect(box.top, `${String(object.name)} top`).toBeGreaterThanOrEqual(-1)
        expect(box.left + box.width, `${String(object.name)} right`).toBeLessThanOrEqual(width + 1)
        expect(box.top + box.height, `${String(object.name)} bottom`).toBeLessThanOrEqual(height + 1)
      }
    })
  })
})
