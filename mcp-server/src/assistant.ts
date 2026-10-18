import { createAssistantMcpClient, OPENAI_TOOLS } from './tools.js'
import { CanvasBridge } from './canvasBridge.js'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmSettings {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
}

interface OpenAiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface OpenAiResponse {
  choices?: Array<{
    message?: {
      role?: 'assistant'
      content?: string | null
      tool_calls?: OpenAiToolCall[]
    }
  }>
  error?: { message?: string }
}

type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null | OpenAiContentPart[]
  tool_calls?: OpenAiToolCall[]
  tool_call_id?: string
}

const MAX_ACTIONS = 16
const MAX_TOOL_ROUNDS = 8
const HISTORY_MESSAGES = 24

const SYSTEM_PROMPT = `You are Studio Nova's design assistant, working inside a visual design editor. Help the user make concrete, thoughtful changes to their current design. Respond in the same language as the user and keep the tone warm and concise. You can directly inspect and edit the active canvas using MCP tools. Use get_canvas_state when you need context; it lists every element with its id, and update_element changes any of them (text, position, size, color, font, opacity, rotation). Align and arrange elements to keep layouts tidy, and add_image places a picture from an https URL. Use get_canvas_screenshot after several edits, or whenever the user asks how the design looks, and fix what you see (overlaps, imbalance, unreadable text) instead of guessing. Only use use_template when the user clearly asks to start from a template, and only delete when the user clearly asks for that removal. Do not claim an edit succeeded unless a tool confirms it. Use the Studio Nova coral-and-charcoal palette when a user asks for a branded or polished look. Ask a short clarifying question rather than making a risky assumption. Do not include session_id in tool calls; the current editor is already selected. The editor supports undo, so summarize applied actions clearly.`

/** The MCP image content of a screenshot tool result, when there is one. */
export function extractImageContent(result: unknown): { data: string; mimeType: string } | null {
  if (typeof result !== 'object' || result === null) return null
  const content = (result as { content?: unknown }).content
  if (!Array.isArray(content)) return null
  for (const part of content) {
    if (typeof part !== 'object' || part === null) continue
    const item = part as { type?: unknown; data?: unknown; mimeType?: unknown }
    if (item.type === 'image' && typeof item.data === 'string' && typeof item.mimeType === 'string') {
      return { data: item.data, mimeType: item.mimeType }
    }
  }
  return null
}

function chatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
}

async function requestCompletion(settings: LlmSettings, messages: OpenAiMessage[], forceText: boolean): Promise<OpenAiResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs)
  try {
    const response = await fetch(chatCompletionsUrl(settings.baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${settings.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        tools: OPENAI_TOOLS,
        tool_choice: forceText ? 'none' : 'auto',
        temperature: 0.35,
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({})) as OpenAiResponse
    if (!response.ok) {
      const detail = payload.error?.message?.trim()
      throw new Error(detail ? `AI provider error: ${detail.slice(0, 400)}` : `AI provider returned HTTP ${response.status}.`)
    }
    return payload
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The AI provider timed out. Try again or increase LLM_TIMEOUT_MS.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function toolResultText(result: unknown): string {
  if (typeof result !== 'object' || result === null) return JSON.stringify(result)
  const content = (result as { content?: unknown }).content
  if (!Array.isArray(content)) return JSON.stringify(result)
  const text = content
    .map((part) => typeof part === 'object' && part !== null && 'text' in part ? String((part as { text: unknown }).text) : '')
    .filter(Boolean)
    .join('\n')
  return (result as { isError?: boolean }).isError ? `MCP tool error: ${text}` : text || JSON.stringify(result)
}

/** One provider-agnostic chat turn; all model tool calls are executed through an in-memory MCP client. */
export async function runAssistantTurn(
  bridge: CanvasBridge,
  sessionId: string,
  history: ChatMessage[],
  settings: LlmSettings,
): Promise<{ reply: string; actions: string[] }> {
  if (!bridge.isConnected(sessionId)) throw new Error('This editor is no longer connected. Reopen the AI panel or reload the design.')

  const conversation: OpenAiMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\nCurrent browser editor session: ${sessionId}.` },
    ...history.slice(-HISTORY_MESSAGES).map(({ role, content }) => ({ role, content })),
  ]
  const actions: string[] = []
  const { client, close } = await createAssistantMcpClient(bridge, sessionId)

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const payload = await requestCompletion(settings, conversation, round === MAX_TOOL_ROUNDS)
      const message = payload.choices?.[0]?.message
      if (!message) throw new Error('The AI provider returned an empty response.')
      const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []

      if (toolCalls.length === 0) {
        const reply = message.content?.trim()
        return {
          reply: reply || (actions.length ? 'C’est fait — j’ai mis à jour votre design.' : 'Je n’ai pas de réponse à afficher pour le moment.'),
          actions,
        }
      }

      conversation.push({
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: toolCalls,
      })

      for (const call of toolCalls) {
        if (actions.length >= MAX_ACTIONS) {
          conversation.push({ role: 'tool', tool_call_id: call.id, content: 'Action limit reached for this turn. Summarize the completed changes.' })
          continue
        }
        let args: Record<string, unknown>
        try {
          const parsed: unknown = JSON.parse(call.function.arguments || '{}')
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Tool arguments must be an object.')
          args = parsed as Record<string, unknown>
          // Never allow a model response to redirect an in-app chat action into another browser session.
          delete args.session_id
        } catch (error) {
          conversation.push({ role: 'tool', tool_call_id: call.id, content: `Invalid tool arguments: ${error instanceof Error ? error.message : 'invalid JSON'}` })
          continue
        }

        try {
          const result = await client.callTool({ name: call.function.name, arguments: args })
          const image = extractImageContent(result)
          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: toolResultText(result) || (image ? 'Screenshot of the current page captured; it is attached in the next message.' : ''),
          })
          // Give the model eyes: a screenshot becomes a real image message, not base64 buried in text.
          if (image) {
            conversation.push({
              role: 'user',
              content: [
                { type: 'text', text: 'Screenshot of the current page, as requested:' },
                { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
              ],
            })
          }
          if (!result.isError) actions.push(call.function.name)
        } catch (error) {
          conversation.push({ role: 'tool', tool_call_id: call.id, content: `MCP tool error: ${error instanceof Error ? error.message : 'The action failed.'}` })
        }
      }
    }
    return { reply: 'J’ai atteint la limite d’actions pour cette demande. Vous pouvez me demander de continuer.', actions }
  } finally {
    await close()
  }
}
