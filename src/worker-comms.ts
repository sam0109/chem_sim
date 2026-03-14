// ==============================================================
// Worker communication layer
// Handles setup and messaging with the simulation Web Worker
// ==============================================================

import type {
  Atom, Bond, SimulationBox, SimulationConfig,
  WorkerInMessage, WorkerOutMessage, WorkerStateUpdate,
} from './data/types';

export type StateCallback = (state: WorkerStateUpdate) => void;

export class SimulationWorker {
  private worker: Worker;
  private onState: StateCallback | null = null;
  private readyPromise: Promise<void>;

  constructor() {
    this.worker = new Worker(
      new URL('./engine/worker.ts', import.meta.url),
      { type: 'module' }
    );

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

  init(atoms: Atom[], bonds: Bond[], box: SimulationBox, config: SimulationConfig): void {
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

  drag(atomId: number, targetPosition: [number, number, number]): void {
    this.send({ type: 'drag', atomId, targetPosition });
  }

  minimize(maxSteps: number = 500, tolerance: number = 0.01): void {
    this.send({ type: 'minimize', maxSteps, tolerance });
  }

  terminate(): void {
    this.worker.terminate();
  }
}
