// ==============================================================
// ChemSim Physics Invariant Test Suite
// Run: npx tsx src/engine/tests.ts
//
// Each test runs the simulation for N steps on a known molecule
// and checks physically meaningful invariants. PASS/FAIL is
// determined by whether the measured value falls within the
// expected range based on known chemistry.
// ==============================================================

import elements from '../data/elements';
import { getMorseBondParams, getLJParams, getUFFAngleK } from '../data/uff';
import { morseBondForce } from './forces/morse';
import { ljForce } from './forces/lennardJones';
import { coulombForce } from './forces/coulomb';
import { harmonicAngleForce } from './forces/harmonic';
import { pauliRepulsion } from './forces/pauli';
import { detectBonds, buildAngleList } from './bondDetector';
import {
  velocityVerletStep,
  initializeVelocities,
  computeTemperature,
} from './integrator';
import { berendsenThermostat } from './thermostat';
import { computeGasteigerCharges, buildCovalentAtomSet } from './gasteiger';
import { detectHybridization } from './hybridization';
import {
  waterMolecule,
  methaneMolecule,
  co2Molecule,
  naclPair,
  ethanolMolecule,
} from '../io/examples';
import type { Atom, Bond } from '../data/types';

// ---- Deterministic PRNG for reproducible tests ----
// Mulberry32: a simple 32-bit seeded PRNG (public domain)
// Source: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seed Math.random for deterministic test results
const seededRng = mulberry32(42);
Math.random = seededRng;

// ---- Known failures: tests skipped due to missing physics ----
// Each entry maps a test ID to the issue(s) that will fix it.
// These tests are skipped (not run) and don't count as pass or fail.
const KNOWN_FAILURES: Record<string, string> = {
  'NVE-02': 'Methane NVE explodes — needs torsion potential (#1)',
  'GEO-05': 'Methane HCH angle — needs torsion potential (#1)',
  'GEO-06': 'Methane C-H distance — needs torsion potential (#1)',
  'GEO-07': 'Methane bond count — needs torsion potential (#1)',
  'GEO-09':
    'CO2 C=O distance — needs linear angle handling (#2) and double bond params (#3)',
};

// ---- Test infrastructure ----

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  measured: string;
  expected: string;
  detail: string;
}

const results: TestResult[] = [];
let skippedCount = 0;

function isSkipped(id: string): boolean {
  const reason = KNOWN_FAILURES[id];
  if (reason) {
    console.log(`  ⏭️  ${id}: SKIPPED — ${reason}`);
    skippedCount++;
    return true;
  }
  return false;
}

function report(
  id: string,
  name: string,
  passed: boolean,
  measured: string,
  expected: string,
  detail: string = '',
): void {
  results.push({ id, name, passed, measured, expected, detail });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} ${id}: ${name}`);
  console.log(`       Measured: ${measured}`);
  console.log(`       Expected: ${expected}`);
  if (detail) console.log(`       ${detail}`);
}

// ---- Simulation helper ----

interface SimState {
  pos: Float64Array;
  vel: Float64Array;
  frc: Float64Array;
  masses: Float64Array;
  fixed: Uint8Array;
  Z: number[];
  charges: number[];
  N: number;
  bonds: Bond[];
  angles: Array<[number, number, number]>;
  exclusionSet: Set<string>;
  bondParams: Array<{
    i: number;
    j: number;
    De: number;
    alpha: number;
    re: number;
  }>;
  angleParams: Array<{
    i: number;
    j: number;
    k: number;
    kA: number;
    t0: number;
  }>;
}

function initSim(atoms: Atom[]): SimState {
  const N = atoms.length;
  const pos = new Float64Array(N * 3);
  const vel = new Float64Array(N * 3);
  const frc = new Float64Array(N * 3);
  const masses = new Float64Array(N);
  const fixed = new Uint8Array(N);
  const Z: number[] = [];
  const charges: number[] = [];

  for (let i = 0; i < N; i++) {
    const a = atoms[i];
    Z.push(a.elementNumber);
    charges.push(a.charge);
    pos[i * 3] = a.position[0];
    pos[i * 3 + 1] = a.position[1];
    pos[i * 3 + 2] = a.position[2];
    const el = elements[a.elementNumber];
    masses[i] = el ? el.mass : 1.0;
  }

  const state: SimState = {
    pos,
    vel,
    frc,
    masses,
    fixed,
    Z,
    charges,
    N,
    bonds: [],
    angles: [],
    exclusionSet: new Set(),
    bondParams: [],
    angleParams: [],
  };

  rebuildTopo(state);
  return state;
}

function rebuildTopo(s: SimState): void {
  s.bonds = detectBonds(s.pos, s.Z, 1.2, s.bonds, 1.5);
  s.angles = buildAngleList(s.bonds, s.N);
  s.exclusionSet.clear();
  s.bondParams = [];
  s.angleParams = [];
  for (const b of s.bonds) {
    s.exclusionSet.add(
      Math.min(b.atomA, b.atomB) + '-' + Math.max(b.atomA, b.atomB),
    );
    if (b.type === 'hydrogen' || b.type === 'vanderwaals') continue;
    const p = getMorseBondParams(s.Z[b.atomA], s.Z[b.atomB], b.order);
    s.bondParams.push({ i: b.atomA, j: b.atomB, ...p });
  }
  for (const [i, , k] of s.angles) {
    s.exclusionSet.add(Math.min(i, k) + '-' + Math.max(i, k));
  }
  for (const [ti, c, tk] of s.angles) {
    const a = getUFFAngleK(s.Z[ti], s.Z[c], s.Z[tk]);
    s.angleParams.push({ i: ti, j: c, k: tk, kA: a.kAngle, t0: a.theta0 });
  }

  // Compute Gasteiger charges from bond topology
  const hyb = detectHybridization(new Int32Array(s.Z), s.bonds, s.N);
  const gasteigerQ = computeGasteigerCharges(
    new Int32Array(s.Z),
    s.bonds,
    s.N,
    hyb,
  );
  const covalentAtoms = buildCovalentAtomSet(s.bonds, s.N);
  for (let i = 0; i < s.N; i++) {
    // Only overwrite with Gasteiger if the atom has covalent bonds.
    // Keep original charges for ionic species (e.g. NaCl).
    if (covalentAtoms[i]) {
      s.charges[i] = gasteigerQ[i];
    }
  }
}

function calcForces(s: SimState, p: Float64Array, f: Float64Array): number {
  let pe = 0;
  for (const b of s.bondParams)
    pe += morseBondForce(p, f, b.i, b.j, b.De, b.alpha, b.re);
  for (const a of s.angleParams)
    pe += harmonicAngleForce(p, f, a.i, a.j, a.k, a.kA, a.t0);
  for (let i = 0; i < s.N; i++) {
    for (let j = i + 1; j < s.N; j++) {
      if (s.exclusionSet.has(i + '-' + j)) continue;
      const lj = getLJParams(s.Z[i], s.Z[j]);
      pe += ljForce(p, f, i, j, lj.sigma, lj.epsilon, 10);
      pe += coulombForce(p, f, i, j, s.charges[i], s.charges[j], 10);
    }
  }
  for (let i = 0; i < s.N; i++) {
    for (let j = i + 1; j < s.N; j++) {
      const ri = elements[s.Z[i]];
      const rj = elements[s.Z[j]];
      if (!ri || !rj) continue;
      const rm = 0.5 * Math.min(ri.covalentRadius, rj.covalentRadius);
      pe += pauliRepulsion(p, f, i, j, Math.max(rm, 0.15), 20);
    }
  }
  return pe;
}

function dist(pos: Float64Array, i: number, j: number): number {
  const dx = pos[j * 3] - pos[i * 3];
  const dy = pos[j * 3 + 1] - pos[i * 3 + 1];
  const dz = pos[j * 3 + 2] - pos[i * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function angle(pos: Float64Array, i: number, j: number, k: number): number {
  const dx1 = pos[i * 3] - pos[j * 3],
    dy1 = pos[i * 3 + 1] - pos[j * 3 + 1],
    dz1 = pos[i * 3 + 2] - pos[j * 3 + 2];
  const dx2 = pos[k * 3] - pos[j * 3],
    dy2 = pos[k * 3 + 1] - pos[j * 3 + 1],
    dz2 = pos[k * 3 + 2] - pos[j * 3 + 2];
  const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1);
  const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
  const cosT = (dx1 * dx2 + dy1 * dy2 + dz1 * dz2) / (r1 * r2);
  return (Math.acos(Math.max(-1, Math.min(1, cosT))) * 180) / Math.PI;
}

// ---- Gradient tests ----

function testGradient(
  id: string,
  name: string,
  setupForces: (p: Float64Array, f: Float64Array) => number,
  pos: Float64Array,
  N: number,
): void {
  const h = 1e-5;
  let maxErr = 0;

  const fAnalytical = new Float64Array(N * 3);
  setupForces(pos, fAnalytical);

  for (let i = 0; i < N; i++) {
    for (let d = 0; d < 3; d++) {
      const p1 = new Float64Array(pos);
      const p2 = new Float64Array(pos);
      p1[i * 3 + d] += h;
      p2[i * 3 + d] -= h;
      const f1 = new Float64Array(N * 3);
      const f2 = new Float64Array(N * 3);
      const e1 = setupForces(p1, f1);
      const e2 = setupForces(p2, f2);
      const numForce = -(e1 - e2) / (2 * h);
      const err = Math.abs(numForce - fAnalytical[i * 3 + d]);
      maxErr = Math.max(maxErr, err);
    }
  }

  const passed = maxErr < 1e-6;
  report(id, name, passed, maxErr.toExponential(3) + ' eV/A', '< 1e-6 eV/A');
}

// ---- Run gradient tests ----

function runGradientTests(): void {
  console.log('\n=== GRADIENT CONSISTENCY TESTS ===\n');

  // GRAD-01: Morse
  const morsePos = new Float64Array([0, 0, 0, 1.0, 0, 0]);
  const morseP = getMorseBondParams(8, 1, 1);
  testGradient(
    'GRAD-01',
    'Morse O-H gradient',
    (p, f) => morseBondForce(p, f, 0, 1, morseP.De, morseP.alpha, morseP.re),
    morsePos,
    2,
  );

  // GRAD-02: LJ
  const ljPos = new Float64Array([0, 0, 0, 3.5, 0, 0]);
  const ljP = getLJParams(8, 8);
  testGradient(
    'GRAD-02',
    'LJ O-O gradient',
    (p, f) => ljForce(p, f, 0, 1, ljP.sigma, ljP.epsilon, 10),
    ljPos,
    2,
  );

  // GRAD-03: Coulomb
  const coulPos = new Float64Array([0, 0, 0, 2.0, 0, 0]);
  testGradient(
    'GRAD-03',
    'Coulomb gradient',
    (p, f) => coulombForce(p, f, 0, 1, 0.5, -0.5, 10),
    coulPos,
    2,
  );

  // GRAD-04: Cosine angle
  const anglePos = new Float64Array([1, 0, 0, 0, 0, 0, 0, 1, 0]); // 90 degree
  const ak = getUFFAngleK(1, 8, 1);
  testGradient(
    'GRAD-04',
    'Cosine angle H-O-H gradient',
    (p, f) => harmonicAngleForce(p, f, 0, 1, 2, ak.kAngle, ak.theta0),
    anglePos,
    3,
  );

  // GRAD-05: Pauli (steep exponential — use looser tolerance)
  const pauliPos = new Float64Array([0, 0, 0, 0.25, 0, 0]);
  testGradient(
    'GRAD-05',
    'Pauli repulsion gradient',
    (p, f) => pauliRepulsion(p, f, 0, 1, 0.15, 20),
    pauliPos,
    2,
  );

  // GRAD-06: Full water system
  const water = initSim(waterMolecule());
  testGradient(
    'GRAD-06',
    'Full H2O system gradient',
    (p, f) => calcForces(water, p, f),
    water.pos,
    water.N,
  );
}

// ---- NVE energy conservation tests ----

function runNVETest(
  id: string,
  name: string,
  atoms: Atom[],
  steps: number,
  dt: number,
  tolerance: number,
): void {
  if (isSkipped(id)) return;
  const s = initSim(atoms);
  initializeVelocities(s.vel, s.masses, s.fixed, 300);

  s.frc.fill(0);
  calcForces(s, s.pos, s.frc);

  let E0: number | null = null;
  let minE = Infinity,
    maxE = -Infinity;

  for (let step = 0; step < steps; step++) {
    const r = velocityVerletStep(
      s.pos,
      s.vel,
      s.frc,
      s.masses,
      s.fixed,
      dt,
      (p, f) => calcForces(s, p, f),
    );
    const E = r.kineticEnergy + r.potentialEnergy;

    if (step === 10) E0 = E; // skip first 10 steps for equilibration
    if (step > 10) {
      minE = Math.min(minE, E);
      maxE = Math.max(maxE, E);
    }

    // Rebuild topology every 5 steps
    if ((step + 1) % 5 === 0) rebuildTopo(s);
  }

  if (E0 === null || !isFinite(E0) || E0 === 0) {
    report(
      id,
      name,
      false,
      'E0=0 or NaN',
      'finite E0',
      'Simulation failed to initialize',
    );
    return;
  }

  const drift =
    Math.max(Math.abs(maxE - E0), Math.abs(minE - E0)) / Math.abs(E0);
  const passed = drift < tolerance;
  report(
    id,
    name,
    passed,
    (drift * 100).toFixed(4) + '%',
    '< ' + (tolerance * 100).toFixed(2) + '%',
    'E0=' +
      E0.toFixed(4) +
      ' range=[' +
      minE.toFixed(4) +
      ', ' +
      maxE.toFixed(4) +
      ']',
  );
}

function runNVETests(): void {
  console.log('\n=== NVE ENERGY CONSERVATION TESTS ===\n');

  runNVETest('NVE-01', 'Water NVE dt=0.5fs', waterMolecule(), 10000, 0.5, 0.05);
  runNVETest(
    'NVE-02',
    'Methane NVE dt=0.5fs',
    methaneMolecule(),
    10000,
    0.5,
    0.05,
  );
  runNVETest('NVE-03', 'CO2 NVE dt=0.5fs', co2Molecule(), 10000, 0.5, 0.05);
  runNVETest(
    'NVE-04',
    'Ethanol NVE dt=0.5fs',
    ethanolMolecule(),
    10000,
    0.5,
    0.1,
  );
  runNVETest('NVE-06', 'Water NVE dt=1.0fs', waterMolecule(), 10000, 1.0, 0.1);
}

// ---- Geometry / structural invariant tests ----

function runGeometryTest(
  id: string,
  atoms: Atom[],
  steps: number,
  dt: number,
  check: (
    s: SimState,
    step: number,
    accumulator: Record<string, number[]>,
  ) => void,
  evaluate: (accumulator: Record<string, number[]>) => void,
): void {
  if (isSkipped(id)) return;
  const s = initSim(atoms);
  initializeVelocities(s.vel, s.masses, s.fixed, 300);
  s.frc.fill(0);
  calcForces(s, s.pos, s.frc);

  const acc: Record<string, number[]> = {};

  for (let step = 0; step < steps; step++) {
    const r = velocityVerletStep(
      s.pos,
      s.vel,
      s.frc,
      s.masses,
      s.fixed,
      dt,
      (p, f) => calcForces(s, p, f),
    );
    berendsenThermostat(
      s.vel,
      s.masses,
      s.fixed,
      r.kineticEnergy,
      300,
      dt,
      100,
    );
    if ((step + 1) % 5 === 0) rebuildTopo(s);
    if (step > 100 && step % 10 === 0) check(s, step, acc);
  }

  evaluate(acc);
}

function pushAcc(
  acc: Record<string, number[]>,
  key: string,
  val: number,
): void {
  if (!acc[key]) acc[key] = [];
  acc[key].push(val);
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function runGeometryTests(): void {
  console.log('\n=== STRUCTURAL INVARIANT TESTS (NVT 300K) ===\n');

  // --- Water ---
  runGeometryTest(
    'GEO-01',
    waterMolecule(),
    6000,
    0.5,
    (s, _step, acc) => {
      pushAcc(acc, 'angle', angle(s.pos, 1, 0, 2)); // H-O-H
    },
    (acc) => {
      const m = mean(acc['angle']);
      const passed = m > 99 && m < 110;
      report(
        'GEO-01',
        'Water HOH angle mean',
        passed,
        m.toFixed(1) + ' deg',
        '99-110 deg',
      );
    },
  );

  runGeometryTest(
    'GEO-02',
    waterMolecule(),
    6000,
    0.5,
    (s, _step, acc) => {
      pushAcc(acc, 'oh1', dist(s.pos, 0, 1));
      pushAcc(acc, 'oh2', dist(s.pos, 0, 2));
    },
    (acc) => {
      const m = (mean(acc['oh1']) + mean(acc['oh2'])) / 2;
      const passed = m > 0.94 && m < 1.04;
      report(
        'GEO-02',
        'Water O-H distance mean',
        passed,
        m.toFixed(3) + ' A',
        '0.94-1.04 A',
      );
    },
  );

  runGeometryTest(
    'GEO-03',
    waterMolecule(),
    6000,
    0.5,
    (s, _step, acc) => {
      const hh = s.bonds.find((b) => s.Z[b.atomA] === 1 && s.Z[b.atomB] === 1);
      pushAcc(acc, 'hh', hh ? 1 : 0);
    },
    (acc) => {
      const count = acc['hh'].filter((v) => v > 0).length;
      report(
        'GEO-03',
        'Water no H-H bond',
        count === 0,
        count + ' frames with H-H',
        '0 frames',
      );
    },
  );

  runGeometryTest(
    'GEO-04',
    waterMolecule(),
    6000,
    0.5,
    (s, _step, acc) => {
      pushAcc(
        acc,
        'nbonds',
        s.bonds.filter((b) => b.type === 'covalent').length,
      );
    },
    (acc) => {
      const all2 = acc['nbonds'].every((n) => n === 2);
      const minB = Math.min(...acc['nbonds']);
      const maxB = Math.max(...acc['nbonds']);
      report(
        'GEO-04',
        'Water bond count = 2',
        all2,
        'range [' + minB + ', ' + maxB + ']',
        'always 2',
      );
    },
  );

  // --- Methane ---
  runGeometryTest(
    'GEO-05',
    methaneMolecule(),
    6000,
    0.5,
    (s, _step, acc) => {
      // Central C is atom 0; H atoms are 1,2,3,4
      pushAcc(acc, 'angle', angle(s.pos, 1, 0, 2));
    },
    (acc) => {
      const m = mean(acc['angle']);
      const passed = m > 100 && m < 120;
      report(
        'GEO-05',
        'Methane HCH angle mean',
        passed,
        m.toFixed(1) + ' deg',
        '100-120 deg',
      );
    },
  );

  runGeometryTest(
    'GEO-06',
    methaneMolecule(),
    6000,
    0.5,
    (s, _step, acc) => {
      pushAcc(acc, 'ch', dist(s.pos, 0, 1));
    },
    (acc) => {
      const m = mean(acc['ch']);
      const passed = m > 0.95 && m < 1.2;
      report(
        'GEO-06',
        'Methane C-H distance mean',
        passed,
        m.toFixed(3) + ' A',
        '0.95-1.20 A',
      );
    },
  );

  runGeometryTest(
    'GEO-07',
    methaneMolecule(),
    6000,
    0.5,
    (s, _step, acc) => {
      pushAcc(
        acc,
        'nbonds',
        s.bonds.filter((b) => b.type === 'covalent').length,
      );
    },
    (acc) => {
      const all4 = acc['nbonds'].every((n) => n === 4);
      const minB = Math.min(...acc['nbonds']);
      const maxB = Math.max(...acc['nbonds']);
      report(
        'GEO-07',
        'Methane bond count = 4',
        all4,
        'range [' + minB + ', ' + maxB + ']',
        'always 4',
      );
    },
  );

  // --- CO2 ---
  runGeometryTest(
    'GEO-08',
    co2Molecule(),
    6000,
    0.5,
    (s, _step, acc) => {
      pushAcc(acc, 'angle', angle(s.pos, 1, 0, 2)); // O-C-O
    },
    (acc) => {
      const m = mean(acc['angle']);
      const passed = m > 170; // Linear
      report(
        'GEO-08',
        'CO2 OCO angle mean (linear)',
        passed,
        m.toFixed(1) + ' deg',
        '> 170 deg',
      );
    },
  );

  runGeometryTest(
    'GEO-09',
    co2Molecule(),
    6000,
    0.5,
    (s, _step, acc) => {
      pushAcc(acc, 'co', (dist(s.pos, 0, 1) + dist(s.pos, 0, 2)) / 2);
    },
    (acc) => {
      const m = mean(acc['co']);
      const passed = m > 1.05 && m < 1.3;
      report(
        'GEO-09',
        'CO2 C=O distance mean',
        passed,
        m.toFixed(3) + ' A',
        '1.05-1.30 A',
      );
    },
  );

  // --- NaCl ---
  runGeometryTest(
    'GEO-11',
    naclPair(),
    6000,
    0.5,
    (s, _step, acc) => {
      pushAcc(acc, 'd', dist(s.pos, 0, 1));
    },
    (acc) => {
      const m = mean(acc['d']);
      const passed = m > 2.0 && m < 3.0;
      report(
        'GEO-11',
        'NaCl distance mean',
        passed,
        m.toFixed(3) + ' A',
        '2.0-3.0 A',
      );
    },
  );
}

// ---- Thermodynamic tests ----

function runThermodynamicTests(): void {
  console.log('\n=== THERMODYNAMIC INVARIANT TESTS ===\n');

  // THERMO-01: Water NVT temperature
  const s = initSim(waterMolecule());
  initializeVelocities(s.vel, s.masses, s.fixed, 300);
  s.frc.fill(0);
  calcForces(s, s.pos, s.frc);

  const temps: number[] = [];
  for (let step = 0; step < 10000; step++) {
    const r = velocityVerletStep(
      s.pos,
      s.vel,
      s.frc,
      s.masses,
      s.fixed,
      0.5,
      (p, f) => calcForces(s, p, f),
    );
    const T = computeTemperature(r.kineticEnergy, s.N);
    berendsenThermostat(
      s.vel,
      s.masses,
      s.fixed,
      r.kineticEnergy,
      300,
      0.5,
      100,
    );
    if ((step + 1) % 5 === 0) rebuildTopo(s);
    if (step > 500) temps.push(T);
  }

  const avgT = mean(temps);
  const passed = avgT > 270 && avgT < 330;
  report(
    'THERMO-01',
    'Water NVT temperature',
    passed,
    avgT.toFixed(1) + ' K',
    '270-330 K',
  );
}

// ---- Charge equilibration tests ----

function runChargeTests(): void {
  console.log('\n=== GASTEIGER CHARGE EQUILIBRATION TESTS ===\n');

  // CHG-01: Water charges — O should be negative, H positive
  {
    const s = initSim(waterMolecule());
    // Charges are computed by rebuildTopo via Gasteiger
    const oCharge = s.charges[0]; // Oxygen
    const h1Charge = s.charges[1]; // H
    const h2Charge = s.charges[2]; // H

    const oNegative = oCharge < -0.2 && oCharge > -0.8;
    const hPositive = h1Charge > 0.1 && h1Charge < 0.5;
    const hSymmetric = Math.abs(h1Charge - h2Charge) < 1e-10;
    const passed = oNegative && hPositive && hSymmetric;
    report(
      'CHG-01',
      'Water O negative, H positive, symmetric',
      passed,
      `O=${oCharge.toFixed(4)}, H=${h1Charge.toFixed(4)}, H=${h2Charge.toFixed(4)}`,
      'O in [-0.8, -0.2], H in [0.1, 0.5], H1 == H2',
    );
  }

  // CHG-02: Methane charges — C slightly negative, H slightly positive
  {
    const s = initSim(methaneMolecule());
    const cCharge = s.charges[0]; // Carbon
    const hCharge = s.charges[1]; // H

    const cNegative = cCharge < 0 && cCharge > -0.3;
    const hPositive = hCharge > 0 && hCharge < 0.1;
    const passed = cNegative && hPositive;
    report(
      'CHG-02',
      'Methane C slightly negative, H slightly positive',
      passed,
      `C=${cCharge.toFixed(4)}, H=${hCharge.toFixed(4)}`,
      'C in [-0.3, 0], H in [0, 0.1]',
    );
  }

  // CHG-03: Charge neutrality — sum of charges ≈ 0 for neutral molecules
  {
    const molecules: Array<[string, Atom[]]> = [
      ['Water', waterMolecule()],
      ['Methane', methaneMolecule()],
      ['Ethanol', ethanolMolecule()],
    ];
    let allNeutral = true;
    const details: string[] = [];
    for (const [name, atoms] of molecules) {
      const s = initSim(atoms);
      const sum = s.charges.reduce((a, b) => a + b, 0);
      const neutral = Math.abs(sum) < 1e-10;
      if (!neutral) allNeutral = false;
      details.push(`${name}: sum=${sum.toExponential(3)}`);
    }
    report(
      'CHG-03',
      'Charge neutrality for neutral molecules',
      allNeutral,
      details.join(', '),
      '|sum| < 1e-10 for each',
    );
  }

  // CHG-04: Ethanol O is most negative, O-H hydrogen is most positive
  {
    const s = initSim(ethanolMolecule());
    // Ethanol: C(0), C(1), O(2), H-O(3), H-C(4,5,6), H-C(7,8)
    const oCharge = s.charges[2]; // O
    const ohCharge = s.charges[3]; // H on O

    // O should be the most negative atom
    let oMostNegative = true;
    for (let i = 0; i < s.N; i++) {
      if (i !== 2 && s.charges[i] < oCharge) oMostNegative = false;
    }

    // H on O should be the most positive
    let ohMostPositive = true;
    for (let i = 0; i < s.N; i++) {
      if (i !== 3 && s.charges[i] > ohCharge) ohMostPositive = false;
    }

    const passed = oMostNegative && ohMostPositive;
    report(
      'CHG-04',
      'Ethanol O most negative, O-H most positive',
      passed,
      `O=${oCharge.toFixed(4)}, O-H=${ohCharge.toFixed(4)}`,
      'O is most negative, H(O) is most positive',
    );
  }
}

// ---- Main ----

console.log('╔══════════════════════════════════════════════════╗');
console.log('║   ChemSim Physics Invariant Test Suite           ║');
console.log('╚══════════════════════════════════════════════════╝');

runGradientTests();
runNVETests();
runGeometryTests();
runThermodynamicTests();
runChargeTests();

// Summary
console.log('\n' + '='.repeat(50));
console.log('SUMMARY');
console.log('='.repeat(50));
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
const total = results.length;
console.log(`  PASSED: ${passed}/${total}`);
console.log(`  FAILED: ${failed}/${total}`);
if (skippedCount > 0) {
  console.log(`  SKIPPED: ${skippedCount} (known failures with linked issues)`);
}
if (failed > 0) {
  console.log('\nFailed tests:');
  for (const r of results.filter((r) => !r.passed)) {
    console.log(
      `  ${r.id}: ${r.name} — got ${r.measured}, expected ${r.expected}`,
    );
  }
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
