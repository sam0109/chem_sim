// ==============================================================
// PeriodicTable — interactive element picker with educational features
// ==============================================================

import React, { useMemo } from 'react';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';
import type { ChemicalElement, PeriodicTableColorMode } from '../data/types';

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

// ---- Color Mode Utilities ----

/** Human-readable labels for color modes */
const colorModeLabels: Record<PeriodicTableColorMode, string> = {
  category: 'Category',
  electronegativity: 'EN',
  atomicRadius: 'Radius',
  electronAffinity: 'EA',
  ionizationEnergy: 'IE',
};

/** Unit labels for color mode legends */
const colorModeUnits: Record<PeriodicTableColorMode, string> = {
  category: '',
  electronegativity: 'Pauling',
  atomicRadius: 'Å',
  electronAffinity: 'eV',
  ionizationEnergy: 'eV',
};

/** Extract the numeric property value for a given color mode */
function getPropertyValue(
  el: ChemicalElement,
  mode: PeriodicTableColorMode,
): number {
  switch (mode) {
    case 'electronegativity':
      return el.electronegativity;
    case 'atomicRadius':
      return el.vdwRadius;
    case 'electronAffinity':
      return el.electronAffinity;
    case 'ionizationEnergy':
      return el.ionizationEnergy;
    case 'category':
      return 0;
  }
}

/** Compute min/max of a numeric property across all elements in the grid */
function computePropertyRange(mode: PeriodicTableColorMode): {
  min: number;
  max: number;
} {
  let min = Infinity;
  let max = -Infinity;
  for (const row of GRID) {
    for (const z of row) {
      if (z === 0) continue;
      const el = elements[z];
      if (!el) continue;
      const val = getPropertyValue(el, mode);
      // Skip zero/unknown values for EN and IE (they indicate missing data)
      if (
        val === 0 &&
        (mode === 'electronegativity' || mode === 'ionizationEnergy')
      )
        continue;
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }
  return { min, max };
}

/**
 * Interpolate between two hex colors.
 * t ∈ [0, 1]: 0 → colorA, 1 → colorB
 */
function lerpColor(colorA: string, colorB: string, t: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const parseHex = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });
  const a = parseHex(colorA);
  const b = parseHex(colorB);
  const r = clamp(a.r + (b.r - a.r) * t);
  const g = clamp(a.g + (b.g - a.g) * t);
  const bl = clamp(a.b + (b.b - a.b) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/**
 * Map a value to a 3-stop gradient: low → mid → high.
 * Uses blue (#3366cc) → white (#f0f0f0) → red (#cc3333)
 * as a diverging colormap familiar from chemistry heatmaps.
 */
const GRAD_LOW = '#3366cc';
const GRAD_MID = '#f0f0f0';
const GRAD_HIGH = '#cc3333';

function valueToGradientColor(value: number, min: number, max: number): string {
  if (max === min) return GRAD_MID;
  const t = (value - min) / (max - min); // 0..1
  if (t <= 0.5) {
    return lerpColor(GRAD_LOW, GRAD_MID, t * 2);
  }
  return lerpColor(GRAD_MID, GRAD_HIGH, (t - 0.5) * 2);
}

/** Get background color for an element cell based on the active color mode */
function getCellColor(
  el: ChemicalElement,
  mode: PeriodicTableColorMode,
  range: { min: number; max: number },
): string {
  if (mode === 'category') {
    return categoryColors[el.category] || '#555';
  }
  const val = getPropertyValue(el, mode);
  // Show unknown/zero values as dark gray
  if (
    val === 0 &&
    (mode === 'electronegativity' || mode === 'ionizationEnergy')
  ) {
    return '#333';
  }
  return valueToGradientColor(val, range.min, range.max);
}

// ---- Color Mode Selector ----

const COLOR_MODES: PeriodicTableColorMode[] = [
  'category',
  'electronegativity',
  'atomicRadius',
  'electronAffinity',
  'ionizationEnergy',
];

const ColorModeSelector: React.FC<{
  active: PeriodicTableColorMode;
  onSelect: (mode: PeriodicTableColorMode) => void;
}> = ({ active, onSelect }) => (
  <div
    style={{
      display: 'flex',
      gap: 4,
      justifyContent: 'center',
      marginBottom: 4,
    }}
  >
    {COLOR_MODES.map((mode) => (
      <button
        key={mode}
        onClick={() => onSelect(mode)}
        style={{
          background:
            active === mode
              ? 'rgba(100, 140, 255, 0.3)'
              : 'rgba(255,255,255,0.05)',
          border:
            active === mode
              ? '1px solid rgba(100, 140, 255, 0.6)'
              : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 3,
          color: active === mode ? '#aaccff' : '#888',
          fontSize: 9,
          padding: '2px 6px',
          cursor: 'pointer',
          fontFamily: 'sans-serif',
          transition: 'all 0.15s',
        }}
      >
        {colorModeLabels[mode]}
      </button>
    ))}
  </div>
);

/** Horizontal gradient legend bar for numeric color modes */
const ColorLegend: React.FC<{
  mode: PeriodicTableColorMode;
  range: { min: number; max: number };
}> = ({ mode, range }) => {
  if (mode === 'category') return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 4,
        fontSize: 9,
        fontFamily: 'monospace',
        color: '#888',
      }}
    >
      <span>
        {range.min.toFixed(1)} {colorModeUnits[mode]}
      </span>
      <div
        style={{
          width: 120,
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(to right, ${GRAD_LOW}, ${GRAD_MID}, ${GRAD_HIGH})`,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />
      <span>
        {range.max.toFixed(1)} {colorModeUnits[mode]}
      </span>
    </div>
  );
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
  bgColor: string;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}> = ({ el, selected, bgColor, onClick, onHoverStart, onHoverEnd }) => {
  // For gradient color modes, use dark text on light backgrounds
  const isLightBg =
    bgColor !== '#333' && bgColor !== '#555' && bgColor > '#888888';
  const textColor = isLightBg ? '#111' : '#fff';

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
        color: textColor,
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
  const ptColorMode = useUIStore((s) => s.periodicTableColorMode);
  const setPtColorMode = useUIStore((s) => s.setPeriodicTableColorMode);

  // Compute property range for current color mode (memoized)
  const propertyRange = useMemo(
    () => computePropertyRange(ptColorMode),
    [ptColorMode],
  );

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

      {/* Color mode selector */}
      <ColorModeSelector active={ptColorMode} onSelect={setPtColorMode} />

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
                const cellBg = getCellColor(el, ptColorMode, propertyRange);
                return (
                  <ElementCell
                    key={z}
                    el={el}
                    selected={selectedElement === z}
                    bgColor={cellBg}
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

      {/* Color legend */}
      <ColorLegend mode={ptColorMode} range={propertyRange} />
    </div>
  );
};
