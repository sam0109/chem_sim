// ==============================================================
// Soft-core Lennard-Jones potential for alchemical free energy
// perturbation (FEP) calculations.
//
// Avoids the r→0 singularity of standard LJ by replacing r⁶ with
// a smoothed effective distance:
//   r_eff⁶ = α·σ⁶·λ^p + r⁶
//
// V_sc(r,λ) = 4ε·λⁿ · [ 1/(r_eff⁶/σ⁶)² − 1/(r_eff⁶/σ⁶) ]
//
// For linear coupling (n=1) this becomes:
//   V_sc(r,λ) = 4ε·λ · [ σ¹²/(r_eff⁶)² − σ⁶/r_eff⁶ ]
//
// At λ=1, α·σ⁶·1 + r⁶ → σ⁶ + r⁶ ≈ r⁶ for r >> σ^{1/6}·α^{1/6},
// recovering standard LJ in the physical region.
// At λ=0, V_sc → 0 smoothly (no singularity).
//
// Reference: Beutler et al., Chem. Phys. Lett. 222, 529 (1994), Eq. 3
// Also: Steinbrecher et al., J. Comput. Chem. 32, 3253 (2011)
// ==============================================================

import type { Vector3Tuple } from '../../data/types';

/**
 * Compute soft-core LJ force between two atoms and accumulate into
 * force arrays. Returns the potential energy contribution (eV) and
 * the derivative ∂V/∂λ (eV) for thermodynamic integration.
 *
 * Uses linear λ-coupling (n=1) as recommended by Steinbrecher et al.
 *
 * @param positions flat position array [x0,y0,z0,x1,y1,z1,...]
 * @param forces    flat force array (accumulated)
 * @param i         atom index A
 * @param j         atom index B
 * @param sigma     LJ sigma (Å)
 * @param epsilon   LJ epsilon (eV)
 * @param lambda    coupling parameter [0,1]
 * @param alpha     soft-core α (dimensionless, typically 0.5)
 * @param p         soft-core power (typically 1)
 * @param cutoff    interaction cutoff (Å)
 * @param boxSize   box dimensions for PBC minimum image (undefined = no PBC)
 * @returns [energy (eV), dV/dλ (eV)]
 */
export function softCoreLJForce(
  positions: Float64Array,
  forces: Float64Array,
  i: number,
  j: number,
  sigma: number,
  epsilon: number,
  lambda: number,
  alpha: number,
  p: number,
  cutoff: number,
  boxSize?: Vector3Tuple,
): [number, number] {
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

  // Cutoff check (use geometric distance, not effective distance)
  if (r2 > cutoff * cutoff || r2 < 1e-20) return [0, 0];

  // Fully decoupled: no interaction at λ=0
  if (lambda < 1e-14) return [0, 0];

  const sigma2 = sigma * sigma;
  const sigma6 = sigma2 * sigma2 * sigma2;
  const r6 = r2 * r2 * r2;

  // Effective distance: r_eff⁶ = α·σ⁶·λ^p + r⁶
  // Reference: Beutler et al., Chem. Phys. Lett. 222, 529 (1994), Eq. 3
  const lambdaP = p === 1 ? lambda : Math.pow(lambda, p);
  const rEff6 = alpha * sigma6 * lambdaP + r6;

  // Avoid division by extremely small values
  if (rEff6 < 1e-30) return [0, 0];

  // Dimensionless ratios: s = σ⁶/r_eff⁶
  const s = sigma6 / rEff6;
  const s2 = s * s;

  // Energy: V = 4ε·λ·(s² − s) = 4ε·λ·s·(s − 1)
  const energy = 4.0 * epsilon * lambda * (s2 - s);

  // --- Force: F = −∂V/∂r · (r_vec/r) ---
  // ∂V/∂r = 4ε·λ · (2s² − s) · (−6r⁵/r_eff⁶) · (1/r)
  //        = −24ε·λ·r⁴/r_eff⁶ · (2s² − s)
  // But: ∂V/∂(r²) = ∂V/∂r · 1/(2r), so we compute ∂V/∂(r²) instead
  // and multiply by displacement vector.
  //
  // ∂(r_eff⁶)/∂(r²) = 3r⁴ = 3·(r²)²
  // ∂s/∂(r²) = −σ⁶/(r_eff⁶)² · 3r⁴ = −s/r_eff⁶ · 3r⁴
  // ∂V/∂(r²) = 4ε·λ·(2s−1)·∂s/∂(r²)
  //           = 4ε·λ·(2s−1)·(−3·s·r⁴/r_eff⁶)
  //           = −12ε·λ·s·(2s−1)·r⁴/r_eff⁶
  //
  // F_x = −∂V/∂x = −∂V/∂(r²) · 2·dx
  //      = 24ε·λ·s·(2s−1)·r⁴/(r_eff⁶) · dx
  const r4 = r2 * r2;
  const fPrefactor =
    (24.0 * epsilon * lambda * s * (2.0 * s - 1.0) * r4) / rEff6;

  const fx = fPrefactor * dx;
  const fy = fPrefactor * dy;
  const fz = fPrefactor * dz;

  // Newton's third law
  forces[i3] -= fx;
  forces[i3 + 1] -= fy;
  forces[i3 + 2] -= fz;
  forces[j3] += fx;
  forces[j3 + 1] += fy;
  forces[j3 + 2] += fz;

  // --- ∂V/∂λ for thermodynamic integration ---
  // V = 4ε·λ·(s² − s), where s = σ⁶/r_eff⁶ and r_eff⁶ = α·σ⁶·λ^p + r⁶
  //
  // ∂V/∂λ = 4ε·(s² − s) + 4ε·λ·∂(s² − s)/∂λ
  //
  // ∂s/∂λ = −σ⁶·α·σ⁶·p·λ^(p-1)/(r_eff⁶)²
  //        = −s · α·σ⁶·p·λ^(p-1) / r_eff⁶
  //
  // ∂(s²−s)/∂λ = (2s−1)·∂s/∂λ
  //
  // ∂V/∂λ = 4ε·(s²−s) + 4ε·λ·(2s−1)·∂s/∂λ
  const dLambdaP = p === 1 ? 1.0 : p * Math.pow(lambda, p - 1);
  const dsdLambda = (-s * alpha * sigma6 * dLambdaP) / rEff6;
  const dVdLambda =
    4.0 * epsilon * (s2 - s) +
    4.0 * epsilon * lambda * (2.0 * s - 1.0) * dsdLambda;

  return [energy, dVdLambda];
}
