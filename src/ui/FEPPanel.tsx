// ==============================================================
// FEPPanel — controls for Free Energy Perturbation calculations
//
// Allows the user to:
// 1. Select alchemical atoms and their target elements
// 2. Configure λ schedule and sampling parameters
// 3. Run FEP/TI scans and view results
// ==============================================================

import React, { useState, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';
import { useSimContextStore } from '../store/SimulationContext';
import type { AlchemicalAtom, FEPConfig } from '../data/types';
import { DEFAULT_FEP_CONFIG } from '../data/types';
import elements from '../data/elements';

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 300,
  maxHeight: 'calc(100vh - 20px)',
  overflowY: 'auto',
  background: 'rgba(20, 20, 35, 0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: 12,
  color: '#eee',
  fontSize: 12,
  zIndex: 200,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: 8,
  background: 'rgba(255,255,255,0.03)',
  borderRadius: 6,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  color: '#aaa',
  fontSize: 11,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4,
  color: '#eee',
  fontSize: 12,
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(60,100,200,0.4)',
  color: '#eee',
  cursor: 'pointer',
  fontSize: 12,
  width: '100%',
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(200,60,60,0.4)',
};

const resultStyle: React.CSSProperties = {
  padding: 8,
  background: 'rgba(40,120,40,0.15)',
  borderRadius: 6,
  border: '1px solid rgba(40,120,40,0.3)',
  marginBottom: 10,
};

const progressBarOuter: React.CSSProperties = {
  width: '100%',
  height: 6,
  background: 'rgba(255,255,255,0.1)',
  borderRadius: 3,
  marginTop: 4,
  marginBottom: 4,
};

export function FEPPanel(): React.ReactElement | null {
  const showFEPPanel = useUIStore((s) => s.showFEPPanel);
  const toggleFEPPanel = useUIStore((s) => s.toggleFEPPanel);

  const store = useSimContextStore();
  const atoms = store((s) => s.atoms);
  const selectedAtomIds = useUIStore((s) => s.selectedAtomIds);

  const fepConfig = store((s) => s.fepConfig);
  const fepResult = store((s) => s.fepResult);
  const fepProgress = store((s) => s.fepProgress);
  const fepRunning = store((s) => s.fepRunning);
  const configureFEP = store((s) => s.configureFEP);
  const startFEPScan = store((s) => s.startFEPScan);
  const cancelFEP = store((s) => s.cancelFEP);
  const clearFEPResult = store((s) => s.clearFEPResult);

  // Local state for the target element number
  const [targetElement, setTargetElement] = useState(2); // default: He
  const [nWindows, setNWindows] = useState(11);
  const [eqSteps, setEqSteps] = useState(DEFAULT_FEP_CONFIG.equilibrationSteps);
  const [prodSteps, setProdSteps] = useState(
    DEFAULT_FEP_CONFIG.productionSteps,
  );

  const handleAddAlchemicalAtom = useCallback(() => {
    if (selectedAtomIds.length === 0) return;

    const newAlchemical: AlchemicalAtom[] = [...fepConfig.alchemicalAtoms];
    for (const atomId of selectedAtomIds) {
      // Find the atom's current properties
      const atom = atoms.find((a) => a.id === atomId);
      if (!atom) continue;

      // Skip if already alchemical
      if (newAlchemical.some((aa) => aa.atomIndex === atomId)) continue;

      newAlchemical.push({
        atomIndex: atomId,
        stateA: {
          elementNumber: atom.elementNumber,
          charge: atom.charge,
          hybridization: atom.hybridization,
        },
        stateB: {
          elementNumber: targetElement,
          charge: 0, // Will be recomputed by Gasteiger
          hybridization: 'sp3', // Default, will be detected
        },
      });
    }

    configureFEP({ alchemicalAtoms: newAlchemical, enabled: true });
  }, [
    selectedAtomIds,
    atoms,
    targetElement,
    fepConfig.alchemicalAtoms,
    configureFEP,
  ]);

  const handleRemoveAlchemicalAtom = useCallback(
    (atomIndex: number) => {
      const filtered = fepConfig.alchemicalAtoms.filter(
        (aa) => aa.atomIndex !== atomIndex,
      );
      configureFEP({
        alchemicalAtoms: filtered,
        enabled: filtered.length > 0,
      });
    },
    [fepConfig.alchemicalAtoms, configureFEP],
  );

  const handleStartScan = useCallback(() => {
    // Build λ schedule from nWindows
    const schedule: number[] = [];
    for (let i = 0; i < nWindows; i++) {
      schedule.push(i / (nWindows - 1));
    }

    const newConfig: Partial<FEPConfig> = {
      lambdaSchedule: schedule,
      equilibrationSteps: eqSteps,
      productionSteps: prodSteps,
      enabled: true,
    };
    configureFEP(newConfig);

    // Short delay to ensure config is sent before starting scan
    setTimeout(() => startFEPScan(), 50);
  }, [nWindows, eqSteps, prodSteps, configureFEP, startFEPScan]);

  if (!showFEPPanel) return null;

  // Progress bar computation
  const progressFraction =
    fepProgress && fepProgress.totalWindows > 0
      ? (fepProgress.currentWindowIndex +
          (fepProgress.totalStepsInWindow > 0
            ? fepProgress.stepsInWindow / fepProgress.totalStepsInWindow
            : 0)) /
        fepProgress.totalWindows
      : 0;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <strong>Free Energy Perturbation</strong>
        <button
          onClick={toggleFEPPanel}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          x
        </button>
      </div>

      {/* Alchemical atoms section */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, fontWeight: 'bold', color: '#ccc' }}>
          Alchemical Atoms
        </div>
        <div style={{ marginBottom: 6, color: '#999', fontSize: 11 }}>
          Select atom(s), choose target element, then click "Add".
        </div>

        {/* Target element selector */}
        <label style={labelStyle}>
          Target element:
          <select
            value={targetElement}
            onChange={(e) => setTargetElement(Number(e.target.value))}
            style={{ ...inputStyle, marginTop: 2 }}
          >
            {Object.values(elements)
              .filter((el) => el && el.number <= 36)
              .map((el) => (
                <option key={el.number} value={el.number}>
                  {el.symbol} — {el.name}
                </option>
              ))}
          </select>
        </label>

        <button
          onClick={handleAddAlchemicalAtom}
          style={{
            ...buttonStyle,
            background: 'rgba(40,80,40,0.5)',
            marginTop: 4,
          }}
          disabled={selectedAtomIds.length === 0 || fepRunning}
        >
          Add selected atom(s) ({selectedAtomIds.length})
        </button>

        {/* List of alchemical atoms */}
        {fepConfig.alchemicalAtoms.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {fepConfig.alchemicalAtoms.map((aa) => {
              const elA = elements[aa.stateA.elementNumber];
              const elB = elements[aa.stateB.elementNumber];
              return (
                <div
                  key={aa.atomIndex}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '3px 6px',
                    marginBottom: 2,
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 4,
                    fontSize: 11,
                  }}
                >
                  <span>
                    Atom {aa.atomIndex}: {elA?.symbol ?? '?'} →{' '}
                    {elB?.symbol ?? '?'}
                  </span>
                  <button
                    onClick={() => handleRemoveAlchemicalAtom(aa.atomIndex)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#c66',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                    disabled={fepRunning}
                  >
                    remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Configuration section */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, fontWeight: 'bold', color: '#ccc' }}>
          Scan Configuration
        </div>

        <label style={labelStyle}>
          Number of λ windows:
          <input
            type="number"
            min={3}
            max={51}
            value={nWindows}
            onChange={(e) => setNWindows(Number(e.target.value))}
            style={{ ...inputStyle, marginTop: 2 }}
            disabled={fepRunning}
          />
        </label>

        <label style={labelStyle}>
          Equilibration steps per window:
          <input
            type="number"
            min={100}
            step={100}
            value={eqSteps}
            onChange={(e) => setEqSteps(Number(e.target.value))}
            style={{ ...inputStyle, marginTop: 2 }}
            disabled={fepRunning}
          />
        </label>

        <label style={labelStyle}>
          Production steps per window:
          <input
            type="number"
            min={100}
            step={100}
            value={prodSteps}
            onChange={(e) => setProdSteps(Number(e.target.value))}
            style={{ ...inputStyle, marginTop: 2 }}
            disabled={fepRunning}
          />
        </label>
      </div>

      {/* Run / Cancel buttons */}
      <div style={{ marginBottom: 10 }}>
        {!fepRunning ? (
          <button
            onClick={handleStartScan}
            style={buttonStyle}
            disabled={fepConfig.alchemicalAtoms.length === 0}
          >
            Run FEP Scan
          </button>
        ) : (
          <button onClick={cancelFEP} style={dangerButtonStyle}>
            Cancel Scan
          </button>
        )}
      </div>

      {/* Progress */}
      {fepProgress && fepRunning && (
        <div style={sectionStyle}>
          <div style={{ ...labelStyle, fontWeight: 'bold', color: '#ccc' }}>
            Progress
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>
            Window {fepProgress.currentWindowIndex + 1}/
            {fepProgress.totalWindows} — {fepProgress.phase}
          </div>
          <div style={progressBarOuter}>
            <div
              style={{
                width: `${Math.min(100, progressFraction * 100)}%`,
                height: '100%',
                background: 'rgba(60,150,255,0.7)',
                borderRadius: 3,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: '#888' }}>
            {fepProgress.totalSamplesCollected} samples collected
          </div>
        </div>
      )}

      {/* Results */}
      {fepResult && (
        <div style={resultStyle}>
          <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#8f8' }}>
            Result ({fepResult.method})
          </div>
          <div style={{ fontSize: 13, marginBottom: 2 }}>
            ΔG = {fepResult.deltaG.toFixed(4)} ± {fepResult.error.toFixed(4)} eV
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            = {(fepResult.deltaG * 96.485).toFixed(2)} ±{' '}
            {(fepResult.error * 96.485).toFixed(2)} kJ/mol
          </div>

          {/* TI curve: ⟨∂V/∂λ⟩ vs λ */}
          {fepResult.dVdLambdaMeans.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>
                ⟨∂V/∂λ⟩ vs λ:
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: 40,
                  gap: 1,
                }}
              >
                {fepResult.dVdLambdaMeans.map((mean, idx) => {
                  const maxAbs = Math.max(
                    ...fepResult.dVdLambdaMeans.map(Math.abs),
                    1e-10,
                  );
                  const normalized = Math.abs(mean) / maxAbs;
                  const color =
                    mean >= 0 ? 'rgba(60,150,255,0.6)' : 'rgba(255,100,60,0.6)';
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: `${normalized * 100}%`,
                        minHeight: 1,
                        background: color,
                        borderRadius: 1,
                      }}
                      title={`λ=${fepResult.lambdaSchedule[idx]?.toFixed(2)}: ${mean.toFixed(4)} eV`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={clearFEPResult}
            style={{
              ...buttonStyle,
              background: 'rgba(100,100,100,0.3)',
              marginTop: 8,
              fontSize: 11,
            }}
          >
            Clear Result
          </button>
        </div>
      )}

      {/* Info */}
      <div style={{ fontSize: 10, color: '#666', lineHeight: 1.4 }}>
        Free energy perturbation computes ΔG between two states using
        thermodynamic integration. Requires Nosé-Hoover thermostat
        (auto-enabled).
      </div>
    </div>
  );
}
