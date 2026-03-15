// ==============================================================
// QuantityDashboard — expandable cards showing physical quantities
// with formulas, explanations, sparklines, and energy breakdown
// ==============================================================

import React, { useRef, useEffect, useCallback } from 'react';
import { useSimContextStore } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import type { EnergyBreakdown } from '../data/types';

/** Number of history entries to show in sparklines */
const SPARKLINE_POINTS = 80;
const SPARKLINE_W = 180;
const SPARKLINE_H = 32;

// ---- Shared styles ----

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 240,
  width: 260,
  maxHeight: 'calc(100vh - 60px)',
  overflowY: 'auto',
  background: 'rgba(20, 20, 40, 0.95)',
  borderRadius: 8,
  padding: '10px 12px',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(10px)',
  color: '#ddd',
  fontFamily: 'monospace',
  fontSize: 11,
  zIndex: 100,
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  padding: '6px 0',
  userSelect: 'none',
};

const cardBodyStyle: React.CSSProperties = {
  paddingBottom: 8,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const formulaStyle: React.CSSProperties = {
  color: '#aaccff',
  fontSize: 10,
  marginTop: 4,
  fontStyle: 'italic',
};

const explanationStyle: React.CSSProperties = {
  color: '#999',
  fontSize: 10,
  marginTop: 4,
  lineHeight: '1.4',
};

const breakdownRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 10,
  padding: '1px 0',
};

// ---- Sparkline component ----

const Sparkline: React.FC<{
  data: number[];
  color: string;
  width?: number;
  height?: number;
}> = ({ data, color, width = SPARKLINE_W, height = SPARKLINE_H }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Compute range
    let min = Infinity;
    let max = -Infinity;
    for (const v of data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;

    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((data[i] - min) / range) * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [data, color, width, height]);

  if (data.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          color: '#555',
          fontSize: 9,
          lineHeight: `${height}px`,
        }}
      >
        Waiting for data...
      </div>
    );
  }

  return <canvas ref={canvasRef} width={width} height={height} />;
};

// ---- Energy breakdown bar ----

interface BreakdownEntry {
  label: string;
  value: number;
  color: string;
}

const BREAKDOWN_COLORS: Record<keyof EnergyBreakdown, string> = {
  morse: '#ff6666',
  angle: '#66aaff',
  torsion: '#66ff66',
  inversion: '#ffaa44',
  lj: '#cc88ff',
  coulomb: '#44dddd',
};

const BREAKDOWN_LABELS: Record<keyof EnergyBreakdown, string> = {
  morse: 'Bond stretch (Morse)',
  angle: 'Angle bend',
  torsion: 'Dihedral torsion',
  inversion: 'Out-of-plane',
  lj: 'van der Waals (LJ)',
  coulomb: 'Electrostatic',
};

const EnergyBreakdownView: React.FC<{ breakdown: EnergyBreakdown }> = ({
  breakdown,
}) => {
  const entries: BreakdownEntry[] = (
    Object.keys(BREAKDOWN_LABELS) as Array<keyof EnergyBreakdown>
  )
    .filter((key) => breakdown[key] !== 0)
    .map((key) => ({
      label: BREAKDOWN_LABELS[key],
      value: breakdown[key],
      color: BREAKDOWN_COLORS[key],
    }));

  if (entries.length === 0) {
    return (
      <div style={explanationStyle}>No potential energy contributions.</div>
    );
  }

  return (
    <div style={{ marginTop: 4 }}>
      {entries.map((entry) => (
        <div key={entry.label} style={breakdownRowStyle}>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 2,
                background: entry.color,
                marginRight: 4,
                verticalAlign: 'middle',
              }}
            />
            {entry.label}
          </span>
          <span style={{ color: entry.color }}>
            {entry.value.toFixed(4)} eV
          </span>
        </div>
      ))}
    </div>
  );
};

// ---- Dashboard card wrapper ----

const DashboardCard: React.FC<{
  id: string;
  title: string;
  value: string;
  valueColor: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, value, valueColor, expanded, onToggle, children }) => (
  <div>
    <div style={cardHeaderStyle} onClick={onToggle}>
      <span style={{ fontWeight: 'bold', fontSize: 11 }}>
        {expanded ? '\u25BC' : '\u25B6'} {title}
      </span>
      <span style={{ color: valueColor, fontWeight: 'bold' }}>{value}</span>
    </div>
    {expanded && <div style={cardBodyStyle}>{children}</div>}
  </div>
);

// ---- Main component ----

export const QuantityDashboard: React.FC = () => {
  const showDashboard = useUIStore((s) => s.showDashboard);
  const expandedCards = useUIStore((s) => s.expandedDashboardCards);
  const toggleCard = useUIStore((s) => s.toggleDashboardCard);

  const energy = useSimContextStore((s) => s.energy);
  const energyBreakdown = useSimContextStore((s) => s.energyBreakdown);
  const temperature = useSimContextStore((s) => s.temperature);
  const atoms = useSimContextStore((s) => s.atoms);
  const config = useSimContextStore((s) => s.config);
  const energyHistory = useSimContextStore((s) => s.energyHistory);

  // Slice history for sparklines (last N entries)
  const historySlice = energyHistory.slice(-SPARKLINE_POINTS);

  const tempData = historySlice.map((h) => h.temperature);
  const keData = historySlice.map((h) => h.kinetic);
  const peData = historySlice.map((h) => h.potential);
  const totalData = historySlice.map((h) => h.total);

  const handleToggle = useCallback(
    (cardId: string) => () => toggleCard(cardId),
    [toggleCard],
  );

  if (!showDashboard) return null;

  const nAtoms = atoms.length;
  // Degrees of freedom: 3N - 3 (removing center-of-mass motion)
  // For very small systems this can be 0 or negative, clamp to 1
  const dof = Math.max(3 * nAtoms - 3, 1);

  // Expected temperature fluctuation for small systems
  // Relative fluctuation: sigma_T/T = sqrt(2/(3N-3))
  // Source: Statistical Mechanics, McQuarrie, Ch. 3
  const relFluctuation = nAtoms > 1 ? Math.sqrt(2 / dof) : 1;
  const fluctPercent = (relFluctuation * 100).toFixed(0);

  return (
    <div data-testid="quantity-dashboard" style={panelStyle}>
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: 6,
          fontSize: 12,
          color: '#c4a24e',
        }}
      >
        Physical Quantities
      </div>

      {/* Temperature card */}
      <DashboardCard
        id="temperature"
        title="Temperature"
        value={`${temperature.toFixed(1)} K`}
        valueColor="#ffaa44"
        expanded={expandedCards.has('temperature')}
        onToggle={handleToggle('temperature')}
      >
        <Sparkline data={tempData} color="#ffaa44" />
        <div style={formulaStyle}>T = 2 KE / ({dof} k_B)</div>
        <div style={explanationStyle}>
          Temperature measures the average kinetic energy per degree of freedom.
          With {nAtoms} atom{nAtoms !== 1 ? 's' : ''} ({dof} DOF), expect
          fluctuations of ~{fluctPercent}% around the target{' '}
          {config.temperature} K.
          {nAtoms <= 5 && (
            <span>
              {' '}
              This is physically correct for small systems, not a bug!
            </span>
          )}
        </div>
        {config.thermostat !== 'none' && (
          <div style={{ ...explanationStyle, color: '#aaccff' }}>
            Thermostat:{' '}
            {config.thermostat === 'berendsen'
              ? 'Berendsen'
              : 'Nos\u00E9-Hoover'}{' '}
            (coupling to {config.temperature} K bath)
          </div>
        )}
      </DashboardCard>

      {/* Kinetic Energy card */}
      <DashboardCard
        id="ke"
        title="Kinetic Energy"
        value={`${energy.kinetic.toFixed(4)} eV`}
        valueColor="#ff6666"
        expanded={expandedCards.has('ke')}
        onToggle={handleToggle('ke')}
      >
        <Sparkline data={keData} color="#ff6666" />
        <div style={formulaStyle}>KE = \u03A3 \u00BD m_i |v_i|\u00B2</div>
        <div style={explanationStyle}>
          Sum of the kinetic energies of all atoms. Related to temperature via
          the equipartition theorem: each degree of freedom contributes \u00BD
          k_B T on average.
        </div>
      </DashboardCard>

      {/* Potential Energy card */}
      <DashboardCard
        id="pe"
        title="Potential Energy"
        value={`${energy.potential.toFixed(4)} eV`}
        valueColor="#66aaff"
        expanded={expandedCards.has('pe')}
        onToggle={handleToggle('pe')}
      >
        <Sparkline data={peData} color="#66aaff" />
        <div style={formulaStyle}>
          PE = V_Morse + V_angle + V_torsion + V_inversion + V_LJ + V_Coulomb
        </div>
        <div style={explanationStyle}>
          Total potential energy from all force field terms. Expand to see the
          contribution from each type of interaction.
        </div>
        <EnergyBreakdownView breakdown={energyBreakdown} />
      </DashboardCard>

      {/* Total Energy card */}
      <DashboardCard
        id="total"
        title="Total Energy"
        value={`${energy.total.toFixed(4)} eV`}
        valueColor="#66ff66"
        expanded={expandedCards.has('total')}
        onToggle={handleToggle('total')}
      >
        <Sparkline data={totalData} color="#66ff66" />
        <div style={formulaStyle}>E_total = KE + PE</div>
        <div style={explanationStyle}>
          {config.thermostat === 'none' ? (
            <>
              In the NVE ensemble (no thermostat), total energy is conserved.
              Any drift indicates numerical error from the integrator timestep (
              {config.timestep} fs). Reduce timestep if drift is significant.
            </>
          ) : (
            <>
              With the{' '}
              {config.thermostat === 'berendsen'
                ? 'Berendsen'
                : 'Nos\u00E9-Hoover'}{' '}
              thermostat active, total energy is not conserved \u2014 energy
              flows between the system and the heat bath to maintain ~
              {config.temperature} K.
            </>
          )}
        </div>
        {energy.thermostat !== 0 && (
          <div style={{ ...explanationStyle, color: '#ffcc44' }}>
            Nos\u00E9-Hoover extended Hamiltonian: H_ext ={' '}
            {(energy.total + energy.thermostat).toFixed(4)} eV (should be
            conserved)
          </div>
        )}
      </DashboardCard>
    </div>
  );
};
