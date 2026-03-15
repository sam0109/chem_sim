import { describe, it, expect } from 'vitest';
import { coulombForce, KE } from '../coulomb.ts';

/**
 * Helper: create a two-atom system along the x-axis.
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
 */
function checkGradient(
  qi: number,
  qj: number,
  cutoff: number,
  r: number,
  h = 1e-5,
): void {
  const { positions } = makePair(r);
  const analyticalForces = new Float64Array(6);
  coulombForce(positions, analyticalForces, 0, 1, qi, qj, cutoff);

  for (let idx = 0; idx < 6; idx++) {
    const posPlus = new Float64Array(positions);
    const posMinus = new Float64Array(positions);
    posPlus[idx] += h;
    posMinus[idx] -= h;

    const fPlus = new Float64Array(6);
    const fMinus = new Float64Array(6);
    const ePlus = coulombForce(posPlus, fPlus, 0, 1, qi, qj, cutoff);
    const eMinus = coulombForce(posMinus, fMinus, 0, 1, qi, qj, cutoff);

    const numericalForce = -(ePlus - eMinus) / (2 * h);
    expect(analyticalForces[idx]).toBeCloseTo(numericalForce, 5);
  }
}

const cutoff = 10.0;

describe('coulombForce', () => {
  it('KE constant is correct (14.3996 eV·Å/e²)', () => {
    // Coulomb constant in eV·Å per e²
    // Source: NIST CODATA
    expect(KE).toBeCloseTo(14.3996, 4);
  });

  it('returns correct energy for like charges at known distance', () => {
    const qi = 1.0;
    const qj = 1.0;
    const r = 2.0;
    const { positions, forces } = makePair(r);
    const energy = coulombForce(positions, forces, 0, 1, qi, qj, cutoff);

    // V(r) = KE * qi * qj * (1/r - 1/rc)
    const expected = KE * qi * qj * (1 / r - 1 / cutoff);
    expect(energy).toBeCloseTo(expected, 8);
  });

  it('returns correct energy for opposite charges', () => {
    const qi = 1.0;
    const qj = -1.0;
    const r = 3.0;
    const { positions, forces } = makePair(r);
    const energy = coulombForce(positions, forces, 0, 1, qi, qj, cutoff);

    const expected = KE * qi * qj * (1 / r - 1 / cutoff);
    expect(energy).toBeCloseTo(expected, 8);
    expect(energy).toBeLessThan(0); // opposite charges attract → negative energy
  });

  it('returns zero energy beyond cutoff', () => {
    const r = cutoff + 1.0;
    const { positions, forces } = makePair(r);
    const energy = coulombForce(positions, forces, 0, 1, 1.0, 1.0, cutoff);
    expect(energy).toBe(0);
    for (let idx = 0; idx < 6; idx++) {
      expect(forces[idx]).toBe(0);
    }
  });

  it('returns zero energy when qi ≈ 0', () => {
    const { positions, forces } = makePair(3.0);
    const energy = coulombForce(positions, forces, 0, 1, 0.0, 1.0, cutoff);
    expect(energy).toBe(0);
  });

  it('returns zero energy when qj ≈ 0', () => {
    const { positions, forces } = makePair(3.0);
    const energy = coulombForce(positions, forces, 0, 1, 1.0, 0.0, cutoff);
    expect(energy).toBe(0);
  });

  it("obeys Newton's 3rd law", () => {
    const r = 4.0;
    const { positions, forces } = makePair(r);
    coulombForce(positions, forces, 0, 1, 0.5, -0.8, cutoff);

    expect(forces[0]).toBeCloseTo(-forces[3], 10);
    expect(forces[1]).toBeCloseTo(-forces[4], 10);
    expect(forces[2]).toBeCloseTo(-forces[5], 10);
  });

  it('produces repulsive force for like charges', () => {
    const r = 3.0;
    const { positions, forces } = makePair(r);
    coulombForce(positions, forces, 0, 1, 1.0, 1.0, cutoff);

    // Like charges → repulsive. Atom 0 pushed away from atom 1 (negative x)
    expect(forces[0]).toBeLessThan(0);
    expect(forces[3]).toBeGreaterThan(0);
  });

  it('produces attractive force for opposite charges', () => {
    const r = 3.0;
    const { positions, forces } = makePair(r);
    coulombForce(positions, forces, 0, 1, 1.0, -1.0, cutoff);

    // Opposite charges → attractive. Atom 0 pulled toward atom 1 (positive x)
    expect(forces[0]).toBeGreaterThan(0);
    expect(forces[3]).toBeLessThan(0);
  });

  it('passes gradient consistency check for like charges', () => {
    checkGradient(1.0, 1.0, cutoff, 3.0);
  });

  it('passes gradient consistency check for opposite charges', () => {
    checkGradient(0.5, -0.8, cutoff, 4.0);
  });

  it('passes gradient consistency check at close range', () => {
    checkGradient(1.0, -1.0, cutoff, 1.0);
  });

  it('returns 0 for degenerate r ≈ 0', () => {
    const { positions, forces } = makePair(0);
    const energy = coulombForce(positions, forces, 0, 1, 1.0, 1.0, cutoff);
    expect(energy).toBe(0);
  });

  it('energy is zero at exactly the cutoff distance (shifted potential)', () => {
    const { positions, forces } = makePair(cutoff);
    const energy = coulombForce(positions, forces, 0, 1, 1.0, 1.0, cutoff);
    expect(Math.abs(energy)).toBeLessThan(1e-10);
  });

  it('accumulates forces (does not overwrite)', () => {
    const r = 3.0;
    const { positions } = makePair(r);
    const forces = new Float64Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
    coulombForce(positions, forces, 0, 1, 1.0, 1.0, cutoff);

    const forcesClean = new Float64Array(6);
    coulombForce(
      new Float64Array(positions),
      forcesClean,
      0,
      1,
      1.0,
      1.0,
      cutoff,
    );

    expect(forces[0]).toBeCloseTo(1.0 + forcesClean[0], 10);
    expect(forces[3]).toBeCloseTo(4.0 + forcesClean[3], 10);
  });
});
