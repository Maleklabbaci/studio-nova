'use strict'

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const http = require('node:http')
const https = require('node:https')
const { isNewerVersion, pickInstaller, installerUrl } = require('./updateCheck.cjs')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const httpProxy = require('http-proxy')

const APP_NAME = 'Studio Nova'
const APP_PORT = 48291 // Stable origin so guest designs persist between launches.
const MCP_DEFAULT_PORT = 8787
const BACKEND_DEFAULT_PORT = 49317
const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true, xfwd: true, secure: true })
let mainWindow = null
let localServer = null
let mcpProcess = null
let backendProcess = null
let backendPort = BACKEND_DEFAULT_PORT
let mcpPort = MCP_DEFAULT_PORT
let appOrigin = `http://127.0.0.1:${APP_PORT}`
let apiOrigin = ''
let shuttingDown = false

app.setName(APP_NAME)

/* ---------------------------------------------------------------------------
 * Branded splash: the first thing the installed app shows. The local engine
 * can take a while on first start (migrations + catalogues), so instead of
 * an empty void the user gets the Studio Nova night sky, the star and a
 * live status line. Shown once at launch, closed when the studio is ready.
 * ------------------------------------------------------------------------- */
const SPLASH_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #fff7f0;
    background:
      radial-gradient(420px 260px at 82% -10%, rgba(255, 138, 101, .38), transparent 60%),
      radial-gradient(520px 340px at 8% 108%, rgba(124, 77, 255, .30), transparent 62%),
      linear-gradient(140deg, #170a1e 0%, #241031 55%, #31133a 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; overflow: hidden; -webkit-user-select: none; user-select: none;
  }
  .mark { filter: drop-shadow(0 10px 28px rgba(255, 122, 89, .45)); animation: float 3.2s ease-in-out infinite; }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  h1 { font-size: 30px; font-weight: 650; letter-spacing: -.02em; }
  h1 .nova { background: linear-gradient(90deg, #ffb199, #ff7a59 55%, #ffd88a); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tag { font-size: 13px; color: rgba(255, 240, 230, .72); letter-spacing: .14em; text-transform: uppercase; }
  .bar { width: 240px; height: 5px; margin-top: 16px; border-radius: 99px; background: rgba(255, 255, 255, .14); overflow: hidden; }
  .bar i { display: block; height: 100%; width: 40%; border-radius: 99px;
    background: linear-gradient(90deg, #ff7a59, #ffb199, #ffd88a); animation: slide 1.15s ease-in-out infinite; }
  @keyframes slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(620%); } }
  #status { font-size: 13px; color: rgba(255, 240, 230, .85); min-height: 18px; }
  .foot { position: absolute; bottom: 18px; font-size: 11px; color: rgba(255, 240, 230, .45); letter-spacing: .08em; }
</style></head><body>
  <svg class="mark" width="86" height="86" viewBox="0 0 40 40" aria-hidden="true">
    <rect x="1" y="1" width="38" height="38" rx="12" fill="rgba(255,255,255,.08)"/>
    <path d="M20 6.5 23.9 16.1 33.5 20 23.9 23.9 20 33.5 16.1 23.9 6.5 20 16.1 16.1Z" fill="#ff8a65"/>
    <circle cx="20" cy="20" r="4.2" fill="#fff7f0"/>
    <circle cx="30.2" cy="9.8" r="2.1" fill="#ffd88a"/>
  </svg>
  <h1>Studio <span class="nova">Nova</span></h1>
  <p class="tag">Design with a spark</p>
  <div class="bar"><i></i></div>
  <p id="status">Preparing your studio…</p>
  <p class="foot">LOCAL &amp; PRIVATE BY DESIGN</p>
  <script>window.__novaStatus = function (text) { document.getElementById('status').textContent = text; };</script>
</body></html>`

let splashWindow = null
let splashCreatedAt = 0

function createSplash() {
  if (splashWindow) return
  splashCreatedAt = Date.now()
  splashWindow = new BrowserWindow({
    width: 540,
    height: 360,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: APP_NAME,
    backgroundColor: '#170a1e',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  splashWindow.on('closed', () => { splashWindow = null })
  void splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`)
    .then(() => splashWindow?.show())
    .catch(() => { splashWindow?.destroy(); splashWindow = null })
}

function setSplashStatus(text) {
  if (!splashWindow || splashWindow.isDestroyed()) return
  void splashWindow.webContents.executeJavaScript(`window.__novaStatus && window.__novaStatus(${JSON.stringify(text)})`).catch(() => {})
}

function closeSplash() {
  if (!splashWindow) return
  const remaining = Math.max(0, 900 - (Date.now() - splashCreatedAt))
  const target = splashWindow
  splashWindow = null
  setTimeout(() => { if (!target.isDestroyed()) target.close() }, remaining)
}

const MIME_TYPES = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
}

const webRoot = () => app.isPackaged
  ? path.join(process.resourcesPath, 'frontend')
  : path.resolve(__dirname, '../frontend/dist-desktop')

function seedConfigurationExamples() {
  const userData = app.getPath('userData')
  const mcpConfigDir = path.join(userData, 'mcp-server')
  fs.mkdirSync(mcpConfigDir, { recursive: true })
  const examples = [
    [path.join(process.resourcesPath, 'desktop-config.example.json'), path.join(userData, 'desktop-config.example.json')],
    [path.join(process.resourcesPath, 'mcp-server', '.env.example'), path.join(mcpConfigDir, '.env.example')],
  ]
  for (const [source, destination] of examples) {
    if (fs.existsSync(source) && !fs.existsSync(destination)) fs.copyFileSync(source, destination)
  }
}

function loadDesktopConfig() {
  const configPath = path.join(app.getPath('userData'), 'desktop-config.json')
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function safeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const parsed = new URL(value.trim())
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return ''
    return parsed.origin
  } catch {
    return ''
  }
}

function sendJson(res, statusCode, body) {
  const payload = Buffer.from(JSON.stringify(body))
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(payload)
}

function proxyRequest(req, res, target) {
  proxy.web(req, res, { target, changeOrigin: true, xfwd: true })
}

function proxyApiRequest(req, res) {
  if (!apiOrigin) {
    sendJson(res, 503, {
      error: {
        code: 'desktop_server_not_configured',
        message: 'Studio Nova’s account service is not available, so the app is in local mode. Designs on this device keep working.',
      },
    })
    return
  }
  proxy.web(req, res, {
    target: apiOrigin,
    changeOrigin: true,
    xfwd: true,
    headers: { origin: apiOrigin, referer: `${apiOrigin}/` },
  })
}

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function serveStatic(req, res, pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    sendJson(res, 400, { error: { message: 'Invalid URL path.' } })
    return
  }

  const root = path.resolve(webRoot())
  const relative = path.normalize(decoded).replace(/^([/\\])+/, '')
  let filePath = path.resolve(root, relative || 'index.html')
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    sendJson(res, 403, { error: { message: 'Forbidden.' } })
    return
  }

  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html')
  } catch {
    // A path without an extension is an SPA route; a missing asset remains a real 404.
    if (!path.extname(filePath)) filePath = path.join(root, 'index.html')
  }

  let stat
  try {
    stat = fs.statSync(filePath)
    if (!stat.isFile()) throw new Error('Not a file')
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' })
    res.end('Not found')
    return
  }

  const immutable = /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\./.test(pathname)
  res.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Content-Length': stat.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(filePath).pipe(res)
}

function handleRequest(req, res) {
  const requestUrl = new URL(req.url || '/', appOrigin)
  const pathname = requestUrl.pathname

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    proxyApiRequest(req, res)
    return
  }
  if (pathname === '/media' || pathname.startsWith('/media/') || pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/static' || pathname.startsWith('/static/')) {
    proxyApiRequest(req, res)
    return
  }
  if (pathname === '/ws' || pathname.startsWith('/ws/')) {
    if (apiOrigin) proxyRequest(req, res, apiOrigin)
    else sendJson(res, 503, { error: { message: 'Real-time collaboration needs a configured Studio Nova server.' } })
    return
  }
  if (pathname === '/assistant' || pathname.startsWith('/assistant/') || pathname === '/mcp' || pathname === '/health') {
    proxyRequest(req, res, `http://127.0.0.1:${mcpPort}`)
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: { message: 'Method not allowed.' } })
    return
  }
  serveStatic(req, res, pathname)
}

function probePort(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(port, '127.0.0.1', () => {
      const address = probe.address()
      const found = address && typeof address === 'object' ? address.port : port
      probe.close((error) => error ? reject(error) : resolve(found))
    })
  })
}

async function nextAvailablePort(startAt) {
  try {
    return await probePort(startAt)
  } catch (error) {
    if (error && error.code === 'EADDRINUSE') return probePort(0)
    throw error
  }
}

function backendExecutable() {
  const file = process.platform === 'win32' ? 'studio-nova-backend.exe' : 'studio-nova-backend'
  const packaged = path.join(process.resourcesPath, 'backend', 'studio-nova-backend', file)
  if (app.isPackaged && fs.existsSync(packaged)) return packaged
  // Development override: a sidecar built with `npm run build:backend`.
  const fromEnv = process.env.STUDIO_NOVA_BACKEND_BIN || ''
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv
  const built = path.join(__dirname, 'backend-dist', 'studio-nova-backend', file)
  return fs.existsSync(built) ? built : ''
}

/**
 * Starts the embedded Django server (SQLite in the per-user data dir) and
 * returns its origin as soon as the process is launched, or '' when no
 * sidecar is bundled. A cloud apiOrigin from desktop-config.json still wins
 * over the local server.
 *
 * It deliberately does not wait for `/api/v1/health/`: a first start migrates
 * and seeds the catalogues for up to half a minute, and the window must open
 * on the local studio meanwhile. `waitForBackend` watches readiness in the
 * background and the web app retries its session check by itself.
 */
async function startBackend() {
  const executable = backendExecutable()
  if (!executable) {
    console.warn('Studio Nova: no embedded local server found; running in local-only mode.')
    return ''
  }
  backendPort = await nextAvailablePort(BACKEND_DEFAULT_PORT)
  const dataDir = path.join(app.getPath('userData'), 'backend-data')
  fs.mkdirSync(dataDir, { recursive: true })
  backendProcess = spawn(executable, [], {
    cwd: dataDir,
    env: {
      ...process.env,
      STUDIO_NOVA_DATA_DIR: dataDir,
      STUDIO_NOVA_BACKEND_PORT: String(backendPort),
      SITE_URL: appOrigin,
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  backendProcess.on('error', (error) => console.error('Studio Nova local server failed to start:', error))
  backendProcess.on('exit', (code) => {
    if (!shuttingDown && code !== 0 && code !== null) console.error(`Studio Nova local server exited with code ${code}.`)
  })
  return `http://127.0.0.1:${backendPort}`
}

/** Resolves true once the local server answers its health check, or false after `timeoutMs`. */
async function waitForBackend(origin, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && !shuttingDown) {
    const healthy = await new Promise((resolve) => {
      const request = http.get(`${origin}/api/v1/health/`, (response) => {
        response.resume()
        resolve(response.statusCode === 200)
      })
      request.on('error', () => resolve(false))
      request.setTimeout(1500, () => {
        request.destroy()
        resolve(false)
      })
    })
    if (healthy) return true
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return false
}

async function startPackagedServices() {
  seedConfigurationExamples()
  const config = loadDesktopConfig()

  localServer = http.createServer(handleRequest)
  await new Promise((resolve, reject) => {
    localServer.once('error', reject)
    localServer.listen(APP_PORT, '127.0.0.1', resolve)
  })

  const configuredOrigin = safeOrigin(config.apiOrigin || process.env.STUDIO_NOVA_API_URL || '')
  if (configuredOrigin) {
    apiOrigin = configuredOrigin
  } else {
    const localBackend = await startBackend()
    if (localBackend) {
      // Requests can reach the proxy from the moment the window opens.
      apiOrigin = localBackend
      // A warm install answers in a second or two: let it, so the app opens
      // signed in. A cold one keeps preparing in the background.
      const readyNow = await waitForBackend(localBackend, 5000)
      if (!readyNow) {
        void waitForBackend(localBackend, 180000).then((ready) => {
          if (ready) console.log(`Studio Nova local server ready at ${localBackend}`)
          else console.error('Studio Nova local server did not become ready; the studio keeps working locally.')
        })
      }
    }
  }

  mcpPort = await nextAvailablePort(MCP_DEFAULT_PORT)
  const mcpRoot = path.join(process.resourcesPath, 'mcp-server')
  const mcpEntry = path.join(mcpRoot, 'dist', 'index.js')
  const mcpConfigDir = path.join(app.getPath('userData'), 'mcp-server')
  fs.mkdirSync(mcpConfigDir, { recursive: true })

  mcpProcess = spawn(process.execPath, [mcpEntry], {
    cwd: mcpConfigDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(mcpPort),
      BRIDGE_ALLOWED_ORIGINS: appOrigin,
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  mcpProcess.on('error', (error) => console.error('Studio Nova assistant service failed to start:', error))
  mcpProcess.on('exit', (code) => {
    if (!shuttingDown && code !== 0 && code !== null) console.error(`Studio Nova assistant service exited with code ${code}.`)
  })
}

function openExternalIfSafe(urlString) {
  try {
    const url = new URL(urlString)
    if (url.protocol === 'https:' || url.protocol === 'mailto:') void shell.openExternal(urlString)
  } catch {
    // Ignore non-URL and malformed navigation attempts.
  }
}

/**
 * Window controls for the frameless window. The app's own title bar
 * (macOS-style traffic lights, drawn by the frontend) sends these; the sender
 * window is always the one acted on, and nothing else is exposed.
 */
let windowControlsRegistered = false
function registerWindowControls() {
  if (windowControlsRegistered) return
  windowControlsRegistered = true
  const senderWindow = (event) => BrowserWindow.fromWebContents(event.sender)
  ipcMain.on('studio-nova:window-minimize', (event) => senderWindow(event)?.minimize())
  ipcMain.on('studio-nova:window-close', (event) => senderWindow(event)?.close())
  ipcMain.on('studio-nova:window-toggle-maximize', (event) => {
    const window = senderWindow(event)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.handle('studio-nova:window-is-maximized', (event) => senderWindow(event)?.isMaximized() ?? false)
}

/* ---------------------------------------------------------------------------
 * Update check: the web site already publishes the installers it offers for
 * download, with a manifest naming the newest version. A few seconds after
 * launch the app quietly compares that version with its own and, when a
 * newer one exists, offers the download. Installing still goes through the
 * installer (designs and settings live in userData and are untouched), but
 * the user never has to go hunting for a new version again. Failures —
 * offline, site down — are silent; "Later" snoozes that one version.
 * ------------------------------------------------------------------------- */
const DEFAULT_UPDATE_MANIFEST_URL = 'https://studio-nova-b6e.pages.dev/downloads/manifest.json'
let updateCheckStarted = false

function safeUpdateManifestUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const parsed = new URL(value.trim())
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return ''
    return parsed.href
  } catch {
    return ''
  }
}

function fetchJson(urlString, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const transport = urlString.startsWith('https:') ? https : http
    const request = transport.get(
      urlString,
      { headers: { 'User-Agent': `StudioNova/${app.getVersion()} (update check)` } },
      (response) => {
        const status = response.statusCode || 0
        if (status >= 300 && status < 400 && response.headers.location && redirectsLeft > 0) {
          response.resume()
          resolve(fetchJson(new URL(response.headers.location, urlString).href, redirectsLeft - 1))
          return
        }
        if (status !== 200) {
          response.resume()
          reject(new Error(`Update check answered HTTP ${status}`))
          return
        }
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (error) {
            reject(error)
          }
        })
        response.on('error', reject)
      },
    )
    request.on('error', reject)
    request.setTimeout(8000, () => request.destroy(new Error('Update check timed out')))
  })
}

function readUpdateState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'update-state.json'), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeUpdateState(state) {
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'update-state.json'), `${JSON.stringify(state)}\n`)
  } catch {
    // A read-only profile just means the offer comes back next launch.
  }
}

async function checkForUpdates() {
  if (updateCheckStarted || !app.isPackaged || shuttingDown) return
  updateCheckStarted = true
  try {
    const config = loadDesktopConfig()
    const manifestUrl = safeUpdateManifestUrl(config.updateManifestUrl) || DEFAULT_UPDATE_MANIFEST_URL
    const manifest = await fetchJson(manifestUrl)
    const latest = manifest && typeof manifest.version === 'string' ? manifest.version.trim() : ''
    const current = app.getVersion()
    if (!latest || !isNewerVersion(latest, current)) return
    const state = readUpdateState()
    if (state.snoozedVersion === latest) return
    const file = pickInstaller(manifest, process.platform)
    if (!file) return
    const options = {
      type: 'info',
      title: 'Update available',
      message: `Studio Nova ${latest} is available.`,
      detail: `You have version ${current}. Download the new installer and run it — your designs and settings stay in place.`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }
    const result = mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options)
    if (result.response === 0) openExternalIfSafe(installerUrl(manifestUrl, file))
    else writeUpdateState({ ...state, snoozedVersion: latest })
  } catch (error) {
    console.error('Studio Nova update check failed:', error instanceof Error ? error.message : error)
  }
}

function createWindow() {
  registerWindowControls()
  const iconPath = path.join(webRoot(), 'icons', 'icon-512.png')
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: APP_NAME,
    // No native frame: the app draws a macOS-style title bar (traffic lights)
    // and opens straight on the studio, like a native design app.
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#170a1e',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  const sendMaximized = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('studio-nova:window-maximized-changed', mainWindow.isMaximized())
    }
  }
  mainWindow.on('maximize', sendMaximized)
  mainWindow.on('unmaximize', sendMaximized)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    closeSplash()
    // A few seconds in, so the offer never delays getting to work.
    setTimeout(() => void checkForUpdates(), 4000)
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfSafe(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigin = process.env.STUDIO_NOVA_DESKTOP_DEV === '1' ? 'http://127.0.0.1:5173' : appOrigin
    if (new URL(url).origin !== allowedOrigin) {
      event.preventDefault()
      openExternalIfSafe(url)
    }
  })
  mainWindow.on('closed', () => { mainWindow = null })

  // Straight to work: the app opens on the studio (designs, templates,
  // create), never on the marketing home page.
  const address = process.env.STUDIO_NOVA_DESKTOP_DEV === '1' ? 'http://127.0.0.1:5173/dashboard' : `${appOrigin}/dashboard`
  void mainWindow.loadURL(address).catch(async (error) => {
    console.error(error)
    closeSplash()
    await dialog.showMessageBox({
      type: 'error',
      title: 'Studio Nova could not start',
      message: 'The Studio Nova window could not be opened.',
      detail: process.env.STUDIO_NOVA_DESKTOP_DEV === '1'
        ? 'Start the frontend development server on port 5173 and try again.'
        : 'Try reinstalling the application or check the desktop setup guide.',
    })
  })
}

proxy.on('error', (error, _req, responseOrSocket) => {
  console.error('Studio Nova proxy error:', error.message)
  if (responseOrSocket && typeof responseOrSocket.writeHead === 'function' && !responseOrSocket.headersSent) {
    sendJson(responseOrSocket, 502, { error: { message: 'A Studio Nova service could not be reached.' } })
  } else if (responseOrSocket && typeof responseOrSocket.destroy === 'function') {
    responseOrSocket.destroy()
  }
})

const hasSingleInstance = app.requestSingleInstanceLock()
if (!hasSingleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    try {
      if (process.env.STUDIO_NOVA_DESKTOP_DEV !== '1') {
        createSplash()
        setSplashStatus('Starting the local engine…')
        await startPackagedServices()
        setSplashStatus('Opening your studio…')
      }
      createWindow()
      if (localServer) {
        localServer.on('upgrade', (req, socket, head) => {
          const pathname = new URL(req.url || '/', appOrigin).pathname
          if (pathname === '/bridge') {
            proxy.ws(req, socket, head, { target: `ws://127.0.0.1:${mcpPort}`, changeOrigin: true })
          } else if ((pathname === '/ws' || pathname.startsWith('/ws/')) && apiOrigin) {
            const wsOrigin = apiOrigin.replace(/^http/, 'ws')
            proxy.ws(req, socket, head, { target: wsOrigin, changeOrigin: true, headers: { origin: apiOrigin } })
          } else {
            socket.destroy()
          }
        })
      }
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    } catch (error) {
      console.error('Desktop services failed to start:', error)
      closeSplash()
      await dialog.showMessageBox({
        type: 'error',
        title: 'Studio Nova could not start',
        message: 'Studio Nova could not start its local desktop services.',
        detail: error instanceof Error ? error.message : String(error),
      })
      app.quit()
    }
  })
}

app.on('before-quit', () => {
  shuttingDown = true
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy()
  splashWindow = null
  if (mcpProcess && !mcpProcess.killed) mcpProcess.kill()
  if (backendProcess && !backendProcess.killed) backendProcess.kill()
  if (localServer?.listening) localServer.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
