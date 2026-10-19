'use strict'

/**
 * Pure helpers for the desktop update check: version comparison and picking
 * the right installer out of the download manifest the web site already
 * publishes (`/downloads/manifest.json`, written by
 * scripts/write-download-manifest.cjs at packaging time). Kept free of
 * Electron so the logic can be unit-tested with plain Node.
 */

/** `v1.2.3`, `1.2` and `1.2.3-beta.1` all parse; anything else is `[0]`. */
function parseVersion(value) {
  if (typeof value !== 'string') return [0]
  const core = value.trim().replace(/^v/i, '').split(/[-+]/)[0]
  const parts = core.split('.').map((part) => Number.parseInt(part, 10))
  return parts.some((n) => Number.isNaN(n)) ? [0] : parts
}

/** -1 when `a` is older than `b`, 0 when equal, 1 when newer. */
function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

function isNewerVersion(latest, current) {
  return compareVersions(latest, current) > 0
}

const PLATFORM_KEYS = { win32: 'windows', darwin: 'macos', linux: 'linux' }

/**
 * Where a manifest may send the browser for an installer. The published
 * manifest points at the GitHub release assets, because the site host caps
 * files at 25 MB and every installer is around 180 MB.
 */
const INSTALLER_HOSTS = new Set(['github.com', 'objects.githubusercontent.com'])

/** The absolute https installer URL a manifest entry names, or '' when it is not a trusted one. */
function absoluteInstaller(value) {
  if (typeof value !== 'string' || !value) return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return ''
    return INSTALLER_HOSTS.has(url.hostname.toLowerCase()) ? url.href : ''
  } catch {
    return ''
  }
}

/**
 * The installer for `platform` from a download manifest, or ''. Either a plain
 * file name (resolved next to the manifest) or an absolute https URL on a
 * trusted host; anything else — relative paths, http, other hosts — is refused.
 */
function pickInstaller(manifest, platform) {
  const key = PLATFORM_KEYS[platform]
  const downloads = manifest && typeof manifest === 'object' ? manifest.downloads : null
  const file = key && downloads && typeof downloads === 'object' ? downloads[key] : null
  if (typeof file !== 'string' || !file) return ''
  if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file)) return file
  return absoluteInstaller(file)
}

/** Absolute URL of the installer: the manifest's own when it names one, otherwise next to the manifest. */
function installerUrl(manifestUrl, file) {
  const direct = absoluteInstaller(file)
  if (direct) return direct
  const url = new URL(manifestUrl)
  url.pathname = url.pathname.replace(/[^/]*$/, file)
  url.search = ''
  url.hash = ''
  return url.href
}

module.exports = { parseVersion, compareVersions, isNewerVersion, pickInstaller, installerUrl }
