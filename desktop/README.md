# Studio Nova Desktop

Studio Nova Desktop is an Electron shell around the existing Studio Nova editor. The shell serves the built web app from a stable localhost origin so guest designs remain saved between launches, and starts the local MCP bridge alongside the window.

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
