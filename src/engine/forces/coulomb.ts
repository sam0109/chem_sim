// ==============================================================
// Coulomb potential for electrostatic interactions
// V(r) = k_e * q_i * q_j / r
// Uses Wolf summation (damped shifted) for finite cutoff
// ==============================================================

// Coulomb constant in eV·Å/e² (e = elementary charge)
const KE = 14.3996; // eV·Å per e²

/**
 * Compute Coulomb force between two atoms using damped shifted potential.
 * Wolf summation: V(r) = k_e * qi * qj * [erfc(α*r)/r - erfc(α*rc)/rc]
 *
 * For simplicity, we use a simple shifted Coulomb (α=0):
 * V(r) = k_e * qi * qj * [1/r - 1/rc]
 *
 * @param positions flat position array
 * @param forces    flat force array (accumulated)
 * @param i         atom index A
 * @param j         atom index B
 * @param qi        charge of atom i (elementary charges)
 * @param qj        charge of atom j (elementary charges)
 * @param cutoff    interaction cutoff (Å)
 */
export function coulombForce(
  positions: Float64Array,
  forces: Float64Array,
  i: number,
  j: number,
  qi: number,
  qj: number,
  cutoff: number,
): number {
  if (Math.abs(qi) < 1e-10 || Math.abs(qj) < 1e-10) return 0;

  const i3 = i * 3;
  const j3 = j * 3;

  const dx = positions[j3] - positions[i3];
  const dy = positions[j3 + 1] - positions[i3 + 1];
  const dz = positions[j3 + 2] - positions[i3 + 2];

  const r2 = dx * dx + dy * dy + dz * dz;
  const rc2 = cutoff * cutoff;

  if (r2 > rc2 || r2 < 1e-10) return 0;

  const r = Math.sqrt(r2);
  const invR = 1.0 / r;

  // Shifted Coulomb: V(r) = k_e * qi * qj * (1/r - 1/rc)
  const energy = KE * qi * qj * (invR - 1.0 / cutoff);

  // Force: F = k_e * qi * qj / r² * (r_vec/r)
  const fMag = KE * qi * qj * invR * invR * invR;

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

export { KE };
