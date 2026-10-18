import { Link } from 'react-router-dom'
import { Logo } from '@/ui'
import styles from './EditorHomeLink.module.css'

/** Studio Nova's editor brand link. */
export function EditorHomeLink({ to }: { to: '/dashboard' | '/' }) {
  return (
    <div className={styles.brand}>
      <Link to={to} className={styles.link} aria-label={to === '/dashboard' ? 'Back to your dashboard' : 'Studio Nova home'}>
        <Logo height={26} />
      </Link>
    </div>
  )
}
