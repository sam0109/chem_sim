// ==============================================================
// Torsion (dihedral) potential
//
// V(φ) = (V/2) · [1 − cos(nφ₀) · cos(nφ)]
//
// Source: Rappé, Casewit, Colwell, Goddard, Skiff
//         JACS 114, 10024 (1992), Eq. 16
//
// The dihedral angle φ is defined for four atoms i-j-k-l where
// j-k is the central bond. φ is the angle between the planes
// i-j-k and j-k-l.
//
// Forces derived following the GROMACS formulation
// (GROMACS Reference Manual, §4.2.13).
// ==============================================================

import type { Vector3Tuple } from '../../data/types';

/**
 * Compute torsion force and energy for a dihedral i-j-k-l.
 *
 * @param positions  flat position array [x0,y0,z0,x1,y1,z1,...]
 * @param forces     flat force array (accumulated)
 * @param i          terminal atom 1
 * @param j          central atom 1 (bonded to i and k)
 * @param k          central atom 2 (bonded to j and l)
 * @param l          terminal atom 2
 * @param V          barrier height in eV
 * @param n          periodicity (1, 2, 3, or 6)
 * @param phi0       equilibrium dihedral angle in radians
 * @param boxSize    box dimensions for PBC minimum image (undefined = no PBC)
 * @returns potential energy in eV
 */
export function torsionForce(
  positions: Float64Array,
  forces: Float64Array,
  i: number,
  j: number,
  k: number,
  l: number,
  V: number,
  n: number,
  phi0: number,
  boxSize?: Vector3Tuple,
): number {
  if (V === 0) return 0;

  const i3 = i * 3;
  const j3 = j * 3;
  const k3 = k * 3;
  const l3 = l * 3;

  // GROMACS convention vectors:
  // r_ij = r_i - r_j, r_kj = r_k - r_j, r_kl = r_k - r_l
  let rij_x = positions[i3] - positions[j3];
  let rij_y = positions[i3 + 1] - positions[j3 + 1];
  let rij_z = positions[i3 + 2] - positions[j3 + 2];

  let rkj_x = positions[k3] - positions[j3];
  let rkj_y = positions[k3 + 1] - positions[j3 + 1];
  let rkj_z = positions[k3 + 2] - positions[j3 + 2];

  let rkl_x = positions[k3] - positions[l3];
  let rkl_y = positions[k3 + 1] - positions[l3 + 1];
  let rkl_z = positions[k3 + 2] - positions[l3 + 2];

  // Apply minimum image convention for periodic boundaries
  // Reference: Allen & Tildesley, "Computer Simulation of Liquids", Ch. 1.5.2
  if (boxSize) {
    rij_x -= boxSize[0] * Math.round(rij_x / boxSize[0]);
    rij_y -= boxSize[1] * Math.round(rij_y / boxSize[1]);
    rij_z -= boxSize[2] * Math.round(rij_z / boxSize[2]);

    rkj_x -= boxSize[0] * Math.round(rkj_x / boxSize[0]);
    rkj_y -= boxSize[1] * Math.round(rkj_y / boxSize[1]);
    rkj_z -= boxSize[2] * Math.round(rkj_z / boxSize[2]);

    rkl_x -= boxSize[0] * Math.round(rkl_x / boxSize[0]);
    rkl_y -= boxSize[1] * Math.round(rkl_y / boxSize[1]);
    rkl_z -= boxSize[2] * Math.round(rkl_z / boxSize[2]);
  }

  // Normal vectors: m = r_ij × r_kj, n_vec = r_kj × r_kl
  const mx = rij_y * rkj_z - rij_z * rkj_y;
  const my = rij_z * rkj_x - rij_x * rkj_z;
  const mz = rij_x * rkj_y - rij_y * rkj_x;

  const nx = rkj_y * rkl_z - rkj_z * rkl_y;
  const ny = rkj_z * rkl_x - rkj_x * rkl_z;
  const nz = rkj_x * rkl_y - rkj_y * rkl_x;

  const mm = mx * mx + my * my + mz * mz;
  const nn = nx * nx + ny * ny + nz * nz;

  if (mm < 1e-20 || nn < 1e-20) return 0;

  const invMM = 1.0 / mm;
  const invNN = 1.0 / nn;

  // cos(φ) = (m · n) / (|m| · |n|)
  const mn = mx * nx + my * ny + mz * nz;
  const invMN = 1.0 / Math.sqrt(mm * nn);
  const cosPhi = Math.max(-1, Math.min(1, mn * invMN));

  // sin(φ) via triple product: (r_ij · n) · |r_kj| / (|m| · |n|)
  const rkjLen = Math.sqrt(rkj_x * rkj_x + rkj_y * rkj_y + rkj_z * rkj_z);
  if (rkjLen < 1e-10) return 0;

  const rij_dot_n = rij_x * nx + rij_y * ny + rij_z * nz;
  const sinPhi = rij_dot_n * rkjLen * invMN;

  // Dihedral angle
  const phi = Math.atan2(sinPhi, cosPhi);

  // Energy: V(φ) = (V/2) · [1 − cos(nφ₀) · cos(nφ)]
  const cosNPhi0 = Math.cos(n * phi0);
  const cosNPhi = Math.cos(n * phi);
  const energy = 0.5 * V * (1 - cosNPhi0 * cosNPhi);

  // dV/dφ = (V/2) · n · cos(nφ₀) · sin(nφ)
  // The negative sign arises because d(cosθ)/dθ = -sinθ, applied to
  // d/dφ[-cos(nφ₀)·cos(nφ)] = -cos(nφ₀)·n·sin(nφ).
  const sinNPhi = Math.sin(n * phi);
  const dVdphi = -0.5 * V * n * cosNPhi0 * sinNPhi;

  // Forces using GROMACS formulation (Manual §4.2.13):
  //   dφ/dr_i = -|r_kj| / (m·m) · m
  //   dφ/dr_l =  |r_kj| / (n·n) · n
  //   F = -dV/dφ · dφ/dr
  //
  // For central atoms j and k, use the exact decomposition:
  //   dφ/dr_j = (r_ij·r_kj/|r_kj|² - 1)·dφ/dr_i - (r_kl·r_kj/|r_kj|²)·dφ/dr_l
  //   dφ/dr_k = -(r_ij·r_kj/|r_kj|²)·dφ/dr_i + (r_kl·r_kj/|r_kj|² - 1)·dφ/dr_l
  //
  // Note: F_i + F_j + F_k + F_l = 0 by construction.

  // dφ/dr_i · (-dVdphi) → force on i
  const fac_i = dVdphi * rkjLen * invMM;

  // dφ/dr_l · (-dVdphi) → force on l
  const fac_l = -dVdphi * rkjLen * invNN;

  const fi_x = fac_i * mx;
  const fi_y = fac_i * my;
  const fi_z = fac_i * mz;

  const fl_x = fac_l * nx;
  const fl_y = fac_l * ny;
  const fl_z = fac_l * nz;

  // Projections onto the central bond
  const invRkjSq = 1.0 / (rkj_x * rkj_x + rkj_y * rkj_y + rkj_z * rkj_z);
  const p = (rij_x * rkj_x + rij_y * rkj_y + rij_z * rkj_z) * invRkjSq;
  const q = (rkl_x * rkj_x + rkl_y * rkj_y + rkl_z * rkj_z) * invRkjSq;

  // Force on j
  const fj_x = (p - 1) * fi_x - q * fl_x;
  const fj_y = (p - 1) * fi_y - q * fl_y;
  const fj_z = (p - 1) * fi_z - q * fl_z;

  // Force on k = -(F_i + F_j + F_l) ensures momentum conservation
  const fk_x = -(fi_x + fj_x + fl_x);
  const fk_y = -(fi_y + fj_y + fl_y);
  const fk_z = -(fi_z + fj_z + fl_z);

  // Accumulate forces
  forces[i3] += fi_x;
  forces[i3 + 1] += fi_y;
  forces[i3 + 2] += fi_z;

  forces[j3] += fj_x;
  forces[j3 + 1] += fj_y;
  forces[j3 + 2] += fj_z;

  forces[k3] += fk_x;
  forces[k3 + 1] += fk_y;
  forces[k3 + 2] += fk_z;

  forces[l3] += fl_x;
  forces[l3 + 1] += fl_y;
  forces[l3 + 2] += fl_z;

  return energy;
}
