// Smoke test for the embedded server binary: starts it against a fresh
// temporary data directory (exactly like a first install), waits for
// /api/v1/health/, checks /api/v1/config/, then stops it. Run in CI on
// every OS right after `npm run build:backend`, so a sidecar that cannot
// start fails the installer build instead of reaching users.
//
//   node backend/smoke-test.mjs
//   STUDIO_NOVA_BACKEND_BIN=/path/to/studio-nova-backend node backend/smoke-test.mjs
//   STUDIO_NOVA_BACKEND_CMD="python3 backend/run_server.py" node backend/smoke-test.mjs
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const binaryName = process.platform === 'win32' ? 'studio-nova-backend.exe' : 'studio-nova-backend'
const defaultBinary = path.join(here, '..', 'backend-dist', 'studio-nova-backend', binaryName)

function command() {
  const bin = process.env.STUDIO_NOVA_BACKEND_BIN || (fs.existsSync(defaultBinary) ? defaultBinary : '')
  if (bin) return { file: bin, args: [] }
  const cmd = process.env.STUDIO_NOVA_BACKEND_CMD || ''
  if (cmd) {
    const [file, ...args] = cmd.split(' ')
    return { file, args }
  }
  console.error(`No sidecar binary at ${defaultBinary} and STUDIO_NOVA_BACKEND_BIN/CMD not set. Run npm run build:backend first.`)
  process.exit(2)
}

const { file, args } = command()
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-nova-smoke-'))
// Ask the OS for a port that is free right now instead of drawing one at
// random: a collision makes the sidecar exit (address already in use)
// only after its long first-start seeds, which reads like a crash.
const port = await new Promise((resolve, reject) => {
  const probe = net.createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const freePort = probe.address().port
    probe.close(() => resolve(freePort))
  })
})
const origin = `http://127.0.0.1:${port}`

const child = spawn(file, args, {
  env: {
    ...process.env,
    STUDIO_NOVA_DATA_DIR: dataDir,
    STUDIO_NOVA_BACKEND_PORT: String(port),
    SITE_URL: 'http://127.0.0.1:48291',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
child.stdout.on('data', (chunk) => { output += chunk })
child.stderr.on('data', (chunk) => { output += chunk })

const stop = () => {
  if (child.exitCode === null) child.kill()
}
process.on('exit', stop)

async function waitForHealth(deadlineMs = 180000) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`sidecar exited early with code ${child.exitCode}`)
    try {
      const response = await fetch(`${origin}/api/v1/health/`)
      if (response.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`sidecar did not answer ${origin}/api/v1/health/ within ${deadlineMs / 1000}s`)
}

try {
  await waitForHealth()
  const configResponse = await fetch(`${origin}/api/v1/config/`)
  if (!configResponse.ok) throw new Error(`/api/v1/config/ answered ${configResponse.status}`)
  const config = await configResponse.json()
  if (!config || typeof config.features !== 'object') throw new Error('/api/v1/config/ has no features object')
  const db = path.join(dataDir, 'studio-nova.sqlite3')
  if (!fs.existsSync(db)) throw new Error('sidecar did not create its SQLite database')
  console.log(`Smoke test OK: health + config on ${origin}, database created (${fs.statSync(db).size} bytes), features: ${JSON.stringify(config.features)}`)
} catch (error) {
  console.error(`Smoke test FAILED: ${error instanceof Error ? error.message : error}`)
  console.error(output.slice(-10000))
  process.exitCode = 1
} finally {
  stop()
  fs.rmSync(dataDir, { recursive: true, force: true })
}
