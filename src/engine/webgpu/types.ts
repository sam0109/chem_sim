// ==============================================================
// WebGPU force computation — Type definitions
//
// Defines the interface between the simulation worker (CPU) and
// the GPU compute pipeline for non-bonded forces.
// ==============================================================

/**
 * Per-atom-type-pair LJ parameters, packed for GPU consumption.
 * Stored in a square matrix indexed by [typeA * nTypes + typeB].
 *
 * Units: sigma in Angstrom, epsilon in eV
 * Source: UFF geometric combining rules —
 *   sigma = sqrt(x_i * x_j), epsilon = sqrt(D_i * D_j) * KCAL_TO_EV
 *   Rappe et al., JACS 114, 10024 (1992)
 */
export interface LJParamTable {
  /** Number of distinct atom types */
  nTypes: number;
  /** Map from atomic number to type index (0-based) */
  atomicNumberToType: Map<number, number>;
  /** Flat Float32Array of [sigma, epsilon] pairs, row-major nTypes x nTypes */
  data: Float32Array;
}

/**
 * Exclusion data packed for GPU — sorted array of excluded pair indices.
 * Each pair is encoded as a single uint32: (min(i,j) << 16) | max(i,j).
 * For systems up to 65535 atoms.
 *
 * Binary search in the shader determines if a pair is excluded.
 */
export interface ExclusionData {
  /** Sorted array of encoded excluded pairs */
  pairs: Uint32Array;
  /** Number of valid entries */
  count: number;
}

/**
 * Uniform parameters passed to the compute shader each dispatch.
 *
 * Layout matches the WGSL struct `Uniforms` (std140 aligned):
 *   nAtoms:     u32     (offset 0)
 *   cutoff:     f32     (offset 4)
 *   cutoff2:    f32     (offset 8)
 *   boxX:       f32     (offset 12)
 *   boxY:       f32     (offset 16)
 *   boxZ:       f32     (offset 20)
 *   usePBC:     u32     (offset 24)
 *   wolfAlpha:  f32     (offset 28)
 *   wolfErfcOverRc: f32 (offset 32)
 *   wolfForceShift: f32 (offset 36)
 *   scale14:    f32     (offset 40)
 *   nExclusions: u32    (offset 44)
 *   nScale14:    u32    (offset 48)
 *   _pad:        u32    (offset 52) — padding to 16-byte alignment
 *   _pad2:       u32    (offset 56)
 *   _pad3:       u32    (offset 60)
 *   Total: 64 bytes (4 x vec4<f32> equivalent)
 */
export const UNIFORM_BUFFER_SIZE = 64;

/**
 * Result of a GPU force computation dispatch.
 */
export interface GPUForceResult {
  /** Per-atom forces [fx0, fy0, fz0, fx1, fy1, fz1, ...] in eV/Angstrom */
  forces: Float32Array;
  /** Total LJ potential energy in eV */
  ljEnergy: number;
  /** Total Coulomb potential energy in eV */
  coulombEnergy: number;
}

/**
 * Interface for the GPU non-bonded force compute module.
 * The worker interacts with this interface — implementation details
 * (device, buffers, pipelines) are hidden.
 */
export interface GPUForceCompute {
  /** Whether the GPU is initialized and ready */
  readonly ready: boolean;

  /**
   * Initialize the GPU device and create pipelines.
   * Returns false if WebGPU is unavailable.
   */
  init(): Promise<boolean>;

  /**
   * Compute non-bonded forces on the GPU.
   *
   * @param positions   Flat Float64Array [x0,y0,z0,...] (converted to f32 internally)
   * @param charges     Per-atom charges in elementary charge units
   * @param atomTypes   Per-atom type index (into the LJ param table)
   * @param nAtoms      Number of atoms
   * @param ljParams    LJ parameter table
   * @param exclusions  Excluded pair data (1-2 and 1-3)
   * @param scale14Pairs Scale-1-4 pair data (1-4 dihedrals)
   * @param cutoff      Interaction cutoff in Angstrom
   * @param wolfAlpha   Wolf damping parameter
   * @param wolfErfcOverRc  erfc(alpha*rc)/rc
   * @param wolfForceShift  Force shift constant
   * @param boxSize     PBC box dimensions (undefined = no PBC)
   */
  computeForces(
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
  ): Promise<GPUForceResult>;

  /**
   * Release GPU resources.
   */
  destroy(): void;
}
