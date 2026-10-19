'use strict'

const fs = require('node:fs')
const path = require('node:path')
const packageJson = require('../package.json')

const root = path.resolve(__dirname, '../..')
const downloadsDir = path.join(root, 'frontend', 'public', 'downloads')
const expected = {
  windows: 'StudioNova-win-x64.exe',
  macos: 'StudioNova-mac-universal.dmg',
}
// The published manifest names the GitHub release assets, not files
// next to it: the installers are far larger than the site host allows, so
// they live on GitHub Releases and both the download page and the app's
// in-app update check follow that URL.
const repository = process.env.GITHUB_REPOSITORY || 'Maleklabbaci/studio-nova'
const downloads = Object.fromEntries(
  Object.entries(expected)
    .filter(([, filename]) => fs.existsSync(path.join(downloadsDir, filename)))
    .map(([key, filename]) => [key, `https://github.com/${repository}/releases/latest/download/${filename}`]),
)

if (process.env.REQUIRE_ALL_DESKTOP_INSTALLERS === '1') {
  const missing = Object.values(expected).filter((filename) => !fs.existsSync(path.join(downloadsDir, filename)))
  if (missing.length) throw new Error(`Missing desktop installer(s): ${missing.join(', ')}`)
}

fs.mkdirSync(downloadsDir, { recursive: true })
fs.writeFileSync(path.join(downloadsDir, 'manifest.json'), `${JSON.stringify({ version: packageJson.version, downloads }, null, 2)}\n`)
console.log(`Wrote desktop download manifest with ${Object.keys(downloads).length} installer(s).`)
