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
// Forces are derived via the chain rule:
//   F_atom = -dV/dφ · dφ/dr_atom
// using the standard cross-product formulation.
// ==============================================================

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
): number {
  if (V === 0) return 0;

  const i3 = i * 3;
  const j3 = j * 3;
  const k3 = k * 3;
  const l3 = l * 3;

  // Vectors along the dihedral: b1 = j-i, b2 = k-j, b3 = l-k
  const b1x = positions[j3] - positions[i3];
  const b1y = positions[j3 + 1] - positions[i3 + 1];
  const b1z = positions[j3 + 2] - positions[i3 + 2];

  const b2x = positions[k3] - positions[j3];
  const b2y = positions[k3 + 1] - positions[j3 + 1];
  const b2z = positions[k3 + 2] - positions[j3 + 2];

  const b3x = positions[l3] - positions[k3];
  const b3y = positions[l3 + 1] - positions[k3 + 1];
  const b3z = positions[l3 + 2] - positions[k3 + 2];

  // Cross products: m = b1 × b2, n_vec = b2 × b3
  const mx = b1y * b2z - b1z * b2y;
  const my = b1z * b2x - b1x * b2z;
  const mz = b1x * b2y - b1y * b2x;

  const nx = b2y * b3z - b2z * b3y;
  const ny = b2z * b3x - b2x * b3z;
  const nz = b2x * b3y - b2y * b3x;

  const mm = mx * mx + my * my + mz * mz;
  const nn = nx * nx + ny * ny + nz * nz;

  if (mm < 1e-20 || nn < 1e-20) return 0;

  const invMM = 1.0 / mm;
  const invNN = 1.0 / nn;

  // cos(φ) = (m · n) / (|m| · |n|)
  const mn = mx * nx + my * ny + mz * nz;
  const invMN = 1.0 / Math.sqrt(mm * nn);
  const cosPhi = Math.max(-1, Math.min(1, mn * invMN));

  // sin(φ) via triple product: sin(φ) = (b1 · n) · |b2| / (|m| · |n|)
  const b2len = Math.sqrt(b2x * b2x + b2y * b2y + b2z * b2z);
  if (b2len < 1e-10) return 0;

  const b1_dot_n = b1x * nx + b1y * ny + b1z * nz;
  const sinPhi = b1_dot_n * b2len * invMN;

  // Dihedral angle
  const phi = Math.atan2(sinPhi, cosPhi);

  // Energy: V(φ) = (V/2) · [1 − cos(nφ₀) · cos(nφ)]
  const cosNPhi0 = Math.cos(n * phi0);
  const cosNPhi = Math.cos(n * phi);
  const energy = 0.5 * V * (1 - cosNPhi0 * cosNPhi);

  // dV/dφ = (V/2) · n · cos(nφ₀) · sin(nφ)
  const sinNPhi = Math.sin(n * phi);
  const dVdphi = 0.5 * V * n * cosNPhi0 * sinNPhi;

  // Forces on each atom using the Blondel-Karplus formulation:
  // F_i = -dV/dφ · dφ/dr_i = -dV/dφ · (-|b2| / mm) · m
  // F_l = -dV/dφ · dφ/dr_l = -dV/dφ · ( |b2| / nn) · n
  // F_j and F_k by Newton's third law and partitioning
  //
  // Reference: Blondel & Karplus, J Comput Chem 17, 1132 (1996)

  const fac_i = -dVdphi * (-b2len * invMM);
  const fac_l = -dVdphi * (b2len * invNN);

  // Force on atom i
  const fi_x = fac_i * mx;
  const fi_y = fac_i * my;
  const fi_z = fac_i * mz;

  // Force on atom l
  const fl_x = fac_l * nx;
  const fl_y = fac_l * ny;
  const fl_z = fac_l * nz;

  // For j and k, we need projections of b1 and b3 onto b2
  // p = (b1 · b2) / (b2 · b2), q = (b3 · b2) / (b2 · b2)
  const invB2sq = 1.0 / (b2x * b2x + b2y * b2y + b2z * b2z);
  const p = (b1x * b2x + b1y * b2y + b1z * b2z) * invB2sq;
  const q = (b3x * b2x + b3y * b2y + b3z * b2z) * invB2sq;

  // Force on atom j: F_j = -(1-p)·F_i + q·F_l
  // Force on atom k: F_k = p·F_i - (1+q)·F_l
  const fj_x = -(1 - p) * fi_x + q * fl_x;
  const fj_y = -(1 - p) * fi_y + q * fl_y;
  const fj_z = -(1 - p) * fi_z + q * fl_z;

  const fk_x = p * fi_x - (1 + q) * fl_x;
  const fk_y = p * fi_y - (1 + q) * fl_y;
  const fk_z = p * fi_z - (1 + q) * fl_z;

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
