// ==============================================================
// EventLog — "Why Did That Happen?" interaction logger
//
// Displays physically significant simulation events with
// plain-language explanations. Clickable events highlight
// the relevant atoms in the 3D scene.
// ==============================================================

import React, { useRef, useEffect } from 'react';
import { useSimContextStore } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import type {
  SimulationEvent,
  SimulationEventSeverity,
  SimulationEventType,
} from '../data/types';

/** Maximum events to display (matches store cap) */
const MAX_DISPLAY = 200;

/** Color scheme for event severity levels */
const SEVERITY_COLORS: Record<SimulationEventSeverity, string> = {
  info: '#88ccff',
  warning: '#ffcc44',
  error: '#ff6666',
};

/** Icon/label for each event type */
const EVENT_TYPE_LABELS: Record<
  SimulationEventType,
  { icon: string; label: string }
> = {
  'bond-broken': { icon: '💔', label: 'Bond Broken' },
  'bond-formed': { icon: '🔗', label: 'Bond Formed' },
  'temperature-spike': { icon: '🌡', label: 'Temp Spike' },
  'energy-drift': { icon: '⚡', label: 'Energy Drift' },
  'bond-strain': { icon: '⚠', label: 'Bond Strain' },
};

export const EventLog: React.FC = () => {
  const showEventLog = useUIStore((s) => s.showEventLog);
  const showReactionLog = useUIStore((s) => s.showReactionLog);
  const selectAtom = useUIStore((s) => s.selectAtom);
  const eventLog = useSimContextStore((s) => s.eventLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventLog.length]);

  if (!showEventLog) return null;

  // Offset position if reaction log is also visible to avoid overlap.
  // ReactionLog sits at bottom:30 with maxHeight:260 + padding(20) + header(~20) ≈ 330px.
  const REACTION_LOG_CLEARANCE = 300;
  const bottomOffset = showReactionLog ? REACTION_LOG_CLEARANCE : 30;

  const displayEvents = eventLog.slice(-MAX_DISPLAY);

  return (
    <div
      data-testid="event-log"
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 10,
        background: 'rgba(20, 20, 40, 0.95)',
        borderRadius: 8,
        padding: '10px 14px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        color: '#ddd',
        fontFamily: 'monospace',
        fontSize: 11,
        width: 400,
        maxHeight: 300,
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
          color: '#ffcc44',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Why Did That Happen?</span>
        <span style={{ fontSize: 10, color: '#666' }}>
          {displayEvents.length} event{displayEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        ref={scrollRef}
        style={{
          overflowY: 'auto',
          flex: 1,
          maxHeight: 260,
        }}
      >
        {displayEvents.length === 0 ? (
          <div style={{ color: '#555', fontStyle: 'italic', padding: '8px 0' }}>
            No events detected yet. Start a simulation to observe physical
            events like bond changes, temperature spikes, and energy drift.
          </div>
        ) : (
          displayEvents.map((event, i) => (
            <EventRow
              key={`${event.step}-${event.type}-${i}`}
              event={event}
              isLast={i === displayEvents.length - 1}
              onAtomClick={selectAtom}
            />
          ))
        )}
      </div>
    </div>
  );
};

/** Individual event row with click-to-select behavior */
const EventRow: React.FC<{
  event: SimulationEvent;
  isLast: boolean;
  onAtomClick: (id: number, multi?: boolean) => void;
}> = ({ event, isLast, onAtomClick }) => {
  const typeInfo = EVENT_TYPE_LABELS[event.type];
  const severityColor = SEVERITY_COLORS[event.severity];

  const handleClick = () => {
    if (event.atomIndices.length === 0) return;
    // Select the first atom, then add others with multi-select
    onAtomClick(event.atomIndices[0], false);
    for (let i = 1; i < event.atomIndices.length; i++) {
      onAtomClick(event.atomIndices[i], true);
    }
  };

  const isClickable = event.atomIndices.length > 0;

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '5px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
        cursor: isClickable ? 'pointer' : 'default',
      }}
      title={
        isClickable
          ? `Click to highlight atom${event.atomIndices.length > 1 ? 's' : ''} ${event.atomIndices.join(', ')}`
          : undefined
      }
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          <span style={{ marginRight: 4 }}>{typeInfo.icon}</span>
          <span style={{ color: severityColor, fontWeight: 'bold' }}>
            {typeInfo.label}
          </span>
        </span>
        <span style={{ color: '#666', fontSize: 10, marginLeft: 8 }}>
          step {event.step.toLocaleString()}
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: '#aaa',
          marginTop: 2,
          lineHeight: '1.4',
        }}
      >
        {event.explanation}
      </div>
    </div>
  );
};
