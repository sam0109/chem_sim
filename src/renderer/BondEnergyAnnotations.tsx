// ==============================================================
// BondEnergyAnnotations — renders Morse De labels at bond midpoints
// Data source: bonds from store + UFF Morse parameter lookup
// ==============================================================

import React from 'react';
import { Html } from '@react-three/drei';

import { useSimContextStore } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import { getMorseBondParams } from '../data/uff';

/** Cap labels at this count to avoid DOM performance issues */
const MAX_BOND_LABELS = 50;

export const BondEnergyAnnotations: React.FC = () => {
  const showAnnotations = useUIStore((s) => s.showAnnotations);
  const showBondEnergy = useUIStore((s) => s.annotationBondEnergy);
  const atoms = useSimContextStore((s) => s.atoms);
  const bonds = useSimContextStore((s) => s.bonds);
  const positions = useSimContextStore((s) => s.positions);

  if (!showAnnotations || !showBondEnergy || bonds.length === 0) return null;

  const labels: React.ReactNode[] = [];

  const count = Math.min(bonds.length, MAX_BOND_LABELS);
  for (let idx = 0; idx < count; idx++) {
    const bond = bonds[idx];
    if (bond.atomA >= atoms.length || bond.atomB >= atoms.length) continue;

    // Only show De for covalent bonds — ionic/hydrogen/vdW don't use Morse
    if (bond.type !== 'covalent') continue;

    const atomA = atoms[bond.atomA];
    const atomB = atoms[bond.atomB];

    // Look up Morse De from UFF data
    // getMorseBondParams lives in src/data/ (shared layer), safe to import
    const morseParams = getMorseBondParams(
      atomA.elementNumber,
      atomB.elementNumber,
      bond.order,
      atomA.hybridization,
      atomB.hybridization,
    );

    // Compute bond midpoint from positions array
    const iA = bond.atomA;
    const iB = bond.atomB;
    const xA =
      positions.length > iA * 3 ? positions[iA * 3] : atomA.position[0];
    const yA =
      positions.length > iA * 3 + 1 ? positions[iA * 3 + 1] : atomA.position[1];
    const zA =
      positions.length > iA * 3 + 2 ? positions[iA * 3 + 2] : atomA.position[2];
    const xB =
      positions.length > iB * 3 ? positions[iB * 3] : atomB.position[0];
    const yB =
      positions.length > iB * 3 + 1 ? positions[iB * 3 + 1] : atomB.position[1];
    const zB =
      positions.length > iB * 3 + 2 ? positions[iB * 3 + 2] : atomB.position[2];

    const midX = (xA + xB) / 2;
    const midY = (yA + yB) / 2;
    const midZ = (zA + zB) / 2;

    // Offset label slightly above the bond midpoint to avoid overlap
    const yOffset = 0.25;

    labels.push(
      <Html
        key={`bond-de-${idx}`}
        position={[midX, midY + yOffset, midZ]}
        center
        style={{
          color: '#ffcc44',
          fontSize: '9px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          textShadow: '0 0 3px rgba(0,0,0,0.9)',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          opacity: 0.9,
        }}
      >
        {morseParams.De.toFixed(2)} eV
      </Html>,
    );
  }

  if (labels.length === 0) return null;

  return <>{labels}</>;
};
