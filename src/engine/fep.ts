// ==============================================================
// Free Energy Perturbation (FEP) estimators
//
// Two methods for computing free energy differences ΔG:
//
// 1. Thermodynamic Integration (TI):
//    ΔG = ∫₀¹ ⟨∂V/∂λ⟩_λ dλ
//    Approximated by trapezoidal rule over discrete λ windows.
//    Reference: Kirkwood, J. Chem. Phys. 3, 300 (1935)
//
// 2. Free Energy Perturbation (Zwanzig equation):
//    ΔG = −kT ln⟨exp(−ΔV/kT)⟩
//    Reference: Zwanzig, J. Chem. Phys. 22, 1420 (1954)
//
// Error estimation uses block averaging:
//    Reference: Flyvbjerg & Petersen, J. Chem. Phys. 91, 461 (1989)
// ==============================================================

import type { FEPSample, FEPResult } from '../data/types';

/** Boltzmann constant in eV/K — CODATA 2018 */
const KB = 8.617333262e-5;

/**
 * Compute the mean and standard error of an array of values using
 * block averaging to account for time correlations.
 *
 * Block averaging splits the data into blocks of increasing size,
 * and the standard error plateaus when the block size exceeds the
 * correlation time. We use the largest block size that still gives
 * at least 4 blocks (for a meaningful error estimate).
 *
 * Reference: Flyvbjerg & Petersen, J. Chem. Phys. 91, 461 (1989)
 *
 * @param values Array of sample values
 * @returns [mean, standardError]
 */
export function blockAverage(values: number[]): [number, number] {
  const n = values.length;
  if (n === 0) return [0, 0];
  if (n === 1) return [values[0], 0];

  // Compute overall mean
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
  }
  const mean = sum / n;

  // Find optimal block size: try block sizes from 1 to n/4,
  // report the error from the largest block size with ≥ 4 blocks.
  // Minimum 4 blocks ensures a meaningful variance estimate.
  const MIN_BLOCKS = 4;
  let bestError = 0;

  // Start from block size 1 and increase
  const maxBlockSize = Math.floor(n / MIN_BLOCKS);
  if (maxBlockSize < 1) {
    // Not enough data for block averaging; use naive SEM
    let variance = 0;
    for (let i = 0; i < n; i++) {
      const d = values[i] - mean;
      variance += d * d;
    }
    variance /= n - 1;
    return [mean, Math.sqrt(variance / n)];
  }

  for (let blockSize = 1; blockSize <= maxBlockSize; blockSize++) {
    const nBlocks = Math.floor(n / blockSize);
    if (nBlocks < MIN_BLOCKS) break;

    // Compute block means
    const blockMeans: number[] = [];
    for (let b = 0; b < nBlocks; b++) {
      let blockSum = 0;
      for (let i = b * blockSize; i < (b + 1) * blockSize; i++) {
        blockSum += values[i];
      }
      blockMeans.push(blockSum / blockSize);
    }

    // Variance of block means → SEM
    let blockVariance = 0;
    for (let b = 0; b < nBlocks; b++) {
      const d = blockMeans[b] - mean;
      blockVariance += d * d;
    }
    blockVariance /= nBlocks - 1;
    const sem = Math.sqrt(blockVariance / nBlocks);

    bestError = sem; // keeps updating with largest valid block
  }

  return [mean, bestError];
}

/**
 * Compute per-window mean ⟨∂V/∂λ⟩ and standard errors from FEP samples.
 * Shared between computeTI and computeZwanzig.
 *
 * @param samples All FEP samples
 * @param lambdaSchedule Ordered λ values
 * @returns [means, errors] arrays of length lambdaSchedule.length
 */
function computeWindowMeans(
  samples: FEPSample[],
  lambdaSchedule: number[],
): [number[], number[]] {
  const means: number[] = [];
  const errors: number[] = [];

  for (let w = 0; w < lambdaSchedule.length; w++) {
    const lambda = lambdaSchedule[w];
    const windowSamples = samples
      .filter((s) => Math.abs(s.lambda - lambda) < 1e-10)
      .map((s) => s.dVdLambda);

    if (windowSamples.length === 0) {
      means.push(0);
      errors.push(0);
    } else {
      const [mean, error] = blockAverage(windowSamples);
      means.push(mean);
      errors.push(error);
    }
  }

  return [means, errors];
}

/**
 * Compute the free energy difference using Thermodynamic Integration (TI).
 *
 * ΔG = ∫₀¹ ⟨∂V/∂λ⟩_λ dλ ≈ Σᵢ ½(⟨∂V/∂λ⟩ᵢ + ⟨∂V/∂λ⟩ᵢ₊₁) · (λᵢ₊₁ − λᵢ)
 *
 * Reference: Kirkwood, J. Chem. Phys. 3, 300 (1935)
 *
 * @param samples All FEP samples collected across λ windows
 * @param lambdaSchedule Ordered λ values used in the calculation
 * @returns FEPResult with method 'TI'
 */
export function computeTI(
  samples: FEPSample[],
  lambdaSchedule: number[],
): FEPResult {
  const nWindows = lambdaSchedule.length;

  // Group samples by λ window and compute mean ⟨∂V/∂λ⟩ at each λ
  const [dVdLambdaMeans, dVdLambdaErrors] = computeWindowMeans(
    samples,
    lambdaSchedule,
  );

  // Trapezoidal integration: ΔG = Σ ½(f(λᵢ) + f(λᵢ₊₁)) · Δλ
  let deltaG = 0;
  let errorSquaredSum = 0;

  for (let w = 0; w < nWindows - 1; w++) {
    const dLambda = lambdaSchedule[w + 1] - lambdaSchedule[w];
    deltaG += 0.5 * (dVdLambdaMeans[w] + dVdLambdaMeans[w + 1]) * dLambda;

    // Error propagation: σ² ≈ Σ (Δλ/2)² · (σᵢ² + σᵢ₊₁²)
    const halfDL = 0.5 * dLambda;
    errorSquaredSum +=
      halfDL *
      halfDL *
      (dVdLambdaErrors[w] * dVdLambdaErrors[w] +
        dVdLambdaErrors[w + 1] * dVdLambdaErrors[w + 1]);
  }

  return {
    deltaG,
    error: Math.sqrt(errorSquaredSum),
    method: 'TI',
    dVdLambdaMeans,
    dVdLambdaErrors,
    lambdaSchedule: [...lambdaSchedule],
  };
}

/**
 * Compute the free energy difference using the Zwanzig equation (FEP).
 *
 * ΔG = −kT ln⟨exp(−ΔV/kT)⟩
 *
 * Uses forward perturbation from each λ window to the next.
 * Total ΔG is the sum of window-to-window contributions:
 *   ΔG_total = Σᵢ ΔG(λᵢ → λᵢ₊₁)
 *
 * Reference: Zwanzig, J. Chem. Phys. 22, 1420 (1954)
 *
 * @param samples All FEP samples collected across λ windows
 * @param lambdaSchedule Ordered λ values used in the calculation
 * @param temperature Temperature in K for kT computation
 * @returns FEPResult with method 'Zwanzig'
 */
export function computeZwanzig(
  samples: FEPSample[],
  lambdaSchedule: number[],
  temperature: number,
): FEPResult {
  const kT = KB * temperature;
  const nWindows = lambdaSchedule.length;

  // Compute ⟨∂V/∂λ⟩ for the TI curve display
  const [dVdLambdaMeans, dVdLambdaErrors] = computeWindowMeans(
    samples,
    lambdaSchedule,
  );

  // Compute ΔG window-by-window using the exponential average of ΔV
  // For each window at λᵢ, we use the deltaV (= V_B − V_A) samples.
  // The Zwanzig equation for adjacent windows is:
  //   ΔG(λᵢ→λᵢ₊₁) ≈ −kT·ln⟨exp(−Δλ·(∂V/∂λ)/kT)⟩_λᵢ
  // where Δλ = λᵢ₊₁ − λᵢ and ∂V/∂λ ≈ deltaV
  let deltaG = 0;
  let errorSquaredSum = 0;

  for (let w = 0; w < nWindows - 1; w++) {
    const lambda = lambdaSchedule[w];
    const dLambda = lambdaSchedule[w + 1] - lambdaSchedule[w];
    const windowDeltaV = samples
      .filter((s) => Math.abs(s.lambda - lambda) < 1e-10)
      .map((s) => s.deltaV * dLambda);

    if (windowDeltaV.length === 0) continue;

    // Compute ⟨exp(−ΔV/kT)⟩ with numerical stability:
    // Shift by the mean to prevent overflow/underflow
    const [meanDV] = blockAverage(windowDeltaV);
    const beta = 1.0 / kT;

    let expSum = 0;
    for (let i = 0; i < windowDeltaV.length; i++) {
      expSum += Math.exp(-beta * (windowDeltaV[i] - meanDV));
    }
    const expAvg = expSum / windowDeltaV.length;

    // ΔG for this window = −kT·ln(expAvg) + meanDV
    // (the meanDV comes from the shift trick)
    const windowDG = -kT * Math.log(expAvg) + meanDV;
    deltaG += windowDG;

    // Error estimate: use block averaging on the exponential values
    const expValues = windowDeltaV.map((dv) => Math.exp(-beta * (dv - meanDV)));
    const [, expError] = blockAverage(expValues);
    // Propagate error: σ(ΔG) ≈ kT · σ(⟨exp⟩) / ⟨exp⟩
    if (expAvg > 1e-30) {
      const windowError = (kT * expError) / expAvg;
      errorSquaredSum += windowError * windowError;
    }
  }

  return {
    deltaG,
    error: Math.sqrt(errorSquaredSum),
    method: 'Zwanzig',
    dVdLambdaMeans,
    dVdLambdaErrors,
    lambdaSchedule: [...lambdaSchedule],
  };
}
