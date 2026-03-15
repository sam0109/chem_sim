// ==============================================================
// SimulationControls — play/pause, temperature, energy display
// ==============================================================

import React from 'react';
import { useSimContextStore } from '../store/SimulationContext';

export const SimulationControls: React.FC = () => {
  const config = useSimContextStore((s) => s.config);
  const setConfig = useSimContextStore((s) => s.setConfig);
  const box = useSimContextStore((s) => s.box);
  const setBox = useSimContextStore((s) => s.setBox);
  const toggleRunning = useSimContextStore((s) => s.toggleRunning);
  const minimize = useSimContextStore((s) => s.minimize);
  const step = useSimContextStore((s) => s.step);
  const energy = useSimContextStore((s) => s.energy);
  const temperature = useSimContextStore((s) => s.temperature);
  const atoms = useSimContextStore((s) => s.atoms);
  const bonds = useSimContextStore((s) => s.bonds);
  const gpuAccelerated = useSimContextStore((s) => s.gpuAccelerated);

  return (
    <div
      data-testid="simulation-controls"
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        background: 'rgba(20, 20, 40, 0.95)',
        borderRadius: 8,
        padding: '12px 16px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        color: '#ddd',
        fontFamily: 'monospace',
        fontSize: 12,
        minWidth: 220,
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
        Simulation
      </div>

      {/* Play/Pause + Minimize */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button
          data-testid="play-pause-button"
          onClick={toggleRunning}
          style={{
            flex: 1,
            padding: '6px 12px',
            borderRadius: 4,
            border: 'none',
            background: config.running ? '#c44e52' : '#4a9c47',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: 'bold',
          }}
        >
          {config.running ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          data-testid="minimize-button"
          onClick={minimize}
          style={{
            flex: 1,
            padding: '6px 12px',
            borderRadius: 4,
            border: 'none',
            background: '#4e7dc4',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          ⚡ Minimize
        </button>
      </div>

      {/* Temperature slider */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <span>Temperature</span>
          <span style={{ color: '#ffaa44' }}>{config.temperature} K</span>
        </div>
        <input
          data-testid="temperature-slider"
          type="range"
          min={0}
          max={1000}
          step={10}
          value={config.temperature}
          onChange={(e) => setConfig({ temperature: Number(e.target.value) })}
          style={{ width: '100%', accentColor: '#ffaa44' }}
        />
      </div>

      {/* Timestep slider */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <span>Timestep</span>
          <span style={{ color: '#88ccff' }}>
            {config.timestep.toFixed(1)} fs
          </span>
        </div>
        <input
          type="range"
          min={0.1}
          max={5.0}
          step={0.1}
          value={config.timestep}
          onChange={(e) => setConfig({ timestep: Number(e.target.value) })}
          style={{ width: '100%', accentColor: '#88ccff' }}
        />
      </div>

      {/* Thermostat select */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 2 }}>Thermostat</div>
        <select
          data-testid="thermostat-select"
          value={config.thermostat}
          onChange={(e) =>
            setConfig({
              thermostat: e.target.value as
                | 'none'
                | 'berendsen'
                | 'nose-hoover',
            })
          }
          style={{
            width: '100%',
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(30,30,50,0.9)',
            color: '#ddd',
            fontFamily: 'monospace',
            fontSize: 11,
          }}
        >
          <option value="none">None (NVE)</option>
          <option value="berendsen">Berendsen</option>
          <option value="nose-hoover">Nos&eacute;-Hoover</option>
        </select>
      </div>

      {/* Periodic Boundary Conditions */}
      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            marginBottom: 4,
          }}
        >
          <input
            data-testid="pbc-toggle"
            type="checkbox"
            checked={box.periodic}
            onChange={(e) => setBox({ periodic: e.target.checked })}
            style={{ accentColor: '#aa88ff' }}
          />
          <span>Periodic Boundaries</span>
        </label>
        {box.periodic && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 2,
              }}
            >
              <span>Box Size</span>
              <span style={{ color: '#aa88ff' }}>
                {box.size[0].toFixed(0)} Å
              </span>
            </div>
            <input
              data-testid="box-size-slider"
              type="range"
              min={10}
              max={100}
              step={5}
              value={box.size[0]}
              onChange={(e) => {
                const s = Number(e.target.value);
                setBox({ size: [s, s, s] });
              }}
              style={{ width: '100%', accentColor: '#aa88ff' }}
            />
            {config.cutoff >= box.size[0] / 2 && (
              <div
                style={{
                  color: '#ff8844',
                  fontSize: 10,
                  marginTop: 2,
                }}
              >
                Warning: cutoff must be {'<'} box/2
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div
        data-testid="stats-grid"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 8,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px 12px',
          fontSize: 11,
        }}
      >
        <span style={{ color: '#888' }}>Step</span>
        <span data-testid="stat-step" style={{ textAlign: 'right' }}>
          {step}
        </span>

        <span style={{ color: '#888' }}>Atoms</span>
        <span data-testid="stat-atoms" style={{ textAlign: 'right' }}>
          {atoms.length}
        </span>

        <span style={{ color: '#888' }}>Bonds</span>
        <span data-testid="stat-bonds" style={{ textAlign: 'right' }}>
          {bonds.length}
        </span>

        <span style={{ color: '#888' }}>Forces</span>
        <span
          data-testid="stat-gpu"
          style={{
            textAlign: 'right',
            color: gpuAccelerated ? '#44ff88' : '#888',
          }}
        >
          {gpuAccelerated ? 'GPU' : 'CPU'}
        </span>

        <span style={{ color: '#888' }}>Temp</span>
        <span
          data-testid="stat-temp"
          style={{ textAlign: 'right', color: '#ffaa44' }}
        >
          {temperature.toFixed(0)} K
        </span>

        <span style={{ color: '#888' }}>KE</span>
        <span
          data-testid="stat-ke"
          style={{ textAlign: 'right', color: '#ff6666' }}
        >
          {energy.kinetic.toFixed(3)} eV
        </span>

        <span style={{ color: '#888' }}>PE</span>
        <span
          data-testid="stat-pe"
          style={{ textAlign: 'right', color: '#66aaff' }}
        >
          {energy.potential.toFixed(3)} eV
        </span>

        <span style={{ color: '#888' }}>Total E</span>
        <span
          data-testid="stat-total-e"
          style={{ textAlign: 'right', color: '#66ff66' }}
        >
          {energy.total.toFixed(3)} eV
        </span>
      </div>
    </div>
  );
};
