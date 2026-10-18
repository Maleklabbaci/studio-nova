import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { extractImageContent } from './assistant.js'
import { CanvasBridge } from './canvasBridge.js'
import { createMcpServer, getToolDefinition, OPENAI_TOOLS, screenshotMcpContent, TOOL_DEFINITIONS } from './tools.js'

async function withMcpClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const server = createMcpServer(new CanvasBridge())
  const client = new Client({ name: 'studio-nova-test-client', version: '0.1.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    return await run(client)
  } finally {
    await client.close().catch(() => undefined)
    await server.close().catch(() => undefined)
  }
}

test('publishes all canvas operations through the official MCP protocol', async () => {
  await withMcpClient(async (client) => {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((tool) => tool.name), [
      'get_canvas_state',
      'add_text',
      'add_shape',
      'set_background',
      'add_page',
      'duplicate_selected',
      'delete_selected',
      'rename_design',
      'select_elements',
      'update_element',
      'delete_element',
      'duplicate_element',
      'align_elements',
      'arrange_element',
      'add_image',
      'get_canvas_screenshot',
      'use_template',
    ])
    assert.equal(tools.find((tool) => tool.name === 'delete_selected')?.annotations?.destructiveHint, true)
    assert.equal(tools.find((tool) => tool.name === 'delete_element')?.annotations?.destructiveHint, true)
    assert.equal(tools.find((tool) => tool.name === 'get_canvas_screenshot')?.annotations?.readOnlyHint, true)
  })
})

test('keeps the OpenAI tool list in sync with the MCP registry', () => {
  assert.deepEqual(OPENAI_TOOLS.map((tool) => tool.function.name), TOOL_DEFINITIONS.map((tool) => tool.name))
  for (const tool of OPENAI_TOOLS) {
    assert.equal(tool.function.parameters.additionalProperties, false)
  }
})

test('validates the new editing tools before anything reaches the editor', async () => {
  await withMcpClient(async (client) => {
    const badColor = await client.callTool({ name: 'update_element', arguments: { element_id: 'el-1', color: 'red' } })
    assert.equal(badColor.isError, true)
    const badOpacity = await client.callTool({ name: 'update_element', arguments: { element_id: 'el-1', opacity: 2 } })
    assert.equal(badOpacity.isError, true)
    const badAlign = await client.callTool({ name: 'align_elements', arguments: { align: 'diagonal' } })
    assert.equal(badAlign.isError, true)
    const badImage = await client.callTool({ name: 'add_image', arguments: { image_url: 'http://example.com/pic.png' } })
    assert.equal(badImage.isError, true)
    const badSlug = await client.callTool({ name: 'use_template', arguments: { slug: 'not a slug!' } })
    assert.equal(badSlug.isError, true)
  })
  assert.ok(getToolDefinition('update_element'))
  assert.equal(getToolDefinition('update_anything'), undefined)
})

test('turns a screenshot result into MCP image content the model can see', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  assert.deepEqual(screenshotMcpContent({ dataUrl: `data:image/png;base64,${png}` }), [
    { type: 'image', data: png, mimeType: 'image/png' },
  ])
  assert.equal(screenshotMcpContent({ dataUrl: 'https://example.com/x.png' }), null)
  assert.equal(screenshotMcpContent({ ok: true }), null)
  assert.equal(screenshotMcpContent(null), null)
})

test('extracts image content for the assistant loop and ignores text results', () => {
  const image = { type: 'image', data: 'AAAA', mimeType: 'image/jpeg' }
  assert.deepEqual(extractImageContent({ content: [{ type: 'text', text: 'hi' }, image] }), { data: 'AAAA', mimeType: 'image/jpeg' })
  assert.equal(extractImageContent({ content: [{ type: 'text', text: 'hi' }] }), null)
  assert.equal(extractImageContent('nope'), null)
})

test('validates tool input and returns an MCP error when no editor is connected', async () => {
  await withMcpClient(async (client) => {
    const invalid = await client.callTool({ name: 'set_background', arguments: { color: '#fff' } })
    assert.equal(invalid.isError, true)

    const disconnected = await client.callTool({ name: 'get_canvas_state', arguments: {} })
    assert.equal(disconnected.isError, true)
    const content = disconnected.content as Array<{ type: string; text?: string }>
    const errorText = content.find((part) => part.type === 'text')
    assert.ok(errorText?.text)
    assert.match(errorText.text, /No active Studio Nova editor is connected/)
  })
})
