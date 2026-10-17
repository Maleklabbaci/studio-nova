'use strict'

const { app, BrowserWindow, dialog, shell } = require('electron')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const httpProxy = require('http-proxy')

const APP_NAME = 'Studio Nova'
const APP_PORT = 48291 // Stable origin so guest designs persist between launches.
const MCP_DEFAULT_PORT = 8787
const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true, xfwd: true, secure: true })
let mainWindow = null
let localServer = null
let mcpProcess = null
let mcpPort = MCP_DEFAULT_PORT
let appOrigin = `http://127.0.0.1:${APP_PORT}`
let apiOrigin = ''
let shuttingDown = false

app.setName(APP_NAME)

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
        message: 'Cloud accounts and shared templates need a Studio Nova server. Configure apiOrigin in desktop-config.json.',
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

async function startPackagedServices() {
  seedConfigurationExamples()
  const config = loadDesktopConfig()
  apiOrigin = safeOrigin(config.apiOrigin || process.env.STUDIO_NOVA_API_URL || '')

  localServer = http.createServer(handleRequest)
  await new Promise((resolve, reject) => {
    localServer.once('error', reject)
    localServer.listen(APP_PORT, '127.0.0.1', resolve)
  })

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: APP_NAME,
    autoHideMenuBar: true,
    backgroundColor: '#17191d',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
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

  const address = process.env.STUDIO_NOVA_DESKTOP_DEV === '1' ? 'http://127.0.0.1:5173' : `${appOrigin}/`
  void mainWindow.loadURL(address).catch(async (error) => {
    console.error(error)
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
      if (process.env.STUDIO_NOVA_DESKTOP_DEV !== '1') await startPackagedServices()
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
  if (mcpProcess && !mcpProcess.killed) mcpProcess.kill()
  if (localServer?.listening) localServer.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
