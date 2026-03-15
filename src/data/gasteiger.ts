// ==============================================================
// Gasteiger-Marsili orbital electronegativity parameters
//
// χ(q) = a + b·q + c·q²
//
// Source: Gasteiger & Marsili (1980), "Iterative Equalization of
// Orbital Electronegativity — A Rapid Access to Atomic Charges",
// Tetrahedron 36, 3219–3228.
//
// Extended parameters from PyBabel / RDKit (BSD licensed).
// ==============================================================

import type { Hybridization } from './types';

/**
 * Orbital electronegativity coefficients for the Gasteiger-Marsili method.
 * χ(q) = a + b·q + c·q²
 */
export interface GasteigerParams {
  /** Constant term (electronegativity at q=0) */
  a: number;
  /** Linear coefficient */
  b: number;
  /** Quadratic coefficient */
  c: number;
}

/**
 * Gasteiger parameter table keyed by "Z-hybridization".
 *
 * Source for core organic elements (H, C, N, O, F, Cl, Br, I, S, P):
 *   Gasteiger & Marsili (1980), Tetrahedron 36, 3219.
 *
 * Source for extended elements (Si, B, Al):
 *   PyBabel / RDKit implementation (BSD license).
 */
const GASTEIGER_PARAMS: Record<string, GasteigerParams> = {
  // Hydrogen — hybridization-independent
  '1-none': { a: 7.17, b: 6.24, c: -0.56 },
  '1-sp3': { a: 7.17, b: 6.24, c: -0.56 },

  // Carbon
  '6-sp3': { a: 7.98, b: 9.18, c: 1.88 },
  '6-sp2': { a: 8.79, b: 9.32, c: 1.51 },
  '6-sp': { a: 10.39, b: 9.45, c: 0.73 },

  // Nitrogen
  '7-sp3': { a: 11.54, b: 10.82, c: 1.36 },
  '7-sp2': { a: 12.87, b: 11.15, c: 0.85 },
  '7-sp': { a: 15.68, b: 11.7, c: -0.27 },

  // Oxygen
  '8-sp3': { a: 14.18, b: 12.92, c: 1.39 },
  '8-sp2': { a: 17.07, b: 13.79, c: 0.47 },

  // Fluorine
  '9-sp3': { a: 14.66, b: 13.85, c: 2.31 },

  // Sodium — no Gasteiger params (ionic); returns null
  // Chlorine
  '17-sp3': { a: 11.0, b: 9.69, c: 1.35 },

  // Bromine
  '35-sp3': { a: 10.08, b: 8.47, c: 1.16 },

  // Iodine
  '53-sp3': { a: 9.9, b: 7.96, c: 0.96 },

  // Sulfur
  '16-sp3': { a: 10.14, b: 9.13, c: 1.38 },
  '16-sp2': { a: 10.88, b: 9.49, c: 1.33 },

  // Phosphorus
  '15-sp3': { a: 8.9, b: 8.24, c: 0.96 },
  '15-sp2': { a: 9.665, b: 8.53, c: 0.735 },

  // Silicon — PyBabel / RDKit
  '14-sp3': { a: 7.3, b: 6.567, c: 0.657 },

  // Boron — PyBabel / RDKit
  '5-sp3': { a: 5.98, b: 6.82, c: 1.605 },
  '5-sp2': { a: 6.42, b: 6.807, c: 1.322 },

  // Aluminium — PyBabel / RDKit
  '13-sp3': { a: 5.375, b: 4.953, c: 0.867 },
};

/**
 * Default hybridization fallbacks per element (used when exact
 * hybridization key is missing). For halogens and H, sp3 is the
 * sensible default.
 */
const DEFAULT_HYBRIDIZATION: Record<number, Hybridization> = {
  1: 'none', // H
  9: 'sp3', // F
  17: 'sp3', // Cl
  35: 'sp3', // Br
  53: 'sp3', // I
};

/**
 * Look up Gasteiger orbital electronegativity parameters for an atom.
 *
 * @param atomicNumber Atomic number (Z)
 * @param hybridization Detected hybridization of the atom
 * @returns Parameters {a, b, c} or null if the element is unsupported.
 *          Unsupported atoms (e.g., noble gases, metals) get null
 *          and should be excluded from charge equilibration.
 */
export function getGasteigerParams(
  atomicNumber: number,
  hybridization: Hybridization,
): GasteigerParams | null {
  // Try exact match first
  const key = `${atomicNumber}-${hybridization}`;
  const exact = GASTEIGER_PARAMS[key];
  if (exact) return exact;

  // Try element-specific default hybridization
  const defaultHyb = DEFAULT_HYBRIDIZATION[atomicNumber];
  if (defaultHyb) {
    const fallback = GASTEIGER_PARAMS[`${atomicNumber}-${defaultHyb}`];
    if (fallback) return fallback;
  }

  // Try sp3 as final fallback (most common hybridization)
  const sp3Fallback = GASTEIGER_PARAMS[`${atomicNumber}-sp3`];
  if (sp3Fallback) return sp3Fallback;

  // Element not supported — will be excluded from charge equilibration
  return null;
}
