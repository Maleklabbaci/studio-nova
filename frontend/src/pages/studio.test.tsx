import 'fake-indexeddb/auto'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createBlankDocument } from '@/lib/document'
import { createLocalDesign, listLocalDesigns, localRepository } from '@/lib/local'
import { renderApp } from '@/test/app'

beforeEach(async () => {
  await localRepository.clear()
})

describe('/studio', () => {
  it('is the offline home: it invites a first design and points to templates', async () => {
    renderApp('/studio')
    expect(await screen.findByRole('heading', { name: 'Your studio' })).toBeInTheDocument()
    expect(await screen.findByText('Your first design starts here')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a design' })).toHaveAttribute('href', '/create')
    expect(screen.getByRole('link', { name: 'Browse templates' })).toHaveAttribute('href', '/templates')
  })

  it('lists designs kept on the device, opens them and deletes after confirmation', async () => {
    const design = await createLocalDesign({ title: 'Local poster', document: createBlankDocument(800, 600) })
    renderApp('/studio')
    expect(await screen.findByRole('link', { name: 'Local poster' })).toHaveAttribute('href', `/local/${design.id}`)

    await userEvent.click(screen.getByRole('button', { name: 'Delete Local poster' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete “Local poster”?')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete design' }))

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Local poster' })).not.toBeInTheDocument())
    expect(await listLocalDesigns()).toEqual([])
  })

  it('explains local mode and recovers when the account service answers again', async () => {
    let calls = 0
    renderApp('/studio', {
      handlers: [
        http.get('*/api/v1/auth/me/', () => {
          calls += 1
          return calls === 1 ? HttpResponse.error() : HttpResponse.json({ user: null })
        }),
      ],
    })
    expect(await screen.findByText('Working in local mode')).toBeInTheDocument()
    expect(screen.getByText('Local mode')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByText('Working in local mode')).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })
})
