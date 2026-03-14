// ==============================================================
// Morse potential for covalent bonds
// V(r) = De * [1 - exp(-a*(r - re))]^2
// F(r) = 2 * De * a * [1 - exp(-a*(r - re))] * exp(-a*(r - re)) * (r_vec/r)
// ==============================================================

/**
 * Compute Morse bond force between two atoms and add to force arrays.
 * Returns the potential energy contribution (eV).
 *
 * @param positions flat position array [x0,y0,z0,x1,y1,z1,...]
 * @param forces    flat force array (accumulated)
 * @param i         index of atom A
 * @param j         index of atom B
 * @param De        dissociation energy (eV)
 * @param alpha     Morse width parameter (1/Å)
 * @param re        equilibrium bond length (Å)
 */
export function morseBondForce(
  positions: Float64Array,
  forces: Float64Array,
  i: number,
  j: number,
  De: number,
  alpha: number,
  re: number,
): number {
  const i3 = i * 3;
  const j3 = j * 3;

  const dx = positions[j3] - positions[i3];
  const dy = positions[j3 + 1] - positions[i3 + 1];
  const dz = positions[j3 + 2] - positions[i3 + 2];

  const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (r < 1e-10) return 0;

  const expTerm = Math.exp(-alpha * (r - re));
  const oneMinusExp = 1.0 - expTerm;

  // Potential energy
  const energy = De * oneMinusExp * oneMinusExp;

  // Force magnitude: dV/dr = 2 * De * alpha * (1 - exp) * exp
  // F = -dV/dr * (r_vec / r)  → points from j toward i when stretched
  const dVdr = 2.0 * De * alpha * oneMinusExp * expTerm;
  const fMag = -dVdr / r;

  const fx = fMag * dx;
  const fy = fMag * dy;
  const fz = fMag * dz;

  // Newton's third law
  forces[i3] -= fx;
  forces[i3 + 1] -= fy;
  forces[i3 + 2] -= fz;
  forces[j3] += fx;
  forces[j3 + 1] += fy;
  forces[j3 + 2] += fz;

  return energy;
}
