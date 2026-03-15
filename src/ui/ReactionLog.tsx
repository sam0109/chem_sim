// ==============================================================
// ReactionLog — displays detected chemical reaction events
// ==============================================================

import React, { useRef, useEffect } from 'react';
import { useSimContextStore } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';
import type { MoleculeInfo, ReactionEvent } from '../data/types';

/**
 * Build a molecular formula string from atom indices and element data.
 * Groups atoms by element and sorts by Hill system (C first, H second,
 * then alphabetical).
 * Source: Hill, E. A. (1900). JACS 22(8), 478-494.
 */
function moleculeFormula(
  mol: MoleculeInfo,
  atoms: ReadonlyArray<{ elementNumber: number }>,
): string {
  const counts = new Map<number, number>();
  for (const idx of mol.atomIndices) {
    const z = atoms[idx]?.elementNumber;
    if (z !== undefined) {
      counts.set(z, (counts.get(z) ?? 0) + 1);
    }
  }

  // Hill system sorting: C first, H second, then alphabetical
  const entries = [...counts.entries()].sort((a, b) => {
    if (a[0] === 6) return -1;
    if (b[0] === 6) return 1;
    if (a[0] === 1) return -1;
    if (b[0] === 1) return 1;
    const symA = elements[a[0]]?.symbol ?? '';
    const symB = elements[b[0]]?.symbol ?? '';
    return symA.localeCompare(symB);
  });

  return entries
    .map(([z, count]) => {
      const sym = elements[z]?.symbol ?? `Z${z}`;
      return count > 1 ? `${sym}${subscript(count)}` : sym;
    })
    .join('');
}

/** Convert a number to Unicode subscript characters */
function subscript(n: number): string {
  const subDigits = '₀₁₂₃₄₅₆₇₈₉';
  return String(n)
    .split('')
    .map((d) => subDigits[parseInt(d, 10)] ?? d)
    .join('');
}

/** Format a reaction event as a human-readable string */
function formatReaction(
  event: ReactionEvent,
  atoms: ReadonlyArray<{ elementNumber: number }>,
): string {
  const reactantFormulas = event.reactants.map((m) =>
    moleculeFormula(m, atoms),
  );
  const productFormulas = event.products.map((m) => moleculeFormula(m, atoms));

  const lhs = reactantFormulas.join(' + ') || '?';
  const rhs = productFormulas.join(' + ') || '?';

  return `${lhs} → ${rhs}`;
}

export const ReactionLog: React.FC = () => {
  const showReactionLog = useUIStore((s) => s.showReactionLog);
  const reactionLog = useSimContextStore((s) => s.reactionLog);
  const atoms = useSimContextStore((s) => s.atoms);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reactionLog.length]);

  if (!showReactionLog) return null;

  return (
    <div
      data-testid="reaction-log"
      style={{
        position: 'absolute',
        bottom: 30,
        left: 10,
        background: 'rgba(20, 20, 40, 0.95)',
        borderRadius: 8,
        padding: '10px 14px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        color: '#ddd',
        fontFamily: 'monospace',
        fontSize: 11,
        width: 340,
        maxHeight: 260,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 'bold',
          marginBottom: 6,
          color: '#aaccff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Reaction Log</span>
        <span style={{ fontSize: 10, color: '#666' }}>
          {reactionLog.length} event{reactionLog.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        ref={scrollRef}
        style={{
          overflowY: 'auto',
          flex: 1,
          maxHeight: 220,
        }}
      >
        {reactionLog.length === 0 ? (
          <div style={{ color: '#555', fontStyle: 'italic', padding: '8px 0' }}>
            No reactions detected yet. Start a simulation with multiple
            molecules to observe reactions.
          </div>
        ) : (
          reactionLog.map((event, i) => (
            <div
              key={`${event.step}-${i}`}
              style={{
                padding: '4px 0',
                borderBottom:
                  i < reactionLog.length - 1
                    ? '1px solid rgba(255,255,255,0.05)'
                    : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7ce87c' }}>
                  {formatReaction(event, atoms)}
                </span>
                <span style={{ color: '#666', fontSize: 10, marginLeft: 8 }}>
                  step {event.step.toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                {event.bondChanges
                  .map((bc) => {
                    const symA =
                      elements[atoms[bc.atomA]?.elementNumber]?.symbol ??
                      `#${bc.atomA}`;
                    const symB =
                      elements[atoms[bc.atomB]?.elementNumber]?.symbol ??
                      `#${bc.atomB}`;
                    const orderStr =
                      bc.order === 2 ? '=' : bc.order === 3 ? '≡' : '−';
                    return bc.change === 'formed'
                      ? `+${symA}${orderStr}${symB}`
                      : `−${symA}${orderStr}${symB}`;
                  })
                  .join('  ')}
                {event.deltaE !== null && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: event.deltaE < 0 ? '#7ce87c' : '#e87c7c',
                    }}
                  >
                    {event.deltaE < 0 ? '' : '+'}
                    {event.deltaE.toFixed(2)} eV
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
