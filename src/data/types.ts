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

/** Color mode for the periodic table UI — determines cell background coloring */
export type PeriodicTableColorMode =
  | 'category'
  | 'electronegativity'
  | 'atomicRadius'
  | 'electronAffinity'
  | 'ionizationEnergy';

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

/** Per-molecule computed properties from union-find decomposition */
export interface MoleculeInfo {
  /** Contiguous molecule ID (0-indexed) */
  id: number;
  /** Indices of atoms belonging to this molecule */
  atomIndices: number[];
  /** Center of mass in Å [x, y, z] */
  centerOfMass: Vector3Tuple;
  /** Sum of partial charges (elementary charge units) */
  totalCharge: number;
  /** Dipole moment vector in e·Å [x, y, z] */
  dipoleMoment: Vector3Tuple;
  /** Dipole moment magnitude in e·Å */
  dipoleMagnitude: number;
}

// --------------- Reaction Detection ---------------

/** A single bond change detected between consecutive topology rebuilds */
export interface BondChangeEvent {
  /** Index of first atom in the changed bond */
  atomA: number;
  /** Index of second atom in the changed bond */
  atomB: number;
  /** Bond order (1, 2, 3) */
  order: number;
  /** Bond classification */
  type: BondType;
  /** Whether the bond was formed or broken */
  change: 'formed' | 'broken';
}

/** A reaction event detected from topology changes between frames */
export interface ReactionEvent {
  /** Simulation step when the reaction was detected */
  step: number;
  /** Bond changes that constitute this reaction */
  bondChanges: BondChangeEvent[];
  /** Molecules before the reaction (reactants) */
  reactants: MoleculeInfo[];
  /** Molecules after the reaction (products) */
  products: MoleculeInfo[];
  /** Estimated reaction energy in eV (ΔE = E_products − E_reactants), or null if BDE data unavailable */
  deltaE: number | null;
}

// --------------- Simulation Event Logger ---------------

/** Types of physically significant events detected during simulation */
export type SimulationEventType =
  | 'bond-broken'
  | 'bond-formed'
  | 'temperature-spike'
  | 'energy-drift'
  | 'bond-strain';

/** Severity level for simulation events */
export type SimulationEventSeverity = 'info' | 'warning' | 'error';

/** A physically significant event detected during simulation, with plain-language explanation */
export interface SimulationEvent {
  /** Simulation step when the event was detected */
  step: number;
  /** Event classification */
  type: SimulationEventType;
  /** Indices of atoms involved in this event */
  atomIndices: number[];
  /** Human-readable explanation referencing actual forces and energies */
  explanation: string;
  /** Severity level for UI color coding */
  severity: SimulationEventSeverity;
  /** Type-specific metadata for programmatic access */
  metadata: SimulationEventMetadata;
}

/** Type-specific metadata attached to each SimulationEvent */
export type SimulationEventMetadata =
  | BondEventMetadata
  | TemperatureSpikeMetadata
  | EnergyDriftMetadata
  | BondStrainMetadata;

/** Metadata for bond-formed and bond-broken events */
export interface BondEventMetadata {
  kind: 'bond';
  /** Current distance between atoms in Å */
  distance: number;
  /** Equilibrium bond length in Å */
  equilibriumDistance: number;
  /** Bond order (1, 2, 3) */
  bondOrder: number;
  /** Bond classification */
  bondType: BondType;
  /** Morse dissociation energy De in eV (if available) */
  dissociationEnergy: number | null;
}

/** Metadata for temperature-spike events */
export interface TemperatureSpikeMetadata {
  kind: 'temperature';
  /** Temperature before spike in K */
  previousTemperature: number;
  /** Temperature after spike in K */
  currentTemperature: number;
  /** Relative change |ΔT|/T_prev */
  relativeChange: number;
}

/** Metadata for energy-drift events */
export interface EnergyDriftMetadata {
  kind: 'energy';
  /** Total energy at start of rolling window in eV */
  initialEnergy: number;
  /** Total energy at end of rolling window in eV */
  currentEnergy: number;
  /** Relative drift |ΔE|/|E_initial| */
  relativeDrift: number;
  /** Number of steps in the rolling window */
  windowSteps: number;
  /** Current timestep in fs */
  timestep: number;
}

/** Metadata for bond-strain events (bond stretched significantly beyond equilibrium) */
export interface BondStrainMetadata {
  kind: 'strain';
  /** Current distance between atoms in Å */
  distance: number;
  /** Equilibrium bond length in Å */
  equilibriumDistance: number;
  /** Strain ratio: distance / equilibriumDistance */
  strainRatio: number;
  /** Bond order */
  bondOrder: number;
}

/** Color mode for atom rendering */
export type ColorMode = 'element' | 'molecule';

/** Color mode for bond rendering */
export type BondColorMode = 'element' | 'bondType';

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
    /** Nosé-Hoover thermostat energy (eV). 0 when NH is not active. */
    thermostat: number;
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

export interface WorkerSetVelocitiesMessage {
  type: 'set-velocities';
  /** Entries specifying which atoms get new velocities */
  entries: Array<{ atomIndex: number; velocity: Vector3Tuple }>;
}

export interface WorkerBoxMessage {
  type: 'box';
  box: Partial<SimulationBox>;
}

export interface WorkerTransmuteAtomMessage {
  type: 'transmute-atom';
  /** Index of the atom to transmute */
  atomId: number;
  /** Atomic number of the new element */
  newElementNumber: number;
}

export type WorkerInMessage =
  | WorkerInitMessage
  | WorkerStepMessage
  | WorkerConfigMessage
  | WorkerAddAtomMessage
  | WorkerRemoveAtomMessage
  | WorkerDragMessage
  | WorkerMinimizeMessage
  | WorkerSetVelocitiesMessage
  | WorkerBoxMessage
  | WorkerTransmuteAtomMessage;

/** Per-force-type potential energy decomposition (all values in eV) */
export interface EnergyBreakdown {
  /** Morse bond stretch energy */
  morse: number;
  /** Harmonic angle bending energy */
  angle: number;
  /** Dihedral torsion energy */
  torsion: number;
  /** Out-of-plane inversion energy */
  inversion: number;
  /** Lennard-Jones van der Waals energy */
  lj: number;
  /** Coulomb electrostatic energy */
  coulomb: number;
}

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
  energy: {
    kinetic: number;
    potential: number;
    total: number;
    thermostat: number;
  };
  /** Per-force-type potential energy decomposition */
  energyBreakdown: EnergyBreakdown;
  temperature: number;
  /** Molecule ID per atom (from union-find on bond graph) */
  moleculeIds: Int32Array;
  /** Per-molecule computed properties */
  molecules: MoleculeInfo[];
  /** Current simulation box (for PBC rendering) */
  box?: SimulationBox;
  /** Reaction events detected since last state update (empty if none) */
  reactionEvents: ReactionEvent[];
  /** Whether GPU acceleration is active for non-bonded forces */
  gpuAccelerated?: boolean;
}

export interface WorkerReadyMessage {
  type: 'ready';
}

export type WorkerOutMessage = WorkerStateUpdate | WorkerReadyMessage;

// --------------- UI State ---------------

export type InteractionTool =
  | 'select'
  | 'place-atom'
  | 'place-molecule'
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
