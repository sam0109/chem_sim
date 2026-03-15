// ==============================================================
// Temperature control: Berendsen and Nosé-Hoover thermostats
// ==============================================================

import { computeTemperature } from './integrator';

/**
 * Berendsen thermostat: rescale velocities toward target temperature.
 * v_new = v * sqrt(1 + dt/tau * (T_target/T_current - 1))
 *
 * @param velocities flat velocity array (modified in-place)
 * @param masses     atom masses
 * @param fixed      fixed flags
 * @param kineticEnergy current kinetic energy (eV)
 * @param targetTemp target temperature (K)
 * @param dt         timestep (fs)
 * @param tau        coupling constant (fs)
 */
export function berendsenThermostat(
  velocities: Float64Array,
  masses: Float64Array,
  fixed: Uint8Array,
  kineticEnergy: number,
  targetTemp: number,
  dt: number,
  tau: number,
): void {
  const N = masses.length;
  const currentTemp = computeTemperature(kineticEnergy, N);

  if (currentTemp < 1e-10) {
    // System is frozen — can't rescale. Initialize velocities instead.
    return;
  }

  const lambda = Math.sqrt(1.0 + (dt / tau) * (targetTemp / currentTemp - 1.0));

  // Clamp to prevent extreme rescaling
  const clampedLambda = Math.max(0.9, Math.min(1.1, lambda));

  for (let i = 0; i < N; i++) {
    if (fixed[i]) continue;
    velocities[i * 3] *= clampedLambda;
    velocities[i * 3 + 1] *= clampedLambda;
    velocities[i * 3 + 2] *= clampedLambda;
  }
}

// ==============================================================
// Nosé-Hoover chain thermostat
//
// Generates the correct canonical (NVT) ensemble by coupling the
// system to a chain of M thermostats with extended Lagrangian
// degrees of freedom. Single Nosé-Hoover can be non-ergodic for
// stiff harmonic systems; chains fix this.
//
// Reference: Martyna, Klein, Tuckerman, J. Chem. Phys. 97, 2635 (1992)
// Integration: Suzuki-Yoshida decomposition of the Liouville operator
// ==============================================================

/** Number of chain links. 3 is standard for most MD applications.
 *  Source: Martyna et al., J. Chem. Phys. 97, 2635 (1992), Section III */
const NH_CHAIN_LENGTH = 3;

/** Number of Suzuki-Yoshida integration sub-steps for time-reversibility.
 *  nsy=1 is simple Trotter; sufficient for small timesteps.
 *  Source: Tuckerman, Berne, Martyna, J. Chem. Phys. 97, 1990 (1992) */
const NH_SUZUKI_YOSHIDA_ORDER = 1;
const NH_WEIGHTS = [1.0]; // Weights for nsy=1 (simple Trotter factorization)

/** State for a Nosé-Hoover chain thermostat */
export interface NoseHooverChainState {
  /** Chain thermostat positions ξ (dimensionless) — length M */
  xi: Float64Array;
  /** Chain thermostat velocities vξ (1/fs) — length M */
  vxi: Float64Array;
  /** Chain coupling masses Q (eV·fs²) — length M */
  Q: Float64Array;
}

/**
 * Create and initialize a Nosé-Hoover chain state.
 *
 * Coupling masses:
 *   Q₁ = Nf · kB · T · τ²   (couples to particles)
 *   Qⱼ = kB · T · τ²         (j > 1, couples to previous thermostat)
 * where Nf = 3 * nAtoms (translational degrees of freedom).
 *
 * Source: Martyna et al., J. Chem. Phys. 97, 2635 (1992), Eq. 2.13
 *
 * @param nAtoms number of atoms
 * @param targetTemp target temperature (K)
 * @param tau coupling time constant (fs)
 */
export function createNoseHooverChainState(
  nAtoms: number,
  targetTemp: number,
  tau: number,
): NoseHooverChainState {
  const kB = 8.617333262e-5; // eV/K — CODATA 2018
  const Nf = 3 * nAtoms; // degrees of freedom (translational)
  const kBT = kB * targetTemp;

  const xi = new Float64Array(NH_CHAIN_LENGTH);
  const vxi = new Float64Array(NH_CHAIN_LENGTH);
  const Q = new Float64Array(NH_CHAIN_LENGTH);

  // Q₁ couples to the physical system, so its mass scales with Nf
  Q[0] = Nf * kBT * tau * tau;
  // Remaining chain links couple to one thermostat DOF each
  for (let m = 1; m < NH_CHAIN_LENGTH; m++) {
    Q[m] = kBT * tau * tau;
  }

  return { xi, vxi, Q };
}

/**
 * Nosé-Hoover chain thermostat step: rescale velocities to sample
 * the canonical ensemble.
 *
 * This function applies the NH chain operator at a half-step level.
 * It should be called TWICE per velocity Verlet step (before and after
 * the force evaluation) to maintain time-reversibility. However, for
 * simplicity and following common MD practice, we apply the full
 * operator once per step (after the Verlet step), which is accurate
 * to O(dt²).
 *
 * Algorithm (from outermost to innermost chain link):
 *   1. Compute "force" on each chain thermostat
 *   2. Update chain velocities with Suzuki-Yoshida sub-steps
 *   3. Scale particle velocities by exp(-vξ₁ · δt)
 *   4. Update chain positions
 *
 * Source: Martyna et al., J. Chem. Phys. 97, 2635 (1992), Eqs. 2.10–2.14
 *
 * @param velocities flat velocity array (modified in-place)
 * @param masses atom masses (amu)
 * @param fixed fixed flags
 * @param kineticEnergy current kinetic energy (eV)
 * @param targetTemp target temperature (K)
 * @param dt timestep (fs)
 * @param chainState NH chain state (modified in-place)
 */
export function noseHooverChainStep(
  velocities: Float64Array,
  masses: Float64Array,
  fixed: Uint8Array,
  kineticEnergy: number,
  targetTemp: number,
  dt: number,
  chainState: NoseHooverChainState,
): void {
  const N = masses.length;
  const kB = 8.617333262e-5; // eV/K — CODATA 2018
  const Nf = 3 * N; // degrees of freedom
  const kBT = kB * targetTemp;
  if (targetTemp < 1e-10 || N <= 0) return;

  const M = NH_CHAIN_LENGTH;
  const { vxi, xi, Q } = chainState;

  // Current twice-kinetic-energy (2*KE)
  let KE2 = 2.0 * kineticEnergy;

  // Apply Suzuki-Yoshida sub-steps
  for (let isy = 0; isy < NH_SUZUKI_YOSHIDA_ORDER; isy++) {
    const wdt = NH_WEIGHTS[isy] * dt;
    const wdt2 = wdt * 0.5;
    const wdt4 = wdt * 0.25;
    const wdt8 = wdt * 0.125;

    // --- Forward chain propagation (last thermostat first) ---

    // Force on last chain thermostat: G_M = (Q_{M-1} * vξ_{M-1}² - kBT) / Q_M
    // Update vξ_M with quarter-step
    if (M > 1) {
      const Glast = (Q[M - 2] * vxi[M - 2] * vxi[M - 2] - kBT) / Q[M - 1];
      vxi[M - 1] += Glast * wdt4;
    }

    // Propagate chain from M-2 down to 1
    for (let m = M - 2; m > 0; m--) {
      // Drag coefficient from thermostat m+1
      const expFactor = Math.exp(-vxi[m + 1] * wdt8);
      // Force on thermostat m: G_m = (Q_{m-1} * vξ_{m-1}² - kBT) / Q_m
      const Gm = (Q[m - 1] * vxi[m - 1] * vxi[m - 1] - kBT) / Q[m];
      vxi[m] = vxi[m] * expFactor + Gm * wdt4;
      vxi[m] *= expFactor;
    }

    // Force on first thermostat: G₁ = (2*KE - Nf*kBT) / Q₁
    {
      const expFactor = M > 1 ? Math.exp(-vxi[1] * wdt8) : 1.0;
      const G1 = (KE2 - Nf * kBT) / Q[0];
      vxi[0] = vxi[0] * expFactor + G1 * wdt4;
      vxi[0] *= expFactor;
    }

    // --- Scale particle velocities ---
    // No clamping: preserving the exact exp(-vξ₁·dt/2) factor is essential
    // for time-reversibility and correct canonical sampling.
    const scaleFactor = Math.exp(-vxi[0] * wdt2);
    for (let i = 0; i < N; i++) {
      if (fixed[i]) continue;
      velocities[i * 3] *= scaleFactor;
      velocities[i * 3 + 1] *= scaleFactor;
      velocities[i * 3 + 2] *= scaleFactor;
    }
    // Update KE after scaling
    KE2 *= scaleFactor * scaleFactor;

    // --- Update chain positions ---
    for (let m = 0; m < M; m++) {
      xi[m] += vxi[m] * wdt2;
    }

    // --- Backward chain propagation (first thermostat first) ---

    // Force on first thermostat with updated KE
    {
      const expFactor = M > 1 ? Math.exp(-vxi[1] * wdt8) : 1.0;
      const G1 = (KE2 - Nf * kBT) / Q[0];
      vxi[0] = vxi[0] * expFactor + G1 * wdt4;
      vxi[0] *= expFactor;
    }

    // Propagate chain from 1 up to M-2
    for (let m = 1; m < M - 1; m++) {
      const expFactor = Math.exp(-vxi[m + 1] * wdt8);
      const Gm = (Q[m - 1] * vxi[m - 1] * vxi[m - 1] - kBT) / Q[m];
      vxi[m] = vxi[m] * expFactor + Gm * wdt4;
      vxi[m] *= expFactor;
    }

    // Update last chain thermostat velocity
    if (M > 1) {
      const Glast = (Q[M - 2] * vxi[M - 2] * vxi[M - 2] - kBT) / Q[M - 1];
      vxi[M - 1] += Glast * wdt4;
    }
  }
}

/**
 * Simple velocity rescaling to exact target temperature.
 * Useful for initialization.
 */
export function rescaleVelocities(
  velocities: Float64Array,
  masses: Float64Array,
  fixed: Uint8Array,
  kineticEnergy: number,
  targetTemp: number,
): void {
  const N = masses.length;
  const currentTemp = computeTemperature(kineticEnergy, N);

  if (currentTemp < 1e-10) return;

  const lambda = Math.sqrt(targetTemp / currentTemp);

  for (let i = 0; i < N; i++) {
    if (fixed[i]) continue;
    velocities[i * 3] *= lambda;
    velocities[i * 3 + 1] *= lambda;
    velocities[i * 3 + 2] *= lambda;
  }
}
