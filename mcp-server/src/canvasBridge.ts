import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import WebSocket, { WebSocketServer } from 'ws'

export type CanvasMethod =
  | 'get_canvas_state'
  | 'add_text'
  | 'add_shape'
  | 'set_background'
  | 'add_page'
  | 'delete_selected'
  | 'duplicate_selected'
  | 'rename_design'
  | 'select_elements'
  | 'update_element'
  | 'delete_element'
  | 'duplicate_element'
  | 'align_elements'
  | 'arrange_element'
  | 'add_image'
  | 'get_canvas_screenshot'
  | 'use_template'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: NodeJS.Timeout
}

interface CanvasConnection {
  socket: WebSocket
  sessionId: string | null
  designId: string | null
  pending: Map<string, PendingRequest>
  connectedAt: number
}

interface RegisterMessage {
  type: 'register'
  sessionId: string
  designId: string
}

interface ResponseMessage {
  id: string
  result?: unknown
  error?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const SESSION_ID = /^[a-zA-Z0-9_-]{8,128}$/
const REQUEST_TIMEOUT_MS = 20_000

/** A same-origin WebSocket bridge between MCP tool calls and a mounted Studio Nova editor. */
export class CanvasBridge {
  private readonly sessions = new Map<string, CanvasConnection>()
  private readonly connections = new Set<CanvasConnection>()

  attach(server: WebSocketServer): void {
    server.on('connection', (socket, request) => this.accept(socket, request))
  }

  private accept(socket: WebSocket, _request: IncomingMessage): void {
    const connection: CanvasConnection = {
      socket,
      sessionId: null,
      designId: null,
      pending: new Map(),
      connectedAt: Date.now(),
    }
    this.connections.add(connection)

    socket.on('message', (raw) => {
      let message: unknown
      try {
        message = JSON.parse(raw.toString()) as unknown
      } catch {
        socket.close(1003, 'Messages must be JSON')
        return
      }

      if (isRecord(message) && message.type === 'register') {
        this.register(connection, message as unknown as RegisterMessage)
        return
      }
      this.resolveResponse(connection, message)
    })

    socket.on('close', () => this.forget(connection, new Error('The editor disconnected from the MCP bridge.')))
    socket.on('error', () => this.forget(connection, new Error('The editor bridge connection failed.')))
  }

  private register(connection: CanvasConnection, message: RegisterMessage): void {
    if (typeof message.sessionId !== 'string' || !SESSION_ID.test(message.sessionId) || typeof message.designId !== 'string') {
      connection.socket.close(1008, 'Invalid editor registration')
      return
    }

    const previous = this.sessions.get(message.sessionId)
    if (previous && previous !== connection) {
      previous.socket.close(4001, 'A newer editor session replaced this one.')
      this.forget(previous, new Error('A newer editor tab replaced this canvas session.'))
    }

    connection.sessionId = message.sessionId
    connection.designId = message.designId.slice(0, 160)
    this.sessions.set(message.sessionId, connection)
    this.send(connection.socket, { type: 'registered', sessionId: message.sessionId })
  }

  private resolveResponse(connection: CanvasConnection, value: unknown): void {
    if (!isRecord(value) || typeof value.id !== 'string') return
    const pending = connection.pending.get(value.id)
    if (!pending) return
    clearTimeout(pending.timer)
    connection.pending.delete(value.id)
    if (typeof value.error === 'string') pending.reject(new Error(value.error.slice(0, 500)))
    else pending.resolve(value.result)
  }

  private forget(connection: CanvasConnection, error: Error): void {
    this.connections.delete(connection)
    if (connection.sessionId && this.sessions.get(connection.sessionId) === connection) this.sessions.delete(connection.sessionId)
    for (const pending of connection.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    connection.pending.clear()
  }

  private send(socket: WebSocket, value: unknown): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
  }

  activeSessionId(): string | null {
    let latest: CanvasConnection | null = null
    for (const connection of this.sessions.values()) {
      if (connection.socket.readyState !== WebSocket.OPEN) continue
      if (!latest || connection.connectedAt > latest.connectedAt) latest = connection
    }
    return latest?.sessionId ?? null
  }

  isConnected(sessionId?: string): boolean {
    const id = sessionId ?? this.activeSessionId()
    return id ? this.sessions.get(id)?.socket.readyState === WebSocket.OPEN : false
  }

  connectedCount(): number {
    return [...this.sessions.values()].filter((session) => session.socket.readyState === WebSocket.OPEN).length
  }

  /** Executes one editor operation and waits for the browser to return its result. */
  request(sessionId: string | undefined, method: CanvasMethod, params: Record<string, unknown> = {}): Promise<unknown> {
    const target = sessionId ?? this.activeSessionId() ?? undefined
    const connection = target ? this.sessions.get(target) : undefined
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      throw new Error('No active Studio Nova editor is connected. Open a design in the browser and retry.')
    }

    const id = randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        connection.pending.delete(id)
        reject(new Error('The editor did not answer the MCP request in time.'))
      }, REQUEST_TIMEOUT_MS)
      connection.pending.set(id, { resolve, reject, timer })
      connection.socket.send(JSON.stringify({ id, method, params }), (error) => {
        if (!error) return
        clearTimeout(timer)
        connection.pending.delete(id)
        reject(error)
      })
    })
  }

  close(): void {
    for (const connection of this.connections) {
      this.forget(connection, new Error('The MCP server is shutting down.'))
      connection.socket.close(1001, 'MCP server is shutting down')
    }
  }
}
