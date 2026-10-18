import { Link } from 'react-router-dom'
import { createUrl, describeSize, getPreset, presetParts, type SizePreset } from '@/features/presets'
import styles from './FormatExplorer.module.css'

/**
 * The Canva-style format rail: one coloured tile per document type, with its
 * real size. A tile filters the gallery below to that format; the small
 * "Blank" link starts an empty design at exactly that size instead.
 */
const FORMAT_IDS = [
  'instagram-post',
  'instagram-story',
  'presentation',
  'resume',
  'invitation',
  'logo',
  'business-card',
  'poster',
  'flyer',
  'facebook-post',
  'youtube-thumbnail',
  'a4',
] as const

const TILE_COLORS = [
  ['#fde68a', '#fef3c7'],
  ['#fbcfe8', '#fdf2f8'],
  ['#bfdbfe', '#eff6ff'],
  ['#bbf7d0', '#f0fdf4'],
  ['#ddd6fe', '#f5f3ff'],
  ['#fecaca', '#fef2f2'],
  ['#a5f3fc', '#ecfeff'],
  ['#fde68a', '#fffbeb'],
] as const

function Tile({ preset, index }: { preset: SizePreset; index: number }) {
  const { name } = presetParts(preset)
  const Icon = preset.icon
  const [from, to] = TILE_COLORS[index % TILE_COLORS.length]
  return (
    <li className={styles.item}>
      <div className={styles.tile} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
        <Link to={`?preset=${preset.id}`} className={styles.main} aria-label={`Browse ${name} templates`}>
          <span className={styles.icon}>
            <Icon size={22} />
          </span>
          <span className={styles.name}>{name}</span>
          <span className={styles.size}>{describeSize(preset)}</span>
        </Link>
        <Link to={createUrl({ presetId: preset.id })} className={styles.blank}>
          + Blank
        </Link>
      </div>
    </li>
  )
}

export function FormatExplorer() {
  const presets = FORMAT_IDS.map((id) => getPreset(id)).filter((preset): preset is SizePreset => Boolean(preset))
  if (presets.length === 0) return null
  return (
    <section aria-label="Explore templates by format" className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Explore by format</h2>
        <p className={styles.sub}>Pick a document type — every template inside is already at the right size.</p>
      </div>
      <ul className={styles.rail}>
        {presets.map((preset, index) => (
          <Tile key={preset.id} preset={preset} index={index} />
        ))}
      </ul>
    </section>
  )
}
