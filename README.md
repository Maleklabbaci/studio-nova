# Studio Nova

**An open-source design canvas with an AI copilot.** Studio Nova is a creative workspace with a coral-and-charcoal visual identity, a React/Fabric.js editor, a Django backend, and an integrated Node.js/TypeScript MCP assistant.

## What’s included

- Multi-page design editor, local guest editing, exports, templates, and the existing Django API.
- Studio Nova brand system: custom SVG mark, coral/charcoal/ivory palette, typography, favicon, PWA icons, and Open Graph artwork.
- Integrated AI chat in the editor. The copilot can inspect and edit the active canvas through MCP tools.
- Standalone Streamable HTTP MCP endpoint at `/mcp` for MCP-compatible clients.
- Any OpenAI Chat Completions-compatible provider can be configured by environment variables. The provider key stays on the server.

## Run with Docker Compose

1. Configure the stack:

   ```sh
   cp .env.example .env
   ```

   Set `POSTGRES_PASSWORD` and `DJANGO_SECRET_KEY`. To enable the editor copilot, set `LLM_API_KEY` (and optionally `LLM_BASE_URL` and `LLM_MODEL`). Keep the key server-side; never add it to frontend environment variables.

2. Start Studio Nova:

   ```sh
   docker compose up --build
   ```

   Open <http://localhost:8080>.

3. To let an external MCP client control the currently connected editor, create a bearer token in `.env`:

   ```sh
   openssl rand -hex 32
   ```

   Set the output as `MCP_AUTH_TOKEN`, restart the stack, and connect your MCP client to `http://localhost:8080/mcp` with `Authorization: Bearer <token>`. The production MCP endpoint is disabled until this token is configured. Set `BRIDGE_ALLOWED_ORIGINS` to the exact public site origin(s), comma-separated, when deploying behind a domain.

The chat panel and canvas bridge share the app’s origin. If no LLM key is configured, the editor displays setup guidance; the canvas remains usable without AI.

## Desktop application

Studio Nova can be packaged as a Windows installer, a macOS DMG, and a Linux AppImage. See [`desktop/README.md`](desktop/README.md) for local builds and configuration. The `Studio Nova desktop packages` GitHub Actions workflow builds all three installers and assembles a static site artifact containing the landing page and the files under `/downloads/`. Publish that site artifact to your web host to enable the download buttons.

The desktop app supports local guest design without a server. Cloud features need your Studio Nova API origin, and the AI assistant needs a provider key; neither is bundled into the installers.

## Local development

Requirements: Node.js 20+, Python 3.12+, and Docker Compose for PostgreSQL.

1. Start the development database, configure the Django environment, then install the app dependencies:

   ```sh
   docker compose -f docker-compose.dev.yml up -d
   cp backend/.env.example backend/.env
   ```

   In `backend/.env`, set `DATABASE_URL` to match the credentials of your local development database, then run `make setup`.

2. Start the backend, MCP server, and Vite frontend in separate terminals:

   ```sh
   make dev-api
   ```

   ```sh
   cd mcp-server
   cp .env.example .env
   # Set LLM_API_KEY (and provider/model settings) in mcp-server/.env.
   npm run dev
   ```

   ```sh
   make dev-web
   ```

   Visit <http://localhost:5173>. Vite proxies `/api` to Django and `/assistant`, `/mcp`, and `/bridge` to the local MCP service. For UI-only work, the MCP server can run without an LLM key; the canvas editor itself remains available.

## Checks

```sh
cd frontend
npm run typecheck
npm test -- --pool=forks --maxWorkers=2
npm run build

cd ../mcp-server
npm run typecheck
npm test
npm run build
```

Or use `make test` and `make lint` for repository checks.

## Attribution and license

The retained `LICENSE` and `NOTICE` require the following visible attribution when this application is redistributed:

> Doory by Siam, creator and maintainer of Doory, https://github.com/shaongitbd/doory

Keep this credit in the application. See `LICENSE` and `NOTICE` for the complete terms.
