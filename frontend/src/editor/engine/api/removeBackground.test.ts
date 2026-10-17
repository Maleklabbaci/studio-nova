import { FabricImage } from 'fabric'
import { createBlankDocument } from '@/lib/document'
import { createMemoryAdapter } from '../../dev/memoryAdapter'
import { installImageStub } from '../../test/imageStub'
import { EditorEngine } from '../editor'

const removal = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('../bgRemoval', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../bgRemoval')>()),
  removeBackground: removal.run,
}))

async function setup() {
  const handle = createMemoryAdapter()
  const engine = new EditorEngine({ adapter: handle.adapter, document: createBlankDocument(800, 600), meta: { id: 'd', title: 'T', mode: 'guest' }, ephemeral: true })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const pageId = engine.state.doc.pages[0].id
  engine.mountPage(pageId, host)
  const view = await engine.whenView(pageId)
  view.setLayout(1, { x: 0, y: 0, width: 800, height: 600 })
  await engine.insert.imageFiles([new File([new Uint8Array([1, 2, 3])], 'cat.png', { type: 'image/png' })])
  await vi.waitFor(() => expect(view.canvas.getObjects()).toHaveLength(1))
  return { engine, handle, view }
}

describe('StyleApi.removeBackground', () => {
  let restore: () => void
  beforeEach(() => {
    restore = installImageStub({ width: 200, height: 100 })
    vi.spyOn(FabricImage.prototype, '_render').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['x'], { type: 'image/png' }))))
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    removal.run.mockReset()
  })
  afterEach(async () => {
    // Let Fabric's scheduled repaint run while the image stub is still installed.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    restore()
    document.body.innerHTML = ''
  })

  it('replaces the selected image with the cut-out and reports it', async () => {
    const { engine, handle } = await setup()
    removal.run.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    const before = engine.state.doc.pages[0].objects[0].src
    const applied = await engine.style.removeBackground()
    expect(applied).toBe(true)
    expect(handle.uploads.map((u) => u.name)).toContain('cutout.png')
    expect(engine.state.doc.pages[0].objects[0].src).not.toBe(before)
    engine.dispose()
  })

  it('hands the abort signal and the progress callback to the engine', async () => {
    const { engine } = await setup()
    removal.run.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    const progress = vi.fn()
    const controller = new AbortController()
    await engine.style.removeBackground(progress, controller.signal)
    expect(removal.run).toHaveBeenCalledWith(expect.anything(), progress, controller.signal)
    engine.dispose()
  })

  it('resolves false instead of throwing when the engine rejects because the run was cancelled', async () => {
    const { engine, handle } = await setup()
    const uploadsBefore = handle.uploads.length
    const controller = new AbortController()
    removal.run.mockImplementation(async () => {
      controller.abort()
      throw new DOMException('Aborted', 'AbortError')
    })
    expect(await engine.style.removeBackground(undefined, controller.signal)).toBe(false)
    expect(handle.uploads).toHaveLength(uploadsBefore)
    engine.dispose()
  })

  it('still reports a real failure of a run that was not cancelled', async () => {
    const { engine } = await setup()
    removal.run.mockRejectedValue(new Error('boom'))
    await expect(engine.style.removeBackground(undefined, new AbortController().signal)).rejects.toThrow('boom')
    engine.dispose()
  })

  it('leaves the design untouched when cancelled while the model runs', async () => {
    const { engine, handle } = await setup()
    const uploadsBefore = handle.uploads.length
    const controller = new AbortController()
    removal.run.mockImplementation(async () => {
      controller.abort()
      return new Blob(['png'], { type: 'image/png' })
    })
    const doc = engine.state.doc
    expect(await engine.style.removeBackground(undefined, controller.signal)).toBe(false)
    expect(handle.uploads).toHaveLength(uploadsBefore)
    expect(engine.state.doc).toBe(doc)
    engine.dispose()
  })

  it('does not replace a different object when the selection changed meanwhile', async () => {
    const { engine, handle } = await setup()
    const uploadsBefore = handle.uploads.length
    removal.run.mockImplementation(async () => {
      engine.activeView()?.canvas.discardActiveObject()
      return new Blob(['png'], { type: 'image/png' })
    })
    expect(await engine.style.removeBackground()).toBe(false)
    expect(handle.uploads).toHaveLength(uploadsBefore)
    engine.dispose()
  })
})
