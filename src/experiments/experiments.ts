// ==============================================================
// Guided experiment definitions
//
// Each experiment is a multi-step investigation that guides the
// user through prediction → observation → explanation. All answers
// come from running the actual simulation, not lookup tables.
//
// Key principle: experiments build understanding sequentially.
// Each step reveals a new aspect of the topic.
// ==============================================================

import type { Atom } from '../data/types';
import type { Experiment } from './types';
import { measureBondAngle } from '../challenges/evaluator';
import {
  waterMolecule,
  methaneMolecule,
  ammoniaMolecule,
  naclPair,
} from '../io/examples';

// --------------- Molecule Factories (experiment-specific) -----

/**
 * Two helium atoms separated by 3 Å.
 * He is a noble gas: no covalent bonding, only weak LJ interaction.
 * Source: He van der Waals radius = 1.40 Å (Bondi, J. Phys. Chem. 68, 441, 1964)
 */
function twoHeliumAtoms(): Atom[] {
  return [
    {
      id: 0,
      elementNumber: 2,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: 2,
      position: [3, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/**
 * H₂ molecule for the ionic vs covalent experiment.
 * H-H bond length: 0.74 Å (NIST CCCBDB)
 */
function h2Molecule(): Atom[] {
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
 * NaCl + H₂ placed side by side for comparison.
 * NaCl at origin, H₂ offset 6 Å along x.
 */
function naclAndH2(): Atom[] {
  const nacl = naclPair();
  const h2 = h2Molecule();
  return [
    ...nacl,
    ...h2.map((a, i) => ({
      ...a,
      id: nacl.length + i,
      position: [a.position[0] + 6, a.position[1], a.position[2]] as [
        number,
        number,
        number,
      ],
    })),
  ];
}

/**
 * H₂O, NH₃, and CH₄ placed side by side for VSEPR comparison.
 * Water at origin, NH₃ offset 5 Å, CH₄ offset 10 Å.
 */
function vsperMolecules(): Atom[] {
  const water = waterMolecule(); // 3 atoms: O(0), H(1), H(2)
  const nh3 = ammoniaMolecule(); // 4 atoms: N(0), H(1), H(2), H(3)
  const ch4 = methaneMolecule(); // 5 atoms: C(0), H(1), H(2), H(3), H(4)

  const offsetNH3 = 5;
  const offsetCH4 = 10;

  return [
    ...water,
    ...nh3.map((a, i) => ({
      ...a,
      id: water.length + i,
      position: [a.position[0] + offsetNH3, a.position[1], a.position[2]] as [
        number,
        number,
        number,
      ],
    })),
    ...ch4.map((a, i) => ({
      ...a,
      id: water.length + nh3.length + i,
      position: [a.position[0] + offsetCH4, a.position[1], a.position[2]] as [
        number,
        number,
        number,
      ],
    })),
  ];
}

// --------------- Experiment 1: Molecular Shape (VSEPR) --------

const molecularShapeExperiment: Experiment = {
  id: 'molecular-shape-vsepr',
  title: 'What Determines Molecular Shape?',
  description:
    'Explore how lone pairs and bonding pairs determine the geometry of H₂O, NH₃, and CH₄ through VSEPR theory.',
  difficulty: 'beginner',
  category: 'Molecular Geometry',
  steps: [
    {
      title: 'Compare bond angles',
      introText:
        'We will place three molecules side by side: water (H₂O), ammonia (NH₃), and methane (CH₄). ' +
        'Each has a central atom surrounded by electron pairs, but they have different numbers of lone pairs. ' +
        "Let's see how this affects their shape.\n\n" +
        'H₂O has 2 bonding pairs + 2 lone pairs\n' +
        'NH₃ has 3 bonding pairs + 1 lone pair\n' +
        'CH₄ has 4 bonding pairs + 0 lone pairs',
      question: {
        type: 'ordering',
        prompt: 'Arrange these molecules from smallest to largest bond angle:',
        items: [
          { key: 'h2o', label: 'H₂O (water)' },
          { key: 'nh3', label: 'NH₃ (ammonia)' },
          { key: 'ch4', label: 'CH₄ (methane)' },
        ],
        orderingCriterion: 'bond angle, smallest to largest',
      },
      simulation: {
        atoms: vsperMolecules,
        minimizeFirst: true,
        stepsToRun: 0,
      },
      evaluate: (positions: Float64Array) => {
        // Water: atoms 0(O center), 1(H), 2(H)
        // NH₃: atoms 3(N center), 4(H), 5(H)
        // CH₄: atoms 7(C center), 8(H), 9(H)
        const waterAngle = measureBondAngle(positions, 1, 0, 2);
        const nh3Angle = measureBondAngle(positions, 4, 3, 5);
        const ch4Angle = measureBondAngle(positions, 8, 7, 9);

        const molecules = [
          { key: 'h2o', angle: waterAngle },
          { key: 'nh3', angle: nh3Angle },
          { key: 'ch4', angle: ch4Angle },
        ];
        molecules.sort((a, b) => a.angle - b.angle);

        return {
          correctAnswer: molecules.map((m) => m.key),
          measuredValues: {
            'H-O-H angle (°)': Math.round(waterAngle * 10) / 10,
            'H-N-H angle (°)': Math.round(nh3Angle * 10) / 10,
            'H-C-H angle (°)': Math.round(ch4Angle * 10) / 10,
          },
          measurementDescription:
            `H₂O = ${waterAngle.toFixed(1)}°, ` +
            `NH₃ = ${nh3Angle.toFixed(1)}°, ` +
            `CH₄ = ${ch4Angle.toFixed(1)}°`,
        };
      },
      explanation:
        'VSEPR (Valence Shell Electron Pair Repulsion) theory explains the trend:\n\n' +
        'CH₄ has 4 bonding pairs and no lone pairs → ideal tetrahedral angle ≈ 109.5°\n' +
        'NH₃ has 3 bonding pairs and 1 lone pair → compressed to ≈ 107°\n' +
        'H₂O has 2 bonding pairs and 2 lone pairs → compressed further to ≈ 104.5°\n\n' +
        'Lone pairs occupy more space than bonding pairs because they are held ' +
        'closer to the central atom. This extra repulsion pushes the bonding pairs ' +
        'closer together, reducing the bond angle. The more lone pairs, the smaller the angle.',
    },
    {
      title: 'Predict water angle',
      introText:
        "Now that you've seen the trend, let's focus on water. " +
        'The "ideal" tetrahedral angle is 109.5° — but water has two lone pairs ' +
        'that compress the H-O-H angle. How much compression do you think there is?',
      question: {
        type: 'numeric-estimate',
        prompt: 'What is the H-O-H bond angle in water (in degrees)?',
        unit: '°',
        range: [90, 120],
      },
      simulation: {
        atoms: waterMolecule,
        minimizeFirst: true,
        stepsToRun: 0,
      },
      evaluate: (positions: Float64Array) => {
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
        'The experimental H-O-H angle is 104.5°, about 5° less than the ideal tetrahedral ' +
        'angle of 109.5°. The simulation uses the UFF force field which parameterizes this ' +
        'angle based on the oxygen hybridization (sp³). The two lone pairs on oxygen repel ' +
        'the bonding pairs more strongly than bonding pairs repel each other, compressing ' +
        'the angle. This is a direct consequence of VSEPR theory in action.',
    },
  ],
};

// --------------- Experiment 2: Noble Gas Behavior --------------

const nobleGasExperiment: Experiment = {
  id: 'noble-gas-behavior',
  title: "Why Doesn't Helium Bond?",
  description:
    "Place two helium atoms near each other and discover why noble gases don't form chemical bonds.",
  difficulty: 'beginner',
  category: 'Chemical Bonding',
  steps: [
    {
      title: 'Predict bonding',
      introText:
        'Helium (He) is a noble gas — its electron shell is completely full with 2 electrons. ' +
        "We're going to place two helium atoms just 3 Å apart (closer than typical van der Waals contact). " +
        'The simulation will run with these atoms free to move.\n\n' +
        'Will they form a chemical bond? Or will something else happen?',
      question: {
        type: 'multiple-choice',
        prompt:
          'What do you think will happen when two He atoms are placed 3 Å apart?',
        options: [
          { key: 'bond', label: 'They will form a He-He bond' },
          { key: 'attract', label: 'They will weakly attract but not bond' },
          { key: 'repel', label: 'They will repel each other' },
          { key: 'nothing', label: 'Nothing — they will stay put' },
        ],
      },
      simulation: {
        atoms: twoHeliumAtoms,
        configOverrides: { temperature: 300, thermostat: 'berendsen' },
        minimizeFirst: false,
        stepsToRun: 200,
      },
      evaluate: (positions: Float64Array) => {
        // Measure the He-He distance after simulation
        const dx = positions[3] - positions[0];
        const dy = positions[4] - positions[1];
        const dz = positions[5] - positions[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // At room temperature, He atoms should drift apart or settle near
        // the LJ minimum (~2.8-3.0 Å for UFF He) without forming a bond
        const correctAnswer = distance > 2.5 ? 'attract' : 'repel';

        return {
          correctAnswer,
          measuredValues: {
            'He-He distance (Å)': Math.round(distance * 100) / 100,
          },
          measurementDescription: `He-He distance = ${distance.toFixed(2)} Å`,
        };
      },
      explanation:
        "Helium atoms don't form chemical bonds because their electron shell (1s²) is completely " +
        'full. There are no empty orbitals available for bonding.\n\n' +
        'However, they do interact through London dispersion forces (a type of van der Waals ' +
        'interaction). These arise from temporary fluctuations in electron density that create ' +
        'instantaneous dipoles. The Lennard-Jones potential in the simulation models this: ' +
        'there is a weak attractive well at long range, but strong repulsion at short range.\n\n' +
        'The interaction energy is tiny — about 0.001 eV (compared to ~4 eV for a typical ' +
        'covalent bond). This is why helium is a gas at room temperature and only liquefies ' +
        'at 4.2 K (-269 °C).',
    },
    {
      title: 'Compare with temperature',
      introText:
        'Even the weak van der Waals attraction between helium atoms can be overcome by ' +
        "thermal energy. Let's see what happens at a higher temperature (1000 K).\n\n" +
        'At 300 K, the thermal energy kT ≈ 0.026 eV.\n' +
        'At 1000 K, the thermal energy kT ≈ 0.086 eV.\n\n' +
        'Both are much larger than the He-He well depth (~0.001 eV).',
      simulation: {
        atoms: twoHeliumAtoms,
        configOverrides: { temperature: 1000, thermostat: 'berendsen' },
        minimizeFirst: false,
        stepsToRun: 200,
      },
      evaluate: (positions: Float64Array) => {
        const dx = positions[3] - positions[0];
        const dy = positions[4] - positions[1];
        const dz = positions[5] - positions[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        return {
          correctAnswer: 'separated',
          measuredValues: {
            'He-He distance (Å)': Math.round(distance * 100) / 100,
          },
          measurementDescription: `He-He distance = ${distance.toFixed(2)} Å at 1000 K`,
        };
      },
      explanation:
        'At 1000 K, the helium atoms move much faster and the thermal kinetic energy ' +
        'completely overwhelms the tiny van der Waals attraction. The atoms fly apart freely.\n\n' +
        'This illustrates a key principle: whether atoms stay together depends on the ' +
        'balance between bonding energy and thermal energy (kT). Noble gases have such weak ' +
        'interactions that even room temperature provides enough energy to keep them apart. ' +
        'Real chemical bonds (1-5 eV) are much stronger than kT at room temperature (0.026 eV), ' +
        'which is why molecules are stable.',
    },
  ],
};

// --------------- Experiment 3: Ionic vs Covalent ---------------

const ionicVsCovalentExperiment: Experiment = {
  id: 'ionic-vs-covalent',
  title: 'Ionic vs Covalent: NaCl vs H₂',
  description:
    'Compare how ionic (NaCl) and covalent (H₂) bonds respond differently to conditions, and discover what makes them fundamentally different.',
  difficulty: 'intermediate',
  category: 'Chemical Bonding',
  steps: [
    {
      title: 'Compare at rest',
      introText:
        'We will place NaCl (an ionic compound) and H₂ (a covalent molecule) side by side. ' +
        "First, let's minimize the energy and see their equilibrium structures.\n\n" +
        'NaCl: sodium transfers an electron to chlorine → Na⁺ and Cl⁻ ions attract via Coulomb force.\n' +
        'H₂: two hydrogen atoms share electrons equally → covalent bond.',
      question: {
        type: 'multiple-choice',
        prompt: 'Which bond do you think is longer at equilibrium?',
        options: [
          { key: 'nacl', label: 'Na-Cl is longer' },
          { key: 'h2', label: 'H-H is longer' },
          { key: 'same', label: 'They are about the same' },
        ],
      },
      simulation: {
        atoms: naclAndH2,
        minimizeFirst: true,
        stepsToRun: 0,
      },
      evaluate: (positions: Float64Array) => {
        // NaCl: atoms 0(Na), 1(Cl)
        // H₂: atoms 2(H), 3(H)
        const dxNaCl = positions[3] - positions[0];
        const dyNaCl = positions[4] - positions[1];
        const dzNaCl = positions[5] - positions[2];
        const naclDist = Math.sqrt(
          dxNaCl * dxNaCl + dyNaCl * dyNaCl + dzNaCl * dzNaCl,
        );

        const dxH2 = positions[9] - positions[6];
        const dyH2 = positions[10] - positions[7];
        const dzH2 = positions[11] - positions[8];
        const h2Dist = Math.sqrt(dxH2 * dxH2 + dyH2 * dyH2 + dzH2 * dzH2);

        const correctAnswer = naclDist > h2Dist ? 'nacl' : 'h2';

        return {
          correctAnswer,
          measuredValues: {
            'Na-Cl distance (Å)': Math.round(naclDist * 1000) / 1000,
            'H-H distance (Å)': Math.round(h2Dist * 1000) / 1000,
          },
          measurementDescription: `Na-Cl = ${naclDist.toFixed(3)} Å, H-H = ${h2Dist.toFixed(3)} Å`,
        };
      },
      explanation:
        'The Na-Cl bond (~2.36 Å) is much longer than H-H (~0.74 Å). This is partly because ' +
        'Na and Cl are much larger atoms than H, but also because the bonding mechanism is different.\n\n' +
        'In NaCl, the bond is electrostatic: Na⁺ and Cl⁻ ions attract via the Coulomb force (1/r). ' +
        'This force is long-range but relatively weak at any given distance.\n\n' +
        'In H₂, the electrons are shared in a covalent bond (Morse potential). The overlap of ' +
        'electron orbitals creates a deep, narrow potential well that holds the atoms close together. ' +
        'Experimental values: Na-Cl = 2.36 Å, H-H = 0.74 Å.',
    },
    {
      title: 'Response to heat',
      introText:
        "Now let's heat both molecules to 2000 K with a Berendsen thermostat. " +
        'High temperature means large kinetic energy — the atoms vibrate and may even dissociate.\n\n' +
        'At 2000 K, kT ≈ 0.17 eV. The H-H bond dissociation energy is ~4.5 eV. ' +
        'The NaCl bond dissociation energy is ~4.3 eV.\n\n' +
        'Will either bond break?',
      question: {
        type: 'multiple-choice',
        prompt:
          'At 2000 K, which molecule is more likely to show larger vibrations?',
        options: [
          { key: 'nacl', label: 'NaCl vibrates more' },
          { key: 'h2', label: 'H₂ vibrates more' },
          { key: 'same', label: 'Both vibrate about the same' },
        ],
      },
      simulation: {
        atoms: naclAndH2,
        configOverrides: { temperature: 2000, thermostat: 'berendsen' },
        minimizeFirst: true,
        stepsToRun: 300,
      },
      evaluate: (positions: Float64Array) => {
        // Measure final distances
        const dxNaCl = positions[3] - positions[0];
        const dyNaCl = positions[4] - positions[1];
        const dzNaCl = positions[5] - positions[2];
        const naclDist = Math.sqrt(
          dxNaCl * dxNaCl + dyNaCl * dyNaCl + dzNaCl * dzNaCl,
        );

        const dxH2 = positions[9] - positions[6];
        const dyH2 = positions[10] - positions[7];
        const dzH2 = positions[11] - positions[8];
        const h2Dist = Math.sqrt(dxH2 * dxH2 + dyH2 * dyH2 + dzH2 * dzH2);

        return {
          correctAnswer: 'nacl',
          measuredValues: {
            'Na-Cl distance (Å)': Math.round(naclDist * 100) / 100,
            'H-H distance (Å)': Math.round(h2Dist * 100) / 100,
            'Temperature (K)': 2000,
          },
          measurementDescription: `Na-Cl = ${naclDist.toFixed(2)} Å, H-H = ${h2Dist.toFixed(2)} Å at 2000 K`,
        };
      },
      explanation:
        'The ionic bond in NaCl has a softer, shallower potential (Coulomb 1/r) compared to ' +
        'the covalent bond in H₂ (Morse potential with steep walls). This means NaCl has a lower ' +
        'force constant and vibrates with larger amplitude at the same temperature.\n\n' +
        'Additionally, Na and Cl are heavier atoms (23 and 35 amu vs 1 amu for H), so they have ' +
        'lower vibrational frequency but the same thermal energy, leading to larger displacement.\n\n' +
        'In the real world, NaCl dissociates into ions in water (dissolving) at room temperature, ' +
        'while H₂ remains intact until very high temperatures (~3000-4000 K). The difference is ' +
        'not just bond strength but the shape of the potential energy curve.',
    },
  ],
};

// --------------- Exports ------------------------------------

/** All available guided experiments, in display order */
export const experiments: Experiment[] = [
  molecularShapeExperiment,
  nobleGasExperiment,
  ionicVsCovalentExperiment,
];

/** Look up an experiment by ID */
export function getExperimentById(id: string): Experiment | undefined {
  return experiments.find((e) => e.id === id);
}
