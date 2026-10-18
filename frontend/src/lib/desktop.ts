/**
 * Desktop-app detection and the window-control bridge.
 *
 * The Electron shell (desktop/main.cjs) is frameless: the window has no native
 * title bar, so the app draws its own macOS-style one. The preload script
 * (desktop/preload.cjs) exposes `window.studioNovaDesktop` with the window
 * controls; in a plain browser the bridge is absent and none of this applies.
 */

export interface StudioNovaDesktopBridge {
  /** OS the shell runs on (`darwin`, `win32`, `linux`, …). */
  platform: string
  minimize(): void
  toggleMaximize(): void
  close(): void
  isMaximized(): Promise<boolean>
  /** Subscribe to maximize/restore changes; returns the unsubscribe function. */
  onMaximizedChange(callback: (maximized: boolean) => void): () => void
}

declare global {
  interface Window {
    studioNovaDesktop?: StudioNovaDesktopBridge
  }
}

/** The preload bridge, or `null` when the page does not run inside the desktop shell. */
export function desktopBridge(): StudioNovaDesktopBridge | null {
  if (typeof window === 'undefined') return null
  const bridge = window.studioNovaDesktop
  return bridge && typeof bridge.close === 'function' ? bridge : null
}

/**
 * Whether the page runs inside the Studio Nova desktop app. The preload bridge
 * is the authoritative signal; the Electron user agent is the fallback (shells
 * started before the bridge existed, embedded previews).
 */
export function isDesktopApp(): boolean {
  return (
    desktopBridge() !== null ||
    (typeof navigator !== 'undefined' && /\bElectron\//.test(navigator.userAgent))
  )
}

/** Adds the `nova-desktop` class the global stylesheet keys desktop layout off. */
export function markDesktopShell(): void {
  if (typeof document !== 'undefined' && isDesktopApp()) {
    document.documentElement.classList.add('nova-desktop')
  }
}
