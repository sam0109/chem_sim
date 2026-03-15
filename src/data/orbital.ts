// ==============================================================
// Hydrogen-like atomic orbital wavefunction computation
//
// Computes psi(r,theta,phi) = R_nl(r) * Y_lm(theta,phi) for
// hydrogen-like atoms using Slater effective nuclear charges for
// multi-electron atoms.
//
// Supports orbitals: 1s, 2s, 2p, 3s, 3p, 3d (covers general chemistry)
//
// References:
//   - Griffiths, "Introduction to Quantum Mechanics" 2nd ed. (2005), Sec 4.2
//   - Slater, Phys. Rev. 36, 57 (1930) -- Slater's rules for Z*
//   - Clementi & Raimondi, J. Chem. Phys. 38, 2686 (1963) -- empirical Z*
// ==============================================================

/**
 * Factorial function for small non-negative integers.
 * Used in normalization constants for radial wavefunctions.
 */
export function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Associated Laguerre polynomial L_n^k(x) via the recurrence relation.
 *
 * L_0^k(x) = 1
 * L_1^k(x) = 1 + k - x
 * (m+1) L_{m+1}^k = (2m + 1 + k - x) L_m^k - (m + k) L_{m-1}^k
 *
 * Reference: Abramowitz and Stegun, Sec 22.7
 */
export function associatedLaguerre(n: number, k: number, x: number): number {
  if (n === 0) return 1;
  if (n === 1) return 1 + k - x;

  let Lm1 = 1; // L_0^k
  let L = 1 + k - x; // L_1^k

  for (let m = 1; m < n; m++) {
    const Lnext = ((2 * m + 1 + k - x) * L - (m + k) * Lm1) / (m + 1);
    Lm1 = L;
    L = Lnext;
  }

  return L;
}

/**
 * Real spherical harmonics Y_lm(theta, phi).
 *
 * Uses the real (tesseral) form:
 *   m > 0: Y_lm  = sqrt(2) * N_lm * P_l^m(cos(theta)) * cos(m*phi)
 *   m = 0: Y_l0  = N_l0 * P_l^0(cos(theta))
 *   m < 0: Y_l|m| = sqrt(2) * N_l|m| * P_l^|m|(cos(theta)) * sin(|m|*phi)
 *
 * where N_lm = sqrt[(2l+1)/(4*pi) * (l-|m|)!/(l+|m|)!]
 *
 * Supports l = 0, 1, 2 (s, p, d orbitals).
 *
 * Reference: Griffiths Sec 4.1.2, Table 4.3
 */
export function realSphericalHarmonic(
  l: number,
  m: number,
  theta: number,
  phi: number,
): number {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Pre-computed for efficiency -- hardcoded analytic forms
  // Source: Griffiths Table 4.3 (2005)
  if (l === 0 && m === 0) {
    // Y_00 = 1/(2*sqrt(pi))
    return 0.5 * Math.sqrt(1.0 / Math.PI);
  }

  if (l === 1) {
    if (m === 0) {
      // Y_10 = sqrt(3/(4*pi)) * cos(theta)
      return Math.sqrt(3.0 / (4.0 * Math.PI)) * cosT;
    }
    if (m === 1) {
      // Y_11 (real) = sqrt(3/(4*pi)) * sin(theta) * cos(phi)  (p_x)
      return Math.sqrt(3.0 / (4.0 * Math.PI)) * sinT * Math.cos(phi);
    }
    if (m === -1) {
      // Y_1,-1 (real) = sqrt(3/(4*pi)) * sin(theta) * sin(phi)  (p_y)
      return Math.sqrt(3.0 / (4.0 * Math.PI)) * sinT * Math.sin(phi);
    }
  }

  if (l === 2) {
    if (m === 0) {
      // Y_20 = sqrt(5/(16*pi)) * (3*cos^2(theta) - 1)  (d_z2)
      return Math.sqrt(5.0 / (16.0 * Math.PI)) * (3.0 * cosT * cosT - 1.0);
    }
    if (m === 1) {
      // Y_21 (real) = sqrt(15/(4*pi)) * sin(theta)*cos(theta)*cos(phi)  (d_xz)
      return Math.sqrt(15.0 / (4.0 * Math.PI)) * sinT * cosT * Math.cos(phi);
    }
    if (m === -1) {
      // Y_2,-1 (real) = sqrt(15/(4*pi)) * sin(theta)*cos(theta)*sin(phi)  (d_yz)
      return Math.sqrt(15.0 / (4.0 * Math.PI)) * sinT * cosT * Math.sin(phi);
    }
    if (m === 2) {
      // Y_22 (real) = sqrt(15/(16*pi)) * sin^2(theta) * cos(2*phi)  (d_x2-y2)
      return (
        Math.sqrt(15.0 / (16.0 * Math.PI)) * sinT * sinT * Math.cos(2 * phi)
      );
    }
    if (m === -2) {
      // Y_2,-2 (real) = sqrt(15/(16*pi)) * sin^2(theta) * sin(2*phi)  (d_xy)
      return (
        Math.sqrt(15.0 / (16.0 * Math.PI)) * sinT * sinT * Math.sin(2 * phi)
      );
    }
  }

  return 0;
}

/**
 * Hydrogen-like radial wavefunction R_nl(r) with effective nuclear charge Zeff.
 *
 * Uses the standard form from Griffiths Eq. 4.73 with associated Laguerre
 * polynomials and exponential decay. a0 = 0.529177 Angstrom (Bohr radius).
 *
 * Reference: Griffiths, "Introduction to Quantum Mechanics" 2nd ed., Sec 4.2.1, Eq. 4.73
 */
export function radialWavefunction(
  n: number,
  l: number,
  r: number,
  Zeff: number,
): number {
  // Bohr radius in Angstrom
  // Source: CODATA 2018, a0 = 0.529177210903 Angstrom
  const a0 = 0.529177;
  const rho = (2.0 * Zeff * r) / (n * a0);

  // Normalization constant:
  // N_nl = sqrt[(2Z/(n*a0))^3 * (n-l-1)! / (2n * (n+l)!)]
  // Using the textbook form from Griffiths Eq. 4.73.
  // We drop the overall sign (physically irrelevant for |psi|^2)
  const prefactor = Math.pow((2.0 * Zeff) / (n * a0), 1.5);
  const factRatio = Math.sqrt(
    factorial(n - l - 1) / (2.0 * n * factorial(n + l)),
  );

  const norm = prefactor * factRatio;

  const expPart = Math.exp(-rho / 2.0);
  const rhoL = Math.pow(rho, l);
  const laguerre = associatedLaguerre(n - l - 1, 2 * l + 1, rho);

  return norm * expPart * rhoL * laguerre;
}

/**
 * Slater's rules for effective nuclear charge Z*.
 *
 * Slater's empirical screening constants group electrons by shells:
 *   (1s)(2s,2p)(3s,3p)(3d)(4s,4p)(4d)(4f)...
 *
 * Screening rules:
 *   1. Electrons in groups to the right contribute 0
 *   2. Electrons in the same group: 0.35 each (0.30 for 1s)
 *   3. For s,p electrons: electrons in (n-1) shell contribute 0.85;
 *      electrons in deeper shells contribute 1.00
 *   4. For d,f electrons: all electrons in lower groups contribute 1.00
 *
 * We use the more accurate Clementi-Raimondi empirical Z* values where
 * available, falling back to Slater's rules.
 *
 * Reference: Slater, Phys. Rev. 36, 57 (1930)
 * Reference: Clementi and Raimondi, J. Chem. Phys. 38, 2686 (1963)
 */

/**
 * Clementi-Raimondi effective nuclear charges for common orbitals.
 * These are more accurate than Slater's rules.
 *
 * Source: Clementi and Raimondi, J. Chem. Phys. 38, 2686 (1963), Table II
 * Format: Z -> { "1s": Zeff, "2s": Zeff, "2p": Zeff, ... }
 */
const CLEMENTI_RAIMONDI_ZEFF: Record<number, Record<string, number>> = {
  1: { '1s': 1.0 },
  2: { '1s': 1.6875 },
  3: { '1s': 2.6906, '2s': 1.2792 },
  4: { '1s': 3.6848, '2s': 1.912 },
  5: { '1s': 4.6795, '2s': 2.5762, '2p': 2.4214 },
  6: { '1s': 5.6727, '2s': 3.2166, '2p': 3.1358 },
  7: { '1s': 6.6651, '2s': 3.8474, '2p': 3.834 },
  8: { '1s': 7.6579, '2s': 4.4916, '2p': 4.4532 },
  9: { '1s': 8.6501, '2s': 5.1276, '2p': 5.1 },
  10: { '1s': 9.6421, '2s': 5.7584, '2p': 5.7584 },
  11: { '1s': 10.6259, '2s': 6.5714, '2p': 6.8018, '3s': 2.5074 },
  12: { '1s': 11.6089, '2s': 7.392, '2p': 7.8258, '3s': 3.3075 },
  13: {
    '1s': 12.591,
    '2s': 8.2136,
    '2p': 8.9634,
    '3s': 4.1172,
    '3p': 4.0656,
  },
  14: {
    '1s': 13.5745,
    '2s': 9.02,
    '2p': 9.945,
    '3s': 4.9032,
    '3p': 4.2852,
  },
  15: {
    '1s': 14.5578,
    '2s': 9.825,
    '2p': 10.9612,
    '3s': 5.6418,
    '3p': 4.8864,
  },
  16: {
    '1s': 15.5409,
    '2s': 10.6288,
    '2p': 11.977,
    '3s': 6.3669,
    '3p': 5.4819,
  },
  17: {
    '1s': 16.5239,
    '2s': 11.4304,
    '2p': 12.9932,
    '3s': 7.0683,
    '3p': 6.1161,
  },
  18: {
    '1s': 17.5075,
    '2s': 12.2304,
    '2p': 14.0082,
    '3s': 7.7568,
    '3p': 6.7641,
  },
  19: {
    '1s': 18.4895,
    '2s': 13.0062,
    '2p': 15.0268,
    '3s': 8.6804,
    '3p': 7.7258,
    '4s': 3.4952,
  },
  20: {
    '1s': 19.473,
    '2s': 13.776,
    '2p': 16.0414,
    '3s': 9.602,
    '3p': 8.6586,
    '4s': 4.3981,
  },
  26: {
    '1s': 25.381,
    '2s': 19.054,
    '2p': 21.836,
    '3s': 14.306,
    '3p': 13.2,
    '3d': 6.253,
    '4s': 5.434,
  },
};

/**
 * Get the effective nuclear charge Z* for a given orbital of element Z.
 *
 * First checks Clementi-Raimondi empirical values, then falls back to
 * Slater's rules for elements not in the table.
 *
 * @param Z - atomic number
 * @param n - principal quantum number of the orbital
 * @param l - angular momentum quantum number (0=s, 1=p, 2=d)
 * @returns effective nuclear charge Z*
 */
export function getEffectiveZ(Z: number, n: number, l: number): number {
  const orbitalLabel = `${n}${['s', 'p', 'd', 'f'][l]}`;
  const crData = CLEMENTI_RAIMONDI_ZEFF[Z];
  if (crData && crData[orbitalLabel] !== undefined) {
    return crData[orbitalLabel];
  }

  // Fallback: Slater's rules approximation
  // Source: Slater, Phys. Rev. 36, 57 (1930)
  return slaterZeff(Z, n, l);
}

/**
 * Slater's rules implementation for Z* when Clementi-Raimondi data unavailable.
 */
function slaterZeff(Z: number, n: number, l: number): number {
  // For simplicity, approximate with Z - S where S is screening
  // This is a simplified version of Slater's rules
  if (n === 1) {
    // 1s: only other 1s electron screens by 0.30
    return Z - 0.3 * Math.min(Z - 1, 1);
  }
  if (l <= 1) {
    // s,p electrons
    // Same group screens by 0.35 each
    // (n-1) shell screens by 0.85 each
    // Deeper shells screen by 1.00 each
    // Approximate: electrons in n-1 and deeper shells
    const sameGroupElectrons = Math.max(0, Z - 1); // rough
    const screening =
      0.35 * Math.min(sameGroupElectrons, 2 * n * n - 1) +
      0.85 * Math.min(Z - 1, 2 * (n - 1) * (n - 1));
    return Math.max(1, Z - Math.min(screening, Z - 1));
  }
  // d,f electrons: all lower groups screen by 1.00
  // Same group screens by 0.35
  const screening = 0.35 * Math.max(0, Z - 1 - 2 * n * n) + 1.0 * 2 * n * n;
  return Math.max(1, Z - Math.min(screening, Z - 1));
}

/** Result of computing an orbital on a 3D grid */
export interface OrbitalGridResult {
  /** Wavefunction values psi (signed, not |psi|^2) on the grid */
  values: Float32Array;
  /** Grid dimensions [nx, ny, nz] */
  dimensions: [number, number, number];
  /** Grid origin in Angstrom [x, y, z] */
  origin: [number, number, number];
  /** Grid cell size in Angstrom */
  cellSize: number;
}

/**
 * Compute a hydrogen-like orbital on a 3D grid centered on an atom.
 *
 * Evaluates psi(r,theta,phi) = R_nl(r) * Y_lm(theta,phi) at each grid point.
 * Returns the signed wavefunction (not |psi|^2) so the caller can extract
 * positive and negative lobes separately.
 *
 * @param n - principal quantum number (1, 2, 3)
 * @param l - angular momentum quantum number (0 to n-1)
 * @param m - magnetic quantum number (-l to +l)
 * @param Zeff - effective nuclear charge
 * @param center - atom position in Angstrom [x, y, z]
 * @param gridRes - number of grid points per dimension (default 48)
 * @param extent - half-width of grid in Angstrom (default: auto from n and Zeff)
 */
export function computeOrbitalGrid(
  n: number,
  l: number,
  m: number,
  Zeff: number,
  center: [number, number, number],
  gridRes: number = 48,
  extent?: number,
): OrbitalGridResult {
  // Bohr radius in Angstrom
  const a0 = 0.529177;

  // Auto-compute grid extent based on orbital size
  // The orbital extends roughly to r_max ~ n^2 * a0 / Z* * (2 + safety factor)
  // The factor 3.5 ensures we capture at least 95% of the probability density
  const autoExtent = (n * n * a0 * 3.5) / Zeff;
  const halfWidth = extent ?? Math.max(autoExtent, 1.5);

  const cellSize = (2 * halfWidth) / (gridRes - 1);
  const origin: [number, number, number] = [
    center[0] - halfWidth,
    center[1] - halfWidth,
    center[2] - halfWidth,
  ];

  const totalPoints = gridRes * gridRes * gridRes;
  const values = new Float32Array(totalPoints);

  for (let iz = 0; iz < gridRes; iz++) {
    const zPos = origin[2] + iz * cellSize;
    const dz = zPos - center[2];

    for (let iy = 0; iy < gridRes; iy++) {
      const yPos = origin[1] + iy * cellSize;
      const dy = yPos - center[1];

      for (let ix = 0; ix < gridRes; ix++) {
        const xPos = origin[0] + ix * cellSize;
        const dx = xPos - center[0];

        const r = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Avoid division by zero at the nucleus
        if (r < 1e-10) {
          // At r=0, only s orbitals (l=0) are non-zero
          if (l === 0) {
            const R0 = radialWavefunction(n, 0, 0, Zeff);
            const Y00 = realSphericalHarmonic(0, 0, 0, 0);
            values[iz * gridRes * gridRes + iy * gridRes + ix] = R0 * Y00;
          }
          // For l>0, psi(0)=0 due to the r^l factor
          continue;
        }

        // Convert to spherical coordinates
        const theta = Math.acos(dz / r); // polar angle from z-axis
        const phi = Math.atan2(dy, dx); // azimuthal angle in xy-plane

        const R = radialWavefunction(n, l, r, Zeff);
        const Y = realSphericalHarmonic(l, m, theta, phi);

        values[iz * gridRes * gridRes + iy * gridRes + ix] = R * Y;
      }
    }
  }

  return {
    values,
    dimensions: [gridRes, gridRes, gridRes],
    origin,
    cellSize,
  };
}
