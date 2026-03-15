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
 * Compute instantaneous temperature from kinetic energy.
 * T = 2 * KE / (3 * N * k_B)   (k_B in eV/K)
 */
export function computeTemperature(
  kineticEnergy: number,
  nAtoms: number,
): number {
  const kB = 8.617333262e-5; // eV/K
  if (nAtoms <= 0) return 0;
  return (2.0 * kineticEnergy) / (3.0 * nAtoms * kB);
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
