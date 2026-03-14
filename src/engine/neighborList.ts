// ==============================================================
// Cell list (linked-cell) neighbor search
// Divides space into cells of size ≥ cutoff
// Each atom checks its own cell + 26 neighbors → O(N) for uniform distributions
// ==============================================================

/**
 * Cell list for efficient neighbor pair iteration.
 */
export class CellList {
  private cellSize: number;
  private nx: number;
  private ny: number;
  private nz: number;
  private origin: [number, number, number] = [0, 0, 0];
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
   * Rebuild the cell list from current positions.
   */
  build(positions: Float64Array, nAtoms: number): void {
    // Find bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

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
    minX -= pad; minY -= pad; minZ -= pad;
    maxX += pad; maxY += pad; maxZ += pad;

    this.origin = [minX, minY, minZ];
    this.nx = Math.max(1, Math.ceil((maxX - minX) / this.cellSize));
    this.ny = Math.max(1, Math.ceil((maxY - minY) / this.cellSize));
    this.nz = Math.max(1, Math.ceil((maxZ - minZ) / this.cellSize));

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

    // Assign atoms to cells
    for (let i = 0; i < nAtoms; i++) {
      const cx = Math.floor((positions[i * 3] - this.origin[0]) / this.cellSize);
      const cy = Math.floor((positions[i * 3 + 1] - this.origin[1]) / this.cellSize);
      const cz = Math.floor((positions[i * 3 + 2] - this.origin[2]) / this.cellSize);
      const ci = this.cellIndex(
        Math.min(this.nx - 1, Math.max(0, cx)),
        Math.min(this.ny - 1, Math.max(0, cy)),
        Math.min(this.nz - 1, Math.max(0, cz))
      );
      this.next[i] = this.head[ci];
      this.head[ci] = i;
    }
  }

  private cellIndex(cx: number, cy: number, cz: number): number {
    return cx + cy * this.nx + cz * this.nx * this.ny;
  }

  /**
   * Iterate over all unique pairs (i < j) within cutoff distance.
   * Calls callback(i, j, r2) for each pair where r2 < cutoff².
   */
  forEachPair(
    positions: Float64Array,
    cutoff: number,
    callback: (i: number, j: number, r2: number) => void,
  ): void {
    const rc2 = cutoff * cutoff;

    for (let cz = 0; cz < this.nz; cz++) {
      for (let cy = 0; cy < this.ny; cy++) {
        for (let cx = 0; cx < this.nx; cx++) {
          const ci = this.cellIndex(cx, cy, cz);

          // Check this cell + 13 forward neighbors (half-shell)
          // to avoid double-counting pairs
          for (let dz = 0; dz <= 1; dz++) {
            for (let dy = (dz === 0 ? 0 : -1); dy <= 1; dy++) {
              for (let dx = (dz === 0 && dy === 0 ? 0 : -1); dx <= 1; dx++) {
                const nx = cx + dx;
                const ny2 = cy + dy;
                const nz2 = cz + dz;

                if (nx < 0 || nx >= this.nx) continue;
                if (ny2 < 0 || ny2 >= this.ny) continue;
                if (nz2 < 0 || nz2 >= this.nz) continue;

                const cj = this.cellIndex(nx, ny2, nz2);

                if (ci === cj) {
                  // Same cell: iterate upper triangle
                  let ai = this.head[ci];
                  while (ai !== -1) {
                    let aj = this.next[ai];
                    while (aj !== -1) {
                      const dxp = positions[aj * 3] - positions[ai * 3];
                      const dyp = positions[aj * 3 + 1] - positions[ai * 3 + 1];
                      const dzp = positions[aj * 3 + 2] - positions[ai * 3 + 2];
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
                      const dxp = positions[aj * 3] - positions[ai * 3];
                      const dyp = positions[aj * 3 + 1] - positions[ai * 3 + 1];
                      const dzp = positions[aj * 3 + 2] - positions[ai * 3 + 2];
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
   * Simple O(N²) pair iteration for small systems (< ~50 atoms).
   */
  static forEachPairBrute(
    positions: Float64Array,
    nAtoms: number,
    cutoff: number,
    callback: (i: number, j: number, r2: number) => void,
  ): void {
    const rc2 = cutoff * cutoff;
    for (let i = 0; i < nAtoms; i++) {
      for (let j = i + 1; j < nAtoms; j++) {
        const dx = positions[j * 3] - positions[i * 3];
        const dy = positions[j * 3 + 1] - positions[i * 3 + 1];
        const dz = positions[j * 3 + 2] - positions[i * 3 + 2];
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < rc2) {
          callback(i, j, r2);
        }
      }
    }
  }
}
