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

const ELEMENT_ID = z.string().min(1).max(160)
const ELEMENT_IDS = z.array(ELEMENT_ID).min(1).max(50)

const selectElements: ToolDefinition = {
  name: 'select_elements',
  title: 'Select elements',
  description: 'Select one or more elements on the active page by the ids returned by get_canvas_state. Selection is what duplicate, delete and arrange actions work on.',
  schema: z.object({ session_id: SESSION_ID, element_ids: ELEMENT_IDS }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      element_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50 },
    },
    required: ['element_ids'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'select_elements', { elementIds: args.element_ids }),
}

const updateElement: ToolDefinition = {
  name: 'update_element',
  title: 'Update an element',
  description: 'Change an existing element (find its id with get_canvas_state): its text, position, size, fill color, font size, font family, bold/italic, opacity or rotation. Only the provided fields change.',
  schema: z.object({
    session_id: SESSION_ID,
    element_id: ELEMENT_ID,
    text: z.string().max(2000).optional(),
    x: z.number().min(0).max(20_000).optional(),
    y: z.number().min(0).max(20_000).optional(),
    width: z.number().min(1).max(20_000).optional(),
    height: z.number().min(1).max(20_000).optional(),
    color: COLOR.optional(),
    font_size: z.number().int().min(8).max(400).optional(),
    font_family: z.string().trim().min(1).max(80).optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(),
    rotation: z.number().min(-360).max(360).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      element_id: { type: 'string', description: 'Element id from get_canvas_state.' },
      text: { type: 'string', maxLength: 2000, description: 'New text content (text elements only).' },
      x: { type: 'number', minimum: 0, maximum: 20000, description: 'New left position in page pixels.' },
      y: { type: 'number', minimum: 0, maximum: 20000, description: 'New top position in page pixels.' },
      width: { type: 'number', minimum: 1, maximum: 20000 },
      height: { type: 'number', minimum: 1, maximum: 20000 },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: 'New fill (or text) color.' },
      font_size: { type: 'integer', minimum: 8, maximum: 400 },
      font_family: { type: 'string', maxLength: 80, description: 'Font family name, e.g. Poppins.' },
      bold: { type: 'boolean' },
      italic: { type: 'boolean' },
      opacity: { type: 'number', minimum: 0, maximum: 1 },
      rotation: { type: 'number', minimum: -360, maximum: 360, description: 'Angle in degrees.' },
    },
    required: ['element_id'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'update_element', {
    elementId: args.element_id,
    ...(args.text !== undefined ? { text: args.text } : {}),
    ...(args.x !== undefined ? { x: args.x } : {}),
    ...(args.y !== undefined ? { y: args.y } : {}),
    ...(args.width !== undefined ? { width: args.width } : {}),
    ...(args.height !== undefined ? { height: args.height } : {}),
    ...(args.color ? { color: args.color } : {}),
    ...(args.font_size ? { fontSize: args.font_size } : {}),
    ...(args.font_family ? { fontFamily: args.font_family } : {}),
    ...(args.bold !== undefined ? { bold: args.bold } : {}),
    ...(args.italic !== undefined ? { italic: args.italic } : {}),
    ...(args.opacity !== undefined ? { opacity: args.opacity } : {}),
    ...(args.rotation !== undefined ? { rotation: args.rotation } : {}),
  }),
}

const deleteElement: ToolDefinition = {
  name: 'delete_element',
  title: 'Delete an element',
  description: 'Delete one element by id (from get_canvas_state). Only call this when the user clearly requests that exact removal.',
  schema: z.object({ session_id: SESSION_ID, element_id: ELEMENT_ID }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      element_id: { type: 'string' },
    },
    required: ['element_id'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'delete_element', { elementId: args.element_id }),
}

const duplicateElement: ToolDefinition = {
  name: 'duplicate_element',
  title: 'Duplicate an element',
  description: 'Duplicate one element by id (from get_canvas_state); the copy lands slightly offset from the original.',
  schema: z.object({ session_id: SESSION_ID, element_id: ELEMENT_ID }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      element_id: { type: 'string' },
    },
    required: ['element_id'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'duplicate_element', { elementId: args.element_id }),
}

const alignElements: ToolDefinition = {
  name: 'align_elements',
  title: 'Align elements',
  description: 'Align elements to the page: left, center, right, top, middle or bottom edges/centers. Pass element_ids to align those, or omit to use the current selection.',
  schema: z.object({
    session_id: SESSION_ID,
    align: z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom']),
    element_ids: ELEMENT_IDS.optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      align: { type: 'string', enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'] },
      element_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50 },
    },
    required: ['align'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'align_elements', {
    align: args.align,
    ...(Array.isArray(args.element_ids) ? { elementIds: args.element_ids } : {}),
  }),
}

const arrangeElement: ToolDefinition = {
  name: 'arrange_element',
  title: 'Reorder an element',
  description: 'Change the stacking order of one element by id: forward, backward, front (top) or back (bottom).',
  schema: z.object({
    session_id: SESSION_ID,
    element_id: ELEMENT_ID,
    order: z.enum(['forward', 'backward', 'front', 'back']),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      element_id: { type: 'string' },
      order: { type: 'string', enum: ['forward', 'backward', 'front', 'back'] },
    },
    required: ['element_id', 'order'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'arrange_element', { elementId: args.element_id, order: args.order }),
}

const addImage: ToolDefinition = {
  name: 'add_image',
  title: 'Add an image from a URL',
  description: 'Add a photo or picture to the active page from an https image URL. Prefer URLs the user provides or official image hosts; the image becomes a normal movable layer.',
  schema: z.object({
    session_id: SESSION_ID,
    image_url: z.string().url().max(2048).refine((value) => value.startsWith('https://'), 'Use an https image URL.'),
    x: z.number().min(0).max(20_000).optional(),
    y: z.number().min(0).max(20_000).optional(),
    width: z.number().int().min(10).max(20_000).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      image_url: { type: 'string', maxLength: 2048, description: 'Direct https URL of an image file.' },
      x: { type: 'number', minimum: 0, maximum: 20000, description: 'Optional center x.' },
      y: { type: 'number', minimum: 0, maximum: 20000, description: 'Optional center y.' },
      width: { type: 'integer', minimum: 10, maximum: 20000, description: 'Optional display width in page pixels.' },
    },
    required: ['image_url'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'add_image', {
    imageUrl: args.image_url,
    ...(args.x !== undefined ? { x: args.x } : {}),
    ...(args.y !== undefined ? { y: args.y } : {}),
    ...(args.width !== undefined ? { width: args.width } : {}),
  }),
}

const getCanvasScreenshot: ToolDefinition = {
  name: 'get_canvas_screenshot',
  title: 'Look at the current page',
  description: 'Render the active page and return it as an image so you can actually see the design: check overlaps, balance and readability. Use after several edits, or whenever the user asks how it looks. Vision models only.',
  schema: z.object({ session_id: SESSION_ID }),
  jsonSchema: { type: 'object', properties: { session_id: { type: 'string', description: 'Optional active browser session id.' } }, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  run: (_args, bridge, sessionId) => bridge.request(sessionId, 'get_canvas_screenshot'),
}

const useTemplate: ToolDefinition = {
  name: 'use_template',
  title: 'Open a template as a new design',
  description: 'Open an existing Studio Nova template (by its slug) as a new design. This leaves the current editor, so only call it when the user clearly asks to start from that template. The current design is saved automatically.',
  schema: z.object({ session_id: SESSION_ID, slug: z.string().regex(/^[\w-]{1,120}$/, 'Use a template slug, e.g. bold-sale-announcement.') }),
  jsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Optional browser session id.' },
      slug: { type: 'string', pattern: '^[\\w-]{1,120}$', description: 'Template slug from the templates gallery.' },
    },
    required: ['slug'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  run: (args, bridge, sessionId) => bridge.request(sessionId, 'use_template', { slug: args.slug }),
}

export const TOOL_DEFINITIONS = [getCanvasState, addText, addShape, setBackground, addPage, duplicateSelected, deleteSelected, renameDesign, selectElements, updateElement, deleteElement, duplicateElement, alignElements, arrangeElement, addImage, getCanvasScreenshot, useTemplate] as const

type McpContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

/** A screenshot tool result ({ dataUrl }) becomes real MCP image content, so vision hosts actually see it. */
export function screenshotMcpContent(result: unknown): McpContent[] | null {
  if (typeof result !== 'object' || result === null) return null
  const dataUrl = (result as { dataUrl?: unknown }).dataUrl
  if (typeof dataUrl !== 'string') return null
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match || match[1] === undefined || match[2] === undefined) return null
  return [{ type: 'image', data: match[2], mimeType: match[1] }]
}

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
        if (tool.name === 'get_canvas_screenshot') {
          const image = screenshotMcpContent(result)
          if (image) return { content: image }
        }
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
