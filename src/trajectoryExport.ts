// ==============================================================
// trajectoryExport — bridge between store/UI and io layer
// Lives at root level so both App.tsx and store can reference it
// ==============================================================

import type { TrajectoryFrame } from './data/types';
import { getElement } from './data/elements';

/**
 * Write a multi-frame trajectory to XYZ format (concatenated single-frame blocks).
 *
 * Standard multi-frame XYZ format:
 *   Frame 1: nAtoms / comment / atom lines
 *   Frame 2: nAtoms / comment / atom lines
 *   ...
 *
 * @param frames - Trajectory frames with positions
 * @param atomicNumbers - Atomic numbers per atom (from the atoms array)
 * @returns Multi-frame XYZ string
 */
export function writeTrajectoryXYZ(
  frames: TrajectoryFrame[],
  atomicNumbers: number[],
): string {
  const nAtoms = atomicNumbers.length;
  const symbols = atomicNumbers.map((z) => getElement(z)?.symbol ?? 'X');
  const parts: string[] = [];

  for (const frame of frames) {
    parts.push(String(nAtoms));
    parts.push(
      `Step ${frame.step}  E_total=${frame.energy.total.toFixed(6)} eV  T=${frame.temperature.toFixed(1)} K`,
    );

    for (let i = 0; i < nAtoms; i++) {
      const x = frame.positions[i * 3] ?? 0;
      const y = frame.positions[i * 3 + 1] ?? 0;
      const z = frame.positions[i * 3 + 2] ?? 0;
      parts.push(
        `${symbols[i].padEnd(4)} ${x.toFixed(6).padStart(12)} ${y.toFixed(6).padStart(12)} ${z.toFixed(6).padStart(12)}`,
      );
    }
  }

  return parts.join('\n') + '\n';
}

/**
 * Trigger a file download in the browser with the given content.
 */
export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string = 'chemical/x-xyz',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
