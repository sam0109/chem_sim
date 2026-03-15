// ==============================================================
// App — main application shell
// ==============================================================

import { useEffect, useState } from 'react';
import { Scene } from './renderer/Scene';
import { PeriodicTable } from './ui/PeriodicTable';
import { SimulationControls } from './ui/SimulationControls';
import { PropertyPanel } from './ui/PropertyPanel';
import { Toolbar } from './ui/Toolbar';
import { EnergyPlot } from './ui/EnergyPlot';
import { useSimulationStore } from './store/simulationStore';
import { exampleMolecules } from './io/examples';
import { parseXYZ } from './io/xyz';

const App: React.FC = () => {
  const initWorker = useSimulationStore((s) => s.initWorker);
  const initSimulation = useSimulationStore((s) => s.initSimulation);
  const [loading, setLoading] = useState(true);
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    (async () => {
      await initWorker();
      const atoms = exampleMolecules['Water (H₂O)']();
      initSimulation(atoms);
      setLoading(false);
    })();
  }, [initWorker, initSimulation]);

  const handleLoadExample = (name: string) => {
    const factory = exampleMolecules[name as keyof typeof exampleMolecules];
    if (factory) {
      initSimulation(factory());
      setShowExamples(false);
    }
  };

  const handleFileImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xyz';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      if (file.name.endsWith('.xyz')) {
        const atoms = parseXYZ(text);
        if (atoms.length > 0) {
          initSimulation(atoms);
        }
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div
        data-testid="loading-screen"
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          color: '#aaccff',
          fontFamily: 'monospace',
          fontSize: 16,
        }}
      >
        Initializing simulation engine...
      </div>
    );
  }

  return (
    <div
      data-testid="app-container"
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Scene />

      {/* Header bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 60,
          right: 240,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 100,
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          <div style={{ position: 'relative' }}>
            <button
              data-testid="examples-button"
              onClick={() => setShowExamples(!showExamples)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(30, 30, 50, 0.9)',
                color: '#ccc',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: 11,
                backdropFilter: 'blur(10px)',
              }}
            >
              📦 Examples
            </button>
            {showExamples && (
              <div
                data-testid="examples-dropdown"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: 'rgba(20, 20, 40, 0.98)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: 4,
                  minWidth: 180,
                  zIndex: 200,
                }}
              >
                {Object.keys(exampleMolecules).map((name) => (
                  <button
                    key={name}
                    data-testid={`example-${name}`}
                    onClick={() => handleLoadExample(name)}
                    style={{
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
                    }}
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
          <button
            data-testid="import-xyz-button"
            onClick={handleFileImport}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(30, 30, 50, 0.9)',
              color: '#ccc',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 11,
              backdropFilter: 'blur(10px)',
            }}
          >
            📂 Import XYZ
          </button>
        </div>
      </div>

      <Toolbar />
      <SimulationControls />
      <PropertyPanel />
      <PeriodicTable />
      <EnergyPlot />

      <div
        data-testid="status-bar"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 22,
          background: 'rgba(10, 10, 25, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          color: '#666',
          fontFamily: 'monospace',
          fontSize: 10,
          zIndex: 50,
        }}
      >
        <span>ChemSim — Interactive Chemistry Bonding Simulator</span>
        <span>Press S/A/D/G/M for tools | L toggle labels</span>
      </div>
    </div>
  );
};

export default App;
