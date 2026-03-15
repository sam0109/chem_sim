// ==============================================================
// Crystal lattice builder — generates atom arrays from crystal
// structure definitions.
//
// This module lives in src/engine/ and must NOT import from
// renderer, store, or UI layers.
// ==============================================================

import type { Atom } from '../data/types';
import type { Vector3Tuple } from 'three';
import { crystalStructures, type CrystalStructureType } from '../data/crystals';

/** Options for crystal generation */
export interface CrystalBuildOptions {
  /** Crystal structure type */
  structureType: CrystalStructureType;
  /** Atomic number for element A */
  elementA: number;
  /** Atomic number for element B (required for binary structures) */
  elementB?: number;
  /** Lattice constant a in Å */
  latticeConstant: number;
  /** Number of unit cells along a-axis */
  nx: number;
  /** Number of unit cells along b-axis */
  ny: number;
  /** Number of unit cells along c-axis */
  nz: number;
  /** Formal charge on element A (default 0) */
  chargeA?: number;
  /** Formal charge on element B (default 0) */
  chargeB?: number;
}

/**
 * Generate atom positions for a crystal supercell.
 *
 * Replicates the unit cell basis across an Nx × Ny × Nz grid,
 * then centers the resulting cluster at the origin.
 *
 * @returns Array of Atom objects with correct positions, charges,
 *          and element assignments. All velocities and forces are zero.
 */
export function generateCrystalAtoms(options: CrystalBuildOptions): Atom[] {
  const {
    structureType,
    elementA,
    elementB,
    latticeConstant,
    nx,
    ny,
    nz,
    chargeA = 0,
    chargeB = 0,
  } = options;

  const structure = crystalStructures[structureType];
  if (!structure) {
    throw new Error(`Unknown crystal structure type: ${structureType}`);
  }

  if (structure.elementSlots === 2 && elementB === undefined) {
    throw new Error(
      `Crystal structure '${structureType}' requires two elements (elementB is missing)`,
    );
  }

  // Compute Cartesian lattice vectors (scaled by lattice constant)
  const aVec: Vector3Tuple = [
    structure.a[0] * latticeConstant,
    structure.a[1] * latticeConstant,
    structure.a[2] * latticeConstant,
  ];
  const bVec: Vector3Tuple = [
    structure.b[0] * latticeConstant,
    structure.b[1] * latticeConstant,
    structure.b[2] * latticeConstant,
  ];
  const cVec: Vector3Tuple = [
    structure.c[0] * latticeConstant,
    structure.c[1] * latticeConstant,
    structure.c[2] * latticeConstant,
  ];

  const atoms: Atom[] = [];
  let id = 0;

  // Replicate basis across the supercell
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        for (const basisAtom of structure.basis) {
          // Fractional → Cartesian within the unit cell
          const u = basisAtom.fractional[0];
          const v = basisAtom.fractional[1];
          const w = basisAtom.fractional[2];

          // Position = (ix + u) * aVec + (iy + v) * bVec + (iz + w) * cVec
          const x =
            (ix + u) * aVec[0] + (iy + v) * bVec[0] + (iz + w) * cVec[0];
          const y =
            (ix + u) * aVec[1] + (iy + v) * bVec[1] + (iz + w) * cVec[1];
          const z =
            (ix + u) * aVec[2] + (iy + v) * bVec[2] + (iz + w) * cVec[2];

          const isB = basisAtom.label === 'B';
          const elementNumber = isB ? (elementB ?? elementA) : elementA;
          const charge = isB ? chargeB : chargeA;

          atoms.push({
            id,
            elementNumber,
            position: [x, y, z],
            velocity: [0, 0, 0],
            force: [0, 0, 0],
            charge,
            hybridization: 'none',
            fixed: false,
          });
          id++;
        }
      }
    }
  }

  // Center the cluster at the origin
  if (atoms.length > 0) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const atom of atoms) {
      cx += atom.position[0];
      cy += atom.position[1];
      cz += atom.position[2];
    }
    cx /= atoms.length;
    cy /= atoms.length;
    cz /= atoms.length;

    for (const atom of atoms) {
      atom.position = [
        atom.position[0] - cx,
        atom.position[1] - cy,
        atom.position[2] - cz,
      ];
    }
  }

  return atoms;
}

/**
 * Compute the supercell dimensions in Å for a given crystal configuration.
 * Useful for setting PBC box size to match the crystal.
 *
 * @returns [Lx, Ly, Lz] supercell dimensions in Å
 */
export function computeSupercellSize(
  structureType: CrystalStructureType,
  latticeConstant: number,
  nx: number,
  ny: number,
  nz: number,
): Vector3Tuple {
  const structure = crystalStructures[structureType];
  if (!structure) {
    throw new Error(`Unknown crystal structure type: ${structureType}`);
  }

  // Supercell dimensions = n_i × |lattice_vector_i| × lattice_constant
  const aLen = Math.sqrt(
    structure.a[0] ** 2 + structure.a[1] ** 2 + structure.a[2] ** 2,
  );
  const bLen = Math.sqrt(
    structure.b[0] ** 2 + structure.b[1] ** 2 + structure.b[2] ** 2,
  );
  const cLen = Math.sqrt(
    structure.c[0] ** 2 + structure.c[1] ** 2 + structure.c[2] ** 2,
  );

  return [
    nx * aLen * latticeConstant,
    ny * bLen * latticeConstant,
    nz * cLen * latticeConstant,
  ];
}
