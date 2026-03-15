// ==============================================================
// Zustand store for challenge mode state
//
// Manages the challenge lifecycle: select → predict → simulate
// → score. Persists results to localStorage via the leaderboard
// module.
// ==============================================================

import { create } from 'zustand';
import type {
  Challenge,
  ChallengePhase,
  ChallengeResult,
  EvaluationResult,
  UserPrediction,
} from '../challenges/types';
import { challenges } from '../challenges/challenges';
import { saveResult } from '../challenges/leaderboard';

interface ChallengeStore {
  // ---- Available challenges ----
  challenges: Challenge[];

  // ---- Active challenge state ----
  activeChallenge: Challenge | null;
  phase: ChallengePhase;
  userPrediction: UserPrediction | null;
  result: ChallengeResult | null;
  /** Status message during simulation phase */
  simulationStatus: string;

  // ---- Actions ----
  /** Select a challenge and enter the predict phase */
  selectChallenge: (challengeId: string) => void;
  /** Submit the user's prediction and enter the simulate phase */
  submitPrediction: (prediction: UserPrediction) => void;
  /** Called when simulation evaluation is complete */
  completeEvaluation: (evaluation: EvaluationResult) => void;
  /** Update simulation status message */
  setSimulationStatus: (status: string) => void;
  /** Reset back to the select phase */
  resetChallenge: () => void;
}

/**
 * Score a user's prediction against the evaluation result.
 * Returns a score from 0 to 100.
 */
function scorePrediction(
  prediction: UserPrediction,
  evaluation: EvaluationResult,
  question: Challenge['question'],
): { correct: boolean; score: number } {
  if (question.type === 'multiple-choice') {
    const correct = prediction === evaluation.correctAnswer;
    return { correct, score: correct ? 100 : 0 };
  }

  if (question.type === 'numeric-estimate') {
    const predicted = Number(prediction);
    const actual = Number(evaluation.correctAnswer);
    if (isNaN(predicted) || isNaN(actual)) {
      return { correct: false, score: 0 };
    }
    // Score based on how close the estimate is
    // Within 5% = 100, within 10% = 75, within 20% = 50, within 30% = 25, else 0
    const error = Math.abs(predicted - actual);
    const relError = actual !== 0 ? error / Math.abs(actual) : error;
    if (relError <= 0.05) return { correct: true, score: 100 };
    if (relError <= 0.1) return { correct: true, score: 75 };
    if (relError <= 0.2) return { correct: false, score: 50 };
    if (relError <= 0.3) return { correct: false, score: 25 };
    return { correct: false, score: 0 };
  }

  if (question.type === 'ordering') {
    const predicted = prediction as string[];
    const correct = evaluation.correctAnswer as string[];
    if (predicted.length !== correct.length) {
      return { correct: false, score: 0 };
    }
    // Check if the ordering matches exactly
    const isExact = predicted.every((key, i) => key === correct[i]);
    if (isExact) return { correct: true, score: 100 };

    // Partial credit: count how many items are in the correct position
    const correctPositions = predicted.filter(
      (key, i) => key === correct[i],
    ).length;
    const partialScore = Math.round((correctPositions / correct.length) * 100);
    return { correct: false, score: partialScore };
  }

  return { correct: false, score: 0 };
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  challenges,
  activeChallenge: null,
  phase: 'select',
  userPrediction: null,
  result: null,
  simulationStatus: '',

  selectChallenge(challengeId: string) {
    const challenge = challenges.find((c) => c.id === challengeId);
    if (!challenge) return;
    set({
      activeChallenge: challenge,
      phase: 'predict',
      userPrediction: null,
      result: null,
      simulationStatus: '',
    });
  },

  submitPrediction(prediction: UserPrediction) {
    set({
      userPrediction: prediction,
      phase: 'simulate',
      simulationStatus: 'Setting up simulation...',
    });
  },

  completeEvaluation(evaluation: EvaluationResult) {
    const { activeChallenge, userPrediction } = get();
    if (!activeChallenge || userPrediction === null) return;

    const { correct, score } = scorePrediction(
      userPrediction,
      evaluation,
      activeChallenge.question,
    );

    const result: ChallengeResult = {
      challengeId: activeChallenge.id,
      userPrediction,
      evaluation,
      correct,
      score,
      timestamp: Date.now(),
    };

    // Save to leaderboard
    saveResult({
      challengeId: activeChallenge.id,
      score,
      timestamp: Date.now(),
    });

    set({ result, phase: 'score' });
  },

  setSimulationStatus(status: string) {
    set({ simulationStatus: status });
  },

  resetChallenge() {
    set({
      activeChallenge: null,
      phase: 'select',
      userPrediction: null,
      result: null,
      simulationStatus: '',
    });
  },
}));
