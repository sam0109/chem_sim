// ==============================================================
// Zustand store for simulation state
// ==============================================================

import { create } from 'zustand';
import type {
  Atom, Bond, SimulationConfig, SimulationBox,
  WorkerStateUpdate,
} from '../data/types';
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
  addAtom: (atom: Atom) => void;
  removeAtom: (atomId: number) => void;
  initSimulation: (atoms: Atom[], bonds?: Bond[]) => void;
  toggleRunning: () => void;
  minimize: () => void;
  dragAtom: (atomId: number, position: [number, number, number]) => void;
  releaseDrag: () => void;
  handleWorkerState: (state: WorkerStateUpdate) => void;
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

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  worker: null,
  atoms: [],
  bonds: [],
  positions: new Float64Array(0),
  forces: new Float64Array(0),
  charges: new Float64Array(0),
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
    });
  },

  setConfig(partialConfig: Partial<SimulationConfig>) {
    const config = { ...get().config, ...partialConfig };
    set({ config });
    get().worker?.updateConfig(partialConfig);
  },

  addAtom(atom: Atom) {
    const atoms = [...get().atoms, atom];
    set({ atoms });
    get().worker?.addAtom(atom);
  },

  removeAtom(atomId: number) {
    const atoms = get().atoms.filter((_, i) => i !== atomId);
    set({ atoms });
    get().worker?.removeAtom(atomId);
  },

  initSimulation(atoms: Atom[], bonds: Bond[] = []) {
    set({ atoms, bonds, energyHistory: [], step: 0 });
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
}));
