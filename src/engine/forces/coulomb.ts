// ==============================================================
// Wolf summation for electrostatic interactions
// Damped shifted-force (DSF) variant for finite cutoff
//
// Reference: Wolf et al., J. Chem. Phys. 110, 8254 (1999)
//            Fennell & Gezelter, J. Chem. Phys. 124, 234104 (2006)
//
// The DSF potential ensures both energy and force go continuously
// to zero at the cutoff, eliminating the force discontinuity of
// the simple shifted Coulomb potential.
// ==============================================================

import { erfc } from '../math';

// Coulomb constant in eV·Å/e² (e = elementary charge)
// Source: NIST CODATA 2018 — k_e = 14.3996 eV·Å/e²
const KE = 14.3996; // eV·Å per e²

// 2/√π, precomputed for the Gaussian damping term
const TWO_OVER_SQRT_PI = 2.0 / Math.sqrt(Math.PI);

/**
 * Compute the Wolf damping parameter α from the cutoff distance.
 *
 * A common heuristic is α = π/rc (Zhu & Wolf, 2002), but for
 * small cutoffs this over-damps. We use α = 0.2 Å⁻¹ for rc ≥ 8 Å,
 * scaling up for smaller cutoffs to maintain erfc(α·rc) ≈ 0.046.
 *
 * Reference: Fennell & Gezelter, J. Chem. Phys. 124, 234104 (2006),
 *            recommend α such that erfc(α·rc) ~ 10⁻² to 10⁻⁵
 */
export function wolfAlpha(cutoff: number): number {
  // α·rc = 2.0 gives erfc(2.0) ≈ 0.0047, a good balance of
  // accuracy vs. minimal damping for molecular simulations.
  // Source: Fennell & Gezelter (2006), §III.A
  return 2.0 / cutoff;
}

/**
 * Precomputed constants for a given (alpha, cutoff) pair.
 * Avoids redundant computation per pair interaction.
 */
export interface WolfConstants {
  /** Damping parameter α (Å⁻¹) */
  alpha: number;
  /** Cutoff distance rc (Å) */
  cutoff: number;
  /** erfc(α·rc) / rc — shifted energy constant */
  erfcAlphaRc_over_rc: number;
  /** Force-shift constant: erfc(α·rc)/rc² + (2α/√π)·exp(-α²·rc²)/rc */
  forceShift: number;
}

/**
 * Precompute Wolf summation constants for a given cutoff.
 * Call once when cutoff changes, reuse for all pair interactions.
 */
export function computeWolfConstants(cutoff: number): WolfConstants {
  const alpha = wolfAlpha(cutoff);
  const alphaRc = alpha * cutoff;
  const erfcVal = erfc(alphaRc);
  const expVal = Math.exp(-alphaRc * alphaRc);

  return {
    alpha,
    cutoff,
    erfcAlphaRc_over_rc: erfcVal / cutoff,
    forceShift:
      erfcVal / (cutoff * cutoff) +
      (TWO_OVER_SQRT_PI * alpha * expVal) / cutoff,
  };
}

/**
 * Compute the Wolf self-energy correction for the system.
 *
 * V_self = -KE * [erfc(α·rc)/(2·rc) + α/√π] * Σᵢ qᵢ²
 *
 * This is a constant offset that depends only on the charges and
 * Wolf parameters, not on positions. It must be included for
 * correct absolute energies but does not affect forces.
 *
 * @param charges  Array of atomic charges (elementary charges)
 * @param nAtoms   Number of atoms
 * @param wc       Precomputed Wolf constants
 * @returns Self-energy correction (eV) — always negative for nonzero charges
 */
export function wolfSelfEnergy(
  charges: Float64Array | number[],
  nAtoms: number,
  wc: WolfConstants,
): number {
  let sumQ2 = 0;
  for (let i = 0; i < nAtoms; i++) {
    sumQ2 += charges[i] * charges[i];
  }
  if (sumQ2 < 1e-20) return 0;

  // Self-energy coefficient: erfc(α·rc)/(2·rc) + α/√π
  const selfCoeff =
    wc.erfcAlphaRc_over_rc / 2.0 + wc.alpha / Math.sqrt(Math.PI);

  return -KE * selfCoeff * sumQ2;
}

/**
 * Compute Wolf damped shifted-force Coulomb interaction between two atoms.
 *
 * Energy:
 *   V(r) = KE·qi·qj·[erfc(α·r)/r - erfc(α·rc)/rc
 *          + (erfc(α·rc)/rc² + 2α/√π·exp(-α²rc²)/rc)·(r - rc)]
 *
 * Force (on atom i, toward j):
 *   F(r) = KE·qi·qj·[erfc(α·r)/r² + 2α/√π·exp(-α²r²)/r - forceShift] / r
 *
 * Both V(rc) = 0 and F(rc) = 0 by construction.
 *
 * @param positions  Flat position array [x0,y0,z0,x1,y1,z1,...]
 * @param forces     Flat force array (accumulated)
 * @param i          Atom index A
 * @param j          Atom index B
 * @param qi         Charge of atom i (elementary charges)
 * @param qj         Charge of atom j (elementary charges)
 * @param wc         Precomputed Wolf constants
 * @returns Pair potential energy contribution (eV)
 */
export function coulombForce(
  positions: Float64Array,
  forces: Float64Array,
  i: number,
  j: number,
  qi: number,
  qj: number,
  wc: WolfConstants,
): number {
  if (Math.abs(qi) < 1e-10 || Math.abs(qj) < 1e-10) return 0;

  const i3 = i * 3;
  const j3 = j * 3;

  const dx = positions[j3] - positions[i3];
  const dy = positions[j3 + 1] - positions[i3 + 1];
  const dz = positions[j3 + 2] - positions[i3 + 2];

  const r2 = dx * dx + dy * dy + dz * dz;
  const rc2 = wc.cutoff * wc.cutoff;

  if (r2 > rc2 || r2 < 1e-10) return 0;

  const r = Math.sqrt(r2);
  const invR = 1.0 / r;
  const alphaR = wc.alpha * r;

  // Damped Coulomb terms at distance r
  const erfcAlphaR = erfc(alphaR);
  const expAlphaR2 = Math.exp(-alphaR * alphaR);

  // Shifted-force energy: V(r) = KE·qi·qj·[A(r) - A(rc) + A'(rc)·(r - rc)]
  // where A(r) = erfc(α·r)/r
  const qiqj = qi * qj;
  const energy =
    KE *
    qiqj *
    (erfcAlphaR * invR -
      wc.erfcAlphaRc_over_rc +
      wc.forceShift * (r - wc.cutoff));

  // Force magnitude: F_r = -dV/dr
  // dV/dr = KE·qi·qj·[-erfc(α·r)/r² - 2α/√π·exp(-α²r²)/r + forceShift]
  // F_r = KE·qi·qj·[erfc(α·r)/r² + 2α/√π·exp(-α²r²)/r - forceShift]
  const fScalar =
    KE *
    qiqj *
    (erfcAlphaR * invR * invR +
      TWO_OVER_SQRT_PI * wc.alpha * expAlphaR2 * invR -
      wc.forceShift);

  // Project force along r_ij direction: F_vec = fScalar * r_hat = fScalar * (r_vec / r)
  const fOverR = fScalar * invR;
  const fx = fOverR * dx;
  const fy = fOverR * dy;
  const fz = fOverR * dz;

  forces[i3] -= fx;
  forces[i3 + 1] -= fy;
  forces[i3 + 2] -= fz;
  forces[j3] += fx;
  forces[j3 + 1] += fy;
  forces[j3 + 2] += fz;

  return energy;
}

export { KE };
