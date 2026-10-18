import { Link } from 'react-router-dom'
import { describeSize, designKind, getPreset } from '@/features/presets'
import { Badge, Thumbnail } from '@/ui'
import type { TemplateSummary } from '@/types/api'
import styles from './TemplateCard.module.css'

/** `frame` gives every card the same thumbnail box (the template sits inside it), for an even row; without it the card takes the template's own shape. */
export function TemplateCard({ template, to, frame }: { template: TemplateSummary; to?: string; frame?: number }) {
  const aspect = template.width > 0 && template.height > 0 ? template.width / template.height : 1
  const preset = getPreset(template.preset)
  // "Instagram Post · 1080 × 1080 px" — the format first, then its real size (mm/in for print formats).
  const size = preset ? describeSize(preset) : `${template.width} × ${template.height} px`
  return (
    <Link to={to ?? `/templates/${template.slug}`} className={styles.card}>
      <Thumbnail src={template.thumbnail_url} alt={`${template.title} template preview`} aspect={frame ?? Math.min(Math.max(aspect, 0.5), 2)} fit={frame ? 'contain' : 'cover'} className={styles.thumb} />
      <span className={styles.meta}>
        <span className={styles.title}>{template.title}</span>
        <span className={styles.sub}>
          {template.category ? <Badge>{template.category.name}</Badge> : null}
          <span className={styles.size}>
            {preset ? `${designKind(template)} · ` : ''}
            {size}
          </span>
        </span>
      </span>
    </Link>
  )
}
