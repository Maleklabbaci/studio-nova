import { afterEach, describe, expect, it, vi } from 'vitest'
import { desktopBridge, isDesktopApp, markDesktopShell, type StudioNovaDesktopBridge } from './desktop'

function fakeBridge(): StudioNovaDesktopBridge {
  return {
    platform: 'win32',
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    isMaximized: () => Promise.resolve(false),
    onMaximizedChange: () => () => undefined,
  }
}

afterEach(() => {
  delete window.studioNovaDesktop
  document.documentElement.classList.remove('nova-desktop')
  vi.unstubAllGlobals()
})

describe('desktop detection', () => {
  it('sees the preload bridge and reports a desktop app', () => {
    window.studioNovaDesktop = fakeBridge()
    expect(desktopBridge()).not.toBeNull()
    expect(isDesktopApp()).toBe(true)
  })

  it('ignores a malformed bridge', () => {
    window.studioNovaDesktop = {} as StudioNovaDesktopBridge
    expect(desktopBridge()).toBeNull()
  })

  it('marks the document shell only for a desktop app', () => {
    window.studioNovaDesktop = fakeBridge()
    markDesktopShell()
    expect(document.documentElement.classList.contains('nova-desktop')).toBe(true)
  })
})
