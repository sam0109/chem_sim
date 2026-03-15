import { describe, it, expect } from 'vitest';
import { harmonicAngleForce } from '../harmonic.ts';

/**
 * Helper: create a 3-atom system for angle i-j-k.
 * Atom j is at origin (central), atoms i and k are placed
 * to form a specified angle.
 */
function makeAngle(angle: number, bondLen = 1.0): {
  positions: Float64Array;
  forces: Float64Array;
} {
  // j at origin, i along +x, k at angle from +x in xy-plane
  const positions = new Float64Array(9);
  // atom i (index 0): along +x
  positions[0] = bondLen;
  positions[1] = 0;
  positions[2] = 0;
  // atom j (index 1): at origin
  positions[3] = 0;
  positions[4] = 0;
  positions[5] = 0;
  // atom k (index 2): at angle from +x
  positions[6] = bondLen * Math.cos(angle);
  positions[7] = bondLen * Math.sin(angle);
  positions[8] = 0;

  const forces = new Float64Array(9);
  return { positions, forces };
}

/**
 * Central finite-difference gradient check for 3-atom system.
 */
function checkGradient(
  k_angle: number, theta0: number,
  testAngle: number, bondLen = 1.0,
  h = 1e-5,
): void {
  const { positions } = makeAngle(testAngle, bondLen);
  const analyticalForces = new Float64Array(9);
  harmonicAngleForce(positions, analyticalForces, 0, 1, 2, k_angle, theta0);

  for (let idx = 0; idx < 9; idx++) {
    const posPlus = new Float64Array(positions);
    const posMinus = new Float64Array(positions);
    posPlus[idx] += h;
    posMinus[idx] -= h;

    const fPlus = new Float64Array(9);
    const fMinus = new Float64Array(9);
    const ePlus = harmonicAngleForce(posPlus, fPlus, 0, 1, 2, k_angle, theta0);
    const eMinus = harmonicAngleForce(posMinus, fMinus, 0, 1, 2, k_angle, theta0);

    const numericalForce = -(ePlus - eMinus) / (2 * h);
    expect(analyticalForces[idx]).toBeCloseTo(numericalForce, 4);
  }
}

// Water-like angle parameters
const k_angle = 3.0;  // eV/rad²
const theta0 = (104.5 * Math.PI) / 180; // ~1.8238 rad

describe('harmonicAngleForce', () => {
  it('returns zero energy at equilibrium angle', () => {
    const { positions, forces } = makeAngle(theta0);
    const energy = harmonicAngleForce(positions, forces, 0, 1, 2, k_angle, theta0);
    expect(energy).toBeCloseTo(0, 8);
  });

  it('returns positive energy away from equilibrium', () => {
    const testAngle = (120 * Math.PI) / 180;
    const { positions, forces } = makeAngle(testAngle);
    const energy = harmonicAngleForce(positions, forces, 0, 1, 2, k_angle, theta0);
    expect(energy).toBeGreaterThan(0);
  });

  it('energy increases with displacement from equilibrium', () => {
    const angle1 = theta0 + 0.1;
    const angle2 = theta0 + 0.2;

    const { positions: p1, forces: f1 } = makeAngle(angle1);
    const e1 = harmonicAngleForce(p1, f1, 0, 1, 2, k_angle, theta0);

    const { positions: p2, forces: f2 } = makeAngle(angle2);
    const e2 = harmonicAngleForce(p2, f2, 0, 1, 2, k_angle, theta0);

    expect(e2).toBeGreaterThan(e1);
  });

  it('force balance: F_j = -(F_i + F_k)', () => {
    const testAngle = (120 * Math.PI) / 180;
    const { positions, forces } = makeAngle(testAngle);
    harmonicAngleForce(positions, forces, 0, 1, 2, k_angle, theta0);

    // Central atom j (index 1) forces should equal -(F_i + F_k)
    for (let d = 0; d < 3; d++) {
      const fSum = forces[0 + d] + forces[6 + d]; // F_i + F_k
      expect(forces[3 + d]).toBeCloseTo(-fSum, 8);
    }
  });

  it('zero force at equilibrium angle', () => {
    const { positions, forces } = makeAngle(theta0);
    harmonicAngleForce(positions, forces, 0, 1, 2, k_angle, theta0);
    for (let idx = 0; idx < 9; idx++) {
      expect(Math.abs(forces[idx])).toBeLessThan(1e-8);
    }
  });

  it('passes gradient consistency check at 120°', () => {
    const testAngle = (120 * Math.PI) / 180;
    checkGradient(k_angle, theta0, testAngle);
  });

  it('passes gradient consistency check at 90°', () => {
    const testAngle = (90 * Math.PI) / 180;
    checkGradient(k_angle, theta0, testAngle);
  });

  it('passes gradient consistency check at 150°', () => {
    const testAngle = (150 * Math.PI) / 180;
    checkGradient(k_angle, theta0, testAngle);
  });

  it('passes gradient consistency check with different bond lengths', () => {
    const testAngle = (110 * Math.PI) / 180;
    checkGradient(k_angle, theta0, testAngle, 1.5);
  });

  it('returns 0 for degenerate bond vectors (atoms at same position)', () => {
    const positions = new Float64Array([0, 0, 0, 0, 0, 0, 1, 0, 0]);
    const forces = new Float64Array(9);
    const energy = harmonicAngleForce(positions, forces, 0, 1, 2, k_angle, theta0);
    expect(energy).toBe(0);
  });

  it('is symmetric in terminal atoms', () => {
    const testAngle = (120 * Math.PI) / 180;
    const { positions } = makeAngle(testAngle);

    const forces1 = new Float64Array(9);
    const e1 = harmonicAngleForce(positions, forces1, 0, 1, 2, k_angle, theta0);

    const forces2 = new Float64Array(9);
    const e2 = harmonicAngleForce(positions, forces2, 2, 1, 0, k_angle, theta0);

    expect(e1).toBeCloseTo(e2, 10);
  });

  it('accumulates forces (does not overwrite)', () => {
    const testAngle = (120 * Math.PI) / 180;
    const { positions } = makeAngle(testAngle);
    const forces = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    harmonicAngleForce(positions, forces, 0, 1, 2, k_angle, theta0);

    const forcesClean = new Float64Array(9);
    harmonicAngleForce(new Float64Array(positions), forcesClean, 0, 1, 2, k_angle, theta0);

    expect(forces[0]).toBeCloseTo(1.0 + forcesClean[0], 10);
    expect(forces[3]).toBeCloseTo(4.0 + forcesClean[3], 10);
    expect(forces[6]).toBeCloseTo(7.0 + forcesClean[6], 10);
  });
});
