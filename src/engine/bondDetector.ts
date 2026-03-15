// ==============================================================
// Bond detection and dynamic bond formation/breaking
// ==============================================================

import type { Bond, BondType, Hybridization } from '../data/types';
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
      const baseTol = isExisting ? breakTolerance : formTolerance;
      // Widen tolerance for pairs involving heavy atoms or transition metals,
      // whose covalent radii have more uncertainty (variable oxidation state,
      // coordination geometry). Source: Cordero et al., Dalton Trans. 2008,
      // Table 2 — covalent radii uncertainties for transition metals are
      // typically ±0.04–0.11 Å vs ±0.01–0.03 Å for light main-group elements.
      const tolScale = pairToleranceScale(
        elI.category,
        elJ.category,
        atomicNumbers[i],
        atomicNumbers[j],
      );
      const tol = baseTol * tolScale;
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
        // Ionic bonds are always order 1 — bond order estimation based on
        // distance ratios is only meaningful for covalent bonds.
        // Without this, e.g. NaCl (ratio 2.36/2.68 = 0.88) falls in the
        // double-bond range, causing slotsNeeded=2 > Na maxValence=1.
        const order =
          type === 'ionic' ? 1 : estimateBondOrder(dist, singleDist);

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
 * Compute a tolerance scale factor for a pair of atoms.
 *
 * Heavy atoms and transition metals have larger covalent-radius uncertainties
 * than light main-group elements (Cordero et al., Dalton Trans. 2008,
 * Table 2), so we widen the detection window to reduce flickering.
 *
 * Scale factors (multiplicative on top of base formTolerance/breakTolerance):
 *   1.00 — both atoms are light main-group (Z ≤ 36, non-metal categories)
 *   1.05 — one atom is a transition metal or heavy (Z > 36)
 *   1.10 — both atoms are transition metals or heavy (Z > 36)
 *
 * These are conservative — they add at most ≈0.15 Å to the detection
 * threshold for a typical heavy-atom pair (sum of cov radii ≈ 2.5 Å).
 */
function pairToleranceScale(
  catA: string,
  catB: string,
  zA: number,
  zB: number,
): number {
  const aIsHeavy = isMetallic(catA) || zA > 36;
  const bIsHeavy = isMetallic(catB) || zB > 36;
  if (aIsHeavy && bIsHeavy) return 1.1;
  if (aIsHeavy || bIsHeavy) return 1.05;
  return 1.0;
}

/**
 * Rough bond order from distance:
 * single bond ≈ sum of covalent radii
 * double bond ≈ 0.87 × single
 * triple bond ≈ 0.78 × single
 *
 * Thresholds chosen so that:
 * - C≡C (1.20 Å / 1.52 Å = 0.789) → triple  (< 0.80 ✗, but ratio=0.789 ✓)
 * - N≡N (1.10 Å / 1.40 Å = 0.786) → triple  ✓
 * - C=O in CO₂ (1.16 Å / 1.42 Å = 0.817) → double  ✓
 * - C=C (1.34 Å / 1.52 Å = 0.882) → double  ✓
 *
 * Previous threshold of 0.82 misclassified CO₂'s C=O as triple,
 * causing valence overflow (3+3=6 > C maxValence=4).
 * Source for typical bond lengths: CRC Handbook, 97th Ed.
 */
function estimateBondOrder(dist: number, singleDist: number): number {
  const ratio = dist / singleDist;
  if (ratio < 0.8) return 3;
  if (ratio < 0.92) return 2;
  return 1;
}

/**
 * Detect hydrogen bonds with hysteresis to prevent flickering during dynamics.
 *
 * Criteria: D-H···A where D and A are N, O, or F
 *
 * Formation thresholds (new H-bonds):
 *   H···A distance < 2.5 Å, D-H···A angle > 120°
 *
 * Break thresholds (existing H-bonds get looser criteria):
 *   H···A distance < 3.0 Å, D-H···A angle > 100°
 *
 * Hysteresis prevents rapid on/off switching when geometry fluctuates
 * near the threshold during molecular dynamics.
 *
 * Source: Jeffrey, "An Introduction to Hydrogen Bonding" (1997).
 * Strong H-bonds: H···A < 2.5 Å; weak H-bonds: H···A < 3.2 Å.
 * IUPAC recommends D···A < 3.5 Å. We use H···A < 2.5/3.0 Å (form/break)
 * and angle > 120°/100° (form/break) for a conservative hysteresis band.
 */

// H-bond formation thresholds (tighter — must be clearly an H-bond to form)
const HBOND_FORM_DIST = 2.5; // Å, H···A distance
const HBOND_FORM_ANGLE = 120; // degrees, D-H···A angle minimum

// H-bond break thresholds (looser — existing H-bond persists in wider range)
const HBOND_BREAK_DIST = 3.0; // Å, H···A distance
const HBOND_BREAK_ANGLE = 100; // degrees, D-H···A angle minimum

// Minimum H···A distance to avoid nonsensical detections
const HBOND_MIN_DIST = 0.5; // Å

export function detectHydrogenBonds(
  positions: Float64Array,
  atomicNumbers: Int32Array | number[],
  existingBonds: Bond[],
  previousHBonds: Bond[] = [],
): Bond[] {
  const N = atomicNumbers.length;
  const hBonds: Bond[] = [];
  const hbAcceptors = new Set([7, 8, 9]); // N, O, F

  // Build set of existing H-bond pairs for hysteresis lookup
  const existingHBondPairs = new Set<string>();
  for (const b of previousHBonds) {
    existingHBondPairs.add(
      `${Math.min(b.atomA, b.atomB)}-${Math.max(b.atomA, b.atomB)}`,
    );
  }

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

      // Check if this H-bond already existed (for hysteresis)
      const pairKey = `${Math.min(h, a)}-${Math.max(h, a)}`;
      const isExisting = existingHBondPairs.has(pairKey);

      // Apply hysteresis: existing H-bonds get looser break thresholds
      const maxDist = isExisting ? HBOND_BREAK_DIST : HBOND_FORM_DIST;
      const minAngle = isExisting ? HBOND_BREAK_ANGLE : HBOND_FORM_ANGLE;

      // Distance H···A
      const dx = positions[a * 3] - positions[h * 3];
      const dy = positions[a * 3 + 1] - positions[h * 3 + 1];
      const dz = positions[a * 3 + 2] - positions[h * 3 + 2];
      const distHA = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distHA > maxDist || distHA < HBOND_MIN_DIST) continue;

      // Angle D-H···A
      const dhX = positions[h * 3] - positions[donor * 3];
      const dhY = positions[h * 3 + 1] - positions[donor * 3 + 1];
      const dhZ = positions[h * 3 + 2] - positions[donor * 3 + 2];
      const dhLen = Math.sqrt(dhX * dhX + dhY * dhY + dhZ * dhZ);

      if (dhLen < 1e-10) continue;

      const cosAngle = (dhX * dx + dhY * dy + dhZ * dz) / (dhLen * distHA);
      const angle =
        (Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180) / Math.PI;

      if (angle > minAngle) {
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

/**
 * Build dihedral (torsion) list from bond topology.
 * For every bond j-k, enumerate all neighbors i of j (i≠k) and
 * all neighbors l of k (l≠j) to form i-j-k-l quadruplets.
 * Duplicates are avoided by requiring j < k (canonical ordering).
 * Returns array of [i, j, k, l] index tuples.
 */
export function buildDihedralList(
  bonds: Bond[],
  nAtoms: number,
): Array<[number, number, number, number]> {
  // Build adjacency: for each atom, list of covalent neighbors
  const neighbors: number[][] = Array.from({ length: nAtoms }, () => []);
  for (const bond of bonds) {
    if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;
    neighbors[bond.atomA].push(bond.atomB);
    neighbors[bond.atomB].push(bond.atomA);
  }

  const dihedrals: Array<[number, number, number, number]> = [];

  for (const bond of bonds) {
    if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;

    // Canonical ordering: j < k to avoid generating each dihedral twice
    const j = Math.min(bond.atomA, bond.atomB);
    const k = Math.max(bond.atomA, bond.atomB);

    // Enumerate all i bonded to j (i ≠ k)
    for (const i of neighbors[j]) {
      if (i === k) continue;
      // Enumerate all l bonded to k (l ≠ j, l ≠ i to skip 3-membered rings)
      for (const l of neighbors[k]) {
        if (l === j || l === i) continue;
        dihedrals.push([i, j, k, l]);
      }
    }
  }

  return dihedrals;
}

/**
 * Build list of inversion (out-of-plane) centers from bond topology.
 *
 * An inversion center is an atom j with 3 or more covalent neighbors
 * that has sp2 or sp3 hybridization (or is a group-15 element).
 * For each center j with N_neighbors ≥ 3, we enumerate all subsets
 * of 3 neighbors {i, k, l} and produce 3 OOP terms per subset:
 *   (i, j, k, l) — i is out-of-plane, j-k-l define the plane
 *   (k, j, i, l) — k is out-of-plane, j-i-l define the plane
 *   (l, j, i, k) — l is out-of-plane, j-i-k define the plane
 *
 * Returns array of [oopAtom, center, planeAtom1, planeAtom2] tuples
 * along with the number of OOP terms per center (for normalization).
 *
 * @param bonds         detected bonds
 * @param nAtoms        total number of atoms
 * @param atomicNumbers array of atomic numbers
 * @param hybridizations array of hybridization states
 * @returns { inversions, termsPerCenter }
 */
export function buildInversionList(
  bonds: Bond[],
  nAtoms: number,
  atomicNumbers: Int32Array | number[],
  hybridizations: Hybridization[],
): {
  inversions: Array<[number, number, number, number]>;
  termsPerCenter: Map<number, number>;
} {
  // Build adjacency: for each atom, list of covalent neighbors
  const neighbors: number[][] = Array.from({ length: nAtoms }, () => []);
  for (const bond of bonds) {
    if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;
    neighbors[bond.atomA].push(bond.atomB);
    neighbors[bond.atomB].push(bond.atomA);
  }

  const inversions: Array<[number, number, number, number]> = [];
  const termsPerCenter = new Map<number, number>();

  // Eligible center atoms: C/N/O sp2 or sp3, or group 15 (P/As/Sb/Bi)
  const group15 = new Set([15, 33, 51, 83]);

  for (let j = 0; j < nAtoms; j++) {
    const nbrs = neighbors[j];
    if (nbrs.length < 3) continue;

    const z = atomicNumbers[j];
    const hyb = hybridizations[j];

    // Check eligibility
    const isEligible =
      (z === 6 && (hyb === 'sp2' || hyb === 'sp3')) || // Carbon
      (z === 7 && (hyb === 'sp2' || hyb === 'sp3')) || // Nitrogen
      (z === 8 && hyb === 'sp2') || // Oxygen
      group15.has(z); // Group 15

    if (!isEligible) continue;

    // For each combination of 3 neighbors from the N_neighbors,
    // generate 3 OOP terms (one per choice of out-of-plane atom)
    let termCount = 0;
    for (let a = 0; a < nbrs.length; a++) {
      for (let b = a + 1; b < nbrs.length; b++) {
        for (let c = b + 1; c < nbrs.length; c++) {
          const ni = nbrs[a],
            nk = nbrs[b],
            nl = nbrs[c];
          // 3 permutations: each neighbor takes a turn as OOP atom
          inversions.push([ni, j, nk, nl]); // ni out of plane j-nk-nl
          inversions.push([nk, j, ni, nl]); // nk out of plane j-ni-nl
          inversions.push([nl, j, ni, nk]); // nl out of plane j-ni-nk
          termCount += 3;
        }
      }
    }
    termsPerCenter.set(j, termCount);
  }

  return { inversions, termsPerCenter };
}
