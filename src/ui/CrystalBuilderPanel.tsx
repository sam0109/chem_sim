// ==============================================================
// CrystalBuilderPanel — UI for generating crystal lattices
// ==============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';
import { useSimContextStore } from '../store/SimulationContext';
import {
  crystalStructures,
  crystalPresets,
  type CrystalStructureType,
} from '../data/crystals';
import {
  generateCrystalAtoms,
  computeSupercellSize,
} from '../data/crystalBuilder';
import { getElement } from '../data/elements';

const structureTypes = Object.keys(crystalStructures) as CrystalStructureType[];

/** Panel style matching other UI panels in the app */
const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 50,
  left: 60,
  background: 'rgba(20, 20, 40, 0.95)',
  borderRadius: 8,
  padding: '12px 16px',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(10px)',
  color: '#ddd',
  fontFamily: 'monospace',
  fontSize: 12,
  minWidth: 280,
  maxWidth: 320,
  maxHeight: 'calc(100vh - 120px)',
  overflowY: 'auto',
  zIndex: 150,
};

const labelStyle: React.CSSProperties = {
  color: '#888',
  fontSize: 11,
  marginBottom: 2,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(30,30,50,0.9)',
  color: '#ddd',
  fontFamily: 'monospace',
  fontSize: 11,
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 4,
  border: 'none',
  background: '#4a9c47',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 12,
  fontWeight: 'bold',
};

export const CrystalBuilderPanel: React.FC = () => {
  const showCrystalBuilder = useUIStore((s) => s.showCrystalBuilder);
  const initSimulation = useSimContextStore((s) => s.initSimulation);
  const setBox = useSimContextStore((s) => s.setBox);

  // Form state
  const [structureType, setStructureType] =
    useState<CrystalStructureType>('fcc');
  const [elementA, setElementA] = useState(29); // Cu
  const [elementB, setElementB] = useState(17); // Cl
  const [latticeConstant, setLatticeConstant] = useState(3.615);
  const [nx, setNx] = useState(2);
  const [ny, setNy] = useState(2);
  const [nz, setNz] = useState(2);
  const [chargeA, setChargeA] = useState(0);
  const [chargeB, setChargeB] = useState(0);
  const [enablePBC, setEnablePBC] = useState(false);

  const structure = crystalStructures[structureType];
  const isBinary = structure.elementSlots === 2;

  // Available presets for current structure type
  const filteredPresets = useMemo(
    () => crystalPresets.filter((p) => p.structureType === structureType),
    [structureType],
  );

  // Atom count preview
  const atomCount = useMemo(
    () => structure.basis.length * nx * ny * nz,
    [structure, nx, ny, nz],
  );

  // Supercell size preview
  const supercellSize = useMemo(
    () => computeSupercellSize(structureType, latticeConstant, nx, ny, nz),
    [structureType, latticeConstant, nx, ny, nz],
  );

  // Apply a preset
  const applyPreset = useCallback((presetName: string) => {
    const preset = crystalPresets.find((p) => p.name === presetName);
    if (!preset) return;
    setStructureType(preset.structureType);
    setElementA(preset.elementA);
    if (preset.elementB !== undefined) setElementB(preset.elementB);
    setLatticeConstant(preset.latticeConstant);
    setChargeA(preset.chargeA ?? 0);
    setChargeB(preset.chargeB ?? 0);
  }, []);

  // Handle structure type change — apply first matching preset
  const handleStructureTypeChange = useCallback(
    (type: CrystalStructureType) => {
      setStructureType(type);
      const firstPreset = crystalPresets.find((p) => p.structureType === type);
      if (firstPreset) {
        setElementA(firstPreset.elementA);
        if (firstPreset.elementB !== undefined)
          setElementB(firstPreset.elementB);
        setLatticeConstant(firstPreset.latticeConstant);
        setChargeA(firstPreset.chargeA ?? 0);
        setChargeB(firstPreset.chargeB ?? 0);
      }
    },
    [],
  );

  // Build crystal
  const handleBuild = useCallback(() => {
    const atoms = generateCrystalAtoms({
      structureType,
      elementA,
      elementB: isBinary ? elementB : undefined,
      latticeConstant,
      nx,
      ny,
      nz,
      chargeA: isBinary ? chargeA : 0,
      chargeB: isBinary ? chargeB : 0,
    });

    initSimulation(atoms);

    if (enablePBC) {
      const size = computeSupercellSize(
        structureType,
        latticeConstant,
        nx,
        ny,
        nz,
      );
      // Use the max dimension for a cubic box (simplest PBC approach)
      const maxDim = Math.max(size[0], size[1], size[2]);
      setBox({ periodic: true, size: [maxDim, maxDim, maxDim] });
    }
  }, [
    structureType,
    elementA,
    elementB,
    isBinary,
    latticeConstant,
    nx,
    ny,
    nz,
    chargeA,
    chargeB,
    enablePBC,
    initSimulation,
    setBox,
  ]);

  if (!showCrystalBuilder) return null;

  const elementAName = getElement(elementA)?.symbol ?? '?';
  const elementBName = getElement(elementB)?.symbol ?? '?';

  return (
    <div data-testid="crystal-builder-panel" style={panelStyle}>
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: 10,
          fontSize: 13,
          color: '#aaccff',
        }}
      >
        Crystal Builder
      </div>

      {/* Structure type */}
      <div style={{ marginBottom: 8 }}>
        <div style={labelStyle}>Structure Type</div>
        <select
          data-testid="crystal-structure-select"
          value={structureType}
          onChange={(e) =>
            handleStructureTypeChange(e.target.value as CrystalStructureType)
          }
          style={selectStyle}
        >
          {structureTypes.map((type) => (
            <option key={type} value={type}>
              {crystalStructures[type].name}
            </option>
          ))}
        </select>
        <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>
          {structure.description}
        </div>
      </div>

      {/* Preset selector */}
      {filteredPresets.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={labelStyle}>Preset</div>
          <select
            data-testid="crystal-preset-select"
            onChange={(e) => applyPreset(e.target.value)}
            style={selectStyle}
          >
            <option value="">— Select preset —</option>
            {filteredPresets.map((preset) => (
              <option key={preset.name} value={preset.name}>
                {preset.name} (a = {preset.latticeConstant} Å)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Element A */}
      <div style={{ marginBottom: 8 }}>
        <div style={labelStyle}>
          {isBinary ? 'Element A (cation)' : 'Element'}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            data-testid="crystal-element-a"
            type="number"
            min={1}
            max={86}
            value={elementA}
            onChange={(e) => setElementA(Number(e.target.value))}
            style={{ ...inputStyle, width: 60 }}
          />
          <span style={{ color: '#aaccff' }}>{elementAName}</span>
        </div>
      </div>

      {/* Element B (binary structures only) */}
      {isBinary && (
        <div style={{ marginBottom: 8 }}>
          <div style={labelStyle}>Element B (anion)</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              data-testid="crystal-element-b"
              type="number"
              min={1}
              max={86}
              value={elementB}
              onChange={(e) => setElementB(Number(e.target.value))}
              style={{ ...inputStyle, width: 60 }}
            />
            <span style={{ color: '#aaccff' }}>{elementBName}</span>
          </div>
        </div>
      )}

      {/* Ionic charges (binary structures only) */}
      {isBinary && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Charge A</div>
            <input
              data-testid="crystal-charge-a"
              type="number"
              step={0.5}
              value={chargeA}
              onChange={(e) => setChargeA(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Charge B</div>
            <input
              data-testid="crystal-charge-b"
              type="number"
              step={0.5}
              value={chargeB}
              onChange={(e) => setChargeB(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* Lattice constant */}
      <div style={{ marginBottom: 8 }}>
        <div style={labelStyle}>Lattice Constant (Å)</div>
        <input
          data-testid="crystal-lattice-constant"
          type="number"
          min={1}
          max={20}
          step={0.001}
          value={latticeConstant}
          onChange={(e) => setLatticeConstant(Number(e.target.value))}
          style={inputStyle}
        />
      </div>

      {/* Supercell dimensions */}
      <div style={{ marginBottom: 8 }}>
        <div style={labelStyle}>Supercell (Nx × Ny × Nz)</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: 'Nx', value: nx, set: setNx },
            { label: 'Ny', value: ny, set: setNy },
            { label: 'Nz', value: nz, set: setNz },
          ].map(({ label, value, set }) => (
            <div key={label} style={{ flex: 1 }}>
              <input
                data-testid={`crystal-${label.toLowerCase()}`}
                type="number"
                min={1}
                max={5}
                value={value}
                onChange={(e) =>
                  set(Math.max(1, Math.min(5, Number(e.target.value))))
                }
                style={{ ...inputStyle, textAlign: 'center' }}
              />
              <div style={{ textAlign: 'center', color: '#666', fontSize: 9 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PBC option */}
      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <input
            data-testid="crystal-pbc-toggle"
            type="checkbox"
            checked={enablePBC}
            onChange={(e) => setEnablePBC(e.target.checked)}
            style={{ accentColor: '#aa88ff' }}
          />
          <span>Enable PBC (match box to supercell)</span>
        </label>
      </div>

      {/* Preview info */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 8,
          marginBottom: 10,
          fontSize: 11,
          color: '#888',
        }}
      >
        <div>
          Atoms: <span style={{ color: '#aaccff' }}>{atomCount}</span>
        </div>
        <div>
          Size:{' '}
          <span style={{ color: '#aaccff' }}>
            {supercellSize[0].toFixed(1)} × {supercellSize[1].toFixed(1)} ×{' '}
            {supercellSize[2].toFixed(1)} Å
          </span>
        </div>
        {atomCount > 500 && (
          <div style={{ color: '#ff8844', marginTop: 4 }}>
            Warning: {atomCount} atoms may be slow with O(N²) forces
          </div>
        )}
      </div>

      {/* Build button */}
      <button
        data-testid="crystal-build-button"
        onClick={handleBuild}
        style={buttonStyle}
      >
        Build Crystal
      </button>
    </div>
  );
};
