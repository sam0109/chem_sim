// ==============================================================
// Hybridization detection from molecular connectivity
//
// Determines sp, sp2, sp3 hybridization for each atom based on
// its covalent bond count and bond orders.
//
// Engine code — no UI/renderer/store imports allowed.
// ==============================================================

import type { Bond, Hybridization } from '../data/types';

/**
 * Detect hybridization state of each atom from bond connectivity.
 *
 * Rules (following standard VSEPR / organic chemistry):
 * - H (Z=1): always 'none'
 * - Noble gases (Z=2,10,18,36): 'none'
 * - 4+ single bonds or 4 electron domains → sp3
 * - 3 bonds / 1 double + rest single / 3 electron domains → sp2
 * - 2 bonds with triple or 2 doubles / 2 electron domains → sp
 * - Fallback: sp3 (safest default for Gasteiger parameter lookup)
 *
 * @param atomicNumbers Array or typed array of atomic numbers
 * @param bonds Bond list (only covalent bonds are considered)
 * @param nAtoms Total number of atoms
 * @returns Array of Hybridization values, one per atom
 */
export function detectHybridization(
  atomicNumbers: ArrayLike<number>,
  bonds: Bond[],
  nAtoms: number,
): Hybridization[] {
  // Count bonds and track highest bond order per atom
  const bondCount = new Int32Array(nAtoms);
  const maxBondOrder = new Float64Array(nAtoms);
  const totalBondOrder = new Float64Array(nAtoms);

  for (const bond of bonds) {
    // Only consider covalent bonds for hybridization
    if (bond.type !== 'covalent') continue;

    bondCount[bond.atomA]++;
    bondCount[bond.atomB]++;

    const order = bond.order;
    totalBondOrder[bond.atomA] += order;
    totalBondOrder[bond.atomB] += order;

    if (order > maxBondOrder[bond.atomA]) maxBondOrder[bond.atomA] = order;
    if (order > maxBondOrder[bond.atomB]) maxBondOrder[bond.atomB] = order;
  }

  const result: Hybridization[] = new Array(nAtoms);

  for (let i = 0; i < nAtoms; i++) {
    const Z = atomicNumbers[i];

    // Hydrogen — always 'none'
    if (Z === 1) {
      result[i] = 'none';
      continue;
    }

    // Noble gases — 'none'
    if (Z === 2 || Z === 10 || Z === 18 || Z === 36) {
      result[i] = 'none';
      continue;
    }

    const nBonds = bondCount[i];
    const maxOrder = maxBondOrder[i];

    // Unbonded atoms — default sp3
    if (nBonds === 0) {
      result[i] = 'sp3';
      continue;
    }

    // sp: 2 bonds with a triple bond, or 2 double bonds (e.g., CO2 carbon)
    if (maxOrder >= 3 || (nBonds === 2 && totalBondOrder[i] >= 4)) {
      result[i] = 'sp';
      continue;
    }

    // sp2: double bond present with ≤ 3 bonds (e.g., ethylene C, carbonyl C/O).
    // Note: 3 single bonds without a double bond → sp3 (e.g., NH₃).
    if (maxOrder >= 2) {
      result[i] = 'sp2';
      continue;
    }

    // sp3: 4 or more single bonds, or default
    result[i] = 'sp3';
  }

  return result;
}
