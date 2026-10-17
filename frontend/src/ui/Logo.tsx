import type { CSSProperties } from 'react'
import { cx } from '@/lib/cx'
import styles from './Logo.module.css'

export interface LogoProps {
  /** `mark` renders only the icon. */
  variant?: 'full' | 'mark'
  height?: number
  className?: string
  title?: string
}

/** Studio Nova's four-point star mark and wordmark. */
export function Logo({ variant = 'full', height = 28, className, title = 'Studio Nova' }: LogoProps) {
  return (
    <span
      className={cx(styles.logo, className)}
      style={{ '--logo-h': `${height}px` } as CSSProperties}
      role="img"
      aria-label={title}
    >
      <svg className={styles.mark} width={height} height={height} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <rect x="1" y="1" width="38" height="38" rx="12" fill="var(--color-brand-fill)" />
        <path d="M20 6.5 23.9 16.1 33.5 20 23.9 23.9 20 33.5 16.1 23.9 6.5 20 16.1 16.1Z" fill="var(--pastel-coral)" />
        <circle cx="20" cy="20" r="4.2" fill="var(--paper)" />
        <circle cx="30.2" cy="9.8" r="2.1" fill="var(--pastel-butter)" />
      </svg>
      {variant === 'full' ? <span className={styles.word} aria-hidden="true">Studio Nova</span> : null}
    </span>
  )
}
