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
const downloads = Object.fromEntries(
  Object.entries(expected).filter(([, filename]) => fs.existsSync(path.join(downloadsDir, filename))),
)

if (process.env.REQUIRE_ALL_DESKTOP_INSTALLERS === '1') {
  const missing = Object.values(expected).filter((filename) => !fs.existsSync(path.join(downloadsDir, filename)))
  if (missing.length) throw new Error(`Missing desktop installer(s): ${missing.join(', ')}`)
}

fs.mkdirSync(downloadsDir, { recursive: true })
fs.writeFileSync(path.join(downloadsDir, 'manifest.json'), `${JSON.stringify({ version: packageJson.version, downloads }, null, 2)}\n`)
console.log(`Wrote desktop download manifest with ${Object.keys(downloads).length} installer(s).`)
