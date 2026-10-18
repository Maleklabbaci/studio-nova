'use strict'

/** Plain-Node tests for updateCheck.cjs: `npm test` in this folder. */
const assert = require('node:assert')
const { parseVersion, compareVersions, isNewerVersion, pickInstaller, installerUrl } = require('./updateCheck.cjs')

assert.deepStrictEqual(parseVersion('v0.1.1'), [0, 1, 1])
assert.deepStrictEqual(parseVersion('1.2'), [1, 2])
assert.deepStrictEqual(parseVersion('1.2.3-beta.1'), [1, 2, 3])
assert.deepStrictEqual(parseVersion('junk'), [0])
assert.deepStrictEqual(parseVersion(undefined), [0])

assert.strictEqual(compareVersions('0.1.0', '0.1.1'), -1)
assert.strictEqual(compareVersions('0.1.1', '0.1.0'), 1)
assert.strictEqual(compareVersions('v1.0.0', '1.0.0'), 0)
assert.strictEqual(compareVersions('0.2', '0.1.9'), 1)
assert.strictEqual(isNewerVersion('0.1.1', '0.1.0'), true)
assert.strictEqual(isNewerVersion('0.1.0', '0.1.0'), false)
assert.strictEqual(isNewerVersion('0.0.9', '0.1.0'), false)

const manifest = { version: '0.1.1', downloads: { windows: 'StudioNova-win-x64.exe', macos: 'x.dmg' } }
assert.strictEqual(pickInstaller(manifest, 'win32'), 'StudioNova-win-x64.exe')
assert.strictEqual(pickInstaller(manifest, 'darwin'), 'x.dmg')
assert.strictEqual(pickInstaller(manifest, 'linux'), '')
assert.strictEqual(pickInstaller({ downloads: { windows: '../evil.exe' } }, 'win32'), '')
assert.strictEqual(pickInstaller({ downloads: { windows: 'https://evil.example/x.exe' } }, 'win32'), '')
assert.strictEqual(pickInstaller(null, 'win32'), '')

assert.strictEqual(
  installerUrl('https://studio-nova.example/downloads/manifest.json', 'StudioNova-win-x64.exe'),
  'https://studio-nova.example/downloads/StudioNova-win-x64.exe',
)

console.log('updateCheck: all assertions passed')
