import { DEFAULT_CONFIG, normalizeAppConfig } from './config'

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
