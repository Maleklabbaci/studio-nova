import 'dotenv/config'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { WebSocketServer } from 'ws'
import { z } from 'zod'
import { runAssistantTurn, type ChatMessage } from './assistant.js'
import { CanvasBridge } from './canvasBridge.js'
import { createMcpServer } from './tools.js'

const app = express()
const httpServer = createServer(app)
const bridgeSocketServer = new WebSocketServer({ noServer: true, maxPayload: 1_048_576, perMessageDeflate: false })
const bridge = new CanvasBridge()
bridge.attach(bridgeSocketServer)
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

const transports = new Map<string, StreamableHTTPServerTransport>()
const mcpServers = new Map<string, McpServer>()
const chatBudgets = new Map<string, { count: number; resetAt: number }>()
const CHAT_WINDOW_MS = 60_000
const CHAT_REQUESTS_PER_WINDOW = 10
const SESSION_ID = /^[a-zA-Z0-9_-]{8,128}$/
const ChatRequestSchema = z.object({
  sessionId: z.string().regex(SESSION_ID),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }).strict()).min(1).max(16),
}).strict()

function llmSettings() {
  return {
    apiKey: process.env.LLM_API_KEY?.trim() ?? '',
    baseUrl: process.env.LLM_BASE_URL?.trim() || 'https://api.openai.com/v1',
    model: process.env.LLM_MODEL?.trim() || 'gpt-4o-mini',
    timeoutMs: Number.isFinite(Number(process.env.LLM_TIMEOUT_MS)) ? Math.max(5_000, Math.min(120_000, Number(process.env.LLM_TIMEOUT_MS))) : 45_000,
  }
}

function sendJsonError(res: express.Response, status: number, message: string): void {
  res.status(status).json({ error: message })
}

function hasMcpAuthorization(req: express.Request): boolean {
  const expected = process.env.MCP_AUTH_TOKEN?.trim() ?? ''
  // Fail closed on public deployments rather than exposing canvas-editing tools without an operator token.
  if (!expected) return process.env.NODE_ENV !== 'production'
  const header = req.header('authorization') ?? ''
  const provided = header.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
}

function isWithinChatBudget(sessionId: string): boolean {
  const now = Date.now()
  const budget = chatBudgets.get(sessionId)
  if (!budget || budget.resetAt <= now) {
    chatBudgets.set(sessionId, { count: 1, resetAt: now + CHAT_WINDOW_MS })
    if (chatBudgets.size > 5_000) {
      for (const [id, item] of chatBudgets) if (item.resetAt <= now) chatBudgets.delete(id)
    }
    return true
  }
  if (budget.count >= CHAT_REQUESTS_PER_WINDOW) return false
  budget.count += 1
  return true
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'studio-nova-mcp', version: '0.1.0' })
})

app.get('/assistant/status', (_req, res) => {
  const settings = llmSettings()
  res.json({
    configured: Boolean(settings.apiKey),
    model: settings.model,
    bridgeConnected: bridge.connectedCount() > 0,
    connectedEditors: bridge.connectedCount(),
  })
})

app.post('/assistant/chat', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    sendJsonError(res, 400, 'Invalid chat payload. Send a sessionId and up to 16 short user/assistant messages.')
    return
  }
  const messages = parsed.data.messages.map((message) => ({ role: message.role, content: message.content.trim() })).filter((message) => message.content)
  if (messages.length === 0 || messages.at(-1)?.role !== 'user') {
    sendJsonError(res, 400, 'The last chat message must be a non-empty user message.')
    return
  }
  const settings = llmSettings()
  if (!settings.apiKey) {
    sendJsonError(res, 503, 'AI is not configured yet. Set LLM_API_KEY in mcp-server/.env, then restart the MCP server.')
    return
  }
  if (!bridge.isConnected(parsed.data.sessionId)) {
    sendJsonError(res, 409, 'This editor is not connected to the MCP bridge. Reopen the design and try again.')
    return
  }
  if (!isWithinChatBudget(parsed.data.sessionId)) {
    res.setHeader('Retry-After', '60')
    sendJsonError(res, 429, 'Too many AI requests for this editor. Please wait a minute before trying again.')
    return
  }

  try {
    const result = await runAssistantTurn(bridge, parsed.data.sessionId, messages as ChatMessage[], settings)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The AI request failed.'
    const status = message.startsWith('AI provider error:') ? 502 : 500
    sendJsonError(res, status, message.slice(0, 500))
  }
})

async function handleMcpRequest(req: express.Request, res: express.Response): Promise<void> {
  const sessionId = req.header('mcp-session-id')
  if (sessionId) {
    const transport = transports.get(sessionId)
    if (!transport) {
      sendJsonError(res, 404, 'Unknown MCP session. Re-initialize the connection.')
      return
    }
    await transport.handleRequest(req, res, req.body)
    return
  }

  if (req.method === 'POST' && isInitializeRequest(req.body)) {
    let transport!: StreamableHTTPServerTransport
    const mcpServer = createMcpServer(bridge)
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport)
        mcpServers.set(id, mcpServer)
      },
      onsessionclosed: (id) => {
        transports.delete(id)
        const server = mcpServers.get(id)
        mcpServers.delete(id)
        void server?.close()
      },
      enableJsonResponse: true,
      maxRequestBodySize: 1_048_576,
    })
    // The SDK transport declares its optional event callbacks as `T | undefined` while the base interface uses optional properties.
    await mcpServer.connect(transport as unknown as Transport)
    await transport.handleRequest(req, res, req.body)
    return
  }

  sendJsonError(res, 400, 'Missing MCP session id. Initialize the Streamable HTTP connection first.')
}

app.all('/mcp', (req, res, next) => {
  if (!hasMcpAuthorization(req)) {
    const code = process.env.MCP_AUTH_TOKEN?.trim() ? 401 : 503
    sendJsonError(res, code, code === 401 ? 'A valid Bearer token is required for the MCP endpoint.' : 'MCP is disabled in production until MCP_AUTH_TOKEN is configured.')
    return
  }
  void handleMcpRequest(req, res).catch(next)
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unexpected MCP server error.'
  if (!res.headersSent) sendJsonError(res, 500, message.slice(0, 500))
})

const allowedOrigins = (process.env.BRIDGE_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean)
httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname
  if (pathname !== '/bridge') {
    socket.destroy()
    return
  }
  const origin = request.headers.origin
  const requireAllowedOrigin = process.env.NODE_ENV === 'production' || allowedOrigins.length > 0
  if (requireAllowedOrigin && (!origin || !allowedOrigins.includes(origin))) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    socket.destroy()
    return
  }
  bridgeSocketServer.handleUpgrade(request, socket, head, (webSocket) => bridgeSocketServer.emit('connection', webSocket, request))
})

const port = Number(process.env.PORT) || 8787
const host = process.env.HOST?.trim() || '127.0.0.1'
httpServer.listen(port, host, () => {
  console.log(`Studio Nova MCP bridge listening at http://${host}:${port}`)
  console.log(`MCP endpoint: http://${host}:${port}/mcp`)
})

function shutdown(): void {
  bridge.close()
  bridgeSocketServer.close()
  for (const server of mcpServers.values()) void server.close()
  httpServer.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5_000).unref()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
