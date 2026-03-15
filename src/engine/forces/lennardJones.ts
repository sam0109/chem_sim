// ==============================================================
// Lennard-Jones 12-6 potential for van der Waals interactions
// V(r) = 4ε [(σ/r)^12 - (σ/r)^6]
// F(r) = 24ε/r [2(σ/r)^12 - (σ/r)^6] * (r_vec/r)
// ==============================================================

import type { Vector3Tuple } from '../../data/types';

/**
 * Compute LJ force between two atoms and add to force arrays.
 * Returns potential energy contribution (eV).
 * Uses shifted potential: V_shift = V(r) - V(rc) so energy is continuous at cutoff.
 *
 * @param positions flat position array
 * @param forces    flat force array (accumulated)
 * @param i         atom index A
 * @param j         atom index B
 * @param sigma     LJ sigma (Å)
 * @param epsilon   LJ epsilon (eV)
 * @param cutoff    interaction cutoff (Å)
 * @param boxSize   box dimensions for PBC minimum image (undefined = no PBC)
 */
export function ljForce(
  positions: Float64Array,
  forces: Float64Array,
  i: number,
  j: number,
  sigma: number,
  epsilon: number,
  cutoff: number,
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
  const rc2 = cutoff * cutoff;

  if (r2 > rc2 || r2 < 1e-10) return 0;

  const s2 = sigma * sigma;
  const sr2 = s2 / r2;
  const sr6 = sr2 * sr2 * sr2;
  const sr12 = sr6 * sr6;

  // Shifted energy: V(r) - V(rc)
  const src2 = s2 / rc2;
  const src6 = src2 * src2 * src2;
  const src12 = src6 * src6;

  const energy = 4.0 * epsilon * (sr12 - sr6 - src12 + src6);

  // Force: -dV/dr * (r_vec / r) = 24ε/r² [2σ¹²/r¹² - σ⁶/r⁶] * r_vec
  const fMag = (24.0 * epsilon * (2.0 * sr12 - sr6)) / r2;

  const fx = fMag * dx;
  const fy = fMag * dy;
  const fz = fMag * dz;

  forces[i3] -= fx;
  forces[i3 + 1] -= fy;
  forces[i3 + 2] -= fz;
  forces[j3] += fx;
  forces[j3 + 1] += fy;
  forces[j3 + 2] += fz;

  return energy;
}
