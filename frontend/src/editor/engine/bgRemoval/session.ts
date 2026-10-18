import * as ort from 'onnxruntime-web/wasm'
import { BackgroundRemovalError } from '../bgRemoval'
import type { ModelDescriptor } from './model'

/** An ONNX model loaded into the WebAssembly runtime. */
export interface Segmenter {
  /** Runs the model on a planar `1 x 3 x size x size` tensor and returns the first output's values. */
  run(input: Float32Array): Promise<Float32Array>
}

/** Whether an error means "the page's policy forbids WebAssembly or code generation". */
export function isPolicyBlock(error: unknown): boolean {
  if (error instanceof EvalError) return true
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /unsafe-eval|wasm-unsafe-eval|content security policy|CSP/i.test(text)
}

/** Whether this browser exposes a GPU the WebGPU backend can run on. */
export function webgpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

/**
 * Starts the runtime and loads the model. In the desktop build — the one that
 * ships the GPU-capable runtime (vite.config.ts swaps the module in, the web
 * build keeps the small WebAssembly-only runtime because static hosts cap
 * file sizes) — WebGPU is tried first when the machine has a GPU: on real
 * photos it runs the model several times faster than WebAssembly, which is
 * what makes even the full-size model feel instant. WebAssembly stays as the
 * universal fallback. Threads are used only when the page is cross-origin
 * isolated (`SharedArrayBuffer` needs it); otherwise the single-threaded SIMD
 * build runs, which needs no headers.
 */
export async function createSegmenter(
  model: ArrayBuffer,
  descriptor: ModelDescriptor,
  wasmUrl: string,
  threads: number,
): Promise<Segmenter> {
  ort.env.wasm.wasmPaths = { wasm: wasmUrl }
  ort.env.wasm.numThreads = threads
  ort.env.wasm.proxy = false
  const gpuBuild = typeof __STUDIO_NOVA_DESKTOP_BUILD__ !== 'undefined' && __STUDIO_NOVA_DESKTOP_BUILD__
  const attempts: string[][] = gpuBuild && webgpuAvailable() ? [['webgpu', 'wasm'], ['wasm']] : [['wasm']]
  let session: ort.InferenceSession | null = null
  let lastError: unknown = null
  for (const executionProviders of attempts) {
    try {
      session = await ort.InferenceSession.create(new Uint8Array(model), {
        executionProviders,
        graphOptimizationLevel: 'all',
      })
      break
    } catch (error) {
      if (isPolicyBlock(error) || error instanceof WebAssembly.CompileError) {
        throw new BackgroundRemovalError('The page blocks WebAssembly.', 'blocked')
      }
      lastError = error
    }
  }
  if (!session) {
    throw new BackgroundRemovalError(`The model could not be loaded: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  }
  const { size } = descriptor.input
  return {
    async run(input) {
      const feeds = { [descriptor.input.name]: new ort.Tensor('float32', input, [1, 3, size, size]) }
      const results = await session.run(feeds, [descriptor.output])
      const tensor = results[descriptor.output]
      if (!tensor || !(tensor.data instanceof Float32Array)) {
        throw new BackgroundRemovalError('The model returned an unexpected result.')
      }
      return tensor.data
    },
  }
}
