// ==============================================================
// Zustand store for simulation state
// ==============================================================

import { create } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand';
import type {
  Atom,
  Bond,
  EnergyBreakdown,
  MoleculeInfo,
  NEBConfig,
  NEBResult,
  ReactionEvent,
  SimulationConfig,
  SimulationBox,
  SimulationEvent,
  TrajectoryFrame,
  TrajectoryState,
  WorkerStateUpdate,
} from '../data/types';
import { DEFAULT_NEB_CONFIG } from '../data/types';
import elements from '../data/elements';
import { SimulationWorker } from '../worker-comms';
import {
  detectBondEvents,
  detectTemperatureSpike,
  detectEnergyDrift,
  detectBondStrain,
} from '../eventDetector';
import { writeTrajectoryXYZ, downloadTextFile } from '../trajectoryExport';

/** Full simulation store state + actions (exported for context typing) */
export interface SimulationStoreState {
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

  // ---- Event logger (detected on main thread from worker state) ----
  eventLog: SimulationEvent[];

  // ---- Simulation state ----
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
  config: SimulationConfig;
  box: SimulationBox;

  /** Whether GPU acceleration is active for non-bonded forces */
  gpuAccelerated: boolean;

  // ---- Energy history for plotting ----
  energyHistory: Array<{
    step: number;
    kinetic: number;
    potential: number;
    total: number;
    thermostat: number;
    temperature: number;
    breakdown: EnergyBreakdown;
  }>;

  // ---- Actions ----
  setConfig: (config: Partial<SimulationConfig>) => void;
  setBox: (box: Partial<SimulationBox>) => void;
  addAtom: (atom: Atom) => void;
  addMolecule: (atoms: Atom[]) => void;
  removeAtom: (atomId: number) => void;
  transmuteAtom: (atomId: number, newElementNumber: number) => void;
  initSimulation: (atoms: Atom[], bonds?: Bond[]) => void;
  toggleRunning: () => void;
  minimize: () => void;
  calm: () => void;
  dragAtom: (atomId: number, position: [number, number, number]) => void;
  releaseDrag: () => void;
  handleWorkerState: (state: WorkerStateUpdate) => void;
  launchEncounter: (
    molAIndices: number[],
    molBIndices: number[],
    speed: number,
    impactParam: number,
  ) => void;

  // ---- Trajectory recording & replay ----
  trajectory: TrajectoryState;
  /** Start trajectory playback (pauses live simulation) */
  startPlayback: () => void;
  /** Stop trajectory playback */
  stopPlayback: () => void;
  /** Jump to a specific frame index */
  seekToFrame: (index: number) => void;
  /** Advance or rewind playback by one frame */
  stepPlayback: (direction: 1 | -1) => void;
  /** Set playback speed multiplier */
  setPlaybackSpeed: (speed: number) => void;
  /** Clear all recorded trajectory frames */
  clearTrajectory: () => void;
  /** Toggle trajectory recording on/off */
  toggleRecording: () => void;
  /** Export trajectory as multi-frame XYZ file download */
  exportTrajectoryXYZ: () => void;

  // ---- NEB (Nudged Elastic Band) ----
  nebResult: NEBResult | null;
  nebProgress: {
    iteration: number;
    maxForce: number;
    energyProfile: number[];
  } | null;
  nebRunning: boolean;
  /** Captured reactant positions for NEB */
  nebReactantPositions: Float64Array | null;
  /** Captured product positions for NEB */
  nebProductPositions: Float64Array | null;
  captureNEBReactant: () => void;
  captureNEBProduct: () => void;
  runNEB: (config?: Partial<NEBConfig>) => void;
  cancelNEB: () => void;
  clearNEBResult: () => void;
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
const MAX_EVENT_LOG = 200;
const MAX_TRAJECTORY_FRAMES = 5000;
// Memory budget: 5000 frames × 100 atoms × 3 coords × 8 bytes ≈ 12 MB.
// Acceptable for browser use; ring buffer drops oldest frames when full.

/**
 * Factory: creates a vanilla Zustand store with its own SimulationWorker.
 * Used by SimulationPanel to give each panel an independent simulation.
 */
export function createSimulationStoreInstance(): StoreApi<SimulationStoreState> {
  return createStore<SimulationStoreState>((set, get) =>
    buildStoreSlice(set, get),
  );
}

/** Shared store-creation logic used by both the factory and the global hook */
function buildStoreSlice(
  set: StoreApi<SimulationStoreState>['setState'],
  get: StoreApi<SimulationStoreState>['getState'],
): SimulationStoreState {
  // Per-instance mutable state for event detection (not in Zustand store).
  // These track previous frame values for delta-based event detection.
  let prevTemperature = 0;
  const eventCooldownMap = new Map<string, number>();

  // Per-instance mutable state for trajectory playback timer
  let playbackTimerId: ReturnType<typeof setInterval> | null = null;

  /** Stop the playback interval timer if running */
  function clearPlaybackTimer(): void {
    if (playbackTimerId !== null) {
      clearInterval(playbackTimerId);
      playbackTimerId = null;
    }
  }

  /** Start a playback interval that advances frames at the given speed */
  function startPlaybackInterval(speed: number): void {
    clearPlaybackTimer();
    const intervalMs = Math.max(1, Math.round(16 / speed));
    playbackTimerId = setInterval(() => {
      const { trajectory: t } = get();
      if (!t.playing) {
        clearPlaybackTimer();
        return;
      }
      const nextIndex = t.currentFrameIndex + 1;
      if (nextIndex >= t.frames.length) {
        clearPlaybackTimer();
        set({ trajectory: { ...t, playing: false } });
        return;
      }
      set({ trajectory: { ...t, currentFrameIndex: nextIndex } });
      applyFrame(t.frames[nextIndex]);
    }, intervalMs);
  }

  /** Apply a trajectory frame's data to the store, updating all visual state */
  function applyFrame(frame: TrajectoryFrame): void {
    const nAtoms = frame.positions.length / 3;
    const updatedAtoms = get().atoms.map((atom, i) => {
      if (i >= nAtoms) return atom;
      return {
        ...atom,
        position: [
          frame.positions[i * 3],
          frame.positions[i * 3 + 1],
          frame.positions[i * 3 + 2],
        ] as [number, number, number],
        charge: frame.charges[i] ?? atom.charge,
      };
    });

    set({
      positions: frame.positions,
      bonds: frame.bonds,
      charges: frame.charges,
      step: frame.step,
      energy: frame.energy,
      energyBreakdown: frame.energyBreakdown,
      temperature: frame.temperature,
      moleculeIds: frame.moleculeIds,
      molecules: frame.molecules,
      atoms: updatedAtoms,
    });
  }

  return {
    worker: null,
    atoms: [],
    bonds: [],
    positions: new Float64Array(0),
    forces: new Float64Array(0),
    charges: new Float64Array(0),
    moleculeIds: new Int32Array(0),
    molecules: [],
    reactionLog: [],
    eventLog: [],
    step: 0,
    energy: { kinetic: 0, potential: 0, total: 0, thermostat: 0 },
    energyBreakdown: {
      morse: 0,
      angle: 0,
      torsion: 0,
      inversion: 0,
      lj: 0,
      coulomb: 0,
    },
    temperature: 0,
    config: { ...DEFAULT_CONFIG },
    box: { ...DEFAULT_BOX },
    gpuAccelerated: false,
    energyHistory: [],
    trajectory: {
      recording: true,
      playing: false,
      currentFrameIndex: -1,
      playbackSpeed: 1,
      frames: [],
      maxFrames: MAX_TRAJECTORY_FRAMES,
    },
    nebResult: null,
    nebProgress: null,
    nebRunning: false,
    nebReactantPositions: null,
    nebProductPositions: null,

    async initWorker() {
      const worker = new SimulationWorker();
      await worker.waitReady();
      worker.onStateUpdate((state) => {
        get().handleWorkerState(state);
      });
      worker.onNEBProgressUpdate((iteration, energyProfile, maxForce) => {
        set({
          nebProgress: { iteration, maxForce, energyProfile },
        });
      });
      worker.onNEBResultUpdate((result) => {
        set({
          nebResult: result,
          nebRunning: false,
          nebProgress: null,
        });
      });
      set({ worker });
    },

    handleWorkerState(state: WorkerStateUpdate) {
      const { energyHistory, atoms, config } = get();
      const newEntry = {
        step: state.step,
        kinetic: state.energy.kinetic,
        potential: state.energy.potential,
        total: state.energy.total,
        thermostat: state.energy.thermostat,
        temperature: state.temperature,
        breakdown: state.energyBreakdown,
      };

      const newHistory = [...energyHistory, newEntry];
      if (newHistory.length > MAX_HISTORY) {
        newHistory.splice(0, newHistory.length - MAX_HISTORY);
      }

      // --- Event detection ---
      // Extract atomic numbers from atom objects (avoid per-atom allocation)
      const atomicNumbers = atoms.map((a) => a.elementNumber);
      const newEvents: SimulationEvent[] = [];

      // 1. Bond events from reaction detection (enriched with physical context)
      if (state.reactionEvents && state.reactionEvents.length > 0) {
        newEvents.push(
          ...detectBondEvents(
            state.reactionEvents,
            state.positions,
            atomicNumbers,
            eventCooldownMap,
          ),
        );
      }

      // 2. Temperature spike detection
      const tempEvent = detectTemperatureSpike(
        state.step,
        prevTemperature,
        state.temperature,
        eventCooldownMap,
      );
      if (tempEvent) newEvents.push(tempEvent);

      // 3. Energy drift detection (NVE only)
      const driftEvent = detectEnergyDrift(
        state.step,
        newHistory,
        config.timestep,
        config.thermostat,
        eventCooldownMap,
      );
      if (driftEvent) newEvents.push(driftEvent);

      // 4. Bond strain detection
      newEvents.push(
        ...detectBondStrain(
          state.step,
          state.bonds,
          state.positions,
          atomicNumbers,
          eventCooldownMap,
        ),
      );

      // Update previous temperature for next frame
      prevTemperature = state.temperature;

      // --- Trajectory recording ---
      // Record a snapshot of this frame for later replay
      const { trajectory } = get();
      let updatedTrajectory = trajectory;
      if (trajectory.recording && !trajectory.playing) {
        const frame: TrajectoryFrame = {
          step: state.step,
          positions: state.positions.slice(),
          bonds: [...state.bonds], // defensive copy — topology may change between frames
          charges: state.charges.slice(),
          energy: { ...state.energy },
          energyBreakdown: { ...state.energyBreakdown },
          temperature: state.temperature,
          moleculeIds: state.moleculeIds
            ? new Int32Array(state.moleculeIds)
            : new Int32Array(0),
          molecules: [...(state.molecules ?? [])], // defensive copy
        };
        const newFrames = [...trajectory.frames, frame];
        if (newFrames.length > trajectory.maxFrames) {
          newFrames.splice(0, newFrames.length - trajectory.maxFrames);
        }
        updatedTrajectory = { ...trajectory, frames: newFrames };
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
        energyBreakdown: state.energyBreakdown,
        temperature: state.temperature,
        atoms: updatedAtoms,
        energyHistory: newHistory,
        trajectory: updatedTrajectory,
        moleculeIds: state.moleculeIds ?? new Int32Array(0),
        molecules: state.molecules ?? [],
        ...(state.box ? { box: state.box } : {}),
        ...(state.reactionEvents && state.reactionEvents.length > 0
          ? {
              reactionLog: [
                ...get().reactionLog,
                ...state.reactionEvents,
              ].slice(-MAX_REACTION_LOG),
            }
          : {}),
        gpuAccelerated: state.gpuAccelerated ?? false,
        ...(newEvents.length > 0
          ? {
              eventLog: [...get().eventLog, ...newEvents].slice(-MAX_EVENT_LOG),
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
      prevTemperature = 0;
      eventCooldownMap.clear();
      clearPlaybackTimer();
      set({
        atoms: allAtoms,
        bonds: [],
        energyHistory: [],
        reactionLog: [],
        eventLog: [],
        step: 0,
        trajectory: {
          recording: true,
          playing: false,
          currentFrameIndex: -1,
          playbackSpeed: get().trajectory.playbackSpeed,
          frames: [],
          maxFrames: get().trajectory.maxFrames,
        },
      });
      const { worker, config, box } = get();
      worker?.init(allAtoms, [], box, { ...config, running: false });
    },

    removeAtom(atomId: number) {
      const atoms = get().atoms.filter((_, i) => i !== atomId);
      set({ atoms });
      get().worker?.removeAtom(atomId);
    },

    transmuteAtom(atomId: number, newElementNumber: number) {
      // Optimistically update store-side atom element before worker confirms
      const atoms = get().atoms.map((atom, i) =>
        i === atomId ? { ...atom, elementNumber: newElementNumber } : atom,
      );
      set({ atoms });
      get().worker?.transmuteAtom(atomId, newElementNumber);
    },

    initSimulation(atoms: Atom[], bonds: Bond[] = []) {
      prevTemperature = 0;
      eventCooldownMap.clear();
      clearPlaybackTimer();
      set({
        atoms,
        bonds,
        energyHistory: [],
        reactionLog: [],
        eventLog: [],
        step: 0,
        trajectory: {
          recording: true,
          playing: false,
          currentFrameIndex: -1,
          playbackSpeed: get().trajectory.playbackSpeed,
          frames: [],
          maxFrames: get().trajectory.maxFrames,
        },
      });
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

    calm() {
      get().worker?.calm();
    },

    dragAtom(atomId: number, position: [number, number, number]) {
      get().worker?.drag(atomId, position);
    },

    releaseDrag() {
      // Send drag with invalid id to disable
      get().worker?.drag(-1, [0, 0, 0]);
    },

    // ---- Trajectory replay actions ----

    startPlayback() {
      const { trajectory, config } = get();
      if (trajectory.frames.length === 0) return;

      // Pause the live simulation if running
      if (config.running) {
        get().setConfig({ running: false });
      }

      const startIndex =
        trajectory.currentFrameIndex >= 0 ? trajectory.currentFrameIndex : 0;

      set({
        trajectory: {
          ...trajectory,
          playing: true,
          currentFrameIndex: startIndex,
        },
      });

      // Apply the first frame immediately
      applyFrame(trajectory.frames[startIndex]);

      // Start playback interval
      startPlaybackInterval(trajectory.playbackSpeed);
    },

    stopPlayback() {
      clearPlaybackTimer();
      const { trajectory } = get();
      set({
        trajectory: { ...trajectory, playing: false },
      });
    },

    seekToFrame(index: number) {
      const { trajectory } = get();
      if (index < 0 || index >= trajectory.frames.length) return;

      // If we're in live mode, pause simulation and enter replay mode
      if (!trajectory.playing && get().config.running) {
        get().setConfig({ running: false });
      }

      set({
        trajectory: { ...trajectory, currentFrameIndex: index },
      });
      applyFrame(trajectory.frames[index]);
    },

    stepPlayback(direction: 1 | -1) {
      const { trajectory } = get();
      const newIndex = trajectory.currentFrameIndex + direction;
      if (newIndex < 0 || newIndex >= trajectory.frames.length) return;

      // Pause active playback if stepping manually
      if (trajectory.playing) {
        clearPlaybackTimer();
        set({
          trajectory: {
            ...trajectory,
            playing: false,
            currentFrameIndex: newIndex,
          },
        });
      } else {
        set({
          trajectory: { ...trajectory, currentFrameIndex: newIndex },
        });
      }
      applyFrame(trajectory.frames[newIndex]);
    },

    setPlaybackSpeed(speed: number) {
      const { trajectory } = get();
      set({ trajectory: { ...trajectory, playbackSpeed: speed } });

      // If currently playing, restart the timer with the new speed
      if (trajectory.playing) {
        startPlaybackInterval(speed);
      }
    },

    clearTrajectory() {
      clearPlaybackTimer();
      set({
        trajectory: {
          recording: get().trajectory.recording,
          playing: false,
          currentFrameIndex: -1,
          playbackSpeed: get().trajectory.playbackSpeed,
          frames: [],
          maxFrames: get().trajectory.maxFrames,
        },
      });
    },

    toggleRecording() {
      const { trajectory } = get();
      set({
        trajectory: { ...trajectory, recording: !trajectory.recording },
      });
    },

    exportTrajectoryXYZ() {
      const { trajectory, atoms } = get();
      if (trajectory.frames.length === 0) return;
      const atomicNumbers = atoms.map((a) => a.elementNumber);
      const xyzContent = writeTrajectoryXYZ(trajectory.frames, atomicNumbers);
      downloadTextFile(xyzContent, 'trajectory.xyz');
    },

    launchEncounter(
      molAIndices: number[],
      molBIndices: number[],
      speed: number,
      impactParam: number,
    ) {
      const { atoms, positions, worker } = get();
      if (!worker || molAIndices.length === 0 || molBIndices.length === 0)
        return;

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

    captureNEBReactant() {
      const { positions } = get();
      if (positions.length > 0) {
        set({ nebReactantPositions: positions.slice() });
      }
    },

    captureNEBProduct() {
      const { positions } = get();
      if (positions.length > 0) {
        set({ nebProductPositions: positions.slice() });
      }
    },

    runNEB(partialConfig?: Partial<NEBConfig>) {
      const { worker, nebReactantPositions, nebProductPositions } = get();
      if (!worker || !nebReactantPositions || !nebProductPositions) return;

      const config: NEBConfig = { ...DEFAULT_NEB_CONFIG, ...partialConfig };
      set({ nebRunning: true, nebResult: null, nebProgress: null });
      worker.runNEB(nebReactantPositions, nebProductPositions, config);
    },

    cancelNEB() {
      const { worker } = get();
      worker?.cancelNEB();
      set({ nebRunning: false, nebProgress: null });
    },

    clearNEBResult() {
      set({
        nebResult: null,
        nebProgress: null,
        nebReactantPositions: null,
        nebProductPositions: null,
      });
    },
  };
}

/**
 * Global default simulation store — used in single-panel mode
 * and as the "left" panel in comparison mode.
 */
export const useSimulationStore = create<SimulationStoreState>((set, get) =>
  buildStoreSlice(set, get),
);

/**
 * Get the global store as a vanilla StoreApi for use with context providers.
 * Zustand's `create()` hook IS a StoreApi but TypeScript needs an explicit cast.
 */
export function getGlobalSimulationStore(): StoreApi<SimulationStoreState> {
  return useSimulationStore as unknown as StoreApi<SimulationStoreState>;
}
