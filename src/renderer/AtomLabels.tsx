// ==============================================================
// AtomLabels — renders element symbol labels above atoms
// ==============================================================

import React from 'react';
import { Html } from '@react-three/drei';

import { useSimContextStore } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';

export const AtomLabels: React.FC = () => {
  const showLabels = useUIStore((s) => s.showLabels);
  const atoms = useSimContextStore((s) => s.atoms);
  const positions = useSimContextStore((s) => s.positions);

  if (!showLabels || atoms.length === 0) return null;

  // Only show labels for up to 100 atoms to avoid performance issues
  const maxLabels = Math.min(atoms.length, 100);

  return (
    <>
      {atoms.slice(0, maxLabels).map((atom, i) => {
        const el = elements[atom.elementNumber];
        const x =
          positions.length > i * 3 ? positions[i * 3] : atom.position[0];
        const y =
          positions.length > i * 3 + 1
            ? positions[i * 3 + 1]
            : atom.position[1];
        const z =
          positions.length > i * 3 + 2
            ? positions[i * 3 + 2]
            : atom.position[2];

        return (
          <Html
            key={i}
            position={[x, y + (el?.covalentRadius ?? 0.5) * 0.6 + 0.3, z]}
            center
            style={{
              color: '#ffffff',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              textShadow: '0 0 3px rgba(0,0,0,0.8)',
              pointerEvents: 'none',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {el?.symbol ?? '?'}
          </Html>
        );
      })}
    </>
  );
};
