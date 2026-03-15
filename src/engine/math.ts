// ==============================================================
// Mathematical utility functions for the simulation engine
// ==============================================================

/**
 * Complementary error function: erfc(x) = 1 - erf(x)
 *
 * Uses the rational approximation from Abramowitz & Stegun,
 * Handbook of Mathematical Functions, formula 7.1.26 (1964).
 * Maximum absolute error: |ε| < 1.5 × 10⁻⁷
 *
 * For x < 0, uses the identity erfc(-x) = 2 - erfc(x).
 */
export function erfc(x: number): number {
  // Handle negative arguments via reflection
  const sign = x < 0 ? -1 : 1;
  const t_arg = Math.abs(x);

  // Abramowitz & Stegun 7.1.26 rational approximation
  // erfc(x) ≈ t * exp(-x² + P(t)) where t = 1/(1 + 0.3275911*x)
  // Coefficients from A&S Table 7.1
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const t = 1.0 / (1.0 + p * t_arg);
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  const result = poly * Math.exp(-t_arg * t_arg);

  // For negative x: erfc(-x) = 2 - erfc(x)
  return sign < 0 ? 2.0 - result : result;
}

/**
 * Error function: erf(x) = 1 - erfc(x)
 */
export function erf(x: number): number {
  return 1.0 - erfc(x);
}
