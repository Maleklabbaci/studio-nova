import type { SaveInput, SaveState } from '../../src/types/adapter'
import type { DoryDocument } from '../../src/types/document'

/** A comment as the in-memory service (src/editor/dev/memoryComments.ts) holds it. */
interface CommentRow {
  id: string
  body: string
  page_id: string | null
  x: number | null
  y: number | null
  parent: string | null
  resolved: boolean
}

/** Shape of `window.__doory`, installed by the dev harness (src/editor/dev/HarnessApp.tsx). */
declare global {
  interface Window {
    __doory?: {
      saves: SaveInput[]
      uploads: { name: string; size: number }[]
      accountRequests: string[]
      saveStates: SaveState[]
      failNextSave(kind: 'conflict' | 'error'): void
      getDocument(): DoryDocument
      isDirty(): boolean
      saveNow(): Promise<void>
      conflictChoices: string[]
      titles: string[]
      comments: {
        calls: string[]
        snapshot(): CommentRow[]
        failNext(call: 'list' | 'create' | 'resolve' | 'remove' | 'move' | 'viewer', error?: Error): void
        setLatency(ms: number): void
        remote: {
          add(input: { body: string; page_id?: string | null; x?: number | null; y?: number | null; parent?: string | null; author?: 'owner' | 'guest' }): CommentRow
          resolve(id: string, resolved: boolean): void
          remove(id: string): void
          move(id: string, to: { page_id: string; x: number; y: number }): void
        }
      }
    }
  }
}
