// ==============================================================
// Bond detection and dynamic bond formation/breaking
// ==============================================================

import type { Bond, BondType } from '../data/types';
import elements from '../data/elements';

/**
 * Detect bonds between atoms based on covalent radii with tolerance.
 * Two atoms are bonded if: dist(A,B) < (covR_A + covR_B) * tolerance
 *
 * Also classifies bond type based on electronegativity difference:
 *   |ΔEN| > 1.7 → ionic
 *   otherwise → covalent
 *
 * @param positions      flat position array
 * @param atomicNumbers  array of atomic numbers
 * @param tolerance      radius tolerance factor (typically 1.2)
 * @returns detected bonds
 */
/**
 * Detect bonds with hysteresis to prevent flickering during dynamics.
 *
 * - New bonds form at: dist < (covR_A + covR_B) * formTolerance
 * - Existing bonds break at: dist > (covR_A + covR_B) * breakTolerance
 * - breakTolerance > formTolerance prevents rapid on/off switching
 *
 * Uses valence constraints: atoms cannot exceed their max valence.
 * Bonds are assigned greedily by shortest distance first.
 */
export function detectBonds(
  positions: Float64Array,
  atomicNumbers: Int32Array | number[],
  formTolerance: number = 1.2,
  existingBonds: Bond[] = [],
  breakTolerance: number = 1.5,
): Bond[] {
  const N = atomicNumbers.length;

  // Build set of existing bonded pairs for hysteresis
  const existingPairs = new Set<string>();
  for (const b of existingBonds) {
    existingPairs.add(
      Math.min(b.atomA, b.atomB) + '-' + Math.max(b.atomA, b.atomB),
    );
  }

  // Collect all candidate bonds
  const candidates: Array<{
    i: number;
    j: number;
    dist: number;
    type: BondType;
    order: number;
  }> = [];

  for (let i = 0; i < N; i++) {
    const elI = elements[atomicNumbers[i]];
    if (!elI) continue;

    for (let j = i + 1; j < N; j++) {
      const elJ = elements[atomicNumbers[j]];
      if (!elJ) continue;

      const dx = positions[j * 3] - positions[i * 3];
      const dy = positions[j * 3 + 1] - positions[i * 3 + 1];
      const dz = positions[j * 3 + 2] - positions[i * 3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Hysteresis: existing bonds get a wider tolerance before breaking
      const pairKey = Math.min(i, j) + '-' + Math.max(i, j);
      const isExisting = existingPairs.has(pairKey);
      const tol = isExisting ? breakTolerance : formTolerance;
      const maxBondDist = (elI.covalentRadius + elJ.covalentRadius) * tol;

      if (dist < maxBondDist && dist > 0.4) {
        const enDiff = Math.abs(elI.electronegativity - elJ.electronegativity);
        let type: BondType;
        if (elI.electronegativity === 0 || elJ.electronegativity === 0) {
          continue;
        } else if (enDiff > 1.7) {
          type = 'ionic';
        } else if (isMetallic(elI.category) && isMetallic(elJ.category)) {
          type = 'metallic';
        } else {
          type = 'covalent';
        }

        const singleDist = elI.covalentRadius + elJ.covalentRadius;
        const order = estimateBondOrder(dist, singleDist);

        candidates.push({ i, j, dist, type, order });
      }
    }
  }

  // Sort: existing bonds first (to preserve them), then by distance
  candidates.sort((a, b) => {
    const aExisting = existingPairs.has(
      Math.min(a.i, a.j) + '-' + Math.max(a.i, a.j),
    )
      ? 0
      : 1;
    const bExisting = existingPairs.has(
      Math.min(b.i, b.j) + '-' + Math.max(b.i, b.j),
    )
      ? 0
      : 1;
    if (aExisting !== bExisting) return aExisting - bExisting;
    return a.dist - b.dist;
  });

  // Assign bonds respecting valence limits
  const bondCount = new Int32Array(N);
  const bonds: Bond[] = [];

  for (const c of candidates) {
    const elI = elements[atomicNumbers[c.i]];
    const elJ = elements[atomicNumbers[c.j]];
    if (!elI || !elJ) continue;

    const slotsNeeded = Math.round(c.order);
    if (bondCount[c.i] + slotsNeeded > elI.maxValence) continue;
    if (bondCount[c.j] + slotsNeeded > elJ.maxValence) continue;

    bonds.push({ atomA: c.i, atomB: c.j, order: c.order, type: c.type });
    bondCount[c.i] += slotsNeeded;
    bondCount[c.j] += slotsNeeded;
  }

  return bonds;
}

function isMetallic(category: string): boolean {
  return (
    category === 'transition-metal' ||
    category === 'alkali-metal' ||
    category === 'alkaline-earth-metal' ||
    category === 'post-transition-metal' ||
    category === 'lanthanide' ||
    category === 'actinide'
  );
}

/**
 * Rough bond order from distance:
 * single bond ≈ sum of covalent radii
 * double bond ≈ 0.87 × single
 * triple bond ≈ 0.78 × single
 */
function estimateBondOrder(dist: number, singleDist: number): number {
  const ratio = dist / singleDist;
  if (ratio < 0.82) return 3;
  if (ratio < 0.92) return 2;
  return 1;
}

/**
 * Detect hydrogen bonds.
 * Criteria: D-H···A where D and A are N, O, or F
 * Distance H···A < 2.5 Å, angle D-H···A > 120°
 */
export function detectHydrogenBonds(
  positions: Float64Array,
  atomicNumbers: Int32Array | number[],
  existingBonds: Bond[],
): Bond[] {
  const N = atomicNumbers.length;
  const hBonds: Bond[] = [];
  const hbAcceptors = new Set([7, 8, 9]); // N, O, F

  // Find hydrogen atoms bonded to N, O, F
  const donorHydrogens: Array<{ h: number; donor: number }> = [];
  for (const bond of existingBonds) {
    if (
      atomicNumbers[bond.atomA] === 1 &&
      hbAcceptors.has(atomicNumbers[bond.atomB])
    ) {
      donorHydrogens.push({ h: bond.atomA, donor: bond.atomB });
    } else if (
      atomicNumbers[bond.atomB] === 1 &&
      hbAcceptors.has(atomicNumbers[bond.atomA])
    ) {
      donorHydrogens.push({ h: bond.atomB, donor: bond.atomA });
    }
  }

  for (const { h, donor } of donorHydrogens) {
    for (let a = 0; a < N; a++) {
      if (a === h || a === donor) continue;
      if (!hbAcceptors.has(atomicNumbers[a])) continue;

      // Distance H···A
      const dx = positions[a * 3] - positions[h * 3];
      const dy = positions[a * 3 + 1] - positions[h * 3 + 1];
      const dz = positions[a * 3 + 2] - positions[h * 3 + 2];
      const distHA = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distHA > 2.5 || distHA < 0.5) continue;

      // Angle D-H···A
      const dhX = positions[h * 3] - positions[donor * 3];
      const dhY = positions[h * 3 + 1] - positions[donor * 3 + 1];
      const dhZ = positions[h * 3 + 2] - positions[donor * 3 + 2];
      const dhLen = Math.sqrt(dhX * dhX + dhY * dhY + dhZ * dhZ);

      if (dhLen < 1e-10) continue;

      const cosAngle = (dhX * dx + dhY * dy + dhZ * dz) / (dhLen * distHA);
      const angle =
        (Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180) / Math.PI;

      if (angle > 120) {
        hBonds.push({
          atomA: h,
          atomB: a,
          order: 0.5,
          type: 'hydrogen',
        });
      }
    }
  }

  return hBonds;
}

/**
 * Build angle list from bond topology.
 * For every pair of bonds sharing a central atom, create an angle entry.
 * Returns array of [terminal1, central, terminal2] index triples.
 */
export function buildAngleList(
  bonds: Bond[],
  nAtoms: number,
): Array<[number, number, number]> {
  // Build adjacency: for each atom, list of bonded neighbors
  const neighbors: number[][] = Array.from({ length: nAtoms }, () => []);
  for (const bond of bonds) {
    if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;
    neighbors[bond.atomA].push(bond.atomB);
    neighbors[bond.atomB].push(bond.atomA);
  }

  const angles: Array<[number, number, number]> = [];
  for (let j = 0; j < nAtoms; j++) {
    const nbrs = neighbors[j];
    for (let a = 0; a < nbrs.length; a++) {
      for (let b = a + 1; b < nbrs.length; b++) {
        angles.push([nbrs[a], j, nbrs[b]]);
      }
    }
  }

  return angles;
}
