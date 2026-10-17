import type { CSSProperties } from 'react'
import { cx } from '@/lib/cx'

/** A lightweight inline brand illustration used instead of the original mascot artwork. */
export function NovaOrb({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={cx(className)} style={style} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="70" fill="var(--color-brand-soft)" />
      <ellipse cx="100" cy="100" rx="87" ry="31" fill="none" stroke="var(--color-brand-fill)" strokeOpacity="0.35" strokeWidth="2.5" transform="rotate(-26 100 100)" />
      <ellipse cx="100" cy="100" rx="78" ry="23" fill="none" stroke="var(--color-brand-strong)" strokeOpacity="0.45" strokeWidth="2" transform="rotate(33 100 100)" />
      <path d="M100 39 111.4 84.6 157 96 111.4 107.4 100 153 88.6 107.4 43 96 88.6 84.6Z" fill="var(--color-brand-strong)" />
      <circle cx="100" cy="96" r="12" fill="var(--paper)" />
      <circle cx="151" cy="58" r="7" fill="var(--pastel-coral)" />
      <circle cx="53" cy="133" r="5" fill="var(--pastel-butter)" />
    </svg>
  )
}
