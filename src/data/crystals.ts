// ==============================================================
// Crystal structure definitions for the lattice builder
//
// Lattice constants from CRC Handbook of Chemistry and Physics
// (97th Ed.) and Wyckoff Crystal Structures, Vol. 1.
// Fractional coordinates use the conventional unit cell.
// ==============================================================

import type { Vector3Tuple } from 'three';

/** Supported crystal structure types */
export type CrystalStructureType =
  | 'fcc'
  | 'bcc'
  | 'hcp'
  | 'diamond'
  | 'rocksalt'
  | 'cscl';

/** A named basis atom within the unit cell */
export interface BasisAtom {
  /** Label for element selection (e.g., 'A' for single-element, 'A'/'B' for binary) */
  label: 'A' | 'B';
  /** Fractional coordinates [u, v, w] within the unit cell */
  fractional: Vector3Tuple;
}

/** Definition of a crystal structure type */
export interface CrystalStructureDef {
  /** Human-readable name */
  name: string;
  /** Lattice vector a in units of the lattice constant [ax, ay, az] */
  a: Vector3Tuple;
  /** Lattice vector b in units of the lattice constant [bx, by, bz] */
  b: Vector3Tuple;
  /** Lattice vector c in units of the lattice constant [cx, cy, cz] */
  c: Vector3Tuple;
  /** Basis atoms in fractional coordinates */
  basis: BasisAtom[];
  /** Number of distinct element slots (1 for elemental, 2 for binary) */
  elementSlots: 1 | 2;
  /** Description for the UI */
  description: string;
}

/**
 * Crystal structure definitions.
 *
 * Lattice vectors are given in units of the lattice constant a.
 * For cubic structures, a = b = c and all angles are 90°.
 * For HCP, we use an orthogonal supercell approximation:
 *   a₁ = a[1, 0, 0], a₂ = a[0, √3, 0], a₃ = a[0, 0, c/a]
 * with a 4-atom basis (2 layers × 2 atoms per orthogonal cell).
 *
 * Source: Wyckoff Crystal Structures, Vol. 1; CRC Handbook (97th Ed.)
 */
export const crystalStructures: Record<
  CrystalStructureType,
  CrystalStructureDef
> = {
  fcc: {
    name: 'FCC (Face-Centered Cubic)',
    a: [1, 0, 0],
    b: [0, 1, 0],
    c: [0, 0, 1],
    basis: [
      { label: 'A', fractional: [0, 0, 0] },
      { label: 'A', fractional: [0.5, 0.5, 0] },
      { label: 'A', fractional: [0.5, 0, 0.5] },
      { label: 'A', fractional: [0, 0.5, 0.5] },
    ],
    elementSlots: 1,
    description: 'Cu, Au, Ag, Al, Ni, Pt — 4 atoms per unit cell',
  },
  bcc: {
    name: 'BCC (Body-Centered Cubic)',
    a: [1, 0, 0],
    b: [0, 1, 0],
    c: [0, 0, 1],
    basis: [
      { label: 'A', fractional: [0, 0, 0] },
      { label: 'A', fractional: [0.5, 0.5, 0.5] },
    ],
    elementSlots: 1,
    description: 'Fe, W, Na, Cr, Mo — 2 atoms per unit cell',
  },
  hcp: {
    // Orthogonal approximation of hexagonal cell
    // True HCP: a₁ = a[1,0,0], a₂ = a[1/2, √3/2, 0], c = a[0, 0, c/a]
    // Orthogonal supercell: a₁ = a[1,0,0], a₂ = a[0, √3, 0], c = a[0, 0, c/a]
    // Contains 4 atoms per orthogonal cell (2 from each hexagonal layer)
    // Source: Wyckoff Crystal Structures, Vol. 1
    name: 'HCP (Hexagonal Close-Packed)',
    a: [1, 0, 0],
    b: [0, Math.sqrt(3), 0],
    c: [0, 0, 1.633], // ideal c/a = √(8/3) ≈ 1.633
    basis: [
      { label: 'A', fractional: [0, 0, 0] },
      { label: 'A', fractional: [0.5, 0.5, 0] },
      { label: 'A', fractional: [0.5, 1 / 6, 0.5] },
      { label: 'A', fractional: [0, 2 / 3, 0.5] },
    ],
    elementSlots: 1,
    description: 'Mg, Ti, Zn, Co — 4 atoms per orthogonal cell',
  },
  diamond: {
    name: 'Diamond Cubic',
    a: [1, 0, 0],
    b: [0, 1, 0],
    c: [0, 0, 1],
    basis: [
      // FCC sublattice
      { label: 'A', fractional: [0, 0, 0] },
      { label: 'A', fractional: [0.5, 0.5, 0] },
      { label: 'A', fractional: [0.5, 0, 0.5] },
      { label: 'A', fractional: [0, 0.5, 0.5] },
      // Tetrahedral interstitial sublattice (shifted by [1/4, 1/4, 1/4])
      { label: 'A', fractional: [0.25, 0.25, 0.25] },
      { label: 'A', fractional: [0.75, 0.75, 0.25] },
      { label: 'A', fractional: [0.75, 0.25, 0.75] },
      { label: 'A', fractional: [0.25, 0.75, 0.75] },
    ],
    elementSlots: 1,
    description: 'C (diamond), Si, Ge — 8 atoms per unit cell',
  },
  rocksalt: {
    name: 'Rock Salt (NaCl)',
    a: [1, 0, 0],
    b: [0, 1, 0],
    c: [0, 0, 1],
    basis: [
      // Cation sublattice (FCC)
      { label: 'A', fractional: [0, 0, 0] },
      { label: 'A', fractional: [0.5, 0.5, 0] },
      { label: 'A', fractional: [0.5, 0, 0.5] },
      { label: 'A', fractional: [0, 0.5, 0.5] },
      // Anion sublattice (FCC shifted by [0.5, 0, 0])
      { label: 'B', fractional: [0.5, 0, 0] },
      { label: 'B', fractional: [0, 0.5, 0] },
      { label: 'B', fractional: [0, 0, 0.5] },
      { label: 'B', fractional: [0.5, 0.5, 0.5] },
    ],
    elementSlots: 2,
    description: 'NaCl, KCl, MgO, LiF — 8 atoms per unit cell (4+4)',
  },
  cscl: {
    name: 'CsCl',
    a: [1, 0, 0],
    b: [0, 1, 0],
    c: [0, 0, 1],
    basis: [
      { label: 'A', fractional: [0, 0, 0] },
      { label: 'B', fractional: [0.5, 0.5, 0.5] },
    ],
    elementSlots: 2,
    description: 'CsCl, CsBr — 2 atoms per unit cell (1+1)',
  },
};

/**
 * Preset crystal configurations with experimental lattice constants
 * and default element assignments.
 *
 * Lattice constants in Å at 298 K unless noted.
 * Source: CRC Handbook of Chemistry and Physics, 97th Ed., Section 12
 *         "Lattice Constants of the Elements"
 */
export interface CrystalPreset {
  /** Display name */
  name: string;
  /** Crystal structure type */
  structureType: CrystalStructureType;
  /** Element A atomic number */
  elementA: number;
  /** Element B atomic number (for binary structures) */
  elementB?: number;
  /** Lattice constant a in Å */
  latticeConstant: number;
  /** Formal charge on element A (for ionic crystals) */
  chargeA?: number;
  /** Formal charge on element B (for ionic crystals) */
  chargeB?: number;
}

export const crystalPresets: CrystalPreset[] = [
  // FCC metals
  // Source: CRC Handbook 97th Ed., Section 12
  {
    name: 'Copper (Cu)',
    structureType: 'fcc',
    elementA: 29,
    latticeConstant: 3.615,
  },
  {
    name: 'Gold (Au)',
    structureType: 'fcc',
    elementA: 79,
    latticeConstant: 4.078,
  },
  {
    name: 'Silver (Ag)',
    structureType: 'fcc',
    elementA: 47,
    latticeConstant: 4.085,
  },
  {
    name: 'Aluminium (Al)',
    structureType: 'fcc',
    elementA: 13,
    latticeConstant: 4.05,
  },
  {
    name: 'Nickel (Ni)',
    structureType: 'fcc',
    elementA: 28,
    latticeConstant: 3.524,
  },
  {
    name: 'Platinum (Pt)',
    structureType: 'fcc',
    elementA: 78,
    latticeConstant: 3.924,
  },

  // BCC metals
  // Source: CRC Handbook 97th Ed., Section 12
  {
    name: 'Iron (Fe)',
    structureType: 'bcc',
    elementA: 26,
    latticeConstant: 2.867,
  },
  {
    name: 'Tungsten (W)',
    structureType: 'bcc',
    elementA: 74,
    latticeConstant: 3.165,
  },
  {
    name: 'Sodium (Na)',
    structureType: 'bcc',
    elementA: 11,
    latticeConstant: 4.225,
  },
  {
    name: 'Chromium (Cr)',
    structureType: 'bcc',
    elementA: 24,
    latticeConstant: 2.885,
  },

  // HCP metals
  // Source: CRC Handbook 97th Ed., Section 12
  // Note: latticeConstant is 'a'; c/a ratio is encoded in the structure def
  {
    name: 'Magnesium (Mg)',
    structureType: 'hcp',
    elementA: 12,
    latticeConstant: 3.209,
  },
  {
    name: 'Titanium (Ti)',
    structureType: 'hcp',
    elementA: 22,
    latticeConstant: 2.951,
  },
  {
    name: 'Zinc (Zn)',
    structureType: 'hcp',
    elementA: 30,
    latticeConstant: 2.665,
  },

  // Diamond cubic
  // Source: CRC Handbook 97th Ed., Section 12
  {
    name: 'Diamond (C)',
    structureType: 'diamond',
    elementA: 6,
    latticeConstant: 3.567,
  },
  {
    name: 'Silicon (Si)',
    structureType: 'diamond',
    elementA: 14,
    latticeConstant: 5.431,
  },
  {
    name: 'Germanium (Ge)',
    structureType: 'diamond',
    elementA: 32,
    latticeConstant: 5.658,
  },

  // Rock salt (ionic)
  // Source: CRC Handbook 97th Ed., Section 12
  {
    name: 'NaCl',
    structureType: 'rocksalt',
    elementA: 11,
    elementB: 17,
    latticeConstant: 5.64,
    chargeA: 1.0,
    chargeB: -1.0,
  },
  {
    name: 'KCl',
    structureType: 'rocksalt',
    elementA: 19,
    elementB: 17,
    latticeConstant: 6.293,
    chargeA: 1.0,
    chargeB: -1.0,
  },
  {
    name: 'MgO',
    structureType: 'rocksalt',
    elementA: 12,
    elementB: 8,
    latticeConstant: 4.212,
    chargeA: 2.0,
    chargeB: -2.0,
  },
  {
    name: 'LiF',
    structureType: 'rocksalt',
    elementA: 3,
    elementB: 9,
    latticeConstant: 4.027,
    chargeA: 1.0,
    chargeB: -1.0,
  },

  // CsCl structure (ionic)
  // Source: CRC Handbook 97th Ed., Section 12
  {
    name: 'CsCl',
    structureType: 'cscl',
    elementA: 55,
    elementB: 17,
    latticeConstant: 4.123,
    chargeA: 1.0,
    chargeB: -1.0,
  },
];
