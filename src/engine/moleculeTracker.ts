// ==============================================================
// Molecule Tracker — union-find decomposition of the bond graph
//
// Identifies connected components (molecules) from the bond
// topology using Disjoint Set Union with path compression and
// union by rank. Computes per-molecule properties: center of
// mass, total charge, and dipole moment.
//
// Reference: Tarjan, R. E. (1975). "Efficiency of a Good But
// Not Linear Set Union Algorithm". JACM 22(2), 215-225.
// ==============================================================

import type { Bond, MoleculeInfo } from '../data/types';
import type { Vector3Tuple } from 'three';

// ---- Disjoint Set Union (Union-Find) ----

/** Parent array for union-find. parent[i] points to i's parent. */
let parent: Int32Array = new Int32Array(0);
/** Rank array for union by rank heuristic. */
let rank: Int32Array = new Int32Array(0);

/**
 * Initialize union-find for n elements (each in its own set).
 */
function ufInit(n: number): void {
  if (parent.length < n) {
    parent = new Int32Array(n);
    rank = new Int32Array(n);
  }
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    rank[i] = 0;
  }
}

/**
 * Find the root of element x with path compression.
 * Amortized O(α(n)) per operation.
 */
function ufFind(x: number): number {
  while (parent[x] !== x) {
    // Path halving (Tarjan & van Leeuwen, 1984)
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}

/**
 * Union the sets containing x and y. Uses union by rank.
 */
function ufUnion(x: number, y: number): void {
  const rx = ufFind(x);
  const ry = ufFind(y);
  if (rx === ry) return;

  if (rank[rx] < rank[ry]) {
    parent[rx] = ry;
  } else if (rank[rx] > rank[ry]) {
    parent[ry] = rx;
  } else {
    parent[ry] = rx;
    rank[rx]++;
  }
}

/**
 * Find connected components (molecules) from the bond graph.
 *
 * Only covalent, ionic, and metallic bonds define molecule
 * connectivity. Hydrogen bonds and van der Waals interactions
 * are inter-molecular and do not merge molecules.
 *
 * @param bonds    Current bond list
 * @param nAtoms   Total number of atoms
 * @returns Int32Array of molecule IDs per atom (contiguous 0-indexed)
 */
export function findMolecules(
  bonds: ReadonlyArray<Bond>,
  nAtoms: number,
): Int32Array {
  ufInit(nAtoms);

  // Union atoms connected by intra-molecular bonds
  for (const bond of bonds) {
    if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;
    ufUnion(bond.atomA, bond.atomB);
  }

  // Map roots to contiguous molecule IDs
  const moleculeIds = new Int32Array(nAtoms);
  const rootToId = new Map<number, number>();
  let nextId = 0;

  for (let i = 0; i < nAtoms; i++) {
    const root = ufFind(i);
    let molId = rootToId.get(root);
    if (molId === undefined) {
      molId = nextId++;
      rootToId.set(root, molId);
    }
    moleculeIds[i] = molId;
  }

  return moleculeIds;
}

/**
 * Compute per-molecule properties from atom data.
 *
 * @param moleculeIds    Molecule ID per atom (from findMolecules)
 * @param positions      Flat position array [x0,y0,z0,x1,y1,z1,...]
 * @param charges        Charge per atom
 * @param atomicNumbers  Atomic number per atom
 * @param masses         Mass per atom in amu
 * @param nAtoms         Total number of atoms
 * @returns Array of MoleculeInfo, one per molecule
 */
export function computeMoleculeInfo(
  moleculeIds: Int32Array,
  positions: Float64Array,
  charges: Float64Array,
  masses: Float64Array,
  nAtoms: number,
): MoleculeInfo[] {
  // Determine number of molecules
  let nMolecules = 0;
  for (let i = 0; i < nAtoms; i++) {
    if (moleculeIds[i] >= nMolecules) {
      nMolecules = moleculeIds[i] + 1;
    }
  }

  if (nMolecules === 0) return [];

  // Accumulate per-molecule data
  const totalMass = new Float64Array(nMolecules);
  const comX = new Float64Array(nMolecules);
  const comY = new Float64Array(nMolecules);
  const comZ = new Float64Array(nMolecules);
  const totalCharge = new Float64Array(nMolecules);
  const atomIndices: number[][] = Array.from({ length: nMolecules }, () => []);

  for (let i = 0; i < nAtoms; i++) {
    const mol = moleculeIds[i];
    const m = masses[i];
    const i3 = i * 3;

    atomIndices[mol].push(i);
    totalMass[mol] += m;
    comX[mol] += m * positions[i3];
    comY[mol] += m * positions[i3 + 1];
    comZ[mol] += m * positions[i3 + 2];
    totalCharge[mol] += charges[i];
  }

  // Finalize center of mass and compute dipole moment
  const molecules: MoleculeInfo[] = new Array(nMolecules);

  for (let mol = 0; mol < nMolecules; mol++) {
    const M = totalMass[mol];
    const cx = M > 0 ? comX[mol] / M : 0;
    const cy = M > 0 ? comY[mol] / M : 0;
    const cz = M > 0 ? comZ[mol] / M : 0;

    // Dipole moment: μ = Σ q_i * (r_i - r_com)
    // Units: e·Å (elementary charge × angstrom)
    let dx = 0;
    let dy = 0;
    let dz = 0;
    for (const i of atomIndices[mol]) {
      const q = charges[i];
      const i3 = i * 3;
      dx += q * (positions[i3] - cx);
      dy += q * (positions[i3 + 1] - cy);
      dz += q * (positions[i3 + 2] - cz);
    }

    const dipoleMagnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);

    molecules[mol] = {
      id: mol,
      atomIndices: atomIndices[mol],
      centerOfMass: [cx, cy, cz] as Vector3Tuple,
      totalCharge: totalCharge[mol],
      dipoleMoment: [dx, dy, dz] as Vector3Tuple,
      dipoleMagnitude,
    };
  }

  return molecules;
}
