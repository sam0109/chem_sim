// ==============================================================
// WebGPU buffer management for non-bonded force computation
//
// Manages GPU buffers for positions, forces, charges, LJ params,
// exclusion data, and uniforms. Handles CPU ↔ GPU data transfer.
//
// All position/force data is converted from Float64 (CPU) to
// Float32 (GPU). Float32 provides ~7 significant digits, which
// is sufficient for interatomic distances (1-10 Angstrom) and
// force magnitudes in molecular dynamics.
// ==============================================================

import type { ExclusionData, LJParamTable } from './types';
import { UNIFORM_BUFFER_SIZE } from './types';

/**
 * Maximum atoms supported by the GPU path.
 * Limited by the 16-bit pair encoding in exclusion data.
 */
const MAX_ATOMS = 65535;

/**
 * Workgroup size for the compute shader.
 * 64 is a good default — maps to one wavefront on AMD (64 lanes)
 * and two warps on NVIDIA (2 x 32 lanes).
 */
export const WORKGROUP_SIZE = 64;

/**
 * Manages all GPU buffers and handles data upload/readback.
 */
export class GPUBufferManager {
  private device: GPUDevice;

  // --- Storage buffers (read by shader) ---
  /** Positions: vec4<f32> per atom (xyz + padding) */
  positionBuffer: GPUBuffer | null = null;
  /** Charges: f32 per atom */
  chargeBuffer: GPUBuffer | null = null;
  /** Atom type indices: u32 per atom */
  atomTypeBuffer: GPUBuffer | null = null;
  /** LJ parameter table: vec2<f32> (sigma, epsilon) per type pair */
  ljParamBuffer: GPUBuffer | null = null;
  /** Excluded pairs: u32 sorted array */
  exclusionBuffer: GPUBuffer | null = null;
  /** 1-4 scaled pairs: u32 sorted array */
  scale14Buffer: GPUBuffer | null = null;

  // --- Storage buffers (written by shader) ---
  /** Force output: vec4<f32> per atom (xyz + energy) */
  forceBuffer: GPUBuffer | null = null;
  /** Energy output: vec2<f32> (ljEnergy, coulombEnergy) per workgroup */
  energyBuffer: GPUBuffer | null = null;

  // --- Readback buffers (MAP_READ) ---
  forceReadbackBuffer: GPUBuffer | null = null;
  energyReadbackBuffer: GPUBuffer | null = null;

  // --- Uniform buffer ---
  uniformBuffer: GPUBuffer | null = null;

  /** Current allocated capacity (atoms) */
  private capacity = 0;
  /** Current LJ type count */
  private ljTypeCapacity = 0;
  /** Current exclusion capacity */
  private exclusionCapacity = 0;
  /** Current scale14 capacity */
  private scale14Capacity = 0;
  /** Number of workgroups for current dispatch */
  private nWorkgroups = 0;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Ensure buffers are allocated for the given atom count.
   * Reallocates only when capacity is insufficient.
   */
  ensureCapacity(
    nAtoms: number,
    nLJTypes: number,
    nExclusions: number,
    nScale14: number,
  ): void {
    if (nAtoms > MAX_ATOMS) {
      throw new Error(
        `GPU force compute supports at most ${MAX_ATOMS} atoms, got ${nAtoms}`,
      );
    }

    // Only reallocate when needed (avoid per-frame allocation)
    if (nAtoms > this.capacity) {
      this.allocateAtomBuffers(nAtoms);
    }
    if (nLJTypes > this.ljTypeCapacity) {
      this.allocateLJBuffer(nLJTypes);
    }
    if (nExclusions > this.exclusionCapacity) {
      this.allocateExclusionBuffer(nExclusions);
    }
    if (nScale14 > this.scale14Capacity) {
      this.allocateScale14Buffer(nScale14);
    }

    // Energy buffer depends on workgroup count
    const nWg = Math.ceil(nAtoms / WORKGROUP_SIZE);
    if (nWg !== this.nWorkgroups) {
      this.allocateEnergyBuffer(nWg);
      this.nWorkgroups = nWg;
    }
  }

  /**
   * Upload positions from CPU Float64Array to GPU Float32 buffer.
   * Converts from flat [x0,y0,z0,x1,...] to vec4-aligned [x0,y0,z0,0,...].
   */
  uploadPositions(positions: Float64Array, nAtoms: number): void {
    // vec4<f32> layout: 4 floats per atom (xyz + padding)
    const data = new Float32Array(nAtoms * 4);
    for (let i = 0; i < nAtoms; i++) {
      data[i * 4] = positions[i * 3];
      data[i * 4 + 1] = positions[i * 3 + 1];
      data[i * 4 + 2] = positions[i * 3 + 2];
      // data[i * 4 + 3] = 0; // padding (already zero-initialized)
    }
    this.device.queue.writeBuffer(this.positionBuffer!, 0, data);
  }

  /**
   * Upload charges from CPU Float64Array to GPU Float32 buffer.
   */
  uploadCharges(charges: Float64Array, nAtoms: number): void {
    const data = new Float32Array(nAtoms);
    for (let i = 0; i < nAtoms; i++) {
      data[i] = charges[i];
    }
    this.device.queue.writeBuffer(this.chargeBuffer!, 0, data);
  }

  /**
   * Upload atom type indices.
   */
  uploadAtomTypes(atomTypes: Uint32Array, nAtoms: number): void {
    this.device.queue.writeBuffer(
      this.atomTypeBuffer!,
      0,
      atomTypes,
      0,
      nAtoms,
    );
  }

  /**
   * Upload LJ parameter table.
   */
  uploadLJParams(ljParams: LJParamTable): void {
    this.device.queue.writeBuffer(this.ljParamBuffer!, 0, ljParams.data);
  }

  /**
   * Upload exclusion pair data.
   */
  uploadExclusions(exclusions: ExclusionData): void {
    if (exclusions.count > 0) {
      this.device.queue.writeBuffer(
        this.exclusionBuffer!,
        0,
        exclusions.pairs,
        0,
        exclusions.count,
      );
    }
  }

  /**
   * Upload 1-4 scale pair data.
   */
  uploadScale14(scale14: ExclusionData): void {
    if (scale14.count > 0) {
      this.device.queue.writeBuffer(
        this.scale14Buffer!,
        0,
        scale14.pairs,
        0,
        scale14.count,
      );
    }
  }

  /**
   * Upload uniform buffer with current simulation parameters.
   */
  uploadUniforms(
    nAtoms: number,
    cutoff: number,
    wolfAlpha: number,
    wolfErfcOverRc: number,
    wolfForceShift: number,
    scale14: number,
    nExclusions: number,
    nScale14Pairs: number,
    boxSize?: [number, number, number],
  ): void {
    const buffer = new ArrayBuffer(UNIFORM_BUFFER_SIZE);
    const u32 = new Uint32Array(buffer);
    const f32 = new Float32Array(buffer);

    u32[0] = nAtoms;
    f32[1] = cutoff;
    f32[2] = cutoff * cutoff;
    f32[3] = boxSize ? boxSize[0] : 0;
    f32[4] = boxSize ? boxSize[1] : 0;
    f32[5] = boxSize ? boxSize[2] : 0;
    u32[6] = boxSize ? 1 : 0;
    f32[7] = wolfAlpha;
    f32[8] = wolfErfcOverRc;
    f32[9] = wolfForceShift;
    f32[10] = scale14;
    u32[11] = nExclusions;
    u32[12] = nScale14Pairs;
    // u32[13..15] = 0 padding

    this.device.queue.writeBuffer(this.uniformBuffer!, 0, buffer);
  }

  /**
   * Read back force results from GPU.
   * Returns per-atom forces and accumulated energies.
   */
  async readbackForces(
    nAtoms: number,
    encoder: GPUCommandEncoder,
  ): Promise<{
    forces: Float32Array;
    ljEnergy: number;
    coulombEnergy: number;
  }> {
    // Copy force buffer to readback buffer
    const forceBytes = nAtoms * 4 * 4; // vec4<f32> per atom
    encoder.copyBufferToBuffer(
      this.forceBuffer!,
      0,
      this.forceReadbackBuffer!,
      0,
      forceBytes,
    );

    // Copy energy buffer to readback buffer
    const nWg = Math.ceil(nAtoms / WORKGROUP_SIZE);
    const energyBytes = nWg * 2 * 4; // vec2<f32> per workgroup
    encoder.copyBufferToBuffer(
      this.energyBuffer!,
      0,
      this.energyReadbackBuffer!,
      0,
      energyBytes,
    );

    // Submit and wait
    this.device.queue.submit([encoder.finish()]);

    // Map and read
    await this.forceReadbackBuffer!.mapAsync(GPUMapMode.READ, 0, forceBytes);
    await this.energyReadbackBuffer!.mapAsync(GPUMapMode.READ, 0, energyBytes);

    const forceData = new Float32Array(
      this.forceReadbackBuffer!.getMappedRange(0, forceBytes).slice(0),
    );
    const energyData = new Float32Array(
      this.energyReadbackBuffer!.getMappedRange(0, energyBytes).slice(0),
    );

    this.forceReadbackBuffer!.unmap();
    this.energyReadbackBuffer!.unmap();

    // Extract forces: convert from vec4 (xyz + unused) to flat xyz
    const forces = new Float32Array(nAtoms * 3);
    for (let i = 0; i < nAtoms; i++) {
      forces[i * 3] = forceData[i * 4];
      forces[i * 3 + 1] = forceData[i * 4 + 1];
      forces[i * 3 + 2] = forceData[i * 4 + 2];
    }

    // Sum per-workgroup energies
    let ljEnergy = 0;
    let coulombEnergy = 0;
    for (let i = 0; i < nWg; i++) {
      ljEnergy += energyData[i * 2];
      coulombEnergy += energyData[i * 2 + 1];
    }

    return { forces, ljEnergy, coulombEnergy };
  }

  /**
   * Release all GPU buffers.
   */
  destroy(): void {
    const buffers = [
      this.positionBuffer,
      this.chargeBuffer,
      this.atomTypeBuffer,
      this.ljParamBuffer,
      this.exclusionBuffer,
      this.scale14Buffer,
      this.forceBuffer,
      this.energyBuffer,
      this.forceReadbackBuffer,
      this.energyReadbackBuffer,
      this.uniformBuffer,
    ];
    for (const buf of buffers) {
      buf?.destroy();
    }
    this.capacity = 0;
    this.ljTypeCapacity = 0;
    this.exclusionCapacity = 0;
    this.scale14Capacity = 0;
    this.nWorkgroups = 0;
  }

  // --- Private allocation helpers ---

  private allocateAtomBuffers(nAtoms: number): void {
    // Round up to next multiple of WORKGROUP_SIZE for clean dispatch
    const capacity = Math.ceil(nAtoms / WORKGROUP_SIZE) * WORKGROUP_SIZE;

    this.positionBuffer?.destroy();
    this.chargeBuffer?.destroy();
    this.atomTypeBuffer?.destroy();
    this.forceBuffer?.destroy();
    this.forceReadbackBuffer?.destroy();

    // vec4<f32> per atom = 16 bytes
    this.positionBuffer = this.device.createBuffer({
      size: capacity * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // f32 per atom = 4 bytes
    this.chargeBuffer = this.device.createBuffer({
      size: capacity * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // u32 per atom = 4 bytes
    this.atomTypeBuffer = this.device.createBuffer({
      size: capacity * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // vec4<f32> per atom (force output) = 16 bytes
    this.forceBuffer = this.device.createBuffer({
      size: capacity * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    this.forceReadbackBuffer = this.device.createBuffer({
      size: capacity * 16,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // Uniform buffer (fixed size)
    this.uniformBuffer?.destroy();
    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.capacity = capacity;
  }

  private allocateLJBuffer(nTypes: number): void {
    this.ljParamBuffer?.destroy();
    // nTypes x nTypes x vec2<f32> (sigma, epsilon) = 8 bytes per entry
    this.ljParamBuffer = this.device.createBuffer({
      size: nTypes * nTypes * 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.ljTypeCapacity = nTypes;
  }

  private allocateExclusionBuffer(count: number): void {
    this.exclusionBuffer?.destroy();
    // Minimum 4 bytes to avoid zero-size buffer
    const size = Math.max(4, count * 4);
    this.exclusionBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.exclusionCapacity = count;
  }

  private allocateScale14Buffer(count: number): void {
    this.scale14Buffer?.destroy();
    // Minimum 4 bytes to avoid zero-size buffer
    const size = Math.max(4, count * 4);
    this.scale14Buffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.scale14Capacity = count;
  }

  private allocateEnergyBuffer(nWorkgroups: number): void {
    this.energyBuffer?.destroy();
    this.energyReadbackBuffer?.destroy();
    // vec2<f32> per workgroup = 8 bytes
    const size = Math.max(8, nWorkgroups * 8);
    this.energyBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    this.energyReadbackBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }
}

/**
 * Build an LJ parameter table from the set of atomic numbers present.
 *
 * Creates a compact type-indexed table suitable for GPU upload.
 * Uses UFF geometric combining rules.
 *
 * @param atomicNumbers   Array of atomic numbers in the system
 * @param getLJParamsFn   Function to get LJ params for a pair (from uff.ts)
 */
export function buildLJParamTable(
  atomicNumbers: Int32Array,
  nAtoms: number,
  getLJParamsFn: (z1: number, z2: number) => { sigma: number; epsilon: number },
): LJParamTable {
  // Collect unique atomic numbers
  const uniqueZ = new Set<number>();
  for (let i = 0; i < nAtoms; i++) {
    uniqueZ.add(atomicNumbers[i]);
  }

  const sortedZ = Array.from(uniqueZ).sort((a, b) => a - b);
  const nTypes = sortedZ.length;
  const atomicNumberToType = new Map<number, number>();
  for (let i = 0; i < nTypes; i++) {
    atomicNumberToType.set(sortedZ[i], i);
  }

  // Build the nTypes x nTypes parameter matrix
  const data = new Float32Array(nTypes * nTypes * 2);
  for (let a = 0; a < nTypes; a++) {
    for (let b = 0; b < nTypes; b++) {
      const { sigma, epsilon } = getLJParamsFn(sortedZ[a], sortedZ[b]);
      const idx = (a * nTypes + b) * 2;
      data[idx] = sigma;
      data[idx + 1] = epsilon;
    }
  }

  return { nTypes, atomicNumberToType, data };
}

/**
 * Pack an exclusion set (Set<string> of "i-j" keys) into GPU-friendly
 * sorted uint32 array.
 *
 * Encoding: (min(i,j) << 16) | max(i,j) — supports up to 65535 atoms.
 */
export function packExclusions(exclusionSet: Set<string>): ExclusionData {
  const pairs = new Uint32Array(exclusionSet.size);
  let idx = 0;
  for (const key of exclusionSet) {
    const dash = key.indexOf('-');
    const a = parseInt(key.substring(0, dash), 10);
    const b = parseInt(key.substring(dash + 1), 10);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    pairs[idx++] = (lo << 16) | hi;
  }
  // Sort for binary search in shader
  pairs.sort();
  return { pairs, count: idx };
}
