import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'
import type { ModelDescriptor } from './model'
import { WorkerBackgroundRemover } from './remover'

/**
 * The remover the app ships: the cut-out worker (built as its own chunk with the model runtime) and the
 * WebAssembly file (an asset of the build, served from the app's own origin like every other file).
 * The JSEP runtime build is the one that can also run on the GPU (WebGPU); the plain WebAssembly
 * backend remains its built-in fallback, so the same file serves every machine.
 */
export function createBundledRemover(model: ModelDescriptor): WorkerBackgroundRemover {
  return new WorkerBackgroundRemover(model, {
    createWorker: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'studio-nova-cutout' }),
    wasmUrl,
  })
}
