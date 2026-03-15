import { describe, it, expect } from 'vitest';
import {
  velocityVerletStep,
  computeTemperature,
  computeDOF,
  initializeVelocities,
} from '../integrator.ts';

describe('computeDOF', () => {
  it('returns 3 for nAtoms=0 (guard case)', () => {
    expect(computeDOF(0)).toBe(3);
  });

  it('returns 3 for nAtoms=1 (guard case)', () => {
    expect(computeDOF(1)).toBe(3);
  });

  it('returns 3N-3 for nAtoms > 1', () => {
    expect(computeDOF(2)).toBe(3);
    expect(computeDOF(3)).toBe(6);
    expect(computeDOF(10)).toBe(27);
    expect(computeDOF(100)).toBe(297);
  });
});

describe('computeTemperature', () => {
  it('returns 0 for zero kinetic energy', () => {
    expect(computeTemperature(0, 3)).toBe(0);
  });

  it('returns 0 for zero atoms', () => {
    expect(computeTemperature(1.0, 0)).toBe(0);
  });

  it('computes correct temperature from kinetic energy', () => {
    // T = 2 * KE / (Nf * kB) where Nf = 3N - 3 for N > 1
    const kB = 8.617333262e-5; // eV/K
    const N = 3;
    const Nf = computeDOF(N);
    const targetT = 300; // K
    const KE = (Nf * kB * targetT) / 2.0;
    const T = computeTemperature(KE, N);
    expect(T).toBeCloseTo(targetT, 6);
  });

  it('scales linearly with kinetic energy', () => {
    const T1 = computeTemperature(0.01, 10);
    const T2 = computeTemperature(0.02, 10);
    expect(T2).toBeCloseTo(2 * T1, 6);
  });

  it('uses 3 DOF for single atom (N=1 guard)', () => {
    // For N=1, Nf=3 (not 3*1-3=0) to avoid division by zero
    const kB = 8.617333262e-5; // eV/K
    const targetT = 300;
    const KE = (3 * kB * targetT) / 2.0;
    const T = computeTemperature(KE, 1);
    expect(T).toBeCloseTo(targetT, 6);
  });

  it('scales inversely with degrees of freedom', () => {
    // Nf(10) = 27, Nf(20) = 57; ratio = 57/27
    const T1 = computeTemperature(0.01, 10);
    const T2 = computeTemperature(0.01, 20);
    const expectedRatio = (3 * 20 - 3) / (3 * 10 - 3); // 57/27
    expect(T1 / T2).toBeCloseTo(expectedRatio, 6);
  });
});

describe('velocityVerletStep', () => {
  it('conserves energy for a harmonic oscillator', () => {
    // Simple 1D harmonic oscillator: V = 0.5 * k * x^2, F = -k * x
    // Using k = 1 eV/Å² and mass = 1 amu
    const k = 1.0;
    const positions = new Float64Array([1.0, 0, 0]); // displaced by 1 Å
    const velocities = new Float64Array([0, 0, 0]);
    const forces = new Float64Array(3);
    const masses = new Float64Array([1.0]);
    const fixed = new Uint8Array([0]);
    const dt = 0.1; // fs

    const computeForces = (pos: Float64Array, frc: Float64Array): number => {
      frc[0] = -k * pos[0];
      frc[1] = 0;
      frc[2] = 0;
      return 0.5 * k * pos[0] * pos[0];
    };

    // Initialize forces
    computeForces(positions, forces);

    // Run for 100 steps and check energy conservation
    const { kineticEnergy: ke0, potentialEnergy: pe0 } = {
      kineticEnergy: 0,
      potentialEnergy: 0.5 * k * 1.0,
    };
    const E0 = ke0 + pe0;

    let maxDrift = 0;
    for (let step = 0; step < 100; step++) {
      const { kineticEnergy, potentialEnergy } = velocityVerletStep(
        positions,
        velocities,
        forces,
        masses,
        fixed,
        dt,
        computeForces,
      );
      const Etot = kineticEnergy + potentialEnergy;
      const drift = Math.abs(Etot - E0) / E0;
      if (drift > maxDrift) maxDrift = drift;
    }

    // Verlet should conserve energy very well for small dt
    expect(maxDrift).toBeLessThan(0.01); // < 1% drift
  });

  it('does not move fixed atoms', () => {
    const positions = new Float64Array([1.0, 2.0, 3.0]);
    const velocities = new Float64Array([0.1, 0.1, 0.1]);
    const forces = new Float64Array([1.0, 1.0, 1.0]);
    const masses = new Float64Array([1.0]);
    const fixed = new Uint8Array([1]); // fixed
    const dt = 1.0;

    const computeForces = (_pos: Float64Array, _frc: Float64Array): number => {
      void _pos;
      void _frc;
      return 0;
    };

    velocityVerletStep(
      positions,
      velocities,
      forces,
      masses,
      fixed,
      dt,
      computeForces,
    );

    expect(positions[0]).toBe(1.0);
    expect(positions[1]).toBe(2.0);
    expect(positions[2]).toBe(3.0);
  });

  it('updates positions for free atoms', () => {
    const positions = new Float64Array([0, 0, 0]);
    const velocities = new Float64Array([0.01, 0, 0]); // moving in +x
    const forces = new Float64Array([0, 0, 0]);
    const masses = new Float64Array([1.0]);
    const fixed = new Uint8Array([0]);
    const dt = 1.0;

    const computeForces = (_pos: Float64Array, _frc: Float64Array): number => {
      void _pos;
      void _frc;
      return 0;
    };

    velocityVerletStep(
      positions,
      velocities,
      forces,
      masses,
      fixed,
      dt,
      computeForces,
    );

    // Position should have moved in +x direction
    expect(positions[0]).toBeGreaterThan(0);
  });

  it('returns kinetic and potential energy', () => {
    const positions = new Float64Array([1.0, 0, 0]);
    const velocities = new Float64Array([0.01, 0, 0]);
    const forces = new Float64Array([0, 0, 0]);
    const masses = new Float64Array([1.0]);
    const fixed = new Uint8Array([0]);
    const dt = 0.1;

    const computeForces = (_pos: Float64Array, _frc: Float64Array): number => {
      void _pos;
      void _frc;
      return 0.5;
    };

    const result = velocityVerletStep(
      positions,
      velocities,
      forces,
      masses,
      fixed,
      dt,
      computeForces,
    );

    expect(result.potentialEnergy).toBe(0.5);
    expect(result.kineticEnergy).toBeGreaterThanOrEqual(0);
  });
});

describe('initializeVelocities', () => {
  it('sets velocities for non-fixed atoms', () => {
    const velocities = new Float64Array(9);
    const masses = new Float64Array([16.0, 1.008, 1.008]);
    const fixed = new Uint8Array([0, 0, 0]);

    initializeVelocities(velocities, masses, fixed, 300);

    // At least some velocities should be non-zero
    let hasNonZero = false;
    for (let i = 0; i < 9; i++) {
      if (Math.abs(velocities[i]) > 1e-15) hasNonZero = true;
    }
    expect(hasNonZero).toBe(true);
  });

  it('sets zero velocities for fixed atoms', () => {
    const velocities = new Float64Array(9);
    const masses = new Float64Array([16.0, 1.008, 1.008]);
    const fixed = new Uint8Array([1, 0, 0]);

    initializeVelocities(velocities, masses, fixed, 300);

    expect(velocities[0]).toBe(0);
    expect(velocities[1]).toBe(0);
    expect(velocities[2]).toBe(0);
  });

  it('removes center-of-mass velocity', () => {
    const velocities = new Float64Array(9);
    const masses = new Float64Array([16.0, 1.008, 1.008]);
    const fixed = new Uint8Array([0, 0, 0]);

    initializeVelocities(velocities, masses, fixed, 300);

    // Center of mass velocity should be ~0
    let totalMass = 0;
    let vcomX = 0,
      vcomY = 0,
      vcomZ = 0;
    for (let i = 0; i < 3; i++) {
      totalMass += masses[i];
      vcomX += masses[i] * velocities[i * 3];
      vcomY += masses[i] * velocities[i * 3 + 1];
      vcomZ += masses[i] * velocities[i * 3 + 2];
    }
    expect(Math.abs(vcomX / totalMass)).toBeLessThan(1e-10);
    expect(Math.abs(vcomY / totalMass)).toBeLessThan(1e-10);
    expect(Math.abs(vcomZ / totalMass)).toBeLessThan(1e-10);
  });

  it('produces velocities at approximately the right temperature', () => {
    // Use a large system for statistical averaging
    const N = 100;
    const velocities = new Float64Array(N * 3);
    const masses = new Float64Array(N);
    const fixed = new Uint8Array(N);
    for (let i = 0; i < N; i++) masses[i] = 16.0;

    const targetT = 300;
    initializeVelocities(velocities, masses, fixed, targetT);

    // Compute KE
    const CONV = 103.6427;
    let KE = 0;
    for (let i = 0; i < N; i++) {
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];
      KE += 0.5 * masses[i] * (vx * vx + vy * vy + vz * vz) * CONV;
    }

    const T = computeTemperature(KE, N);
    // Temperature should be roughly in the right ballpark (statistical fluctuations)
    // For 100 atoms, expect within factor of 2-3
    expect(T).toBeGreaterThan(50);
    expect(T).toBeLessThan(1500);
  });
});
