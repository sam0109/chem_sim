// ==============================================================
// Simulation Web Worker — runs the MD loop off the main thread
// ==============================================================

import type {
  Atom,
  Bond,
  SimulationBox,
  SimulationConfig,
  WorkerInMessage,
  WorkerStateUpdate,
} from '../data/types';
import elements from '../data/elements';
import { getMorseBondParams, getLJParams, getUFFAngleK } from '../data/uff';
import { morseBondForce } from './forces/morse';
import { ljForce } from './forces/lennardJones';
import { coulombForce } from './forces/coulomb';
import { harmonicAngleForce } from './forces/harmonic';
import { pauliRepulsion } from './forces/pauli';
import {
  velocityVerletStep,
  computeTemperature,
  initializeVelocities,
} from './integrator';
import { berendsenThermostat } from './thermostat';
import { steepestDescent } from './minimizer';
import {
  detectBonds,
  detectHydrogenBonds,
  buildAngleList,
} from './bondDetector';
import { CellList } from './neighborList';
import { computeGasteigerCharges, buildCovalentAtomSet } from './gasteiger';
import { detectHybridization } from './hybridization';

// ---- Simulation state ----
let nAtoms = 0;
let atomicNumbers: Int32Array = new Int32Array(0);
let positions: Float64Array = new Float64Array(0);
let velocities: Float64Array = new Float64Array(0);
let forces: Float64Array = new Float64Array(0);
let masses: Float64Array = new Float64Array(0);
let charges: Float64Array = new Float64Array(0);
let fixed: Uint8Array = new Uint8Array(0);
let bonds: Bond[] = [];
let angles: Array<[number, number, number]> = [];
let config: SimulationConfig = {
  timestep: 0.5,
  temperature: 300,
  thermostat: 'berendsen',
  thermostatTau: 100,
  cutoff: 10.0,
  running: false,
};
let step = 0;

// Cached force-field parameters
let bondParams: Array<{
  i: number;
  j: number;
  De: number;
  alpha: number;
  re: number;
}> = [];
const ljCache: Map<string, { sigma: number; epsilon: number }> = new Map();
let cellList: CellList | null = null;
// Cached angle parameters (precomputed once per topology rebuild)
let angleParams: Array<{
  i: number;
  j: number;
  k: number;
  kAngle: number;
  theta0: number;
}> = [];

// --- Exclusion set: skip 1-2 (bonded) AND 1-3 (angle) pairs from LJ/Coulomb ---
const exclusionSet: Set<string> = new Set();

// Drag force target
let dragAtomId = -1;
let dragTarget: [number, number, number] = [0, 0, 0];
const DRAG_SPRING_K = 5.0; // eV/ų

// ---- Force field parameter setup ----
function rebuildTopology(): void {
  // Detect bonds with hysteresis (existing bonds get wider break tolerance)
  bonds = detectBonds(positions, Array.from(atomicNumbers), 1.2, bonds, 1.5);

  // Add hydrogen bonds
  const hBonds = detectHydrogenBonds(
    positions,
    Array.from(atomicNumbers),
    bonds,
  );
  bonds = [...bonds.filter((b) => b.type !== 'hydrogen'), ...hBonds];

  // Build angle list
  angles = buildAngleList(bonds, nAtoms);

  // Cache bond parameters & build exclusion set (1-2 and 1-3)
  bondParams = [];
  exclusionSet.clear();
  for (const bond of bonds) {
    // 1-2 exclusion: bonded pairs skip LJ (Morse handles them)
    exclusionSet.add(
      `${Math.min(bond.atomA, bond.atomB)}-${Math.max(bond.atomA, bond.atomB)}`,
    );
    if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;
    const params = getMorseBondParams(
      atomicNumbers[bond.atomA],
      atomicNumbers[bond.atomB],
      bond.order,
    );
    bondParams.push({ i: bond.atomA, j: bond.atomB, ...params });
  }

  // 1-3 exclusion: angle-connected pairs (LJ σ >> actual distance)
  for (const [i, , k] of angles) {
    exclusionSet.add(`${Math.min(i, k)}-${Math.max(i, k)}`);
  }

  // Precompute angle force constants using proper UFF formula
  angleParams = [];
  for (const [ti, central, tk] of angles) {
    const { kAngle, theta0 } = getUFFAngleK(
      atomicNumbers[ti],
      atomicNumbers[central],
      atomicNumbers[tk],
    );
    angleParams.push({ i: ti, j: central, k: tk, kAngle, theta0 });
  }

  // Compute Gasteiger partial charges from bond topology.
  // This replaces the hardcoded/zero charges with physically meaningful
  // values based on orbital electronegativity equilibration.
  // Atoms with only ionic bonds keep their existing charges.
  const hyb = detectHybridization(atomicNumbers, bonds, nAtoms);
  const gasteigerQ = computeGasteigerCharges(atomicNumbers, bonds, nAtoms, hyb);
  const covalentAtoms = buildCovalentAtomSet(bonds, nAtoms);
  for (let i = 0; i < nAtoms; i++) {
    if (covalentAtoms[i]) {
      charges[i] = gasteigerQ[i];
    }
  }

  // Rebuild cell list
  if (!cellList) {
    cellList = new CellList(config.cutoff, Math.max(nAtoms, 100));
  }
}

function getLJCached(
  z1: number,
  z2: number,
): { sigma: number; epsilon: number } {
  const key = z1 < z2 ? `${z1}-${z2}` : `${z2}-${z1}`;
  let cached = ljCache.get(key);
  if (!cached) {
    cached = getLJParams(z1, z2);
    ljCache.set(key, cached);
  }
  return cached;
}

/**
 * Compute all forces and return potential energy.
 */
function computeAllForces(pos: Float64Array, frc: Float64Array): number {
  let potentialEnergy = 0;

  // 1. Bonded forces (Morse)
  for (const bp of bondParams) {
    potentialEnergy += morseBondForce(
      pos,
      frc,
      bp.i,
      bp.j,
      bp.De,
      bp.alpha,
      bp.re,
    );
  }

  // 2. Angle forces (harmonic) — using precomputed params
  for (const ap of angleParams) {
    potentialEnergy += harmonicAngleForce(
      pos,
      frc,
      ap.i,
      ap.j,
      ap.k,
      ap.kAngle,
      ap.theta0,
    );
  }

  // 3. Non-bonded forces (LJ + Coulomb) using cell list or brute force
  const cutoff = config.cutoff;
  const pairCallback = (i: number, j: number): void => {
    // Skip 1-2 (bonded) and 1-3 (angle) pairs
    const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
    if (exclusionSet.has(key)) return;

    const { sigma, epsilon } = getLJCached(atomicNumbers[i], atomicNumbers[j]);
    potentialEnergy += ljForce(pos, frc, i, j, sigma, epsilon, cutoff);
    potentialEnergy += coulombForce(
      pos,
      frc,
      i,
      j,
      charges[i],
      charges[j],
      cutoff,
    );
  };

  if (nAtoms < 50) {
    CellList.forEachPairBrute(pos, nAtoms, cutoff, pairCallback);
  } else {
    cellList!.build(pos, nAtoms);
    cellList!.forEachPair(pos, cutoff, pairCallback);
  }

  // 4. Pauli repulsion — prevents atomic overlap for ALL pairs
  // This is a short-range exponential wall that acts regardless of bonding
  for (let i = 0; i < nAtoms; i++) {
    for (let j = i + 1; j < nAtoms; j++) {
      // Use element-dependent minimum approach distance (~0.5 × smallest covalent radius)
      const elI = elements[atomicNumbers[i]];
      const elJ = elements[atomicNumbers[j]];
      const rMin =
        0.5 *
        Math.min(
          elI ? elI.covalentRadius : 0.5,
          elJ ? elJ.covalentRadius : 0.5,
        );
      potentialEnergy += pauliRepulsion(
        pos,
        frc,
        i,
        j,
        Math.max(rMin, 0.15),
        20.0,
      );
    }
  }

  // 5. Drag force (spring to target position)
  if (dragAtomId >= 0 && dragAtomId < nAtoms) {
    const i3 = dragAtomId * 3;
    const dx = dragTarget[0] - pos[i3];
    const dy = dragTarget[1] - pos[i3 + 1];
    const dz = dragTarget[2] - pos[i3 + 2];
    frc[i3] += DRAG_SPRING_K * dx;
    frc[i3 + 1] += DRAG_SPRING_K * dy;
    frc[i3 + 2] += DRAG_SPRING_K * dz;
    potentialEnergy += 0.5 * DRAG_SPRING_K * (dx * dx + dy * dy + dz * dz);
  }

  return potentialEnergy;
}

// ---- Initialize from atoms ----
function initSimulation(
  atoms: Atom[],
  inputBonds: Bond[],
  _box: SimulationBox,
  cfg: SimulationConfig,
): void {
  config = { ...config, ...cfg };
  nAtoms = atoms.length;

  atomicNumbers = new Int32Array(nAtoms);
  positions = new Float64Array(nAtoms * 3);
  velocities = new Float64Array(nAtoms * 3);
  forces = new Float64Array(nAtoms * 3);
  masses = new Float64Array(nAtoms);
  charges = new Float64Array(nAtoms);
  fixed = new Uint8Array(nAtoms);

  for (let i = 0; i < nAtoms; i++) {
    const atom = atoms[i];
    atomicNumbers[i] = atom.elementNumber;
    positions[i * 3] = atom.position[0];
    positions[i * 3 + 1] = atom.position[1];
    positions[i * 3 + 2] = atom.position[2];
    velocities[i * 3] = atom.velocity[0];
    velocities[i * 3 + 1] = atom.velocity[1];
    velocities[i * 3 + 2] = atom.velocity[2];
    const el = elements[atom.elementNumber];
    masses[i] = el ? el.mass : 1.0;
    charges[i] = atom.charge;
    fixed[i] = atom.fixed ? 1 : 0;
  }

  cellList = new CellList(config.cutoff, Math.max(nAtoms, 100));

  // Use provided bonds or detect them
  if (inputBonds.length > 0) {
    bonds = inputBonds;
    bondParams = [];
    exclusionSet.clear();
    for (const bond of bonds) {
      exclusionSet.add(
        `${Math.min(bond.atomA, bond.atomB)}-${Math.max(bond.atomA, bond.atomB)}`,
      );
      if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;
      const params = getMorseBondParams(
        atomicNumbers[bond.atomA],
        atomicNumbers[bond.atomB],
        bond.order,
      );
      bondParams.push({ i: bond.atomA, j: bond.atomB, ...params });
    }
    angles = buildAngleList(bonds, nAtoms);
    // 1-3 exclusions from angles
    for (const [ai, , ak] of angles) {
      exclusionSet.add(`${Math.min(ai, ak)}-${Math.max(ai, ak)}`);
    }
    // Precompute angle params
    angleParams = [];
    for (const [ti, central, tk] of angles) {
      const { kAngle, theta0 } = getUFFAngleK(
        atomicNumbers[ti],
        atomicNumbers[central],
        atomicNumbers[tk],
      );
      angleParams.push({ i: ti, j: central, k: tk, kAngle, theta0 });
    }
  } else {
    rebuildTopology();
  }

  // Initialize velocities if all zero
  let allZero = true;
  for (let i = 0; i < velocities.length; i++) {
    if (velocities[i] !== 0) {
      allZero = false;
      break;
    }
  }
  if (allZero && config.temperature > 0) {
    initializeVelocities(velocities, masses, fixed, config.temperature);
  }

  step = 0;
  ljCache.clear();

  sendState();
}

// ---- Run MD steps ----
function runSteps(nSteps: number): void {
  for (let s = 0; s < nSteps; s++) {
    const { kineticEnergy } = velocityVerletStep(
      positions,
      velocities,
      forces,
      masses,
      fixed,
      config.timestep,
      computeAllForces,
    );

    // Apply thermostat
    if (config.thermostat === 'berendsen') {
      berendsenThermostat(
        velocities,
        masses,
        fixed,
        kineticEnergy,
        config.temperature,
        config.timestep,
        config.thermostatTau,
      );
    }

    step++;
  }

  // Re-detect bonds every frame for physically accurate dynamic bonding.
  // Valence constraints in detectBonds prevent spurious bonds.
  // LJ repulsion on 1-3 pairs prevents angle collapse.
  rebuildTopology();

  sendState();
}

// ---- Add atom ----
function addAtom(atom: Atom): void {
  const newN = nAtoms + 1;

  // Grow arrays
  const newAtomicNumbers = new Int32Array(newN);
  const newPositions = new Float64Array(newN * 3);
  const newVelocities = new Float64Array(newN * 3);
  const newForces = new Float64Array(newN * 3);
  const newMasses = new Float64Array(newN);
  const newCharges = new Float64Array(newN);
  const newFixed = new Uint8Array(newN);

  newAtomicNumbers.set(atomicNumbers);
  newPositions.set(positions);
  newVelocities.set(velocities);
  newMasses.set(masses);
  newCharges.set(charges);
  newFixed.set(fixed);

  const i = nAtoms;
  newAtomicNumbers[i] = atom.elementNumber;
  newPositions[i * 3] = atom.position[0];
  newPositions[i * 3 + 1] = atom.position[1];
  newPositions[i * 3 + 2] = atom.position[2];
  const el = elements[atom.elementNumber];
  newMasses[i] = el ? el.mass : 1.0;
  newCharges[i] = atom.charge;
  newFixed[i] = atom.fixed ? 1 : 0;

  atomicNumbers = newAtomicNumbers;
  positions = newPositions;
  velocities = newVelocities;
  forces = newForces;
  masses = newMasses;
  charges = newCharges;
  fixed = newFixed;
  nAtoms = newN;

  rebuildTopology();
  sendState();
}

// ---- Remove atom ----
function removeAtom(atomId: number): void {
  if (atomId < 0 || atomId >= nAtoms) return;

  const newN = nAtoms - 1;
  const newAtomicNumbers = new Int32Array(newN);
  const newPositions = new Float64Array(newN * 3);
  const newVelocities = new Float64Array(newN * 3);
  const newForces = new Float64Array(newN * 3);
  const newMasses = new Float64Array(newN);
  const newCharges = new Float64Array(newN);
  const newFixed = new Uint8Array(newN);

  let dst = 0;
  for (let src = 0; src < nAtoms; src++) {
    if (src === atomId) continue;
    newAtomicNumbers[dst] = atomicNumbers[src];
    newPositions[dst * 3] = positions[src * 3];
    newPositions[dst * 3 + 1] = positions[src * 3 + 1];
    newPositions[dst * 3 + 2] = positions[src * 3 + 2];
    newVelocities[dst * 3] = velocities[src * 3];
    newVelocities[dst * 3 + 1] = velocities[src * 3 + 1];
    newVelocities[dst * 3 + 2] = velocities[src * 3 + 2];
    newMasses[dst] = masses[src];
    newCharges[dst] = charges[src];
    newFixed[dst] = fixed[src];
    dst++;
  }

  atomicNumbers = newAtomicNumbers;
  positions = newPositions;
  velocities = newVelocities;
  forces = newForces;
  masses = newMasses;
  charges = newCharges;
  fixed = newFixed;
  nAtoms = newN;

  rebuildTopology();
  sendState();
}

// ---- Minimize ----
function minimize(maxSteps: number, tolerance: number): void {
  steepestDescent(
    positions,
    forces,
    fixed,
    nAtoms,
    computeAllForces,
    maxSteps,
    tolerance,
  );
  // Zero velocities after minimization
  velocities.fill(0);
  rebuildTopology();
  sendState();
}

// ---- Send state back to main thread ----
function sendState(): void {
  // Compute energies
  forces.fill(0);
  const potentialEnergy = computeAllForces(positions, forces);

  const CONV = 103.6427;
  let kineticEnergy = 0;
  for (let i = 0; i < nAtoms; i++) {
    const i3 = i * 3;
    const vx = velocities[i3];
    const vy = velocities[i3 + 1];
    const vz = velocities[i3 + 2];
    kineticEnergy += 0.5 * masses[i] * (vx * vx + vy * vy + vz * vz) * CONV;
  }

  const temperature = computeTemperature(kineticEnergy, nAtoms);

  const msg: WorkerStateUpdate = {
    type: 'state',
    positions: positions.slice(),
    forces: forces.slice(),
    bonds: [...bonds],
    charges: charges.slice(),
    step,
    energy: {
      kinetic: kineticEnergy,
      potential: potentialEnergy,
      total: kineticEnergy + potentialEnergy,
    },
    temperature,
  };

  self.postMessage(msg);
}

// ---- Simulation loop (runs when config.running === true) ----
let loopId: ReturnType<typeof setTimeout> | null = null;
const STEPS_PER_FRAME = 5;
const FRAME_INTERVAL = 16; // ~60fps

function simLoop(): void {
  if (!config.running || nAtoms === 0) {
    loopId = null;
    return;
  }

  runSteps(STEPS_PER_FRAME);
  loopId = setTimeout(simLoop, FRAME_INTERVAL);
}

function startLoop(): void {
  if (loopId !== null) return;
  simLoop();
}

function stopLoop(): void {
  if (loopId !== null) {
    clearTimeout(loopId);
    loopId = null;
  }
}

// ---- Message handler ----
self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      stopLoop();
      initSimulation(msg.atoms, msg.bonds, msg.box, msg.config);
      if (msg.config.running) startLoop();
      break;

    case 'step':
      runSteps(msg.steps);
      break;

    case 'config': {
      const wasRunning = config.running;
      Object.assign(config, msg.config);
      if (config.running && !wasRunning) startLoop();
      if (!config.running && wasRunning) stopLoop();
      break;
    }

    case 'add-atom':
      addAtom(msg.atom);
      break;

    case 'remove-atom':
      removeAtom(msg.atomId);
      break;

    case 'drag':
      dragAtomId = msg.atomId;
      dragTarget = msg.targetPosition;
      break;

    case 'minimize':
      stopLoop();
      minimize(msg.maxSteps, msg.tolerance);
      break;
  }
};

// Signal ready
self.postMessage({ type: 'ready' });
