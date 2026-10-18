import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioNovaDesktopBridge } from '@/lib/desktop'
import { DesktopTitlebar } from './DesktopTitlebar'

afterEach(() => {
  delete window.studioNovaDesktop
})

describe('DesktopTitlebar', () => {
  it('renders nothing in a plain browser', () => {
    const { container } = render(<DesktopTitlebar />)
    expect(container).toBeEmptyDOMElement()
  })

  it('drives the window through the bridge', async () => {
    const bridge: StudioNovaDesktopBridge = {
      platform: 'darwin',
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: () => Promise.resolve(true),
      onMaximizedChange: () => () => undefined,
    }
    window.studioNovaDesktop = bridge
    render(<DesktopTitlebar />)

    expect(screen.getByTestId('desktop-titlebar')).toBeInTheDocument()
    expect(screen.getByText('Studio Nova')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close window'))
    expect(bridge.close).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Minimize window'))
    expect(bridge.minimize).toHaveBeenCalledTimes(1)

    // The bridge reports a maximized window, so the third light offers Restore.
    fireEvent.click(await screen.findByLabelText('Restore window'))
    expect(bridge.toggleMaximize).toHaveBeenCalledTimes(1)
  })
})
