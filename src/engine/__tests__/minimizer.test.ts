import { describe, it, expect } from 'vitest';
import { steepestDescent } from '../minimizer.ts';

describe('steepestDescent', () => {
  it('minimizes a 1D harmonic potential to equilibrium', () => {
    // V(x) = 0.5 * k * (x - x0)^2, F = -k * (x - x0)
    const k = 10.0; // eV/Å²
    const x0 = 2.0; // equilibrium at x = 2.0

    const positions = new Float64Array([5.0, 0, 0]); // start at x = 5
    const forces = new Float64Array(3);
    const fixed = new Uint8Array([0]);

    const computeForces = (pos: Float64Array, frc: Float64Array): number => {
      const dx = pos[0] - x0;
      frc[0] = -k * dx;
      frc[1] = 0;
      frc[2] = 0;
      return 0.5 * k * dx * dx;
    };

    const finalEnergy = steepestDescent(positions, forces, fixed, 1, computeForces, 500, 0.001);

    expect(positions[0]).toBeCloseTo(x0, 1);
    expect(finalEnergy).toBeLessThan(0.01);
  });

  it('converges early when forces are already below tolerance', () => {
    const positions = new Float64Array([0, 0, 0]);
    const forces = new Float64Array(3);
    const fixed = new Uint8Array([0]);

    let callCount = 0;
    const computeForces = (_pos: Float64Array, frc: Float64Array): number => {
      callCount++;
      frc[0] = 0.001; // very small force
      frc[1] = 0;
      frc[2] = 0;
      return 0.0;
    };

    steepestDescent(positions, forces, fixed, 1, computeForces, 1000, 0.01);

    // Should converge in just 1 iteration since force < tolerance
    expect(callCount).toBeLessThan(5);
  });

  it('does not move fixed atoms', () => {
    const positions = new Float64Array([5.0, 0, 0]);
    const forces = new Float64Array(3);
    const fixed = new Uint8Array([1]); // fixed

    const computeForces = (_pos: Float64Array, frc: Float64Array): number => {
      frc[0] = 10.0; // large force
      frc[1] = 0;
      frc[2] = 0;
      return 1.0;
    };

    steepestDescent(positions, forces, fixed, 1, computeForces, 100, 0.01);

    expect(positions[0]).toBe(5.0);
  });

  it('reduces energy monotonically (on average) for well-behaved potentials', () => {
    const k = 5.0;
    const x0 = 0;

    const positions = new Float64Array([3.0, 0, 0]);
    const forces = new Float64Array(3);
    const fixed = new Uint8Array([0]);

    let prevEnergy = Infinity;
    let energyDecreased = 0;
    let totalSteps = 0;

    const computeForces = (pos: Float64Array, frc: Float64Array): number => {
      const dx = pos[0] - x0;
      frc[0] = -k * dx;
      frc[1] = 0;
      frc[2] = 0;
      const energy = 0.5 * k * dx * dx;
      if (energy < prevEnergy) energyDecreased++;
      prevEnergy = energy;
      totalSteps++;
      return energy;
    };

    steepestDescent(positions, forces, fixed, 1, computeForces, 100, 0.001);

    // Majority of steps should decrease energy
    expect(energyDecreased / totalSteps).toBeGreaterThan(0.5);
  });

  it('handles a 2-atom system', () => {
    // Two atoms connected by a harmonic spring, equilibrium at 1.5 Å
    const re = 1.5;
    const k = 10.0;

    // Start stretched
    const positions = new Float64Array([0, 0, 0, 3.0, 0, 0]);
    const forces = new Float64Array(6);
    const fixed = new Uint8Array([0, 0]);

    const computeForces = (pos: Float64Array, frc: Float64Array): number => {
      const dx = pos[3] - pos[0];
      const r = Math.abs(dx);
      const dr = r - re;
      const energy = 0.5 * k * dr * dr;
      const fMag = -k * dr;
      frc[0] = -fMag * Math.sign(dx);
      frc[3] = fMag * Math.sign(dx);
      return energy;
    };

    const finalEnergy = steepestDescent(positions, forces, fixed, 2, computeForces, 500, 0.001);

    const finalDist = Math.abs(positions[3] - positions[0]);
    expect(finalDist).toBeCloseTo(re, 0);
    expect(finalEnergy).toBeLessThan(0.5);
  });
});
