import { describe, it, expect } from 'vitest';
import { morseBondForce } from '../morse.ts';

/**
 * Helper: create a two-atom system along the x-axis.
 * Atom 0 at origin, atom 1 at distance r along +x.
 */
function makePair(r: number): {
  positions: Float64Array;
  forces: Float64Array;
} {
  const positions = new Float64Array([0, 0, 0, r, 0, 0]);
  const forces = new Float64Array(6);
  return { positions, forces };
}

/**
 * Central finite-difference gradient check.
 * Perturbs each coordinate of the two-atom system and compares
 * numerical -dE/dx to the analytical force.
 */
function checkGradient(
  De: number,
  alpha: number,
  re: number,
  r: number,
  h = 1e-5,
): void {
  const { positions } = makePair(r);
  const analyticalForces = new Float64Array(6);
  morseBondForce(positions, analyticalForces, 0, 1, De, alpha, re);

  for (let idx = 0; idx < 6; idx++) {
    const posPlus = new Float64Array(positions);
    const posMinus = new Float64Array(positions);
    posPlus[idx] += h;
    posMinus[idx] -= h;

    const fPlus = new Float64Array(6);
    const fMinus = new Float64Array(6);
    const ePlus = morseBondForce(posPlus, fPlus, 0, 1, De, alpha, re);
    const eMinus = morseBondForce(posMinus, fMinus, 0, 1, De, alpha, re);

    const numericalForce = -(ePlus - eMinus) / (2 * h);
    expect(analyticalForces[idx]).toBeCloseTo(numericalForce, 5);
  }
}

// Typical Morse parameters for O-H bond
const De = 4.0; // eV
const alpha = 2.0; // 1/Å
const re = 0.96; // Å

describe('morseBondForce', () => {
  it('returns zero energy at equilibrium distance', () => {
    const { positions, forces } = makePair(re);
    const energy = morseBondForce(positions, forces, 0, 1, De, alpha, re);
    expect(energy).toBeCloseTo(0, 10);
  });

  it('returns correct energy at known displacement', () => {
    // V(r) = De * [1 - exp(-alpha*(r - re))]^2
    const r = 1.2;
    const { positions, forces } = makePair(r);
    const energy = morseBondForce(positions, forces, 0, 1, De, alpha, re);
    const expected = De * (1 - Math.exp(-alpha * (r - re))) ** 2;
    expect(energy).toBeCloseTo(expected, 10);
  });

  it('returns zero force at equilibrium distance', () => {
    const { positions, forces } = makePair(re);
    morseBondForce(positions, forces, 0, 1, De, alpha, re);
    for (let idx = 0; idx < 6; idx++) {
      expect(Math.abs(forces[idx])).toBeLessThan(1e-10);
    }
  });

  it("obeys Newton's 3rd law (equal and opposite forces)", () => {
    const r = 1.3;
    const { positions, forces } = makePair(r);
    morseBondForce(positions, forces, 0, 1, De, alpha, re);

    // F_i = -F_j for each component
    expect(forces[0]).toBeCloseTo(-forces[3], 10);
    expect(forces[1]).toBeCloseTo(-forces[4], 10);
    expect(forces[2]).toBeCloseTo(-forces[5], 10);
  });

  it('produces attractive force when stretched beyond equilibrium', () => {
    const r = 1.5; // stretched
    const { positions, forces } = makePair(r);
    morseBondForce(positions, forces, 0, 1, De, alpha, re);

    // Atom 0 at origin, atom 1 at +x. Stretched → attractive.
    // Force on atom 0 should be positive x (toward atom 1)
    expect(forces[0]).toBeGreaterThan(0);
    // Force on atom 1 should be negative x (toward atom 0)
    expect(forces[3]).toBeLessThan(0);
  });

  it('produces repulsive force when compressed below equilibrium', () => {
    const r = 0.7; // compressed
    const { positions, forces } = makePair(r);
    morseBondForce(positions, forces, 0, 1, De, alpha, re);

    // Compressed → repulsive. Force on atom 0 should push away (negative x)
    expect(forces[0]).toBeLessThan(0);
    // Force on atom 1 should push away (positive x)
    expect(forces[3]).toBeGreaterThan(0);
  });

  it('passes gradient consistency check at stretched distance', () => {
    checkGradient(De, alpha, re, 1.3);
  });

  it('passes gradient consistency check at compressed distance', () => {
    checkGradient(De, alpha, re, 0.7);
  });

  it('passes gradient consistency check at large displacement', () => {
    checkGradient(De, alpha, re, 2.0);
  });

  it('returns 0 for degenerate r ≈ 0', () => {
    const { positions, forces } = makePair(0);
    const energy = morseBondForce(positions, forces, 0, 1, De, alpha, re);
    expect(energy).toBe(0);
  });

  it('approaches De asymptotically at large r', () => {
    const rLarge = 10.0;
    const { positions, forces } = makePair(rLarge);
    const energy = morseBondForce(positions, forces, 0, 1, De, alpha, re);
    // At very large r, exp(-alpha*(r-re)) → 0, so V → De
    expect(energy).toBeCloseTo(De, 2);
  });

  it('accumulates forces (does not overwrite)', () => {
    const r = 1.2;
    const { positions } = makePair(r);
    const forces = new Float64Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
    morseBondForce(positions, forces, 0, 1, De, alpha, re);

    // Forces should have changed from initial values (accumulated)
    const forcesClean = new Float64Array(6);
    morseBondForce(
      new Float64Array(positions),
      forcesClean,
      0,
      1,
      De,
      alpha,
      re,
    );

    expect(forces[0]).toBeCloseTo(1.0 + forcesClean[0], 10);
    expect(forces[1]).toBeCloseTo(2.0 + forcesClean[1], 10);
    expect(forces[3]).toBeCloseTo(4.0 + forcesClean[3], 10);
  });
});
