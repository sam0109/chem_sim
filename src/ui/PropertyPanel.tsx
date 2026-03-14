// ==============================================================
// PropertyPanel — shows details about selected atom(s) and bonds
// ==============================================================

import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';

export const PropertyPanel: React.FC = () => {
  const showPropertyPanel = useUIStore((s) => s.showPropertyPanel);
  const selectedAtomIds = useUIStore((s) => s.selectedAtomIds);
  const atoms = useSimulationStore((s) => s.atoms);
  const bonds = useSimulationStore((s) => s.bonds);
  const positions = useSimulationStore((s) => s.positions);

  if (!showPropertyPanel || selectedAtomIds.length === 0) return null;

  const selectedAtoms = selectedAtomIds
    .filter((id) => id < atoms.length)
    .map((id) => atoms[id]);

  // Find bonds between selected atoms
  const selectedBonds = bonds.filter(
    (b) => selectedAtomIds.includes(b.atomA) || selectedAtomIds.includes(b.atomB)
  );

  // Distance between two selected atoms
  let distance: number | null = null;
  if (selectedAtomIds.length === 2) {
    const [i, j] = selectedAtomIds;
    if (positions.length > Math.max(i, j) * 3 + 2) {
      const dx = positions[j * 3] - positions[i * 3];
      const dy = positions[j * 3 + 1] - positions[i * 3 + 1];
      const dz = positions[j * 3 + 2] - positions[i * 3 + 2];
      distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      left: 10,
      background: 'rgba(20, 20, 40, 0.95)',
      borderRadius: 8,
      padding: '12px 16px',
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(10px)',
      color: '#ddd',
      fontFamily: 'monospace',
      fontSize: 12,
      minWidth: 200,
      maxWidth: 280,
      zIndex: 100,
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 13, color: '#aaccff' }}>
        Properties
      </div>

      {selectedAtoms.map((atom, idx) => {
        const el = elements[atom.elementNumber];
        const i = selectedAtomIds[idx];
        const x = positions.length > i * 3 ? positions[i * 3] : atom.position[0];
        const y = positions.length > i * 3 + 1 ? positions[i * 3 + 1] : atom.position[1];
        const z = positions.length > i * 3 + 2 ? positions[i * 3 + 2] : atom.position[2];

        return (
          <div key={idx} style={{
            marginBottom: 8,
            padding: 6,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: el?.color ?? '#ccc',
                border: '1px solid rgba(255,255,255,0.3)',
              }} />
              <span style={{ fontWeight: 'bold', fontSize: 14 }}>
                {el?.symbol ?? '?'} <span style={{ color: '#888', fontSize: 11 }}>#{i}</span>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: 10 }}>
              <span style={{ color: '#888' }}>Element</span>
              <span>{el?.name ?? 'Unknown'}</span>
              <span style={{ color: '#888' }}>Mass</span>
              <span>{el?.mass.toFixed(3)} amu</span>
              <span style={{ color: '#888' }}>EN</span>
              <span>{el?.electronegativity ?? 'N/A'}</span>
              <span style={{ color: '#888' }}>Charge</span>
              <span>{atom.charge.toFixed(3)} e</span>
              <span style={{ color: '#888' }}>Position</span>
              <span>{x.toFixed(2)}, {y.toFixed(2)}, {z.toFixed(2)}</span>
              <span style={{ color: '#888' }}>Hybridization</span>
              <span>{atom.hybridization}</span>
            </div>
          </div>
        );
      })}

      {distance !== null && (
        <div style={{
          padding: 6,
          background: 'rgba(100,180,255,0.1)',
          borderRadius: 4,
          textAlign: 'center',
          marginBottom: 8,
        }}>
          <span style={{ color: '#88ccff' }}>Distance: {distance.toFixed(4)} Å</span>
        </div>
      )}

      {selectedBonds.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Bonds</div>
          {selectedBonds.slice(0, 8).map((bond, idx) => (
            <div key={idx} style={{ fontSize: 10, marginBottom: 2 }}>
              {elements[atoms[bond.atomA]?.elementNumber]?.symbol ?? '?'}
              {bond.atomA}
              {bond.order === 2 ? '=' : bond.order === 3 ? '≡' : '—'}
              {elements[atoms[bond.atomB]?.elementNumber]?.symbol ?? '?'}
              {bond.atomB}
              <span style={{ color: '#888', marginLeft: 4 }}>({bond.type})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
