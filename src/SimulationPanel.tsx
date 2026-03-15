// ==============================================================
// SimulationPanel — self-contained simulation viewport
// Encapsulates a Scene + stats overlay + energy plot, each with
// its own SimulationWorker and store instance.
// ==============================================================

import React, { useEffect, useMemo, useState } from 'react';
import type { StoreApi } from 'zustand';
import { useStore } from 'zustand';
import { Scene } from './renderer/Scene';
import { SimulationContext } from './store/SimulationContext';
import {
  createSimulationStoreInstance,
  useSimulationStore,
} from './store/simulationStore';
import type { SimulationStoreState } from './store/simulationStore';
import { EnergyPlot } from './ui/EnergyPlot';
import { PropertyPanel } from './ui/PropertyPanel';
import { exampleMolecules } from './io/examples';

// Shared dropdown styles (matching App header)
const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 10px',
  border: 'none',
  background: 'transparent',
  color: '#ccc',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
  textAlign: 'left',
  borderRadius: 3,
};

interface SimulationPanelProps {
  /** 'primary' uses the global store; 'secondary' creates a new one */
  role: 'primary' | 'secondary';
  /** Label shown at the top of the panel */
  label: string;
}

/**
 * Compact stats overlay for a single panel.
 * Reads from the nearest SimulationContext store.
 */
const PanelStats: React.FC<{ store: StoreApi<SimulationStoreState> }> = ({
  store,
}) => {
  const step = useStore(store, (s) => s.step);
  const energy = useStore(store, (s) => s.energy);
  const temperature = useStore(store, (s) => s.temperature);
  const atoms = useStore(store, (s) => s.atoms);
  const bonds = useStore(store, (s) => s.bonds);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2px 12px',
        fontSize: 10,
        fontFamily: 'monospace',
        color: '#ddd',
      }}
    >
      <span style={{ color: '#888' }}>Step</span>
      <span style={{ textAlign: 'right' }}>{step}</span>
      <span style={{ color: '#888' }}>Atoms</span>
      <span style={{ textAlign: 'right' }}>{atoms.length}</span>
      <span style={{ color: '#888' }}>Bonds</span>
      <span style={{ textAlign: 'right' }}>{bonds.length}</span>
      <span style={{ color: '#888' }}>Temp</span>
      <span style={{ textAlign: 'right', color: '#ffaa44' }}>
        {temperature.toFixed(0)} K
      </span>
      <span style={{ color: '#888' }}>KE</span>
      <span style={{ textAlign: 'right', color: '#ff6666' }}>
        {energy.kinetic.toFixed(3)} eV
      </span>
      <span style={{ color: '#888' }}>PE</span>
      <span style={{ textAlign: 'right', color: '#66aaff' }}>
        {energy.potential.toFixed(3)} eV
      </span>
      <span style={{ color: '#888' }}>Total</span>
      <span style={{ textAlign: 'right', color: '#66ff66' }}>
        {energy.total.toFixed(3)} eV
      </span>
    </div>
  );
};

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  role,
  label,
}) => {
  const [loading, setLoading] = useState(role === 'secondary');
  const [showMoleculeMenu, setShowMoleculeMenu] = useState(false);

  // Primary reuses the global store; secondary gets a fresh instance
  const store = useMemo<StoreApi<SimulationStoreState>>(() => {
    if (role === 'primary') {
      return useSimulationStore as unknown as StoreApi<SimulationStoreState>;
    }
    return createSimulationStoreInstance();
  }, [role]);

  // Initialize the secondary worker + default molecule
  useEffect(() => {
    if (role !== 'secondary') return;
    let cancelled = false;
    (async () => {
      await store.getState().initWorker();
      if (cancelled) return;
      // Default: load H₂S for comparison with the default H₂O
      const atoms = exampleMolecules['Water (H₂O)']();
      store.getState().initSimulation(atoms);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      // Terminate the secondary worker on cleanup
      store.getState().worker?.terminate();
    };
  }, [role, store]);

  const handleLoadMolecule = (name: string) => {
    const factory = exampleMolecules[name as keyof typeof exampleMolecules];
    if (factory) {
      store.getState().initSimulation(factory());
      setShowMoleculeMenu(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          color: '#aaccff',
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      >
        Initializing {label}...
      </div>
    );
  }

  return (
    <SimulationContext.Provider value={store}>
      <div
        data-testid={`simulation-panel-${role}`}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          borderRight:
            role === 'primary' ? '1px solid rgba(255,255,255,0.15)' : undefined,
        }}
      >
        {/* 3D viewport */}
        <Scene />

        {/* Panel label + molecule selector */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              background: 'rgba(20,20,40,0.9)',
              padding: '4px 12px',
              borderRadius: 4,
              color: '#aaccff',
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: 'bold',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {label}
          </span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMoleculeMenu(!showMoleculeMenu)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(30,30,50,0.9)',
                color: '#ccc',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: 10,
              }}
            >
              Molecule
            </button>
            {showMoleculeMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: 'rgba(20,20,40,0.98)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: 4,
                  zIndex: 200,
                  minWidth: 160,
                }}
              >
                {Object.keys(exampleMolecules).map((name) => (
                  <button
                    key={name}
                    onClick={() => handleLoadMolecule(name)}
                    style={dropdownItemStyle}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        'rgba(100,150,255,0.2)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Compact stats overlay */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(20,20,40,0.95)',
            borderRadius: 8,
            padding: '8px 12px',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 100,
          }}
        >
          <PanelStats store={store} />
        </div>

        {/* Per-panel components provided via context */}
        <PropertyPanel />
        <EnergyPlot />
      </div>
    </SimulationContext.Provider>
  );
};
