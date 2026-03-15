import { describe, it, expect } from 'vitest';
import { pauliRepulsion } from '../pauli.ts';

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
  rMin: number, strength: number,
  r: number, h = 1e-5,
): void {
  const { positions } = makePair(r);
  const analyticalForces = new Float64Array(6);
  pauliRepulsion(positions, analyticalForces, 0, 1, rMin, strength);

  for (let idx = 0; idx < 6; idx++) {
    const posPlus = new Float64Array(positions);
    const posMinus = new Float64Array(positions);
    posPlus[idx] += h;
    posMinus[idx] -= h;

    const fPlus = new Float64Array(6);
    const fMinus = new Float64Array(6);
    const ePlus = pauliRepulsion(posPlus, fPlus, 0, 1, rMin, strength);
    const eMinus = pauliRepulsion(posMinus, fMinus, 0, 1, rMin, strength);

    const numericalForce = -(ePlus - eMinus) / (2 * h);
    expect(analyticalForces[idx]).toBeCloseTo(numericalForce, 4);
  }
}

// Typical Pauli repulsion parameters
const rMin = 0.6;      // Å
const strength = 20.0;  // eV

describe('pauliRepulsion', () => {
  it('returns positive energy below 2×rMin', () => {
    const r = rMin * 0.8;
    const { positions, forces } = makePair(r);
    const energy = pauliRepulsion(positions, forces, 0, 1, rMin, strength);
    expect(energy).toBeGreaterThan(0);
  });

  it('returns zero energy beyond 2×rMin cutoff', () => {
    const r = 2 * rMin + 0.1;
    const { positions, forces } = makePair(r);
    const energy = pauliRepulsion(positions, forces, 0, 1, rMin, strength);
    expect(energy).toBe(0);
    for (let idx = 0; idx < 6; idx++) {
      expect(forces[idx]).toBe(0);
    }
  });

  it('energy at r = rMin equals the strength parameter', () => {
    // V(rMin) = A * exp(-b * (rMin - rMin)) = A * exp(0) = A = strength
    const { positions, forces } = makePair(rMin);
    const energy = pauliRepulsion(positions, forces, 0, 1, rMin, strength);
    expect(energy).toBeCloseTo(strength, 8);
  });

  it('energy increases as atoms get closer', () => {
    const r1 = rMin * 0.9;
    const r2 = rMin * 0.7;

    const { positions: p1, forces: f1 } = makePair(r1);
    const e1 = pauliRepulsion(p1, f1, 0, 1, rMin, strength);

    const { positions: p2, forces: f2 } = makePair(r2);
    const e2 = pauliRepulsion(p2, f2, 0, 1, rMin, strength);

    expect(e2).toBeGreaterThan(e1);
  });

  it('obeys Newton\'s 3rd law', () => {
    const r = rMin * 0.8;
    const { positions, forces } = makePair(r);
    pauliRepulsion(positions, forces, 0, 1, rMin, strength);

    expect(forces[0]).toBeCloseTo(-forces[3], 10);
    expect(forces[1]).toBeCloseTo(-forces[4], 10);
    expect(forces[2]).toBeCloseTo(-forces[5], 10);
  });

  it('force is repulsive (pushes atoms apart)', () => {
    const r = rMin * 0.8;
    const { positions, forces } = makePair(r);
    pauliRepulsion(positions, forces, 0, 1, rMin, strength);

    // Atom 0 at origin, atom 1 at +x. Repulsive → atom 0 pushed to -x
    expect(forces[0]).toBeLessThan(0);
    expect(forces[3]).toBeGreaterThan(0);
  });

  it('passes gradient consistency check at r = 0.5×rMin', () => {
    checkGradient(rMin, strength, rMin * 0.5);
  });

  it('passes gradient consistency check at r = rMin', () => {
    checkGradient(rMin, strength, rMin);
  });

  it('passes gradient consistency check at r = 1.5×rMin', () => {
    checkGradient(rMin, strength, rMin * 1.5);
  });

  it('returns 0 for degenerate r ≈ 0', () => {
    const { positions, forces } = makePair(0);
    const energy = pauliRepulsion(positions, forces, 0, 1, rMin, strength);
    expect(energy).toBe(0);
  });

  it('scales linearly with strength parameter', () => {
    const r = rMin * 0.8;
    const { positions: p1, forces: f1 } = makePair(r);
    const e1 = pauliRepulsion(p1, f1, 0, 1, rMin, 10.0);

    const { positions: p2, forces: f2 } = makePair(r);
    const e2 = pauliRepulsion(p2, f2, 0, 1, rMin, 20.0);

    expect(e2).toBeCloseTo(2 * e1, 8);
  });

  it('accumulates forces (does not overwrite)', () => {
    const r = rMin * 0.8;
    const { positions } = makePair(r);
    const forces = new Float64Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
    pauliRepulsion(positions, forces, 0, 1, rMin, strength);

    const forcesClean = new Float64Array(6);
    pauliRepulsion(new Float64Array(positions), forcesClean, 0, 1, rMin, strength);

    expect(forces[0]).toBeCloseTo(1.0 + forcesClean[0], 10);
    expect(forces[3]).toBeCloseTo(4.0 + forcesClean[3], 10);
  });
});
