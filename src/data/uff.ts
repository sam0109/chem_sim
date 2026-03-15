// ==============================================================
// UFF (Universal Force Field) parameters
// Source: Rappé, Casewit, Colwell, Goddard, Skiff — JACS 1992
// Units: distances in Å, energies in kcal/mol (converted to eV internally)
// ==============================================================

import type { Hybridization, UFFAtomType } from './types';
import { getBDE } from './bondEnergies';

const KCAL_TO_EV = 0.0433641;

/**
 * UFF atom type parameters.
 * Key: element symbol (using generic type, e.g., sp3 default)
 * For a full implementation you'd key by hybridization too.
 */
const uffAtomTypes: Record<string, UFFAtomType> = {
  H: {
    label: 'H_',
    element: 'H',
    atomicNumber: 1,
    r1: 0.354,
    theta0: 180.0,
    x: 2.886,
    D: 0.044,
    zeta: 12.0,
    Z: 0.712,
    chi: 4.528,
  },
  He: {
    label: 'He4+4',
    element: 'He',
    atomicNumber: 2,
    r1: 0.849,
    theta0: 90.0,
    x: 2.362,
    D: 0.056,
    zeta: 15.24,
    Z: 0.098,
    chi: 9.66,
  },
  Li: {
    label: 'Li',
    element: 'Li',
    atomicNumber: 3,
    r1: 1.336,
    theta0: 180.0,
    x: 2.451,
    D: 0.025,
    zeta: 12.0,
    Z: 1.026,
    chi: 2.0,
  },
  Be: {
    label: 'Be3+2',
    element: 'Be',
    atomicNumber: 4,
    r1: 1.074,
    theta0: 109.47,
    x: 2.745,
    D: 0.085,
    zeta: 12.0,
    Z: 1.565,
    chi: 4.0,
  },
  B: {
    label: 'B_3',
    element: 'B',
    atomicNumber: 5,
    r1: 0.838,
    theta0: 109.47,
    x: 4.083,
    D: 0.18,
    zeta: 12.052,
    Z: 1.755,
    chi: 5.11,
  },
  C_3: {
    label: 'C_3',
    element: 'C',
    atomicNumber: 6,
    r1: 0.757,
    theta0: 109.47,
    x: 3.851,
    D: 0.105,
    zeta: 12.73,
    Z: 1.912,
    chi: 5.343,
  },
  C_R: {
    label: 'C_R',
    element: 'C',
    atomicNumber: 6,
    r1: 0.729,
    theta0: 120.0,
    x: 3.851,
    D: 0.105,
    zeta: 12.73,
    Z: 1.912,
    chi: 5.343,
  },
  C_2: {
    label: 'C_2',
    element: 'C',
    atomicNumber: 6,
    r1: 0.732,
    theta0: 120.0,
    x: 3.851,
    D: 0.105,
    zeta: 12.73,
    Z: 1.912,
    chi: 5.343,
  },
  C_1: {
    label: 'C_1',
    element: 'C',
    atomicNumber: 6,
    r1: 0.706,
    theta0: 180.0,
    x: 3.851,
    D: 0.105,
    zeta: 12.73,
    Z: 1.912,
    chi: 5.343,
  },
  N_3: {
    label: 'N_3',
    element: 'N',
    atomicNumber: 7,
    r1: 0.7,
    theta0: 106.7,
    x: 3.66,
    D: 0.069,
    zeta: 13.407,
    Z: 2.544,
    chi: 6.899,
  },
  N_R: {
    label: 'N_R',
    element: 'N',
    atomicNumber: 7,
    r1: 0.699,
    theta0: 120.0,
    x: 3.66,
    D: 0.069,
    zeta: 13.407,
    Z: 2.544,
    chi: 6.899,
  },
  N_2: {
    label: 'N_2',
    element: 'N',
    atomicNumber: 7,
    r1: 0.685,
    theta0: 111.2,
    x: 3.66,
    D: 0.069,
    zeta: 13.407,
    Z: 2.544,
    chi: 6.899,
  },
  N_1: {
    label: 'N_1',
    element: 'N',
    atomicNumber: 7,
    r1: 0.656,
    theta0: 180.0,
    x: 3.66,
    D: 0.069,
    zeta: 13.407,
    Z: 2.544,
    chi: 6.899,
  },
  O_3: {
    label: 'O_3',
    element: 'O',
    atomicNumber: 8,
    r1: 0.658,
    theta0: 104.51,
    x: 3.5,
    D: 0.06,
    zeta: 14.085,
    Z: 2.3,
    chi: 8.741,
  },
  O_R: {
    label: 'O_R',
    element: 'O',
    atomicNumber: 8,
    r1: 0.68,
    theta0: 110.0,
    x: 3.5,
    D: 0.06,
    zeta: 14.085,
    Z: 2.3,
    chi: 8.741,
  },
  O_2: {
    label: 'O_2',
    element: 'O',
    atomicNumber: 8,
    r1: 0.634,
    theta0: 120.0,
    x: 3.5,
    D: 0.06,
    zeta: 14.085,
    Z: 2.3,
    chi: 8.741,
  },
  O_1: {
    label: 'O_1',
    element: 'O',
    atomicNumber: 8,
    r1: 0.639,
    theta0: 180.0,
    x: 3.5,
    D: 0.06,
    zeta: 14.085,
    Z: 2.3,
    chi: 8.741,
  },
  F: {
    label: 'F_',
    element: 'F',
    atomicNumber: 9,
    r1: 0.668,
    theta0: 180.0,
    x: 3.364,
    D: 0.05,
    zeta: 14.762,
    Z: 2.3,
    chi: 10.874,
  },
  Ne: {
    label: 'Ne4+4',
    element: 'Ne',
    atomicNumber: 10,
    r1: 0.92,
    theta0: 90.0,
    x: 3.243,
    D: 0.042,
    zeta: 15.44,
    Z: 0.194,
    chi: 11.04,
  },
  Na: {
    label: 'Na',
    element: 'Na',
    atomicNumber: 11,
    r1: 1.539,
    theta0: 180.0,
    x: 2.983,
    D: 0.03,
    zeta: 12.0,
    Z: 1.081,
    chi: 2.843,
  },
  Mg: {
    label: 'Mg3+2',
    element: 'Mg',
    atomicNumber: 12,
    r1: 1.421,
    theta0: 109.47,
    x: 3.021,
    D: 0.111,
    zeta: 12.0,
    Z: 1.787,
    chi: 3.951,
  },
  Al: {
    label: 'Al3',
    element: 'Al',
    atomicNumber: 13,
    r1: 1.244,
    theta0: 109.47,
    x: 4.499,
    D: 0.505,
    zeta: 11.278,
    Z: 1.792,
    chi: 4.06,
  },
  Si: {
    label: 'Si3',
    element: 'Si',
    atomicNumber: 14,
    r1: 1.117,
    theta0: 109.47,
    x: 4.295,
    D: 0.402,
    zeta: 12.175,
    Z: 2.323,
    chi: 4.168,
  },
  P_3: {
    label: 'P_3+3',
    element: 'P',
    atomicNumber: 15,
    r1: 1.101,
    theta0: 93.8,
    x: 4.147,
    D: 0.305,
    zeta: 13.072,
    Z: 2.863,
    chi: 5.463,
  },
  S_3: {
    label: 'S_3+2',
    element: 'S',
    atomicNumber: 16,
    r1: 1.064,
    theta0: 92.1,
    x: 4.035,
    D: 0.274,
    zeta: 13.969,
    Z: 2.703,
    chi: 6.928,
  },
  Cl: {
    label: 'Cl',
    element: 'Cl',
    atomicNumber: 17,
    r1: 1.044,
    theta0: 180.0,
    x: 3.947,
    D: 0.227,
    zeta: 14.886,
    Z: 2.348,
    chi: 8.564,
  },
  Ar: {
    label: 'Ar4+4',
    element: 'Ar',
    atomicNumber: 18,
    r1: 1.032,
    theta0: 90.0,
    x: 3.868,
    D: 0.185,
    zeta: 15.763,
    Z: 0.3,
    chi: 9.465,
  },
  K: {
    label: 'K_',
    element: 'K',
    atomicNumber: 19,
    r1: 1.953,
    theta0: 180.0,
    x: 3.812,
    D: 0.035,
    zeta: 12.0,
    Z: 1.165,
    chi: 2.421,
  },
  Ca: {
    label: 'Ca6+2',
    element: 'Ca',
    atomicNumber: 20,
    r1: 1.761,
    theta0: 90.0,
    x: 3.399,
    D: 0.238,
    zeta: 12.0,
    Z: 2.141,
    chi: 3.231,
  },
  Fe: {
    label: 'Fe3+2',
    element: 'Fe',
    atomicNumber: 26,
    r1: 1.285,
    theta0: 109.47,
    x: 2.912,
    D: 0.013,
    zeta: 12.0,
    Z: 2.912,
    chi: 6.4,
  },
  Cu: {
    label: 'Cu3+1',
    element: 'Cu',
    atomicNumber: 29,
    r1: 1.302,
    theta0: 109.47,
    x: 3.495,
    D: 0.005,
    zeta: 12.0,
    Z: 1.956,
    chi: 4.2,
  },
  Zn: {
    label: 'Zn3+2',
    element: 'Zn',
    atomicNumber: 30,
    r1: 1.308,
    theta0: 109.47,
    x: 2.763,
    D: 0.124,
    zeta: 12.0,
    Z: 1.308,
    chi: 5.106,
  },
  Br: {
    label: 'Br',
    element: 'Br',
    atomicNumber: 35,
    r1: 1.141,
    theta0: 180.0,
    x: 4.189,
    D: 0.251,
    zeta: 15.0,
    Z: 2.519,
    chi: 7.79,
  },
  I: {
    label: 'I_',
    element: 'I',
    atomicNumber: 53,
    r1: 1.36,
    theta0: 180.0,
    x: 4.5,
    D: 0.339,
    zeta: 15.0,
    Z: 2.65,
    chi: 6.822,
  },
};

// Generic lookup by element symbol — returns the sp3/default type
const elementToUFF: Record<number, string> = {
  1: 'H',
  2: 'He',
  3: 'Li',
  4: 'Be',
  5: 'B',
  6: 'C_3',
  7: 'N_3',
  8: 'O_3',
  9: 'F',
  10: 'Ne',
  11: 'Na',
  12: 'Mg',
  13: 'Al',
  14: 'Si',
  15: 'P_3',
  16: 'S_3',
  17: 'Cl',
  18: 'Ar',
  19: 'K',
  20: 'Ca',
  26: 'Fe',
  29: 'Cu',
  30: 'Zn',
  35: 'Br',
  53: 'I',
};

/**
 * Map (atomicNumber, hybridization) → UFF atom type key.
 * Falls back to the default elementToUFF mapping when no
 * hybridization-specific entry exists.
 *
 * Source: Rappé et al., JACS 114, 10024 (1992), Table I.
 * UFF naming: _1 = sp (linear), _2 = sp2 (trigonal), _R = resonant,
 *             _3 = sp3 (tetrahedral)
 */
const hybridToUFF: Record<number, Partial<Record<Hybridization, string>>> = {
  6: { sp: 'C_1', sp2: 'C_2', sp3: 'C_3' }, // Carbon
  7: { sp: 'N_1', sp2: 'N_2', sp3: 'N_3' }, // Nitrogen
  8: { sp: 'O_1', sp2: 'O_2', sp3: 'O_3' }, // Oxygen
};

export function getUFFType(atomicNumber: number): UFFAtomType | undefined {
  const key = elementToUFF[atomicNumber];
  return key ? uffAtomTypes[key] : undefined;
}

/**
 * Look up UFF atom type using hybridization when available.
 * Falls back to the default (sp3) type if no hybridization
 * mapping exists for this element.
 */
export function getUFFTypeHybrid(
  atomicNumber: number,
  hybridization?: Hybridization,
): UFFAtomType | undefined {
  if (hybridization) {
    const hybMap = hybridToUFF[atomicNumber];
    if (hybMap) {
      const key = hybMap[hybridization];
      if (key && uffAtomTypes[key]) return uffAtomTypes[key];
    }
  }
  // Fall back to default (sp3) lookup
  return getUFFType(atomicNumber);
}

/**
 * Compute UFF bond equilibrium distance between two atom types.
 * r_ij = r_i + r_j + r_BO + r_EN
 * r_BO = bond-order correction, r_EN = electronegativity correction
 *
 * When hybridization is provided, uses the hybridization-specific UFF
 * atom type (e.g. C_1 for sp carbon) which has a shorter natural bond
 * radius than the default sp3 type.
 * Source: Rappé et al., JACS 114, 10024 (1992), Eq. 3.
 */
export function getUFFBondLength(
  z1: number,
  z2: number,
  bondOrder: number = 1,
  hyb1?: Hybridization,
  hyb2?: Hybridization,
): number {
  const t1 = hyb1 ? getUFFTypeHybrid(z1, hyb1) : getUFFType(z1);
  const t2 = hyb2 ? getUFFTypeHybrid(z2, hyb2) : getUFFType(z2);
  if (!t1 || !t2) return 1.5; // fallback

  const r_BO = -0.1332 * (t1.r1 + t2.r1) * Math.log(bondOrder);
  const chiDiff = Math.sqrt(t1.chi) - Math.sqrt(t2.chi);
  const r_EN =
    (t1.r1 * t2.r1 * (chiDiff * chiDiff)) / (t1.chi * t1.r1 + t2.chi * t2.r1);
  return t1.r1 + t2.r1 + r_BO - r_EN;
}

/**
 * Compute Morse potential parameters for a bond.
 * Returns { De, alpha, re } in eV and Å.
 *
 * De is determined by cascading lookup:
 * 1. Experimental BDE table (element pair + bond order)
 * 2. Geometric-mean approximation from homonuclear BDEs
 * 3. Fallback: 70 × bondOrder kcal/mol (crude universal estimate)
 *
 * When hybridization is provided, re uses hybridization-specific UFF
 * atom types for more accurate equilibrium distances.
 *
 * @param z1 atomic number of first atom
 * @param z2 atomic number of second atom
 * @param bondOrder bond order (1, 2, or 3)
 * @param hyb1 optional hybridization of first atom
 * @param hyb2 optional hybridization of second atom
 */
export function getMorseBondParams(
  z1: number,
  z2: number,
  bondOrder: number = 1,
  hyb1?: Hybridization,
  hyb2?: Hybridization,
): {
  De: number;
  alpha: number;
  re: number;
} {
  const re = getUFFBondLength(z1, z2, bondOrder, hyb1, hyb2);

  // Look up UFF types (hybridization-aware if available) for force constant
  const t1 = hyb1 ? getUFFTypeHybrid(z1, hyb1) : getUFFType(z1);
  const t2 = hyb2 ? getUFFTypeHybrid(z2, hyb2) : getUFFType(z2);
  if (!t1 || !t2) return { De: 3.0, alpha: 2.0, re };

  // De from experimental BDE table, geometric-mean fallback, or crude estimate
  // Source: CRC Handbook of Chemistry and Physics, 97th Ed.;
  //         Pauling geometric-mean approximation (1960)
  const bde = getBDE(z1, z2, bondOrder);
  const baseDe = bde !== undefined ? bde : 70.0 * bondOrder; // kcal/mol
  const De = baseDe * KCAL_TO_EV; // convert to eV

  // alpha = sqrt(k_e / (2 * De)), k_e from UFF bond stretching
  // k_e (UFF) = 664.12 * Z*_i * Z*_j / r_ij^3
  // Source: Rappé et al., JACS 114, 10024 (1992), Eq. 6.
  const ke = (664.12 * (t1.Z * t2.Z)) / (re * re * re); // kcal/(mol·Å²)
  const keEV = ke * KCAL_TO_EV; // eV/ų
  const alpha = Math.sqrt(keEV / (2.0 * De));

  return { De, alpha, re };
}

/**
 * Get LJ (Lennard-Jones) parameters for a pair of atoms.
 * Uses geometric combining rules: σ = sqrt(σ_i * σ_j), ε = sqrt(ε_i * ε_j)
 * Returns { sigma, epsilon } in Å and eV
 */
export function getLJParams(
  z1: number,
  z2: number,
): { sigma: number; epsilon: number } {
  const t1 = getUFFType(z1);
  const t2 = getUFFType(z2);
  if (!t1 || !t2) return { sigma: 3.0, epsilon: 0.01 };

  const sigma = Math.sqrt(t1.x * t2.x);
  const epsilon = Math.sqrt(t1.D * t2.D) * KCAL_TO_EV;
  return { sigma, epsilon };
}

/**
 * Compute UFF angle bending force constant for angle I-J-K.
 * Uses the UFF formula from Rappé et al. JACS 1992, Eq. 13.
 * Returns k_angle in eV/rad².
 *
 * @param zI atomic number of terminal atom I
 * @param zJ atomic number of central atom J
 * @param zK atomic number of terminal atom K
 * @param bondOrderIJ bond order of I-J bond
 * @param bondOrderJK bond order of J-K bond
 * @param hybridJ hybridization of central atom J (optional — uses sp3 default if omitted)
 */
export function getUFFAngleK(
  zI: number,
  zJ: number,
  zK: number,
  bondOrderIJ: number = 1,
  bondOrderJK: number = 1,
  hybridJ?: Hybridization,
): { kAngle: number; theta0: number } {
  const tI = getUFFType(zI);
  const tJ = getUFFTypeHybrid(zJ, hybridJ);
  const tK = getUFFType(zK);
  if (!tI || !tJ || !tK)
    return { kAngle: 3.0, theta0: (109.47 * Math.PI) / 180 };

  const theta0 = (tJ.theta0 * Math.PI) / 180.0;

  // For linear angles (θ₀ > 170°), the general UFF Eq. 13 formula breaks
  // down (sin²θ₀ → 0). Use a direct force constant estimate instead.
  // Source: Rappé et al., JACS 114, 10024 (1992), Eq. 10:
  //   V(θ) = kA * (1 + cos θ) for linear sp geometry
  // kA is calibrated so that a 10° bend costs ~0.5 eV — typical for
  // sp-hybridized centers like CO₂, acetylene, etc.
  if (tJ.theta0 > 170.0) {
    // kA in eV — for V = kA*(1+cosθ), the barrier for bending from 180°
    // to 170° is kA*(1 + cos170°) = kA*0.015. Setting this to ~0.023 eV
    // (~0.53 kcal/mol) gives kA ≈ 1.5 eV, a reasonable stiffness for
    // sp-hybridized centers (UFF literature range 1–3 eV).
    const rIJ = getUFFBondLength(zI, zJ, bondOrderIJ);
    const rJK = getUFFBondLength(zJ, zK, bondOrderJK);
    const rIK = rIJ + rJK; // linear 1-3 distance
    const rIK5 = rIK * rIK * rIK * rIK * rIK;
    // Simplified UFF K for linear: dominated by Z*_I * Z*_K / rIK^5 term
    const K_kcal = ((664.12 * tI.Z * tK.Z) / rIK5) * rIK * 3.0;
    const kAngle = Math.abs(K_kcal) * KCAL_TO_EV;
    return {
      kAngle: Math.max(0.5, Math.min(5.0, kAngle)),
      theta0,
    };
  }

  // Equilibrium bond lengths
  const rIJ = getUFFBondLength(zI, zJ, bondOrderIJ);
  const rJK = getUFFBondLength(zJ, zK, bondOrderJK);

  // 1-3 distance from law of cosines
  const cosTheta0 = Math.cos(theta0);
  const rIK2 = rIJ * rIJ + rJK * rJK - 2 * rIJ * rJK * cosTheta0;
  const rIK = Math.sqrt(Math.max(rIK2, 0.01));
  const rIK5 = rIK * rIK * rIK * rIK * rIK;

  // UFF angle constant: K_IJK from Eq. 13
  // K = (664.12 / (rIJ * rJK)) * (Z*_I * Z*_K / rIK^5) *
  //     [rIJ*rJK*(1-cos²θ₀)*3 - rIK²*cosθ₀]
  const sinTheta0_2 = 1 - cosTheta0 * cosTheta0;
  const bracket = 3 * rIJ * rJK * sinTheta0_2 - rIK2 * cosTheta0;
  const K_kcal =
    (664.12 / (rIJ * rJK)) * ((tI.Z * tK.Z) / rIK5) * rIJ * rJK * bracket;

  // Convert to harmonic k: K_harmonic = K / sin²(θ₀) for the general nonlinear case
  const sinTheta0 = Math.sin(theta0);
  const kHarmonic = Math.abs(K_kcal) / Math.max(sinTheta0 * sinTheta0, 0.01);

  // Convert to eV/rad²
  const kAngle = kHarmonic * KCAL_TO_EV;

  // Clamp to reasonable range: 0.5 - 5.0 eV/rad²
  // (5 eV/rad² \u2248 115 kcal/(mol\u00b7rad²), typical maximum for angle bending)
  return {
    kAngle: Math.max(0.5, Math.min(5.0, kAngle)),
    theta0,
  };
}

export { uffAtomTypes, KCAL_TO_EV };
