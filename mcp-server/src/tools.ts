import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { CanvasBridge } from './canvasBridge.js'

const SESSION_ID = z.string().min(8).max(128).optional()
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const COLOR = z.string().regex(HEX_COLOR, 'Use a six-digit hex color such as #E45C46.')

type ToolInput = Record<string, unknown>
type InputSchema = z.ZodTypeAny

interface ToolDefinition {
  name: string
  title: string
  description: string
  schema: InputSchema
  jsonSchema: Record<string, unknown>
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean }
  run(args: ToolInput, bridge: CanvasBridge, sessionId?: string): Promise<unknown>
}

const getCanvasState: ToolDefinition = {
  name: 'get_canvas_state',
  title: 'Inspect the active design',
  description: 'Return the active Studio Nova design, page size, background, layer summaries, selection, and edit permissions.',
  schema: z.object({ session_id: SESSION_ID }),
  jsonSchema: { type: 'object', properties: { session_id: { type: 'string', description: 'Optional active browser session id.' } }, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  run: (_args, bridge, sessionId) => bridge.request(sessionId, 'get_canvas_state'),
}

const addText: ToolDefinition = {
  name: 'add_text',
  title: 'Add text to the canvas',
  description: 'Add a heading or body text box to the active page. The text is editable and placed near the center unless coordinates are provided.',
  schema: z.object({
    session_id: SESSION_ID,
    text: z.string().trim().min(1).max(500),
    style: z.enum(['heading', 'body']).optional(),
    color: COLOR.optional(),
    font_size: z.number().int().min(10).max(160).optional(),
    x: z.number().min(0).max(20_000).optional(),
    y: z.number().min(0).max(20_000).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id; the in-app assistant routes this automatically.' },
      text: { type: 'string', minLength: 1, maxLength: 500 },
      style: { type: 'string', enum: ['heading', 'body'] },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: 'Optional six-digit hex color.' },
      font_size: { type: 'integer', minimum: 10, maximum: 160 },
      x: { type: 'number', minimum: 0, maximum: 20000, description: 'Optional page-space center coordinate.' },
      y: { type: 'number', minimum: 0, maximum: 20000, description: 'Optional page-space center coordinate.' },
    },
    required: ['text'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'add_text', {
    text: args.text,
    style: args.style ?? 'heading',
    ...(args.color ? { color: args.color } : {}),
    ...(args.font_size ? { fontSize: args.font_size } : {}),
    ...(args.x !== undefined ? { x: args.x } : {}),
    ...(args.y !== undefined ? { y: args.y } : {}),
  }),
}

const addShape: ToolDefinition = {
  name: 'add_shape',
  title: 'Add a shape to the canvas',
  description: 'Add a basic geometric shape to the active page. Supported shapes: rounded rectangle, rectangle, circle, triangle, star, diamond, line, or arrow.',
  schema: z.object({
    session_id: SESSION_ID,
    shape: z.enum(['rect', 'rounded', 'ellipse', 'triangle', 'star', 'diamond', 'line', 'arrow']),
    color: COLOR.optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      shape: { type: 'string', enum: ['rect', 'rounded', 'ellipse', 'triangle', 'star', 'diamond', 'line', 'arrow'] },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    },
    required: ['shape'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'add_shape', {
    shape: args.shape,
    ...(args.color ? { color: args.color } : {}),
  }),
}

const setBackground: ToolDefinition = {
  name: 'set_background',
  title: 'Change the page background',
  description: 'Set a page background to a solid hex color. By default only the active page changes; set all_pages to true to update every page.',
  schema: z.object({ session_id: SESSION_ID, color: COLOR, all_pages: z.boolean().optional() }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: 'Six-digit hex color.' },
      all_pages: { type: 'boolean', description: 'Apply to every page instead of only the active page.' },
    },
    required: ['color'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'set_background', {
    color: args.color,
    allPages: args.all_pages === true,
  }),
}

const addPage: ToolDefinition = {
  name: 'add_page',
  title: 'Add a design page',
  description: 'Add a blank page after the active page and optionally give it a name.',
  schema: z.object({ session_id: SESSION_ID, name: z.string().trim().max(80).optional() }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      name: { type: 'string', maxLength: 80 },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'add_page', { ...(args.name ? { name: args.name } : {}) }),
}

const duplicateSelected: ToolDefinition = {
  name: 'duplicate_selected',
  title: 'Duplicate selected layers',
  description: 'Duplicate the currently selected layer or layers on the active page.',
  schema: z.object({ session_id: SESSION_ID }),
  jsonSchema: { type: 'object', properties: { session_id: { type: 'string', description: 'Optional browser session id.' } }, additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  run: (_args, bridge, sessionId) => bridge.request(sessionId, 'duplicate_selected'),
}

const deleteSelected: ToolDefinition = {
  name: 'delete_selected',
  title: 'Delete selected layers',
  description: 'Delete the currently selected unlocked layer or layers. Only call this when the user clearly requests removal.',
  schema: z.object({ session_id: SESSION_ID }),
  jsonSchema: { type: 'object', properties: { session_id: { type: 'string', description: 'Optional browser session id.' } }, additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  run: (_args, bridge, sessionId) => bridge.request(sessionId, 'delete_selected'),
}

const renameDesign: ToolDefinition = {
  name: 'rename_design',
  title: 'Rename the design',
  description: 'Change the title of the current design.',
  schema: z.object({ session_id: SESSION_ID, title: z.string().trim().min(1).max(120) }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      title: { type: 'string', minLength: 1, maxLength: 120 },
    },
    required: ['title'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'rename_design', { title: args.title }),
}

export const TOOL_DEFINITIONS = [getCanvasState, addText, addShape, setBackground, addPage, duplicateSelected, deleteSelected, renameDesign] as const

export const OPENAI_TOOLS = TOOL_DEFINITIONS.map((tool) => ({
  type: 'function' as const,
  function: { name: tool.name, description: tool.description, parameters: tool.jsonSchema },
}))

/** Build an official MCP server instance, optionally pinned to one browser session for the in-app assistant. */
export function createMcpServer(bridge: CanvasBridge, fixedSessionId?: string): McpServer {
  const server = new McpServer({ name: 'studio-nova-canvas', version: '0.1.0' })
  for (const tool of TOOL_DEFINITIONS) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.schema,
      annotations: tool.annotations,
    }, async (rawArgs) => {
      try {
        const args = tool.schema.parse(rawArgs) as ToolInput
        const requestedSession = typeof args.session_id === 'string' ? args.session_id : undefined
        const targetSession = fixedSessionId ?? requestedSession
        const result = await tool.run(args, bridge, targetSession)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      } catch (error) {
        return {
          content: [{ type: 'text', text: error instanceof Error ? error.message : 'The canvas action failed.' }],
          isError: true,
        }
      }
    })
  }
  return server
}

/** The web chat uses an in-memory MCP client, so its model tool calls travel through the same MCP registry as external hosts. */
export async function createAssistantMcpClient(bridge: CanvasBridge, sessionId: string): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createMcpServer(bridge, sessionId)
  const client = new Client({ name: 'studio-nova-assistant', version: '0.1.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  return {
    client,
    close: async () => {
      await client.close().catch(() => undefined)
      await server.close().catch(() => undefined)
    },
  }
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((tool) => tool.name === name)
}
