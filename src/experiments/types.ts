// ==============================================================
// Guided experiment types
//
// Defines the data model for multi-step guided experiments.
// Each experiment walks the user through a structured sequence:
// setup → predict → observe → explain, potentially across
// multiple steps with different simulation conditions.
//
// Reuses ChallengeQuestion types from the challenge system for
// prediction inputs (multiple-choice, numeric-estimate, ordering).
// ==============================================================

import type { Atom, SimulationConfig } from '../data/types';
import type { ChallengeQuestion, EvaluationResult } from '../challenges/types';

// --------------- Experiment Step Definition ---------------

/** Difficulty rating for an experiment */
export type ExperimentDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * Configuration for how the simulation should run during the
 * observe phase of a step.
 */
export interface StepSimulationConfig {
  /** Atoms to load (if provided, replaces current scene) */
  atoms?: () => Atom[];
  /** Config overrides applied before running (temperature, thermostat, etc.) */
  configOverrides?: Partial<SimulationConfig>;
  /** Whether to energy-minimize before observing (default: true) */
  minimizeFirst?: boolean;
  /** Number of simulation steps to run after minimize */
  stepsToRun?: number;
}

/**
 * A single step within a guided experiment.
 *
 * Each step has up to four phases:
 *   1. **intro** — text explaining what this step investigates
 *   2. **predict** — user makes a prediction (optional)
 *   3. **observe** — simulation runs, measurements are taken
 *   4. **explain** — results and explanation are shown
 */
export interface ExperimentStep {
  /** Short title for this step (shown in progress indicator) */
  title: string;

  /** Instructional text shown in the intro phase */
  introText: string;

  /**
   * Optional prediction question. If omitted, the step skips
   * directly from intro to observe.
   */
  question?: ChallengeQuestion;

  /** Simulation configuration for the observe phase */
  simulation: StepSimulationConfig;

  /**
   * Evaluate the simulation result after the observe phase.
   * Returns correct answer and measured values for display.
   * If no question was asked, this is used only for displaying measurements.
   */
  evaluate: (positions: Float64Array, atoms: Atom[]) => EvaluationResult;

  /**
   * Educational explanation shown after observation.
   * Should reference the actual simulation forces/parameters.
   */
  explanation: string;
}

// --------------- Experiment Definition ---------------

/**
 * A complete guided experiment definition.
 *
 * Each experiment is a sequence of steps that guide the user
 * through a scientific investigation. The steps build on each
 * other, with each step exploring a different aspect of the
 * topic.
 */
export interface Experiment {
  /** Unique identifier */
  id: string;
  /** Short title */
  title: string;
  /** 1-2 sentence description shown in the selection card */
  description: string;
  /** Difficulty level */
  difficulty: ExperimentDifficulty;
  /** Category tag for grouping */
  category: string;
  /** Ordered list of experiment steps */
  steps: ExperimentStep[];
}

// --------------- Experiment Runtime State ---------------

/** Phases within a single experiment step */
export type StepPhase = 'intro' | 'predict' | 'observe' | 'explain';

/** Overall experiment lifecycle phase */
export type ExperimentPhase = 'select' | 'running' | 'complete';

/** Recorded result for a single step */
export interface StepResult {
  /** Step index */
  stepIndex: number;
  /** User's prediction (null if step had no question) */
  prediction: string | number | string[] | null;
  /** Evaluation result from simulation */
  evaluation: EvaluationResult;
}
