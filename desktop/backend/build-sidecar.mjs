// Builds the embedded Django server with PyInstaller into
// desktop/backend-dist/studio-nova-backend/. Must run on the same OS as
// the installer being packaged (the desktop workflow does exactly that).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const desktop = path.resolve(here, '..')
const dist = path.join(desktop, 'backend-dist')
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: here, shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(python, ['-m', 'pip', 'install', '--quiet', '-r', 'requirements-desktop.txt', 'pyinstaller'])
fs.rmSync(dist, { recursive: true, force: true })
run(python, [
  '-m', 'PyInstaller',
  '--noconfirm',
  '--distpath', dist,
  '--workpath', path.join(here, 'build'),
  'studio-nova-backend.spec',
])

const binary = path.join(dist, 'studio-nova-backend', process.platform === 'win32' ? 'studio-nova-backend.exe' : 'studio-nova-backend')
if (!fs.existsSync(binary)) {
  console.error(`Sidecar build did not produce ${binary}`)
  process.exit(1)
}
console.log(`Embedded server built: ${binary}`)

// Diagnostics: prove the bundle really contains the backend tree (real
// files under _internal/ on PyInstaller 6+) and surface any first-party
// module PyInstaller reported missing, so a hollow sidecar can never
// slip through unnoticed again.
const bundleDir = path.join(dist, 'studio-nova-backend')
const inner = fs.existsSync(path.join(bundleDir, '_internal')) ? path.join(bundleDir, '_internal') : bundleDir
for (const name of ['apps', 'doory', 'data']) {
  console.log(`bundle check: ${name}/ ${fs.existsSync(path.join(inner, name)) ? 'present' : 'MISSING'}`)
}
const warnFile = path.join(here, 'build', 'studio-nova-backend', 'warn-studio-nova-backend.txt')
if (fs.existsSync(warnFile)) {
  const missing = fs.readFileSync(warnFile, 'utf8').split('\n')
    .filter((line) => /missing module named (apps|doory)[.\s]/.test(line))
    .slice(0, 20)
  if (missing.length) console.log(`PyInstaller missing-module warnings (first-party):\n${missing.join('\n')}`)
}
