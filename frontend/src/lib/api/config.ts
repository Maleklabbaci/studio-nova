import type { AppConfig } from '@/types/api'
import { http } from './client'

/** Conservative defaults used until (or if) `/config/` cannot be loaded: no optional features. */
export const DEFAULT_CONFIG: AppConfig = {
  google_client_id: '',
  features: { stock_photos: false, server_pdf: false, google_login: false, email_verification: false, background_removal: false },
  limits: { max_upload_bytes: 10 * 1024 * 1024, max_pages: 100, max_document_bytes: 12 * 1024 * 1024 },
  assets: { background_removal_model: null },
}

/**
 * Coerce an arbitrary `/config/` payload into a complete AppConfig. Anything
 * missing or malformed falls back to the conservative defaults, so consumers
 * can always read `config.features.*` safely — a partial or unexpected body
 * must never replace the defaults with `undefined`.
 */
export function normalizeAppConfig(value: unknown): AppConfig {
  if (!value || typeof value !== 'object') return DEFAULT_CONFIG
  const raw = value as Partial<AppConfig>
  const section = <T extends object>(defaults: T, part: unknown): T =>
    part && typeof part === 'object' ? { ...defaults, ...(part as object) } : defaults
  return {
    google_client_id: typeof raw.google_client_id === 'string' ? raw.google_client_id : DEFAULT_CONFIG.google_client_id,
    features: section(DEFAULT_CONFIG.features, raw.features),
    limits: section(DEFAULT_CONFIG.limits, raw.limits),
    assets: raw.assets && typeof raw.assets === 'object' ? { ...DEFAULT_CONFIG.assets, ...raw.assets } : DEFAULT_CONFIG.assets,
  }
}

export const configApi = {
  get: (signal?: AbortSignal) => http.get<AppConfig>('/config/', { signal }),
}
