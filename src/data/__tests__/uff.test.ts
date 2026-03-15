import { describe, it, expect } from 'vitest';
import {
  getUFFType,
  getUFFBondLength,
  getMorseBondParams,
  getLJParams,
  getUFFAngleK,
  uffAtomTypes,
  KCAL_TO_EV,
} from '../uff.ts';

describe('KCAL_TO_EV constant', () => {
  it('has the correct value (0.0433641 eV/kcal·mol⁻¹)', () => {
    // Source: NIST, 1 kcal/mol = 0.0433641 eV
    expect(KCAL_TO_EV).toBeCloseTo(0.0433641, 6);
  });
});

describe('uffAtomTypes', () => {
  it('contains hydrogen parameters', () => {
    const h = uffAtomTypes['H'];
    expect(h).toBeDefined();
    expect(h.element).toBe('H');
    expect(h.atomicNumber).toBe(1);
    expect(h.r1).toBeCloseTo(0.354, 3);
  });

  it('contains carbon sp3 parameters', () => {
    const c = uffAtomTypes['C_3'];
    expect(c).toBeDefined();
    expect(c.element).toBe('C');
    expect(c.atomicNumber).toBe(6);
    expect(c.r1).toBeCloseTo(0.757, 3);
    expect(c.theta0).toBeCloseTo(109.47, 2);
  });

  it('contains oxygen sp3 parameters', () => {
    const o = uffAtomTypes['O_3'];
    expect(o).toBeDefined();
    expect(o.element).toBe('O');
    expect(o.atomicNumber).toBe(8);
    expect(o.r1).toBeCloseTo(0.658, 3);
    expect(o.theta0).toBeCloseTo(104.51, 2);
  });

  it('contains nitrogen sp3 parameters', () => {
    const n = uffAtomTypes['N_3'];
    expect(n).toBeDefined();
    expect(n.element).toBe('N');
    expect(n.atomicNumber).toBe(7);
  });
});

describe('getUFFType', () => {
  it('returns H for atomic number 1', () => {
    const t = getUFFType(1);
    expect(t).toBeDefined();
    expect(t!.element).toBe('H');
  });

  it('returns C_3 (sp3) for atomic number 6', () => {
    const t = getUFFType(6);
    expect(t).toBeDefined();
    expect(t!.label).toBe('C_3');
  });

  it('returns O_3 (sp3) for atomic number 8', () => {
    const t = getUFFType(8);
    expect(t).toBeDefined();
    expect(t!.label).toBe('O_3');
  });

  it('returns undefined for unknown atomic number', () => {
    const t = getUFFType(999);
    expect(t).toBeUndefined();
  });

  it('returns Fe for atomic number 26', () => {
    const t = getUFFType(26);
    expect(t).toBeDefined();
    expect(t!.element).toBe('Fe');
  });
});

describe('getUFFBondLength', () => {
  it('returns a reasonable O-H bond length (~0.96-1.1 Å)', () => {
    const re = getUFFBondLength(8, 1); // O-H
    expect(re).toBeGreaterThan(0.8);
    expect(re).toBeLessThan(1.3);
  });

  it('returns a reasonable C-C single bond length (~1.4-1.6 Å)', () => {
    const re = getUFFBondLength(6, 6); // C-C
    expect(re).toBeGreaterThan(1.2);
    expect(re).toBeLessThan(1.8);
  });

  it('decreases with increasing bond order', () => {
    const single = getUFFBondLength(6, 6, 1);
    const double = getUFFBondLength(6, 6, 2);
    const triple = getUFFBondLength(6, 6, 3);
    expect(double).toBeLessThan(single);
    expect(triple).toBeLessThan(double);
  });

  it('returns fallback 1.5 for unknown atom types', () => {
    const re = getUFFBondLength(999, 1);
    expect(re).toBe(1.5);
  });

  it('is symmetric in atom order', () => {
    const re1 = getUFFBondLength(8, 1);
    const re2 = getUFFBondLength(1, 8);
    expect(re1).toBeCloseTo(re2, 10);
  });
});

describe('getMorseBondParams', () => {
  it('returns reasonable De, alpha, re for O-H', () => {
    const { De, alpha, re } = getMorseBondParams(8, 1);
    expect(De).toBeGreaterThan(0); // positive dissociation energy
    expect(alpha).toBeGreaterThan(0); // positive width parameter
    expect(re).toBeGreaterThan(0.8); // reasonable bond length
    expect(re).toBeLessThan(1.3);
  });

  it('returns reasonable De, alpha, re for C-C', () => {
    const { De, alpha, re } = getMorseBondParams(6, 6);
    expect(De).toBeGreaterThan(0);
    expect(alpha).toBeGreaterThan(0);
    expect(re).toBeGreaterThan(1.2);
    expect(re).toBeLessThan(1.8);
  });

  it('De increases with bond order', () => {
    const single = getMorseBondParams(6, 6, 1);
    const double = getMorseBondParams(6, 6, 2);
    expect(double.De).toBeGreaterThan(single.De);
  });

  it('returns fallback values for unknown atom types', () => {
    const { De, alpha, re } = getMorseBondParams(999, 1);
    expect(De).toBe(3.0);
    expect(alpha).toBe(2.0);
    expect(re).toBe(1.5);
  });

  it('De is in eV (reasonable range for covalent bonds)', () => {
    const { De } = getMorseBondParams(8, 1);
    // Typical covalent bond De: 1-10 eV
    expect(De).toBeGreaterThan(0.5);
    expect(De).toBeLessThan(15);
  });
});

describe('getLJParams', () => {
  it('returns reasonable sigma, epsilon for O-O', () => {
    const { sigma, epsilon } = getLJParams(8, 8);
    expect(sigma).toBeGreaterThan(2.0); // Å
    expect(sigma).toBeLessThan(5.0);
    expect(epsilon).toBeGreaterThan(0); // positive well depth
  });

  it('returns reasonable sigma, epsilon for C-C', () => {
    const { sigma, epsilon } = getLJParams(6, 6);
    expect(sigma).toBeGreaterThan(2.0);
    expect(sigma).toBeLessThan(5.0);
    expect(epsilon).toBeGreaterThan(0);
  });

  it('uses geometric combining rules (sigma is symmetric)', () => {
    const { sigma: s12 } = getLJParams(6, 8); // C-O
    const { sigma: s21 } = getLJParams(8, 6); // O-C
    expect(s12).toBeCloseTo(s21, 10);
  });

  it('uses geometric combining rules (epsilon is symmetric)', () => {
    const { epsilon: e12 } = getLJParams(6, 8);
    const { epsilon: e21 } = getLJParams(8, 6);
    expect(e12).toBeCloseTo(e21, 10);
  });

  it('sigma for same element equals the UFF x parameter', () => {
    const { sigma } = getLJParams(8, 8); // O-O
    const oType = getUFFType(8)!;
    // sigma = sqrt(x_i * x_j) = x_i for same element
    expect(sigma).toBeCloseTo(oType.x, 8);
  });

  it('epsilon for same element equals D * KCAL_TO_EV', () => {
    const { epsilon } = getLJParams(8, 8);
    const oType = getUFFType(8)!;
    expect(epsilon).toBeCloseTo(oType.D * KCAL_TO_EV, 8);
  });

  it('returns fallback values for unknown atom types', () => {
    const { sigma, epsilon } = getLJParams(999, 1);
    expect(sigma).toBe(3.0);
    expect(epsilon).toBe(0.01);
  });
});

describe('getUFFAngleK', () => {
  it('returns reasonable kAngle and theta0 for H-O-H (water)', () => {
    const { kAngle, theta0 } = getUFFAngleK(1, 8, 1);
    expect(kAngle).toBeGreaterThan(0);
    expect(kAngle).toBeLessThanOrEqual(15.0); // clamped max
    expect(kAngle).toBeGreaterThanOrEqual(0.05); // clamped min
    // Validated: H-O-H K ≈ 5.33 eV/rad² from Eq. 13
    expect(kAngle).toBeCloseTo(5.33, 0);
    // theta0 for oxygen sp3 ≈ 104.51°
    expect(theta0).toBeCloseTo((104.51 * Math.PI) / 180, 2);
  });

  it('theta0 comes from the central atom UFF type', () => {
    const { theta0 } = getUFFAngleK(1, 6, 1); // H-C-H
    const cType = getUFFType(6)!;
    expect(theta0).toBeCloseTo((cType.theta0 * Math.PI) / 180, 6);
  });

  it('returns fallback for unknown central atom', () => {
    const { kAngle, theta0 } = getUFFAngleK(1, 999, 1);
    expect(kAngle).toBe(3.0);
    expect(theta0).toBeCloseTo((109.47 * Math.PI) / 180, 4);
  });

  it('kAngle is in eV/rad² (reasonable range)', () => {
    const { kAngle } = getUFFAngleK(1, 8, 1);
    // After clamping: 0.05 - 15.0 eV/rad²
    expect(kAngle).toBeGreaterThanOrEqual(0.05);
    expect(kAngle).toBeLessThanOrEqual(15.0);
  });

  it('is symmetric in terminal atoms', () => {
    const r1 = getUFFAngleK(1, 8, 6); // H-O-C
    const r2 = getUFFAngleK(6, 8, 1); // C-O-H
    expect(r1.kAngle).toBeCloseTo(r2.kAngle, 6);
    expect(r1.theta0).toBeCloseTo(r2.theta0, 10);
  });
});
