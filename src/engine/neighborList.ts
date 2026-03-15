// ==============================================================
// Cell list (linked-cell) neighbor search
// Divides space into cells of size >= cutoff
// Each atom checks its own cell + 26 neighbors -> O(N) for uniform distributions
//
// Supports both open boundaries (bounding-box based) and periodic
// boundary conditions (fixed grid with wrap-around neighbor indexing).
// Reference: Allen & Tildesley, "Computer Simulation of Liquids",
// Oxford University Press, 2017, Ch. 3.5
// ==============================================================

import type { Vector3Tuple } from '../data/types';

/**
 * Cell list for efficient neighbor pair iteration.
 */
export class CellList {
  private cellSize: number;
  private nx: number;
  private ny: number;
  private nz: number;
  private origin: [number, number, number] = [0, 0, 0];
  /** Whether the last build was periodic */
  private periodic: boolean = false;
  /** Box dimensions (only meaningful when periodic) */
  private boxDims: Vector3Tuple = [0, 0, 0];
  /** head[cellIdx] = first atom in cell (-1 if empty) */
  private head: Int32Array;
  /** next[atomIdx] = next atom in same cell (-1 if last) */
  private next: Int32Array;

  constructor(cutoff: number, maxAtoms: number = 10000) {
    this.cellSize = cutoff;
    this.nx = 1;
    this.ny = 1;
    this.nz = 1;
    this.head = new Int32Array(1);
    this.next = new Int32Array(maxAtoms);
  }

  /**
   * Rebuild the cell list from current positions (open boundaries).
   */
  build(positions: Float64Array, nAtoms: number): void {
    this.periodic = false;
    this.boxDims = [0, 0, 0];

    // Find bounding box
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < nAtoms; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    // Add padding
    const pad = this.cellSize;
    minX -= pad;
    minY -= pad;
    minZ -= pad;
    maxX += pad;
    maxY += pad;
    maxZ += pad;

    this.origin = [minX, minY, minZ];
    this.nx = Math.max(1, Math.ceil((maxX - minX) / this.cellSize));
    this.ny = Math.max(1, Math.ceil((maxY - minY) / this.cellSize));
    this.nz = Math.max(1, Math.ceil((maxZ - minZ) / this.cellSize));

    this.populateCells(positions, nAtoms);
  }

  /**
   * Rebuild the cell list for periodic boundary conditions.
   * Uses a fixed grid based on box dimensions instead of a bounding box.
   * Positions must already be wrapped into [0, Lx) x [0, Ly) x [0, Lz).
   *
   * @param positions  flat position array (already wrapped)
   * @param nAtoms     number of atoms
   * @param boxSize    box dimensions [Lx, Ly, Lz] in Angstrom
   */
  buildPeriodic(
    positions: Float64Array,
    nAtoms: number,
    boxSize: Vector3Tuple,
  ): void {
    this.periodic = true;
    this.boxDims = [boxSize[0], boxSize[1], boxSize[2]];

    // Fixed grid from box dimensions — each cell >= cellSize
    // Require at least 3 cells per dimension to avoid self-interaction
    // in the half-shell neighbor search (with < 3 cells, wrapping could
    // cause a cell to be its own "neighbor" via different offsets).
    this.origin = [0, 0, 0];
    this.nx = Math.max(3, Math.floor(boxSize[0] / this.cellSize));
    this.ny = Math.max(3, Math.floor(boxSize[1] / this.cellSize));
    this.nz = Math.max(3, Math.floor(boxSize[2] / this.cellSize));

    this.populateCells(positions, nAtoms);
  }

  /**
   * Common cell population logic shared by build() and buildPeriodic().
   */
  private populateCells(positions: Float64Array, nAtoms: number): void {
    const totalCells = this.nx * this.ny * this.nz;

    // Allocate/resize arrays
    if (this.head.length < totalCells) {
      this.head = new Int32Array(totalCells);
    }
    if (this.next.length < nAtoms) {
      this.next = new Int32Array(nAtoms);
    }

    // Initialize
    this.head.fill(-1, 0, totalCells);
    this.next.fill(-1, 0, nAtoms);

    // Cell size may differ per axis for periodic grids
    const csx = this.periodic ? this.boxDims[0] / this.nx : this.cellSize;
    const csy = this.periodic ? this.boxDims[1] / this.ny : this.cellSize;
    const csz = this.periodic ? this.boxDims[2] / this.nz : this.cellSize;

    // Assign atoms to cells
    for (let i = 0; i < nAtoms; i++) {
      let cx = Math.floor((positions[i * 3] - this.origin[0]) / csx);
      let cy = Math.floor((positions[i * 3 + 1] - this.origin[1]) / csy);
      let cz = Math.floor((positions[i * 3 + 2] - this.origin[2]) / csz);

      // Clamp for open boundaries, wrap for periodic
      if (this.periodic) {
        cx = ((cx % this.nx) + this.nx) % this.nx;
        cy = ((cy % this.ny) + this.ny) % this.ny;
        cz = ((cz % this.nz) + this.nz) % this.nz;
      } else {
        cx = Math.min(this.nx - 1, Math.max(0, cx));
        cy = Math.min(this.ny - 1, Math.max(0, cy));
        cz = Math.min(this.nz - 1, Math.max(0, cz));
      }

      const ci = this.cellIndex(cx, cy, cz);
      this.next[i] = this.head[ci];
      this.head[ci] = i;
    }
  }

  private cellIndex(cx: number, cy: number, cz: number): number {
    return cx + cy * this.nx + cz * this.nx * this.ny;
  }

  /**
   * Iterate over all unique pairs (i < j) within cutoff distance.
   * Calls callback(i, j, r2) for each pair where r2 < cutoff^2.
   *
   * When the cell list was built with buildPeriodic(), neighbor cell
   * indices wrap around using modular arithmetic, and distances use
   * the minimum image convention.
   *
   * @param positions flat position array
   * @param cutoff    cutoff distance in Angstrom
   * @param callback  called for each pair within cutoff
   * @param boxSize   box dimensions for minimum image (only used when periodic)
   */
  forEachPair(
    positions: Float64Array,
    cutoff: number,
    callback: (i: number, j: number, r2: number) => void,
    boxSize?: Vector3Tuple,
  ): void {
    const rc2 = cutoff * cutoff;
    const isPeriodic = this.periodic && boxSize !== undefined;
    const bx = isPeriodic ? boxSize[0] : 0;
    const by = isPeriodic ? boxSize[1] : 0;
    const bz = isPeriodic ? boxSize[2] : 0;

    for (let cz = 0; cz < this.nz; cz++) {
      for (let cy = 0; cy < this.ny; cy++) {
        for (let cx = 0; cx < this.nx; cx++) {
          const ci = this.cellIndex(cx, cy, cz);

          // Check this cell + 13 forward neighbors (half-shell)
          // to avoid double-counting pairs
          for (let dz = 0; dz <= 1; dz++) {
            for (let dy = dz === 0 ? 0 : -1; dy <= 1; dy++) {
              for (let dx = dz === 0 && dy === 0 ? 0 : -1; dx <= 1; dx++) {
                let wnx = cx + dx;
                let wny = cy + dy;
                let wnz = cz + dz;

                if (isPeriodic) {
                  // Wrap around for periodic boundaries
                  wnx = ((wnx % this.nx) + this.nx) % this.nx;
                  wny = ((wny % this.ny) + this.ny) % this.ny;
                  wnz = ((wnz % this.nz) + this.nz) % this.nz;
                } else {
                  // Skip out-of-bounds for open boundaries
                  if (wnx < 0 || wnx >= this.nx) continue;
                  if (wny < 0 || wny >= this.ny) continue;
                  if (wnz < 0 || wnz >= this.nz) continue;
                }

                const cj = this.cellIndex(wnx, wny, wnz);

                if (ci === cj) {
                  // Same cell: iterate upper triangle
                  let ai = this.head[ci];
                  while (ai !== -1) {
                    let aj = this.next[ai];
                    while (aj !== -1) {
                      let dxp = positions[aj * 3] - positions[ai * 3];
                      let dyp = positions[aj * 3 + 1] - positions[ai * 3 + 1];
                      let dzp = positions[aj * 3 + 2] - positions[ai * 3 + 2];
                      if (isPeriodic) {
                        dxp -= bx * Math.round(dxp / bx);
                        dyp -= by * Math.round(dyp / by);
                        dzp -= bz * Math.round(dzp / bz);
                      }
                      const r2 = dxp * dxp + dyp * dyp + dzp * dzp;
                      if (r2 < rc2) {
                        callback(ai, aj, r2);
                      }
                      aj = this.next[aj];
                    }
                    ai = this.next[ai];
                  }
                } else {
                  // Different cells: all pairs
                  let ai = this.head[ci];
                  while (ai !== -1) {
                    let aj = this.head[cj];
                    while (aj !== -1) {
                      let dxp = positions[aj * 3] - positions[ai * 3];
                      let dyp = positions[aj * 3 + 1] - positions[ai * 3 + 1];
                      let dzp = positions[aj * 3 + 2] - positions[ai * 3 + 2];
                      if (isPeriodic) {
                        dxp -= bx * Math.round(dxp / bx);
                        dyp -= by * Math.round(dyp / by);
                        dzp -= bz * Math.round(dzp / bz);
                      }
                      const r2 = dxp * dxp + dyp * dyp + dzp * dzp;
                      if (r2 < rc2) {
                        // Ensure i < j for consistent ordering
                        if (ai < aj) callback(ai, aj, r2);
                        else callback(aj, ai, r2);
                      }
                      aj = this.next[aj];
                    }
                    ai = this.next[ai];
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Simple O(N^2) pair iteration for small systems (< ~50 atoms).
   * Optionally applies minimum image convention for periodic boundaries.
   *
   * @param positions flat position array
   * @param nAtoms    number of atoms
   * @param cutoff    cutoff distance
   * @param callback  called for each pair within cutoff
   * @param boxSize   box dimensions for minimum image (undefined = no PBC)
   */
  static forEachPairBrute(
    positions: Float64Array,
    nAtoms: number,
    cutoff: number,
    callback: (i: number, j: number, r2: number) => void,
    boxSize?: Vector3Tuple,
  ): void {
    const rc2 = cutoff * cutoff;
    const isPeriodic = boxSize !== undefined;
    const bx = isPeriodic ? boxSize[0] : 0;
    const by = isPeriodic ? boxSize[1] : 0;
    const bz = isPeriodic ? boxSize[2] : 0;

    for (let i = 0; i < nAtoms; i++) {
      for (let j = i + 1; j < nAtoms; j++) {
        let dx = positions[j * 3] - positions[i * 3];
        let dy = positions[j * 3 + 1] - positions[i * 3 + 1];
        let dz = positions[j * 3 + 2] - positions[i * 3 + 2];
        if (isPeriodic) {
          dx -= bx * Math.round(dx / bx);
          dy -= by * Math.round(dy / by);
          dz -= bz * Math.round(dz / bz);
        }
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < rc2) {
          callback(i, j, r2);
        }
      }
    }
  }
}
