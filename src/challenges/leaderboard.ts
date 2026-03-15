// ==============================================================
// Challenge store — leaderboard persistence + localStorage
// ==============================================================

import type { LeaderboardEntry } from './types';

const STORAGE_KEY = 'chemsim-challenge-leaderboard';

/**
 * Load the leaderboard from localStorage.
 * Returns an empty array if nothing is stored or on parse error.
 */
export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic shape validation
    return parsed.filter(
      (e): e is LeaderboardEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as LeaderboardEntry).challengeId === 'string' &&
        typeof (e as LeaderboardEntry).score === 'number' &&
        typeof (e as LeaderboardEntry).timestamp === 'number',
    );
  } catch {
    return [];
  }
}

/**
 * Save a new result to the leaderboard in localStorage.
 * Appends the entry and keeps only the most recent 100 entries.
 */
export function saveResult(entry: LeaderboardEntry): void {
  const entries = loadLeaderboard();
  entries.push(entry);
  // Keep only last 100 entries to avoid unbounded growth
  const trimmed = entries.slice(-100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

/**
 * Get the top scores for a specific challenge, sorted descending.
 */
export function getTopScores(
  challengeId: string,
  limit: number = 5,
): LeaderboardEntry[] {
  return loadLeaderboard()
    .filter((e) => e.challengeId === challengeId)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get the best score ever achieved for a challenge, or null if never attempted.
 */
export function getBestScore(challengeId: string): number | null {
  const top = getTopScores(challengeId, 1);
  return top.length > 0 ? top[0].score : null;
}
