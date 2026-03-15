// ==============================================================
// Bond Dissociation Energy (BDE) lookup table
// Source: CRC Handbook of Chemistry and Physics, 97th Ed. (2016-2017),
//         Section 9: "Bond Dissociation Energies"
//         NIST Chemistry WebBook (https://webbook.nist.gov)
// Units: kcal/mol (converted to eV by consumers)
//
// Keyed by canonical pair string "Z1-Z2" (lower Z first) and bond order.
// Fallback: geometric-mean approximation for missing pairs.
// ==============================================================

/**
 * Experimental bond dissociation energies in kcal/mol.
 * Key format: "Zlow-Zhigh" where Zlow <= Zhigh.
 * Value: Record<bondOrder, BDE in kcal/mol>.
 *
 * Sources for each entry are cited inline.
 */
const bdeTable: Record<string, Partial<Record<number, number>>> = {
  // ---- H–X bonds ----
  // H-H: CRC 104.2 kcal/mol
  '1-1': { 1: 104.2 },
  // C-H: CRC 98.7 kcal/mol (methane C-H)
  '1-6': { 1: 98.7 },
  // N-H: CRC 107.6 kcal/mol (ammonia N-H)
  '1-7': { 1: 107.6 },
  // O-H: CRC 110.6 kcal/mol (water O-H)
  '1-8': { 1: 110.6 },
  // F-H: CRC 136.2 kcal/mol
  '1-9': { 1: 136.2 },
  // S-H: CRC 91.2 kcal/mol
  '1-16': { 1: 91.2 },
  // Cl-H: CRC 103.2 kcal/mol
  '1-17': { 1: 103.2 },
  // Br-H: CRC 87.5 kcal/mol
  '1-35': { 1: 87.5 },

  // ---- C–X bonds ----
  // C-C: CRC 83.1 kcal/mol (ethane), C=C: 146 (ethylene), C≡C: 200 (acetylene)
  '6-6': { 1: 83.1, 2: 146.0, 3: 200.0 },
  // C-N: CRC 73.0, C=N: 147 (formaldoxime-type), C≡N: 213 (HCN)
  '6-7': { 1: 73.0, 2: 147.0, 3: 213.0 },
  // C-O: CRC 85.5 (methanol C-O), C=O: 173 (CO₂), C≡O: 257 (CO)
  '6-8': { 1: 85.5, 2: 173.0, 3: 257.0 },
  // C-F: CRC 116.0 kcal/mol
  '6-9': { 1: 116.0 },
  // C-Si: CRC 89.7 kcal/mol
  '6-14': { 1: 89.7 },
  // C-P: CRC ~70 kcal/mol (approximate)
  '6-15': { 1: 70.0 },
  // C-S: CRC 73.0 kcal/mol, C=S: 128
  '6-16': { 1: 73.0, 2: 128.0 },
  // C-Cl: CRC 78.5 kcal/mol
  '6-17': { 1: 78.5 },
  // C-Br: CRC 68.0 kcal/mol
  '6-35': { 1: 68.0 },

  // ---- N–X bonds ----
  // N-N: CRC 37.6, N=N: 100 (trans-diazene), N≡N: 225.8 (N₂)
  '7-7': { 1: 37.6, 2: 100.0, 3: 225.8 },
  // N-O: CRC 48.0, N=O: 143 (nitrosyl compounds)
  '7-8': { 1: 48.0, 2: 143.0 },
  // N-F: CRC 65.0 kcal/mol
  '7-9': { 1: 65.0 },

  // ---- O–X bonds ----
  // O-O: CRC 34.0 (H₂O₂), O=O: 119.1 (O₂)
  '8-8': { 1: 34.0, 2: 119.1 },
  // O-Si: CRC 110.0 kcal/mol
  '8-14': { 1: 110.0 },
  // O-P: CRC 90.0 kcal/mol (approximate)
  '8-15': { 1: 90.0 },
  // O-S: CRC 55.0 kcal/mol
  '8-16': { 1: 55.0 },

  // ---- Halogen bonds ----
  // F-F: CRC 36.9
  '9-9': { 1: 36.9 },
  // F-Si: CRC 135.0 kcal/mol
  '9-14': { 1: 135.0 },
  // Cl-Cl: CRC 57.8
  '17-17': { 1: 57.8 },
  // Br-Br: CRC 45.4
  '35-35': { 1: 45.4 },

  // ---- S–X bonds ----
  // S-S: CRC 60.1 kcal/mol (disulfide)
  '16-16': { 1: 60.1 },

  // ---- Si–X bonds ----
  // Si-Si: CRC 76.0 kcal/mol
  '14-14': { 1: 76.0 },
};

/**
 * Homonuclear single-bond dissociation energies for the geometric-mean fallback.
 * D(A-B) ≈ √(D(A-A) × D(B-B)) when no specific entry exists.
 * Source: CRC Handbook and NIST.
 */
const homonuclearBDE: Record<number, number> = {
  1: 104.2, // H-H: CRC
  5: 71.0, // B-B: approximate, Greenwood & Earnshaw
  6: 83.1, // C-C: CRC (ethane)
  7: 37.6, // N-N: CRC (hydrazine)
  8: 34.0, // O-O: CRC (H₂O₂)
  9: 36.9, // F-F: CRC
  14: 76.0, // Si-Si: CRC
  15: 48.0, // P-P: CRC (P₂H₄)
  16: 60.1, // S-S: CRC (disulfide)
  17: 57.8, // Cl-Cl: CRC
  35: 45.4, // Br-Br: CRC
  53: 36.1, // I-I: CRC
};

/**
 * Look up experimental bond dissociation energy for a given atom pair and bond order.
 * Returns BDE in kcal/mol, or undefined if not found.
 *
 * @param z1 atomic number of first atom
 * @param z2 atomic number of second atom
 * @param bondOrder bond order (1, 2, or 3)
 */
export function lookupBDE(
  z1: number,
  z2: number,
  bondOrder: number,
): number | undefined {
  const lo = Math.min(z1, z2);
  const hi = Math.max(z1, z2);
  const key = `${lo}-${hi}`;
  const entry = bdeTable[key];
  if (entry) {
    const roundedOrder = Math.round(bondOrder);
    const val = entry[roundedOrder];
    if (val !== undefined) return val;
  }
  return undefined;
}

/**
 * Geometric-mean fallback for bond dissociation energy.
 * D(A-B) ≈ √(D(A-A) × D(B-B))
 * This approximation (Pauling, 1960) works reasonably for
 * covalent bonds with moderate polarity.
 *
 * Returns BDE in kcal/mol, or undefined if homonuclear data is missing.
 *
 * @param z1 atomic number of first atom
 * @param z2 atomic number of second atom
 */
export function geometricMeanBDE(z1: number, z2: number): number | undefined {
  const d1 = homonuclearBDE[z1];
  const d2 = homonuclearBDE[z2];
  if (d1 !== undefined && d2 !== undefined) {
    return Math.sqrt(d1 * d2);
  }
  return undefined;
}

/**
 * Get bond dissociation energy with cascading fallbacks:
 * 1. Exact lookup from BDE table (element pair + bond order)
 * 2. Geometric-mean approximation (single bonds only, any pair with homonuclear data)
 * 3. Returns undefined (caller should use its own fallback)
 *
 * @param z1 atomic number of first atom
 * @param z2 atomic number of second atom
 * @param bondOrder bond order (1, 2, or 3)
 * @returns BDE in kcal/mol, or undefined
 */
export function getBDE(
  z1: number,
  z2: number,
  bondOrder: number,
): number | undefined {
  // 1. Exact lookup
  const exact = lookupBDE(z1, z2, bondOrder);
  if (exact !== undefined) return exact;

  // 2. Geometric-mean fallback (single bonds only — multi-bond
  //    geometric mean is unreliable because double/triple bond
  //    energies don't scale uniformly with single-bond energies)
  if (Math.round(bondOrder) === 1) {
    const gm = geometricMeanBDE(z1, z2);
    if (gm !== undefined) return gm;
  }

  return undefined;
}
