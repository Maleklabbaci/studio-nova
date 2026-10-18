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

/** The installer file name for `platform` from a download manifest, or ''. */
function pickInstaller(manifest, platform) {
  const key = PLATFORM_KEYS[platform]
  const downloads = manifest && typeof manifest === 'object' ? manifest.downloads : null
  const file = key && downloads && typeof downloads === 'object' ? downloads[key] : null
  // A plain file name only: the URL is built by joining it to the manifest's
  // own directory, never taken from the manifest itself.
  return typeof file === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file) ? file : ''
}

/** Absolute URL of the installer next to the manifest that advertised it. */
function installerUrl(manifestUrl, file) {
  const url = new URL(manifestUrl)
  url.pathname = url.pathname.replace(/[^/]*$/, file)
  url.search = ''
  url.hash = ''
  return url.href
}

module.exports = { parseVersion, compareVersions, isNewerVersion, pickInstaller, installerUrl }
