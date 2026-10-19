import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { isDesktopApp } from '@/lib/desktop'
import { PageLoader } from './PageLoader'

const LandingPage = lazy(() => import('@/pages/LandingPage'))

/**
 * The app's front door. The desktop shell never lands on the marketing page:
 * signed-in users go to their account dashboard, everyone else to `/studio`,
 * which works without an account or a connection. The decision is made while
 * rendering so the Electron bridge is read in the environment the app is
 * actually running in.
 */
export function HomeRoute() {
  const { status, user } = useAuth()
  if (!isDesktopApp()) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage />
      </Suspense>
    )
  }
  if (status === 'loading') return <PageLoader label="Opening your studio" />
  return <Navigate to={user ? '/dashboard' : '/studio'} replace />
}
