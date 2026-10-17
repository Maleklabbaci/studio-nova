import { useEffect, useRef } from 'react'
import type { DocObject, PageBackground } from '@/types/document'
import { createTextbox } from '../engine/objects/factories'
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
