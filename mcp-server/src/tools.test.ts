import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { CanvasBridge } from './canvasBridge.js'
import { createMcpServer } from './tools.js'

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
    ])
    assert.equal(tools.find((tool) => tool.name === 'delete_selected')?.annotations?.destructiveHint, true)
  })
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
