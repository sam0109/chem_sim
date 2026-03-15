// ==============================================================
// Short-range Pauli-like repulsive wall
// Prevents atoms from overlapping regardless of bonding state.
// Uses an exponential repulsion: V(r) = A * exp(-b * r)
// This acts as a hard-core repulsion below ~0.5× vdW radius.
// ==============================================================

import type { Vector3Tuple } from '../../data/types';

/**
 * Compute short-range repulsive force between two atoms.
 * Only significant when atoms are very close (< ~1.0 Å).
 * Returns potential energy contribution (eV).
 *
 * @param positions flat position array
 * @param forces    flat force array (accumulated)
 * @param i         atom index A
 * @param j         atom index B
 * @param rMin      minimum allowed approach distance (Å) — typically ~0.6
 * @param strength  repulsion strength (eV) — typically ~10-50
 * @param boxSize   box dimensions for PBC minimum image (undefined = no PBC)
 */
export function pauliRepulsion(
  positions: Float64Array,
  forces: Float64Array,
  i: number,
  j: number,
  rMin: number,
  strength: number,
  boxSize?: Vector3Tuple,
): number {
  const i3 = i * 3;
  const j3 = j * 3;

  let dx = positions[j3] - positions[i3];
  let dy = positions[j3 + 1] - positions[i3 + 1];
  let dz = positions[j3 + 2] - positions[i3 + 2];

  // Apply minimum image convention for periodic boundaries
  // Reference: Allen & Tildesley, "Computer Simulation of Liquids", Ch. 1.5.2
  if (boxSize) {
    dx -= boxSize[0] * Math.round(dx / boxSize[0]);
    dy -= boxSize[1] * Math.round(dy / boxSize[1]);
    dz -= boxSize[2] * Math.round(dz / boxSize[2]);
  }

  const r2 = dx * dx + dy * dy + dz * dz;
  // Only activate below 2×rMin for performance
  const rCut = 2.0 * rMin;
  if (r2 > rCut * rCut || r2 < 1e-14) return 0;

  const r = Math.sqrt(r2);

  // Exponential repulsion: V = A * exp(-b*(r - rMin)) for r < rCut
  // b chosen so wall is steep: b = 8/rMin
  const b = 8.0 / rMin;
  const expTerm = Math.exp(-b * (r - rMin));

  if (expTerm < 1e-6) return 0; // negligible

  const energy = strength * expTerm;

  // Force: dV/dr = -A*b*exp(-b*(r-rMin))
  // F = -dV/dr * (r_vec/r) = A*b*exp*r_vec/r
  const fMag = (strength * b * expTerm) / r;

  const fx = fMag * dx;
  const fy = fMag * dy;
  const fz = fMag * dz;

  // Repulsive: pushes atoms apart (F on i points away from j)
  forces[i3] -= fx;
  forces[i3 + 1] -= fy;
  forces[i3 + 2] -= fz;
  forces[j3] += fx;
  forces[j3 + 1] += fy;
  forces[j3 + 2] += fz;

  return energy;
}
