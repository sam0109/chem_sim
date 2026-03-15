// ==============================================================
// Worker communication layer
// Handles setup and messaging with the simulation Web Worker
// ==============================================================

import type {
  Atom,
  Bond,
  FEPConfig,
  FEPProgress,
  FEPResult,
  FEPSample,
  NEBConfig,
  NEBResult,
  SimulationBox,
  SimulationConfig,
  WorkerInMessage,
  WorkerOutMessage,
  WorkerStateUpdate,
} from './data/types';

export type StateCallback = (state: WorkerStateUpdate) => void;
export type NEBProgressCallback = (
  iteration: number,
  energyProfile: number[],
  maxForce: number,
) => void;
export type NEBResultCallback = (result: NEBResult) => void;
export type FEPSamplesCallback = (samples: FEPSample[]) => void;
export type FEPProgressCallback = (progress: FEPProgress) => void;
export type FEPResultCallback = (result: FEPResult) => void;

export class SimulationWorker {
  private worker: Worker;
  private onState: StateCallback | null = null;
  private onNEBProgress: NEBProgressCallback | null = null;
  private onNEBResult: NEBResultCallback | null = null;
  private onFEPSamples: FEPSamplesCallback | null = null;
  private onFEPProgress: FEPProgressCallback | null = null;
  private onFEPResult: FEPResultCallback | null = null;
  private readyPromise: Promise<void>;

  constructor() {
    this.worker = new Worker(new URL('./engine/worker.ts', import.meta.url), {
      type: 'module',
    });

    this.readyPromise = new Promise<void>((resolve) => {
      const handler = (e: MessageEvent<WorkerOutMessage>) => {
        if (e.data.type === 'ready') {
          resolve();
        }
      };
      this.worker.addEventListener('message', handler, { once: true });
    });

    this.worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      if (e.data.type === 'state' && this.onState) {
        this.onState(e.data);
      } else if (e.data.type === 'neb-progress' && this.onNEBProgress) {
        this.onNEBProgress(
          e.data.iteration,
          e.data.energyProfile,
          e.data.maxForce,
        );
      } else if (e.data.type === 'neb-result' && this.onNEBResult) {
        this.onNEBResult(e.data.result);
      } else if (e.data.type === 'fep-samples' && this.onFEPSamples) {
        this.onFEPSamples(e.data.samples);
      } else if (e.data.type === 'fep-progress' && this.onFEPProgress) {
        this.onFEPProgress(e.data.progress);
      } else if (e.data.type === 'fep-result' && this.onFEPResult) {
        this.onFEPResult(e.data.result);
      }
    };
  }

  async waitReady(): Promise<void> {
    return this.readyPromise;
  }

  onStateUpdate(callback: StateCallback): void {
    this.onState = callback;
  }

  private send(msg: WorkerInMessage): void {
    this.worker.postMessage(msg);
  }

  init(
    atoms: Atom[],
    bonds: Bond[],
    box: SimulationBox,
    config: SimulationConfig,
  ): void {
    this.send({ type: 'init', atoms, bonds, box, config });
  }

  step(steps: number = 1): void {
    this.send({ type: 'step', steps });
  }

  updateConfig(config: Partial<SimulationConfig>): void {
    this.send({ type: 'config', config });
  }

  addAtom(atom: Atom): void {
    this.send({ type: 'add-atom', atom });
  }

  removeAtom(atomId: number): void {
    this.send({ type: 'remove-atom', atomId });
  }

  transmuteAtom(atomId: number, newElementNumber: number): void {
    this.send({ type: 'transmute-atom', atomId, newElementNumber });
  }

  drag(atomId: number, targetPosition: [number, number, number]): void {
    this.send({ type: 'drag', atomId, targetPosition });
  }

  minimize(maxSteps: number = 500, tolerance: number = 0.01): void {
    this.send({ type: 'minimize', maxSteps, tolerance });
  }

  setVelocities(
    entries: Array<{ atomIndex: number; velocity: [number, number, number] }>,
  ): void {
    this.send({ type: 'set-velocities', entries });
  }

  updateBox(box: Partial<SimulationBox>): void {
    this.send({ type: 'box', box });
  }

  runNEB(
    reactantPositions: Float64Array,
    productPositions: Float64Array,
    config: NEBConfig,
  ): void {
    this.send({ type: 'neb', reactantPositions, productPositions, config });
  }

  cancelNEB(): void {
    this.send({ type: 'neb-cancel' });
  }

  onNEBProgressUpdate(callback: NEBProgressCallback): void {
    this.onNEBProgress = callback;
  }

  onNEBResultUpdate(callback: NEBResultCallback): void {
    this.onNEBResult = callback;
  }

  calm(): void {
    this.send({ type: 'calm' });
  }

  // ---- FEP methods ----

  configureFEP(config: FEPConfig): void {
    this.send({ type: 'fep-config', config });
  }

  setFEPLambda(lambda: number): void {
    this.send({ type: 'fep-set-lambda', lambda });
  }

  startFEPScan(): void {
    this.send({ type: 'fep-start-scan' });
  }

  cancelFEP(): void {
    this.send({ type: 'fep-cancel' });
  }

  onFEPSamplesUpdate(callback: FEPSamplesCallback): void {
    this.onFEPSamples = callback;
  }

  onFEPProgressUpdate(callback: FEPProgressCallback): void {
    this.onFEPProgress = callback;
  }

  onFEPResultUpdate(callback: FEPResultCallback): void {
    this.onFEPResult = callback;
  }

  terminate(): void {
    this.worker.terminate();
  }
}
