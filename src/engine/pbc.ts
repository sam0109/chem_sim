// ==============================================================
// Periodic Boundary Conditions (PBC) utility functions
// Implements minimum image convention and position wrapping
// for cubic/orthorhombic simulation boxes.
//
// Reference: Allen & Tildesley, "Computer Simulation of Liquids",
// Oxford University Press, 2017, Ch. 1.5.2
// ==============================================================

import type { Vector3Tuple } from '../data/types';

/**
 * Apply minimum image convention to a displacement vector.
 * For each component: dx -= Lx * round(dx / Lx)
 *
 * This returns the shortest displacement between two points
 * considering all periodic images.
 *
 * @param dx x-component of displacement (Å)
 * @param dy y-component of displacement (Å)
 * @param dz z-component of displacement (Å)
 * @param boxSize box dimensions [Lx, Ly, Lz] in Å
 * @returns wrapped displacement [dx, dy, dz]
 */
export function minimumImage(
  dx: number,
  dy: number,
  dz: number,
  boxSize: Vector3Tuple,
): Vector3Tuple {
  const [lx, ly, lz] = boxSize;
  dx -= lx * Math.round(dx / lx);
  dy -= ly * Math.round(dy / ly);
  dz -= lz * Math.round(dz / lz);
  return [dx, dy, dz];
}

/**
 * Wrap atom positions into the primary simulation cell [0, Lx) × [0, Ly) × [0, Lz).
 * Modifies the positions array in place.
 *
 * Uses modular arithmetic: pos = pos - floor(pos / L) * L
 * This correctly handles positions that are negative or multiple box lengths away.
 *
 * @param positions flat position array [x0,y0,z0,x1,y1,z1,...]
 * @param nAtoms   number of atoms
 * @param boxSize  box dimensions [Lx, Ly, Lz] in Å
 */
export function wrapPositions(
  positions: Float64Array,
  nAtoms: number,
  boxSize: Vector3Tuple,
): void {
  const [lx, ly, lz] = boxSize;
  for (let i = 0; i < nAtoms; i++) {
    const i3 = i * 3;
    positions[i3] -= Math.floor(positions[i3] / lx) * lx;
    positions[i3 + 1] -= Math.floor(positions[i3 + 1] / ly) * ly;
    positions[i3 + 2] -= Math.floor(positions[i3 + 2] / lz) * lz;
  }
}
