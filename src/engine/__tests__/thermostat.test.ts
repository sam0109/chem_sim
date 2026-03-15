import { describe, it, expect } from 'vitest';
import { berendsenThermostat, rescaleVelocities } from '../thermostat.ts';
import { computeTemperature } from '../integrator.ts';

/**
 * Helper: compute kinetic energy from velocities and masses.
 */
function computeKE(velocities: Float64Array, masses: Float64Array): number {
  const CONV = 103.6427;
  let KE = 0;
  const N = masses.length;
  for (let i = 0; i < N; i++) {
    const vx = velocities[i * 3];
    const vy = velocities[i * 3 + 1];
    const vz = velocities[i * 3 + 2];
    KE += 0.5 * masses[i] * (vx * vx + vy * vy + vz * vz) * CONV;
  }
  return KE;
}

describe('berendsenThermostat', () => {
  it('rescales velocities toward target temperature', () => {
    const velocities = new Float64Array([
      0.01, 0.02, -0.01, -0.015, 0.01, 0.005,
    ]);
    const masses = new Float64Array([16.0, 1.008]);
    const fixed = new Uint8Array([0, 0]);

    const KE = computeKE(velocities, masses);
    const T = computeTemperature(KE, 2);
    const targetT = T * 2; // double the temperature

    berendsenThermostat(velocities, masses, fixed, KE, targetT, 0.5, 100);

    const newKE = computeKE(velocities, masses);
    const newT = computeTemperature(newKE, 2);

    // Temperature should have moved toward the target
    expect(newT).toBeGreaterThan(T);
  });

  it('does not rescale fixed atoms', () => {
    const velocities = new Float64Array([
      0.01, 0.02, -0.01, -0.015, 0.01, 0.005,
    ]);
    const masses = new Float64Array([16.0, 1.008]);
    const fixed = new Uint8Array([1, 0]);

    const KE = computeKE(velocities, masses);
    const origV0 = velocities[0];
    const origV1 = velocities[1];
    const origV2 = velocities[2];

    berendsenThermostat(velocities, masses, fixed, KE, 600, 0.5, 100);

    expect(velocities[0]).toBe(origV0);
    expect(velocities[1]).toBe(origV1);
    expect(velocities[2]).toBe(origV2);
  });

  it('does nothing when kinetic energy is zero (frozen system)', () => {
    const velocities = new Float64Array([0, 0, 0, 0, 0, 0]);
    const masses = new Float64Array([16.0, 1.008]);
    const fixed = new Uint8Array([0, 0]);

    berendsenThermostat(velocities, masses, fixed, 0, 300, 0.5, 100);

    for (let i = 0; i < 6; i++) {
      expect(velocities[i]).toBe(0);
    }
  });

  it('clamps rescaling factor to prevent extreme changes', () => {
    // Set up a system with very different target from current temp
    const velocities = new Float64Array([
      0.001, 0.001, 0.001, 0.001, 0.001, 0.001,
    ]);
    const masses = new Float64Array([16.0, 1.008]);
    const fixed = new Uint8Array([0, 0]);

    const KE = computeKE(velocities, masses);
    const origVel = new Float64Array(velocities);

    // Very high target temperature should be clamped
    berendsenThermostat(velocities, masses, fixed, KE, 100000, 0.5, 0.1);

    // Velocities should be rescaled by at most 1.1 (clamped)
    for (let i = 0; i < 6; i++) {
      if (fixed[Math.floor(i / 3)]) continue;
      const ratio = Math.abs(velocities[i] / origVel[i]);
      expect(ratio).toBeLessThanOrEqual(1.1 + 1e-10);
    }
  });
});

describe('rescaleVelocities', () => {
  it('rescales to exact target temperature', () => {
    const velocities = new Float64Array([
      0.01, 0.02, -0.01, -0.015, 0.01, 0.005,
    ]);
    const masses = new Float64Array([16.0, 1.008]);
    const fixed = new Uint8Array([0, 0]);

    const KE = computeKE(velocities, masses);
    const targetT = 300;

    rescaleVelocities(velocities, masses, fixed, KE, targetT);

    const newKE = computeKE(velocities, masses);
    const newT = computeTemperature(newKE, 2);

    expect(newT).toBeCloseTo(targetT, 2);
  });

  it('does not rescale fixed atoms', () => {
    const velocities = new Float64Array([
      0.01, 0.02, -0.01, -0.015, 0.01, 0.005,
    ]);
    const masses = new Float64Array([16.0, 1.008]);
    const fixed = new Uint8Array([1, 0]);

    const KE = computeKE(velocities, masses);
    const origV0 = velocities[0];

    rescaleVelocities(velocities, masses, fixed, KE, 300);

    expect(velocities[0]).toBe(origV0);
  });

  it('does nothing for frozen system (KE = 0)', () => {
    const velocities = new Float64Array([0, 0, 0, 0, 0, 0]);
    const masses = new Float64Array([16.0, 1.008]);
    const fixed = new Uint8Array([0, 0]);

    rescaleVelocities(velocities, masses, fixed, 0, 300);

    for (let i = 0; i < 6; i++) {
      expect(velocities[i]).toBe(0);
    }
  });

  it('preserves velocity directions', () => {
    const velocities = new Float64Array([0.01, -0.02, 0.03, 0.04, -0.05, 0.06]);
    const masses = new Float64Array([16.0, 1.008]);
    const fixed = new Uint8Array([0, 0]);

    const origDirs = Array.from(velocities).map((v) => Math.sign(v));

    const KE = computeKE(velocities, masses);
    rescaleVelocities(velocities, masses, fixed, KE, 300);

    for (let i = 0; i < 6; i++) {
      expect(Math.sign(velocities[i])).toBe(origDirs[i]);
    }
  });
});
