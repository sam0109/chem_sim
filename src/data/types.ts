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

// --------------- Nudged Elastic Band (NEB) ---------------

/**
 * Configuration for the Nudged Elastic Band method.
 * Reference: Henkelman et al., J. Chem. Phys. 113, 9901 (2000)
 */
export interface NEBConfig {
  /** Number of intermediate images (default: 7) */
  nImages: number;
  /** Spring constant connecting images in eV/Å² (default: 0.1) */
  springK: number;
  /** Enable climbing-image NEB for accurate saddle point (default: true) */
  climbingImage: boolean;
  /** Iteration at which to activate climbing image (default: 20) */
  ciActivationIter: number;
  /** Maximum optimization iterations (default: 500) */
  maxIterations: number;
  /** Convergence criterion: max perpendicular force in eV/Å (default: 0.05) */
  forceTolerance: number;
  /** Initial optimization step size in Å (default: 0.01) */
  stepSize: number;
}

/** Default NEB configuration values */
export const DEFAULT_NEB_CONFIG: NEBConfig = {
  nImages: 7,
  springK: 0.1, // eV/Å² — typical value for molecular systems
  climbingImage: true,
  ciActivationIter: 20,
  maxIterations: 500,
  forceTolerance: 0.05, // eV/Å
  stepSize: 0.01, // Å
};

/** A single image along the NEB reaction path */
export interface NEBImage {
  /** Atom positions for this image — flat Float64Array [x0,y0,z0,...] */
  positions: Float64Array;
  /** Potential energy of this image in eV */
  energy: number;
}

/**
 * Result of a completed NEB calculation.
 * Contains the minimum energy path from reactant to product.
 */
export interface NEBResult {
  /** All images along the converged path (including endpoints) */
  images: NEBImage[];
  /** Whether the optimization converged within tolerance */
  converged: boolean;
  /** Number of iterations performed */
  iterations: number;
  /** Energy at each image in eV */
  energyProfile: number[];
  /** Maximum perpendicular force on any image at final iteration (eV/Å) */
  maxForce: number;
  /** Index of the highest-energy image (transition state estimate) */
  tsImageIndex: number;
  /** Energy at the transition state in eV */
  tsEnergy: number;
  /** Forward reaction barrier in eV (TS energy − reactant energy) */
  barrier: number;
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

export interface WorkerNEBMessage {
  type: 'neb';
  /** Reactant (starting) positions — flat Float64Array [x0,y0,z0,...] */
  reactantPositions: Float64Array;
  /** Product (ending) positions — flat Float64Array [x0,y0,z0,...] */
  productPositions: Float64Array;
  /** NEB configuration */
  config: NEBConfig;
}

export interface WorkerNEBCancelMessage {
  type: 'neb-cancel';
}

/** Zero all velocities and reset thermostat state */
export interface WorkerCalmMessage {
  type: 'calm';
}

/** Configure FEP calculation parameters */
export interface WorkerFEPConfigMessage {
  type: 'fep-config';
  config: FEPConfig;
}

/** Update the λ parameter for the current FEP calculation */
export interface WorkerFEPSetLambdaMessage {
  type: 'fep-set-lambda';
  lambda: number;
}

/** Start a full FEP scan across all λ windows */
export interface WorkerFEPStartScanMessage {
  type: 'fep-start-scan';
}

/** Cancel an in-progress FEP scan */
export interface WorkerFEPCancelMessage {
  type: 'fep-cancel';
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
  | WorkerTransmuteAtomMessage
  | WorkerNEBMessage
  | WorkerNEBCancelMessage
  | WorkerCalmMessage
  | WorkerFEPConfigMessage
  | WorkerFEPSetLambdaMessage
  | WorkerFEPStartScanMessage
  | WorkerFEPCancelMessage;

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

export interface WorkerNEBProgressMessage {
  type: 'neb-progress';
  /** Current iteration */
  iteration: number;
  /** Energy at each image in eV */
  energyProfile: number[];
  /** Maximum perpendicular force across images (eV/Å) */
  maxForce: number;
}

export interface WorkerNEBResultMessage {
  type: 'neb-result';
  /** Complete NEB calculation result */
  result: NEBResult;
}

/** FEP samples collected during production at one λ window */
export interface WorkerFEPSamplesMessage {
  type: 'fep-samples';
  /** Samples from the most recent production run */
  samples: FEPSample[];
}

/** FEP scan progress update */
export interface WorkerFEPProgressMessage {
  type: 'fep-progress';
  progress: FEPProgress;
}

/** FEP scan complete — final free energy result */
export interface WorkerFEPResultMessage {
  type: 'fep-result';
  result: FEPResult;
}

export type WorkerOutMessage =
  | WorkerStateUpdate
  | WorkerReadyMessage
  | WorkerNEBProgressMessage
  | WorkerNEBResultMessage
  | WorkerFEPSamplesMessage
  | WorkerFEPProgressMessage
  | WorkerFEPResultMessage;

// --------------- Free Energy Perturbation (FEP) ---------------

/**
 * Identifies an atom undergoing alchemical transformation between two states.
 * State A represents the starting system, state B the target system.
 * During an FEP calculation, the potential V(λ) = (1−λ)·V_A + λ·V_B
 * smoothly interpolates between the two endpoints.
 *
 * Reference: Zwanzig, J. Chem. Phys. 22, 1420 (1954)
 */
export interface AlchemicalAtom {
  /** Atom index in the simulation arrays */
  atomIndex: number;
  /** State A (λ=0) properties */
  stateA: {
    elementNumber: number;
    charge: number;
    hybridization: Hybridization;
  };
  /** State B (λ=1) properties */
  stateB: {
    elementNumber: number;
    charge: number;
    hybridization: Hybridization;
  };
}

/**
 * Configuration for a Free Energy Perturbation calculation.
 *
 * Two methods are supported:
 * - Thermodynamic Integration (TI): ΔG = ∫₀¹ ⟨∂V/∂λ⟩_λ dλ
 * - FEP (Zwanzig equation): ΔG = −kT ln⟨exp(−ΔV/kT)⟩
 *
 * Soft-core potentials (Beutler et al., Chem. Phys. Lett. 222, 529 (1994))
 * prevent singularities when atoms appear or disappear.
 */
export interface FEPConfig {
  /** Whether FEP is active */
  enabled: boolean;
  /** Current λ value [0, 1] — interpolation parameter */
  lambda: number;
  /** Atoms undergoing alchemical transformation */
  alchemicalAtoms: AlchemicalAtom[];
  /** Soft-core α parameter (default 0.5). Controls the smoothing radius.
   *  Source: Beutler et al., Chem. Phys. Lett. 222, 529 (1994), Eq. 3 */
  softCoreAlpha: number;
  /** Soft-core power p (default 1). Exponent on the λ dependence.
   *  Source: Beutler et al., Chem. Phys. Lett. 222, 529 (1994), Eq. 3 */
  softCorePower: number;
  /** Steps between ∂V/∂λ samples during production (default 1) */
  collectInterval: number;
  /** Number of equilibration steps per λ window before collecting samples */
  equilibrationSteps: number;
  /** Number of production steps per λ window for collecting samples */
  productionSteps: number;
  /** λ values defining the thermodynamic path (e.g. [0.0, 0.1, ..., 1.0]) */
  lambdaSchedule: number[];
}

/** Default FEP configuration values */
export const DEFAULT_FEP_CONFIG: FEPConfig = {
  enabled: false,
  lambda: 0,
  alchemicalAtoms: [],
  softCoreAlpha: 0.5, // Beutler et al., Chem. Phys. Lett. 222, 529 (1994)
  softCorePower: 1, // Beutler et al., Chem. Phys. Lett. 222, 529 (1994)
  collectInterval: 1,
  equilibrationSteps: 1000,
  productionSteps: 5000,
  lambdaSchedule: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
};

/**
 * A single sample of the FEP thermodynamic estimator collected during
 * production simulation at a given λ value.
 */
export interface FEPSample {
  /** λ value at which this sample was collected */
  lambda: number;
  /** ∂V/∂λ = V_B − V_A at current configuration (eV), used for TI */
  dVdLambda: number;
  /** ΔV = V_B − V_A for the Zwanzig exponential average (eV) */
  deltaV: number;
  /** Simulation step when this sample was collected */
  step: number;
}

/**
 * Result of a completed FEP/TI free energy calculation.
 */
export interface FEPResult {
  /** Free energy difference ΔG in eV */
  deltaG: number;
  /** Statistical error estimate in eV (from block averaging) */
  error: number;
  /** Method used: TI (trapezoidal integration) or Zwanzig (exponential average) */
  method: 'TI' | 'Zwanzig';
  /** Per-λ-window mean ⟨∂V/∂λ⟩ values (for TI curve plotting) */
  dVdLambdaMeans: number[];
  /** Per-λ-window standard errors of ⟨∂V/∂λ⟩ */
  dVdLambdaErrors: number[];
  /** λ schedule used */
  lambdaSchedule: number[];
}

/** Phases of an FEP scan — tracks progress through the λ schedule */
export type FEPPhase = 'idle' | 'equilibrating' | 'collecting' | 'complete';

/**
 * Progress state for an in-flight FEP scan, sent from worker to main thread.
 */
export interface FEPProgress {
  /** Current phase of the FEP calculation */
  phase: FEPPhase;
  /** Index into the λ schedule (which window is active) */
  currentWindowIndex: number;
  /** Total number of λ windows */
  totalWindows: number;
  /** Steps completed in the current window */
  stepsInWindow: number;
  /** Total steps for the current window (equil + production) */
  totalStepsInWindow: number;
  /** Samples collected so far across all windows */
  totalSamplesCollected: number;
}

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

// --------------- Trajectory Recording ---------------

/** A single snapshot of simulation state for trajectory replay */
export interface TrajectoryFrame {
  /** Simulation step when this frame was captured */
  step: number;
  /** Flat Float64Array: [x0,y0,z0,x1,y1,z1,...] */
  positions: Float64Array;
  /** Updated bonds array (topology may have changed due to reactions) */
  bonds: Bond[];
  /** Partial charges per atom */
  charges: Float64Array;
  /** System energies in eV */
  energy: {
    kinetic: number;
    potential: number;
    total: number;
    thermostat: number;
  };
  /** Per-force-type potential energy decomposition */
  energyBreakdown: EnergyBreakdown;
  /** Instantaneous temperature in K */
  temperature: number;
  /** Molecule ID per atom (from union-find on bond graph) */
  moleculeIds: Int32Array;
  /** Per-molecule computed properties */
  molecules: MoleculeInfo[];
}

/** State for the trajectory recording and replay system */
export interface TrajectoryState {
  /** Whether new frames are being recorded from the simulation */
  recording: boolean;
  /** Whether trajectory playback is active */
  playing: boolean;
  /** Current frame index during playback (-1 when not in playback) */
  currentFrameIndex: number;
  /** Playback speed multiplier (e.g., 0.25, 0.5, 1, 2, 4) */
  playbackSpeed: number;
  /** Recorded trajectory frames (ring buffer, oldest dropped when full) */
  frames: TrajectoryFrame[];
  /** Maximum number of frames to store before dropping oldest */
  maxFrames: number;
}
