// ==============================================================
// WebGPU device initialization and feature detection
//
// Handles requesting a GPU adapter and device, with graceful
// fallback when WebGPU is unavailable (older browsers, no GPU).
//
// WebGPU availability in Web Workers:
//   Chrome 113+, Edge 113+ — navigator.gpu available in workers
//   Firefox — behind flag, not yet in workers
//   Safari — partial support
// Reference: https://caniuse.com/webgpu
// ==============================================================

/**
 * Result of GPU initialization attempt.
 */
export interface GPUInitResult {
  /** The GPU device, or null if unavailable */
  device: GPUDevice | null;
  /** Human-readable reason if initialization failed */
  reason: string;
}

/**
 * Attempt to initialize a WebGPU device.
 *
 * Checks for `navigator.gpu` (works in both main thread and Web Workers
 * in supported browsers), requests an adapter, then a device.
 *
 * @returns GPUDevice if successful, null with reason if not
 */
export async function initWebGPU(): Promise<GPUInitResult> {
  // Feature detection — navigator.gpu exists in supporting browsers/workers
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return {
      device: null,
      reason: 'WebGPU not available (navigator.gpu is undefined)',
    };
  }

  // Request adapter — may return null if no suitable GPU
  let adapter: GPUAdapter | null;
  try {
    adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      device: null,
      reason: `Failed to request GPU adapter: ${msg}`,
    };
  }

  if (!adapter) {
    return {
      device: null,
      reason: 'No suitable GPU adapter found',
    };
  }

  // Request device with default limits (sufficient for our compute workload)
  let device: GPUDevice;
  try {
    device = await adapter.requestDevice({
      // We need storage buffers and compute shaders — both are default features.
      // No special features or raised limits needed for systems < 65536 atoms.
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      device: null,
      reason: `Failed to request GPU device: ${msg}`,
    };
  }

  // Set up a lost handler to log device loss (can happen if GPU is reset)
  device.lost.then((info) => {
    // Only log in development — no console.log in production per project rules
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV === 'development'
    ) {
      console.warn(`WebGPU device lost: ${info.reason} — ${info.message}`);
    }
  });

  return {
    device,
    reason: 'WebGPU initialized successfully',
  };
}
