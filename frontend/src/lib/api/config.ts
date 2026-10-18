import type { AppConfig, BackgroundRemovalModel } from '@/types/api'
import { http } from './client'

/** Conservative defaults used until (or if) `/config/` cannot be loaded: no optional features. */
export const DEFAULT_CONFIG: AppConfig = {
  google_client_id: '',
  features: { stock_photos: false, server_pdf: false, google_login: false, email_verification: false, background_removal: false },
  limits: { max_upload_bytes: 10 * 1024 * 1024, max_pages: 100, max_document_bytes: 12 * 1024 * 1024 },
  assets: { background_removal_model: null },
}

/**
 * The background-removal model bundled with the site itself
 * (`frontend/public/models/…`, the exact file pinned in
 * `backend/data/ml_models.json`). Background removal runs entirely in the
 * browser, so on a static-only deployment (no backend to answer `/config/`)
 * this is what switches the feature on; when a backend does answer, its
 * config stays authoritative and replaces this fallback.
 */
export const BUNDLED_BACKGROUND_REMOVAL_MODEL: BackgroundRemovalModel = {
  id: 'u2netp',
  name: 'U²-Net (small)',
  url: '/models/u2netp/u2netp-309c8469258d.onnx',
  bytes: 4574861,
  sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
  input: { name: 'input.1', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], rescale: 'max' },
  output: '1959',
}

/** Config applied when no backend answered at all: local-only features on, everything server-bound off. */
export const STATIC_FALLBACK_CONFIG: AppConfig = {
  ...DEFAULT_CONFIG,
  features: { ...DEFAULT_CONFIG.features, background_removal: true },
  assets: { background_removal_model: BUNDLED_BACKGROUND_REMOVAL_MODEL },
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
