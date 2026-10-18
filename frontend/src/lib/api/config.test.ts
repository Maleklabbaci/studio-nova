import { parseModelDescriptor } from '@/editor/engine/bgRemoval/model'
import { BUNDLED_BACKGROUND_REMOVAL_MODEL, DEFAULT_CONFIG, normalizeAppConfig, STATIC_FALLBACK_CONFIG } from './config'

describe('normalizeAppConfig', () => {
  it('returns the defaults for missing or malformed payloads', () => {
    expect(normalizeAppConfig(undefined)).toBe(DEFAULT_CONFIG)
    expect(normalizeAppConfig(null)).toBe(DEFAULT_CONFIG)
    expect(normalizeAppConfig('<html>not json</html>')).toBe(DEFAULT_CONFIG)
    expect(normalizeAppConfig(42)).toBe(DEFAULT_CONFIG)
  })

  it('fills missing sections from the defaults so `features` is always readable', () => {
    const config = normalizeAppConfig({ google_client_id: 'abc' })
    expect(config.google_client_id).toBe('abc')
    expect(config.features).toEqual(DEFAULT_CONFIG.features)
    expect(config.limits).toEqual(DEFAULT_CONFIG.limits)
    expect(config.assets).toEqual(DEFAULT_CONFIG.assets)
  })

  it('static fallback enables background removal with the bundled model', () => {
    expect(STATIC_FALLBACK_CONFIG.features.background_removal).toBe(true)
    expect(STATIC_FALLBACK_CONFIG.assets?.background_removal_model).toBe(BUNDLED_BACKGROUND_REMOVAL_MODEL)
    // The descriptor must describe the file actually bundled with the site
    // (same values as backend/data/ml_models.json) and pass validation.
    expect(BUNDLED_BACKGROUND_REMOVAL_MODEL.url).toBe('/models/u2netp/u2netp-309c8469258d.onnx')
    expect(parseModelDescriptor(BUNDLED_BACKGROUND_REMOVAL_MODEL, 'https://example.com')).not.toBeNull()
    expect(STATIC_FALLBACK_CONFIG.features.stock_photos).toBe(false)
    expect(STATIC_FALLBACK_CONFIG.features.server_pdf).toBe(false)
  })

  it('keeps server-provided values and merges partial sections', () => {
    const config = normalizeAppConfig({
      features: { server_pdf: true },
      limits: { max_pages: 5 },
    })
    expect(config.features.server_pdf).toBe(true)
    expect(config.features.stock_photos).toBe(DEFAULT_CONFIG.features.stock_photos)
    expect(config.limits.max_pages).toBe(5)
    expect(config.limits.max_upload_bytes).toBe(DEFAULT_CONFIG.limits.max_upload_bytes)
  })
})
