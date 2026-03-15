// ==============================================================
// Bond type color map for bond-type-based coloring mode
//
// Colors chosen to follow common chemistry education conventions:
// - Covalent (electron sharing): green
// - Ionic (electrostatic): red
// - Metallic (electron sea): silver/gray
// - Hydrogen bond (weak directional): blue
// - Van der Waals (weakest, dispersion): purple
//
// Sources:
// - General chemistry textbook conventions (Zumdahl, Silberberg)
// - Material Design color palette for accessibility and visual clarity
// ==============================================================

import type { BondType } from './types';

/** Hex color for each bond type, used in both 3D rendering and UI labels */
export const BOND_TYPE_COLORS: Record<BondType, string> = {
  covalent: '#4CAF50', // Material Design Green 500
  ionic: '#F44336', // Material Design Red 500
  metallic: '#9E9E9E', // Material Design Grey 500
  hydrogen: '#2196F3', // Material Design Blue 500
  vanderwaals: '#9C27B0', // Material Design Purple 500
};
