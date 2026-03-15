// ==============================================================
// Orbital data: electron config parser and orbital enumeration
//
// Parses electron configuration strings from elements.ts
// (e.g., "[He] 2s2 2p4") into lists of occupied orbitals with
// quantum numbers, for use in orbital visualization.
// ==============================================================

/** A specific orbital identified by quantum numbers */
export interface OrbitalInfo {
  /** Principal quantum number (1, 2, 3, ...) */
  n: number;
  /** Angular momentum quantum number (0=s, 1=p, 2=d) */
  l: number;
  /** Magnetic quantum number (-l to +l) */
  m: number;
  /** Human-readable label, e.g. "2p_z" */
  label: string;
  /** Number of electrons in this specific orbital (1 or 2) */
  occupancy: number;
}

/** A subshell (e.g., "2p") with its total electron count */
interface Subshell {
  n: number;
  l: number;
  /** Total electrons in this subshell (e.g., 4 for "2p4") */
  electrons: number;
}

/**
 * Map from subshell letter to angular momentum quantum number l.
 */
const L_FROM_LETTER: Record<string, number> = {
  s: 0,
  p: 1,
  d: 2,
  f: 3,
};

/**
 * Human-readable names for individual orbitals by (l, m).
 *
 * Convention follows standard chemistry textbook notation:
 *   p orbitals: p_z (m=0), p_x (m=1), p_y (m=-1)
 *   d orbitals: d_z2 (m=0), d_xz (m=1), d_yz (m=-1), d_x2-y2 (m=2), d_xy (m=-2)
 *
 * Reference: Atkins, "Physical Chemistry" 10th ed., Table 7F.1
 */
function orbitalName(n: number, l: number, m: number): string {
  const letter = ['s', 'p', 'd', 'f'][l] ?? '?';
  if (l === 0) return `${n}s`;
  if (l === 1) {
    const mLabel = ['p_y', 'p_z', 'p_x'][m + 1] ?? `p_${m}`;
    return `${n}${mLabel}`;
  }
  if (l === 2) {
    const dLabels: Record<number, string> = {
      [-2]: 'd_xy',
      [-1]: 'd_yz',
      0: 'd_z2',
      1: 'd_xz',
      2: 'd_x2-y2',
    };
    return `${n}${dLabels[m] ?? `d_${m}`}`;
  }
  return `${n}${letter}_${m}`;
}

/**
 * Electron configuration for noble gas cores.
 * Used to expand shorthand like "[He] 2s2 2p4".
 */
const NOBLE_GAS_CONFIGS: Record<string, string> = {
  He: '1s2',
  Ne: '1s2 2s2 2p6',
  Ar: '1s2 2s2 2p6 3s2 3p6',
  Kr: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6',
};

/**
 * Parse an electron configuration string into a list of subshells.
 *
 * Input format: "[He] 2s2 2p4" or "1s2 2s2 2p6 3s1"
 * Handles noble gas core notation: [He], [Ne], [Ar], [Kr]
 *
 * @param config - electron configuration string from elements.ts
 * @returns list of subshells in order
 */
function parseElectronConfig(config: string): Subshell[] {
  let expanded = config;

  // Expand noble gas core
  const coreMatch = expanded.match(/\[(\w+)\]/);
  if (coreMatch) {
    const coreConfig = NOBLE_GAS_CONFIGS[coreMatch[1]];
    if (coreConfig) {
      expanded = expanded.replace(coreMatch[0], coreConfig);
    }
  }

  const subshells: Subshell[] = [];
  // Match patterns like "2s2", "3p6", "3d10"
  const regex = /(\d)([spdf])(\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(expanded)) !== null) {
    const n = parseInt(match[1], 10);
    const l = L_FROM_LETTER[match[2]];
    const electrons = parseInt(match[3], 10);
    subshells.push({ n, l, electrons });
  }

  return subshells;
}

/**
 * Get all available orbitals for an element, based on its electron config.
 *
 * Returns individual orbitals (with specific m values) that are occupied,
 * ordered by energy (n, l, m). Each orbital can hold 1 or 2 electrons.
 *
 * Filling order within a subshell follows Hund's rule:
 *   - First fill each m value with 1 electron (spin up)
 *   - Then fill each m value with a second electron (spin down)
 *   - m values are filled in order: 0, +1, -1, +2, -2, ... (by |m|)
 *
 * @param electronConfig - electron configuration string, e.g. "[He] 2s2 2p4"
 * @returns list of occupied orbitals with quantum numbers and labels
 */
export function getAvailableOrbitals(electronConfig: string): OrbitalInfo[] {
  const subshells = parseElectronConfig(electronConfig);
  const orbitals: OrbitalInfo[] = [];

  for (const { n, l, electrons } of subshells) {
    // Generate m values in standard filling order: 0, +1, -1, +2, -2, ...
    const mValues: number[] = [];
    mValues.push(0);
    for (let absM = 1; absM <= l; absM++) {
      mValues.push(absM);
      mValues.push(-absM);
    }

    // Distribute electrons among m values (Hund's rule)
    const maxPerOrbital = 2; // Pauli exclusion
    const numOrbitals = 2 * l + 1;
    let remaining = electrons;

    // First pass: one electron per orbital
    const occupancies = new Array<number>(numOrbitals).fill(0);
    for (let i = 0; i < numOrbitals && remaining > 0; i++) {
      occupancies[i] = 1;
      remaining--;
    }
    // Second pass: fill to 2
    for (let i = 0; i < numOrbitals && remaining > 0; i++) {
      const add = Math.min(maxPerOrbital - occupancies[i], remaining);
      occupancies[i] += add;
      remaining -= add;
    }

    for (let i = 0; i < numOrbitals; i++) {
      if (occupancies[i] > 0) {
        const m = mValues[i];
        orbitals.push({
          n,
          l,
          m,
          label: orbitalName(n, l, m),
          occupancy: occupancies[i],
        });
      }
    }
  }

  return orbitals;
}

/**
 * Get a human-readable label for an orbital specified by quantum numbers.
 */
export function orbitalLabel(n: number, l: number, m: number): string {
  return orbitalName(n, l, m);
}
