import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp, Check, CircleHelp, LoaderCircle, RotateCcw, Sparkles, X } from 'lucide-react'
import { uuid } from '@/lib/uuid'
import type { BridgeStatus } from './CanvasMcpBridge'
import styles from './AiAssistant.module.css'

type ChatRole = 'assistant' | 'user'
interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  actions?: string[]
}
interface AssistantServiceStatus {
  configured: boolean
  model: string
}

const PROMPTS = [
  'Ajoute un titre accrocheur',
  'Passe le fond en corail',
  'Ajoute une étoile discrète',
]
const ACTION_LABELS: Record<string, string> = {
  get_canvas_state: 'Canvas analysé',
  add_text: 'Texte ajouté',
  add_shape: 'Forme ajoutée',
  set_background: 'Fond modifié',
  add_page: 'Page créée',
  duplicate_selected: 'Éléments dupliqués',
  delete_selected: 'Éléments supprimés',
  rename_design: 'Design renommé',
}
const makeId = (): string => uuid()

function useAssistantStatus() {
  const [status, setStatus] = useState<AssistantServiceStatus | null>(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch('/assistant/status', { headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error('Assistant service is unavailable.')
        const body = await response.json() as AssistantServiceStatus
        if (active) {
          setStatus(body)
          setOffline(false)
        }
      } catch {
        if (active) {
          setStatus(null)
          setOffline(true)
        }
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 15_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  return { status, offline }
}

function actionName(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll('_', ' ')
}

export function AiAssistant({ sessionId, bridgeStatus, onClose }: {
  sessionId: string
  bridgeStatus: BridgeStatus
  onClose: () => void
}) {
  const { status: service, offline } = useAssistantStatus()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const ready = bridgeStatus === 'connected' && service?.configured === true

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending, error])

  async function sendMessage(text: string): Promise<void> {
    const content = text.trim()
    if (!content || !ready || pending) return
    const userMessage: ChatMessage = { id: makeId(), role: 'user', content }
    const next = [...messages, userMessage]
    setMessages(next)
    setDraft('')
    setPending(true)
    setError('')
    try {
      const response = await fetch('/assistant/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages: next.slice(-12).map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        }),
      })
      const payload = await response.json().catch(() => ({})) as { reply?: string; actions?: string[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Impossible de joindre l’assistant pour le moment.')
      setMessages((current) => [...current, {
        id: makeId(),
        role: 'assistant',
        content: payload.reply || 'C’est fait.',
        actions: Array.isArray(payload.actions) ? payload.actions : [],
      }])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Une erreur est survenue. Réessayez.')
    } finally {
      setPending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void sendMessage(draft)
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(draft)
    }
  }

  const resetChat = (): void => {
    if (pending) return
    setMessages([])
    setError('')
  }

  return (
    <aside className={styles.panel} aria-label="Assistant IA Studio Nova" data-testid="ed-ai-panel">
      <header className={styles.header}>
        <div className={styles.brandIcon} aria-hidden="true"><Sparkles size={17} /></div>
        <div className={styles.headerCopy}>
          <strong>Studio Nova IA</strong>
          <span>Votre copilote de création</span>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconButton} onClick={resetChat} disabled={pending} aria-label="Effacer la conversation" title="Nouvelle conversation">
            <RotateCcw size={15} aria-hidden="true" />
          </button>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Fermer l’assistant">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className={styles.statusRow}>
        <span className={`${styles.statusDot} ${bridgeStatus === 'connected' ? styles.statusOnline : ''}`} />
        <span>{bridgeStatus === 'connected' ? 'Canvas connecté via MCP' : bridgeStatus === 'connecting' ? 'Connexion au canvas…' : 'Canvas déconnecté'}</span>
        {service?.configured ? <span className={styles.modelTag}>{service.model}</span> : null}
      </div>

      <div className={styles.conversation} ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon} aria-hidden="true"><Sparkles size={20} /></div>
            <h2>Bonjour !</h2>
            <p>Décrivez le changement souhaité. Je peux ajouter du texte ou des formes, modifier le fond et créer une nouvelle page directement sur le canvas.</p>
            <div className={styles.suggestions}>
              {PROMPTS.map((prompt) => (
                <button type="button" key={prompt} className={styles.suggestion} onClick={() => setDraft(prompt)} disabled={!ready || pending}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : messages.map((message) => (
          <article className={`${styles.message} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage}`} key={message.id}>
            {message.role === 'assistant' ? <span className={styles.messageMark} aria-hidden="true"><Sparkles size={13} /></span> : null}
            <div className={styles.messageBody}>
              <p>{message.content}</p>
              {message.actions && message.actions.length > 0 ? (
                <div className={styles.actions} aria-label="Actions du canvas">
                  {[...new Set(message.actions)].map((action, index) => (
                    <span className={styles.actionTag} key={`${action}-${index}`}><Check size={11} aria-hidden="true" />{actionName(action)}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {pending ? <div className={styles.pending} role="status"><LoaderCircle size={15} className={styles.spinner} aria-hidden="true" /> L’IA travaille sur le design…</div> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </div>

      {offline ? (
        <div className={styles.notice} role="status"><CircleHelp size={15} aria-hidden="true" /><span>Le serveur MCP n’est pas lancé. Démarrez <code>mcp-server</code> pour utiliser l’assistant.</span></div>
      ) : service && !service.configured ? (
        <div className={styles.notice} role="status"><CircleHelp size={15} aria-hidden="true" /><span>Ajoutez <code>LLM_API_KEY</code> dans <code>mcp-server/.env</code>, puis redémarrez le serveur.</span></div>
      ) : null}

      <form className={styles.composer} onSubmit={submit}>
        <label className={styles.visuallyHidden} htmlFor="studio-nova-ai-input">Message à l’assistant IA</label>
        <textarea
          id="studio-nova-ai-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={keyDown}
          placeholder={bridgeStatus === 'connected' ? 'Décrivez votre idée…' : 'Connexion au canvas…'}
          rows={2}
          maxLength={2000}
          disabled={!ready || pending}
          data-testid="ed-ai-input"
        />
        <div className={styles.composerFooter}>
          <span>Entrée pour envoyer · Maj + Entrée pour une ligne</span>
          <button type="submit" className={styles.sendButton} disabled={!ready || pending || !draft.trim()} aria-label="Envoyer le message" data-testid="ed-ai-send">
            {pending ? <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" /> : <ArrowUp size={17} aria-hidden="true" />}
          </button>
        </div>
      </form>
      <p className={styles.footerNote}>L’IA peut modifier le design. Les changements restent annulables avec Ctrl/Cmd + Z.</p>
    </aside>
  )
}
