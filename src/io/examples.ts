// ==============================================================
// Example molecules for quick loading
//
// Partial charges are set to 0 — they are computed dynamically
// by Gasteiger charge equilibration in the simulation worker.
// Exceptions: NaCl (ionic, ±1.0) and CO2 (bonds not detected
// by bond detector — needs issues #2/#3 resolved first).
// ==============================================================

import type { Atom } from '../data/types';
import { parseSMILES } from './smiles';

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
  // Experimental geometry: N-H = 1.012 Å, H-N-H = 106.67°
  // Source: NIST CCCBDB experimental geometry for NH3
  // (Herzberg, Electronic Spectra of Polyatomic Molecules, 1966)
  const re = 1.012; // N-H bond length in Å
  const angle = (106.67 * Math.PI) / 180; // H-N-H angle
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
 * Create an acetylene molecule (C2H2).
 * Linear geometry with C≡C triple bond.
 * Hardcoded charges because triple bond detection may be unreliable
 * (same approach as CO₂). C: sp hybridization.
 */
export function acetyleneMolecule(): Atom[] {
  // Experimental geometry: C≡C = 1.203 Å, C-H = 1.063 Å, linear
  // Source: NIST CCCBDB experimental geometry for C2H2
  // Charges: Gasteiger sp C with H gives roughly ±0.25
  const cc = 1.203; // C≡C bond length in Å
  const ch = 1.063; // C-H bond length in Å
  return [
    // C1
    {
      id: 0,
      elementNumber: 6,
      position: [-cc / 2, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: -0.25,
      hybridization: 'sp',
      fixed: false,
    },
    // C2
    {
      id: 1,
      elementNumber: 6,
      position: [cc / 2, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: -0.25,
      hybridization: 'sp',
      fixed: false,
    },
    // H1
    {
      id: 2,
      elementNumber: 1,
      position: [-cc / 2 - ch, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0.25,
      hybridization: 'none',
      fixed: false,
    },
    // H2
    {
      id: 3,
      elementNumber: 1,
      position: [cc / 2 + ch, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0.25,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create a hydrogen peroxide molecule (H2O2).
 * Non-planar: the H-O-O-H dihedral demonstrates torsional geometry.
 * Charges computed by Gasteiger: O ≈ -0.28, H ≈ +0.28
 */
export function h2o2Molecule(): Atom[] {
  // Experimental geometry: O-O = 1.475 Å, O-H = 0.950 Å,
  // H-O-O angle = 94.8°, H-O-O-H dihedral = 119.8°
  // Source: NIST CCCBDB experimental geometry for H2O2
  // (Redington, Olson, Cross, J. Chem. Phys. 36, 1311, 1962)
  const oo = 1.475; // O-O bond length in Å
  const oh = 0.95; // O-H bond length in Å
  const hooAngle = (94.8 * Math.PI) / 180; // H-O-O angle
  const dihedral = (119.8 * Math.PI) / 180; // H-O-O-H dihedral

  // O1 at origin, O2 along +x
  // H1 bonded to O1: angle H1-O1-O2 = 94.8°, in the xz-plane
  const h1x = oh * Math.cos(hooAngle);
  const h1z = oh * Math.sin(hooAngle);

  // H2 bonded to O2: angle H2-O2-O1 = 94.8°, rotated by dihedral about O-O axis
  const h2x = oo - oh * Math.cos(hooAngle);
  const h2y = -oh * Math.sin(hooAngle) * Math.sin(dihedral);
  const h2z = -oh * Math.sin(hooAngle) * Math.cos(dihedral);

  return [
    // O1
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
    // O2
    {
      id: 1,
      elementNumber: 8,
      position: [oo, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
    // H1
    {
      id: 2,
      elementNumber: 1,
      position: [h1x, 0, h1z],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    // H2
    {
      id: 3,
      elementNumber: 1,
      position: [h2x, h2y, h2z],
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

/**
 * Create a hydrogen chloride molecule (HCl).
 * Used as a building block for acid-base pair examples.
 * Charges computed by Gasteiger: H ≈ +0.28, Cl ≈ -0.28
 */
export function hclMolecule(): Atom[] {
  // Experimental geometry: H-Cl = 1.275 Å
  // Source: NIST CCCBDB experimental geometry for HCl
  return [
    {
      id: 0,
      elementNumber: 17,
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
      position: [1.275, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Helper: combine two molecule factories with a separation distance.
 * Offsets the second molecule along +x and renumbers atom IDs.
 */
function combineMolecules(
  mol1: Atom[],
  mol2: Atom[],
  separation: number,
): Atom[] {
  return [
    ...mol1,
    ...mol2.map((a, i) => ({
      ...a,
      id: mol1.length + i,
      position: [a.position[0] + separation, a.position[1], a.position[2]] as [
        number,
        number,
        number,
      ],
    })),
  ];
}

/**
 * Create an HCl + NH₃ pair separated by ~5 Å.
 * Demonstrates acid-base chemistry: proton transfer from HCl to NH₃.
 * In encounter mode, this can model the reaction HCl + NH₃ → NH₄Cl.
 */
export function hclNh3Pair(): Atom[] {
  return combineMolecules(hclMolecule(), ammoniaMolecule(), 5);
}

/**
 * Create an H₂ molecule.
 * Used as a building block for the H₂ + F₂ reaction pair.
 */
function h2Molecule(): Atom[] {
  // Experimental geometry: H-H = 0.74 Å
  // Source: NIST CCCBDB experimental geometry for H2
  return [
    {
      id: 0,
      elementNumber: 1,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 1,
      position: [0.74, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * Create an F₂ molecule.
 * Used as a building block for the H₂ + F₂ reaction pair.
 */
function f2Molecule(): Atom[] {
  // Experimental geometry: F-F = 1.412 Å
  // Source: NIST CCCBDB experimental geometry for F2
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
      elementNumber: 9,
      position: [1.412, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    },
  ];
}

/**
 * Create an H₂ + F₂ pair separated by ~5 Å.
 * Classic reaction: H₂ + F₂ → 2 HF. Demonstrates bond breaking
 * and forming in encounter mode.
 */
export function h2F2Pair(): Atom[] {
  return combineMolecules(h2Molecule(), f2Molecule(), 5);
}

/**
 * Create an HF + H₂O pair separated by ~5 Å.
 * Demonstrates strong hydrogen bonding: HF is the strongest
 * simple hydrogen bond donor, and water is a classic acceptor.
 */
export function hfH2oPair(): Atom[] {
  return combineMolecules(hfMolecule(), waterMolecule(), 5);
}

// ==============================================================
// SMILES-based examples — generated from SMILES notation via
// openchemlib's ConformerGenerator (3D coordinate generation).
// These demonstrate molecules that would be tedious to build
// atom-by-atom with hardcoded coordinates.
// ==============================================================

/**
 * Create a benzene molecule from SMILES.
 * Aromatic ring — tests SMILES aromatic notation.
 */
export function benzeneSMILES(): Atom[] {
  return parseSMILES('c1ccccc1');
}

/**
 * Create a cyclohexane molecule from SMILES.
 * Non-aromatic ring with chair conformation.
 */
export function cyclohexaneSMILES(): Atom[] {
  return parseSMILES('C1CCCCC1');
}

/**
 * Create an aspirin (acetylsalicylic acid) molecule from SMILES.
 * A familiar drug molecule demonstrating complex SMILES.
 */
export function aspirinSMILES(): Atom[] {
  return parseSMILES('CC(=O)Oc1ccccc1C(=O)O');
}

/**
 * Create a caffeine molecule from SMILES.
 * Bicyclic purine derivative found in coffee/tea.
 */
export function caffeineSMILES(): Atom[] {
  return parseSMILES('Cn1c(=O)c2c(ncn2C)n(C)c1=O');
}

export const exampleMolecules = {
  // Single molecules
  'Water (H₂O)': waterMolecule,
  'Methane (CH₄)': methaneMolecule,
  'Ethanol (C₂H₅OH)': ethanolMolecule,
  'Carbon Dioxide (CO₂)': co2Molecule,
  'Ammonia (NH₃)': ammoniaMolecule,
  'Hydrogen Fluoride (HF)': hfMolecule,
  'Hydrogen Sulfide (H₂S)': h2sMolecule,
  'Acetylene (C₂H₂)': acetyleneMolecule,
  'Hydrogen Peroxide (H₂O₂)': h2o2Molecule,
  // Ion pairs and interacting molecules
  'NaCl pair': naclPair,
  'Two H₂O molecules': twoWaterMolecules,
  'HCl + NH₃ (acid-base)': hclNh3Pair,
  'H₂ + F₂ (reaction)': h2F2Pair,
  'HF + H₂O (H-bonding)': hfH2oPair,
  // SMILES-generated molecules
  'Benzene (SMILES)': benzeneSMILES,
  'Cyclohexane (SMILES)': cyclohexaneSMILES,
  'Aspirin (SMILES)': aspirinSMILES,
  'Caffeine (SMILES)': caffeineSMILES,
};
