// ==============================================================
// App — main application shell
// ==============================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { StoreApi } from 'zustand';
import { Scene } from './renderer/Scene';
import { PeriodicTable } from './ui/PeriodicTable';
import { SimulationControls } from './ui/SimulationControls';
import { PropertyPanel } from './ui/PropertyPanel';
import { Toolbar } from './ui/Toolbar';
import { EnergyPlot } from './ui/EnergyPlot';
import { ChallengePanel } from './ui/ChallengePanel';
import { SimulationPanel } from './SimulationPanel';
import { ComparisonTable } from './ui/ComparisonTable';
import { EncounterPanel } from './ui/EncounterPanel';
import {
  useSimulationStore,
  createSimulationStoreInstance,
  getGlobalSimulationStore,
} from './store/simulationStore';
import type { SimulationStoreState } from './store/simulationStore';
import { SimulationContext } from './store/SimulationContext';
import { ReactionLog } from './ui/ReactionLog';
import { QuantityDashboard } from './ui/QuantityDashboard';
import { useUIStore } from './store/uiStore';
import { exampleMolecules } from './io/examples';
import { parseXYZ } from './io/xyz';
import { parseSMILES } from './io/smiles';
import {
  stateToUrlParam,
  urlParamToState,
  saveToFile,
  loadFromFile,
  deserializeState,
} from './io/chemsimFile';
import type { SerializeInput } from './io/chemsimFile';
import { registerMoleculeTemplates } from './data/moleculeTemplates';

// Register molecule templates so the encounter panel (in the UI layer)
// can access them via the data-layer registry without importing io directly
registerMoleculeTemplates(exampleMolecules);

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

/**
 * Shared controls bar for comparison mode — dispatches config changes
 * to both the primary store (via context) and the secondary store (via prop).
 */
const SharedControlsBar: React.FC<{
  secondaryStore: StoreApi<SimulationStoreState> | null;
}> = ({ secondaryStore }) => {
  const config = useSimulationStore((s) => s.config);

  const setConfigBoth = (
    partial: Partial<import('./data/types').SimulationConfig>,
  ) => {
    useSimulationStore.getState().setConfig(partial);
    secondaryStore?.getState().setConfig(partial);
  };

  const toggleBothRunning = () => {
    const running = !config.running;
    setConfigBoth({ running });
  };

  const minimizeBoth = () => {
    useSimulationStore.getState().minimize();
    secondaryStore?.getState().minimize();
  };

  return (
    <div
      data-testid="shared-controls"
      style={{
        flexShrink: 0,
        background: 'rgba(10,10,25,0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        zIndex: 100,
        gap: 16,
        padding: '6px 60px',
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#ddd',
      }}
    >
      {/* Play/Pause */}
      <button
        data-testid="play-pause-button"
        onClick={toggleBothRunning}
        style={{
          padding: '4px 14px',
          borderRadius: 4,
          border: 'none',
          background: config.running ? '#c44e52' : '#4a9c47',
          color: '#fff',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 'bold',
        }}
      >
        {config.running ? '⏸ Pause' : '▶ Play'}
      </button>

      {/* Minimize */}
      <button
        onClick={minimizeBoth}
        style={{
          padding: '4px 14px',
          borderRadius: 4,
          border: 'none',
          background: '#4e7dc4',
          color: '#fff',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: 11,
        }}
      >
        Minimize
      </button>

      {/* Temperature */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#888' }}>Temp</span>
        <input
          data-testid="temperature-slider"
          type="range"
          min={0}
          max={1000}
          step={10}
          value={config.temperature}
          onChange={(e) =>
            setConfigBoth({ temperature: Number(e.target.value) })
          }
          style={{ width: 100, accentColor: '#ffaa44' }}
        />
        <span style={{ color: '#ffaa44', minWidth: 48 }}>
          {config.temperature} K
        </span>
      </div>

      {/* Timestep */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#888' }}>dt</span>
        <input
          type="range"
          min={0.1}
          max={5.0}
          step={0.1}
          value={config.timestep}
          onChange={(e) => setConfigBoth({ timestep: Number(e.target.value) })}
          style={{ width: 80, accentColor: '#88ccff' }}
        />
        <span style={{ color: '#88ccff', minWidth: 40 }}>
          {config.timestep.toFixed(1)} fs
        </span>
      </div>

      {/* Thermostat */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#888' }}>Thermo</span>
        <select
          data-testid="thermostat-select"
          value={config.thermostat}
          onChange={(e) =>
            setConfigBoth({
              thermostat: e.target.value as
                | 'none'
                | 'berendsen'
                | 'nose-hoover',
            })
          }
          style={{
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(30,30,50,0.9)',
            color: '#ddd',
            fontFamily: 'monospace',
            fontSize: 10,
          }}
        >
          <option value="none">NVE</option>
          <option value="berendsen">Berendsen</option>
        </select>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const initWorker = useSimulationStore((s) => s.initWorker);
  const initSimulation = useSimulationStore((s) => s.initSimulation);
  const setConfig = useSimulationStore((s) => s.setConfig);
  const setRenderMode = useUIStore((s) => s.setRenderMode);
  const setColorMode = useUIStore((s) => s.setColorMode);
  const comparisonMode = useUIStore((s) => s.comparisonMode);
  const [loading, setLoading] = useState(true);
  const [showExamples, setShowExamples] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showSmilesInput, setShowSmilesInput] = useState(false);
  const [smilesValue, setSmilesValue] = useState('');
  const [smilesError, setSmilesError] = useState<string | null>(null);

  // Secondary simulation store for comparison mode.
  // Created once when comparison mode is first activated, then persists.
  // useMemo ensures the store instance is stable across re-renders.
  const activeSecondaryStore = useMemo(
    () => (comparisonMode ? createSimulationStoreInstance() : null),

    [comparisonMode],
  );

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

  const handleSmilesLoad = () => {
    const trimmed = smilesValue.trim();
    if (!trimmed) return;
    try {
      const atoms = parseSMILES(trimmed);
      initSimulation(atoms);
      setSmilesError(null);
      setShowSmilesInput(false);
      setSmilesValue('');
    } catch (err) {
      setSmilesError(
        err instanceof Error ? err.message : 'Invalid SMILES string',
      );
    }
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

  // ---- Comparison mode: two panels side-by-side ----
  if (comparisonMode) {
    const primaryStore = getGlobalSimulationStore();

    return (
      <div
        data-testid="app-container"
        style={{
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Shared controls bar — uses primary store via context */}
        <SimulationContext.Provider value={primaryStore}>
          <SharedControlsBar secondaryStore={activeSecondaryStore} />
        </SimulationContext.Provider>

        {/* Two simulation panels side-by-side */}
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          <SimulationPanel role="primary" label="Panel A" />
          <SimulationPanel
            role="secondary"
            label="Panel B"
            externalStore={activeSecondaryStore ?? undefined}
          />

          {/* Comparison table at bottom center */}
          {activeSecondaryStore && (
            <ComparisonTable
              leftStore={primaryStore}
              rightStore={activeSecondaryStore}
            />
          )}
        </div>

        {/* Shared UI overlays */}
        <Toolbar />
        <PeriodicTable />

        {/* Status bar */}
        <div
          data-testid="status-bar"
          style={{
            height: 22,
            flexShrink: 0,
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
          <span>ChemSim — Side-by-Side Comparison Mode</span>
          <span>Press S/A/D/G/M for tools | L toggle labels</span>
        </div>
      </div>
    );
  }

  // ---- Single-panel mode (default) ----
  return (
    <SimulationContext.Provider value={getGlobalSimulationStore()}>
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

            {/* SMILES input */}
            <div style={{ position: 'relative' }}>
              <button
                data-testid="smiles-button"
                onClick={() => {
                  setShowSmilesInput(!showSmilesInput);
                  setSmilesError(null);
                }}
                style={headerButtonStyle}
              >
                SMILES
              </button>
              {showSmilesInput && (
                <div
                  data-testid="smiles-popover"
                  style={{
                    ...dropdownContainerStyle,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    minWidth: 260,
                    padding: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      alignItems: 'center',
                    }}
                  >
                    <input
                      data-testid="smiles-input"
                      type="text"
                      value={smilesValue}
                      onChange={(e) => {
                        setSmilesValue(e.target.value);
                        setSmilesError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSmilesLoad();
                        if (e.key === 'Escape') setShowSmilesInput(false);
                      }}
                      placeholder="e.g. CCO, c1ccccc1"
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        borderRadius: 3,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(10, 10, 30, 0.9)',
                        color: '#eee',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        outline: 'none',
                      }}
                    />
                    <button
                      data-testid="smiles-load-button"
                      onClick={handleSmilesLoad}
                      style={{
                        ...headerButtonStyle,
                        padding: '4px 8px',
                        background: 'rgba(60, 120, 200, 0.7)',
                      }}
                    >
                      Load
                    </button>
                  </div>
                  {smilesError && (
                    <div
                      data-testid="smiles-error"
                      style={{
                        marginTop: 4,
                        color: '#f88',
                        fontSize: 10,
                        fontFamily: 'monospace',
                      }}
                    >
                      {smilesError}
                    </div>
                  )}
                </div>
              )}
            </div>

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
        <EncounterPanel />
        <ReactionLog />
        <QuantityDashboard />

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
