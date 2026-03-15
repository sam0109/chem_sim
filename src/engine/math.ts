// ==============================================================
// Mathematical utility functions for the simulation engine
// ==============================================================

/**
 * Complementary error function: erfc(x) = 1 - erf(x)
 *
 * Uses the rational approximation from Numerical Recipes §6.2
 * (Press et al., 2007) via the transform t = 1/(1 + 0.5·x).
 * Maximum absolute error: |ε| < 1.2 × 10⁻⁷ for all x.
 *
 * For x < 0, uses the identity erfc(-x) = 2 - erfc(x).
 *
 * Reference: Press et al., "Numerical Recipes" 3rd ed. (2007), §6.2
 */
export function erfc(x: number): number {
  const ax = Math.abs(x);
  const t = 1.0 / (1.0 + 0.5 * ax);

  // Horner-form rational approximation
  // Coefficients from Numerical Recipes §6.2 (Press et al., 2007)
  const tau =
    t *
    Math.exp(
      -ax * ax -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t * (-0.82215223 + t * 0.17087277)))))))),
    );

  // For negative x: erfc(-x) = 2 - erfc(x)
  return x < 0 ? 2.0 - tau : tau;
}

/**
 * Error function: erf(x) = 1 - erfc(x)
 */
export function erf(x: number): number {
  return 1.0 - erfc(x);
}
