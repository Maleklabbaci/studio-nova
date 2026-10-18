import plainWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import gpuWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'
import type { ModelDescriptor } from './model'
import { WorkerBackgroundRemover } from './remover'

/**
 * The remover the app ships: the cut-out worker (built as its own chunk with the model runtime) and the
 * WebAssembly file (an asset of the build, served from the app's own origin like every other file).
 *
 * Two runtime builds exist. The web site ships the small WebAssembly-only one (13.6 MiB): static hosts
 * cap file sizes (Cloudflare Pages: 25 MiB per file) and the GPU build's .wasm alone is 27 MiB. The
 * desktop app has no such cap, so its build ships the JSEP runtime, which can also run the model on
 * the GPU (WebGPU); the engine falls back to WebAssembly per session when there is no usable GPU.
 * The unused branch is dropped from each build.
 */
const wasmUrl = __STUDIO_NOVA_DESKTOP_BUILD__ ? gpuWasmUrl : plainWasmUrl

export function createBundledRemover(model: ModelDescriptor): WorkerBackgroundRemover {
  return new WorkerBackgroundRemover(model, {
    createWorker: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'studio-nova-cutout' }),
    wasmUrl,
  })
}
