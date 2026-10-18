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
