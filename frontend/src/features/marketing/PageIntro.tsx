import type { ReactNode } from 'react'
import { NovaOrb } from '@/ui'
import styles from './PageIntro.module.css'

export interface PageIntroProps {
  /** A short handwritten line above the title. */
  eyebrow: string
  title: ReactNode
  lead: string
  /** Short phrase shown beside the decorative Nova emblem. */
  bubble: string
}

/** The top of a marketing page: clear headline, short lead, and a small Studio Nova emblem. */
export function PageIntro({ eyebrow, title, lead, bubble }: PageIntroProps) {
  return (
    <header className={styles.intro}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
      </div>
      <div className={styles.stage} aria-hidden="true">
        <svg className={styles.sparkle} width="40" height="40" viewBox="0 0 44 44">
          <path d="M22 4 C 23 16, 28 21, 40 22 C 28 23, 23 28, 22 40 C 21 28, 16 23, 4 22 C 16 21, 21 16, 22 4 Z" />
        </svg>
        <svg className={styles.heart} width="36" height="32" viewBox="0 0 46 40">
          <path d="M23 36 C 8 26, 3 18, 6 11 C 9 4, 19 4, 23 12 C 27 4, 37 4, 40 11 C 43 18, 38 26, 23 36 Z" />
        </svg>
        <NovaOrb className={styles.nova} />
        <span className={styles.ground} />
        <span className={styles.bubble}>{bubble}</span>
      </div>
    </header>
  )
}

/** A word of a title set in italic with a hand-drawn pink underline. */
export function Accent({ children }: { children: ReactNode }) {
  return (
    <em className={styles.accent}>
      {children}
      <svg viewBox="0 0 200 18" preserveAspectRatio="none" aria-hidden="true">
        <path d="M4 12 C 50 4, 110 4, 196 10" />
      </svg>
    </em>
  )
}
