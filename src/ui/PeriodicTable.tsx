// ==============================================================
// PeriodicTable — interactive element picker with educational features
// ==============================================================

import React, { useCallback, useMemo } from 'react';
import { useUIStore } from '../store/uiStore';
import { useSimulationStore } from '../store/simulationStore';
import elements from '../data/elements';
import type {
  Atom,
  ChemicalElement,
  PeriodicTableColorMode,
} from '../data/types';

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
 * Compute relative luminance of a hex color.
 * Formula: ITU-R BT.709 (sRGB luminance with gamma linearization)
 * Source: W3C WCAG 2.1, §1.4.3 Contrast
 * Returns 0 (black) to 1 (white).
 */
function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // sRGB → linear
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
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
  showTrends: boolean;
  onToggleTrends: () => void;
}> = ({ active, onSelect, showTrends, onToggleTrends }) => (
  <div
    style={{
      display: 'flex',
      gap: 4,
      justifyContent: 'center',
      alignItems: 'center',
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
    {/* Trend annotations toggle */}
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        marginLeft: 8,
        fontSize: 9,
        color: '#888',
        fontFamily: 'sans-serif',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={showTrends}
        onChange={onToggleTrends}
        style={{ width: 10, height: 10, cursor: 'pointer' }}
      />
      Trends
    </label>
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

// ---- Trend Annotations ----

/**
 * Overlay arrows showing periodic trends.
 * Electronegativity increases left→right (and bottom→top).
 * Atomic radius increases top→bottom (and right→left).
 */
const TrendAnnotations: React.FC = () => {
  /** Total grid width: 18 cells + 17 gaps */
  const gridW = 18 * CELL_W + 17 * CELL_GAP;
  /** Total grid height: 4 rows + 3 gaps */
  const gridH = 4 * CELL_H + 3 * CELL_GAP;

  return (
    <>
      {/* Horizontal arrow — "Electronegativity increases →" */}
      <div
        style={{
          position: 'absolute',
          top: -16,
          left: 0,
          width: gridW,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            flex: 1,
            height: 1,
            background:
              'linear-gradient(to right, transparent, rgba(170,204,255,0.5))',
          }}
        />
        <span
          style={{
            fontSize: 8,
            color: '#aaccff',
            fontFamily: 'sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          Electronegativity increases →
        </span>
      </div>

      {/* Vertical arrow — "Atomic radius increases ↓" */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: -14,
          height: gridH,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          pointerEvents: 'none',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
        }}
      >
        <span
          style={{
            fontSize: 8,
            color: '#aaccff',
            fontFamily: 'sans-serif',
            whiteSpace: 'nowrap',
            transform: 'rotate(180deg)',
          }}
        >
          Atomic radius increases ↓
        </span>
      </div>
    </>
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

// ---- Element Comparison ----

/**
 * Bond type prediction based on electronegativity difference.
 * ΔEN thresholds from Pauling's classification:
 * - ΔEN < 0.4: nonpolar covalent
 * - 0.4 ≤ ΔEN ≤ 1.7: polar covalent
 * - ΔEN > 1.7: ionic
 * Source: Pauling, L. "The Nature of the Chemical Bond" (1960)
 */
function predictBondType(deltaEN: number): {
  type: string;
  color: string;
} {
  if (deltaEN < 0.4) return { type: 'Nonpolar covalent', color: '#4a9c47' };
  if (deltaEN <= 1.7) return { type: 'Polar covalent', color: '#d4874e' };
  return { type: 'Ionic', color: '#c44e52' };
}

/** Side-by-side comparison row */
const CompareRow: React.FC<{
  label: string;
  leftVal: string;
  rightVal: string;
}> = ({ label, leftVal, rightVal }) => (
  <tr>
    <td
      style={{
        textAlign: 'right',
        paddingRight: 6,
        color: '#ddd',
        fontSize: 10,
      }}
    >
      {leftVal}
    </td>
    <td
      style={{
        textAlign: 'center',
        color: '#888',
        fontSize: 9,
        padding: '0 4px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </td>
    <td
      style={{
        textAlign: 'left',
        paddingLeft: 6,
        color: '#ddd',
        fontSize: 10,
      }}
    >
      {rightVal}
    </td>
  </tr>
);

/** Property bar comparing two values visually */
const CompareBar: React.FC<{
  label: string;
  leftVal: number;
  rightVal: number;
  unit: string;
}> = ({ label, leftVal, rightVal, unit }) => {
  const maxVal = Math.max(leftVal, rightVal, 0.01);
  const leftPct = (leftVal / maxVal) * 100;
  const rightPct = (rightVal / maxVal) * 100;

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          fontSize: 8,
          color: '#888',
          textAlign: 'center',
          marginBottom: 1,
        }}
      >
        {label} ({unit})
      </div>
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {/* Left bar grows right-to-left */}
        <div
          style={{
            flex: 1,
            height: 6,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 3,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              width: `${leftPct}%`,
              height: '100%',
              background: '#4e7dc4',
              borderRadius: 3,
            }}
          />
        </div>
        {/* Right bar grows left-to-right */}
        <div
          style={{
            flex: 1,
            height: 6,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 3,
          }}
        >
          <div
            style={{
              width: `${rightPct}%`,
              height: '100%',
              background: '#c44e52',
              borderRadius: 3,
            }}
          />
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 8,
          color: '#aaa',
        }}
      >
        <span>{leftVal.toFixed(2)}</span>
        <span>{rightVal.toFixed(2)}</span>
      </div>
    </div>
  );
};

/**
 * Create a diatomic molecule from two elements for simulation.
 * Places atom A at the origin and atom B along the x-axis at the
 * sum of covalent radii + 0.5 Å (a reasonable starting separation
 * that will relax to equilibrium during minimization).
 *
 * Source: initial separation heuristic from issue #90
 */
function createDiatomic(elA: ChemicalElement, elB: ChemicalElement): Atom[] {
  const separation = elA.covalentRadius + elB.covalentRadius + 0.5;
  return [
    {
      id: 0,
      elementNumber: elA.number,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
    {
      id: 1,
      elementNumber: elB.number,
      position: [separation, 0, 0],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0,
      hybridization: 'none',
      fixed: false,
    },
  ];
}

/** Floating comparison card for two elements */
const ElementComparison: React.FC<{
  elA: ChemicalElement;
  elB: ChemicalElement;
  onClose: () => void;
}> = ({ elA, elB, onClose }) => {
  const initSimulation = useSimulationStore((s) => s.initSimulation);
  const minimize = useSimulationStore((s) => s.minimize);

  const handleSimulateDiatomic = useCallback(async () => {
    const atoms = createDiatomic(elA, elB);
    initSimulation(atoms);

    // Brief delay for the web worker to initialize (matches ChallengePanel pattern)
    await new Promise((r) => setTimeout(r, 500));
    minimize();

    // Close the comparison card so the simulation view is visible
    onClose();
  }, [elA, elB, initSimulation, minimize, onClose]);

  const deltaEN = Math.abs(elA.electronegativity - elB.electronegativity);
  const bondPrediction =
    elA.electronegativity > 0 && elB.electronegativity > 0
      ? predictBondType(deltaEN)
      : null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 8,
        background: 'rgba(10, 10, 30, 0.97)',
        border: '1px solid rgba(120, 160, 255, 0.3)',
        borderRadius: 8,
        padding: '10px 14px',
        zIndex: 300,
        minWidth: 260,
        fontFamily: 'monospace',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span
          style={{ fontSize: 12, color: '#aaccff', fontFamily: 'sans-serif' }}
        >
          Compare Elements
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: 14,
            padding: '0 4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Element names */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 'bold', color: '#4e7dc4' }}>
            {elA.symbol}
          </span>
          <div style={{ fontSize: 9, color: '#888' }}>{elA.name}</div>
        </div>
        <div style={{ fontSize: 12, color: '#555', alignSelf: 'center' }}>
          vs
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 'bold', color: '#c44e52' }}>
            {elB.symbol}
          </span>
          <div style={{ fontSize: 9, color: '#888' }}>{elB.name}</div>
        </div>
      </div>

      {/* Property comparison table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: 6,
        }}
      >
        <tbody>
          <CompareRow
            label="Atomic #"
            leftVal={String(elA.number)}
            rightVal={String(elB.number)}
          />
          <CompareRow
            label="Mass"
            leftVal={`${elA.mass.toFixed(2)} amu`}
            rightVal={`${elB.mass.toFixed(2)} amu`}
          />
          <CompareRow
            label="Config"
            leftVal={elA.electronConfig}
            rightVal={elB.electronConfig}
          />
        </tbody>
      </table>

      {/* Visual bars */}
      {elA.electronegativity > 0 && elB.electronegativity > 0 && (
        <CompareBar
          label="Electronegativity"
          leftVal={elA.electronegativity}
          rightVal={elB.electronegativity}
          unit="Pauling"
        />
      )}
      <CompareBar
        label="vdW Radius"
        leftVal={elA.vdwRadius}
        rightVal={elB.vdwRadius}
        unit="Å"
      />
      {elA.ionizationEnergy > 0 && elB.ionizationEnergy > 0 && (
        <CompareBar
          label="Ionization Energy"
          leftVal={elA.ionizationEnergy}
          rightVal={elB.ionizationEnergy}
          unit="eV"
        />
      )}

      {/* Bond type prediction */}
      {bondPrediction && (
        <div
          style={{
            marginTop: 6,
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: 10,
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#888', marginBottom: 2 }}>
            ΔEN = {deltaEN.toFixed(2)}
          </div>
          <div style={{ color: bondPrediction.color, fontWeight: 'bold' }}>
            {bondPrediction.type} bond expected
          </div>
        </div>
      )}

      {/* Simulate diatomic button */}
      <button
        onClick={handleSimulateDiatomic}
        style={{
          display: 'block',
          width: '100%',
          marginTop: 8,
          padding: '6px 10px',
          background: 'rgba(80, 140, 255, 0.15)',
          border: '1px solid rgba(80, 140, 255, 0.4)',
          borderRadius: 4,
          color: '#8ab4ff',
          fontSize: 11,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(80, 140, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(80, 140, 255, 0.15)';
        }}
      >
        Bond {elA.symbol} + {elB.symbol} — Simulate
      </button>

      <div
        style={{
          fontSize: 8,
          color: '#555',
          textAlign: 'center',
          marginTop: 6,
        }}
      >
        Shift+click elements to compare
      </div>
    </div>
  );
};

// ---- Element Cell ----

const ElementCell: React.FC<{
  el: ChemicalElement;
  selected: boolean;
  compared: boolean;
  bgColor: string;
  onClick: (shiftKey: boolean) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}> = ({
  el,
  selected,
  compared,
  bgColor,
  onClick,
  onHoverStart,
  onHoverEnd,
}) => {
  // Use dark text on light backgrounds (luminance > 0.4 threshold)
  const isLightBg = hexLuminance(bgColor) > 0.4;
  const textColor = isLightBg ? '#111' : '#fff';

  return (
    <button
      data-testid={`element-${el.symbol}`}
      onClick={(e) => onClick(e.shiftKey)}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      style={{
        width: CELL_W,
        height: CELL_H,
        border: compared
          ? '2px solid #aaccff'
          : selected
            ? '2px solid #fff'
            : '1px solid rgba(255,255,255,0.2)',
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
        boxShadow: compared
          ? '0 0 8px rgba(170, 204, 255, 0.5)'
          : selected
            ? `0 0 8px ${bgColor}`
            : 'none',
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
  const showTrends = useUIStore((s) => s.showTrendAnnotations);
  const toggleTrends = useUIStore((s) => s.toggleTrendAnnotations);
  const comparedElements = useUIStore((s) => s.comparedElements);
  const setComparedElements = useUIStore((s) => s.setComparedElements);
  const clearComparedElements = useUIStore((s) => s.clearComparedElements);

  // Compute property range for current color mode (memoized)
  const propertyRange = useMemo(
    () => computePropertyRange(ptColorMode),
    [ptColorMode],
  );

  if (!showPeriodicTable) return null;

  /** Handle click: normal click selects, shift+click adds to comparison */
  const handleCellClick = (z: number, shiftKey: boolean) => {
    if (shiftKey) {
      if (comparedElements === null) {
        // First shift+click: start comparison with this element
        setComparedElements([z, z]);
      } else if (comparedElements[0] === z) {
        // Shift+clicking same element: clear comparison
        clearComparedElements();
      } else {
        // Second shift+click: complete the pair
        setComparedElements([comparedElements[0], z]);
      }
    } else {
      setSelectedElement(z);
    }
  };

  // Resolve compared elements to ChemicalElement objects
  const compElA =
    comparedElements !== null ? (elements[comparedElements[0]] ?? null) : null;
  const compElB =
    comparedElements !== null && comparedElements[0] !== comparedElements[1]
      ? (elements[comparedElements[1]] ?? null)
      : null;

  // Find grid position of hovered element for tooltip placement
  let tooltipRow = 0;
  let tooltipCol = 0;
  let tooltipEl: ChemicalElement | null = null;
  if (hoveredElement !== null) {
    outer: for (let r = 0; r < GRID.length; r++) {
      for (let c = 0; c < GRID[r].length; c++) {
        if (GRID[r][c] === hoveredElement) {
          tooltipRow = r;
          tooltipCol = c;
          tooltipEl = elements[hoveredElement] ?? null;
          break outer;
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
        Periodic Table — click to select · shift+click to compare
      </div>

      {/* Color mode selector */}
      <ColorModeSelector
        active={ptColorMode}
        onSelect={setPtColorMode}
        showTrends={showTrends}
        onToggleTrends={toggleTrends}
      />

      {/* Grid container — relative for tooltip and trend positioning */}
      <div
        style={{
          position: 'relative',
          paddingLeft: showTrends ? 16 : 0,
          paddingTop: showTrends ? 18 : 0,
          transition: 'padding 0.15s',
        }}
      >
        {/* Trend annotation overlays */}
        {showTrends && <TrendAnnotations />}

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
                const isCompared =
                  comparedElements !== null &&
                  (comparedElements[0] === z || comparedElements[1] === z);
                return (
                  <ElementCell
                    key={z}
                    el={el}
                    selected={selectedElement === z}
                    compared={isCompared}
                    bgColor={cellBg}
                    onClick={(shiftKey) => handleCellClick(z, shiftKey)}
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

      {/* Element comparison card */}
      {compElA && compElB && (
        <ElementComparison
          elA={compElA}
          elB={compElB}
          onClose={clearComparedElements}
        />
      )}

      {/* Color legend */}
      <ColorLegend mode={ptColorMode} range={propertyRange} />
    </div>
  );
};
