// ==============================================================
// Velocity Verlet integrator for molecular dynamics
// ==============================================================

/**
 * Flat-array based velocity Verlet integrator.
 *
 * All arrays are flat Float64Arrays of length 3*N:
 *   [x0, y0, z0, x1, y1, z1, ...]
 *
 * @param positions  atom positions in Å
 * @param velocities atom velocities in Å/fs
 * @param forces     forces from current step (eV/Å)
 * @param masses     atom masses in amu (length N)
 * @param atomicNumbers atomic numbers (length N) - for mass lookup
 * @param fixed      boolean flags (length N) - fixed atoms skip integration
 * @param dt         timestep in fs
 * @param computeForces callback that computes forces and returns potential energy (eV)
 * @returns { kineticEnergy, potentialEnergy } in eV
 */
export function velocityVerletStep(
  positions: Float64Array,
  velocities: Float64Array,
  forces: Float64Array,
  masses: Float64Array,
  fixed: Uint8Array,
  dt: number,
  computeForces: (positions: Float64Array, forces: Float64Array) => number,
): { kineticEnergy: number; potentialEnergy: number } {
  const N = masses.length;
  // amu·Å²/fs² → eV conversion:  1 eV = 1.0364e-4 amu·Å²/fs²
  // So F (eV/Å) * dt (fs) / m (amu) gives velocity in (eV·fs)/(Å·amu)
  // Need: v in Å/fs, so multiply by 1/CONV where CONV = eV/(amu·Å/fs²) = 103.6427
  const CONV = 103.6427; // 1 eV = 103.6427 amu·Å²/fs²

  // Half-step velocity update: v(t + dt/2) = v(t) + F(t)/(2m) * dt
  for (let i = 0; i < N; i++) {
    if (fixed[i]) continue;
    const invM = dt / (2.0 * masses[i] * CONV);
    const i3 = i * 3;
    velocities[i3] += forces[i3] * invM;
    velocities[i3 + 1] += forces[i3 + 1] * invM;
    velocities[i3 + 2] += forces[i3 + 2] * invM;
  }

  // Position update: r(t + dt) = r(t) + v(t + dt/2) * dt
  for (let i = 0; i < N; i++) {
    if (fixed[i]) continue;
    const i3 = i * 3;
    positions[i3] += velocities[i3] * dt;
    positions[i3 + 1] += velocities[i3 + 1] * dt;
    positions[i3 + 2] += velocities[i3 + 2] * dt;
  }

  // Compute new forces
  forces.fill(0);
  const potentialEnergy = computeForces(positions, forces);

  // Second half-step velocity update: v(t + dt) = v(t + dt/2) + F(t+dt)/(2m) * dt
  for (let i = 0; i < N; i++) {
    if (fixed[i]) continue;
    const invM = dt / (2.0 * masses[i] * CONV);
    const i3 = i * 3;
    velocities[i3] += forces[i3] * invM;
    velocities[i3 + 1] += forces[i3 + 1] * invM;
    velocities[i3 + 2] += forces[i3 + 2] * invM;
  }

  // Compute kinetic energy: KE = sum(0.5 * m * v²) in eV
  let kineticEnergy = 0;
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const vx = velocities[i3];
    const vy = velocities[i3 + 1];
    const vz = velocities[i3 + 2];
    kineticEnergy += 0.5 * masses[i] * (vx * vx + vy * vy + vz * vz) * CONV;
  }

  return { kineticEnergy, potentialEnergy };
}

/**
 * Compute translational degrees of freedom for a system of N atoms.
 *
 * Nf = 3N − 3 for N > 1 (subtract 3 conserved COM momentum components).
 * For N ≤ 1, returns 3 to avoid zero or negative DOF.
 *
 * Source: Allen & Tildesley, "Computer Simulation of Liquids",
 *   2nd ed., Section 2.6 — subtract 3 for conserved COM momentum.
 *
 * @param nAtoms number of atoms
 * @returns number of translational degrees of freedom
 */
export function computeDOF(nAtoms: number): number {
  return nAtoms > 1 ? 3 * nAtoms - 3 : 3;
}

/**
 * Compute instantaneous temperature from kinetic energy.
 *
 * T = 2 * KE / (Nf * k_B)   where Nf = computeDOF(nAtoms).
 *
 * The DOF correction accounts for the removal of center-of-mass
 * translational momentum (3 conserved components → 3 fewer DOF).
 * This is consistent with the Nosé-Hoover thermostat DOF (see thermostat.ts).
 *
 * @param kineticEnergy kinetic energy in eV
 * @param nAtoms number of atoms
 * @returns temperature in K
 */
export function computeTemperature(
  kineticEnergy: number,
  nAtoms: number,
): number {
  const kB = 8.617333262e-5; // eV/K — CODATA 2018
  if (nAtoms <= 0) return 0;
  const Nf = computeDOF(nAtoms);
  return (2.0 * kineticEnergy) / (Nf * kB);
}

/**
 * Remove rigid-body angular momentum from each molecule.
 *
 * For each molecule group, computes the angular momentum L = Σ mᵢ (rᵢ - R) × vᵢ,
 * the inertia tensor I, solves ω = I⁻¹ L, and subtracts ω × (rᵢ - R) from each
 * atom's velocity. This prevents unphysical buildup of rotational kinetic energy.
 *
 * Single-atom molecules are skipped (no rotational DOF). For molecules with
 * a near-singular inertia tensor (e.g., linear molecules), only the component
 * of angular momentum about axes with nonzero moment of inertia is removed,
 * using a pseudoinverse with a tolerance threshold.
 *
 * Source: Allen & Tildesley, "Computer Simulation of Liquids",
 *   2nd ed., Section 2.6 — removal of center-of-mass angular momentum.
 *
 * @param positions  flat Float64Array [x0,y0,z0,x1,y1,z1,...] in Å
 * @param velocities flat Float64Array [vx0,vy0,vz0,...] in Å/fs
 * @param masses     atom masses in amu (length N)
 * @param fixed      boolean flags (length N) — fixed atoms are excluded
 * @param moleculeGroups array of atom-index arrays, one per molecule
 */
export function removeAngularMomentum(
  positions: Float64Array,
  velocities: Float64Array,
  masses: Float64Array,
  fixed: Uint8Array,
  moleculeGroups: number[][],
): void {
  for (const group of moleculeGroups) {
    // Filter out fixed atoms and skip single-atom molecules
    const mobile = group.filter((i) => !fixed[i]);
    if (mobile.length < 2) continue;

    // --- Compute center of mass ---
    let totalMass = 0;
    let comX = 0,
      comY = 0,
      comZ = 0;
    for (const i of mobile) {
      const m = masses[i];
      const i3 = i * 3;
      totalMass += m;
      comX += m * positions[i3];
      comY += m * positions[i3 + 1];
      comZ += m * positions[i3 + 2];
    }
    if (totalMass <= 0) continue;
    comX /= totalMass;
    comY /= totalMass;
    comZ /= totalMass;

    // --- Compute COM velocity ---
    let vcomX = 0,
      vcomY = 0,
      vcomZ = 0;
    for (const i of mobile) {
      const m = masses[i];
      const i3 = i * 3;
      vcomX += m * velocities[i3];
      vcomY += m * velocities[i3 + 1];
      vcomZ += m * velocities[i3 + 2];
    }
    vcomX /= totalMass;
    vcomY /= totalMass;
    vcomZ /= totalMass;

    // --- Compute angular momentum L = Σ mᵢ (rᵢ - R) × (vᵢ - V_com) ---
    let Lx = 0,
      Ly = 0,
      Lz = 0;
    for (const i of mobile) {
      const m = masses[i];
      const i3 = i * 3;
      const rx = positions[i3] - comX;
      const ry = positions[i3 + 1] - comY;
      const rz = positions[i3 + 2] - comZ;
      const vx = velocities[i3] - vcomX;
      const vy = velocities[i3 + 1] - vcomY;
      const vz = velocities[i3 + 2] - vcomZ;
      // L = r × (m * v)
      Lx += m * (ry * vz - rz * vy);
      Ly += m * (rz * vx - rx * vz);
      Lz += m * (rx * vy - ry * vx);
    }

    // --- Compute inertia tensor I ---
    // I_xx = Σ mᵢ (ry² + rz²), I_xy = -Σ mᵢ rx ry, etc.
    let Ixx = 0,
      Iyy = 0,
      Izz = 0;
    let Ixy = 0,
      Ixz = 0,
      Iyz = 0;
    for (const i of mobile) {
      const m = masses[i];
      const i3 = i * 3;
      const rx = positions[i3] - comX;
      const ry = positions[i3 + 1] - comY;
      const rz = positions[i3 + 2] - comZ;
      Ixx += m * (ry * ry + rz * rz);
      Iyy += m * (rx * rx + rz * rz);
      Izz += m * (rx * rx + ry * ry);
      Ixy -= m * rx * ry;
      Ixz -= m * rx * rz;
      Iyz -= m * ry * rz;
    }

    // --- Solve ω = I⁻¹ L via explicit 3×3 inverse with pseudoinverse for singularities ---
    // Determinant of I
    const det =
      Ixx * (Iyy * Izz - Iyz * Iyz) -
      Ixy * (Ixy * Izz - Iyz * Ixz) +
      Ixz * (Ixy * Iyz - Iyy * Ixz);

    // Tolerance for near-singular inertia tensor (linear molecules, etc.)
    // Scaled relative to the largest diagonal element to handle various mass scales.
    const maxDiag = Math.max(Ixx, Iyy, Izz);
    const TOL = 1e-10 * maxDiag * maxDiag * maxDiag;

    let omegaX: number, omegaY: number, omegaZ: number;

    if (Math.abs(det) > TOL) {
      // Full 3×3 inverse: I⁻¹ = adj(I) / det
      const invDet = 1.0 / det;
      // Cofactor matrix (symmetric)
      const c00 = (Iyy * Izz - Iyz * Iyz) * invDet;
      const c01 = (Ixz * Iyz - Ixy * Izz) * invDet;
      const c02 = (Ixy * Iyz - Ixz * Iyy) * invDet;
      const c11 = (Ixx * Izz - Ixz * Ixz) * invDet;
      const c12 = (Ixy * Ixz - Ixx * Iyz) * invDet;
      const c22 = (Ixx * Iyy - Ixy * Ixy) * invDet;

      omegaX = c00 * Lx + c01 * Ly + c02 * Lz;
      omegaY = c01 * Lx + c11 * Ly + c12 * Lz;
      omegaZ = c02 * Lx + c12 * Ly + c22 * Lz;
    } else {
      // Near-singular tensor (linear molecule or degenerate).
      // Fall back to removing angular momentum only about axes with
      // significant moment of inertia. For a diatomic/linear molecule,
      // this correctly removes rotation perpendicular to the bond axis
      // while leaving the (zero-moment) axial component untouched.
      omegaX = maxDiag > 0 && Ixx > TOL / (maxDiag * maxDiag) ? Lx / Ixx : 0;
      omegaY = maxDiag > 0 && Iyy > TOL / (maxDiag * maxDiag) ? Ly / Iyy : 0;
      omegaZ = maxDiag > 0 && Izz > TOL / (maxDiag * maxDiag) ? Lz / Izz : 0;
    }

    // --- Subtract ω × (rᵢ - R) from each atom velocity ---
    for (const i of mobile) {
      const i3 = i * 3;
      const rx = positions[i3] - comX;
      const ry = positions[i3 + 1] - comY;
      const rz = positions[i3 + 2] - comZ;
      // ω × r = (ωy*rz - ωz*ry, ωz*rx - ωx*rz, ωx*ry - ωy*rx)
      velocities[i3] -= omegaY * rz - omegaZ * ry;
      velocities[i3 + 1] -= omegaZ * rx - omegaX * rz;
      velocities[i3 + 2] -= omegaX * ry - omegaY * rx;
    }
  }
}

/**
 * Initialize velocities from Maxwell-Boltzmann distribution at target temperature.
 */
export function initializeVelocities(
  velocities: Float64Array,
  masses: Float64Array,
  fixed: Uint8Array,
  temperature: number,
): void {
  const kB = 8.617333262e-5; // eV/K
  const CONV = 103.6427;
  const N = masses.length;

  // Box-Muller transform for normal distribution
  function randn(): number {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  for (let i = 0; i < N; i++) {
    if (fixed[i]) {
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
      continue;
    }
    // sigma_v = sqrt(kB * T / m) in Å/fs
    const sigma = Math.sqrt((kB * temperature) / (masses[i] * CONV));
    velocities[i * 3] = sigma * randn();
    velocities[i * 3 + 1] = sigma * randn();
    velocities[i * 3 + 2] = sigma * randn();
  }

  // Remove center-of-mass velocity
  let totalMass = 0;
  let vcomX = 0,
    vcomY = 0,
    vcomZ = 0;
  for (let i = 0; i < N; i++) {
    if (fixed[i]) continue;
    const m = masses[i];
    totalMass += m;
    vcomX += m * velocities[i * 3];
    vcomY += m * velocities[i * 3 + 1];
    vcomZ += m * velocities[i * 3 + 2];
  }
  if (totalMass > 0) {
    vcomX /= totalMass;
    vcomY /= totalMass;
    vcomZ /= totalMass;
    for (let i = 0; i < N; i++) {
      if (fixed[i]) continue;
      velocities[i * 3] -= vcomX;
      velocities[i * 3 + 1] -= vcomY;
      velocities[i * 3 + 2] -= vcomZ;
    }
  }
}
