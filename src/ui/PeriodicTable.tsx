// ==============================================================
// PeriodicTable — interactive element picker
// ==============================================================

import React from 'react';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';
import type { ChemicalElement } from '../data/types';

// Periodic table grid layout: [row][col] = atomic number (0 = empty)
const GRID: number[][] = [
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  [3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 6, 7, 8, 9, 10],
  [11, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
];

const categoryColors: Record<string, string> = {
  'nonmetal': '#4a9c47',
  'noble-gas': '#7b5ea7',
  'alkali-metal': '#c44e52',
  'alkaline-earth-metal': '#d4874e',
  'metalloid': '#557d8b',
  'halogen': '#30a5a5',
  'transition-metal': '#4e7dc4',
  'post-transition-metal': '#6b8e6b',
  'lanthanide': '#9e6fa0',
  'actinide': '#a06f6f',
};

const ElementCell: React.FC<{
  el: ChemicalElement;
  selected: boolean;
  onClick: () => void;
}> = ({ el, selected, onClick }) => {
  const bgColor = categoryColors[el.category] || '#555';

  return (
    <button
      onClick={onClick}
      style={{
        width: 38,
        height: 42,
        border: selected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: 3,
        background: selected ? bgColor : `${bgColor}99`,
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        fontSize: 10,
        fontFamily: 'monospace',
        transition: 'all 0.15s',
        boxShadow: selected ? `0 0 8px ${bgColor}` : 'none',
      }}
      title={`${el.name} (${el.number})\nEN: ${el.electronegativity}\nMass: ${el.mass}`}
    >
      <span style={{ fontSize: 7, opacity: 0.7 }}>{el.number}</span>
      <span style={{ fontSize: 13, fontWeight: 'bold' }}>{el.symbol}</span>
    </button>
  );
};

export const PeriodicTable: React.FC = () => {
  const selectedElement = useUIStore((s) => s.selectedElement);
  const setSelectedElement = useUIStore((s) => s.setSelectedElement);
  const showPeriodicTable = useUIStore((s) => s.showPeriodicTable);

  if (!showPeriodicTable) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 10,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(20, 20, 40, 0.95)',
      borderRadius: 8,
      padding: '8px 12px',
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(10px)',
      zIndex: 100,
      maxWidth: '95vw',
      overflow: 'auto',
    }}>
      <div style={{
        fontSize: 11,
        color: '#888',
        marginBottom: 4,
        fontFamily: 'sans-serif',
        textAlign: 'center',
      }}>
        Periodic Table — click to select element
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {GRID.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: 'flex', gap: 2 }}>
            {row.map((z, colIdx) => {
              if (z === 0) {
                return <div key={colIdx} style={{ width: 38, height: 42 }} />;
              }
              const el = elements[z];
              if (!el) return <div key={colIdx} style={{ width: 38, height: 42 }} />;
              return (
                <ElementCell
                  key={z}
                  el={el}
                  selected={selectedElement === z}
                  onClick={() => setSelectedElement(z)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
