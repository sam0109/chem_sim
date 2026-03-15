// ==============================================================
// XYZ file format reader/writer
// Format:
//   Line 1: number of atoms
//   Line 2: comment
//   Lines 3+: Symbol X Y Z
// ==============================================================

import type { Atom } from '../data/types';
import { getElementBySymbol } from '../data/elements';

/**
 * Parse XYZ file content into atoms.
 */
export function parseXYZ(content: string): Atom[] {
  const lines = content.trim().split('\n');
  if (lines.length < 3) return [];

  const nAtoms = parseInt(lines[0].trim(), 10);
  if (isNaN(nAtoms) || nAtoms <= 0) return [];

  const atoms: Atom[] = [];

  for (let i = 2; i < Math.min(2 + nAtoms, lines.length); i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 4) continue;

    const symbol = parts[0];
    const x = parseFloat(parts[1]);
    const y = parseFloat(parts[2]);
    const z = parseFloat(parts[3]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

    const el = getElementBySymbol(symbol);
    if (!el) continue;

    atoms.push({
      id: atoms.length,
      elementNumber: el.number,
      position: [x, y, z],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'sp3',
      fixed: false,
    });
  }

  return atoms;
}

/**
 * Write atoms to XYZ format string.
 */
export function writeXYZ(
  atoms: Atom[],
  comment: string = 'chem_sim export',
): string {
  const lines: string[] = [String(atoms.length), comment];

  for (const atom of atoms) {
    const el = getElementBySymbol(String(atom.elementNumber));
    const sym = el?.symbol ?? 'X';
    const [x, y, z] = atom.position;
    lines.push(
      `${sym.padEnd(4)} ${x.toFixed(6).padStart(12)} ${y.toFixed(6).padStart(12)} ${z.toFixed(6).padStart(12)}`,
    );
  }

  return lines.join('\n') + '\n';
}
