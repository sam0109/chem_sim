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
