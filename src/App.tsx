// ==============================================================
// App — main application shell
// ==============================================================

import { useEffect, useState, useCallback } from 'react';
import { Scene } from './renderer/Scene';
import { PeriodicTable } from './ui/PeriodicTable';
import { SimulationControls } from './ui/SimulationControls';
import { PropertyPanel } from './ui/PropertyPanel';
import { Toolbar } from './ui/Toolbar';
import { EnergyPlot } from './ui/EnergyPlot';
import { ChallengePanel } from './ui/ChallengePanel';
import { useSimulationStore } from './store/simulationStore';
import { SimulationContext } from './store/SimulationContext';
import { useUIStore } from './store/uiStore';
import { exampleMolecules } from './io/examples';
import { parseXYZ } from './io/xyz';
import {
  stateToUrlParam,
  urlParamToState,
  saveToFile,
  loadFromFile,
  deserializeState,
} from './io/chemsimFile';
import type { SerializeInput } from './io/chemsimFile';

/** Read current simulation + UI state into a SerializeInput snapshot */
function getSerializeInput(): SerializeInput {
  const sim = useSimulationStore.getState();
  const ui = useUIStore.getState();
  return {
    atoms: sim.atoms,
    bonds: sim.bonds,
    config: sim.config,
    box: sim.box,
    ui: {
      renderMode: ui.renderMode,
      showLabels: ui.showLabels,
      colorMode: ui.colorMode,
    },
  };
}

// Shared button style used across the header bar
const headerButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(30, 30, 50, 0.9)',
  color: '#ccc',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
  backdropFilter: 'blur(10px)',
};

// Shared style for items in dropdown menus (examples, share, etc.)
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

const dropdownContainerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  marginTop: 4,
  background: 'rgba(20, 20, 40, 0.98)',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)',
  padding: 4,
  zIndex: 200,
};

/** Hover handlers for dropdown items */
const onItemHover = (e: React.MouseEvent<HTMLButtonElement>) =>
  (e.currentTarget.style.background = 'rgba(100,150,255,0.2)');
const onItemLeave = (e: React.MouseEvent<HTMLButtonElement>) =>
  (e.currentTarget.style.background = 'transparent');

const App: React.FC = () => {
  const initWorker = useSimulationStore((s) => s.initWorker);
  const initSimulation = useSimulationStore((s) => s.initSimulation);
  const setConfig = useSimulationStore((s) => s.setConfig);
  const setRenderMode = useUIStore((s) => s.setRenderMode);
  const setColorMode = useUIStore((s) => s.setColorMode);
  const [loading, setLoading] = useState(true);
  const [showExamples, setShowExamples] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  /** Apply a deserialized .chemsim state to both stores */
  const applyChemSimState = useCallback(
    (file: ReturnType<typeof deserializeState>) => {
      initSimulation(file.atoms, file.bonds);
      setConfig({
        timestep: file.config.timestep,
        temperature: file.config.temperature,
        thermostat: file.config.thermostat,
        thermostatTau: file.config.thermostatTau,
        cutoff: file.config.cutoff,
      });
      setRenderMode(file.ui.renderMode);
      // Set showLabels directly to avoid read-then-toggle race
      useUIStore.setState({ showLabels: file.ui.showLabels });
      setColorMode(file.ui.colorMode);
    },
    [initSimulation, setConfig, setRenderMode, setColorMode],
  );

  // Initialization: check URL for shared state, otherwise load default
  useEffect(() => {
    (async () => {
      await initWorker();

      // Check for ?scene= URL parameter with shared state
      const params = new URLSearchParams(window.location.search);
      const sceneParam = params.get('scene');

      if (sceneParam) {
        try {
          const validated = await urlParamToState(sceneParam);
          const state = deserializeState(validated);
          applyChemSimState(state);

          // Clean up the URL without reloading
          const url = new URL(window.location.href);
          url.searchParams.delete('scene');
          window.history.replaceState({}, '', url.toString());
        } catch {
          // If URL decode fails, fall back to default molecule
          const atoms = exampleMolecules['Water (H₂O)']();
          initSimulation(atoms);
        }
      } else {
        const atoms = exampleMolecules['Water (H₂O)']();
        initSimulation(atoms);
      }

      setLoading(false);
    })();
  }, [initWorker, initSimulation, applyChemSimState]);

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
    input.accept = '.xyz,.chemsim';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.name.endsWith('.chemsim')) {
        try {
          const validated = await loadFromFile(file);
          const state = deserializeState(validated);
          applyChemSimState(state);
        } catch (err) {
          // Silently ignore invalid files for now
          // (a toast notification could be added in a follow-up)
          void err;
        }
      } else if (file.name.endsWith('.xyz')) {
        const text = await file.text();
        const atoms = parseXYZ(text);
        if (atoms.length > 0) {
          initSimulation(atoms);
        }
      }
    };
    input.click();
  };

  const handleCopyLink = async () => {
    try {
      const param = await stateToUrlParam(getSerializeInput());
      const url = new URL(window.location.href);
      url.searchParams.set('scene', param);

      await navigator.clipboard.writeText(url.toString());
      setCopyFeedback(true);
      setShowShareMenu(false);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Clipboard write may fail in some contexts — ignore gracefully
    }
  };

  const handleSaveFile = () => {
    saveToFile(getSerializeInput());
    setShowShareMenu(false);
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
    <SimulationContext.Provider value={useSimulationStore}>
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
            {/* Examples dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                data-testid="examples-button"
                onClick={() => setShowExamples(!showExamples)}
                style={headerButtonStyle}
              >
                Examples
              </button>
              {showExamples && (
                <div
                  data-testid="examples-dropdown"
                  style={{ ...dropdownContainerStyle, left: 0, minWidth: 180 }}
                >
                  {Object.keys(exampleMolecules).map((name) => (
                    <button
                      key={name}
                      data-testid={`example-${name}`}
                      onClick={() => handleLoadExample(name)}
                      style={dropdownItemStyle}
                      onMouseEnter={onItemHover}
                      onMouseLeave={onItemLeave}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Import button (supports .xyz and .chemsim) */}
            <button
              data-testid="import-button"
              onClick={handleFileImport}
              style={headerButtonStyle}
            >
              Import
            </button>

            {/* Share dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                data-testid="share-button"
                onClick={() => setShowShareMenu(!showShareMenu)}
                style={headerButtonStyle}
              >
                {copyFeedback ? 'Copied!' : 'Share'}
              </button>
              {showShareMenu && (
                <div
                  data-testid="share-dropdown"
                  style={{ ...dropdownContainerStyle, right: 0, minWidth: 160 }}
                >
                  <button
                    data-testid="copy-link-button"
                    onClick={handleCopyLink}
                    style={dropdownItemStyle}
                    onMouseEnter={onItemHover}
                    onMouseLeave={onItemLeave}
                  >
                    Copy Link
                  </button>
                  <button
                    data-testid="save-chemsim-button"
                    onClick={handleSaveFile}
                    style={dropdownItemStyle}
                    onMouseEnter={onItemHover}
                    onMouseLeave={onItemLeave}
                  >
                    Save .chemsim
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <Toolbar />
        <SimulationControls />
        <PropertyPanel />
        <PeriodicTable />
        <EnergyPlot />
        <ChallengePanel />

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
    </SimulationContext.Provider>
  );
};

export default App;
