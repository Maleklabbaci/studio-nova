/**
 * Build-time constant injected by vite.config.ts (`define`): `true` only for
 * the Electron desktop build (`STUDIO_NOVA_DESKTOP_BUILD=1`), which ships the
 * GPU-capable background-removal runtime. The web build stays on the small
 * WebAssembly runtime — static hosts cap individual file sizes.
 */
declare const __STUDIO_NOVA_DESKTOP_BUILD__: boolean
