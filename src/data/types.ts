// ============================================================
// Core data types for the chemistry bonding simulator
// ============================================================

import type { Vector3Tuple } from 'three';

// --------------- Periodic Table ---------------

export interface ChemicalElement {
  /** Atomic number (1-118) */
  number: number;
  /** Element symbol */
  symbol: string;
  /** Full element name */
  name: string;
  /** Atomic mass in amu */
  mass: number;
  /** Pauling electronegativity (0 if unknown) */
  electronegativity: number;
  /** Covalent radius in Å */
  covalentRadius: number;
  /** Van der Waals radius in Å */
  vdwRadius: number;
  /** Maximum common valence (number of bonds) */
  maxValence: number;
  /** Common oxidation states */
  oxidationStates: number[];
  /** CPK color as hex string (#RRGGBB) */
  color: string;
  /** Electron configuration shorthand, e.g. "[He] 2s2 2p4" */
  electronConfig: string;
  /** Period (row) in periodic table 1-7 */
  period: number;
  /** Group (column) in periodic table 1-18, 0 for lanthanides/actinides */
  group: number;
  /** Element category */
  category: ElementCategory;
  /** Ionization energy in eV (first) */
  ionizationEnergy: number;
  /** Electron affinity in eV */
  electronAffinity: number;
}

export type ElementCategory =
  | 'nonmetal'
  | 'noble-gas'
  | 'alkali-metal'
  | 'alkaline-earth-metal'
  | 'metalloid'
  | 'halogen'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'lanthanide'
  | 'actinide';

// --------------- Atom / Bond / Molecule ---------------

export interface Atom {
  /** Unique atom ID within the simulation */
  id: number;
  /** Atomic number (index into elements table) */
  elementNumber: number;
  /** Position in Å [x, y, z] */
  position: Vector3Tuple;
  /** Velocity in Å/fs */
  velocity: Vector3Tuple;
  /** Accumulated force in eV/Å */
  force: Vector3Tuple;
  /** Partial charge (elementary charge units) */
  charge: number;
  /** Detected hybridization */
  hybridization: Hybridization;
  /** Whether the atom is fixed in space (not integrated) */
  fixed: boolean;
}

export type Hybridization = 'sp' | 'sp2' | 'sp3' | 'sp3d' | 'sp3d2' | 'none';

export type BondType =
  | 'covalent'
  | 'ionic'
  | 'metallic'
  | 'hydrogen'
  | 'vanderwaals';

export interface Bond {
  /** Index of first atom */
  atomA: number;
  /** Index of second atom */
  atomB: number;
  /** Bond order: 1=single, 2=double, 3=triple, 0.5=partial */
  order: number;
  /** Classification */
  type: BondType;
}

export interface Molecule {
  atoms: Atom[];
  bonds: Bond[];
}

// --------------- Simulation State ---------------

export interface SimulationBox {
  /** Box dimensions in Å [Lx, Ly, Lz] */
  size: Vector3Tuple;
  /** Use periodic boundary conditions */
  periodic: boolean;
}

export interface SimulationConfig {
  /** Integration timestep in fs */
  timestep: number;
  /** Target temperature in K */
  temperature: number;
  /** Thermostat type */
  thermostat: 'none' | 'berendsen' | 'nose-hoover';
  /** Thermostat coupling constant in fs */
  thermostatTau: number;
  /** Non-bonded interaction cutoff in Å */
  cutoff: number;
  /** Whether to run MD or just display */
  running: boolean;
}

export interface SimulationState {
  atoms: Atom[];
  bonds: Bond[];
  box: SimulationBox;
  config: SimulationConfig;
  /** Simulation step count */
  step: number;
  /** System energies in eV */
  energy: {
    kinetic: number;
    potential: number;
    total: number;
  };
}

// --------------- Force Field ---------------

export interface UFFAtomType {
  /** UFF atom type label, e.g. "C_3", "O_2" */
  label: string;
  /** Element symbol */
  element: string;
  /** Atomic number */
  atomicNumber: number;
  /** Natural bond radius in Å */
  r1: number;
  /** Valence angle in degrees */
  theta0: number;
  /** Non-bonded distance parameter x_i in Å (UFF) */
  x: number;
  /** Non-bonded well depth D_i in kcal/mol (UFF) */
  D: number;
  /** Non-bonded scale (UFF zeta) */
  zeta: number;
  /** Effective charge Z* */
  Z: number;
  /** GMP electronegativity χ_i */
  chi: number;
}

// --------------- Worker Messages ---------------

export interface WorkerInitMessage {
  type: 'init';
  atoms: Atom[];
  bonds: Bond[];
  box: SimulationBox;
  config: SimulationConfig;
}

export interface WorkerStepMessage {
  type: 'step';
  /** Number of MD steps to take */
  steps: number;
}

export interface WorkerConfigMessage {
  type: 'config';
  config: Partial<SimulationConfig>;
}

export interface WorkerAddAtomMessage {
  type: 'add-atom';
  atom: Atom;
}

export interface WorkerRemoveAtomMessage {
  type: 'remove-atom';
  atomId: number;
}

export interface WorkerDragMessage {
  type: 'drag';
  atomId: number;
  targetPosition: Vector3Tuple;
}

export interface WorkerMinimizeMessage {
  type: 'minimize';
  maxSteps: number;
  tolerance: number;
}

export type WorkerInMessage =
  | WorkerInitMessage
  | WorkerStepMessage
  | WorkerConfigMessage
  | WorkerAddAtomMessage
  | WorkerRemoveAtomMessage
  | WorkerDragMessage
  | WorkerMinimizeMessage;

export interface WorkerStateUpdate {
  type: 'state';
  /** Flat Float64Array: [x0,y0,z0,x1,y1,z1,...] */
  positions: Float64Array;
  /** Flat Float64Array: [fx0,fy0,fz0,...] */
  forces: Float64Array;
  /** Updated bonds array (topology may have changed) */
  bonds: Bond[];
  /** Charges */
  charges: Float64Array;
  step: number;
  energy: { kinetic: number; potential: number; total: number };
  temperature: number;
}

export interface WorkerReadyMessage {
  type: 'ready';
}

export type WorkerOutMessage = WorkerStateUpdate | WorkerReadyMessage;

// --------------- UI State ---------------

export type InteractionTool =
  | 'select'
  | 'place-atom'
  | 'draw-bond'
  | 'delete'
  | 'drag'
  | 'measure-distance'
  | 'measure-angle'
  | 'measure-dihedral';

export interface MeasurementResult {
  type: 'distance' | 'angle' | 'dihedral';
  atomIds: number[];
  value: number; // Å for distance, degrees for angle/dihedral
}
