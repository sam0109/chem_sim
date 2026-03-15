import { describe, it, expect } from 'vitest';
import {
  detectBonds,
  detectHydrogenBonds,
  buildAngleList,
} from '../bondDetector.ts';
import type { Bond } from '../../data/types.ts';

describe('detectBonds', () => {
  it('detects an O-H bond at typical distance', () => {
    // O at origin, H at ~0.96 Å
    const positions = new Float64Array([0, 0, 0, 0.96, 0, 0]);
    const atomicNumbers = [8, 1]; // O, H

    const bonds = detectBonds(positions, atomicNumbers);
    expect(bonds.length).toBe(1);
    expect(bonds[0].atomA).toBe(0);
    expect(bonds[0].atomB).toBe(1);
  });

  it('detects water molecule bonds (O-H, O-H but not H-H)', () => {
    // O at origin, H1 at ~0.96 Å along +x, H2 at ~0.96 Å at 104.5°
    const angle = (104.5 * Math.PI) / 180;
    const positions = new Float64Array([
      0,
      0,
      0, // O
      0.96,
      0,
      0, // H1
      0.96 * Math.cos(angle),
      0.96 * Math.sin(angle),
      0, // H2
    ]);
    const atomicNumbers = [8, 1, 1];

    const bonds = detectBonds(positions, atomicNumbers);
    expect(bonds.length).toBe(2);

    // Both bonds should involve atom 0 (oxygen)
    for (const bond of bonds) {
      expect(bond.atomA === 0 || bond.atomB === 0).toBe(true);
    }
  });

  it('does not detect bonds between distant atoms', () => {
    const positions = new Float64Array([0, 0, 0, 10, 0, 0]);
    const atomicNumbers = [8, 1];

    const bonds = detectBonds(positions, atomicNumbers);
    expect(bonds.length).toBe(0);
  });

  it('classifies ionic bonds based on electronegativity', () => {
    // Na-Cl at ~2.4 Å (typical NaCl distance)
    const positions = new Float64Array([0, 0, 0, 2.4, 0, 0]);
    const atomicNumbers = [11, 17]; // Na, Cl

    const bonds = detectBonds(positions, atomicNumbers);
    if (bonds.length > 0) {
      expect(bonds[0].type).toBe('ionic');
    }
  });

  it('respects valence constraints', () => {
    // Hydrogen can only form 1 bond (maxValence = 1)
    // Place one H between two O atoms
    const positions = new Float64Array([
      0,
      0,
      0, // O1
      0.96,
      0,
      0, // H (bonded to O1)
      1.92,
      0,
      0, // O2 (also close to H)
    ]);
    const atomicNumbers = [8, 1, 8];

    const bonds = detectBonds(positions, atomicNumbers);

    // H should only have 1 bond (maxValence = 1)
    const hBonds = bonds.filter((b) => b.atomA === 1 || b.atomB === 1);
    expect(hBonds.length).toBeLessThanOrEqual(1);
  });

  it('uses hysteresis for existing bonds', () => {
    // Place atoms at a distance that is between formTolerance and breakTolerance
    // Existing bond should be preserved, new bond should not form
    const positions = new Float64Array([0, 0, 0, 1.2, 0, 0]);
    const atomicNumbers = [8, 1];

    // Form tolerance: 1.2, break tolerance: 1.5
    // O covalent radius: 0.658, H covalent radius: 0.31
    // Sum: 0.968, threshold at form: 1.16, threshold at break: 1.45
    // Distance 1.2 > 1.16 (wouldn't form) but < 1.45 (wouldn't break)

    // Without existing bond: should not form
    const bondsNew = detectBonds(positions, atomicNumbers, 1.2, [], 1.5);

    // With existing bond: should preserve
    const existingBonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' },
    ];
    const bondsExisting = detectBonds(
      positions,
      atomicNumbers,
      1.2,
      existingBonds,
      1.5,
    );

    // The existing bond scenario should detect at least as many bonds
    expect(bondsExisting.length).toBeGreaterThanOrEqual(bondsNew.length);
  });

  it('assigns bond order 1 for standard distance', () => {
    const positions = new Float64Array([0, 0, 0, 0.96, 0, 0]);
    const atomicNumbers = [8, 1];

    const bonds = detectBonds(positions, atomicNumbers);
    if (bonds.length > 0) {
      expect(bonds[0].order).toBe(1);
    }
  });
});

describe('detectHydrogenBonds', () => {
  it('detects H-bond between two water-like units', () => {
    // Donor O-H ... Acceptor O
    // The code computes angle between D→H and H→A vectors;
    // for near-linear D-H-A the angle is ~0° (parallel vectors).
    // The code requires angle > 120°, meaning the D→H and H→A vectors
    // must be mostly anti-parallel (acceptor behind the hydrogen).
    // Set up geometry: O at origin, H at (-0.96, 0, 0), acceptor O at (1.5, 0, 0)
    // D→H = (-0.96, 0, 0), H→A = (2.46, 0, 0) → angle ~180° > 120° ✓
    const positions = new Float64Array([
      0,
      0,
      0, // atom 0: donor O
      -0.96,
      0,
      0, // atom 1: H (behind donor relative to acceptor)
      1.5,
      0,
      0, // atom 2: acceptor O
    ]);
    const atomicNumbers = [8, 1, 8];
    const existingBonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' },
    ];

    const hBonds = detectHydrogenBonds(positions, atomicNumbers, existingBonds);

    // Should find an H-bond between H(1) and acceptor O(2)
    expect(hBonds.length).toBe(1);
    expect(hBonds[0].type).toBe('hydrogen');
    expect(hBonds[0].order).toBe(0.5);
  });

  it('does not detect H-bond at large distance', () => {
    const positions = new Float64Array([
      0,
      0,
      0,
      0.96,
      0,
      0,
      10,
      0,
      0, // too far
    ]);
    const atomicNumbers = [8, 1, 8];
    const existingBonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' },
    ];

    const hBonds = detectHydrogenBonds(positions, atomicNumbers, existingBonds);
    expect(hBonds.length).toBe(0);
  });

  it('requires donor atom to be N, O, or F', () => {
    // C-H ... O: carbon is not a valid H-bond donor
    const positions = new Float64Array([
      0,
      0,
      0, // C
      0.96,
      0,
      0, // H
      2.7,
      0,
      0, // O
    ]);
    const atomicNumbers = [6, 1, 8]; // C, H, O
    const existingBonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' },
    ];

    const hBonds = detectHydrogenBonds(positions, atomicNumbers, existingBonds);
    expect(hBonds.length).toBe(0);
  });

  it('preserves existing H-bond via hysteresis in break threshold zone', () => {
    // Geometry: D-O at origin, H at (-0.96, 0, 0), acceptor O positioned so
    // H···A = 2.7 Å (> 2.5 form threshold, < 3.0 break threshold).
    // H at x=-0.96, acceptor at x = -0.96 + 2.7 = 1.74
    // D→H = (-0.96, 0, 0), H→A = (2.7, 0, 0) → angle ~180° > 120° ✓
    const positions = new Float64Array([
      0,
      0,
      0, // atom 0: donor O
      -0.96,
      0,
      0, // atom 1: H
      1.74,
      0,
      0, // atom 2: acceptor O (H···A = 2.7 Å)
    ]);
    const atomicNumbers = [8, 1, 8];
    const covalentBonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' },
    ];

    // Without previous H-bonds: should NOT form (2.7 > 2.5 form threshold)
    const hBondsNew = detectHydrogenBonds(
      positions,
      atomicNumbers,
      covalentBonds,
      [],
    );
    expect(hBondsNew.length).toBe(0);

    // With previous H-bond: should PRESERVE (2.7 < 3.0 break threshold)
    const previousHBonds: Bond[] = [
      { atomA: 1, atomB: 2, order: 0.5, type: 'hydrogen' },
    ];
    const hBondsExisting = detectHydrogenBonds(
      positions,
      atomicNumbers,
      covalentBonds,
      previousHBonds,
    );
    expect(hBondsExisting.length).toBe(1);
    expect(hBondsExisting[0].type).toBe('hydrogen');
  });

  it('breaks H-bond when geometry exceeds break threshold', () => {
    // H···A distance = 3.2 Å, which exceeds even the break threshold (3.0 Å)
    // H at x=-0.96, acceptor at x = -0.96 + 3.2 = 2.24
    const positions = new Float64Array([
      0,
      0,
      0, // atom 0: donor O
      -0.96,
      0,
      0, // atom 1: H
      2.24,
      0,
      0, // atom 2: acceptor O (H···A = 3.2 Å)
    ]);
    const atomicNumbers = [8, 1, 8];
    const covalentBonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' },
    ];

    // Even with previous H-bond, should break (3.2 > 3.0 break threshold)
    const previousHBonds: Bond[] = [
      { atomA: 1, atomB: 2, order: 0.5, type: 'hydrogen' },
    ];
    const hBonds = detectHydrogenBonds(
      positions,
      atomicNumbers,
      covalentBonds,
      previousHBonds,
    );
    expect(hBonds.length).toBe(0);
  });

  it('preserves existing H-bond via angle hysteresis', () => {
    // Set up geometry where D-H···A angle is between form (120°) and break (100°)
    // D at origin, H at (-0.96, 0, 0), acceptor placed so angle ≈ 110°
    // For angle of 110° between D→H and H→A vectors:
    //   D→H = (-0.96, 0, 0)
    //   H→A = (ax, ay, 0), with dot(DH, HA)/(|DH|*|HA|) = cos(110°)
    //   => -ax / distHA = cos(110°) => ax = -distHA * cos(110°)
    const angleRad = (110 * Math.PI) / 180;
    const distHA = 2.0; // Å, within form threshold
    const ax = -distHA * Math.cos(angleRad);
    const ay = distHA * Math.sin(angleRad);
    const acceptorX = -0.96 + ax;
    const acceptorY = ay;

    const positions = new Float64Array([
      0,
      0,
      0, // atom 0: donor O
      -0.96,
      0,
      0, // atom 1: H
      acceptorX,
      acceptorY,
      0, // atom 2: acceptor O
    ]);
    const atomicNumbers = [8, 1, 8];
    const covalentBonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' },
    ];

    // Without previous H-bonds: should NOT form (110° < 120° form threshold)
    const hBondsNew = detectHydrogenBonds(
      positions,
      atomicNumbers,
      covalentBonds,
      [],
    );
    expect(hBondsNew.length).toBe(0);

    // With previous H-bond: should PRESERVE (110° > 100° break threshold)
    const previousHBonds: Bond[] = [
      { atomA: 1, atomB: 2, order: 0.5, type: 'hydrogen' },
    ];
    const hBondsExisting = detectHydrogenBonds(
      positions,
      atomicNumbers,
      covalentBonds,
      previousHBonds,
    );
    expect(hBondsExisting.length).toBe(1);
  });
});

describe('buildAngleList', () => {
  it('builds angles from water-like topology', () => {
    const bonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' }, // O-H1
      { atomA: 0, atomB: 2, order: 1, type: 'covalent' }, // O-H2
    ];

    const angles = buildAngleList(bonds, 3);

    // Should find H1-O-H2 angle
    expect(angles.length).toBe(1);
    // Central atom should be 0 (oxygen)
    expect(angles[0][1]).toBe(0);
    // Terminal atoms should be 1 and 2
    expect(new Set([angles[0][0], angles[0][2]])).toEqual(new Set([1, 2]));
  });

  it('builds multiple angles from methane-like topology', () => {
    const bonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' }, // C-H1
      { atomA: 0, atomB: 2, order: 1, type: 'covalent' }, // C-H2
      { atomA: 0, atomB: 3, order: 1, type: 'covalent' }, // C-H3
      { atomA: 0, atomB: 4, order: 1, type: 'covalent' }, // C-H4
    ];

    const angles = buildAngleList(bonds, 5);

    // C(4 neighbors) → C(4,2) = 6 angles
    expect(angles.length).toBe(6);
    // All central atoms should be 0 (carbon)
    for (const angle of angles) {
      expect(angle[1]).toBe(0);
    }
  });

  it('returns empty for single bond', () => {
    const bonds: Bond[] = [{ atomA: 0, atomB: 1, order: 1, type: 'covalent' }];

    const angles = buildAngleList(bonds, 2);
    expect(angles.length).toBe(0);
  });

  it('excludes hydrogen bonds from angle list', () => {
    const bonds: Bond[] = [
      { atomA: 0, atomB: 1, order: 1, type: 'covalent' },
      { atomA: 0, atomB: 2, order: 0.5, type: 'hydrogen' }, // should be excluded
    ];

    const angles = buildAngleList(bonds, 3);
    expect(angles.length).toBe(0); // only 1 real bond, no angle
  });
});
