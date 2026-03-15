import { describe, it, expect } from 'vitest';
import { CellList } from '../neighborList.ts';

describe('CellList', () => {
  it('finds all pairs within cutoff using brute force', () => {
    // 3 atoms in a line
    const positions = new Float64Array([
      0,
      0,
      0, // atom 0
      1.5,
      0,
      0, // atom 1 (1.5 Å from 0)
      4.0,
      0,
      0, // atom 2 (4.0 Å from 0, 2.5 from 1)
    ]);
    const cutoff = 3.0;

    const pairs: Array<[number, number]> = [];
    CellList.forEachPairBrute(positions, 3, cutoff, (i, j) => {
      pairs.push([i, j]);
    });

    // Should find (0,1) at 1.5 Å and (1,2) at 2.5 Å
    // Should NOT find (0,2) at 4.0 Å
    expect(pairs).toHaveLength(2);
    expect(pairs).toContainEqual([0, 1]);
    expect(pairs).toContainEqual([1, 2]);
  });

  it('brute force finds no pairs beyond cutoff', () => {
    const positions = new Float64Array([0, 0, 0, 10, 0, 0]);
    const cutoff = 5.0;

    const pairs: Array<[number, number]> = [];
    CellList.forEachPairBrute(positions, 2, cutoff, (i, j) => {
      pairs.push([i, j]);
    });

    expect(pairs).toHaveLength(0);
  });

  it('brute force always reports i < j', () => {
    const positions = new Float64Array([0, 0, 0, 1, 0, 0, 2, 0, 0]);
    const cutoff = 5.0;

    CellList.forEachPairBrute(positions, 3, cutoff, (i, j) => {
      expect(i).toBeLessThan(j);
    });
  });

  it('cell list finds same pairs as brute force', () => {
    // 4 atoms in a cluster
    const positions = new Float64Array([
      0, 0, 0, 1.0, 0.5, 0, -0.5, 1.5, 0, 2.0, 2.0, 0,
    ]);
    const cutoff = 3.0;

    // Brute force pairs
    const brutePairs = new Set<string>();
    CellList.forEachPairBrute(positions, 4, cutoff, (i, j) => {
      brutePairs.add(`${Math.min(i, j)}-${Math.max(i, j)}`);
    });

    // Cell list pairs
    const cellList = new CellList(cutoff);
    cellList.build(positions, 4);
    const cellPairs = new Set<string>();
    cellList.forEachPair(positions, cutoff, (i, j) => {
      cellPairs.add(`${Math.min(i, j)}-${Math.max(i, j)}`);
    });

    // Should find the same pairs
    expect(cellPairs.size).toBe(brutePairs.size);
    for (const pair of brutePairs) {
      expect(cellPairs.has(pair)).toBe(true);
    }
  });

  it('cell list handles single atom', () => {
    const positions = new Float64Array([1, 2, 3]);
    const cellList = new CellList(5.0);
    cellList.build(positions, 1);

    const pairs: Array<[number, number]> = [];
    cellList.forEachPair(positions, 5.0, (i, j) => {
      pairs.push([i, j]);
    });

    expect(pairs).toHaveLength(0);
  });

  it('cell list handles atoms in 3D', () => {
    const positions = new Float64Array([
      0,
      0,
      0,
      1,
      1,
      1, // distance = sqrt(3) ≈ 1.73
      3,
      3,
      3, // distance from origin = sqrt(27) ≈ 5.2
    ]);
    const cutoff = 2.0;

    const cellList = new CellList(cutoff);
    cellList.build(positions, 3);

    const pairs: Array<[number, number]> = [];
    cellList.forEachPair(positions, cutoff, (i, j) => {
      pairs.push([Math.min(i, j), Math.max(i, j)]);
    });

    // Only (0,1) should be within cutoff
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual([0, 1]);
  });

  it('provides correct r2 values', () => {
    const positions = new Float64Array([0, 0, 0, 3, 4, 0]); // distance = 5
    const cutoff = 10.0;

    CellList.forEachPairBrute(positions, 2, cutoff, (_i, _j, r2) => {
      expect(r2).toBeCloseTo(25, 10); // 3² + 4² = 25
    });
  });
});
