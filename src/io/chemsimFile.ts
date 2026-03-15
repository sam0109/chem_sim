// ==============================================================
// .chemsim file format — serialize/deserialize simulation state
//
// Supports two export modes:
//   1. File export: JSON saved as .chemsim file
//   2. URL sharing: compressed base64url-encoded URL parameter
//
// Uses browser-native CompressionStream API (deflate-raw) for
// URL encoding — no external dependencies required.
// Supported: Chrome 80+, Firefox 113+, Safari 16.4+.
// ==============================================================

import type {
  Atom,
  Bond,
  SimulationConfig,
  SimulationBox,
  ColorMode,
  Hybridization,
  BondType,
} from '../data/types';

// --------------- Schema Types ---------------

/** Atom fields persisted to file (excludes runtime `force` field) */
export interface SerializedAtom {
  id: number;
  elementNumber: number;
  position: [number, number, number];
  velocity: [number, number, number];
  charge: number;
  hybridization: Hybridization;
  fixed: boolean;
}

/** Subset of UI state that affects the viewer experience */
export interface SavedUISettings {
  renderMode: 'ball-and-stick' | 'space-filling' | 'wireframe';
  showLabels: boolean;
  colorMode: ColorMode;
}

/** Optional lesson metadata */
export interface LessonMetadata {
  title?: string;
  description?: string;
  createdAt: string;
}

/** Version 1 of the .chemsim file format */
export interface ChemSimFileV1 {
  version: 1;
  atoms: SerializedAtom[];
  bonds: Bond[];
  config: SimulationConfig;
  box: SimulationBox;
  ui: SavedUISettings;
  metadata: LessonMetadata;
}

// --------------- Serialize / Deserialize ---------------

function serializeAtom(atom: Atom): SerializedAtom {
  return {
    id: atom.id,
    elementNumber: atom.elementNumber,
    position: [...atom.position],
    velocity: [...atom.velocity],
    charge: atom.charge,
    hybridization: atom.hybridization,
    fixed: atom.fixed,
  };
}

function deserializeAtom(sa: SerializedAtom): Atom {
  return {
    id: sa.id,
    elementNumber: sa.elementNumber,
    position: sa.position,
    velocity: sa.velocity,
    force: [0, 0, 0],
    charge: sa.charge,
    hybridization: sa.hybridization,
    fixed: sa.fixed,
  };
}

/** Input required to serialize simulation state (avoids importing stores) */
export interface SerializeInput {
  atoms: Atom[];
  bonds: Bond[];
  config: SimulationConfig;
  box: SimulationBox;
  ui: SavedUISettings;
}

/** Build a ChemSimFileV1 from the given state snapshot */
export function serializeState(input: SerializeInput): ChemSimFileV1 {
  return {
    version: 1,
    atoms: input.atoms.map(serializeAtom),
    bonds: input.bonds.map((b) => ({ ...b })),
    config: { ...input.config, running: false },
    box: { ...input.box },
    ui: { ...input.ui },
    metadata: {
      createdAt: new Date().toISOString(),
    },
  };
}

/** Returned by deserializeState so the caller can apply atoms+bonds and UI separately */
export interface DeserializedState {
  atoms: Atom[];
  bonds: Bond[];
  config: SimulationConfig;
  box: SimulationBox;
  ui: SavedUISettings;
  metadata: LessonMetadata;
}

export function deserializeState(file: ChemSimFileV1): DeserializedState {
  return {
    atoms: file.atoms.map(deserializeAtom),
    bonds: file.bonds,
    config: { ...file.config, running: false },
    box: file.box,
    ui: file.ui,
    metadata: file.metadata,
  };
}

// --------------- Validation ---------------

const VALID_HYBRIDIZATIONS: ReadonlySet<string> = new Set<Hybridization>([
  'sp',
  'sp2',
  'sp3',
  'sp3d',
  'sp3d2',
  'none',
]);

const VALID_BOND_TYPES: ReadonlySet<string> = new Set<BondType>([
  'covalent',
  'ionic',
  'metallic',
  'hydrogen',
  'vanderwaals',
]);

const VALID_THERMOSTATS: ReadonlySet<string> = new Set([
  'none',
  'berendsen',
  'nose-hoover',
]);

const VALID_RENDER_MODES: ReadonlySet<string> = new Set([
  'ball-and-stick',
  'space-filling',
  'wireframe',
]);

const VALID_COLOR_MODES: ReadonlySet<string> = new Set<ColorMode>([
  'element',
  'molecule',
]);

function isVector3Tuple(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number'
  );
}

/** Validate a parsed JSON object as a ChemSimFileV1. Throws on invalid data. */
export function validateChemSimFile(data: unknown): ChemSimFileV1 {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid .chemsim file: not an object');
  }

  const obj = data as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new Error(
      `Unsupported .chemsim version: ${String(obj.version)} (expected 1)`,
    );
  }

  // Validate atoms
  if (!Array.isArray(obj.atoms)) {
    throw new Error('Invalid .chemsim file: atoms must be an array');
  }
  for (let i = 0; i < obj.atoms.length; i++) {
    const a = obj.atoms[i] as Record<string, unknown>;
    if (typeof a.id !== 'number') {
      throw new Error(`Invalid atom[${i}]: missing or invalid id`);
    }
    if (typeof a.elementNumber !== 'number' || a.elementNumber < 1) {
      throw new Error(`Invalid atom[${i}]: missing or invalid elementNumber`);
    }
    if (!isVector3Tuple(a.position)) {
      throw new Error(`Invalid atom[${i}]: position must be [x, y, z]`);
    }
    if (!isVector3Tuple(a.velocity)) {
      throw new Error(`Invalid atom[${i}]: velocity must be [vx, vy, vz]`);
    }
    if (typeof a.charge !== 'number') {
      throw new Error(`Invalid atom[${i}]: missing or invalid charge`);
    }
    if (!VALID_HYBRIDIZATIONS.has(a.hybridization as string)) {
      throw new Error(`Invalid atom[${i}]: invalid hybridization`);
    }
    if (typeof a.fixed !== 'boolean') {
      throw new Error(`Invalid atom[${i}]: fixed must be a boolean`);
    }
  }

  // Validate bonds
  if (!Array.isArray(obj.bonds)) {
    throw new Error('Invalid .chemsim file: bonds must be an array');
  }
  for (let i = 0; i < obj.bonds.length; i++) {
    const b = obj.bonds[i] as Record<string, unknown>;
    if (typeof b.atomA !== 'number' || typeof b.atomB !== 'number') {
      throw new Error(`Invalid bond[${i}]: atomA and atomB must be numbers`);
    }
    if (typeof b.order !== 'number') {
      throw new Error(`Invalid bond[${i}]: order must be a number`);
    }
    if (!VALID_BOND_TYPES.has(b.type as string)) {
      throw new Error(`Invalid bond[${i}]: invalid bond type`);
    }
  }

  // Validate config
  const cfg = obj.config as Record<string, unknown> | undefined;
  if (typeof cfg !== 'object' || cfg === null) {
    throw new Error('Invalid .chemsim file: config must be an object');
  }
  if (typeof cfg.timestep !== 'number' || cfg.timestep <= 0) {
    throw new Error('Invalid config: timestep must be a positive number');
  }
  if (typeof cfg.temperature !== 'number' || cfg.temperature < 0) {
    throw new Error(
      'Invalid config: temperature must be a non-negative number',
    );
  }
  if (!VALID_THERMOSTATS.has(cfg.thermostat as string)) {
    throw new Error('Invalid config: invalid thermostat type');
  }
  if (typeof cfg.thermostatTau !== 'number') {
    throw new Error('Invalid config: thermostatTau must be a number');
  }
  if (typeof cfg.cutoff !== 'number' || cfg.cutoff <= 0) {
    throw new Error('Invalid config: cutoff must be a positive number');
  }

  // Validate box
  const box = obj.box as Record<string, unknown> | undefined;
  if (typeof box !== 'object' || box === null) {
    throw new Error('Invalid .chemsim file: box must be an object');
  }
  if (!isVector3Tuple(box.size)) {
    throw new Error('Invalid box: size must be [Lx, Ly, Lz]');
  }
  if (typeof box.periodic !== 'boolean') {
    throw new Error('Invalid box: periodic must be a boolean');
  }

  // Validate ui
  const ui = obj.ui as Record<string, unknown> | undefined;
  if (typeof ui !== 'object' || ui === null) {
    throw new Error('Invalid .chemsim file: ui must be an object');
  }
  if (!VALID_RENDER_MODES.has(ui.renderMode as string)) {
    throw new Error('Invalid ui: invalid renderMode');
  }
  if (typeof ui.showLabels !== 'boolean') {
    throw new Error('Invalid ui: showLabels must be a boolean');
  }
  if (!VALID_COLOR_MODES.has(ui.colorMode as string)) {
    throw new Error('Invalid ui: invalid colorMode');
  }

  return data as ChemSimFileV1;
}

// --------------- URL Compression (deflate-raw via CompressionStream) ---------------

/** Compress a Uint8Array using deflate-raw via the Compression Streams API */
async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

/** Decompress a deflate-raw Uint8Array via the Compression Streams API */
async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

// Base64url encoding/decoding (RFC 4648 §5, no padding)
function toBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(str: string): Uint8Array {
  // Restore standard base64 padding
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Serialize state → compressed base64url string for URL embedding */
export async function stateToUrlParam(input: SerializeInput): Promise<string> {
  const state = serializeState(input);
  const json = JSON.stringify(state);
  const encoded = new TextEncoder().encode(json);
  const compressed = await compress(encoded);
  return toBase64url(compressed);
}

/** Decode a base64url URL parameter → validated ChemSimFileV1 */
export async function urlParamToState(param: string): Promise<ChemSimFileV1> {
  const compressed = fromBase64url(param);
  const decompressed = await decompress(compressed);
  const json = new TextDecoder().decode(decompressed);
  const data: unknown = JSON.parse(json);
  return validateChemSimFile(data);
}

// --------------- File Save / Load ---------------

/** Trigger download of a state snapshot as a .chemsim JSON file */
export function saveToFile(input: SerializeInput, filename?: string): void {
  const state = serializeState(input);
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? 'simulation.chemsim';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse and validate a .chemsim file */
export async function loadFromFile(file: File): Promise<ChemSimFileV1> {
  const text = await file.text();
  const data: unknown = JSON.parse(text);
  return validateChemSimFile(data);
}
