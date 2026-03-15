// ==============================================================
// ComparisonTable — side-by-side measurement comparison
// Displays matching metrics from both simulation panels
// ==============================================================

import React from 'react';
import type { StoreApi } from 'zustand';
import { useStore } from 'zustand';
import type { SimulationStoreState } from '../store/simulationStore';
import elements from '../data/elements';

interface ComparisonTableProps {
  leftStore: StoreApi<SimulationStoreState>;
  rightStore: StoreApi<SimulationStoreState>;
}

/** Build a simple molecular formula from atoms, e.g. "H₂O" */
function molecularFormula(atoms: { elementNumber: number }[]): string {
  const counts: Record<string, number> = {};
  for (const atom of atoms) {
    const el = elements[atom.elementNumber];
    const sym = el?.symbol ?? '?';
    counts[sym] = (counts[sym] ?? 0) + 1;
  }
  // Standard Hill system: C first, H second, then alphabetical
  const keys = Object.keys(counts).sort((a, b) => {
    if (a === 'C') return -1;
    if (b === 'C') return 1;
    if (a === 'H') return -1;
    if (b === 'H') return 1;
    return a.localeCompare(b);
  });
  return keys
    .map((sym) => {
      const n = counts[sym];
      if (n === 1) return sym;
      // Unicode subscript digits
      const sub = String(n)
        .split('')
        .map((d) => String.fromCharCode(0x2080 + Number(d)))
        .join('');
      return sym + sub;
    })
    .join('');
}

const cellStyle: React.CSSProperties = {
  padding: '3px 8px',
  textAlign: 'right',
  fontFamily: 'monospace',
  fontSize: 11,
};

const headerCellStyle: React.CSSProperties = {
  ...cellStyle,
  color: '#888',
  textAlign: 'left',
  fontWeight: 'normal',
};

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  leftStore,
  rightStore,
}) => {
  const leftAtoms = useStore(leftStore, (s) => s.atoms);
  const rightAtoms = useStore(rightStore, (s) => s.atoms);
  const leftEnergy = useStore(leftStore, (s) => s.energy);
  const rightEnergy = useStore(rightStore, (s) => s.energy);
  const leftTemp = useStore(leftStore, (s) => s.temperature);
  const rightTemp = useStore(rightStore, (s) => s.temperature);
  const leftBonds = useStore(leftStore, (s) => s.bonds);
  const rightBonds = useStore(rightStore, (s) => s.bonds);

  const leftFormula = molecularFormula(leftAtoms);
  const rightFormula = molecularFormula(rightAtoms);

  const rows: Array<{
    label: string;
    left: string;
    right: string;
    color?: string;
  }> = [
    { label: 'Formula', left: leftFormula, right: rightFormula },
    {
      label: 'Atoms',
      left: String(leftAtoms.length),
      right: String(rightAtoms.length),
    },
    {
      label: 'Bonds',
      left: String(leftBonds.length),
      right: String(rightBonds.length),
    },
    {
      label: 'Temp (K)',
      left: leftTemp.toFixed(0),
      right: rightTemp.toFixed(0),
      color: '#ffaa44',
    },
    {
      label: 'KE (eV)',
      left: leftEnergy.kinetic.toFixed(3),
      right: rightEnergy.kinetic.toFixed(3),
      color: '#ff6666',
    },
    {
      label: 'PE (eV)',
      left: leftEnergy.potential.toFixed(3),
      right: rightEnergy.potential.toFixed(3),
      color: '#66aaff',
    },
    {
      label: 'Total E (eV)',
      left: leftEnergy.total.toFixed(3),
      right: rightEnergy.total.toFixed(3),
      color: '#66ff66',
    },
  ];

  return (
    <div
      data-testid="comparison-table"
      style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20,20,40,0.95)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        padding: '8px 4px',
        zIndex: 120,
        minWidth: 300,
      }}
    >
      <div
        style={{
          textAlign: 'center',
          color: '#aaccff',
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 'bold',
          marginBottom: 6,
        }}
      >
        Comparison
      </div>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
        }}
      >
        <thead>
          <tr>
            <th style={headerCellStyle}>Metric</th>
            <th style={{ ...cellStyle, color: '#60a5fa' }}>Panel A</th>
            <th style={{ ...cellStyle, color: '#f59e0b' }}>Panel B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <td style={headerCellStyle}>{row.label}</td>
              <td style={{ ...cellStyle, color: row.color ?? '#ddd' }}>
                {row.left}
              </td>
              <td style={{ ...cellStyle, color: row.color ?? '#ddd' }}>
                {row.right}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
