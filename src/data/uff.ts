// ==============================================================
// UFF (Universal Force Field) parameters
// Source: Rappé, Casewit, Colwell, Goddard, Skiff — JACS 1992
// Units: distances in Å, energies in kcal/mol (converted to eV internally)
// ==============================================================

import type { Hybridization, UFFAtomType } from './types';
import { getBDE } from './bondEnergies';

const KCAL_TO_EV = 0.0433641;

/**
 * UFF atom type parameters.
 * Key: element symbol (using generic type, e.g., sp3 default)
 * For a full implementation you'd key by hybridization too.
 */
const uffAtomTypes: Record<string, UFFAtomType> = {
  H: {
    label: 'H_',
    element: 'H',
    atomicNumber: 1,
    r1: 0.354,
    theta0: 180.0,
    x: 2.886,
    D: 0.044,
    zeta: 12.0,
    Z: 0.712,
    chi: 4.528,
  },
  He: {
    label: 'He4+4',
    element: 'He',
    atomicNumber: 2,
    r1: 0.849,
    theta0: 90.0,
    x: 2.362,
    D: 0.056,
    zeta: 15.24,
    Z: 0.098,
    chi: 9.66,
  },
  Li: {
    label: 'Li',
    element: 'Li',
    atomicNumber: 3,
    r1: 1.336,
    theta0: 180.0,
    x: 2.451,
    D: 0.025,
    zeta: 12.0,
    Z: 1.026,
    chi: 2.0,
  },
  Be: {
    label: 'Be3+2',
    element: 'Be',
    atomicNumber: 4,
    r1: 1.074,
    theta0: 109.47,
    x: 2.745,
    D: 0.085,
    zeta: 12.0,
    Z: 1.565,
    chi: 4.0,
  },
  B: {
    label: 'B_3',
    element: 'B',
    atomicNumber: 5,
    r1: 0.838,
    theta0: 109.47,
    x: 4.083,
    D: 0.18,
    zeta: 12.052,
    Z: 1.755,
    chi: 5.11,
  },
  C_3: {
    label: 'C_3',
    element: 'C',
    atomicNumber: 6,
    r1: 0.757,
    theta0: 109.47,
    x: 3.851,
    D: 0.105,
    zeta: 12.73,
    Z: 1.912,
    chi: 5.343,
  },
  C_R: {
    label: 'C_R',
    element: 'C',
    atomicNumber: 6,
    r1: 0.729,
    theta0: 120.0,
    x: 3.851,
    D: 0.105,
    zeta: 12.73,
    Z: 1.912,
    chi: 5.343,
  },
  C_2: {
    label: 'C_2',
    element: 'C',
    atomicNumber: 6,
    r1: 0.732,
    theta0: 120.0,
    x: 3.851,
    D: 0.105,
    zeta: 12.73,
    Z: 1.912,
    chi: 5.343,
  },
  C_1: {
    label: 'C_1',
    element: 'C',
    atomicNumber: 6,
    r1: 0.706,
    theta0: 180.0,
    x: 3.851,
    D: 0.105,
    zeta: 12.73,
    Z: 1.912,
    chi: 5.343,
  },
  N_3: {
    label: 'N_3',
    element: 'N',
    atomicNumber: 7,
    r1: 0.7,
    theta0: 106.7,
    x: 3.66,
    D: 0.069,
    zeta: 13.407,
    Z: 2.544,
    chi: 6.899,
  },
  N_R: {
    label: 'N_R',
    element: 'N',
    atomicNumber: 7,
    r1: 0.699,
    theta0: 120.0,
    x: 3.66,
    D: 0.069,
    zeta: 13.407,
    Z: 2.544,
    chi: 6.899,
  },
  N_2: {
    label: 'N_2',
    element: 'N',
    atomicNumber: 7,
    r1: 0.685,
    theta0: 111.2,
    x: 3.66,
    D: 0.069,
    zeta: 13.407,
    Z: 2.544,
    chi: 6.899,
  },
  N_1: {
    label: 'N_1',
    element: 'N',
    atomicNumber: 7,
    r1: 0.656,
    theta0: 180.0,
    x: 3.66,
    D: 0.069,
    zeta: 13.407,
    Z: 2.544,
    chi: 6.899,
  },
  O_3: {
    label: 'O_3',
    element: 'O',
    atomicNumber: 8,
    r1: 0.658,
    theta0: 104.51,
    x: 3.5,
    D: 0.06,
    zeta: 14.085,
    Z: 2.3,
    chi: 8.741,
  },
  O_R: {
    label: 'O_R',
    element: 'O',
    atomicNumber: 8,
    r1: 0.68,
    theta0: 110.0,
    x: 3.5,
    D: 0.06,
    zeta: 14.085,
    Z: 2.3,
    chi: 8.741,
  },
  O_2: {
    label: 'O_2',
    element: 'O',
    atomicNumber: 8,
    r1: 0.634,
    theta0: 120.0,
    x: 3.5,
    D: 0.06,
    zeta: 14.085,
    Z: 2.3,
    chi: 8.741,
  },
  O_1: {
    label: 'O_1',
    element: 'O',
    atomicNumber: 8,
    r1: 0.639,
    theta0: 180.0,
    x: 3.5,
    D: 0.06,
    zeta: 14.085,
    Z: 2.3,
    chi: 8.741,
  },
  F: {
    label: 'F_',
    element: 'F',
    atomicNumber: 9,
    r1: 0.668,
    theta0: 180.0,
    x: 3.364,
    D: 0.05,
    zeta: 14.762,
    Z: 2.3,
    chi: 10.874,
  },
  Ne: {
    label: 'Ne4+4',
    element: 'Ne',
    atomicNumber: 10,
    r1: 0.92,
    theta0: 90.0,
    x: 3.243,
    D: 0.042,
    zeta: 15.44,
    Z: 0.194,
    chi: 11.04,
  },
  Na: {
    label: 'Na',
    element: 'Na',
    atomicNumber: 11,
    r1: 1.539,
    theta0: 180.0,
    x: 2.983,
    D: 0.03,
    zeta: 12.0,
    Z: 1.081,
    chi: 2.843,
  },
  Mg: {
    label: 'Mg3+2',
    element: 'Mg',
    atomicNumber: 12,
    r1: 1.421,
    theta0: 109.47,
    x: 3.021,
    D: 0.111,
    zeta: 12.0,
    Z: 1.787,
    chi: 3.951,
  },
  Al: {
    label: 'Al3',
    element: 'Al',
    atomicNumber: 13,
    r1: 1.244,
    theta0: 109.47,
    x: 4.499,
    D: 0.505,
    zeta: 11.278,
    Z: 1.792,
    chi: 4.06,
  },
  Si: {
    label: 'Si3',
    element: 'Si',
    atomicNumber: 14,
    r1: 1.117,
    theta0: 109.47,
    x: 4.295,
    D: 0.402,
    zeta: 12.175,
    Z: 2.323,
    chi: 4.168,
  },
  P_3: {
    label: 'P_3+3',
    element: 'P',
    atomicNumber: 15,
    r1: 1.101,
    theta0: 93.8,
    x: 4.147,
    D: 0.305,
    zeta: 13.072,
    Z: 2.863,
    chi: 5.463,
  },
  S_3: {
    label: 'S_3+2',
    element: 'S',
    atomicNumber: 16,
    r1: 1.064,
    theta0: 92.1,
    x: 4.035,
    D: 0.274,
    zeta: 13.969,
    Z: 2.703,
    chi: 6.928,
  },
  Cl: {
    label: 'Cl',
    element: 'Cl',
    atomicNumber: 17,
    r1: 1.044,
    theta0: 180.0,
    x: 3.947,
    D: 0.227,
    zeta: 14.886,
    Z: 2.348,
    chi: 8.564,
  },
  Ar: {
    label: 'Ar4+4',
    element: 'Ar',
    atomicNumber: 18,
    r1: 1.032,
    theta0: 90.0,
    x: 3.868,
    D: 0.185,
    zeta: 15.763,
    Z: 0.3,
    chi: 9.465,
  },
  K: {
    label: 'K_',
    element: 'K',
    atomicNumber: 19,
    r1: 1.953,
    theta0: 180.0,
    x: 3.812,
    D: 0.035,
    zeta: 12.0,
    Z: 1.165,
    chi: 2.421,
  },
  Ca: {
    label: 'Ca6+2',
    element: 'Ca',
    atomicNumber: 20,
    r1: 1.761,
    theta0: 90.0,
    x: 3.399,
    D: 0.238,
    zeta: 12.0,
    Z: 2.141,
    chi: 3.231,
  },
  Fe: {
    label: 'Fe3+2',
    element: 'Fe',
    atomicNumber: 26,
    r1: 1.285,
    theta0: 109.47,
    x: 2.912,
    D: 0.013,
    zeta: 12.0,
    Z: 2.912,
    chi: 6.4,
  },
  Cu: {
    label: 'Cu3+1',
    element: 'Cu',
    atomicNumber: 29,
    r1: 1.302,
    theta0: 109.47,
    x: 3.495,
    D: 0.005,
    zeta: 12.0,
    Z: 1.956,
    chi: 4.2,
  },
  Zn: {
    label: 'Zn3+2',
    element: 'Zn',
    atomicNumber: 30,
    r1: 1.308,
    theta0: 109.47,
    x: 2.763,
    D: 0.124,
    zeta: 12.0,
    Z: 1.308,
    chi: 5.106,
  },
  Br: {
    label: 'Br',
    element: 'Br',
    atomicNumber: 35,
    r1: 1.141,
    theta0: 180.0,
    x: 4.189,
    D: 0.251,
    zeta: 15.0,
    Z: 2.519,
    chi: 7.79,
  },
  I: {
    label: 'I_',
    element: 'I',
    atomicNumber: 53,
    r1: 1.36,
    theta0: 180.0,
    x: 4.5,
    D: 0.339,
    zeta: 15.0,
    Z: 2.65,
    chi: 6.822,
  },

  // ---- Period 4 transition metals (Z=21–25, 27–28, 31–34, 36) ----
  // Source: Rappé et al., JACS 114, 10024 (1992), Table I
  Sc: {
    label: 'Sc3+3',
    element: 'Sc',
    atomicNumber: 21,
    r1: 1.7,
    theta0: 109.47,
    x: 3.295,
    D: 0.019,
    zeta: 12.0,
    Z: 2.592,
    chi: 3.395,
  },
  Ti: {
    label: 'Ti3+4',
    element: 'Ti',
    atomicNumber: 22,
    r1: 1.607,
    theta0: 109.47,
    x: 3.175,
    D: 0.017,
    zeta: 12.0,
    Z: 2.659,
    chi: 3.47,
  },
  V: {
    label: 'V_3+5',
    element: 'V',
    atomicNumber: 23,
    r1: 1.47,
    theta0: 109.47,
    x: 3.144,
    D: 0.016,
    zeta: 12.0,
    Z: 2.679,
    chi: 3.65,
  },
  Cr: {
    label: 'Cr6+3',
    element: 'Cr',
    atomicNumber: 24,
    r1: 1.402,
    theta0: 90.0,
    x: 3.023,
    D: 0.015,
    zeta: 12.0,
    Z: 2.463,
    chi: 3.415,
  },
  Mn: {
    label: 'Mn6+2',
    element: 'Mn',
    atomicNumber: 25,
    r1: 1.533,
    theta0: 90.0,
    x: 2.961,
    D: 0.013,
    zeta: 12.0,
    Z: 2.43,
    chi: 3.325,
  },
  Co: {
    label: 'Co6+3',
    element: 'Co',
    atomicNumber: 27,
    r1: 1.241,
    theta0: 90.0,
    x: 2.872,
    D: 0.014,
    zeta: 12.0,
    Z: 2.43,
    chi: 4.105,
  },
  Ni: {
    label: 'Ni4+2',
    element: 'Ni',
    atomicNumber: 28,
    r1: 1.164,
    theta0: 90.0,
    x: 2.834,
    D: 0.015,
    zeta: 12.0,
    Z: 2.43,
    chi: 4.465,
  },
  Ga: {
    label: 'Ga3+3',
    element: 'Ga',
    atomicNumber: 31,
    r1: 1.26,
    theta0: 109.47,
    x: 4.383,
    D: 0.415,
    zeta: 11.0,
    Z: 1.821,
    chi: 3.2,
  },
  Ge: {
    label: 'Ge3',
    element: 'Ge',
    atomicNumber: 32,
    r1: 1.197,
    theta0: 109.47,
    x: 4.28,
    D: 0.379,
    zeta: 12.0,
    Z: 2.789,
    chi: 4.051,
  },
  As: {
    label: 'As3+3',
    element: 'As',
    atomicNumber: 33,
    r1: 1.211,
    theta0: 92.1,
    x: 4.23,
    D: 0.309,
    zeta: 13.0,
    Z: 2.864,
    chi: 5.188,
  },
  Se: {
    label: 'Se3+2',
    element: 'Se',
    atomicNumber: 34,
    r1: 1.19,
    theta0: 90.6,
    x: 4.205,
    D: 0.291,
    zeta: 14.0,
    Z: 2.764,
    chi: 6.428,
  },
  Kr: {
    label: 'Kr4+4',
    element: 'Kr',
    atomicNumber: 36,
    r1: 1.166,
    theta0: 90.0,
    x: 4.141,
    D: 0.22,
    zeta: 16.0,
    Z: 0.452,
    chi: 8.505,
  },

  // ---- Period 5 (Z=37–54, except I already above) ----
  // Source: Rappé et al., JACS 114, 10024 (1992), Table I
  Rb: {
    label: 'Rb',
    element: 'Rb',
    atomicNumber: 37,
    r1: 2.26,
    theta0: 180.0,
    x: 4.114,
    D: 0.04,
    zeta: 12.0,
    Z: 1.592,
    chi: 2.331,
  },
  Sr: {
    label: 'Sr6+2',
    element: 'Sr',
    atomicNumber: 38,
    r1: 2.052,
    theta0: 90.0,
    x: 3.641,
    D: 0.235,
    zeta: 12.0,
    Z: 2.449,
    chi: 3.024,
  },
  Y: {
    label: 'Y_3+3',
    element: 'Y',
    atomicNumber: 39,
    r1: 1.898,
    theta0: 109.47,
    x: 3.345,
    D: 0.072,
    zeta: 12.0,
    Z: 3.257,
    chi: 3.83,
  },
  Zr: {
    label: 'Zr3+4',
    element: 'Zr',
    atomicNumber: 40,
    r1: 1.758,
    theta0: 109.47,
    x: 3.124,
    D: 0.069,
    zeta: 12.0,
    Z: 3.667,
    chi: 3.4,
  },
  Nb: {
    label: 'Nb3+5',
    element: 'Nb',
    atomicNumber: 41,
    r1: 1.603,
    theta0: 109.47,
    x: 3.165,
    D: 0.059,
    zeta: 12.0,
    Z: 3.618,
    chi: 3.55,
  },
  Mo: {
    label: 'Mo6+6',
    element: 'Mo',
    atomicNumber: 42,
    r1: 1.53,
    theta0: 90.0,
    x: 3.052,
    D: 0.056,
    zeta: 12.0,
    Z: 3.4,
    chi: 3.465,
  },
  Tc: {
    label: 'Tc6+5',
    element: 'Tc',
    atomicNumber: 43,
    r1: 1.5,
    theta0: 90.0,
    x: 2.998,
    D: 0.048,
    zeta: 12.0,
    Z: 3.4,
    chi: 3.29,
  },
  Ru: {
    label: 'Ru6+2',
    element: 'Ru',
    atomicNumber: 44,
    r1: 1.5,
    theta0: 90.0,
    x: 2.963,
    D: 0.056,
    zeta: 12.0,
    Z: 3.4,
    chi: 3.575,
  },
  Rh: {
    label: 'Rh6+3',
    element: 'Rh',
    atomicNumber: 45,
    r1: 1.509,
    theta0: 90.0,
    x: 2.929,
    D: 0.053,
    zeta: 12.0,
    Z: 3.508,
    chi: 3.975,
  },
  Pd: {
    label: 'Pd4+2',
    element: 'Pd',
    atomicNumber: 46,
    r1: 1.544,
    theta0: 90.0,
    x: 2.899,
    D: 0.048,
    zeta: 12.0,
    Z: 3.21,
    chi: 4.32,
  },
  Ag: {
    label: 'Ag1+1',
    element: 'Ag',
    atomicNumber: 47,
    r1: 1.622,
    theta0: 180.0,
    x: 3.148,
    D: 0.036,
    zeta: 12.0,
    Z: 1.956,
    chi: 4.436,
  },
  Cd: {
    label: 'Cd3+2',
    element: 'Cd',
    atomicNumber: 48,
    r1: 1.6,
    theta0: 109.47,
    x: 2.848,
    D: 0.228,
    zeta: 12.0,
    Z: 1.65,
    chi: 5.034,
  },
  In: {
    label: 'In3+3',
    element: 'In',
    atomicNumber: 49,
    r1: 1.404,
    theta0: 109.47,
    x: 4.463,
    D: 0.599,
    zeta: 11.0,
    Z: 2.07,
    chi: 3.506,
  },
  Sn: {
    label: 'Sn3',
    element: 'Sn',
    atomicNumber: 50,
    r1: 1.373,
    theta0: 109.47,
    x: 4.392,
    D: 0.567,
    zeta: 12.0,
    Z: 2.961,
    chi: 3.987,
  },
  Sb: {
    label: 'Sb3+3',
    element: 'Sb',
    atomicNumber: 51,
    r1: 1.432,
    theta0: 91.6,
    x: 4.42,
    D: 0.449,
    zeta: 13.0,
    Z: 2.704,
    chi: 4.899,
  },
  Te: {
    label: 'Te3+2',
    element: 'Te',
    atomicNumber: 52,
    r1: 1.28,
    theta0: 90.3,
    x: 4.47,
    D: 0.398,
    zeta: 14.0,
    Z: 2.882,
    chi: 5.816,
  },
  Xe: {
    label: 'Xe4+4',
    element: 'Xe',
    atomicNumber: 54,
    r1: 1.404,
    theta0: 90.0,
    x: 4.404,
    D: 0.332,
    zeta: 12.0,
    Z: 0.556,
    chi: 7.595,
  },

  // ---- Period 6 s-block (Z=55–56) ----
  // Source: Rappé et al., JACS 114, 10024 (1992), Table I
  Cs: {
    label: 'Cs',
    element: 'Cs',
    atomicNumber: 55,
    r1: 2.57,
    theta0: 180.0,
    x: 4.517,
    D: 0.045,
    zeta: 12.0,
    Z: 1.573,
    chi: 2.183,
  },
  Ba: {
    label: 'Ba6+2',
    element: 'Ba',
    atomicNumber: 56,
    r1: 2.277,
    theta0: 90.0,
    x: 3.703,
    D: 0.364,
    zeta: 12.0,
    Z: 2.727,
    chi: 2.814,
  },

  // ---- Lanthanides (Z=57–71) ----
  // Source: Rappé et al., JACS 114, 10024 (1992), Table I
  La: {
    label: 'La3+3',
    element: 'La',
    atomicNumber: 57,
    r1: 2.017,
    theta0: 109.47,
    x: 3.305,
    D: 0.017,
    zeta: 12.0,
    Z: 3.3,
    chi: 2.836,
  },
  Ce: {
    label: 'Ce6+3',
    element: 'Ce',
    atomicNumber: 58,
    r1: 1.995,
    theta0: 90.0,
    x: 3.304,
    D: 0.013,
    zeta: 12.0,
    Z: 3.3,
    chi: 2.774,
  },
  Pr: {
    label: 'Pr6+3',
    element: 'Pr',
    atomicNumber: 59,
    r1: 1.99,
    theta0: 90.0,
    x: 3.286,
    D: 0.01,
    zeta: 12.0,
    Z: 3.3,
    chi: 2.858,
  },
  Nd: {
    label: 'Nd6+3',
    element: 'Nd',
    atomicNumber: 60,
    r1: 1.978,
    theta0: 90.0,
    x: 3.272,
    D: 0.01,
    zeta: 12.0,
    Z: 3.3,
    chi: 2.869,
  },
  Pm: {
    label: 'Pm6+3',
    element: 'Pm',
    atomicNumber: 61,
    r1: 1.968,
    theta0: 90.0,
    x: 3.261,
    D: 0.009,
    zeta: 12.0,
    Z: 3.3,
    chi: 2.881,
  },
  Sm: {
    label: 'Sm6+3',
    element: 'Sm',
    atomicNumber: 62,
    r1: 1.958,
    theta0: 90.0,
    x: 3.251,
    D: 0.008,
    zeta: 12.0,
    Z: 3.3,
    chi: 2.912,
  },
  Eu: {
    label: 'Eu6+3',
    element: 'Eu',
    atomicNumber: 63,
    r1: 1.947,
    theta0: 90.0,
    x: 3.243,
    D: 0.008,
    zeta: 12.0,
    Z: 3.3,
    chi: 2.879,
  },
  Gd: {
    label: 'Gd6+3',
    element: 'Gd',
    atomicNumber: 64,
    r1: 1.918,
    theta0: 90.0,
    x: 3.231,
    D: 0.009,
    zeta: 12.0,
    Z: 3.3,
    chi: 3.167,
  },
  Tb: {
    label: 'Tb6+3',
    element: 'Tb',
    atomicNumber: 65,
    r1: 1.923,
    theta0: 90.0,
    x: 3.221,
    D: 0.007,
    zeta: 12.0,
    Z: 3.3,
    chi: 3.018,
  },
  Dy: {
    label: 'Dy6+3',
    element: 'Dy',
    atomicNumber: 66,
    r1: 1.912,
    theta0: 90.0,
    x: 3.211,
    D: 0.007,
    zeta: 12.0,
    Z: 3.3,
    chi: 3.056,
  },
  Ho: {
    label: 'Ho6+3',
    element: 'Ho',
    atomicNumber: 67,
    r1: 1.901,
    theta0: 90.0,
    x: 3.201,
    D: 0.007,
    zeta: 12.0,
    Z: 3.416,
    chi: 3.127,
  },
  Er: {
    label: 'Er6+3',
    element: 'Er',
    atomicNumber: 68,
    r1: 1.894,
    theta0: 90.0,
    x: 3.193,
    D: 0.007,
    zeta: 12.0,
    Z: 3.3,
    chi: 3.187,
  },
  Tm: {
    label: 'Tm6+3',
    element: 'Tm',
    atomicNumber: 69,
    r1: 1.886,
    theta0: 90.0,
    x: 3.185,
    D: 0.006,
    zeta: 12.0,
    Z: 3.3,
    chi: 3.252,
  },
  Yb: {
    label: 'Yb6+3',
    element: 'Yb',
    atomicNumber: 70,
    r1: 1.878,
    theta0: 90.0,
    x: 3.177,
    D: 0.228,
    zeta: 12.0,
    Z: 3.3,
    chi: 3.289,
  },
  Lu: {
    label: 'Lu6+3',
    element: 'Lu',
    atomicNumber: 71,
    r1: 1.862,
    theta0: 90.0,
    x: 3.168,
    D: 0.041,
    zeta: 12.0,
    Z: 3.271,
    chi: 2.963,
  },

  // ---- Period 6 d-block and p-block (Z=72–86) ----
  // Source: Rappé et al., JACS 114, 10024 (1992), Table I
  Hf: {
    label: 'Hf3+4',
    element: 'Hf',
    atomicNumber: 72,
    r1: 1.698,
    theta0: 109.47,
    x: 3.092,
    D: 0.072,
    zeta: 12.0,
    Z: 3.7,
    chi: 3.7,
  },
  Ta: {
    label: 'Ta3+5',
    element: 'Ta',
    atomicNumber: 73,
    r1: 1.603,
    theta0: 109.47,
    x: 3.17,
    D: 0.081,
    zeta: 12.0,
    Z: 3.731,
    chi: 4.11,
  },
  W: {
    label: 'W_6+6',
    element: 'W',
    atomicNumber: 74,
    r1: 1.53,
    theta0: 90.0,
    x: 3.069,
    D: 0.067,
    zeta: 12.0,
    Z: 3.31,
    chi: 3.12,
  },
  Re: {
    label: 'Re6+5',
    element: 'Re',
    atomicNumber: 75,
    r1: 1.5,
    theta0: 90.0,
    x: 2.954,
    D: 0.066,
    zeta: 12.0,
    Z: 3.92,
    chi: 3.189,
  },
  Os: {
    label: 'Os6+6',
    element: 'Os',
    atomicNumber: 76,
    r1: 1.5,
    theta0: 90.0,
    x: 3.12,
    D: 0.037,
    zeta: 12.0,
    Z: 3.92,
    chi: 3.817,
  },
  Ir: {
    label: 'Ir6+3',
    element: 'Ir',
    atomicNumber: 77,
    r1: 1.5,
    theta0: 90.0,
    x: 2.84,
    D: 0.073,
    zeta: 12.0,
    Z: 3.92,
    chi: 4.005,
  },
  Pt: {
    label: 'Pt4+2',
    element: 'Pt',
    atomicNumber: 78,
    r1: 1.364,
    theta0: 90.0,
    x: 2.754,
    D: 0.08,
    zeta: 12.0,
    Z: 3.92,
    chi: 4.533,
  },
  Au: {
    label: 'Au4+3',
    element: 'Au',
    atomicNumber: 79,
    r1: 1.262,
    theta0: 90.0,
    x: 3.293,
    D: 0.039,
    zeta: 12.0,
    Z: 2.65,
    chi: 4.899,
  },
  Hg: {
    label: 'Hg1+2',
    element: 'Hg',
    atomicNumber: 80,
    r1: 1.34,
    theta0: 180.0,
    x: 2.705,
    D: 0.385,
    zeta: 12.0,
    Z: 1.75,
    chi: 6.27,
  },
  Tl: {
    label: 'Tl3+3',
    element: 'Tl',
    atomicNumber: 81,
    r1: 1.518,
    theta0: 120.0,
    x: 4.347,
    D: 0.68,
    zeta: 11.0,
    Z: 2.068,
    chi: 3.2,
  },
  Pb: {
    label: 'Pb3',
    element: 'Pb',
    atomicNumber: 82,
    r1: 1.459,
    theta0: 109.47,
    x: 4.297,
    D: 0.663,
    zeta: 12.0,
    Z: 2.846,
    chi: 3.9,
  },
  Bi: {
    label: 'Bi3+3',
    element: 'Bi',
    atomicNumber: 83,
    r1: 1.512,
    theta0: 90.0,
    x: 4.37,
    D: 0.518,
    zeta: 13.0,
    Z: 2.47,
    chi: 4.69,
  },
  Po: {
    label: 'Po3+2',
    element: 'Po',
    atomicNumber: 84,
    r1: 1.5,
    theta0: 90.0,
    x: 4.709,
    D: 0.325,
    zeta: 14.0,
    Z: 2.33,
    chi: 4.21,
  },
  At: {
    label: 'At',
    element: 'At',
    atomicNumber: 85,
    r1: 1.545,
    theta0: 180.0,
    x: 4.75,
    D: 0.284,
    zeta: 15.0,
    Z: 2.24,
    chi: 4.75,
  },
  Rn: {
    label: 'Rn4+4',
    element: 'Rn',
    atomicNumber: 86,
    r1: 1.42,
    theta0: 90.0,
    x: 4.765,
    D: 0.248,
    zeta: 16.0,
    Z: 0.583,
    chi: 5.2,
  },
};

// Generic lookup by element symbol — returns the sp3/default type
const elementToUFF: Record<number, string> = {
  1: 'H',
  2: 'He',
  3: 'Li',
  4: 'Be',
  5: 'B',
  6: 'C_3',
  7: 'N_3',
  8: 'O_3',
  9: 'F',
  10: 'Ne',
  11: 'Na',
  12: 'Mg',
  13: 'Al',
  14: 'Si',
  15: 'P_3',
  16: 'S_3',
  17: 'Cl',
  18: 'Ar',
  19: 'K',
  20: 'Ca',
  21: 'Sc',
  22: 'Ti',
  23: 'V',
  24: 'Cr',
  25: 'Mn',
  26: 'Fe',
  27: 'Co',
  28: 'Ni',
  29: 'Cu',
  30: 'Zn',
  31: 'Ga',
  32: 'Ge',
  33: 'As',
  34: 'Se',
  35: 'Br',
  36: 'Kr',
  37: 'Rb',
  38: 'Sr',
  39: 'Y',
  40: 'Zr',
  41: 'Nb',
  42: 'Mo',
  43: 'Tc',
  44: 'Ru',
  45: 'Rh',
  46: 'Pd',
  47: 'Ag',
  48: 'Cd',
  49: 'In',
  50: 'Sn',
  51: 'Sb',
  52: 'Te',
  53: 'I',
  54: 'Xe',
  55: 'Cs',
  56: 'Ba',
  57: 'La',
  58: 'Ce',
  59: 'Pr',
  60: 'Nd',
  61: 'Pm',
  62: 'Sm',
  63: 'Eu',
  64: 'Gd',
  65: 'Tb',
  66: 'Dy',
  67: 'Ho',
  68: 'Er',
  69: 'Tm',
  70: 'Yb',
  71: 'Lu',
  72: 'Hf',
  73: 'Ta',
  74: 'W',
  75: 'Re',
  76: 'Os',
  77: 'Ir',
  78: 'Pt',
  79: 'Au',
  80: 'Hg',
  81: 'Tl',
  82: 'Pb',
  83: 'Bi',
  84: 'Po',
  85: 'At',
  86: 'Rn',
};

/**
 * Map (atomicNumber, hybridization) → UFF atom type key.
 * Falls back to the default elementToUFF mapping when no
 * hybridization-specific entry exists.
 *
 * Source: Rappé et al., JACS 114, 10024 (1992), Table I.
 * UFF naming: _1 = sp (linear), _2 = sp2 (trigonal), _R = resonant,
 *             _3 = sp3 (tetrahedral)
 */
const hybridToUFF: Record<number, Partial<Record<Hybridization, string>>> = {
  6: { sp: 'C_1', sp2: 'C_2', sp3: 'C_3' }, // Carbon
  7: { sp: 'N_1', sp2: 'N_2', sp3: 'N_3' }, // Nitrogen
  8: { sp: 'O_1', sp2: 'O_2', sp3: 'O_3' }, // Oxygen
};

export function getUFFType(atomicNumber: number): UFFAtomType | undefined {
  const key = elementToUFF[atomicNumber];
  return key ? uffAtomTypes[key] : undefined;
}

/**
 * Look up UFF atom type using hybridization when available.
 * Falls back to the default (sp3) type if no hybridization
 * mapping exists for this element.
 */
export function getUFFTypeHybrid(
  atomicNumber: number,
  hybridization?: Hybridization,
): UFFAtomType | undefined {
  if (hybridization) {
    const hybMap = hybridToUFF[atomicNumber];
    if (hybMap) {
      const key = hybMap[hybridization];
      if (key && uffAtomTypes[key]) return uffAtomTypes[key];
    }
  }
  // Fall back to default (sp3) lookup
  return getUFFType(atomicNumber);
}

/**
 * Compute UFF bond equilibrium distance between two atom types.
 * r_ij = r_i + r_j + r_BO + r_EN
 * r_BO = bond-order correction, r_EN = electronegativity correction
 *
 * When hybridization is provided, uses the hybridization-specific UFF
 * atom type (e.g. C_1 for sp carbon) which has a shorter natural bond
 * radius than the default sp3 type.
 * Source: Rappé et al., JACS 114, 10024 (1992), Eq. 3.
 */
export function getUFFBondLength(
  z1: number,
  z2: number,
  bondOrder: number = 1,
  hyb1?: Hybridization,
  hyb2?: Hybridization,
): number {
  const t1 = hyb1 ? getUFFTypeHybrid(z1, hyb1) : getUFFType(z1);
  const t2 = hyb2 ? getUFFTypeHybrid(z2, hyb2) : getUFFType(z2);
  if (!t1 || !t2) return 1.5; // fallback

  const r_BO = -0.1332 * (t1.r1 + t2.r1) * Math.log(bondOrder);
  const chiDiff = Math.sqrt(t1.chi) - Math.sqrt(t2.chi);
  const r_EN =
    (t1.r1 * t2.r1 * (chiDiff * chiDiff)) / (t1.chi * t1.r1 + t2.chi * t2.r1);
  return t1.r1 + t2.r1 + r_BO - r_EN;
}

/**
 * Compute Morse potential parameters for a bond.
 * Returns { De, alpha, re } in eV and Å.
 *
 * De is determined by cascading lookup:
 * 1. Experimental BDE table (element pair + bond order)
 * 2. Geometric-mean approximation from homonuclear BDEs
 * 3. Fallback: 70 × bondOrder kcal/mol (crude universal estimate)
 *
 * When hybridization is provided, re uses hybridization-specific UFF
 * atom types for more accurate equilibrium distances.
 *
 * @param z1 atomic number of first atom
 * @param z2 atomic number of second atom
 * @param bondOrder bond order (1, 2, or 3)
 * @param hyb1 optional hybridization of first atom
 * @param hyb2 optional hybridization of second atom
 */
export function getMorseBondParams(
  z1: number,
  z2: number,
  bondOrder: number = 1,
  hyb1?: Hybridization,
  hyb2?: Hybridization,
): {
  De: number;
  alpha: number;
  re: number;
} {
  const re = getUFFBondLength(z1, z2, bondOrder, hyb1, hyb2);

  // Look up UFF types (hybridization-aware if available) for force constant
  const t1 = hyb1 ? getUFFTypeHybrid(z1, hyb1) : getUFFType(z1);
  const t2 = hyb2 ? getUFFTypeHybrid(z2, hyb2) : getUFFType(z2);
  if (!t1 || !t2) return { De: 3.0, alpha: 2.0, re };

  // De from experimental BDE table, geometric-mean fallback, or crude estimate
  // Source: CRC Handbook of Chemistry and Physics, 97th Ed.;
  //         Pauling geometric-mean approximation (1960)
  const bde = getBDE(z1, z2, bondOrder);
  const baseDe = bde !== undefined ? bde : 70.0 * bondOrder; // kcal/mol
  const De = baseDe * KCAL_TO_EV; // convert to eV

  // alpha = sqrt(k_e / (2 * De)), k_e from UFF bond stretching
  // k_e (UFF) = 664.12 * Z*_i * Z*_j / r_ij^3
  // Source: Rappé et al., JACS 114, 10024 (1992), Eq. 6.
  const ke = (664.12 * (t1.Z * t2.Z)) / (re * re * re); // kcal/(mol·Å²)
  const keEV = ke * KCAL_TO_EV; // eV/ų
  const alpha = Math.sqrt(keEV / (2.0 * De));

  return { De, alpha, re };
}

/**
 * Get LJ (Lennard-Jones) parameters for a pair of atoms.
 * Uses geometric combining rules: σ = sqrt(σ_i * σ_j), ε = sqrt(ε_i * ε_j)
 * Returns { sigma, epsilon } in Å and eV
 */
export function getLJParams(
  z1: number,
  z2: number,
): { sigma: number; epsilon: number } {
  const t1 = getUFFType(z1);
  const t2 = getUFFType(z2);
  if (!t1 || !t2) return { sigma: 3.0, epsilon: 0.01 };

  const sigma = Math.sqrt(t1.x * t2.x);
  const epsilon = Math.sqrt(t1.D * t2.D) * KCAL_TO_EV;
  return { sigma, epsilon };
}

// Safety clamp for angle force constants.
// Range [0.05, 15.0] eV/rad² covers all UFF atom combinations:
//   - Lower bound: very soft angles like H-S-H (~1.3 eV/rad²) plus margin
//   - Upper bound: stiff bridges like C-O-C (~7 eV/rad²) plus margin
// Previous [0.5, 5.0] range was too tight and masked correct results.
function clampK(k: number): number {
  return Math.max(0.05, Math.min(15.0, k));
}

/**
 * Compute UFF angle bending force constant for angle I-J-K.
 * Uses the UFF formula from Rappé et al. JACS 114, 10024 (1992), Eq. 13.
 * Returns k_angle in eV/rad² (harmonic in θ). The cosine-harmonic
 * conversion (K/sin²θ₀) is done downstream in harmonicAngleForce().
 *
 * Validated K values (from Eq. 13 with UFF Table I parameters):
 *   H-O-H (water):      5.33 eV/rad² (123 kcal/mol/rad²)
 *   H-C-H (methane):    2.66 eV/rad² ( 61 kcal/mol/rad²)
 *   H-N-H (ammonia):    3.86 eV/rad² ( 89 kcal/mol/rad²)
 *   C-C-C (alkane):     4.05 eV/rad² ( 93 kcal/mol/rad²)
 *   O=C=O (CO₂, lin.):  5.92 eV      (137 kcal/mol, linear kA)
 *
 * @param zI atomic number of terminal atom I
 * @param zJ atomic number of central atom J
 * @param zK atomic number of terminal atom K
 * @param bondOrderIJ bond order of I-J bond
 * @param bondOrderJK bond order of J-K bond
 * @param hybridJ hybridization of central atom J (optional — uses sp3 default if omitted)
 */
export function getUFFAngleK(
  zI: number,
  zJ: number,
  zK: number,
  bondOrderIJ: number = 1,
  bondOrderJK: number = 1,
  hybridJ?: Hybridization,
): { kAngle: number; theta0: number } {
  const tI = getUFFType(zI);
  const tJ = getUFFTypeHybrid(zJ, hybridJ);
  const tK = getUFFType(zK);
  if (!tI || !tJ || !tK)
    return { kAngle: 3.0, theta0: (109.47 * Math.PI) / 180 };

  const theta0 = (tJ.theta0 * Math.PI) / 180.0;

  // For linear angles (θ₀ > 170°), harmonicAngleForce uses Eq. 10:
  //   V(θ) = kA * (1 + cosθ)
  // so kA has units of eV (not eV/rad²).
  //
  // We derive kA from the θ₀→180° limit of Eq. 13. As cosθ₀→−1 and
  // sin²θ₀→0, the bracket reduces to rIK², giving:
  //   K = (664.12 / (rIJ·rJK)) · (Z*I·Z*K / rIK³)   [kcal/mol]
  // Source: Rappé et al., JACS 114, 10024 (1992), Eqs. 10 & 13.
  if (tJ.theta0 > 170.0) {
    const rIJ = getUFFBondLength(zI, zJ, bondOrderIJ);
    const rJK = getUFFBondLength(zJ, zK, bondOrderJK);
    const rIK = rIJ + rJK; // linear 1-3 distance (θ₀ ≈ 180°)
    const rIK3 = rIK * rIK * rIK;
    const K_kcal = (664.12 / (rIJ * rJK)) * ((tI.Z * tK.Z) / rIK3);
    const kAngle = Math.abs(K_kcal) * KCAL_TO_EV;
    return {
      kAngle: clampK(kAngle),
      theta0,
    };
  }

  // Equilibrium bond lengths
  const rIJ = getUFFBondLength(zI, zJ, bondOrderIJ);
  const rJK = getUFFBondLength(zJ, zK, bondOrderJK);

  // 1-3 distance from law of cosines
  const cosTheta0 = Math.cos(theta0);
  const rIK2 = rIJ * rIJ + rJK * rJK - 2 * rIJ * rJK * cosTheta0;
  const rIK = Math.sqrt(Math.max(rIK2, 0.01));
  const rIK5 = rIK * rIK * rIK * rIK * rIK;

  // UFF angle force constant K_IJK from Rappé et al. JACS 114, 10024 (1992), Eq. 13:
  //   K = (664.12 / (r_IJ · r_JK)) · (Z*_I · Z*_K / r_IK^5) ·
  //       [3·r_IJ·r_JK·(1 − cos²θ₀) − r_IK²·cosθ₀]
  // This gives K in kcal/(mol·rad²). The cosine-harmonic conversion
  // (dividing by sin²θ₀) is handled downstream in harmonicAngleForce().
  const sinTheta0_2 = 1 - cosTheta0 * cosTheta0;
  const bracket = 3 * rIJ * rJK * sinTheta0_2 - rIK2 * cosTheta0;
  const K_kcal = (664.12 / (rIJ * rJK)) * ((tI.Z * tK.Z) / rIK5) * bracket;

  // Convert to eV/rad² (no sin²θ₀ division here — harmonicAngleForce does that)
  const kAngle = Math.abs(K_kcal) * KCAL_TO_EV;

  return {
    kAngle: clampK(kAngle),
    theta0,
  };
}

/**
 * UFF torsion barrier heights V_j for sp3 atoms (kcal/mol).
 * Used for sp3-sp3 pairs: V_φ = √(V_j · V_k).
 * Source: Rappé et al., JACS 114, 10024 (1992), Table I.
 */
const sp3TorsionBarrier: Record<number, number> = {
  6: 2.119, // C_3 — V_1 = 2.119 kcal/mol
  7: 0.45, // N_3 — V_1 = 0.450 kcal/mol (nitrogen lone pair reduces barrier)
  8: 0.018, // O_3 — V_1 = 0.018 kcal/mol (oxygen — very low barrier)
  15: 2.4, // P_3 — similar to C
  16: 0.484, // S_3 — V_1 = 0.484 kcal/mol
};

/**
 * UFF conjugation barrier U_j for sp2 atoms (kcal/mol).
 * Used for sp2-sp2 pairs: V_φ = 5·√(U_j · U_k)·(1 + 4.18·ln(BO)).
 * Source: Rappé et al., JACS 114, 10024 (1992), Table I.
 */
const sp2TorsionBarrier: Record<number, number> = {
  6: 2.0, // C_2 / C_R — conjugation barrier
  7: 2.0, // N_2 / N_R
  8: 2.0, // O_2 / O_R
};

/**
 * Compute UFF torsion parameters for a dihedral i-j-k-l.
 * Returns the barrier height V in eV, periodicity n, and equilibrium
 * dihedral φ₀ in radians.
 *
 * Rules from Rappé et al., JACS 114, 10024 (1992), Eq. 16:
 *   V(φ) = (V/2) · [1 − cos(nφ₀) · cos(nφ)]
 *
 * - sp3-sp3: V = √(V_j · V_k), n=3, φ₀=π (staggered preferred)
 * - sp2-sp2: V = 5·√(U_j · U_k)·(1 + 4.18·ln(BO)), n=2, φ₀=π
 * - sp2-sp3 or sp3-sp2: V = 1 kcal/mol, n=6, φ₀=0
 * - sp-anything or anything-sp: V = 0 (no barrier for linear)
 *
 * @param zJ atomic number of central atom j
 * @param zK atomic number of central atom k
 * @param hybJ hybridization of atom j
 * @param hybK hybridization of atom k
 * @param bondOrderJK bond order of the j-k bond
 * @returns { V: number (eV), n: number, phi0: number (rad) }
 */
export function getUFFTorsionParams(
  zJ: number,
  zK: number,
  hybJ: Hybridization,
  hybK: Hybridization,
  bondOrderJK: number = 1,
): { V: number; n: number; phi0: number } {
  // Linear atoms have no torsional barrier
  if (hybJ === 'sp' || hybK === 'sp') {
    return { V: 0, n: 1, phi0: 0 };
  }

  // Hydrogen (Z=1) has no hybridization and no torsion contribution
  // Treat as sp3-like for parameter purposes
  const effHybJ = zJ === 1 || hybJ === 'none' ? 'sp3' : hybJ;
  const effHybK = zK === 1 || hybK === 'none' ? 'sp3' : hybK;

  const jIsSp3 = effHybJ === 'sp3' || effHybJ === 'sp3d' || effHybJ === 'sp3d2';
  const kIsSp3 = effHybK === 'sp3' || effHybK === 'sp3d' || effHybK === 'sp3d2';
  const jIsSp2 = effHybJ === 'sp2';
  const kIsSp2 = effHybK === 'sp2';

  if (jIsSp3 && kIsSp3) {
    // sp3-sp3: three-fold barrier, staggered minimum
    const Vj = sp3TorsionBarrier[zJ] ?? 2.119; // default to carbon
    const Vk = sp3TorsionBarrier[zK] ?? 2.119;
    const V_kcal = Math.sqrt(Vj * Vk);
    return { V: V_kcal * KCAL_TO_EV, n: 3, phi0: Math.PI };
  }

  if (jIsSp2 && kIsSp2) {
    // sp2-sp2: two-fold barrier from conjugation
    const Uj = sp2TorsionBarrier[zJ] ?? 2.0;
    const Uk = sp2TorsionBarrier[zK] ?? 2.0;
    // Bond-order-dependent: V = 5·√(Uj·Uk)·(1 + 4.18·ln(BO))
    const boFactor = 1 + 4.18 * Math.log(Math.max(bondOrderJK, 1));
    const V_kcal = 5.0 * Math.sqrt(Uj * Uk) * boFactor;
    return { V: V_kcal * KCAL_TO_EV, n: 2, phi0: Math.PI };
  }

  // Mixed sp2-sp3 or sp3-sp2: six-fold barrier, low barrier
  if ((jIsSp2 && kIsSp3) || (jIsSp3 && kIsSp2)) {
    const V_kcal = 1.0; // 1 kcal/mol generic barrier
    return { V: V_kcal * KCAL_TO_EV, n: 6, phi0: 0 };
  }

  // Fallback: no torsion barrier
  return { V: 0, n: 1, phi0: 0 };
}

/**
 * Compute UFF inversion (out-of-plane) parameters for a center atom.
 *
 * The UFF inversion potential (Eq. 17 of Rappé et al.) is:
 *   V(ω) = K · [C0 + C1·cos(ω) + C2·cos(2ω)]
 *
 * where ω is the Wilson angle — the angle between a bond to the
 * out-of-plane atom and the plane defined by the center and two
 * in-plane atoms. For sp2 planarity, ω₀ = 0°.
 *
 * For an atom with 3 neighbors, 3 OOP terms are generated (one per
 * choice of the out-of-plane atom), each with K/3. For 4 neighbors,
 * C(4,1)=4 choices of OOP atom × 3 permutations = 12 terms, each
 * with K/12.
 *
 * Source: Rappé et al., JACS 114, 10024 (1992), Eq. 17.
 * Values: RDKit ForceField/UFF/Utils.cpp, Open Babel forcefielduff.cpp.
 *
 * @param zJ atomic number of the central atom
 * @param hybJ hybridization of the central atom
 * @param hasONeighbor whether the center has an sp2 oxygen neighbor
 *                     (for C sp2 bonded to O, K increases from 6→50)
 * @returns { K: number (eV), C0, C1, C2 } or null if no inversion
 */
export function getUFFInversionParams(
  zJ: number,
  hybJ: Hybridization,
  hasONeighbor: boolean = false,
): { K: number; C0: number; C1: number; C2: number } | null {
  // Carbon sp2 / aromatic
  if (zJ === 6 && hybJ === 'sp2') {
    // K = 6 kcal/mol for general sp2 C; 50 kcal/mol when bonded to O_2
    // Source: Rappé et al. Table I; RDKit Utils.cpp
    const K_kcal = hasONeighbor ? 50.0 : 6.0;
    return { K: K_kcal * KCAL_TO_EV, C0: 1.0, C1: -1.0, C2: 0.0 };
  }

  // Carbon sp3 (e.g., methane) — enforce tetrahedral geometry
  // The out-of-plane angle for a perfect tetrahedron is:
  //   ω₀ = arcsin(1/√3) ≈ 35.264° → sin(ω₀) ≈ 0.57735
  // Using the general cosine expansion V(ω) = K(C0 + C1·cos(ω) + C2·cos(2ω))
  // with the constraint that V'(ω₀) = 0 and V(ω₀) = 0:
  //   C2 = 1, C1 = -4·cos(ω₀) = -4·√(2/3) ≈ -3.2660
  //   C0 = -(C1·cos(ω₀) + C2·cos(2ω₀))
  // K = 6 kcal/mol (same as sp2 C, provides stiffness without being too rigid)
  // Source: analogy with Rappé Eq. 17 for group-15 sp3 parameterization.
  if (zJ === 6 && hybJ === 'sp3') {
    const w0 = Math.asin(1 / Math.sqrt(3)); // ≈ 0.6155 rad ≈ 35.26°
    const cosW0 = Math.cos(w0);
    const C2 = 1.0;
    const C1 = -4.0 * cosW0;
    const C0 = -(C1 * cosW0 + C2 * Math.cos(2 * w0));
    const K_kcal = 6.0;
    return { K: K_kcal * KCAL_TO_EV, C0, C1, C2 };
  }

  // Nitrogen sp2 / aromatic
  if (zJ === 7 && hybJ === 'sp2') {
    return { K: 6.0 * KCAL_TO_EV, C0: 1.0, C1: -1.0, C2: 0.0 };
  }

  // Nitrogen sp3 (e.g., NH3) — pyramidal equilibrium
  // ω₀ ≈ asin(cos(106.7°) / cos(106.7°/2)) ≈ 25.5° (approximate)
  // Use same approach as group 15
  if (zJ === 7 && hybJ === 'sp3') {
    const theta0_rad = (106.7 * Math.PI) / 180.0;
    // For sp3 N, the OOP angle relates to the bond angle by:
    // sin(ω₀) = cos(θ₀) / cos(θ₀/2) ... but for simplicity use the
    // standard UFF parameterization for N_3 which is similar to C sp3
    const w0 = Math.asin(
      Math.abs(Math.cos(theta0_rad)) / Math.cos(theta0_rad / 2),
    );
    const cosW0 = Math.cos(w0);
    const C2 = 1.0;
    const C1 = -4.0 * cosW0;
    const C0 = -(C1 * cosW0 + C2 * Math.cos(2 * w0));
    return { K: 6.0 * KCAL_TO_EV, C0, C1, C2 };
  }

  // Oxygen sp2
  if (zJ === 8 && hybJ === 'sp2') {
    return { K: 6.0 * KCAL_TO_EV, C0: 1.0, C1: -1.0, C2: 0.0 };
  }

  // Group 15 sp3: P, As, Sb, Bi
  // Source: Rappé et al., JACS 114, 10024 (1992), Table I
  const group15Angles: Record<number, number> = {
    15: 84.4339, // P
    33: 86.9735, // As
    51: 87.7047, // Sb
    83: 90.0, // Bi
  };
  const w0Deg = group15Angles[zJ];
  if (w0Deg !== undefined) {
    const w0 = (w0Deg * Math.PI) / 180.0;
    const cosW0 = Math.cos(w0);
    const C2 = 1.0;
    const C1 = -4.0 * cosW0;
    const C0 = -(C1 * cosW0 + C2 * Math.cos(2 * w0));
    const K_kcal = 22.0;
    return { K: K_kcal * KCAL_TO_EV, C0, C1, C2 };
  }

  return null;
}

export { uffAtomTypes, KCAL_TO_EV };
