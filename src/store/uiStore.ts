// ==============================================================
// Zustand store for UI state
// ==============================================================

import { create } from 'zustand';
import type {
  InteractionTool,
  MeasurementResult,
  ColorMode,
  PeriodicTableColorMode,
} from '../data/types';

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
  showChallengePanel: boolean;
  togglePeriodicTable: () => void;
  togglePropertyPanel: () => void;
  toggleEnergyPlot: () => void;
  toggleChallengePanel: () => void;

  // ---- Hover ----
  hoveredAtomId: number | null;
  setHoveredAtom: (id: number | null) => void;

  // ---- Periodic table education features ----
  periodicTableColorMode: PeriodicTableColorMode;
  setPeriodicTableColorMode: (mode: PeriodicTableColorMode) => void;
  hoveredElement: number | null;
  setHoveredElement: (z: number | null) => void;
  comparedElements: [number, number] | null;
  setComparedElements: (pair: [number, number] | null) => void;
  clearComparedElements: () => void;
  showTrendAnnotations: boolean;
  toggleTrendAnnotations: () => void;

  // ---- Rendering options ----
  renderMode: 'ball-and-stick' | 'space-filling' | 'wireframe';
  setRenderMode: (
    mode: 'ball-and-stick' | 'space-filling' | 'wireframe',
  ) => void;
  showLabels: boolean;
  toggleLabels: () => void;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;

  // ---- Comparison mode ----
  comparisonMode: boolean;
  toggleComparisonMode: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  activeTool: 'select',
  selectedElement: 6, // Carbon by default
  selectedAtomIds: [],
  measurements: [],
  showPeriodicTable: true,
  showPropertyPanel: true,
  showEnergyPlot: false,
  showChallengePanel: false,
  hoveredAtomId: null,
  renderMode: 'ball-and-stick',
  showLabels: true,
  colorMode: 'element' as ColorMode,
  periodicTableColorMode: 'category' as PeriodicTableColorMode,
  hoveredElement: null,
  comparedElements: null,
  showTrendAnnotations: false,
  comparisonMode: false,

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
  toggleChallengePanel: () =>
    set({ showChallengePanel: !get().showChallengePanel }),

  setHoveredAtom: (id) => set({ hoveredAtomId: id }),

  setPeriodicTableColorMode: (mode) => set({ periodicTableColorMode: mode }),
  setHoveredElement: (z) => set({ hoveredElement: z }),
  setComparedElements: (pair) => set({ comparedElements: pair }),
  clearComparedElements: () => set({ comparedElements: null }),
  toggleTrendAnnotations: () =>
    set({ showTrendAnnotations: !get().showTrendAnnotations }),

  setRenderMode: (mode) => set({ renderMode: mode }),
  toggleLabels: () => set({ showLabels: !get().showLabels }),
  setColorMode: (mode) => set({ colorMode: mode }),
  toggleComparisonMode: () => set({ comparisonMode: !get().comparisonMode }),
}));
