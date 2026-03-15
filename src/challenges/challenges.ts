// ==============================================================
// Challenge definitions
//
// Each challenge is self-contained: it knows how to set up the
// simulation, what to ask, how to evaluate, and how to explain.
//
// Key principle from issue #41: every answer comes from running
// the actual simulation, not from a lookup table. If the force
// field gets it wrong, the challenge should fail — motivating
// physics improvements.
// ==============================================================

import type { Atom } from '../data/types';
import type { Challenge } from './types';
import { measureBondLength, measureBondAngle } from './evaluator';
import { waterMolecule } from '../io/examples';

// --------------- Molecule Factories (challenge-specific) ------

/**
 * Hydrogen sulfide (H₂S).
 * S-H bond length: ~1.34 Å, H-S-H angle: ~92°
 * Source: CRC Handbook of Chemistry and Physics, 97th ed.
 */
function h2sMolecule(): Atom[] {
  // UFF equilibrium for S-H: r ≈ 1.345 Å
  const re = 1.345;
  // H-S-H angle ≈ 92° (experimental: 92.1°)
  const halfAngle = ((92.0 / 2) * Math.PI) / 180;
  const hx = re * Math.sin(halfAngle);
  const hy = re * Math.cos(halfAngle);
  return [
    {
      id: 0,
      elementNumber: 16, // Sulfur
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
 * Ammonia (NH₃).
 * N-H bond length: ~1.01 Å, H-N-H angle: ~107.8°
 * Source: NIST CCCBDB, experimental geometry
 */
function nh3Molecule(): Atom[] {
  const re = 1.012; // N-H bond length in Å
  // Tetrahedral-like: place 3 H atoms around N
  // H-N-H angle ≈ 107.8° (experimental)
  // Use pyramidal geometry: N at origin, 3 H below
  const angle = ((107.8 / 2) * Math.PI) / 180;
  const zOffset = -re * Math.cos(angle);
  const rxy = re * Math.sin(angle);
  return [
    {
      id: 0,
      elementNumber: 7, // Nitrogen
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
      position: [rxy, 0, zOffset],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 2,
      elementNumber: 1,
      position: [
        -rxy * Math.cos(Math.PI / 3),
        rxy * Math.sin(Math.PI / 3),
        zOffset,
      ],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 3,
      elementNumber: 1,
      position: [
        -rxy * Math.cos(Math.PI / 3),
        -rxy * Math.sin(Math.PI / 3),
        zOffset,
      ],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

// --------------- Challenge Definitions -----------------------

/**
 * Challenge 1: Compare O-H vs S-H bond length.
 *
 * The user predicts which bond is longer. The simulation loads
 * water (O-H) and H₂S (S-H), minimizes each, and measures.
 * S-H should be longer because S has a larger covalent radius.
 */
const bondLengthComparison: Challenge = {
  id: 'bond-length-oh-vs-sh',
  title: 'O-H vs S-H Bond Length',
  description:
    'Which bond is longer: O-H in water or S-H in hydrogen sulfide? Predict, then let the simulation decide.',
  difficulty: 'beginner',
  category: 'Bond Properties',
  setup: {
    atoms: () => {
      // Place H₂O and H₂S side by side so both are visible
      const water = waterMolecule();
      const h2s = h2sMolecule();
      const offset = 5; // 5 Å separation
      return [
        ...water,
        ...h2s.map((a, i) => ({
          ...a,
          id: water.length + i,
          position: [a.position[0] + offset, a.position[1], a.position[2]] as [
            number,
            number,
            number,
          ],
        })),
      ];
    },
    minimizeFirst: true,
    stepsAfterMinimize: 0,
  },
  question: {
    type: 'multiple-choice',
    prompt:
      'Which bond is longer: O-H (in water) or S-H (in hydrogen sulfide)?',
    options: [
      { key: 'sh', label: 'S-H is longer' },
      { key: 'oh', label: 'O-H is longer' },
      { key: 'same', label: 'They are about the same' },
    ],
  },
  evaluate: (positions: Float64Array) => {
    // Water: atoms 0(O), 1(H), 2(H)
    // H₂S: atoms 3(S), 4(H), 5(H)
    const ohLength = measureBondLength(positions, 0, 1);
    const shLength = measureBondLength(positions, 3, 4);

    const correctAnswer = shLength > ohLength ? 'sh' : 'oh';

    return {
      correctAnswer,
      measuredValues: {
        'O-H bond length (Å)': Math.round(ohLength * 1000) / 1000,
        'S-H bond length (Å)': Math.round(shLength * 1000) / 1000,
      },
      measurementDescription: `O-H = ${ohLength.toFixed(3)} Å, S-H = ${shLength.toFixed(3)} Å`,
    };
  },
  explanation:
    'Sulfur has a larger covalent radius (1.02 Å) than oxygen (0.73 Å), so the ' +
    'S-H bond is longer than O-H. Experimental values: O-H ≈ 0.96 Å, S-H ≈ 1.34 Å. ' +
    'The larger atomic radius means the bonding electrons are further from the nucleus, ' +
    'resulting in a longer equilibrium bond distance.',
};

/**
 * Challenge 2: Estimate the water bond angle.
 *
 * The user guesses the H-O-H angle. The simulation minimizes
 * water and measures the actual angle. Correct if within ±10°.
 */
const waterBondAngle: Challenge = {
  id: 'water-bond-angle',
  title: 'Water Bond Angle',
  description:
    'What is the H-O-H bond angle in water? Make your best estimate, then watch the simulation measure it.',
  difficulty: 'beginner',
  category: 'Molecular Geometry',
  setup: {
    atoms: waterMolecule,
    minimizeFirst: true,
    stepsAfterMinimize: 0,
  },
  question: {
    type: 'numeric-estimate',
    prompt: 'What is the H-O-H bond angle in water (in degrees)?',
    unit: '°',
    range: [90, 180],
  },
  evaluate: (positions: Float64Array) => {
    // Water: atom 0 = O (center), atom 1 = H, atom 2 = H
    const angle = measureBondAngle(positions, 1, 0, 2);

    return {
      correctAnswer: Math.round(angle * 10) / 10,
      measuredValues: {
        'H-O-H angle (°)': Math.round(angle * 10) / 10,
      },
      measurementDescription: `H-O-H = ${angle.toFixed(1)}°`,
    };
  },
  explanation:
    'Water has a bent molecular geometry due to the two lone pairs on oxygen. ' +
    'The experimental H-O-H angle is 104.5°. VSEPR theory predicts a tetrahedral ' +
    'electron geometry (~109.5°), but lone pair-lone pair repulsion compresses the ' +
    'bond angle below the ideal tetrahedral value. The simulation uses the UFF force ' +
    'field which parameterizes this angle.',
};

/**
 * Challenge 3: Order molecules by bond angle.
 *
 * The user arranges H₂O, H₂S, and NH₃ from smallest to largest
 * bond angle. The simulation minimizes each and measures.
 * Expected order: H₂S (~92°) < H₂O (~104.5°) < NH₃ (~107°).
 */
const bondAngleOrdering: Challenge = {
  id: 'bond-angle-ordering',
  title: 'Bond Angle Ordering',
  description:
    'Arrange H₂O, H₂S, and NH₃ from smallest to largest bond angle. The simulation will measure each.',
  difficulty: 'intermediate',
  category: 'Molecular Geometry',
  setup: {
    atoms: () => {
      // Place all three molecules side by side
      const water = waterMolecule(); // 3 atoms: O, H, H
      const h2s = h2sMolecule(); // 3 atoms: S, H, H
      const nh3 = nh3Molecule(); // 4 atoms: N, H, H, H

      const offsetH2S = 5;
      const offsetNH3 = 10;

      return [
        ...water,
        ...h2s.map((a, i) => ({
          ...a,
          id: water.length + i,
          position: [
            a.position[0] + offsetH2S,
            a.position[1],
            a.position[2],
          ] as [number, number, number],
        })),
        ...nh3.map((a, i) => ({
          ...a,
          id: water.length + h2s.length + i,
          position: [
            a.position[0] + offsetNH3,
            a.position[1],
            a.position[2],
          ] as [number, number, number],
        })),
      ];
    },
    minimizeFirst: true,
    stepsAfterMinimize: 0,
  },
  question: {
    type: 'ordering',
    prompt: 'Arrange these molecules from smallest to largest bond angle:',
    items: [
      { key: 'h2o', label: 'H₂O (water)' },
      { key: 'h2s', label: 'H₂S (hydrogen sulfide)' },
      { key: 'nh3', label: 'NH₃ (ammonia)' },
    ],
    orderingCriterion: 'bond angle, smallest to largest',
  },
  evaluate: (positions: Float64Array) => {
    // Water: atoms 0(O center), 1(H), 2(H)
    // H₂S: atoms 3(S center), 4(H), 5(H)
    // NH₃: atoms 6(N center), 7(H), 8(H), 9(H) — measure first H-N-H angle
    const waterAngle = measureBondAngle(positions, 1, 0, 2);
    const h2sAngle = measureBondAngle(positions, 4, 3, 5);
    const nh3Angle = measureBondAngle(positions, 7, 6, 8);

    // Sort by angle to determine correct order
    const molecules = [
      { key: 'h2o', angle: waterAngle },
      { key: 'h2s', angle: h2sAngle },
      { key: 'nh3', angle: nh3Angle },
    ];
    molecules.sort((a, b) => a.angle - b.angle);

    return {
      correctAnswer: molecules.map((m) => m.key),
      measuredValues: {
        'H-O-H angle (°)': Math.round(waterAngle * 10) / 10,
        'H-S-H angle (°)': Math.round(h2sAngle * 10) / 10,
        'H-N-H angle (°)': Math.round(nh3Angle * 10) / 10,
      },
      measurementDescription:
        `H₂O = ${waterAngle.toFixed(1)}°, ` +
        `H₂S = ${h2sAngle.toFixed(1)}°, ` +
        `NH₃ = ${nh3Angle.toFixed(1)}°`,
    };
  },
  explanation:
    'The bond angles follow: H₂S (~92°) < H₂O (~104.5°) < NH₃ (~107.8°). ' +
    'H₂S has the smallest angle because sulfur is larger and its lone pairs ' +
    'occupy more diffuse orbitals, causing less lone pair-bond pair repulsion. ' +
    'NH₃ has a larger angle than H₂O because nitrogen has only one lone pair ' +
    '(vs. two for oxygen), so there is less compression of the bonding angles. ' +
    'All three are less than the ideal tetrahedral angle of 109.5° due to ' +
    'lone pair repulsion effects.',
};

// --------------- Exports ------------------------------------

/** All available challenges, in display order */
export const challenges: Challenge[] = [
  bondLengthComparison,
  waterBondAngle,
  bondAngleOrdering,
];

/** Look up a challenge by ID */
export function getChallengeById(id: string): Challenge | undefined {
  return challenges.find((c) => c.id === id);
}
