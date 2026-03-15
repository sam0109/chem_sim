// ==============================================================
// Inversion (out-of-plane / improper torsion) potential
//
// V(ω) = K · [C0 + C1·cos(ω) + C2·cos(2ω)]
//
// where ω is the Wilson angle — the angle between the bond
// j→i and the plane defined by atoms j, k, l. The center
// atom is j; i is the out-of-plane atom; k and l (with j)
// define the reference plane.
//
// Source: Rappé, Casewit, Colwell, Goddard, Skiff
//         JACS 114, 10024 (1992), Eq. 17
//
// The Wilson angle is defined as:
//   sin(ω) = (r_ji · n̂) / |r_ji|
// where n̂ is the unit normal to the plane j-k-l:
//   n̂ = (r_jk × r_jl) / |r_jk × r_jl|
//
// Analytical forces derived via chain rule through the
// sin(ω) expression.
// ==============================================================

/**
 * Compute inversion force and energy for center j with i out-of-plane.
 *
 * @param positions  flat position array [x0,y0,z0,x1,y1,z1,...]
 * @param forces     flat force array (accumulated)
 * @param i          out-of-plane atom
 * @param j          central atom (bonded to i, k, and l)
 * @param k          in-plane atom 1
 * @param l          in-plane atom 2
 * @param K          force constant in eV (already divided by termsPerCenter)
 * @param C0         cosine expansion coefficient 0
 * @param C1         cosine expansion coefficient 1
 * @param C2         cosine expansion coefficient 2
 * @returns potential energy in eV
 */
export function inversionForce(
  positions: Float64Array,
  forces: Float64Array,
  i: number,
  j: number,
  k: number,
  l: number,
  K: number,
  C0: number,
  C1: number,
  C2: number,
): number {
  if (K === 0) return 0;

  const i3 = i * 3;
  const j3 = j * 3;
  const k3 = k * 3;
  const l3 = l * 3;

  // Vectors from center j to neighbors
  const rji_x = positions[i3] - positions[j3];
  const rji_y = positions[i3 + 1] - positions[j3 + 1];
  const rji_z = positions[i3 + 2] - positions[j3 + 2];

  const rjk_x = positions[k3] - positions[j3];
  const rjk_y = positions[k3 + 1] - positions[j3 + 1];
  const rjk_z = positions[k3 + 2] - positions[j3 + 2];

  const rjl_x = positions[l3] - positions[j3];
  const rjl_y = positions[l3 + 1] - positions[j3 + 1];
  const rjl_z = positions[l3 + 2] - positions[j3 + 2];

  // Normal to plane j-k-l: n = rjk × rjl
  const nx = rjk_y * rjl_z - rjk_z * rjl_y;
  const ny = rjk_z * rjl_x - rjk_x * rjl_z;
  const nz = rjk_x * rjl_y - rjk_y * rjl_x;

  const nLen2 = nx * nx + ny * ny + nz * nz;
  if (nLen2 < 1e-20) return 0; // degenerate plane

  const nLen = Math.sqrt(nLen2);
  const rjiLen2 = rji_x * rji_x + rji_y * rji_y + rji_z * rji_z;
  if (rjiLen2 < 1e-20) return 0;

  const rjiLen = Math.sqrt(rjiLen2);

  // sin(ω) = (r_ji · n̂) / |r_ji|
  // where n̂ = n / |n|
  const rji_dot_n = rji_x * nx + rji_y * ny + rji_z * nz;
  const sinW = rji_dot_n / (rjiLen * nLen);
  // Clamp to [-1, 1] for numerical safety
  const sinWc = Math.max(-1, Math.min(1, sinW));

  // cos(ω) = sqrt(1 - sin²(ω))
  // ω is always in [-π/2, π/2], so cos(ω) ≥ 0
  const cosW = Math.sqrt(Math.max(0, 1 - sinWc * sinWc));

  // cos(2ω) = 1 - 2·sin²(ω)
  const cos2W = 1 - 2 * sinWc * sinWc;

  // Energy: V(ω) = K · [C0 + C1·cos(ω) + C2·cos(2ω)]
  const energy = K * (C0 + C1 * cosW + C2 * cos2W);

  // dV/dω = K · [-C1·sin(ω) - 2·C2·sin(2ω)]
  //       = K · [-C1·sin(ω) - 4·C2·sin(ω)·cos(ω)]
  //       = K · sin(ω) · [-C1 - 4·C2·cos(ω)]
  //
  // For the chain rule: we need dV/d(sinω) rather than dV/dω.
  // Since dV/dω = dV/d(sinω) · d(sinω)/dω = dV/d(sinω) · cos(ω),
  // we get: dV/d(sinω) = dV/dω / cos(ω)
  //
  // But it's cleaner to work with the derivatives of cos(ω) and cos(2ω)
  // w.r.t. sinW directly:
  //   d(cosω)/d(sinω) = -sinω/cosω  (when cosω ≠ 0)
  //   d(cos2ω)/d(sinω) = -4·sinω
  //
  // So dV/d(sinω) = K·[C1·(-sinω/cosω) + C2·(-4·sinω)]
  //               = -K·sinω·[C1/cosω + 4·C2]
  //
  // To avoid division by cosω when near ω = ±π/2 (extremely unlikely
  // in physical simulations), we multiply through by cosω and use the
  // chain-rule form: dV/dω = K·sinω·(-C1 - 4·C2·cosω).
  // Then compute forces via dω/dr using the relationship:
  //   d(sinω)/dr = d[(r_ji · n) / (|r_ji|·|n|)] / dr

  // For the gradient, it's numerically simplest to differentiate
  // sinW = (rji · n) / (rjiLen · nLen) w.r.t. each coordinate,
  // then multiply by dV/d(sinW).
  //
  // dV/d(sinW):
  // V = K*(C0 + C1*cosW + C2*cos2W)
  //   = K*(C0 + C1*sqrt(1-sinW^2) + C2*(1-2*sinW^2))
  // dV/d(sinW) = K*(-C1*sinW/cosW - 4*C2*sinW)
  //
  // When cosW is very small, the C1 term can diverge, but this would
  // mean the system is nearly at ω = ±90° which is extremely high energy.
  // We guard against it.
  const EPS_COS = 1e-8;
  let dVdSinW: number;
  if (cosW > EPS_COS) {
    dVdSinW = K * ((-C1 * sinWc) / cosW - 4 * C2 * sinWc);
  } else {
    // Near ω = ±90°, use dV/dω form and convert
    // dV/dω ≈ K·sinW·(-C1 - 4·C2·cosW) → ~ K·(±1)·(-C1)
    // dω/d(sinW) = 1/cosW → ∞, but physical forces are still finite
    // because dV/dω → 0 as cosW → 0 for well-behaved C1.
    // Use a regularized form:
    dVdSinW = K * ((-C1 * sinWc) / Math.max(cosW, EPS_COS) - 4 * C2 * sinWc);
  }

  // Now compute d(sinW)/d(pos) for each atom.
  // sinW = (rji · n) / (rjiLen · nLen) where n = rjk × rjl
  //
  // Let S = rji · n, A = rjiLen, B = nLen
  // sinW = S / (A · B)
  //
  // d(sinW)/d(pos_i): only rji depends on pos_i
  //   dS/d(pos_i) = n (since rji = pos_i - pos_j)
  //   dA/d(pos_i) = rji / rjiLen
  //   d(sinW)/d(pos_i) = [n / (A·B)] - [sinW · (rji / rjiLen²)]
  //                     = [n - sinW · A · (rji / A)] / (A · B)
  //                     = [n/B - sinW · rji/A] / A
  //
  // d(sinW)/d(pos_k): only rjk depends on pos_k (via n = rjk × rjl)
  //   dn/d(pos_k) acts on the cross product: d(rjk × rjl)/d(pos_k) · v = v × rjl
  //   Wait, let's be more careful:
  //   rjk = pos_k - pos_j, so d(rjk)/d(pos_k) = I (identity)
  //   d(n)/d(pos_k) = d(rjk × rjl)/d(rjk) applied as: for a displacement δ in pos_k,
  //     δn = δrjk × rjl = δ × rjl
  //   So for component α: dn_α/d(pos_k_β) = ε_{αβγ} · rjl_γ (Levi-Civita)
  //   dS/d(pos_k) = rji · (dn/d(pos_k)) → componentwise:
  //     dS/d(pos_k_β) = rji_α · ε_{αβγ} · rjl_γ = (rjl × rji)_β
  //   So dS/d(pos_k) = rjl × rji
  //
  //   dB/d(pos_k) = (n · dn/d(pos_k)) / B → for component β:
  //     dB/d(pos_k_β) = n_α · ε_{αβγ} · rjl_γ / B = (rjl × n)_β / B... wait,
  //     Actually: n_α · ε_{αβγ} · rjl_γ = (n × rjl)... let me use vector identities.
  //
  // This is getting complex. Let me use a cleaner formulation.
  // We define: sinW = S/(A*B)
  // d(sinW) = dS/(A*B) - S*dA/(A²*B) - S*dB/(A*B²)
  //         = [dS - sinW*A*dA/A - sinW*B*dB/B] / (A*B)
  //         = [dS - sinW*(rji/A)·drji*A - sinW*(n/B)·dn*B... hmm]
  //
  // Actually let me use the direct per-atom formulation.

  const invAB = 1 / (rjiLen * nLen);

  // ---- Forces on atom i (OOP atom) ----
  // d(sinW)/d(pos_i) = [n/(rjiLen*nLen)] - sinW * [rji / rjiLen²]
  //   = invAB * n - (sinW / rjiLen²) * rji
  const dSdI_x = invAB * nx - (sinWc / rjiLen2) * rji_x;
  const dSdI_y = invAB * ny - (sinWc / rjiLen2) * rji_y;
  const dSdI_z = invAB * nz - (sinWc / rjiLen2) * rji_z;

  // ---- Forces on atom k (in-plane atom 1) ----
  // n = rjk × rjl, so dn = d(rjk) × rjl when varying pos_k
  // dS/d(pos_k) = (rjl × rji) [from rji · (δ × rjl) = δ · (rjl × rji)]
  // dB/d(pos_k): B = |n|, dB = (n/B) · dn = (n/(B)) · (δ × rjl)
  //   For a general δ: n · (δ × rjl) = δ · (rjl × n)
  //   So dB/d(pos_k) = (rjl × n) / B

  // rjl × rji
  const rjlXrji_x = rjl_y * rji_z - rjl_z * rji_y;
  const rjlXrji_y = rjl_z * rji_x - rjl_x * rji_z;
  const rjlXrji_z = rjl_x * rji_y - rjl_y * rji_x;

  // rjl × n
  const rjlXn_x = rjl_y * nz - rjl_z * ny;
  const rjlXn_y = rjl_z * nx - rjl_x * nz;
  const rjlXn_z = rjl_x * ny - rjl_y * nx;

  // d(sinW)/d(pos_k) = [rjl×rji / (A*B)] - sinW * [rjl×n / (A*B²)]
  //                   = invAB * [rjl×rji - sinW * rjl×n / B]
  //   Wait, more precisely:
  //   d(sinW)/d(pos_k) = dS/(A*B) - S * dB / (A*B²)
  //   = (rjl×rji)/(A*B) - sinW * (rjl×n) / (A*B*B)
  //   = invAB * (rjl×rji) - (sinW/nLen2) * (rjl×n)
  // Hmm, let me redo this more carefully.
  //
  // d(sinW)/d(pos_k) = d/d(pos_k) [S / (A*B)]
  //   = (dS/d(pos_k)) / (A*B) - S/(A²*B) * (dA/d(pos_k)) - S/(A*B²) * (dB/d(pos_k))
  //
  // dA/d(pos_k) = 0  (A = |rji|, pos_k doesn't affect rji)
  //
  // dS/d(pos_k) = rjl × rji  (derived above)
  // dB/d(pos_k) = (rjl × n) / B  (derived above)
  //
  // So: d(sinW)/d(pos_k) = (rjl×rji) / (A*B) - [S / (A*B²)] * (rjl×n) / B
  //   = invAB * (rjl×rji) - sinW * (rjl×n) / nLen2

  const dSdK_x = invAB * rjlXrji_x - (sinWc / nLen2) * rjlXn_x;
  const dSdK_y = invAB * rjlXrji_y - (sinWc / nLen2) * rjlXn_y;
  const dSdK_z = invAB * rjlXrji_z - (sinWc / nLen2) * rjlXn_z;

  // ---- Forces on atom l (in-plane atom 2) ----
  // Symmetric to k but with rjk instead of rjl in the cross products.
  // n = rjk × rjl, dn/d(pos_l) uses d(rjl)/d(pos_l) = I:
  //   dn = rjk × d(rjl) = rjk × δ
  // dS/d(pos_l) = rji · (rjk × δ) = δ · (rji × rjk)
  //   So dS/d(pos_l) = rji × rjk

  // rji × rjk
  const rjiXrjk_x = rji_y * rjk_z - rji_z * rjk_y;
  const rjiXrjk_y = rji_z * rjk_x - rji_x * rjk_z;
  const rjiXrjk_z = rji_x * rjk_y - rji_y * rjk_x;

  // dB/d(pos_l) = (n · (rjk × δ)) / B = δ · (n × rjk) / B... wait:
  //   n · (rjk × δ) = δ · (n × rjk)... no, it's n · (rjk × δ) = -δ · (rjk × n)
  //   Actually: a · (b × c) = c · (a × b), so
  //   n · (rjk × δ) = δ · (n × rjk)
  //   Hmm, triple product: a · (b × c) = b · (c × a) = c · (a × b)
  //   So n · (rjk × δ) = rjk · (δ × n) = δ · (n × rjk)

  // Wait, let me just compute. dB/d(pos_l):
  //   B = |n|, dB = n·dn / B
  //   dn/d(pos_l) acts as: dn = rjk × d(rjl) = rjk × δ
  //   n·(rjk × δ) = δ·(n × rjk) ... checking: BAC-CAB rule on scalar triple product
  //   a·(b×c) = b·(c×a) = c·(a×b)
  //   n·(rjk×δ) = rjk·(δ×n) = δ·(n×rjk)
  //   So dB/d(pos_l) = (n × rjk) / B

  // n × rjk
  const nXrjk_x = ny * rjk_z - nz * rjk_y;
  const nXrjk_y = nz * rjk_x - nx * rjk_z;
  const nXrjk_z = nx * rjk_y - ny * rjk_x;

  const dSdL_x = invAB * rjiXrjk_x - (sinWc / nLen2) * nXrjk_x;
  const dSdL_y = invAB * rjiXrjk_y - (sinWc / nLen2) * nXrjk_y;
  const dSdL_z = invAB * rjiXrjk_z - (sinWc / nLen2) * nXrjk_z;

  // ---- Forces on atom j (center) ----
  // By translational invariance: F_j = -(F_i + F_k + F_l)
  const dSdJ_x = -(dSdI_x + dSdK_x + dSdL_x);
  const dSdJ_y = -(dSdI_y + dSdK_y + dSdL_y);
  const dSdJ_z = -(dSdI_z + dSdK_z + dSdL_z);

  // Force = -dV/dr = -dV/d(sinW) · d(sinW)/dr
  const neg_dVdSinW = -dVdSinW;

  forces[i3] += neg_dVdSinW * dSdI_x;
  forces[i3 + 1] += neg_dVdSinW * dSdI_y;
  forces[i3 + 2] += neg_dVdSinW * dSdI_z;

  forces[j3] += neg_dVdSinW * dSdJ_x;
  forces[j3 + 1] += neg_dVdSinW * dSdJ_y;
  forces[j3 + 2] += neg_dVdSinW * dSdJ_z;

  forces[k3] += neg_dVdSinW * dSdK_x;
  forces[k3 + 1] += neg_dVdSinW * dSdK_y;
  forces[k3 + 2] += neg_dVdSinW * dSdK_z;

  forces[l3] += neg_dVdSinW * dSdL_x;
  forces[l3 + 1] += neg_dVdSinW * dSdL_y;
  forces[l3 + 2] += neg_dVdSinW * dSdL_z;

  return energy;
}
