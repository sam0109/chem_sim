// ==============================================================
// Gasteiger-Marsili iterative partial charge equilibration
//
// Reference: Gasteiger & Marsili (1980), "Iterative Equalization
// of Orbital Electronegativity — A Rapid Access to Atomic Charges",
// Tetrahedron 36, 3219–3228.
//
// Engine code — no UI/renderer/store imports allowed.
// ==============================================================

import type { Bond, Hybridization } from '../data/types';
import { getGasteigerParams } from '../data/gasteiger';
import type { GasteigerParams } from '../data/gasteiger';

/** Number of Gasteiger iterations. 6 is standard; convergence is
 *  guaranteed by the geometric damping.
 *  Source: Gasteiger & Marsili (1980), Section 3. */
const N_ITERATIONS = 6;

/** Initial damping factor. Multiplied by DAMP_SCALE each iteration.
 *  Source: Gasteiger & Marsili (1980), eq. 7 — the damping ensures
 *  convergence by reducing charge transfer geometrically. */
const DAMP_INIT = 0.5;

/** Damping decay per iteration. damp *= DAMP_SCALE after each round.
 *  Source: Gasteiger & Marsili (1980), eq. 7. */
const DAMP_SCALE = 0.5;

/**
 * Compute Gasteiger partial charges for a molecular system.
 *
 * The algorithm iteratively equalizes orbital electronegativity
 * along bonds: atoms with higher electronegativity pull electron
 * density from neighbors, gaining negative charge.
 *
 * @param atomicNumbers Atomic numbers (length nAtoms)
 * @param bonds         Bond list (covalent bonds only are used)
 * @param nAtoms        Number of atoms
 * @param hybridizations Hybridization per atom
 * @returns Float64Array of partial charges (elementary charge units)
 */
export function computeGasteigerCharges(
  atomicNumbers: ArrayLike<number>,
  bonds: Bond[],
  nAtoms: number,
  hybridizations: Hybridization[],
): Float64Array {
  const charges = new Float64Array(nAtoms); // initialized to 0

  // Look up parameters for each atom
  const params: (GasteigerParams | null)[] = new Array(nAtoms);
  for (let i = 0; i < nAtoms; i++) {
    params[i] = getGasteigerParams(atomicNumbers[i], hybridizations[i]);
  }

  // Build adjacency list from covalent bonds only
  const neighbors: number[][] = new Array(nAtoms);
  for (let i = 0; i < nAtoms; i++) neighbors[i] = [];

  for (const bond of bonds) {
    if (bond.type !== 'covalent') continue;
    neighbors[bond.atomA].push(bond.atomB);
    neighbors[bond.atomB].push(bond.atomA);
  }

  // Precompute ionization parameter for each atom:
  // ionX = a + b + c = χ(q=1) — the electronegativity when charge = +1
  // This serves as the denominator normalization.
  // Source: RDKit GasteigerCharges.cpp, following Gasteiger & Marsili (1980).
  const ionX = new Float64Array(nAtoms);
  for (let i = 0; i < nAtoms; i++) {
    const p = params[i];
    if (p) {
      ionX[i] = p.a + p.b + p.c;
    }
  }

  // Electronegativity workspace
  const chi = new Float64Array(nAtoms);

  let damp = DAMP_INIT;

  for (let iter = 0; iter < N_ITERATIONS; iter++) {
    // Compute current electronegativity for each atom: χ(q) = a + bq + cq²
    for (let i = 0; i < nAtoms; i++) {
      const p = params[i];
      if (p) {
        const q = charges[i];
        chi[i] = p.a + q * (p.b + q * p.c);
      } else {
        chi[i] = 0;
      }
    }

    // Charge transfer along each bond
    for (let i = 0; i < nAtoms; i++) {
      const pi = params[i];
      if (!pi) continue; // skip atoms without parameters

      let dq = 0;
      for (const j of neighbors[i]) {
        const pj = params[j];
        if (!pj) continue; // skip neighbors without parameters

        // Electronegativity difference: positive means j is more
        // electronegative → charge flows from i to j
        const dx = chi[j] - chi[i];

        // Denominator: ionization potential of the atom losing charge.
        // If dx > 0, atom i loses charge → use ionX[i].
        // If dx < 0, atom j loses charge → use ionX[j].
        // This normalization prevents over-transfer for electropositive atoms.
        // Source: Gasteiger & Marsili (1980), eq. 5-6.
        const denom = dx > 0 ? ionX[i] : ionX[j];

        // Guard against zero denominator (shouldn't happen with valid params)
        if (Math.abs(denom) < 1e-10) continue;

        dq += dx / denom;
      }

      charges[i] += damp * dq;
    }

    damp *= DAMP_SCALE;
  }

  return charges;
}
