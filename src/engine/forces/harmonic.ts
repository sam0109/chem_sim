// ==============================================================
// Angle bending potential
// General case: V(θ) = 0.5 * kcos * (cosθ - cosθ₀)²
// Linear case:  V(θ) = kA * (1 + cosθ)   [UFF Eq. 10, n=1]
// ==============================================================

import type { Vector3Tuple } from '../../data/types';

// Threshold above which θ₀ is treated as linear (radians).
// 170° ≈ 2.967 rad. Source: Rappé et al., JACS 114, 10024 (1992).
const LINEAR_THRESHOLD = (170 * Math.PI) / 180;

/**
 * Compute angle bending force for a triplet i-j-k (j = central atom).
 *
 * For non-linear angles (θ₀ ≤ 170°):
 *   V = 0.5 * kcos * (cosθ - cosθ₀)²
 *   kcos = k_angle / sin²(θ₀), matching harmonic behaviour near θ₀.
 *
 * For linear angles (θ₀ > 170°):
 *   V = k_angle * (1 + cosθ)
 *   This form has a non-vanishing restoring force at θ = 180°:
 *   dV/dθ = -k_angle * sinθ ≠ 0 for any θ ≠ 0, π.
 *   Source: Rappé et al., JACS 114, 10024 (1992), Eq. 10 with n = 1.
 *
 * Both branches use the same Cartesian chain-rule gradient for cosθ.
 *
 * @param positions  flat position array
 * @param forces     flat force array (accumulated)
 * @param i          terminal atom 1
 * @param j          central atom (vertex)
 * @param k          terminal atom 2
 * @param k_angle    force constant (eV/rad² for general; eV for linear)
 * @param theta0     equilibrium angle (radians)
 * @param boxSize    box dimensions for PBC minimum image (undefined = no PBC)
 * @returns potential energy (eV)
 */
export function harmonicAngleForce(
  positions: Float64Array,
  forces: Float64Array,
  i: number,
  j: number,
  k: number,
  k_angle: number,
  theta0: number,
  boxSize?: Vector3Tuple,
): number {
  const i3 = i * 3;
  const j3 = j * 3;
  const k3 = k * 3;

  // Vectors from central atom j
  let rji_x = positions[i3] - positions[j3];
  let rji_y = positions[i3 + 1] - positions[j3 + 1];
  let rji_z = positions[i3 + 2] - positions[j3 + 2];

  let rjk_x = positions[k3] - positions[j3];
  let rjk_y = positions[k3 + 1] - positions[j3 + 1];
  let rjk_z = positions[k3 + 2] - positions[j3 + 2];

  // Apply minimum image convention for periodic boundaries
  // Reference: Allen & Tildesley, "Computer Simulation of Liquids", Ch. 1.5.2
  if (boxSize) {
    rji_x -= boxSize[0] * Math.round(rji_x / boxSize[0]);
    rji_y -= boxSize[1] * Math.round(rji_y / boxSize[1]);
    rji_z -= boxSize[2] * Math.round(rji_z / boxSize[2]);

    rjk_x -= boxSize[0] * Math.round(rjk_x / boxSize[0]);
    rjk_y -= boxSize[1] * Math.round(rjk_y / boxSize[1]);
    rjk_z -= boxSize[2] * Math.round(rjk_z / boxSize[2]);
  }

  const rji2 = rji_x * rji_x + rji_y * rji_y + rji_z * rji_z;
  const rjk2 = rjk_x * rjk_x + rjk_y * rjk_y + rjk_z * rjk_z;

  if (rji2 < 1e-20 || rjk2 < 1e-20) return 0;

  const invRji2 = 1.0 / rji2;
  const invRjk2 = 1.0 / rjk2;
  const invRji = Math.sqrt(invRji2);
  const invRjk = Math.sqrt(invRjk2);

  const dot = rji_x * rjk_x + rji_y * rjk_y + rji_z * rjk_z;
  const cosTheta = dot * invRji * invRjk;

  // Clamp for safety
  const cosT = Math.max(-0.999999, Math.min(0.999999, cosTheta));

  // ---- Compute energy and dV/d(cosθ) depending on angle type ----
  let energy: number;
  let dVdcos: number;

  if (theta0 > LINEAR_THRESHOLD) {
    // Linear penalty: V = kA * (1 + cosθ)
    // dV/d(cosθ) = kA
    // At θ=180° (cosθ=−1): V=0, but any deviation gives V>0 and a
    // restoring force proportional to sinθ.
    energy = k_angle * (1.0 + cosT);
    dVdcos = k_angle;
  } else {
    // General cosine-based potential: V = 0.5 * kcos * (cosθ − cosθ₀)²
    const cosTheta0 = Math.cos(theta0);
    const sinTheta0 = Math.sin(theta0);
    const kcos = k_angle / Math.max(sinTheta0 * sinTheta0, 0.01);
    const dcos = cosT - cosTheta0;
    energy = 0.5 * kcos * dcos * dcos;
    dVdcos = kcos * dcos;
  }

  // d(cosθ)/dr_i = (r_jk/(|r_ji|*|r_jk|)) - cosθ * (r_ji/|r_ji|²)
  //             = invRjk * (rjk_hat) - cosT * invRji * (rji_hat)
  //             divided by |r_ji| gives the spatial gradient

  // Force on i: F_i = -dV/d(cosθ) * d(cosθ)/dr_i
  const fi_x = -dVdcos * (rjk_x * invRji * invRjk - cosT * rji_x * invRji2);
  const fi_y = -dVdcos * (rjk_y * invRji * invRjk - cosT * rji_y * invRji2);
  const fi_z = -dVdcos * (rjk_z * invRji * invRjk - cosT * rji_z * invRji2);

  // Force on k: F_k = -dV/d(cosθ) * d(cosθ)/dr_k (symmetric)
  const fk_x = -dVdcos * (rji_x * invRji * invRjk - cosT * rjk_x * invRjk2);
  const fk_y = -dVdcos * (rji_y * invRji * invRjk - cosT * rjk_y * invRjk2);
  const fk_z = -dVdcos * (rji_z * invRji * invRjk - cosT * rjk_z * invRjk2);

  // Force on j = -(F_i + F_k) by Newton's third law
  forces[i3] += fi_x;
  forces[i3 + 1] += fi_y;
  forces[i3 + 2] += fi_z;

  forces[k3] += fk_x;
  forces[k3 + 1] += fk_y;
  forces[k3 + 2] += fk_z;

  forces[j3] -= fi_x + fk_x;
  forces[j3 + 1] -= fi_y + fk_y;
  forces[j3 + 2] -= fi_z + fk_z;

  return energy;
}
