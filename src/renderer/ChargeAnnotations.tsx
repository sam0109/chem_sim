// ==============================================================
// ChargeAnnotations — renders δ+/δ− partial charge labels on atoms
// Data source: charges array from simulation store
// ==============================================================

import React from 'react';
import { Html } from '@react-three/drei';

import { useSimContextStore } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';

/**
 * Minimum absolute charge (in elementary charge units) to display a label.
 * Charges below this threshold are considered negligible and not annotated.
 * Threshold chosen to avoid clutter on nearly-neutral atoms while still
 * showing meaningful polarity (e.g., H in H₂O has ~+0.33e).
 */
const CHARGE_DISPLAY_THRESHOLD = 0.05;

/** Cap labels at this count to avoid DOM performance issues */
const MAX_CHARGE_LABELS = 50;

export const ChargeAnnotations: React.FC = () => {
  const showAnnotations = useUIStore((s) => s.showAnnotations);
  const showCharges = useUIStore((s) => s.annotationCharges);
  const atoms = useSimContextStore((s) => s.atoms);
  const positions = useSimContextStore((s) => s.positions);
  const charges = useSimContextStore((s) => s.charges);

  if (!showAnnotations || !showCharges || atoms.length === 0) return null;

  const labels: React.ReactNode[] = [];

  const count = Math.min(atoms.length, MAX_CHARGE_LABELS);
  for (let i = 0; i < count; i++) {
    const q = charges.length > i ? charges[i] : atoms[i].charge;
    if (Math.abs(q) < CHARGE_DISPLAY_THRESHOLD) continue;

    const el = elements[atoms[i].elementNumber];
    const x =
      positions.length > i * 3 ? positions[i * 3] : atoms[i].position[0];
    const y =
      positions.length > i * 3 + 1
        ? positions[i * 3 + 1]
        : atoms[i].position[1];
    const z =
      positions.length > i * 3 + 2
        ? positions[i * 3 + 2]
        : atoms[i].position[2];

    // Offset label below the atom (opposite side from element label)
    const radius = el?.covalentRadius ?? 0.5;
    const yOffset = -(radius * 0.6 + 0.3);

    const isPositive = q > 0;
    const symbol = isPositive ? '\u03B4+' : '\u03B4\u2212'; // δ+ or δ−
    const color = isPositive ? '#6699ff' : '#ff6666';

    labels.push(
      <Html
        key={`charge-${i}`}
        position={[x, y + yOffset, z]}
        center
        style={{
          color,
          fontSize: '10px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          textShadow: '0 0 3px rgba(0,0,0,0.9)',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {symbol}
        {Math.abs(q).toFixed(2)}
      </Html>,
    );
  }

  if (labels.length === 0) return null;

  return <>{labels}</>;
};
