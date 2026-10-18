import { useEffect, useRef } from 'react'
import { templatesApi } from '@/lib/api'
import type { DocObject, PageBackground } from '@/types/document'
import type { AlignEdge } from '../engine/align'
import { createTextbox } from '../engine/objects/factories'
import { renderPageToCanvas } from '../engine/render'
import type { ShapeKind } from '../engine/api/insert'
import type { EditorEngine } from '../engine/editor'
import { useEditor } from '../context'

export type BridgeStatus = 'connecting' | 'connected' | 'disconnected'

type BridgeMessage = { type?: string; id?: string; method?: string; params?: unknown }
type Params = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const asParams = (value: unknown): Params => isRecord(value) ? value : {}
const readString = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback
const readNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const readIds = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0).slice(0, 50) : []
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const isHexColor = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value)

function pageBackgroundSummary(background: PageBackground): Record<string, unknown> {
  if (background.type === 'solid') return { type: 'solid', color: background.color }
  if (background.type === 'gradient') return { type: 'gradient', kind: background.kind, angle: background.angle, stops: background.stops }
  return { type: 'image', fit: background.fit }
}

function objectSummary(object: DocObject): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    id: object.id,
    type: object.type,
    name: object.name ?? '',
  }
  for (const key of ['text', 'fill', 'stroke', 'left', 'top', 'width', 'height', 'angle', 'opacity', 'visible', 'locked']) {
    const value = object[key]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') summary[key] = value
  }
  return summary
}

function canvasState(engine: EditorEngine): Record<string, unknown> {
  const state = engine.state
  const doc = engine.getDocument()
  const page = doc.pages.find((candidate) => candidate.id === state.activePageId) ?? doc.pages[0]
  const size = engine.pageSizeOf(page.id)
  return {
    design: { id: engine.designId, title: state.title, readOnly: engine.readOnly },
    activePage: {
      id: page.id,
      name: page.name ?? '',
      width: size.width,
      height: size.height,
      background: pageBackgroundSummary(page.background),
      objectCount: page.objects.length,
      layers: page.objects.slice(0, 100).map(objectSummary),
    },
    pages: doc.pages.map((candidate, index) => ({ id: candidate.id, name: candidate.name ?? '', number: index + 1, objects: candidate.objects.length })),
    selection: {
      ids: state.selection.ids,
      kinds: state.selection.kinds,
      objects: state.selection.objects.slice(0, 20).map(objectSummary),
    },
  }
}

/** Selects one element for the selection-based engine APIs, or explains how to find a valid id. */
function selectOne(engine: EditorEngine, elementId: string): void {
  engine.select([elementId])
  if (engine.selectedObjects().length === 0) {
    throw new Error(`No element with id "${elementId}" on the active page. Call get_canvas_state to list the current element ids.`)
  }
}

function elementSummary(engine: EditorEngine, elementId: string): Record<string, unknown> | null {
  const doc = engine.getDocument()
  const page = doc.pages.find((candidate) => candidate.id === engine.state.activePageId) ?? doc.pages[0]
  const object = page?.objects.find((candidate) => candidate.id === elementId)
  return object ? objectSummary(object) : null
}

function probeImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 })
    image.onerror = () => reject(new Error('That image could not be loaded. Check that the URL points to an image file.'))
    image.src = url
  })
}

async function executeCanvasRequest(
  engine: EditorEngine,
  method: string,
  rawParams: unknown,
  onTitleChange: (title: string) => void,
): Promise<unknown> {
  const params = asParams(rawParams)
  switch (method) {
    case 'get_canvas_state':
      return canvasState(engine)

    case 'add_text': {
      if (engine.readOnly) throw new Error('This design is view-only; text cannot be added.')
      const text = readString(params.text).trim().slice(0, 500)
      if (!text) throw new Error('Enter some text before adding a text box.')
      const page = engine.pageSizeOf(engine.state.activePageId)
      const style = params.style === 'body' ? 'body' : 'heading'
      const color = readString(params.color)
      const requestedFontSize = readNumber(params.fontSize)
      const fontSize = requestedFontSize === undefined ? undefined : clamp(requestedFontSize, 10, 160)
      const x = clamp(readNumber(params.x) ?? page.width / 2, 0, page.width)
      const y = clamp(readNumber(params.y) ?? page.height / 2, 0, page.height)
      const object = createTextbox(page, { x, y }, {
        preset: style,
        text,
        width: Math.round(page.width * (style === 'heading' ? 0.78 : 0.66)),
        ...(fontSize ? { fontSize } : {}),
        ...(isHexColor(color) ? { fill: color } : {}),
      })
      await engine.insert.add([object], 'AI: add text', { announce: 'Studio Nova AI added text to the canvas.' })
      return { ok: true, text, style, pageId: engine.state.activePageId }
    }

    case 'add_shape': {
      if (engine.readOnly) throw new Error('This design is view-only; shapes cannot be added.')
      const allowedShapes: ShapeKind[] = ['rect', 'rounded', 'ellipse', 'triangle', 'star', 'diamond', 'line', 'arrow']
      const shape = readString(params.shape)
      if (!allowedShapes.includes(shape as ShapeKind)) throw new Error('That shape is not supported.')
      await engine.insert.shape(shape as ShapeKind)
      const color = readString(params.color)
      if (isHexColor(color)) engine.style.setFill({ type: 'solid', color })
      return { ok: true, shape, color: isHexColor(color) ? color : undefined }
    }

    case 'set_background': {
      if (engine.readOnly) throw new Error('This design is view-only; its background cannot be changed.')
      const color = readString(params.color)
      if (!isHexColor(color)) throw new Error('Use a valid six-digit hex color, for example #E45C46.')
      if (params.allPages === true) engine.pages.setBackgroundAll({ type: 'solid', color })
      else engine.pages.setBackground(engine.state.activePageId, { type: 'solid', color })
      return { ok: true, color, scope: params.allPages === true ? 'all pages' : 'active page' }
    }

    case 'add_page': {
      if (engine.readOnly) throw new Error('This design is view-only; a page cannot be added.')
      const pageId = engine.pages.add()
      if (!pageId) throw new Error('A new page could not be added.')
      const name = readString(params.name).trim().slice(0, 80)
      if (name) engine.pages.rename(pageId, name)
      return { ok: true, pageId, name: name || 'New page' }
    }

    case 'delete_selected': {
      if (engine.readOnly) throw new Error('This design is view-only; layers cannot be deleted.')
      const count = engine.selectedObjects().filter((object) => object.selectable !== false).length
      if (count === 0) return { ok: true, deleted: 0, message: 'Nothing is selected.' }
      engine.arrange.delete()
      return { ok: true, deleted: count }
    }

    case 'duplicate_selected': {
      if (engine.readOnly) throw new Error('This design is view-only; layers cannot be duplicated.')
      const count = engine.selectedObjects().length
      if (count === 0) return { ok: true, duplicated: 0, message: 'Nothing is selected.' }
      await engine.arrange.duplicate()
      return { ok: true, duplicated: count }
    }

    case 'select_elements': {
      const ids = readIds(params.elementIds)
      if (ids.length === 0) throw new Error('Pass at least one element id from get_canvas_state.')
      engine.select(ids)
      return { ok: true, selected: engine.state.selection.ids }
    }

    case 'update_element': {
      if (engine.readOnly) throw new Error('This design is view-only; elements cannot be changed.')
      const elementId = readString(params.elementId)
      if (!elementId) throw new Error('Pass the element_id of the element to update.')
      selectOne(engine, elementId)
      const live = engine.selectedObjects()[0]
      let touched = false

      // Geometry and text content are set on the live object, then committed as one undo step.
      const patch: Record<string, number> = {}
      const x = readNumber(params.x)
      const y = readNumber(params.y)
      const width = readNumber(params.width)
      const height = readNumber(params.height)
      const rotation = readNumber(params.rotation)
      if (x !== undefined) patch.left = x
      if (y !== undefined) patch.top = y
      if (width !== undefined) patch.width = Math.max(1, width)
      if (height !== undefined) patch.height = Math.max(1, height)
      if (rotation !== undefined) patch.angle = rotation
      const record = live as unknown as Record<string, unknown>
      const text = typeof params.text === 'string' ? params.text.slice(0, 2000) : undefined
      if (text !== undefined && typeof record.text !== 'string') throw new Error('That element has no editable text. Pick a text element from get_canvas_state.')
      if (Object.keys(patch).length > 0 || text !== undefined) {
        live.set({ ...patch, ...(width !== undefined || height !== undefined ? { scaleX: 1, scaleY: 1 } : {}), ...(text !== undefined ? { text } : {}) })
        live.setCoords()
        touched = true
      }
      if (touched) engine.commit(engine.state.activePageId, { label: 'AI: update element' })

      // Fill, font and opacity go through the style API (correct history and text handling).
      const color = readString(params.color)
      if (isHexColor(color)) engine.style.setFill({ type: 'solid', color })
      const fontSize = readNumber(params.fontSize)
      const fontFamily = readString(params.fontFamily).trim()
      if (fontSize !== undefined || fontFamily || params.bold !== undefined || params.italic !== undefined) {
        engine.style.text({
          ...(fontSize !== undefined ? { fontSize: clamp(Math.round(fontSize), 8, 400) } : {}),
          ...(fontFamily ? { fontFamily } : {}),
          ...(params.bold !== undefined ? { fontWeight: params.bold === true ? 700 : 400 } : {}),
          ...(params.italic !== undefined ? { fontStyle: (params.italic === true ? 'italic' : 'normal') as 'italic' | 'normal' } : {}),
        })
      }
      const opacity = readNumber(params.opacity)
      if (opacity !== undefined) engine.style.setOpacity(clamp(opacity, 0, 1))
      return { ok: true, element: elementSummary(engine, elementId) }
    }

    case 'delete_element': {
      if (engine.readOnly) throw new Error('This design is view-only; elements cannot be deleted.')
      const elementId = readString(params.elementId)
      selectOne(engine, elementId)
      const count = engine.selectedObjects().filter((object) => object.selectable !== false).length
      engine.arrange.delete()
      return { ok: true, deleted: count }
    }

    case 'duplicate_element': {
      if (engine.readOnly) throw new Error('This design is view-only; elements cannot be duplicated.')
      selectOne(engine, readString(params.elementId))
      await engine.arrange.duplicate()
      return { ok: true, duplicated: 1 }
    }

    case 'align_elements': {
      if (engine.readOnly) throw new Error('This design is view-only; elements cannot be moved.')
      const edges: AlignEdge[] = ['left', 'center', 'right', 'top', 'middle', 'bottom']
      const align = readString(params.align) as AlignEdge
      if (!edges.includes(align)) throw new Error('align must be one of: left, center, right, top, middle, bottom.')
      const ids = readIds(params.elementIds)
      if (ids.length > 0) engine.select(ids)
      if (engine.selectedObjects().length === 0) return { ok: true, aligned: 0, message: 'Nothing is selected, and no element_ids were given.' }
      engine.arrange.align(align, 'page')
      return { ok: true, align, count: engine.selectedObjects().length }
    }

    case 'arrange_element': {
      if (engine.readOnly) throw new Error('This design is view-only; elements cannot be reordered.')
      const order = readString(params.order)
      if (!['forward', 'backward', 'front', 'back'].includes(order)) throw new Error('order must be one of: forward, backward, front, back.')
      selectOne(engine, readString(params.elementId))
      engine.arrange.zOrder(order as 'forward' | 'backward' | 'front' | 'back')
      return { ok: true, order }
    }

    case 'add_image': {
      if (engine.readOnly) throw new Error('This design is view-only; images cannot be added.')
      const imageUrl = readString(params.imageUrl).trim()
      let parsed: URL
      try {
        parsed = new URL(imageUrl)
      } catch {
        throw new Error('image_url must be a valid https image URL.')
      }
      if (parsed.protocol !== 'https:') throw new Error('image_url must start with https://.')
      const size = await probeImageSize(imageUrl)
      const page = engine.pageSizeOf(engine.state.activePageId)
      const at = { x: clamp(readNumber(params.x) ?? page.width / 2, 0, page.width), y: clamp(readNumber(params.y) ?? page.height / 2, 0, page.height) }
      await engine.insert.imageFromAsset(
        { id: `ai-image-${Date.now()}`, url: imageUrl, thumbUrl: imageUrl, width: size.width, height: size.height, name: 'AI image', kind: 'image' },
        at,
      )
      const requestedWidth = readNumber(params.width)
      const live = engine.selectedObjects()[0]
      if (requestedWidth !== undefined && live) {
        live.scaleToWidth(clamp(requestedWidth, 10, page.width * 2))
        live.setCoords()
        engine.commit(engine.state.activePageId, { label: 'AI: size image' })
      }
      return { ok: true, imageUrl, width: size.width, height: size.height }
    }

    case 'get_canvas_screenshot': {
      const doc = engine.getDocument()
      const page = doc.pages.find((candidate) => candidate.id === engine.state.activePageId) ?? doc.pages[0]
      if (!page) throw new Error('There is no page to look at yet.')
      const size = engine.pageSizeOf(page.id)
      const multiplier = Math.min(1, 1024 / Math.max(size.width, size.height))
      const canvas = await renderPageToCanvas(page, size, engine.loadContext, { multiplier })
      return { format: 'jpeg', width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL('image/jpeg', 0.82) }
    }

    case 'use_template': {
      const slug = readString(params.slug).trim()
      if (!/^[\w-]{1,120}$/.test(slug)) throw new Error('Pass a template slug, e.g. bold-sale-announcement.')
      try {
        await templatesApi.get(slug)
      } catch {
        throw new Error(`No template found with the slug "${slug}". Check the templates gallery for the right slug.`)
      }
      // Leave a beat for this reply to reach the assistant before the editor goes away.
      window.setTimeout(() => window.location.assign(`/create?template=${encodeURIComponent(slug)}`), 400)
      return { ok: true, opening: slug, message: 'Opening the template as a new design now.' }
    }

    case 'rename_design': {
      if (engine.readOnly) throw new Error('This design is view-only; its title cannot be changed.')
      const title = readString(params.title).trim().slice(0, 120)
      if (!title) throw new Error('A design title cannot be empty.')
      engine.setTitle(title)
      onTitleChange(engine.state.title)
      return { ok: true, title: engine.state.title }
    }

    default:
      throw new Error(`Unknown canvas method: ${method}`)
  }
}

function socketAddress(): string {
  const url = new URL('/bridge', window.location.href)
  url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

/** Registers one live editor session with the Node MCP server and handles its canvas commands. */
export function CanvasMcpBridge({ sessionId, designId, onStatusChange, onTitleChange }: {
  sessionId: string
  designId: string
  onStatusChange: (status: BridgeStatus) => void
  onTitleChange: (title: string) => void
}) {
  const engine = useEditor()
  const titleChangeRef = useRef(onTitleChange)
  const statusChangeRef = useRef(onStatusChange)
  useEffect(() => { titleChangeRef.current = onTitleChange }, [onTitleChange])
  useEffect(() => { statusChangeRef.current = onStatusChange }, [onStatusChange])

  useEffect(() => {
    let disposed = false
    let socket: WebSocket | null = null
    let retryTimer: number | undefined
    let attempt = 0

    const connect = (): void => {
      if (disposed) return
      statusChangeRef.current('connecting')
      socket = new WebSocket(socketAddress())

      socket.addEventListener('open', () => {
        socket?.send(JSON.stringify({ type: 'register', sessionId, designId }))
      })
      socket.addEventListener('message', (event) => {
        let message: BridgeMessage
        try {
          message = JSON.parse(String(event.data)) as BridgeMessage
        } catch {
          return
        }
        if (message.type === 'registered') {
          attempt = 0
          statusChangeRef.current('connected')
          return
        }
        if (typeof message.id !== 'string' || typeof message.method !== 'string') return
        void executeCanvasRequest(engine, message.method, message.params, (title) => titleChangeRef.current(title)).then(
          (result) => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ id: message.id, result })),
          (error: unknown) => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ id: message.id, error: error instanceof Error ? error.message : 'The canvas action failed.' })),
        )
      })
      socket.addEventListener('close', () => {
        if (disposed) return
        statusChangeRef.current('disconnected')
        const delay = Math.min(30_000, 800 * 2 ** attempt++)
        retryTimer = window.setTimeout(connect, delay)
      })
      socket.addEventListener('error', () => socket?.close())
    }

    connect()
    return () => {
      disposed = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      socket?.close(1000, 'Editor closed')
      statusChangeRef.current('disconnected')
    }
  }, [engine, sessionId, designId])

  return null
}
