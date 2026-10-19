import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { configureBackgroundRemoval } from '@/editor/engine/bgRemoval/install'
import { ApiError, authApi, configApi, DEFAULT_CONFIG, isApiError, normalizeAppConfig, setUnauthorizedHandler, STATIC_FALLBACK_CONFIG } from '@/lib/api'
import { isDesktopApp } from '@/lib/desktop'
import type { ApiUser, AppConfig, RegisterInput } from '@/types/api'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

/** The account whose session ended while the page was open (it expired, or the user signed out elsewhere). */
export interface LostSession {
  id: string
  email: string
}

/** Constraint for a sign-in that must restore a session that ended (the editor keeps saving to this account only). */
export interface SignInOptions {
  expectUserId?: string
}

export interface AuthContextValue {
  status: AuthStatus
  user: ApiUser | null
  config: AppConfig
  /** Set when the API could not be reached while bootstrapping (network/server error). */
  bootstrapError: ApiError | null
  /** True after an explicit sign-out or account deletion, so guards send the visitor home instead of to /login. */
  signedOutByUser: boolean
  /** Set while the session of a signed-in user has ended on the server; the editor stays open and asks to sign in again. */
  lostSession: LostSession | null
  login(input: { email: string; password: string }, options?: SignInOptions): Promise<ApiUser>
  signup(input: RegisterInput): Promise<ApiUser>
  google(credential: string, options?: SignInOptions): Promise<ApiUser>
  logout(): Promise<void>
  /** Re-reads `/auth/me/`. Resolves the current user (or null). */
  refresh(): Promise<ApiUser | null>
  /** Replaces the cached user (after a profile update). */
  setUser(user: ApiUser): void
  /** Forgets the session locally (after the account was deleted). */
  clearSession(): void
  retryBootstrap(): void
}

/**
 * The desktop shell starts its local engine alongside the window, and a first
 * launch spends a while migrating and seeding. A failed session check is
 * therefore expected for a few seconds and retried quietly; on the web the
 * visitor gets the explicit "Try again" button instead.
 */
const BOOTSTRAP_RETRY_DELAYS = [2000, 4000, 8000, 15000, 30000] as const

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUserState] = useState<ApiUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG)
  const [bootstrapError, setBootstrapError] = useState<ApiError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [signedOutByUser, setSignedOutByUser] = useState(false)
  const [lostSession, setLostSession] = useState<LostSession | null>(null)
  const mounted = useRef(true)
  const userRef = useRef<ApiUser | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let retries = 0
    let inFlight = false
    let disposed = false

    const scheduleRetry = () => {
      // Only the desktop shell owns a local engine that may still be starting.
      if (!isDesktopApp() || retries >= BOOTSTRAP_RETRY_DELAYS.length) return
      const delay = BOOTSTRAP_RETRY_DELAYS[retries] ?? 30000
      retries += 1
      retryTimer = setTimeout(() => void load(), delay)
    }

    async function load(): Promise<void> {
      if (disposed || controller.signal.aborted || inFlight) return
      inFlight = true
      retryTimer = undefined
      try {
        const [me, cfg] = await Promise.allSettled([authApi.me(controller.signal), configApi.get(controller.signal)])
        if (disposed || controller.signal.aborted) return
        // Auth status first: a broken or missing /config/ (e.g. a static-only
        // deployment with no backend) must never leave the app stuck loading.
        if (me.status === 'fulfilled') {
          const nextUser = me.value?.user ?? null
          userRef.current = nextUser
          setUserState(nextUser)
          setStatus(nextUser ? 'authenticated' : 'anonymous')
          setBootstrapError(null)
          retries = 0
        } else {
          setBootstrapError(isApiError(me.reason) ? me.reason : new ApiError({ status: 0, code: 'network_error', message: 'Could not reach Studio Nova.' }))
          userRef.current = null
          setUserState(null)
          setStatus('anonymous')
          scheduleRetry()
        }
        if (cfg.status === 'fulfilled') {
          const safeConfig = normalizeAppConfig(cfg.value)
          setConfig(safeConfig)
          // Before any consumer sees the new config, so the editor's toolbar already knows whether the button works.
          configureBackgroundRemoval(safeConfig)
        } else {
          // No backend answered (static-only deployment): enable what runs
          // entirely in the browser — background removal with the model
          // bundled with the site — and keep every server-bound feature off.
          setConfig(STATIC_FALLBACK_CONFIG)
          configureBackgroundRemoval(STATIC_FALLBACK_CONFIG)
        }
      } finally {
        inFlight = false
      }
    }

    // Coming back online is the moment to look again, both in the browser and in the desktop shell.
    const retryNow = () => {
      if (disposed) return
      clearTimeout(retryTimer)
      retries = 0
      void load()
    }

    void load()
    window.addEventListener('online', retryNow)
    return () => {
      disposed = true
      clearTimeout(retryTimer)
      window.removeEventListener('online', retryNow)
      controller.abort()
    }
  }, [attempt])

  const applyUser = useCallback((next: ApiUser | null) => {
    if (next) {
      setSignedOutByUser(false)
      setLostSession(null)
    }
    userRef.current = next
    setUserState(next)
    setStatus(next ? 'authenticated' : 'anonymous')
  }, [])

  /** The server no longer knows this session. Cached data stays (an open editor still shows its design) until the next sign-in clears it. */
  const loseSession = useCallback(() => {
    const previous = userRef.current
    if (!previous) return
    userRef.current = null
    setLostSession({ id: previous.id, email: previous.email })
    setUserState(null)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (mounted.current) loseSession()
    })
    return () => setUnauthorizedHandler(null)
  }, [loseSession])

  /** Signs the account out again when the sign-in was meant to restore a particular account and a different one answered. */
  const requireExpectedUser = useCallback(async (next: ApiUser, options: SignInOptions | undefined, lost: LostSession | null) => {
    if (!options?.expectUserId || next.id === options.expectUserId) return
    await authApi.logout().catch(() => undefined)
    throw new ApiError({
      status: 409,
      code: 'wrong_account',
      message: lost ? `That is not the account this design belongs to. Sign in as ${lost.email} to keep saving.` : 'That is not the account this design belongs to.',
    })
  }, [])

  const login = useCallback(
    async (input: { email: string; password: string }, options?: SignInOptions) => {
      const { user: next } = await authApi.login(input)
      await requireExpectedUser(next, options, lostSession)
      // The same person coming back to an open page keeps the data on it (the design in the editor is part of the cache).
      if (lostSession?.id !== next.id) queryClient.clear()
      applyUser(next)
      return next
    },
    [applyUser, queryClient, requireExpectedUser, lostSession],
  )

  const signup = useCallback(
    async (input: RegisterInput) => {
      const { user: next } = await authApi.register(input)
      queryClient.clear()
      applyUser(next)
      return next
    },
    [applyUser, queryClient],
  )

  const google = useCallback(
    async (credential: string, options?: SignInOptions) => {
      const { user: next } = await authApi.google(credential)
      await requireExpectedUser(next, options, lostSession)
      // The same person coming back to an open page keeps the data on it (the design in the editor is part of the cache).
      if (lostSession?.id !== next.id) queryClient.clear()
      applyUser(next)
      return next
    },
    [applyUser, queryClient, requireExpectedUser, lostSession],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setSignedOutByUser(true)
      setLostSession(null)
      applyUser(null)
      queryClient.clear()
    }
  }, [applyUser, queryClient])

  const refresh = useCallback(async () => {
    const { user: next } = await authApi.me()
    if (next) applyUser(next)
    else if (userRef.current) loseSession()
    else applyUser(null)
    return next
  }, [applyUser, loseSession])

  const clearSession = useCallback(() => {
    setSignedOutByUser(true)
    setLostSession(null)
    applyUser(null)
    queryClient.clear()
  }, [applyUser, queryClient])

  const retryBootstrap = useCallback(() => {
    setStatus('loading')
    setAttempt((value) => value + 1)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, config, bootstrapError, signedOutByUser, lostSession, login, signup, google, logout, refresh, setUser: applyUser, clearSession, retryBootstrap }),
    [status, user, config, bootstrapError, signedOutByUser, lostSession, login, signup, google, logout, refresh, applyUser, clearSession, retryBootstrap],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
