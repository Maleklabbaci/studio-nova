import { useEffect, useState } from 'react'
import { desktopBridge, isDesktopApp } from '@/lib/desktop'
import styles from './DesktopTitlebar.module.css'

/**
 * The desktop shell's title bar, macOS style: the window is frameless, so the
 * app draws traffic-light controls (close / minimize / maximize) on the left,
 * the app name centred, and the whole bar drags the window. Rendered only
 * inside the desktop app; the web site keeps the browser's own chrome.
 */
export function DesktopTitlebar() {
  const bridge = desktopBridge()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!bridge) return undefined
    let live = true
    void bridge.isMaximized().then((value) => {
      if (live) setMaximized(value)
    }).catch(() => undefined)
    const off = bridge.onMaximizedChange(setMaximized)
    return () => {
      live = false
      off()
    }
  }, [bridge])

  if (!isDesktopApp()) return null

  return (
    <header
      className={styles.bar}
      data-testid="desktop-titlebar"
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) bridge?.toggleMaximize()
      }}
    >
      <div className={styles.lights}>
        <button
          type="button"
          className={`${styles.light} ${styles.close}`}
          aria-label="Close window"
          title="Close"
          disabled={!bridge}
          onClick={() => bridge?.close()}
        >
          <svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" /></svg>
        </button>
        <button
          type="button"
          className={`${styles.light} ${styles.minimize}`}
          aria-label="Minimize window"
          title="Minimize"
          disabled={!bridge}
          onClick={() => bridge?.minimize()}
        >
          <svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1 4h6" /></svg>
        </button>
        <button
          type="button"
          className={`${styles.light} ${styles.maximize}`}
          aria-label={maximized ? 'Restore window' : 'Maximize window'}
          title={maximized ? 'Restore' : 'Maximize'}
          disabled={!bridge}
          onClick={() => bridge?.toggleMaximize()}
        >
          {maximized ? (
            <svg viewBox="0 0 8 8" aria-hidden="true"><path d="M2.5 2.5h4v4h-4zM6.5 2.5v-1h-4v1M2.5 5.5h-1v-4h1" /></svg>
          ) : (
            <svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 1.5h5v5h-5z" /></svg>
          )}
        </button>
      </div>
      <p className={styles.title}>
        <svg className={styles.spark} viewBox="0 0 40 40" aria-hidden="true">
          <path d="M20 4 24.5 15.5 36 20 24.5 24.5 20 36 15.5 24.5 4 20 15.5 15.5Z" />
        </svg>
        Studio Nova
      </p>
      <div className={styles.spacer} aria-hidden="true" />
    </header>
  )
}
