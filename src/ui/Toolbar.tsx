// ==============================================================
// Toolbar — tool selection and view mode buttons
// ==============================================================

import React from 'react';
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
  const renderMode = useUIStore((s) => s.renderMode);
  const setRenderMode = useUIStore((s) => s.setRenderMode);
  const toggleLabels = useUIStore((s) => s.toggleLabels);
  const showLabels = useUIStore((s) => s.showLabels);
  const toggleEnergyPlot = useUIStore((s) => s.toggleEnergyPlot);
  const colorMode = useUIStore((s) => s.colorMode);
  const setColorMode = useUIStore((s) => s.setColorMode);

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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTool, toggleLabels]);

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
          onClick={() => setActiveTool(tool.id)}
        />
      ))}

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
    </div>
  );
};
