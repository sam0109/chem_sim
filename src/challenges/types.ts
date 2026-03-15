// ==============================================================
// Challenge mode types
//
// Defines the data model for the "predict the outcome" challenge
// system. Challenges present chemistry questions that are answered
// by running the actual simulation, not from lookup tables.
// ==============================================================

import type { Atom, SimulationConfig } from '../data/types';

// --------------- Challenge Definition ---------------

/** Difficulty rating for a challenge */
export type ChallengeDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** The kind of question the user must answer */
export type QuestionType = 'multiple-choice' | 'numeric-estimate' | 'ordering';

/** A single option in a multiple-choice question */
export interface ChoiceOption {
  /** Unique key for this option */
  key: string;
  /** Display label */
  label: string;
}

/** Multiple-choice question */
export interface MultipleChoiceQuestion {
  type: 'multiple-choice';
  /** The question text shown to the user */
  prompt: string;
  /** Available choices */
  options: ChoiceOption[];
}

/** Numeric estimate question (user guesses a number) */
export interface NumericEstimateQuestion {
  type: 'numeric-estimate';
  /** The question text */
  prompt: string;
  /** Unit label for the input (e.g., "°", "Å", "K") */
  unit: string;
  /** Reasonable min/max range for the input slider/field */
  range: [number, number];
}

/** Ordering question (user arranges items) */
export interface OrderingQuestion {
  type: 'ordering';
  /** The question text */
  prompt: string;
  /** Items to be ordered (user arranges these) */
  items: ChoiceOption[];
  /** What property is being ordered (e.g., "bond angle, smallest to largest") */
  orderingCriterion: string;
}

export type ChallengeQuestion =
  | MultipleChoiceQuestion
  | NumericEstimateQuestion
  | OrderingQuestion;

/**
 * Setup function that returns the atoms for a challenge scenario.
 * May also return custom simulation config overrides.
 */
export interface ChallengeSetup {
  /** Factory function returning atoms for the scenario */
  atoms: () => Atom[];
  /** Optional config overrides (e.g., temperature, thermostat) */
  configOverrides?: Partial<SimulationConfig>;
  /** Whether to minimize before evaluating (default true) */
  minimizeFirst?: boolean;
  /** Number of simulation steps to run after minimize (0 = evaluate immediately) */
  stepsAfterMinimize?: number;
}

/**
 * Result of evaluating a challenge against simulation state.
 * The evaluator is a function provided by each challenge definition.
 */
export interface EvaluationResult {
  /** The correct answer key (for multiple-choice), value (for numeric), or ordered keys (for ordering) */
  correctAnswer: string | number | string[];
  /** The actual measured value(s) from the simulation, for display */
  measuredValues: Record<string, number>;
  /** Human-readable description of what was measured */
  measurementDescription: string;
}

/**
 * A complete challenge definition.
 *
 * Each challenge is self-contained: it knows how to set up the
 * simulation, what to ask the user, how to evaluate the result,
 * and how to explain the answer.
 */
export interface Challenge {
  /** Unique identifier */
  id: string;
  /** Short title */
  title: string;
  /** 1-2 sentence description of the challenge */
  description: string;
  /** Difficulty level */
  difficulty: ChallengeDifficulty;
  /** Category tag for grouping */
  category: string;
  /** Setup: what molecules to load and how to configure the simulation */
  setup: ChallengeSetup;
  /** The question the user must answer */
  question: ChallengeQuestion;
  /**
   * Evaluate the simulation result.
   * Receives the current atom positions (flat Float64Array) and bond list.
   * Returns the correct answer and measured values.
   */
  evaluate: (positions: Float64Array, atoms: Atom[]) => EvaluationResult;
  /** Educational explanation shown after scoring */
  explanation: string;
}

// --------------- Challenge State ---------------

/** Phases of a challenge attempt */
export type ChallengePhase = 'select' | 'predict' | 'simulate' | 'score';

/** The user's prediction (varies by question type) */
export type UserPrediction = string | number | string[];

/** Result of a completed challenge attempt */
export interface ChallengeResult {
  /** Challenge ID */
  challengeId: string;
  /** What the user predicted */
  userPrediction: UserPrediction;
  /** Evaluation result from the simulation */
  evaluation: EvaluationResult;
  /** Whether the prediction was correct */
  correct: boolean;
  /** Score (0-100) */
  score: number;
  /** When the attempt was completed */
  timestamp: number;
}

// --------------- Leaderboard ---------------

/** A single leaderboard entry, persisted to localStorage */
export interface LeaderboardEntry {
  /** Challenge ID */
  challengeId: string;
  /** Score (0-100) */
  score: number;
  /** When achieved */
  timestamp: number;
}
