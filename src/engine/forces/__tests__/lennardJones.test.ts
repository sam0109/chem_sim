import { describe, it, expect } from 'vitest';
import { ljForce } from '../lennardJones.ts';

/**
 * Helper: create a two-atom system along the x-axis.
 */
function makePair(r: number): { positions: Float64Array; forces: Float64Array } {
  const positions = new Float64Array([0, 0, 0, r, 0, 0]);
  const forces = new Float64Array(6);
  return { positions, forces };
}

/**
 * Central finite-difference gradient check.
 */
function checkGradient(
  sigma: number, epsilon: number, cutoff: number,
  r: number, h = 1e-5, tol = 1e-6,
): void {
  const { positions } = makePair(r);
  const analyticalForces = new Float64Array(6);
  ljForce(positions, analyticalForces, 0, 1, sigma, epsilon, cutoff);

  for (let idx = 0; idx < 6; idx++) {
    const posPlus = new Float64Array(positions);
    const posMinus = new Float64Array(positions);
    posPlus[idx] += h;
    posMinus[idx] -= h;

    const fPlus = new Float64Array(6);
    const fMinus = new Float64Array(6);
    const ePlus = ljForce(posPlus, fPlus, 0, 1, sigma, epsilon, cutoff);
    const eMinus = ljForce(posMinus, fMinus, 0, 1, sigma, epsilon, cutoff);

    const numericalForce = -(ePlus - eMinus) / (2 * h);
    expect(analyticalForces[idx]).toBeCloseTo(numericalForce, 5);
  }
}

// Typical LJ parameters
const sigma = 3.5;     // Å
const epsilon = 0.003;  // eV
const cutoff = 10.0;    // Å

describe('ljForce', () => {
  it('returns correct energy at LJ minimum (r = 2^(1/6) * sigma)', () => {
    const rMin = sigma * Math.pow(2, 1 / 6);
    const { positions, forces } = makePair(rMin);
    const energy = ljForce(positions, forces, 0, 1, sigma, epsilon, cutoff);

    // V(rMin) = -epsilon (unshifted). With shift: V(rMin) - V(rc)
    const src2 = (sigma * sigma) / (cutoff * cutoff);
    const src6 = src2 * src2 * src2;
    const src12 = src6 * src6;
    const vShift = 4.0 * epsilon * (src12 - src6);
    const expected = -epsilon - vShift;
    expect(energy).toBeCloseTo(expected, 8);
  });

  it('returns zero energy beyond cutoff', () => {
    const rBeyond = cutoff + 1.0;
    const { positions, forces } = makePair(rBeyond);
    const energy = ljForce(positions, forces, 0, 1, sigma, epsilon, cutoff);
    expect(energy).toBe(0);
    for (let idx = 0; idx < 6; idx++) {
      expect(forces[idx]).toBe(0);
    }
  });

  it('returns zero energy at exactly cutoff distance', () => {
    // At r = cutoff, shifted energy should be 0
    const { positions, forces } = makePair(cutoff);
    const energy = ljForce(positions, forces, 0, 1, sigma, epsilon, cutoff);
    expect(Math.abs(energy)).toBeLessThan(1e-10);
  });

  it('obeys Newton\'s 3rd law', () => {
    const r = 4.0;
    const { positions, forces } = makePair(r);
    ljForce(positions, forces, 0, 1, sigma, epsilon, cutoff);

    expect(forces[0]).toBeCloseTo(-forces[3], 10);
    expect(forces[1]).toBeCloseTo(-forces[4], 10);
    expect(forces[2]).toBeCloseTo(-forces[5], 10);
  });

  it('produces repulsive force at close range (r < sigma)', () => {
    const r = sigma * 0.9;
    const { positions, forces } = makePair(r);
    ljForce(positions, forces, 0, 1, sigma, epsilon, cutoff);

    // Atom 0 at origin, atom 1 at +x. Close range → repulsive.
    // Force on atom 0 should be negative x (away from atom 1)
    expect(forces[0]).toBeLessThan(0);
    expect(forces[3]).toBeGreaterThan(0);
  });

  it('produces attractive force near the minimum', () => {
    // At r slightly larger than rMin, there should be attraction
    const rMin = sigma * Math.pow(2, 1 / 6);
    const r = rMin * 1.5;
    const { positions, forces } = makePair(r);
    ljForce(positions, forces, 0, 1, sigma, epsilon, cutoff);

    // Attractive → force on atom 0 should be positive x (toward atom 1)
    expect(forces[0]).toBeGreaterThan(0);
    expect(forces[3]).toBeLessThan(0);
  });

  it('passes gradient consistency check at r = 4.0', () => {
    checkGradient(sigma, epsilon, cutoff, 4.0);
  });

  it('passes gradient consistency check at close range', () => {
    checkGradient(sigma, epsilon, cutoff, sigma * 0.95);
  });

  it('passes gradient consistency check near minimum', () => {
    const rMin = sigma * Math.pow(2, 1 / 6);
    checkGradient(sigma, epsilon, cutoff, rMin * 1.2);
  });

  it('returns 0 for degenerate r ≈ 0', () => {
    const { positions, forces } = makePair(0);
    const energy = ljForce(positions, forces, 0, 1, sigma, epsilon, cutoff);
    expect(energy).toBe(0);
  });

  it('produces energy that goes to zero smoothly at cutoff', () => {
    // Energy just inside cutoff should be very small
    const rNearCutoff = cutoff - 0.01;
    const { positions, forces } = makePair(rNearCutoff);
    const energy = ljForce(positions, forces, 0, 1, sigma, epsilon, cutoff);
    expect(Math.abs(energy)).toBeLessThan(1e-6);
  });

  it('accumulates forces (does not overwrite)', () => {
    const r = 4.0;
    const { positions } = makePair(r);
    const forces = new Float64Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
    ljForce(positions, forces, 0, 1, sigma, epsilon, cutoff);

    const forcesClean = new Float64Array(6);
    ljForce(new Float64Array(positions), forcesClean, 0, 1, sigma, epsilon, cutoff);

    expect(forces[0]).toBeCloseTo(1.0 + forcesClean[0], 10);
    expect(forces[3]).toBeCloseTo(4.0 + forcesClean[3], 10);
  });
});
