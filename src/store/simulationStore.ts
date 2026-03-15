// ==============================================================
// Zustand store for simulation state
// ==============================================================

import { create } from 'zustand';
import type {
  Atom,
  Bond,
  MoleculeInfo,
  ReactionEvent,
  SimulationConfig,
  SimulationBox,
  WorkerStateUpdate,
} from '../data/types';
import elements from '../data/elements';
import { SimulationWorker } from '../worker-comms';

interface SimulationStore {
  // ---- Worker instance ----
  worker: SimulationWorker | null;
  initWorker: () => Promise<void>;

  // ---- Atom/bond data (from worker updates) ----
  atoms: Atom[];
  bonds: Bond[];
  positions: Float64Array;
  forces: Float64Array;
  charges: Float64Array;

  // ---- Molecule tracking (from worker updates) ----
  moleculeIds: Int32Array;
  molecules: MoleculeInfo[];

  // ---- Reaction detection (from worker updates) ----
  reactionLog: ReactionEvent[];

  // ---- Simulation state ----
  step: number;
  energy: { kinetic: number; potential: number; total: number };
  temperature: number;
  config: SimulationConfig;
  box: SimulationBox;

  // ---- Energy history for plotting ----
  energyHistory: Array<{
    step: number;
    kinetic: number;
    potential: number;
    total: number;
    temperature: number;
  }>;

  // ---- Actions ----
  setConfig: (config: Partial<SimulationConfig>) => void;
  setBox: (box: Partial<SimulationBox>) => void;
  addAtom: (atom: Atom) => void;
  addMolecule: (atoms: Atom[]) => void;
  removeAtom: (atomId: number) => void;
  initSimulation: (atoms: Atom[], bonds?: Bond[]) => void;
  toggleRunning: () => void;
  minimize: () => void;
  dragAtom: (atomId: number, position: [number, number, number]) => void;
  releaseDrag: () => void;
  handleWorkerState: (state: WorkerStateUpdate) => void;
  launchEncounter: (
    molAIndices: number[],
    molBIndices: number[],
    speed: number,
    impactParam: number,
  ) => void;
}

const DEFAULT_CONFIG: SimulationConfig = {
  timestep: 0.5,
  temperature: 300,
  thermostat: 'berendsen',
  thermostatTau: 100,
  cutoff: 10.0,
  running: false,
};

const DEFAULT_BOX: SimulationBox = {
  size: [50, 50, 50],
  periodic: false,
};

const MAX_HISTORY = 500;
const MAX_REACTION_LOG = 200;

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  worker: null,
  atoms: [],
  bonds: [],
  positions: new Float64Array(0),
  forces: new Float64Array(0),
  charges: new Float64Array(0),
  moleculeIds: new Int32Array(0),
  molecules: [],
  reactionLog: [],
  step: 0,
  energy: { kinetic: 0, potential: 0, total: 0 },
  temperature: 0,
  config: { ...DEFAULT_CONFIG },
  box: { ...DEFAULT_BOX },
  energyHistory: [],

  async initWorker() {
    const worker = new SimulationWorker();
    await worker.waitReady();
    worker.onStateUpdate((state) => {
      get().handleWorkerState(state);
    });
    set({ worker });
  },

  handleWorkerState(state: WorkerStateUpdate) {
    const { energyHistory } = get();
    const newEntry = {
      step: state.step,
      kinetic: state.energy.kinetic,
      potential: state.energy.potential,
      total: state.energy.total,
      temperature: state.temperature,
    };

    const newHistory = [...energyHistory, newEntry];
    if (newHistory.length > MAX_HISTORY) {
      newHistory.splice(0, newHistory.length - MAX_HISTORY);
    }

    // Update atom positions from flat arrays
    const nAtoms = state.positions.length / 3;
    const updatedAtoms = get().atoms.map((atom, i) => {
      if (i >= nAtoms) return atom;
      return {
        ...atom,
        position: [
          state.positions[i * 3],
          state.positions[i * 3 + 1],
          state.positions[i * 3 + 2],
        ] as [number, number, number],
        charge: state.charges[i] ?? atom.charge,
      };
    });

    set({
      positions: state.positions,
      forces: state.forces,
      bonds: state.bonds,
      charges: state.charges,
      step: state.step,
      energy: state.energy,
      temperature: state.temperature,
      atoms: updatedAtoms,
      energyHistory: newHistory,
      moleculeIds: state.moleculeIds ?? new Int32Array(0),
      molecules: state.molecules ?? [],
      ...(state.box ? { box: state.box } : {}),
      ...(state.reactionEvents && state.reactionEvents.length > 0
        ? {
            reactionLog: [...get().reactionLog, ...state.reactionEvents].slice(
              -MAX_REACTION_LOG,
            ),
          }
        : {}),
    });
  },

  setConfig(partialConfig: Partial<SimulationConfig>) {
    const config = { ...get().config, ...partialConfig };
    set({ config });
    get().worker?.updateConfig(partialConfig);
  },

  setBox(partialBox: Partial<SimulationBox>) {
    const newBox = { ...get().box, ...partialBox };
    set({ box: newBox });
    get().worker?.updateBox(partialBox);
  },

  addAtom(atom: Atom) {
    const atoms = [...get().atoms, atom];
    set({ atoms });
    get().worker?.addAtom(atom);
  },

  addMolecule(newAtoms: Atom[]) {
    // Add a group of atoms at once by re-initializing the worker
    // with the combined atom set. This avoids per-atom topology
    // rebuilds that occur with individual addAtom calls.
    const existingAtoms = get().atoms;
    const baseId = existingAtoms.length;
    const reindexed = newAtoms.map((a, i) => ({
      ...a,
      id: baseId + i,
    }));
    const allAtoms = [...existingAtoms, ...reindexed];
    // Re-init preserves config but resets with new atom set
    set({
      atoms: allAtoms,
      bonds: [],
      energyHistory: [],
      reactionLog: [],
      step: 0,
    });
    const { worker, config, box } = get();
    worker?.init(allAtoms, [], box, { ...config, running: false });
  },

  removeAtom(atomId: number) {
    const atoms = get().atoms.filter((_, i) => i !== atomId);
    set({ atoms });
    get().worker?.removeAtom(atomId);
  },

  initSimulation(atoms: Atom[], bonds: Bond[] = []) {
    set({ atoms, bonds, energyHistory: [], reactionLog: [], step: 0 });
    const { worker, config, box } = get();
    worker?.init(atoms, bonds, box, config);
  },

  toggleRunning() {
    const running = !get().config.running;
    get().setConfig({ running });
  },

  minimize() {
    get().worker?.minimize();
  },

  dragAtom(atomId: number, position: [number, number, number]) {
    get().worker?.drag(atomId, position);
  },

  releaseDrag() {
    // Send drag with invalid id to disable
    get().worker?.drag(-1, [0, 0, 0]);
  },

  launchEncounter(
    molAIndices: number[],
    molBIndices: number[],
    speed: number,
    impactParam: number,
  ) {
    const { atoms, positions, worker } = get();
    if (!worker || molAIndices.length === 0 || molBIndices.length === 0) return;

    // Compute center of mass for each molecule group
    const computeCOM = (
      indices: number[],
    ): { cx: number; cy: number; cz: number; totalMass: number } => {
      let totalMass = 0;
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const i of indices) {
        const el = elements[atoms[i].elementNumber];
        const mass = el ? el.mass : 1.0;
        // Use the flat positions array which is more up-to-date than atom.position
        const px =
          positions.length > i * 3 ? positions[i * 3] : atoms[i].position[0];
        const py =
          positions.length > i * 3 + 1
            ? positions[i * 3 + 1]
            : atoms[i].position[1];
        const pz =
          positions.length > i * 3 + 2
            ? positions[i * 3 + 2]
            : atoms[i].position[2];
        totalMass += mass;
        cx += mass * px;
        cy += mass * py;
        cz += mass * pz;
      }
      if (totalMass > 0) {
        cx /= totalMass;
        cy /= totalMass;
        cz /= totalMass;
      }
      return { cx, cy, cz, totalMass };
    };

    const comA = computeCOM(molAIndices);
    const comB = computeCOM(molBIndices);

    // Direction vector from B to A (approach direction)
    let dx = comA.cx - comB.cx;
    let dy = comA.cy - comB.cy;
    let dz = comA.cz - comB.cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 0) {
      dx /= dist;
      dy /= dist;
      dz /= dist;
    } else {
      dx = 1;
      dy = 0;
      dz = 0;
    }

    // Perpendicular vector for impact parameter offset
    // Choose a vector not parallel to direction
    let perpX: number;
    let perpY: number;
    let perpZ: number;
    if (Math.abs(dx) < 0.9) {
      perpX = 0;
      perpY = -dz;
      perpZ = dy;
    } else {
      perpX = -dz;
      perpY = 0;
      perpZ = dx;
    }
    const perpLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
    if (perpLen > 0) {
      perpX /= perpLen;
      perpY /= perpLen;
      perpZ /= perpLen;
    }

    // Apply impact parameter: offset molecule B perpendicular to approach
    if (impactParam !== 0) {
      // Physically offset molecule B perpendicular to the approach axis
      // before setting velocities, then re-init the worker
      const shiftedAtoms = get().atoms.map((atom, i) => {
        if (molBIndices.includes(i)) {
          return {
            ...atom,
            position: [
              atom.position[0] + perpX * impactParam,
              atom.position[1] + perpY * impactParam,
              atom.position[2] + perpZ * impactParam,
            ] as [number, number, number],
          };
        }
        return atom;
      });
      // Re-init with offset positions, paused
      set({ atoms: shiftedAtoms });
      worker.init(shiftedAtoms, [], get().box, {
        ...get().config,
        running: false,
      });
    }

    // Set approach velocities: each molecule gets half the relative speed
    // in the center-of-mass frame
    const halfSpeed = speed / 2;
    const entries: Array<{
      atomIndex: number;
      velocity: [number, number, number];
    }> = [];
    // Molecule A moves toward B (negative direction)
    for (const i of molAIndices) {
      entries.push({
        atomIndex: i,
        velocity: [-halfSpeed * dx, -halfSpeed * dy, -halfSpeed * dz],
      });
    }
    // Molecule B moves toward A (positive direction)
    for (const i of molBIndices) {
      entries.push({
        atomIndex: i,
        velocity: [halfSpeed * dx, halfSpeed * dy, halfSpeed * dz],
      });
    }
    worker.setVelocities(entries);

    // Start the simulation
    get().setConfig({ running: true });
  },
}));
