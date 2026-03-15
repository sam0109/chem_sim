// ==============================================================
// WebGPU compute pipeline for non-bonded force computation
//
// Creates and manages the compute pipeline, bind groups, and
// dispatches the non-bonded force shader. Orchestrates the full
// GPU compute workflow: upload → dispatch → readback.
// ==============================================================

import type {
  ExclusionData,
  GPUForceCompute,
  GPUForceResult,
  LJParamTable,
} from './types';
import { initWebGPU } from './device';
import { GPUBufferManager, WORKGROUP_SIZE } from './buffers';
import { getNonbondedShaderSource } from './shader';

/**
 * Implementation of GPUForceCompute using WebGPU compute shaders.
 *
 * Lifecycle:
 *   1. Call init() — requests GPU device, compiles shader, creates pipeline
 *   2. Call computeForces() each step — uploads data, dispatches, reads back
 *   3. Call destroy() when done — releases GPU resources
 */
export class WebGPUForceCompute implements GPUForceCompute {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private bufferManager: GPUBufferManager | null = null;
  private _ready = false;

  get ready(): boolean {
    return this._ready;
  }

  async init(): Promise<boolean> {
    const result = await initWebGPU();
    if (!result.device) {
      return false;
    }

    this.device = result.device;
    this.bufferManager = new GPUBufferManager(this.device);

    // Compile shader
    const shaderSource = getNonbondedShaderSource(WORKGROUP_SIZE);
    const shaderModule = this.device.createShaderModule({
      code: shaderSource,
    });

    // Check for compilation errors
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const msg of compilationInfo.messages) {
      if (msg.type === 'error') {
        this.destroy();
        return false;
      }
    }

    // Create bind group layout
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        // @binding(0): Uniforms
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        // @binding(1): positions (read-only storage)
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        // @binding(2): charges (read-only storage)
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        // @binding(3): atomTypes (read-only storage)
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        // @binding(4): ljParams (read-only storage)
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        // @binding(5): exclusions (read-only storage)
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        // @binding(6): scale14Pairs (read-only storage)
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        // @binding(7): forcesOut (read-write storage)
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' },
        },
        // @binding(8): energyOut (read-write storage)
        {
          binding: 8,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' },
        },
      ],
    });

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    // Create compute pipeline
    this.pipeline = this.device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });

    this._ready = true;
    return true;
  }

  async computeForces(
    positions: Float64Array,
    charges: Float64Array,
    atomTypes: Uint32Array,
    nAtoms: number,
    ljParams: LJParamTable,
    exclusions: ExclusionData,
    scale14Pairs: ExclusionData,
    cutoff: number,
    wolfAlpha: number,
    wolfErfcOverRc: number,
    wolfForceShift: number,
    boxSize?: [number, number, number],
  ): Promise<GPUForceResult> {
    if (
      !this._ready ||
      !this.device ||
      !this.pipeline ||
      !this.bufferManager ||
      !this.bindGroupLayout
    ) {
      throw new Error('GPU force compute not initialized');
    }

    const bm = this.bufferManager;

    // Ensure buffers are large enough
    bm.ensureCapacity(
      nAtoms,
      ljParams.nTypes,
      Math.max(1, exclusions.count),
      Math.max(1, scale14Pairs.count),
    );

    // Upload data to GPU
    bm.uploadPositions(positions, nAtoms);
    bm.uploadCharges(charges, nAtoms);
    bm.uploadAtomTypes(atomTypes, nAtoms);
    bm.uploadLJParams(ljParams);
    bm.uploadExclusions(exclusions);
    bm.uploadScale14(scale14Pairs);

    // Scale14 factor = 0.5 (AMBER/OPLS convention)
    // Source: Cornell et al., JACS 117, 5179 (1995)
    const SCALE_14 = 0.5;

    bm.uploadUniforms(
      nAtoms,
      cutoff,
      wolfAlpha,
      wolfErfcOverRc,
      wolfForceShift,
      SCALE_14,
      exclusions.count,
      scale14Pairs.count,
      boxSize,
    );

    // Create bind group with current buffers
    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bm.uniformBuffer! } },
        { binding: 1, resource: { buffer: bm.positionBuffer! } },
        { binding: 2, resource: { buffer: bm.chargeBuffer! } },
        { binding: 3, resource: { buffer: bm.atomTypeBuffer! } },
        { binding: 4, resource: { buffer: bm.ljParamBuffer! } },
        { binding: 5, resource: { buffer: bm.exclusionBuffer! } },
        { binding: 6, resource: { buffer: bm.scale14Buffer! } },
        { binding: 7, resource: { buffer: bm.forceBuffer! } },
        { binding: 8, resource: { buffer: bm.energyBuffer! } },
      ],
    });

    // Encode and dispatch compute pass
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);

    // Dispatch enough workgroups to cover all atoms
    const nWorkgroups = Math.ceil(nAtoms / WORKGROUP_SIZE);
    pass.dispatchWorkgroups(nWorkgroups);
    pass.end();

    // Read back results (also submits the command buffer)
    const result = await bm.readbackForces(nAtoms, encoder);

    return {
      forces: result.forces,
      ljEnergy: result.ljEnergy,
      coulombEnergy: result.coulombEnergy,
    };
  }

  destroy(): void {
    this.bufferManager?.destroy();
    // GPUDevice does not need explicit cleanup per the spec;
    // destroying buffers is sufficient. But we clear references.
    this.device = null;
    this.pipeline = null;
    this.bindGroupLayout = null;
    this.bufferManager = null;
    this._ready = false;
  }
}
