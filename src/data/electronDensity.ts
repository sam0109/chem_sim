// ==============================================================
// Electron density visualization — Gaussian superposition model
//
// Computes an approximate electron density by summing atom-centered
// Gaussians on a 3D grid. The result is suitable for isosurface
// extraction via marching cubes.
//
// Each atom contributes:
//   rho_i(r) = A_i * exp(-alpha_i * |r - r_i|^2)
//
// where alpha_i = 1 / (2 * sigma_i^2), sigma_i scales with the
// van der Waals radius, and A_i is chosen so the integral over
// all space equals Z_i (atomic number):
//   A_i = Z_i * (alpha_i / pi)^(3/2)
//
// This is a visual approximation — not a quantum-mechanical
// electron density. For true electron density, see issue #26
// (semi-empirical QM).
//
// Reference: The concept of atom-centered Gaussian densities is
// standard in computational chemistry; see e.g. Weigend & Ahlrichs,
// Phys. Chem. Chem. Phys. 7, 3297 (2005) for auxiliary basis sets
// that represent densities as Gaussian expansions.
//
// Van der Waals radii used as a proxy for atomic size:
//   Source: CRC Handbook of Chemistry and Physics (97th Ed.)
//   via the elements table in src/data/elements.ts
// ==============================================================

import type { OrbitalGridResult } from './orbital';
import { getElement } from './elements';

/**
 * Sigma scaling factor: sigma_i = vdwRadius * SIGMA_SCALE.
 *
 * A value of 0.45 gives compact Gaussians that produce a
 * van-der-Waals-like surface at low isovalues and a covalent-like
 * surface at higher isovalues, matching typical electron density
 * visualization conventions.
 *
 * Source: Empirically chosen to reproduce the visual appearance
 * of promolecular electron density plots in standard chemistry
 * software (e.g., Avogadro, GaussView).
 */
const SIGMA_SCALE = 0.45;

/**
 * Default grid resolution (points per dimension).
 * 40^3 = 64k points — fast enough for real-time on a single molecule.
 */
const DEFAULT_GRID_RES = 40;

/**
 * Padding added around the molecular bounding box (in Angstrom).
 * Ensures the Gaussian tails are captured by the grid.
 * Set to 2 * typical vdwRadius to capture > 99% of density.
 */
const GRID_PADDING = 3.5;

/**
 * Input atom data for electron density computation.
 * Uses a minimal interface to avoid depending on the full Atom type
 * (which lives in the store layer).
 */
export interface DensityAtomInput {
  /** Atomic number */
  elementNumber: number;
  /** Position in Angstrom [x, y, z] */
  position: [number, number, number];
}

/**
 * Compute a superposition-of-Gaussians electron density on a 3D grid.
 *
 * @param atoms - array of atoms with element numbers and positions
 * @param gridRes - grid resolution per dimension (default 40)
 * @returns OrbitalGridResult compatible with marchingCubes()
 */
export function computeElectronDensityGrid(
  atoms: ReadonlyArray<DensityAtomInput>,
  gridRes: number = DEFAULT_GRID_RES,
): OrbitalGridResult {
  if (atoms.length === 0) {
    return {
      values: new Float32Array(0),
      dimensions: [0, 0, 0],
      origin: [0, 0, 0],
      cellSize: 0,
    };
  }

  // ---- 1. Compute bounding box of all atoms ----
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const atom of atoms) {
    const [x, y, z] = atom.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  // Add padding
  minX -= GRID_PADDING;
  minY -= GRID_PADDING;
  minZ -= GRID_PADDING;
  maxX += GRID_PADDING;
  maxY += GRID_PADDING;
  maxZ += GRID_PADDING;

  // ---- 2. Compute grid parameters ----
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const rangeZ = maxZ - minZ;
  const maxRange = Math.max(rangeX, rangeY, rangeZ);

  // Use a uniform cell size based on the largest dimension
  const cellSize = maxRange / (gridRes - 1);
  const origin: [number, number, number] = [minX, minY, minZ];

  // Compute actual grid dimensions for each axis
  const nx = Math.max(2, Math.min(gridRes, Math.ceil(rangeX / cellSize) + 1));
  const ny = Math.max(2, Math.min(gridRes, Math.ceil(rangeY / cellSize) + 1));
  const nz = Math.max(2, Math.min(gridRes, Math.ceil(rangeZ / cellSize) + 1));

  // ---- 3. Precompute Gaussian parameters for each atom ----
  const atomParams: Array<{
    cx: number;
    cy: number;
    cz: number;
    alpha: number;
    amplitude: number;
    cutoffSq: number;
  }> = [];

  for (const atom of atoms) {
    const el = getElement(atom.elementNumber);
    if (!el) continue;

    const sigma = el.vdwRadius * SIGMA_SCALE;
    const alpha = 1.0 / (2.0 * sigma * sigma);
    // A = Z * (alpha/pi)^(3/2)
    // This normalization ensures integral of rho_i over all space = Z
    const amplitude = el.number * Math.pow(alpha / Math.PI, 1.5);

    // Cutoff: skip computation when exp(-alpha*r^2) < 1e-6
    // => alpha * r^2 > 13.8 => r^2 > 13.8 / alpha
    const cutoffSq = 13.8 / alpha;

    atomParams.push({
      cx: atom.position[0],
      cy: atom.position[1],
      cz: atom.position[2],
      alpha,
      amplitude,
      cutoffSq,
    });
  }

  // ---- 4. Evaluate density on the grid ----
  // Grid indexing convention: field[iz * ny * nx + iy * nx + ix]
  // This matches the marchingCubes() expectation from marchingCubes.ts
  const totalPoints = nx * ny * nz;
  const values = new Float32Array(totalPoints);

  for (let iz = 0; iz < nz; iz++) {
    const zPos = origin[2] + iz * cellSize;

    for (let iy = 0; iy < ny; iy++) {
      const yPos = origin[1] + iy * cellSize;

      for (let ix = 0; ix < nx; ix++) {
        const xPos = origin[0] + ix * cellSize;

        let density = 0;

        // Sum Gaussian contributions from all atoms
        for (const p of atomParams) {
          const dx = xPos - p.cx;
          const dy = yPos - p.cy;
          const dz = zPos - p.cz;
          const r2 = dx * dx + dy * dy + dz * dz;

          // Skip if beyond cutoff (contribution < 1e-6)
          if (r2 > p.cutoffSq) continue;

          density += p.amplitude * Math.exp(-p.alpha * r2);
        }

        values[iz * ny * nx + iy * nx + ix] = density;
      }
    }
  }

  return {
    values,
    dimensions: [nx, ny, nz],
    origin,
    cellSize,
  };
}
