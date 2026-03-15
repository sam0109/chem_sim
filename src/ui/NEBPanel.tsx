// ==============================================================
// NEBPanel — controls for Nudged Elastic Band reaction path finding
//
// Allows the user to:
// 1. Capture reactant and product geometries
// 2. Configure NEB parameters (images, spring constant, etc.)
// 3. Run NEB and view progress/results
// ==============================================================

import React, { useState, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';
import { useSimContextStore } from '../store/SimulationContext';
import type { NEBConfig } from '../data/types';
import { DEFAULT_NEB_CONFIG } from '../data/types';

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 280,
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

const captureButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(40,80,40,0.5)',
  marginBottom: 4,
};

const capturedBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: 3,
  fontSize: 10,
  marginLeft: 6,
};

export const NEBPanel: React.FC = () => {
  const showNEBPanel = useUIStore((s) => s.showNEBPanel);
  const toggleNEBPanel = useUIStore((s) => s.toggleNEBPanel);

  const nebResult = useSimContextStore((s) => s.nebResult);
  const nebProgress = useSimContextStore((s) => s.nebProgress);
  const nebRunning = useSimContextStore((s) => s.nebRunning);
  const nebReactantPositions = useSimContextStore(
    (s) => s.nebReactantPositions,
  );
  const nebProductPositions = useSimContextStore((s) => s.nebProductPositions);
  const captureNEBReactant = useSimContextStore((s) => s.captureNEBReactant);
  const captureNEBProduct = useSimContextStore((s) => s.captureNEBProduct);
  const runNEB = useSimContextStore((s) => s.runNEB);
  const cancelNEB = useSimContextStore((s) => s.cancelNEB);
  const clearNEBResult = useSimContextStore((s) => s.clearNEBResult);
  const atoms = useSimContextStore((s) => s.atoms);

  // Local config state
  const [nImages, setNImages] = useState(DEFAULT_NEB_CONFIG.nImages);
  const [springK, setSpringK] = useState(DEFAULT_NEB_CONFIG.springK);
  const [climbingImage, setClimbingImage] = useState(
    DEFAULT_NEB_CONFIG.climbingImage,
  );
  const [maxIterations, setMaxIterations] = useState(
    DEFAULT_NEB_CONFIG.maxIterations,
  );
  const [forceTolerance, setForceTolerance] = useState(
    DEFAULT_NEB_CONFIG.forceTolerance,
  );

  const handleRunNEB = useCallback(() => {
    const config: Partial<NEBConfig> = {
      nImages,
      springK,
      climbingImage,
      maxIterations,
      forceTolerance,
    };
    runNEB(config);
  }, [nImages, springK, climbingImage, maxIterations, forceTolerance, runNEB]);

  if (!showNEBPanel) return null;

  const hasReactant = nebReactantPositions !== null;
  const hasProduct = nebProductPositions !== null;
  const canRun = hasReactant && hasProduct && atoms.length > 0 && !nebRunning;

  return (
    <div style={panelStyle} data-testid="neb-panel">
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 'bold', fontSize: 14 }}>
          Reaction Path (NEB)
        </span>
        <button
          onClick={toggleNEBPanel}
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

      {/* Capture section */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 6 }}>
          1. Capture Endpoints
        </div>
        <button
          style={captureButtonStyle}
          onClick={captureNEBReactant}
          disabled={atoms.length === 0}
        >
          Capture Reactant
          {hasReactant && (
            <span
              style={{
                ...capturedBadge,
                background: 'rgba(100,200,100,0.3)',
                color: '#8f8',
              }}
            >
              captured
            </span>
          )}
        </button>
        <button
          style={captureButtonStyle}
          onClick={captureNEBProduct}
          disabled={atoms.length === 0}
        >
          Capture Product
          {hasProduct && (
            <span
              style={{
                ...capturedBadge,
                background: 'rgba(100,200,100,0.3)',
                color: '#8f8',
              }}
            >
              captured
            </span>
          )}
        </button>
        <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>
          Position your molecule as reactant, capture it, then rearrange to
          product geometry and capture again.
        </div>
      </div>

      {/* Config section */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 6 }}>
          2. Configure
        </div>

        <label style={labelStyle}>
          Images: {nImages}
          <input
            type="range"
            min={3}
            max={15}
            value={nImages}
            onChange={(e) => setNImages(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label style={labelStyle}>
          Spring constant (eV/A^2)
          <input
            type="number"
            step={0.01}
            min={0.01}
            max={1.0}
            value={springK}
            onChange={(e) => setSpringK(parseFloat(e.target.value) || 0.1)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Max iterations
          <input
            type="number"
            step={50}
            min={50}
            max={2000}
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value) || 500)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Force tolerance (eV/A)
          <input
            type="number"
            step={0.01}
            min={0.001}
            max={1.0}
            value={forceTolerance}
            onChange={(e) =>
              setForceTolerance(parseFloat(e.target.value) || 0.05)
            }
            style={inputStyle}
          />
        </label>

        <label
          style={{
            ...labelStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={climbingImage}
            onChange={(e) => setClimbingImage(e.target.checked)}
          />
          Climbing Image (CI-NEB)
        </label>
      </div>

      {/* Run section */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 6 }}>
          3. Run
        </div>
        {!nebRunning ? (
          <button
            style={{
              ...buttonStyle,
              opacity: canRun ? 1 : 0.5,
            }}
            onClick={handleRunNEB}
            disabled={!canRun}
          >
            Run NEB
          </button>
        ) : (
          <button
            style={{ ...buttonStyle, background: 'rgba(200,60,60,0.4)' }}
            onClick={cancelNEB}
          >
            Cancel
          </button>
        )}

        {/* Progress display */}
        {nebRunning && nebProgress && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#aaa' }}>
            <div>
              Iteration: {nebProgress.iteration} / {maxIterations}
            </div>
            <div>Max force: {nebProgress.maxForce.toFixed(4)} eV/A</div>
            <div
              style={{
                height: 4,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (nebProgress.iteration / maxIterations) * 100)}%`,
                  background: 'rgba(100,150,255,0.6)',
                  borderRadius: 2,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results section */}
      {nebResult && (
        <div style={sectionStyle}>
          <div style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 6 }}>
            Results
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            <div>
              Status:{' '}
              <span
                style={{
                  color: nebResult.converged ? '#8f8' : '#fa8',
                }}
              >
                {nebResult.converged ? 'Converged' : 'Not converged'}
              </span>
            </div>
            <div>Iterations: {nebResult.iterations}</div>
            <div>
              Barrier:{' '}
              <span style={{ color: '#adf', fontWeight: 'bold' }}>
                {nebResult.barrier.toFixed(3)} eV
              </span>
            </div>
            <div>TS energy: {nebResult.tsEnergy.toFixed(3)} eV</div>
            <div>TS image: {nebResult.tsImageIndex}</div>
            <div>Max force: {nebResult.maxForce.toFixed(4)} eV/A</div>
          </div>

          {/* Energy profile mini chart */}
          <div style={{ marginTop: 8 }}>
            <NEBEnergyMiniChart energyProfile={nebResult.energyProfile} />
          </div>

          <button
            style={{
              ...buttonStyle,
              background: 'rgba(80,80,80,0.4)',
              marginTop: 8,
            }}
            onClick={clearNEBResult}
          >
            Clear Results
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Mini energy profile chart drawn with inline SVG.
 * Shows the energy at each NEB image along the reaction coordinate.
 */
const NEBEnergyMiniChart: React.FC<{ energyProfile: number[] }> = ({
  energyProfile,
}) => {
  if (energyProfile.length < 2) return null;

  const width = 256;
  const height = 80;
  const padding = { top: 8, right: 8, bottom: 16, left: 32 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const minE = Math.min(...energyProfile);
  const maxE = Math.max(...energyProfile);
  const rangeE = maxE - minE || 1;

  const points = energyProfile.map((e, i) => {
    const x = padding.left + (i / (energyProfile.length - 1)) * plotW;
    const y = padding.top + (1 - (e - minE) / rangeE) * plotH;
    return `${x},${y}`;
  });

  // Find transition state (highest energy)
  let tsIdx = 0;
  let tsE = -Infinity;
  for (let i = 0; i < energyProfile.length; i++) {
    if (energyProfile[i] > tsE) {
      tsE = energyProfile[i];
      tsIdx = i;
    }
  }
  const tsX = padding.left + (tsIdx / (energyProfile.length - 1)) * plotW;
  const tsY = padding.top + (1 - (tsE - minE) / rangeE) * plotH;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Background */}
      <rect
        x={padding.left}
        y={padding.top}
        width={plotW}
        height={plotH}
        fill="rgba(255,255,255,0.03)"
        rx={2}
      />
      {/* Energy profile line */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="rgba(100,180,255,0.8)"
        strokeWidth={2}
      />
      {/* Data points */}
      {energyProfile.map((e, i) => {
        const x = padding.left + (i / (energyProfile.length - 1)) * plotW;
        const y = padding.top + (1 - (e - minE) / rangeE) * plotH;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === tsIdx ? 4 : 2.5}
            fill={i === tsIdx ? '#f88' : 'rgba(100,180,255,0.9)'}
            stroke={i === tsIdx ? '#f44' : 'none'}
            strokeWidth={1}
          />
        );
      })}
      {/* TS label */}
      <text x={tsX} y={tsY - 6} fill="#f88" fontSize={9} textAnchor="middle">
        TS
      </text>
      {/* Axis labels */}
      <text x={padding.left} y={height - 2} fill="#666" fontSize={9}>
        Reactant
      </text>
      <text
        x={width - padding.right}
        y={height - 2}
        fill="#666"
        fontSize={9}
        textAnchor="end"
      >
        Product
      </text>
      {/* Y-axis labels */}
      <text
        x={padding.left - 3}
        y={padding.top + 8}
        fill="#666"
        fontSize={8}
        textAnchor="end"
      >
        {maxE.toFixed(2)}
      </text>
      <text
        x={padding.left - 3}
        y={height - padding.bottom}
        fill="#666"
        fontSize={8}
        textAnchor="end"
      >
        {minE.toFixed(2)}
      </text>
    </svg>
  );
};
