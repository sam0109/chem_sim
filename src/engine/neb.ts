// ==============================================================
// Nudged Elastic Band (NEB) method for reaction path finding
//
// Finds the minimum energy path (MEP) between reactant and product
// geometries by optimizing a chain of intermediate images connected
// by springs, with forces projected to prevent corner-cutting.
//
// References:
//   Henkelman, Uberuaga & Jónsson, J. Chem. Phys. 113, 9901 (2000)
//   — Climbing-image NEB (CI-NEB)
//   Henkelman & Jónsson, J. Chem. Phys. 113, 9978 (2000)
//   — Improved tangent estimation
// ==============================================================

import type { NEBConfig, NEBImage, NEBResult } from '../data/types';

/** Default NEB configuration values */
export const DEFAULT_NEB_CONFIG: NEBConfig = {
  nImages: 7,
  springK: 0.1, // eV/Å² — typical value for molecular systems
  climbingImage: true,
  ciActivationIter: 20,
  maxIterations: 500,
  forceTolerance: 0.05, // eV/Å
  stepSize: 0.01, // Å
};

/**
 * Generate intermediate images by linear interpolation between
 * reactant and product positions.
 *
 * @param reactant  flat position array [x0,y0,z0,...] for reactant
 * @param product   flat position array [x0,y0,z0,...] for product
 * @param nImages   number of intermediate images (not counting endpoints)
 * @returns array of (nImages + 2) flat position arrays including endpoints
 */
export function linearInterpolate(
  reactant: Float64Array,
  product: Float64Array,
  nImages: number,
): Float64Array[] {
  const totalImages = nImages + 2; // include endpoints
  const n3 = reactant.length;
  const images: Float64Array[] = [];

  for (let img = 0; img < totalImages; img++) {
    const t = img / (totalImages - 1);
    const pos = new Float64Array(n3);
    for (let k = 0; k < n3; k++) {
      pos[k] = reactant[k] + t * (product[k] - reactant[k]);
    }
    images.push(pos);
  }

  return images;
}

/**
 * Compute the improved tangent vector at an intermediate image.
 *
 * Uses the higher-energy neighbor to define the tangent direction,
 * avoiding kinks in the path at energy minima along the chain.
 *
 * Reference: Henkelman & Jónsson, J. Chem. Phys. 113, 9978 (2000), Eq. 8-11
 *
 * @param prevPos  positions of the previous image (i-1)
 * @param currPos  positions of the current image (i)
 * @param nextPos  positions of the next image (i+1)
 * @param prevE    energy of the previous image
 * @param currE    energy of the current image
 * @param nextE    energy of the next image
 * @returns normalized tangent vector (flat Float64Array)
 */
export function computeTangent(
  prevPos: Float64Array,
  currPos: Float64Array,
  nextPos: Float64Array,
  prevE: number,
  currE: number,
  nextE: number,
): Float64Array {
  const n3 = currPos.length;
  const tauPlus = new Float64Array(n3); // vector from current to next
  const tauMinus = new Float64Array(n3); // vector from previous to current

  for (let k = 0; k < n3; k++) {
    tauPlus[k] = nextPos[k] - currPos[k];
    tauMinus[k] = currPos[k] - prevPos[k];
  }

  const tangent = new Float64Array(n3);

  // Improved tangent: choose based on relative energies to avoid kinks
  // Reference: Henkelman & Jónsson (2000), Eq. 8-11
  const dEPlus = nextE - currE;
  const dEMinus = currE - prevE;

  if (dEPlus > 0 && dEMinus > 0) {
    // Energy increasing in both directions — use forward tangent
    for (let k = 0; k < n3; k++) tangent[k] = tauPlus[k];
  } else if (dEPlus < 0 && dEMinus < 0) {
    // Energy decreasing in both directions — use backward tangent
    for (let k = 0; k < n3; k++) tangent[k] = tauMinus[k];
  } else {
    // At an extremum — weighted average using energy differences
    const absPlus = Math.abs(dEPlus);
    const absMinus = Math.abs(dEMinus);
    const dEMax = Math.max(absPlus, absMinus);
    const dEMin = Math.min(absPlus, absMinus);

    if (nextE > prevE) {
      // Higher energy ahead: weight toward forward direction
      for (let k = 0; k < n3; k++) {
        tangent[k] = tauPlus[k] * dEMax + tauMinus[k] * dEMin;
      }
    } else {
      // Higher energy behind: weight toward backward direction
      for (let k = 0; k < n3; k++) {
        tangent[k] = tauPlus[k] * dEMin + tauMinus[k] * dEMax;
      }
    }
  }

  // Normalize the tangent
  let norm = 0;
  for (let k = 0; k < n3; k++) norm += tangent[k] * tangent[k];
  norm = Math.sqrt(norm);

  if (norm > 1e-10) {
    for (let k = 0; k < n3; k++) tangent[k] /= norm;
  }

  return tangent;
}

/**
 * Compute the NEB force for a regular (non-climbing) image.
 *
 * The NEB force consists of:
 * 1. True force perpendicular to the path (removes parallel component)
 * 2. Spring force parallel to the path (keeps images evenly spaced)
 *
 * Reference: Henkelman et al., J. Chem. Phys. 113, 9901 (2000), Eq. 4-5
 *
 * @param trueForce   true gradient force on the image (eV/Å)
 * @param tangent     normalized path tangent at this image
 * @param prevPos     positions of image i-1
 * @param currPos     positions of image i
 * @param nextPos     positions of image i+1
 * @param springK     spring constant in eV/Å²
 * @returns NEB-projected force (flat Float64Array)
 */
export function computeNEBForce(
  trueForce: Float64Array,
  tangent: Float64Array,
  prevPos: Float64Array,
  currPos: Float64Array,
  nextPos: Float64Array,
  springK: number,
): Float64Array {
  const n3 = trueForce.length;

  // 1. Remove parallel component of true force: F_perp = F - (F·τ)τ
  let fDotTau = 0;
  for (let k = 0; k < n3; k++) fDotTau += trueForce[k] * tangent[k];

  // 2. Spring force parallel to tangent: F_spring = k(|R_{i+1} - R_i| - |R_i - R_{i-1}|) * τ
  let distNext = 0;
  let distPrev = 0;
  for (let k = 0; k < n3; k++) {
    const dNext = nextPos[k] - currPos[k];
    const dPrev = currPos[k] - prevPos[k];
    distNext += dNext * dNext;
    distPrev += dPrev * dPrev;
  }
  distNext = Math.sqrt(distNext);
  distPrev = Math.sqrt(distPrev);
  const springForceParallel = springK * (distNext - distPrev);

  // Combine: F_NEB = F_perp + F_spring_parallel
  const nebForce = new Float64Array(n3);
  for (let k = 0; k < n3; k++) {
    nebForce[k] =
      trueForce[k] - fDotTau * tangent[k] + springForceParallel * tangent[k];
  }

  return nebForce;
}

/**
 * Compute the climbing-image force for the highest-energy image.
 *
 * The climbing image moves uphill along the path while minimizing
 * perpendicular to the path, converging to the exact saddle point.
 * No spring forces are applied to the climbing image.
 *
 * Reference: Henkelman et al., J. Chem. Phys. 113, 9901 (2000), Eq. 6
 *
 * @param trueForce  true gradient force on the image (eV/Å)
 * @param tangent    normalized path tangent at this image
 * @returns climbing-image force (flat Float64Array)
 */
export function computeClimbingImageForce(
  trueForce: Float64Array,
  tangent: Float64Array,
): Float64Array {
  const n3 = trueForce.length;

  // F_CI = F - 2(F·τ)τ
  // This inverts the parallel component: the image climbs UP the energy surface
  // along the path while still being minimized perpendicular to it.
  let fDotTau = 0;
  for (let k = 0; k < n3; k++) fDotTau += trueForce[k] * tangent[k];

  const ciForce = new Float64Array(n3);
  for (let k = 0; k < n3; k++) {
    ciForce[k] = trueForce[k] - 2 * fDotTau * tangent[k];
  }

  return ciForce;
}

/**
 * Find the index of the highest-energy intermediate image.
 * Excludes endpoints (image 0 and last image).
 */
function findHighestEnergyImage(energies: number[]): number {
  let maxE = -Infinity;
  let maxIdx = 1;
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > maxE) {
      maxE = energies[i];
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Run the Nudged Elastic Band optimization.
 *
 * Finds the minimum energy path between reactant and product geometries
 * by optimizing a chain of intermediate images with projected forces.
 *
 * @param reactantPositions  reactant atom positions (flat Float64Array, 3N)
 * @param productPositions   product atom positions (flat Float64Array, 3N)
 * @param nAtoms             number of atoms
 * @param fixed              fixed atom flags (0 = free, 1 = fixed)
 * @param computeForces      force computation callback: fills forces, returns PE
 * @param config             NEB configuration
 * @param onProgress         optional progress callback (return false to cancel)
 * @returns NEB result with converged path and energies
 */
export function runNEB(
  reactantPositions: Float64Array,
  productPositions: Float64Array,
  nAtoms: number,
  fixed: Uint8Array,
  computeForces: (positions: Float64Array, forces: Float64Array) => number,
  config: NEBConfig,
  onProgress?: (
    iteration: number,
    energyProfile: number[],
    maxForce: number,
  ) => boolean,
): NEBResult {
  const n3 = nAtoms * 3;
  const totalImages = config.nImages + 2;

  // Initialize chain by linear interpolation
  const imagePositions = linearInterpolate(
    reactantPositions,
    productPositions,
    config.nImages,
  );

  // Compute initial energies and forces for all images
  const energies = new Float64Array(totalImages);
  const trueForces: Float64Array[] = [];

  for (let img = 0; img < totalImages; img++) {
    const frc = new Float64Array(n3);
    energies[img] = computeForces(imagePositions[img], frc);
    trueForces.push(frc);
  }

  // Adaptive step sizes per image (following minimizer.ts pattern)
  const stepSizes = new Float64Array(totalImages).fill(config.stepSize);
  const prevEnergies = new Float64Array(totalImages).fill(Infinity);

  let converged = false;
  let finalMaxForce = Infinity;
  let iterations = 0;

  for (let iter = 0; iter < config.maxIterations; iter++) {
    iterations = iter + 1;

    // Determine if climbing image is active this iteration
    const useCi = config.climbingImage && iter >= config.ciActivationIter;
    const ciIdx = useCi ? findHighestEnergyImage(Array.from(energies)) : -1;

    // Compute NEB forces for each intermediate image
    let maxPerpForce = 0;

    for (let img = 1; img < totalImages - 1; img++) {
      const tangent = computeTangent(
        imagePositions[img - 1],
        imagePositions[img],
        imagePositions[img + 1],
        energies[img - 1],
        energies[img],
        energies[img + 1],
      );

      let nebForce: Float64Array;
      if (img === ciIdx) {
        // Climbing image: invert parallel force, no springs
        nebForce = computeClimbingImageForce(trueForces[img], tangent);
      } else {
        // Regular image: perpendicular true force + parallel spring force
        nebForce = computeNEBForce(
          trueForces[img],
          tangent,
          imagePositions[img - 1],
          imagePositions[img],
          imagePositions[img + 1],
          config.springK,
        );
      }

      // Compute max force for convergence check (skip fixed atoms)
      for (let a = 0; a < nAtoms; a++) {
        if (fixed[a]) continue;
        const a3 = a * 3;
        const fx = Math.abs(nebForce[a3]);
        const fy = Math.abs(nebForce[a3 + 1]);
        const fz = Math.abs(nebForce[a3 + 2]);
        maxPerpForce = Math.max(maxPerpForce, fx, fy, fz);
      }

      // Adaptive step size (per image, following minimizer.ts pattern)
      if (energies[img] < prevEnergies[img]) {
        stepSizes[img] = Math.min(stepSizes[img] * 1.2, 0.1);
      } else {
        stepSizes[img] *= 0.5;
      }
      prevEnergies[img] = energies[img];

      // Move image along NEB force direction (steepest descent)
      const step = stepSizes[img];
      for (let a = 0; a < nAtoms; a++) {
        if (fixed[a]) continue;
        const a3 = a * 3;
        const fx = nebForce[a3];
        const fy = nebForce[a3 + 1];
        const fz = nebForce[a3 + 2];
        const fMag = Math.sqrt(fx * fx + fy * fy + fz * fz);
        if (fMag < 1e-10) continue;
        const scale = step / fMag;
        imagePositions[img][a3] += fx * scale;
        imagePositions[img][a3 + 1] += fy * scale;
        imagePositions[img][a3 + 2] += fz * scale;
      }
    }

    finalMaxForce = maxPerpForce;

    // Recompute energies and true forces for all intermediate images
    for (let img = 1; img < totalImages - 1; img++) {
      trueForces[img].fill(0);
      energies[img] = computeForces(imagePositions[img], trueForces[img]);
    }

    // Progress callback (every 10 iterations)
    if (onProgress && iter % 10 === 0) {
      const shouldContinue = onProgress(
        iter,
        Array.from(energies),
        maxPerpForce,
      );
      if (!shouldContinue) break;
    }

    // Check convergence
    if (maxPerpForce < config.forceTolerance) {
      converged = true;
      break;
    }
  }

  // Build result
  const tsIdx = findHighestEnergyImage(Array.from(energies));
  const energyProfile = Array.from(energies);

  const images: NEBImage[] = imagePositions.map((pos, i) => ({
    positions: pos.slice(),
    energy: energies[i],
  }));

  return {
    images,
    converged,
    iterations,
    energyProfile,
    maxForce: finalMaxForce,
    tsImageIndex: tsIdx,
    tsEnergy: energies[tsIdx],
    barrier: energies[tsIdx] - energies[0],
  };
}
