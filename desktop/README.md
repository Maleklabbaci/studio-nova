# Studio Nova Desktop

Studio Nova Desktop is an Electron shell around the existing Studio Nova editor. The shell serves the built web app from a stable localhost origin so guest designs remain saved between launches, and starts the local MCP bridge alongside the window.

The window is frameless and opens straight on the studio (designs, templates, create) — never on the marketing home page. The app draws a macOS-style title bar with traffic-light window controls (`frontend/src/app/DesktopTitlebar.tsx`, wired to `main.cjs` through the small `preload.cjs` bridge, `window.studioNovaDesktop`) and sizes its layouts to the window minus that bar.

## Offline and local mode

The studio is usable with no connection and no account. Guest designs live in the app's IndexedDB (the stable `127.0.0.1:48291` origin is what makes them survive restarts), so opening, editing, autosaving, exporting and browsing the bundled template catalogue all work offline.

Account pages need the app's local server. It starts beside the window and a first launch may spend up to half a minute migrating and seeding the catalogues; the window no longer waits for it and no longer dead-ends on “We can’t reach Studio Nova”. Anonymous or offline visitors to `/dashboard` (and to `/design/:id`) are sent to `/studio`, which lists the designs on this computer. The web app retries its session check quietly while the engine finishes starting, so signing in and cloud designs appear as soon as it answers. A missing or crashed engine simply leaves the app in local mode; the AI assistant keeps needing its provider key and a connection.

Background removal runs on the GPU (WebGPU) when one is available, with WebAssembly as fallback. On first launch the local server also downloads the full-size U²-Net model in the background (one-time, hash-verified); once installed it is advertised automatically and gives noticeably better cut-outs than the small bundled model.

## Updates

A few seconds after launch, the packaged app compares its own version with the one in the web site's `/downloads/manifest.json` (published alongside the installers). When a newer version exists it offers the download; "Later" snoozes that version, and installing over the top keeps every design and setting (they live in the per-user data directory, not the install folder). The feed can be overridden with `updateManifestUrl` in `desktop-config.json`. Version comparison lives in `updateCheck.cjs` (`npm test` here runs its assertions).

## Develop the desktop shell

Start Vite and the MCP service in separate terminals, then launch Electron:

```sh
npm --prefix frontend run dev
npm --prefix mcp-server run dev
cd desktop && npm run dev
```

## Build an installer

Node.js 22.12 or newer is required. Install dependencies from the repository root:

```sh
npm ci --prefix frontend
npm ci --prefix mcp-server
npm ci --prefix desktop
```

Build the web app and MCP bridge, then package for the current runner:

```sh
cd desktop
npm run build:resources
npm run package:linux    # Linux x64 AppImage
npm run package:windows  # Windows x64 NSIS installer
npm run package:macos    # macOS universal DMG; build on macOS
```

The `Studio Nova desktop packages` workflow builds all three installers on native Windows, macOS and Linux runners. Run it manually in GitHub Actions or push a version tag. It also assembles a static website artifact with installers in `downloads/`; publish the contents of that artifact to the root of your Studio Nova website for the landing-page download buttons to work.

Installers are written to `desktop/release/` and copied to `frontend/public/downloads/`; both generated binary folders are ignored by Git. The release workflow assembles all three files and the download manifest into the static site artifact.

## Server configuration

The desktop editor works in guest/local mode without a server. To use cloud accounts, shared templates, uploads and real-time collaboration, copy the generated `desktop-config.example.json` to `desktop-config.json` in Electron's `userData` directory and set `apiOrigin` to the origin of your Studio Nova Django server, for example `https://studio.example.com`.

The built-in AI assistant needs an LLM key. Copy the generated `mcp-server/.env.example` to `mcp-server/.env` under the same `userData` directory and add:

```dotenv
LLM_API_KEY=your-provider-key
LLM_MODEL=gpt-4o-mini
```

Restart Studio Nova Desktop after changing configuration. Keep keys private; do not put them in the landing-page source or installer download files.

## Notes

- Windows and macOS installers are unsigned in this project setup. Operating systems may show their standard first-run security warning until you configure code-signing certificates.
- `LICENSE` and `NOTICE` are included with the desktop package, and the required attribution remains visible in the app.
