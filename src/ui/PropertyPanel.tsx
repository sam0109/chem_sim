// ==============================================================
// PropertyPanel — shows details about selected atom(s) and bonds
// ==============================================================

import React from 'react';
import { useSimContextStore } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';
import { BOND_TYPE_COLORS } from '../data/bondColors';
import { getAvailableOrbitals } from '../data/orbitalData';
import type { OrbitalInfo } from '../data/orbitalData';

export const PropertyPanel: React.FC = () => {
  const showPropertyPanel = useUIStore((s) => s.showPropertyPanel);
  const selectedAtomIds = useUIStore((s) => s.selectedAtomIds);
  const atoms = useSimContextStore((s) => s.atoms);
  const bonds = useSimContextStore((s) => s.bonds);
  const positions = useSimContextStore((s) => s.positions);
  const moleculeIds = useSimContextStore((s) => s.moleculeIds);
  const molecules = useSimContextStore((s) => s.molecules);

  if (!showPropertyPanel || selectedAtomIds.length === 0) return null;

  const selectedAtoms = selectedAtomIds
    .filter((id) => id < atoms.length)
    .map((id) => atoms[id]);

  // Find bonds between selected atoms
  const selectedBonds = bonds.filter(
    (b) =>
      selectedAtomIds.includes(b.atomA) || selectedAtomIds.includes(b.atomB),
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
    <div
      data-testid="property-panel"
      style={{
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
      }}
    >
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: 8,
          fontSize: 13,
          color: '#aaccff',
        }}
      >
        Properties
      </div>

      {selectedAtoms.map((atom, idx) => {
        const el = elements[atom.elementNumber];
        const i = selectedAtomIds[idx];
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
          <div
            key={idx}
            style={{
              marginBottom: 8,
              padding: 6,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: el?.color ?? '#ccc',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              />
              <span style={{ fontWeight: 'bold', fontSize: 14 }}>
                {el?.symbol ?? '?'}{' '}
                <span style={{ color: '#888', fontSize: 11 }}>#{i}</span>
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2px 8px',
                fontSize: 10,
              }}
            >
              <span style={{ color: '#888' }}>Element</span>
              <span>{el?.name ?? 'Unknown'}</span>
              <span style={{ color: '#888' }}>Mass</span>
              <span>{el?.mass.toFixed(3)} amu</span>
              <span style={{ color: '#888' }}>EN</span>
              <span>{el?.electronegativity ?? 'N/A'}</span>
              <span style={{ color: '#888' }}>Charge</span>
              <span>{atom.charge.toFixed(3)} e</span>
              <span style={{ color: '#888' }}>Position</span>
              <span>
                {x.toFixed(2)}, {y.toFixed(2)}, {z.toFixed(2)}
              </span>
              <span style={{ color: '#888' }}>Hybridization</span>
              <span>{atom.hybridization}</span>
              <span style={{ color: '#888' }}>Molecule</span>
              <span>
                {moleculeIds.length > i ? `#${moleculeIds[i]}` : 'N/A'}
              </span>
            </div>
          </div>
        );
      })}

      {distance !== null && (
        <div
          style={{
            padding: 6,
            background: 'rgba(100,180,255,0.1)',
            borderRadius: 4,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ color: '#88ccff' }}>
            Distance: {distance.toFixed(4)} Å
          </span>
        </div>
      )}

      {selectedBonds.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
            Bonds
          </div>
          {selectedBonds.slice(0, 8).map((bond, idx) => (
            <div
              key={idx}
              style={{
                fontSize: 10,
                marginBottom: 2,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {elements[atoms[bond.atomA]?.elementNumber]?.symbol ?? '?'}
              {bond.atomA}
              {bond.order === 2 ? '=' : bond.order === 3 ? '≡' : '—'}
              {elements[atoms[bond.atomB]?.elementNumber]?.symbol ?? '?'}
              {bond.atomB}
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: BOND_TYPE_COLORS[bond.type],
                  marginLeft: 6,
                  flexShrink: 0,
                }}
              />
              <span
                style={{ color: BOND_TYPE_COLORS[bond.type], marginLeft: 4 }}
              >
                ({bond.type})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Molecule info for the first selected atom */}
      {selectedAtomIds.length > 0 &&
        moleculeIds.length > selectedAtomIds[0] &&
        (() => {
          const molId = moleculeIds[selectedAtomIds[0]];
          const mol = molecules.find((m) => m.id === molId);
          if (!mol) return null;
          return (
            <div
              style={{
                marginTop: 8,
                padding: 6,
                background: 'rgba(100,255,180,0.08)',
                borderRadius: 4,
              }}
            >
              <div style={{ fontSize: 11, color: '#88ffaa', marginBottom: 4 }}>
                Molecule #{molId}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '2px 8px',
                  fontSize: 10,
                }}
              >
                <span style={{ color: '#888' }}>Atoms</span>
                <span>{mol.atomIndices.length}</span>
                <span style={{ color: '#888' }}>Total charge</span>
                <span>{mol.totalCharge.toFixed(3)} e</span>
                <span style={{ color: '#888' }}>COM</span>
                <span>
                  {mol.centerOfMass[0].toFixed(2)},{' '}
                  {mol.centerOfMass[1].toFixed(2)},{' '}
                  {mol.centerOfMass[2].toFixed(2)}
                </span>
                <span style={{ color: '#888' }}>Dipole</span>
                <span>{mol.dipoleMagnitude.toFixed(3)} e&middot;A</span>
              </div>
            </div>
          );
        })()}

      {/* Orbital visualization controls */}
      <OrbitalControls atoms={selectedAtoms} />
    </div>
  );
};

// ---- Orbital Controls Sub-component ----

import type { Atom } from '../data/types';

const OrbitalControls: React.FC<{ atoms: Atom[] }> = ({ atoms }) => {
  const showOrbitals = useUIStore((s) => s.showOrbitals);
  const toggleOrbitals = useUIStore((s) => s.toggleOrbitals);
  const selectedOrbital = useUIStore((s) => s.selectedOrbital);
  const setSelectedOrbital = useUIStore((s) => s.setSelectedOrbital);
  const orbitalIsovalue = useUIStore((s) => s.orbitalIsovalue);
  const setOrbitalIsovalue = useUIStore((s) => s.setOrbitalIsovalue);

  if (atoms.length === 0) return null;

  // Get available orbitals from the first selected atom's electron config
  const firstAtom = atoms[0];
  const el = elements[firstAtom.elementNumber];
  const availableOrbitals: OrbitalInfo[] = el
    ? getAvailableOrbitals(el.electronConfig)
    : [];

  // Filter to only show orbitals we can render (l <= 2, i.e., s, p, d)
  const renderableOrbitals = availableOrbitals.filter((o) => o.l <= 2);

  const handleOrbitalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      setSelectedOrbital(null);
      return;
    }
    const orb = renderableOrbitals.find((o) => o.label === val);
    if (orb) {
      setSelectedOrbital({ n: orb.n, l: orb.l, m: orb.m });
    }
  };

  const handleIsovalueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOrbitalIsovalue(parseFloat(e.target.value));
  };

  // Find the label of the currently selected orbital
  const selectedLabel = selectedOrbital
    ? (renderableOrbitals.find(
        (o) =>
          o.n === selectedOrbital.n &&
          o.l === selectedOrbital.l &&
          o.m === selectedOrbital.m,
      )?.label ?? '')
    : '';

  return (
    <div
      style={{
        marginTop: 8,
        padding: 6,
        background: 'rgba(180,100,255,0.08)',
        borderRadius: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        }}
      >
        <input
          type="checkbox"
          checked={showOrbitals}
          onChange={toggleOrbitals}
          style={{ margin: 0, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11, color: '#bb88ff' }}>Orbitals</span>
      </div>

      {showOrbitals && (
        <>
          <div style={{ marginBottom: 4 }}>
            <select
              value={selectedLabel}
              onChange={handleOrbitalChange}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.1)',
                color: '#ddd',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 3,
                padding: '2px 4px',
                fontSize: 10,
                fontFamily: 'monospace',
              }}
            >
              <option value="">-- select orbital --</option>
              {renderableOrbitals.map((orb) => (
                <option key={orb.label} value={orb.label}>
                  {orb.label} ({orb.occupancy}e)
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
            }}
          >
            <span style={{ color: '#888', whiteSpace: 'nowrap' }}>
              Isovalue
            </span>
            <input
              type="range"
              min={0.001}
              max={0.1}
              step={0.001}
              value={orbitalIsovalue}
              onChange={handleIsovalueChange}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <span style={{ color: '#aaa', minWidth: 36, textAlign: 'right' }}>
              {orbitalIsovalue.toFixed(3)}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
