// ==============================================================
// Toolbar — tool selection and view mode buttons
// ==============================================================

import React, { useCallback } from 'react';
import { useUIStore } from '../store/uiStore';
import type { InteractionTool } from '../data/types';

const tools: Array<{
  id: InteractionTool;
  icon: string;
  label: string;
  shortcut: string;
}> = [
  { id: 'select', icon: '🔍', label: 'Select', shortcut: 'S' },
  { id: 'place-atom', icon: '⊕', label: 'Place Atom', shortcut: 'A' },
  {
    id: 'place-molecule',
    icon: '🧪',
    label: 'Place Molecule',
    shortcut: 'P',
  },
  { id: 'delete', icon: '✕', label: 'Delete', shortcut: 'D' },
  { id: 'drag', icon: '✋', label: 'Drag', shortcut: 'G' },
  { id: 'measure-distance', icon: '📏', label: 'Measure', shortcut: 'M' },
];

const ToolButton: React.FC<{
  tool: (typeof tools)[0];
  active: boolean;
  onClick: () => void;
}> = ({ tool, active, onClick }) => (
  <button
    data-testid={`tool-${tool.id}`}
    onClick={onClick}
    title={`${tool.label} (${tool.shortcut})`}
    style={{
      width: 40,
      height: 40,
      borderRadius: 6,
      border: active ? '2px solid #aaccff' : '1px solid rgba(255,255,255,0.15)',
      background: active ? 'rgba(100,150,255,0.3)' : 'rgba(40,40,60,0.8)',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      transition: 'all 0.15s',
    }}
  >
    {tool.icon}
  </button>
);

export const Toolbar: React.FC = () => {
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const selectedBondOrder = useUIStore((s) => s.selectedBondOrder);
  const setSelectedBondOrder = useUIStore((s) => s.setSelectedBondOrder);
  const renderMode = useUIStore((s) => s.renderMode);
  const setRenderMode = useUIStore((s) => s.setRenderMode);
  const toggleLabels = useUIStore((s) => s.toggleLabels);
  const showLabels = useUIStore((s) => s.showLabels);
  const toggleEnergyPlot = useUIStore((s) => s.toggleEnergyPlot);
  const colorMode = useUIStore((s) => s.colorMode);
  const setColorMode = useUIStore((s) => s.setColorMode);
  const toggleChallengePanel = useUIStore((s) => s.toggleChallengePanel);
  const showChallengePanel = useUIStore((s) => s.showChallengePanel);
  const comparisonMode = useUIStore((s) => s.comparisonMode);
  const toggleComparisonMode = useUIStore((s) => s.toggleComparisonMode);
  const showEncounterPanel = useUIStore((s) => s.showEncounterPanel);
  const toggleEncounterPanel = useUIStore((s) => s.toggleEncounterPanel);
  const showReactionLog = useUIStore((s) => s.showReactionLog);
  const toggleReactionLog = useUIStore((s) => s.toggleReactionLog);
  const showEventLog = useUIStore((s) => s.showEventLog);
  const toggleEventLog = useUIStore((s) => s.toggleEventLog);
  const showDashboard = useUIStore((s) => s.showDashboard);
  const toggleDashboard = useUIStore((s) => s.toggleDashboard);
  const bondColorMode = useUIStore((s) => s.bondColorMode);
  const toggleBondColorMode = useUIStore((s) => s.toggleBondColorMode);
  const showExperimentPanel = useUIStore((s) => s.showExperimentPanel);
  const toggleExperimentPanel = useUIStore((s) => s.toggleExperimentPanel);
  const showTimeline = useUIStore((s) => s.showTimeline);
  const toggleTimeline = useUIStore((s) => s.toggleTimeline);

  // When selecting the place-molecule tool, show the encounter panel
  const handleToolSelect = useCallback(
    (tool: InteractionTool) => {
      setActiveTool(tool);
      if (tool === 'place-molecule' && !showEncounterPanel) {
        toggleEncounterPanel();
      }
    },
    [setActiveTool, showEncounterPanel, toggleEncounterPanel],
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      switch (e.key.toLowerCase()) {
        case 's':
          setActiveTool('select');
          break;
        case 'a':
          setActiveTool('place-atom');
          break;
        case 'p':
          handleToolSelect('place-molecule');
          break;
        case 'd':
          setActiveTool('delete');
          break;
        case 'g':
          setActiveTool('drag');
          break;
        case 'm':
          setActiveTool('measure-distance');
          break;
        case 'l':
          toggleLabels();
          break;
        case '1':
          setSelectedBondOrder(1);
          break;
        case '2':
          setSelectedBondOrder(2);
          break;
        case '3':
          setSelectedBondOrder(3);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTool, toggleLabels, handleToolSelect, setSelectedBondOrder]);

  return (
    <div
      data-testid="toolbar"
      style={{
        position: 'absolute',
        top: '50%',
        left: 10,
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 100,
      }}
    >
      {/* Tool buttons */}
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={activeTool === tool.id}
          onClick={() => handleToolSelect(tool.id)}
        />
      ))}

      {/* Bond order selector — visible only when place-atom is active */}
      {activeTool === 'place-atom' && (
        <div
          data-testid="bond-order-selector"
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 2,
            justifyContent: 'center',
          }}
        >
          {([1, 2, 3] as const).map((order) => (
            <button
              key={order}
              data-testid={`bond-order-${order}`}
              onClick={() => setSelectedBondOrder(order)}
              title={`${order === 1 ? 'Single' : order === 2 ? 'Double' : 'Triple'} bond (${order})`}
              style={{
                width: 12,
                height: 24,
                borderRadius: 3,
                border:
                  selectedBondOrder === order
                    ? '2px solid #aaccff'
                    : '1px solid rgba(255,255,255,0.15)',
                background:
                  selectedBondOrder === order
                    ? 'rgba(100,150,255,0.3)'
                    : 'rgba(40,40,60,0.8)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: 'monospace',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {order}
            </button>
          ))}
        </div>
      )}

      {/* Separator */}
      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.1)',
          margin: '4px 0',
        }}
      />

      {/* View mode buttons */}
      <button
        data-testid="view-ball-and-stick"
        onClick={() => setRenderMode('ball-and-stick')}
        title="Ball and Stick"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border:
            renderMode === 'ball-and-stick'
              ? '2px solid #aaccff'
              : '1px solid rgba(255,255,255,0.15)',
          background:
            renderMode === 'ball-and-stick'
              ? 'rgba(100,150,255,0.3)'
              : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        B&S
      </button>
      <button
        data-testid="view-space-filling"
        onClick={() => setRenderMode('space-filling')}
        title="Space Filling"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border:
            renderMode === 'space-filling'
              ? '2px solid #aaccff'
              : '1px solid rgba(255,255,255,0.15)',
          background:
            renderMode === 'space-filling'
              ? 'rgba(100,150,255,0.3)'
              : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        CPK
      </button>

      {/* Separator */}
      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.1)',
          margin: '4px 0',
        }}
      />

      {/* Toggle buttons */}
      <button
        data-testid="toggle-labels"
        onClick={toggleLabels}
        title="Toggle Labels (L)"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border: showLabels
            ? '2px solid #aaccff'
            : '1px solid rgba(255,255,255,0.15)',
          background: showLabels
            ? 'rgba(100,150,255,0.3)'
            : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        Lbl
      </button>
      <button
        data-testid="toggle-energy-plot"
        onClick={toggleEnergyPlot}
        title="Toggle Energy Plot"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        E(t)
      </button>
      <button
        data-testid="toggle-dashboard"
        onClick={toggleDashboard}
        title="Toggle Quantity Dashboard"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border: showDashboard
            ? '2px solid #c4a24e'
            : '1px solid rgba(255,255,255,0.15)',
          background: showDashboard
            ? 'rgba(196,162,78,0.3)'
            : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        Qty
      </button>
      <button
        data-testid="toggle-molecule-colors"
        onClick={() =>
          setColorMode(colorMode === 'element' ? 'molecule' : 'element')
        }
        title="Toggle Molecule Coloring"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border:
            colorMode === 'molecule'
              ? '2px solid #88ffaa'
              : '1px solid rgba(255,255,255,0.15)',
          background:
            colorMode === 'molecule'
              ? 'rgba(100,255,150,0.3)'
              : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        Mol
      </button>
      <button
        data-testid="toggle-bond-type-colors"
        onClick={toggleBondColorMode}
        title="Toggle Bond Type Coloring (color bonds by type: covalent, ionic, metallic, hydrogen, van der Waals)"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border:
            bondColorMode === 'bondType'
              ? '2px solid #ff8888'
              : '1px solid rgba(255,255,255,0.15)',
          background:
            bondColorMode === 'bondType'
              ? 'rgba(255,100,100,0.3)'
              : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        Bnd
      </button>

      {/* Separator */}
      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.1)',
          margin: '4px 0',
        }}
      />

      {/* Challenge mode */}
      <button
        data-testid="toggle-challenge-mode"
        onClick={toggleChallengePanel}
        title="Challenge Mode"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border: showChallengePanel
            ? '2px solid #fbbf24'
            : '1px solid rgba(255,255,255,0.15)',
          background: showChallengePanel
            ? 'rgba(251,191,36,0.3)'
            : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        🏆
      </button>

      {/* Comparison mode */}
      <button
        data-testid="toggle-comparison-mode"
        onClick={toggleComparisonMode}
        title="Side-by-Side Comparison"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border: comparisonMode
            ? '2px solid #60a5fa'
            : '1px solid rgba(255,255,255,0.15)',
          background: comparisonMode
            ? 'rgba(96,165,250,0.3)'
            : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        A|B
      </button>

      {/* Reaction log toggle */}
      <button
        data-testid="toggle-reaction-log"
        onClick={toggleReactionLog}
        title="Reaction Log"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border: showReactionLog
            ? '2px solid #7ce87c'
            : '1px solid rgba(255,255,255,0.15)',
          background: showReactionLog
            ? 'rgba(124,232,124,0.3)'
            : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        ⚗
      </button>

      {/* Event log toggle */}
      <button
        data-testid="toggle-event-log"
        onClick={toggleEventLog}
        title="Event Log (Why Did That Happen?)"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border: showEventLog
            ? '2px solid #ffcc44'
            : '1px solid rgba(255,255,255,0.15)',
          background: showEventLog
            ? 'rgba(255,204,68,0.3)'
            : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        📋
      </button>

      {/* Guided experiments */}
      <button
        data-testid="toggle-experiment-panel"
        onClick={toggleExperimentPanel}
        title="Guided Experiments"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border: showExperimentPanel
            ? '2px solid #c084fc'
            : '1px solid rgba(255,255,255,0.15)',
          background: showExperimentPanel
            ? 'rgba(192,132,252,0.3)'
            : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        Lab
      </button>

      {/* Trajectory timeline toggle */}
      <button
        data-testid="toggle-timeline"
        onClick={toggleTimeline}
        title="Trajectory Timeline"
        style={{
          width: 40,
          height: 30,
          borderRadius: 4,
          border: showTimeline
            ? '2px solid #88ddff'
            : '1px solid rgba(255,255,255,0.15)',
          background: showTimeline
            ? 'rgba(136,221,255,0.3)'
            : 'rgba(40,40,60,0.8)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 9,
          fontFamily: 'monospace',
        }}
      >
        Traj
      </button>
    </div>
  );
};
