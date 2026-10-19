import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { DesktopTitlebar } from '@/app/DesktopTitlebar'
import { OfflineBanner } from '@/app/OfflineBanner'
import { AuthModalProvider } from '@/features/auth/AuthModalProvider'
import { isDesktopApp } from '@/lib/desktop'
import { scrollToFragment } from '@/lib/navigation'
import styles from './RootLayout.module.css'

/** Skip link, offline banner, the sign-in modal host, and focus/scroll management on route changes. */
export function RootLayout() {
  const location = useLocation()
  const lastPath = useRef(location.pathname)

  useEffect(() => {
    // A link to `/#faq` or `#features` must scroll there; React Router changes the address but leaves the scrolling to us.
    if (location.hash) {
      lastPath.current = location.pathname
      return scrollToFragment(location.hash)
    }
    // Only a real navigation moves focus (StrictMode re-running this effect must not).
    if (lastPath.current === location.pathname) return undefined
    lastPath.current = location.pathname
    window.scrollTo(0, 0)
    document.getElementById('nova-desktop-main')?.scrollTo?.(0, 0)
    const main = document.getElementById('main')
    main?.focus({ preventScroll: true })
    return undefined
  }, [location.pathname, location.hash, location.key])

  // Inside the desktop app the window is frameless: the app draws its own
  // macOS-style title bar and the pages live in the column under it, sized to
  // the window instead of the full viewport (see `--nova-viewport-h`).
  if (isDesktopApp()) {
    return (
      <AuthModalProvider>
        <a href="#main" className={styles.skip}>
          Skip to content
        </a>
        <div className={styles.desktopShell}>
          <DesktopTitlebar />
          <div id="nova-desktop-main" className={styles.desktopMain}>
            <OfflineBanner />
            <Outlet />
          </div>
        </div>
      </AuthModalProvider>
    )
  }

  return (
    <AuthModalProvider>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <OfflineBanner />
      <Outlet />
    </AuthModalProvider>
  )
}
