/// <reference types="vitest/config" />
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const API_TARGET = process.env.VITE_API_PROXY ?? 'http://localhost:8000'
const MCP_TARGET = process.env.VITE_MCP_PROXY ?? 'http://127.0.0.1:8787'

/**
 * Ships the template catalogue with the static site: the generated template
 * documents (backend/data/templates) are copied into dist/templates-data, so
 * a static deployment with no backend (Cloudflare Pages) can still browse
 * and open templates in the local guest editor. With a backend, the live
 * API wins and these files are simply never fetched. Starter photos keep
 * their production URL (/media/templates/photos/…).
 */
function staticTemplatesPlugin(): Plugin {
  return {
    name: 'studio-nova-static-templates',
    apply: 'build',
    closeBundle() {
      const source = fileURLToPath(new URL('../backend/data/templates', import.meta.url))
      const dist = fileURLToPath(new URL('./dist', import.meta.url))
      const outDir = join(dist, 'templates-data')
      mkdirSync(join(outDir, 'thumbs'), { recursive: true })
      const catalogue: Array<Record<string, unknown>> = []
      try {
        const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8')) as { templates?: Array<Record<string, unknown>> }
        for (const item of manifest.templates ?? []) {
          const slug = typeof item.slug === 'string' ? item.slug : ''
          if (!slug) continue
          try {
            const raw = readFileSync(join(source, `${slug}.json`), 'utf8')
            const doc = JSON.parse(raw) as { width?: number; height?: number; pages?: unknown[] }
            writeFileSync(join(outDir, `${slug}.json`), raw)
            const thumb = join(source, 'thumbs', `${slug}.webp`)
            const hasThumb = existsSync(thumb)
            if (hasThumb) copyFileSync(thumb, join(outDir, 'thumbs', `${slug}.webp`))
            catalogue.push({
              slug,
              title: typeof item.title === 'string' ? item.title : slug,
              category: typeof item.category === 'string' ? item.category : '',
              tags: Array.isArray(item.tags) ? item.tags : [],
              description: typeof item.description === 'string' ? item.description : '',
              preset: typeof item.preset === 'string' ? item.preset : '',
              width: typeof doc.width === 'number' ? doc.width : 0,
              height: typeof doc.height === 'number' ? doc.height : 0,
              pageCount: Array.isArray(doc.pages) ? doc.pages.length : 1,
              thumb: hasThumb,
            })
          } catch {
            // A broken generated file must not fail the site build.
          }
        }
        const photos = join(source, 'photos')
        if (existsSync(photos)) {
          const target = join(dist, 'media', 'templates', 'photos')
          mkdirSync(target, { recursive: true })
          for (const file of readdirSync(photos)) copyFileSync(join(photos, file), join(target, file))
        }
      } catch {
        // No generated catalogue in this checkout: the static site just keeps the API behaviour.
      }
      writeFileSync(join(outDir, 'catalogue.json'), JSON.stringify(catalogue))
    },
  }
}

export default defineConfig({
  plugins: [react(), staticTemplatesPlugin()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Loaded with import() when a video is made: listed so the dev server bundles them at start instead of discovering them
  // mid-session, which reloads the page under a running test.
  optimizeDeps: { include: ['mp4-muxer', 'webm-muxer', 'gifenc'] },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Permit the sandboxed preview domain (keeps Vite's DNS-rebinding protection for other hosts).
    allowedHosts: ['.e2b.app'],
    // Same-origin in dev so session + CSRF cookies just work.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      // The Node/TypeScript MCP agent and the browser-to-canvas bridge share the app's origin in development.
      '/assistant': { target: MCP_TARGET, changeOrigin: true },
      '/mcp': { target: MCP_TARGET, changeOrigin: true },
      '/bridge': { target: MCP_TARGET, changeOrigin: true, ws: true },
      '/media': { target: API_TARGET, changeOrigin: true },
      '/admin': { target: API_TARGET, changeOrigin: true },
      '/static': { target: API_TARGET, changeOrigin: true },
      // Real-time co-editing: the Django dev server (daphne) upgrades the connection.
      '/ws': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
  build: {
    // dist/.vite/manifest.json: the chunk graph that scripts/bundleReport.mjs measures against the budgets.
    manifest: true,
    rollupOptions: {
      // The second page of the app: the presenter view window that "Present with notes" opens (a plain page, no router).
      input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), 'presenter-view': fileURLToPath(new URL('./presenter-view.html', import.meta.url)) },
      output: {
        // The editor's entry module gets a recognisable file name: scripts/bundleReport.mjs finds the chunk by it.
        chunkFileNames: (chunk) => (chunk.moduleIds.some((id) => id.endsWith('/src/editor/index.tsx')) ? 'assets/editor-[hash].js' : 'assets/[name]-[hash].js'),
        // Fabric is the editor's one large dependency (about 300 kB): in its own chunk it is cached across releases
        // of the app and only downloaded together with the editor.
        manualChunks: (id) => (id.includes('/node_modules/fabric/') ? 'fabric' : undefined),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
