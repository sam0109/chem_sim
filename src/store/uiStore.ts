// ==============================================================
// Zustand store for UI state
// ==============================================================

import { create } from 'zustand';
import type {
  InteractionTool,
  MeasurementResult,
  ColorMode,
  BondColorMode,
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
  showEncounterPanel: boolean;
  showReactionLog: boolean;
  togglePeriodicTable: () => void;
  togglePropertyPanel: () => void;
  toggleEnergyPlot: () => void;
  toggleChallengePanel: () => void;
  toggleEncounterPanel: () => void;
  toggleReactionLog: () => void;

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
  bondColorMode: BondColorMode;
  setBondColorMode: (mode: BondColorMode) => void;
  toggleBondColorMode: () => void;

  // ---- Comparison mode ----
  comparisonMode: boolean;
  toggleComparisonMode: () => void;

  // ---- Encounter setup ----
  /** Molecule template name for placement (key of exampleMolecules) */
  selectedMoleculeTemplate: string | null;
  setSelectedMoleculeTemplate: (name: string | null) => void;
  /** Initial center-of-mass separation in Å */
  encounterSeparation: number;
  setEncounterSeparation: (d: number) => void;
  /** Relative approach speed in Å/fs */
  encounterSpeed: number;
  setEncounterSpeed: (v: number) => void;
  /** Impact parameter (perpendicular offset) in Å */
  encounterImpactParam: number;
  setEncounterImpactParam: (b: number) => void;

  // ---- Orbital visualization ----
  /** Whether orbital isosurfaces are displayed */
  showOrbitals: boolean;
  toggleOrbitals: () => void;
  /** Currently selected orbital quantum numbers, or null for none */
  selectedOrbital: { n: number; l: number; m: number } | null;
  setSelectedOrbital: (
    orbital: { n: number; l: number; m: number } | null,
  ) => void;
  /** Isosurface threshold for orbital rendering (default 0.02) */
  orbitalIsovalue: number;
  setOrbitalIsovalue: (v: number) => void;
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
  showEncounterPanel: false,
  showReactionLog: false,
  hoveredAtomId: null,
  renderMode: 'ball-and-stick',
  showLabels: true,
  colorMode: 'element' as ColorMode,
  bondColorMode: 'element' as BondColorMode,
  periodicTableColorMode: 'category' as PeriodicTableColorMode,
  hoveredElement: null,
  comparedElements: null,
  showTrendAnnotations: false,
  comparisonMode: false,

  // Encounter defaults
  selectedMoleculeTemplate: null,
  encounterSeparation: 8, // Å
  encounterSpeed: 0.01, // Å/fs (~1000 m/s)
  encounterImpactParam: 0, // Å (head-on)

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
  toggleEncounterPanel: () =>
    set({ showEncounterPanel: !get().showEncounterPanel }),
  toggleReactionLog: () => set({ showReactionLog: !get().showReactionLog }),

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
  setBondColorMode: (mode) => set({ bondColorMode: mode }),
  toggleBondColorMode: () =>
    set({
      bondColorMode: get().bondColorMode === 'element' ? 'bondType' : 'element',
    }),
  toggleComparisonMode: () => set({ comparisonMode: !get().comparisonMode }),

  // Encounter setters
  setSelectedMoleculeTemplate: (name) =>
    set({ selectedMoleculeTemplate: name }),
  setEncounterSeparation: (d) => set({ encounterSeparation: d }),
  setEncounterSpeed: (v) => set({ encounterSpeed: v }),
  setEncounterImpactParam: (b) => set({ encounterImpactParam: b }),

  // Orbital visualization
  showOrbitals: false,
  selectedOrbital: null,
  orbitalIsovalue: 0.02,
  toggleOrbitals: () => set({ showOrbitals: !get().showOrbitals }),
  setSelectedOrbital: (orbital) => set({ selectedOrbital: orbital }),
  setOrbitalIsovalue: (v) => set({ orbitalIsovalue: v }),
}));
