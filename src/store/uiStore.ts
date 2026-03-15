// ==============================================================
// Zustand store for UI state
// ==============================================================

import { create } from 'zustand';
import type { InteractionTool, MeasurementResult } from '../data/types';

interface UIStore {
  // ---- Tool state ----
  activeTool: InteractionTool;
  setActiveTool: (tool: InteractionTool) => void;

  // ---- Element selection (for place-atom tool) ----
  selectedElement: number; // atomic number
  setSelectedElement: (z: number) => void;

  // ---- Atom selection ----
  selectedAtomIds: number[];
  selectAtom: (id: number, multi?: boolean) => void;
  clearSelection: () => void;

  // ---- Measurements ----
  measurements: MeasurementResult[];
  addMeasurement: (m: MeasurementResult) => void;
  clearMeasurements: () => void;

  // ---- Panel visibility ----
  showPeriodicTable: boolean;
  showPropertyPanel: boolean;
  showEnergyPlot: boolean;
  togglePeriodicTable: () => void;
  togglePropertyPanel: () => void;
  toggleEnergyPlot: () => void;

  // ---- Hover ----
  hoveredAtomId: number | null;
  setHoveredAtom: (id: number | null) => void;

  // ---- Rendering options ----
  renderMode: 'ball-and-stick' | 'space-filling' | 'wireframe';
  setRenderMode: (
    mode: 'ball-and-stick' | 'space-filling' | 'wireframe',
  ) => void;
  showLabels: boolean;
  toggleLabels: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  activeTool: 'select',
  selectedElement: 6, // Carbon by default
  selectedAtomIds: [],
  measurements: [],
  showPeriodicTable: true,
  showPropertyPanel: true,
  showEnergyPlot: false,
  hoveredAtomId: null,
  renderMode: 'ball-and-stick',
  showLabels: true,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setSelectedElement: (z) => set({ selectedElement: z }),

  selectAtom: (id, multi = false) => {
    if (multi) {
      const { selectedAtomIds } = get();
      const idx = selectedAtomIds.indexOf(id);
      if (idx >= 0) {
        set({ selectedAtomIds: selectedAtomIds.filter((_, i) => i !== idx) });
      } else {
        set({ selectedAtomIds: [...selectedAtomIds, id] });
      }
    } else {
      set({ selectedAtomIds: [id] });
    }
  },

  clearSelection: () => set({ selectedAtomIds: [] }),

  addMeasurement: (m) => set({ measurements: [...get().measurements, m] }),
  clearMeasurements: () => set({ measurements: [] }),

  togglePeriodicTable: () =>
    set({ showPeriodicTable: !get().showPeriodicTable }),
  togglePropertyPanel: () =>
    set({ showPropertyPanel: !get().showPropertyPanel }),
  toggleEnergyPlot: () => set({ showEnergyPlot: !get().showEnergyPlot }),

  setHoveredAtom: (id) => set({ hoveredAtomId: id }),

  setRenderMode: (mode) => set({ renderMode: mode }),
  toggleLabels: () => set({ showLabels: !get().showLabels }),
}));
