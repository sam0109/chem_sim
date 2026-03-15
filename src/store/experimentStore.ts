// ==============================================================
// Zustand store for guided experiment state
//
// Manages the experiment lifecycle: select → running (step-by-step
// with intro → predict → observe → explain phases) → complete.
// ==============================================================

import { create } from 'zustand';
import type {
  Experiment,
  ExperimentPhase,
  StepPhase,
  StepResult,
} from '../experiments/types';
import type { EvaluationResult } from '../challenges/types';
import { experiments } from '../experiments/experiments';

interface ExperimentStore {
  // ---- Available experiments ----
  experiments: Experiment[];

  // ---- Active experiment state ----
  activeExperiment: Experiment | null;
  phase: ExperimentPhase;
  currentStepIndex: number;
  stepPhase: StepPhase;
  stepResults: StepResult[];

  /** User's prediction for the current step */
  currentPrediction: string | number | string[] | null;

  /** Status message during observe phase */
  observeStatus: string;

  // ---- Actions ----
  /** Select an experiment and begin the first step */
  selectExperiment: (experimentId: string) => void;

  /** Advance from intro to predict (or observe if no question) */
  startPrediction: () => void;

  /** Submit the user's prediction and advance to observe phase */
  submitPrediction: (prediction: string | number | string[]) => void;

  /** Skip prediction (for steps without questions — go straight to observe) */
  skipToObserve: () => void;

  /** Called when observation/evaluation is complete */
  completeObservation: (evaluation: EvaluationResult) => void;

  /** Update observation status message */
  setObserveStatus: (status: string) => void;

  /** Advance from explain to the next step (or complete) */
  nextStep: () => void;

  /** Reset back to the selection screen */
  resetExperiment: () => void;
}

export const useExperimentStore = create<ExperimentStore>((set, get) => ({
  experiments,
  activeExperiment: null,
  phase: 'select',
  currentStepIndex: 0,
  stepPhase: 'intro',
  stepResults: [],
  currentPrediction: null,
  observeStatus: '',

  selectExperiment(experimentId: string) {
    const experiment = experiments.find((e) => e.id === experimentId);
    if (!experiment) return;
    set({
      activeExperiment: experiment,
      phase: 'running',
      currentStepIndex: 0,
      stepPhase: 'intro',
      stepResults: [],
      currentPrediction: null,
      observeStatus: '',
    });
  },

  startPrediction() {
    const { activeExperiment, currentStepIndex } = get();
    if (!activeExperiment) return;
    const step = activeExperiment.steps[currentStepIndex];
    if (step.question) {
      set({ stepPhase: 'predict' });
    } else {
      // No question — skip directly to observe
      set({ stepPhase: 'observe', observeStatus: 'Setting up simulation...' });
    }
  },

  submitPrediction(prediction: string | number | string[]) {
    set({
      currentPrediction: prediction,
      stepPhase: 'observe',
      observeStatus: 'Setting up simulation...',
    });
  },

  skipToObserve() {
    set({
      stepPhase: 'observe',
      observeStatus: 'Setting up simulation...',
    });
  },

  completeObservation(evaluation: EvaluationResult) {
    const { currentStepIndex, currentPrediction, stepResults } = get();
    const result: StepResult = {
      stepIndex: currentStepIndex,
      prediction: currentPrediction,
      evaluation,
    };
    set({
      stepPhase: 'explain',
      stepResults: [...stepResults, result],
    });
  },

  setObserveStatus(status: string) {
    set({ observeStatus: status });
  },

  nextStep() {
    const { activeExperiment, currentStepIndex } = get();
    if (!activeExperiment) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= activeExperiment.steps.length) {
      // All steps done
      set({ phase: 'complete' });
    } else {
      set({
        currentStepIndex: nextIndex,
        stepPhase: 'intro',
        currentPrediction: null,
        observeStatus: '',
      });
    }
  },

  resetExperiment() {
    set({
      activeExperiment: null,
      phase: 'select',
      currentStepIndex: 0,
      stepPhase: 'intro',
      stepResults: [],
      currentPrediction: null,
      observeStatus: '',
    });
  },
}));
