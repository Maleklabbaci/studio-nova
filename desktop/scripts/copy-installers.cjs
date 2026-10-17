'use strict'

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const sourceDir = path.resolve(__dirname, '../release')
const downloadsDir = path.join(root, 'frontend', 'public', 'downloads')
const installers = [
  'StudioNova-win-x64.exe',
  'StudioNova-mac-universal.dmg',
  'StudioNova-linux-x64.AppImage',
]

fs.mkdirSync(downloadsDir, { recursive: true })
let copied = 0
for (const filename of installers) {
  const source = path.join(sourceDir, filename)
  if (!fs.existsSync(source)) continue
  const destination = path.join(downloadsDir, filename)
  if (fs.existsSync(destination)) fs.unlinkSync(destination)
  try {
    fs.linkSync(source, destination)
  } catch {
    fs.copyFileSync(source, destination)
  }
  copied += 1
}
if (!copied) throw new Error(`No Studio Nova installers found in ${sourceDir}.`)
console.log(`Published ${copied} desktop installer(s) to ${downloadsDir}.`)
