// ==============================================================
// PeriodicTable — interactive element picker with educational features
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

/** Cell width in px — used for grid layout and tooltip positioning */
const CELL_W = 38;
/** Cell height in px */
const CELL_H = 42;
/** Gap between cells in px */
const CELL_GAP = 2;

const categoryColors: Record<string, string> = {
  nonmetal: '#4a9c47',
  'noble-gas': '#7b5ea7',
  'alkali-metal': '#c44e52',
  'alkaline-earth-metal': '#d4874e',
  metalloid: '#557d8b',
  halogen: '#30a5a5',
  'transition-metal': '#4e7dc4',
  'post-transition-metal': '#6b8e6b',
  lanthanide: '#9e6fa0',
  actinide: '#a06f6f',
};

/** Human-readable category labels */
const categoryLabels: Record<string, string> = {
  nonmetal: 'Nonmetal',
  'noble-gas': 'Noble Gas',
  'alkali-metal': 'Alkali Metal',
  'alkaline-earth-metal': 'Alkaline Earth Metal',
  metalloid: 'Metalloid',
  halogen: 'Halogen',
  'transition-metal': 'Transition Metal',
  'post-transition-metal': 'Post-Transition Metal',
  lanthanide: 'Lanthanide',
  actinide: 'Actinide',
};

// ---- Tooltip ----

/** Row in the tooltip property table */
const TooltipRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <tr>
    <td
      style={{
        color: '#888',
        paddingRight: 8,
        whiteSpace: 'nowrap',
        fontSize: 10,
      }}
    >
      {label}
    </td>
    <td style={{ color: '#ddd', fontSize: 10 }}>{value}</td>
  </tr>
);

/** Rich tooltip shown on element hover — displays all known properties */
const ElementTooltip: React.FC<{
  el: ChemicalElement;
  gridRow: number;
  gridCol: number;
}> = ({ el, gridRow, gridCol }) => {
  // Position tooltip above the hovered cell
  const tooltipLeft = gridCol * (CELL_W + CELL_GAP);
  // Show above the grid for rows near the bottom, below for the top row
  const showBelow = gridRow === 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: tooltipLeft,
        ...(showBelow
          ? { top: (gridRow + 1) * (CELL_H + CELL_GAP) + 4 }
          : { bottom: (GRID.length - gridRow) * (CELL_H + CELL_GAP) + 28 }),
        background: 'rgba(10, 10, 30, 0.97)',
        border: '1px solid rgba(120, 160, 255, 0.3)',
        borderRadius: 6,
        padding: '8px 10px',
        zIndex: 200,
        pointerEvents: 'none',
        minWidth: 200,
        fontFamily: 'monospace',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header: symbol + name */}
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
          {el.symbol}
        </span>
        <span style={{ fontSize: 12, color: '#aaccff', marginLeft: 8 }}>
          {el.name}
        </span>
      </div>

      {/* Category badge */}
      <div
        style={{
          display: 'inline-block',
          background: categoryColors[el.category] || '#555',
          color: '#fff',
          fontSize: 9,
          padding: '1px 6px',
          borderRadius: 3,
          marginBottom: 6,
        }}
      >
        {categoryLabels[el.category] || el.category}
      </div>

      {/* Properties table */}
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <TooltipRow label="Atomic #" value={String(el.number)} />
          <TooltipRow label="Mass" value={`${el.mass.toFixed(3)} amu`} />
          <TooltipRow
            label="Electronegativity"
            value={
              el.electronegativity > 0 ? String(el.electronegativity) : '—'
            }
          />
          <TooltipRow
            label="Covalent radius"
            value={`${el.covalentRadius.toFixed(2)} Å`}
          />
          <TooltipRow
            label="vdW radius"
            value={`${el.vdwRadius.toFixed(2)} Å`}
          />
          <TooltipRow label="Electron config" value={el.electronConfig} />
          <TooltipRow
            label="Ionization energy"
            value={
              el.ionizationEnergy > 0
                ? `${el.ionizationEnergy.toFixed(2)} eV`
                : '—'
            }
          />
          <TooltipRow
            label="Electron affinity"
            value={
              el.electronAffinity !== 0
                ? `${el.electronAffinity.toFixed(2)} eV`
                : '—'
            }
          />
          <TooltipRow
            label="Oxidation states"
            value={
              el.oxidationStates.length > 0
                ? el.oxidationStates
                    .map((s) => (s > 0 ? `+${s}` : String(s)))
                    .join(', ')
                : '—'
            }
          />
          <TooltipRow label="Max valence" value={String(el.maxValence)} />
        </tbody>
      </table>
    </div>
  );
};

// ---- Element Cell ----

const ElementCell: React.FC<{
  el: ChemicalElement;
  selected: boolean;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}> = ({ el, selected, onClick, onHoverStart, onHoverEnd }) => {
  const bgColor = categoryColors[el.category] || '#555';

  return (
    <button
      data-testid={`element-${el.symbol}`}
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      style={{
        width: CELL_W,
        height: CELL_H,
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
    >
      <span style={{ fontSize: 7, opacity: 0.7 }}>{el.number}</span>
      <span style={{ fontSize: 13, fontWeight: 'bold' }}>{el.symbol}</span>
    </button>
  );
};

// ---- Main Component ----

export const PeriodicTable: React.FC = () => {
  const selectedElement = useUIStore((s) => s.selectedElement);
  const setSelectedElement = useUIStore((s) => s.setSelectedElement);
  const showPeriodicTable = useUIStore((s) => s.showPeriodicTable);
  const hoveredElement = useUIStore((s) => s.hoveredElement);
  const setHoveredElement = useUIStore((s) => s.setHoveredElement);

  if (!showPeriodicTable) return null;

  // Find grid position of hovered element for tooltip placement
  let tooltipRow = 0;
  let tooltipCol = 0;
  let tooltipEl: ChemicalElement | null = null;
  if (hoveredElement !== null) {
    for (let r = 0; r < GRID.length; r++) {
      for (let c = 0; c < GRID[r].length; c++) {
        if (GRID[r][c] === hoveredElement) {
          tooltipRow = r;
          tooltipCol = c;
          tooltipEl = elements[hoveredElement] ?? null;
        }
      }
    }
  }

  return (
    <div
      data-testid="periodic-table"
      style={{
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
        overflow: 'visible',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#888',
          marginBottom: 4,
          fontFamily: 'sans-serif',
          textAlign: 'center',
        }}
      >
        Periodic Table — click to select element
      </div>

      {/* Grid container — relative for tooltip positioning */}
      <div style={{ position: 'relative' }}>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP }}
        >
          {GRID.map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: 'flex', gap: CELL_GAP }}>
              {row.map((z, colIdx) => {
                if (z === 0) {
                  return (
                    <div
                      key={colIdx}
                      style={{ width: CELL_W, height: CELL_H }}
                    />
                  );
                }
                const el = elements[z];
                if (!el)
                  return (
                    <div
                      key={colIdx}
                      style={{ width: CELL_W, height: CELL_H }}
                    />
                  );
                return (
                  <ElementCell
                    key={z}
                    el={el}
                    selected={selectedElement === z}
                    onClick={() => setSelectedElement(z)}
                    onHoverStart={() => setHoveredElement(z)}
                    onHoverEnd={() => setHoveredElement(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Rich tooltip */}
        {tooltipEl && (
          <ElementTooltip
            el={tooltipEl}
            gridRow={tooltipRow}
            gridCol={tooltipCol}
          />
        )}
      </div>
    </div>
  );
};
