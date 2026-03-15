// ==============================================================
// Example molecules for quick loading
//
// Partial charges are set to 0 — they are computed dynamically
// by Gasteiger charge equilibration in the simulation worker.
// Exceptions: NaCl (ionic, ±1.0) and CO2 (bonds not detected
// by bond detector — needs issues #2/#3 resolved first).
// ==============================================================

import type { Atom } from '../data/types';

/**
 * Create a water molecule (H2O).
 * Charges computed by Gasteiger: O ≈ -0.51, H ≈ +0.25
 */
export function waterMolecule(): Atom[] {
  // UFF equilibrium: O-H re=0.990 Å, H-O-H θ=104.51°
  const re = 0.99;
  const halfAngle = ((104.51 / 2) * Math.PI) / 180;
  const hx = re * Math.sin(halfAngle);
  const hy = re * Math.cos(halfAngle);
  return [
    {
      id: 0,
      elementNumber: 8,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 1,
      position: [hx, hy, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 2,
      elementNumber: 1,
      position: [-hx, hy, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create a methane molecule (CH4).
 * Charges computed by Gasteiger: C ≈ -0.09, H ≈ +0.02
 */
export function methaneMolecule(): Atom[] {
  // Tetrahedral geometry
  // Standard orientation: vertices of a tetrahedron inscribed in a cube
  //   H at (1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1) scaled to bond length
  // All H-C-H angles = arccos(-1/3) = 109.47°
  // Source: simple geometric construction
  const r = 1.09; // C-H bond length in Å
  const s = r / Math.sqrt(3); // scale factor for unit cube vertices
  return [
    {
      id: 0,
      elementNumber: 6,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 1,
      position: [s, s, s],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 2,
      elementNumber: 1,
      position: [s, -s, -s],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 3,
      elementNumber: 1,
      position: [-s, s, -s],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 4,
      elementNumber: 1,
      position: [-s, -s, s],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create an ethanol molecule (C2H5OH).
 * Charges computed by Gasteiger: O ≈ -0.44, H(O) ≈ +0.27
 */
export function ethanolMolecule(): Atom[] {
  return [
    // C1
    {
      id: 0,
      elementNumber: 6,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
    // C2
    {
      id: 1,
      elementNumber: 6,
      position: [1.52, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
    // O
    {
      id: 2,
      elementNumber: 8,
      position: [2.14, 1.21, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
    // H (on O)
    {
      id: 3,
      elementNumber: 1,
      position: [3.1, 1.21, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    // H1 on C1
    {
      id: 4,
      elementNumber: 1,
      position: [-0.36, 1.02, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    // H2 on C1
    {
      id: 5,
      elementNumber: 1,
      position: [-0.36, -0.51, 0.88],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    // H3 on C1
    {
      id: 6,
      elementNumber: 1,
      position: [-0.36, -0.51, -0.88],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    // H4 on C2
    {
      id: 7,
      elementNumber: 1,
      position: [1.88, -0.51, 0.88],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    // H5 on C2
    {
      id: 8,
      elementNumber: 1,
      position: [1.88, -0.51, -0.88],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create an ammonia molecule (NH3).
 * Pyramidal geometry with lone pair on nitrogen.
 * Charges computed by Gasteiger: N ≈ -0.80, H ≈ +0.27
 */
export function ammoniaMolecule(): Atom[] {
  // Experimental geometry: N-H = 1.012 Å, H-N-H = 107.8°
  // Source: NIST CCCBDB experimental geometry for NH3
  const re = 1.012; // N-H bond length in Å
  const angle = (107.8 * Math.PI) / 180; // H-N-H angle
  // Place N at origin; 3 H atoms in pyramidal arrangement
  // The H atoms sit on a cone at angle α from the C3 axis,
  // where cos(angle) = cos²(α) - sin²(α)·cos(120°)
  // Solving: cos(α) = √((1 + 2·cos(angle)) / 3)
  const cosAlpha = Math.sqrt((1 + 2 * Math.cos(angle)) / 3);
  const sinAlpha = Math.sqrt(1 - cosAlpha * cosAlpha);
  const hz = re * cosAlpha; // height of H atoms above the N-plane
  const hr = re * sinAlpha; // radial distance from C3 axis
  return [
    {
      id: 0,
      elementNumber: 7,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 1,
      position: [hr, 0, hz],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 2,
      elementNumber: 1,
      position: [-hr / 2, (hr * Math.sqrt(3)) / 2, hz],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 3,
      elementNumber: 1,
      position: [-hr / 2, (-hr * Math.sqrt(3)) / 2, hz],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create a hydrogen fluoride molecule (HF).
 * Strongest hydrogen bond donor among simple molecules.
 * Charges computed by Gasteiger: H ≈ +0.35, F ≈ -0.35
 */
export function hfMolecule(): Atom[] {
  // Experimental geometry: H-F = 0.917 Å
  // Source: NIST CCCBDB experimental geometry for HF
  return [
    {
      id: 0,
      elementNumber: 9,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 1,
      position: [0.917, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create a hydrogen sulfide molecule (H2S).
 * Comparison to water: smaller bond angle (~92°) due to
 * less s-p mixing in the larger sulfur atom.
 * Charges computed by Gasteiger: S ≈ -0.24, H ≈ +0.12
 */
export function h2sMolecule(): Atom[] {
  // Experimental geometry: S-H = 1.336 Å, H-S-H = 92.1°
  // Source: NIST CCCBDB experimental geometry for H2S
  const re = 1.336; // S-H bond length in Å
  const halfAngle = ((92.1 / 2) * Math.PI) / 180;
  const hx = re * Math.sin(halfAngle);
  const hy = re * Math.cos(halfAngle);
  return [
    {
      id: 0,
      elementNumber: 16,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 1,
      position: [hx, hy, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 2,
      elementNumber: 1,
      position: [-hx, hy, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create a sodium chloride ion pair.
 * NaCl uses formal ionic charges (±1.0) — Gasteiger is not
 * appropriate for ionic compounds. These are preserved because
 * the bond detector classifies Na-Cl as ionic.
 */
export function naclPair(): Atom[] {
  return [
    {
      id: 0,
      elementNumber: 11,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 1.0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 17,
      position: [2.36, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: -1.0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create a CO2 molecule.
 * CO2 retains hardcoded charges because C=O double bonds are not
 * detected by the bond detector at this distance (needs issues
 * #2 linear angle handling and #3 double bond params). Once those
 * are resolved, these can be set to 0 like the other molecules.
 */
export function co2Molecule(): Atom[] {
  return [
    {
      id: 0,
      elementNumber: 6,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0.7,
      hybridization: 'sp',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 8,
      position: [-1.16, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: -0.35,
      hybridization: 'sp2',
      fixed: false,
    },
    {
      id: 2,
      elementNumber: 8,
      position: [1.16, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: -0.35,
      hybridization: 'sp2',
      fixed: false,
    },
  ];
}

/**
 * Create two water molecules separated by ~5 Å.
 * Demonstrates multi-molecule tracking: each water is
 * identified as a separate molecule by the union-find
 * decomposition of the bond graph.
 */
export function twoWaterMolecules(): Atom[] {
  const water1 = waterMolecule();
  const water2 = waterMolecule();
  // Shift second water 5 Å along x to ensure separation
  return [
    ...water1,
    ...water2.map((a, i) => ({
      ...a,
      id: water1.length + i,
      position: [a.position[0] + 5, a.position[1], a.position[2]] as [
        number,
        number,
        number,
      ],
    })),
  ];
}

export const exampleMolecules = {
  'Water (H₂O)': waterMolecule,
  'Methane (CH₄)': methaneMolecule,
  'Ethanol (C₂H₅OH)': ethanolMolecule,
  'NaCl pair': naclPair,
  'Carbon Dioxide (CO₂)': co2Molecule,
  'Two H₂O molecules': twoWaterMolecules,
};
