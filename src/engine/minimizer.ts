// ==============================================================
// Energy minimizer: steepest descent with adaptive step size
// ==============================================================

/**
 * Steepest descent energy minimization.
 *
 * @param positions     flat position array (modified in place)
 * @param forces        flat force array (scratch space)
 * @param fixed         fixed atom flags
 * @param nAtoms        number of atoms
 * @param computeForces function that fills forces and returns potential energy
 * @param maxSteps      max minimization steps
 * @param forceTol      convergence tolerance for max force component (eV/Å)
 * @param initialStep   initial step size (Å)
 * @returns final potential energy (eV)
 */
export function steepestDescent(
  positions: Float64Array,
  forces: Float64Array,
  fixed: Uint8Array,
  nAtoms: number,
  computeForces: (positions: Float64Array, forces: Float64Array) => number,
  maxSteps: number = 500,
  forceTol: number = 0.01,
  initialStep: number = 0.01,
): number {
  let step = initialStep;
  let prevEnergy = Infinity;

  for (let iter = 0; iter < maxSteps; iter++) {
    forces.fill(0);
    const energy = computeForces(positions, forces);

    // Find max force component
    let maxForce = 0;
    for (let i = 0; i < nAtoms; i++) {
      if (fixed[i]) continue;
      const i3 = i * 3;
      const fx = Math.abs(forces[i3]);
      const fy = Math.abs(forces[i3 + 1]);
      const fz = Math.abs(forces[i3 + 2]);
      maxForce = Math.max(maxForce, fx, fy, fz);
    }

    // Check convergence
    if (maxForce < forceTol) {
      return energy;
    }

    // Adaptive step size
    if (energy < prevEnergy) {
      step = Math.min(step * 1.2, 0.1); // grow step
    } else {
      step *= 0.5; // shrink step
    }
    prevEnergy = energy;

    // Move atoms along force direction (steepest descent)
    // Normalize force to use as direction, scale by step size
    for (let i = 0; i < nAtoms; i++) {
      if (fixed[i]) continue;
      const i3 = i * 3;
      const fx = forces[i3];
      const fy = forces[i3 + 1];
      const fz = forces[i3 + 2];
      const fMag = Math.sqrt(fx * fx + fy * fy + fz * fz);
      if (fMag < 1e-10) continue;

      // Step in direction of force (force points downhill in energy)
      const scale = step / fMag;
      positions[i3] += fx * scale;
      positions[i3 + 1] += fy * scale;
      positions[i3 + 2] += fz * scale;
    }
  }

  forces.fill(0);
  return computeForces(positions, forces);
}
