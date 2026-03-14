// ==============================================================
// Harmonic angle potential
// V(θ) = 0.5 * k * (θ - θ₀)²
// ==============================================================

/**
 * Compute angle bending force using cosine-based potential:
 *   V = 0.5 * k * (cosθ - cosθ₀)²
 *
 * This avoids the acos singularity and 1/sin(θ) division
 * that causes numerical instability near θ=0 or θ=π.
 *
 * The force constant k_cos relates to harmonic k_angle as:
 *   k_cos ≈ k_angle / sin²(θ₀) for small displacements
 *
 * @param positions  flat position array
 * @param forces     flat force array (accumulated)
 * @param i          terminal atom 1
 * @param j          central atom (vertex)
 * @param k          terminal atom 2
 * @param k_angle    force constant (eV/rad²) — converted internally
 * @param theta0     equilibrium angle (radians)
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
): number {
  const i3 = i * 3;
  const j3 = j * 3;
  const k3 = k * 3;

  // Vectors from central atom j
  const rji_x = positions[i3] - positions[j3];
  const rji_y = positions[i3 + 1] - positions[j3 + 1];
  const rji_z = positions[i3 + 2] - positions[j3 + 2];

  const rjk_x = positions[k3] - positions[j3];
  const rjk_y = positions[k3 + 1] - positions[j3 + 1];
  const rjk_z = positions[k3 + 2] - positions[j3 + 2];

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
  const cosTheta0 = Math.cos(theta0);

  // Cosine-based potential: V = 0.5 * kcos * (cosθ - cosθ₀)²
  // where kcos = k_angle / sin²(θ₀) to match harmonic behavior near θ₀
  const sinTheta0 = Math.sin(theta0);
  const kcos = k_angle / Math.max(sinTheta0 * sinTheta0, 0.01);

  const dcos = cosT - cosTheta0;
  const energy = 0.5 * kcos * dcos * dcos;

  // dV/d(cosθ) = kcos * (cosθ - cosθ₀)
  const dVdcos = kcos * dcos;

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
