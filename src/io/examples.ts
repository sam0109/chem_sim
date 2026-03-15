// ==============================================================
// Example molecules for quick loading
// ==============================================================

import type { Atom } from '../data/types';

/**
 * Create a water molecule (H2O).
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
      charge: -0.8476,
      hybridization: 'sp3',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 1,
      position: [hx, hy, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0.4238,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 2,
      elementNumber: 1,
      position: [-hx, hy, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0.4238,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create a methane molecule (CH4).
 */
export function methaneMolecule(): Atom[] {
  // Tetrahedral geometry
  const r = 1.09; // C-H bond length in Å
  const angle = Math.acos(-1 / 3); // tetrahedral angle
  return [
    {
      id: 0,
      elementNumber: 6,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: -0.24,
      hybridization: 'sp3',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 1,
      position: [r, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0.06,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 2,
      elementNumber: 1,
      position: [
        -r * Math.cos((Math.PI * 2) / 3) * Math.sin(angle),
        r * Math.cos(angle),
        -r * Math.sin((Math.PI * 2) / 3) * Math.sin(angle),
      ],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0.06,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 3,
      elementNumber: 1,
      position: [
        -r * Math.cos((Math.PI * 4) / 3) * Math.sin(angle),
        r * Math.cos(angle),
        -r * Math.sin((Math.PI * 4) / 3) * Math.sin(angle),
      ],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0.06,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 4,
      elementNumber: 1,
      position: [0, -r, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0.06,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create an ethanol molecule (C2H5OH).
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
      charge: -0.18,
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
      charge: 0.145,
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
      charge: -0.683,
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
      charge: 0.418,
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
      charge: 0.06,
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
      charge: 0.06,
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
      charge: 0.06,
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
      charge: 0.06,
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
      charge: 0.06,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create a sodium chloride ion pair.
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

export const exampleMolecules = {
  'Water (H₂O)': waterMolecule,
  'Methane (CH₄)': methaneMolecule,
  'Ethanol (C₂H₅OH)': ethanolMolecule,
  'NaCl pair': naclPair,
  'Carbon Dioxide (CO₂)': co2Molecule,
};
