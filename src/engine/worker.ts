// ==============================================================
// Simulation Web Worker — runs the MD loop off the main thread
// ==============================================================

import type {
  Atom,
  Bond,
  EnergyBreakdown,
  Hybridization,
  MoleculeInfo,
  ReactionEvent,
  SimulationBox,
  SimulationConfig,
  WorkerInMessage,
  WorkerStateUpdate,
} from '../data/types';
import elements from '../data/elements';
import {
  getMorseBondParams,
  getLJParams,
  getUFFAngleK,
  getUFFTorsionParams,
  getUFFInversionParams,
} from '../data/uff';
import { morseBondForce } from './forces/morse';
import { ljForce } from './forces/lennardJones';
import {
  coulombForce,
  computeWolfConstants,
  wolfSelfEnergy,
} from './forces/coulomb';
import type { WolfConstants } from './forces/coulomb';
import { harmonicAngleForce } from './forces/harmonic';
import { torsionForce } from './forces/torsion';
import { inversionForce } from './forces/inversion';
import {
  velocityVerletStep,
  computeTemperature,
  initializeVelocities,
} from './integrator';
import {
  berendsenThermostat,
  noseHooverChainStep,
  createNoseHooverChainState,
  computeNoseHooverEnergy,
} from './thermostat';
import type { NoseHooverChainState } from './thermostat';
import { steepestDescent } from './minimizer';
import {
  detectBonds,
  detectHydrogenBonds,
  buildAngleList,
  buildDihedralList,
  buildInversionList,
} from './bondDetector';
import { CellList } from './neighborList';
import { computeGasteigerCharges, buildCovalentAtomSet } from './gasteiger';
import { detectHybridization } from './hybridization';
import { findMolecules, computeMoleculeInfo } from './moleculeTracker';
import { wrapPositions } from './pbc';
import { diffBonds, detectReactions } from './reactionDetector';

// ---- Simulation state ----
let nAtoms = 0;
let atomicNumbers: Int32Array = new Int32Array(0);
let positions: Float64Array = new Float64Array(0);
let velocities: Float64Array = new Float64Array(0);
let forces: Float64Array = new Float64Array(0);
let masses: Float64Array = new Float64Array(0);
let charges: Float64Array = new Float64Array(0);
let fixed: Uint8Array = new Uint8Array(0);
let hybridizations: Hybridization[] = [];
let bonds: Bond[] = [];
let angles: Array<[number, number, number]> = [];
let dihedrals: Array<[number, number, number, number]> = [];

// Nosé-Hoover chain thermostat state (initialized on simulation start)
let nhChainState: NoseHooverChainState | null = null;
let config: SimulationConfig = {
  timestep: 0.5,
  temperature: 300,
  thermostat: 'berendsen',
  thermostatTau: 100,
  cutoff: 10.0,
  running: false,
};
let step = 0;
let box: SimulationBox = { size: [50, 50, 50], periodic: false };

// Cached Wolf summation constants (recomputed when cutoff changes)
let wolfConst: WolfConstants = computeWolfConstants(10.0);

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
// Cached torsion parameters (precomputed once per topology rebuild)
let torsionParams: Array<{
  i: number;
  j: number;
  k: number;
  l: number;
  V: number;
  n: number;
  phi0: number;
}> = [];
// Cached inversion (out-of-plane) parameters
let inversionParams: Array<{
  i: number;
  j: number;
  k: number;
  l: number;
  K: number;
  C0: number;
  C1: number;
  C2: number;
}> = [];

// --- Exclusion set: skip 1-2 (bonded) AND 1-3 (angle) pairs from LJ/Coulomb ---
const exclusionSet: Set<string> = new Set();

// --- 1-4 scaling set: dihedral terminal pairs get 0.5× LJ and Coulomb ---
// Standard AMBER/OPLS convention: 1-4 pairs are scaled by 0.5.
// Source: Cornell et al., JACS 117, 5179 (1995); Jorgensen et al., JACS 118, 11225 (1996).
const SCALE_14 = 0.5;
const scale14Set: Set<string> = new Set();

// Cached energies from the most recent velocityVerletStep() call.
// Used by sendState() to avoid a redundant O(N²) force computation.
let cachedKE = 0;
let cachedPE = 0;
let cachedEnergiesValid = false;

// Drag force target
let dragAtomId = -1;
let dragTarget: [number, number, number] = [0, 0, 0];
const DRAG_SPRING_K = 5.0; // eV/ų

// Molecule tracking state (updated each topology rebuild)
let moleculeIds: Int32Array = new Int32Array(0);
let moleculeInfo: MoleculeInfo[] = [];

// Reaction detection state — snapshots from the previous topology rebuild
let prevMoleculeIds: Int32Array = new Int32Array(0);
let prevMoleculeInfo: MoleculeInfo[] = [];
/** Whether we have a valid previous state to diff against */
let hasPrevTopology = false;
/** Reaction events detected in the most recent topology rebuild */
let pendingReactionEvents: ReactionEvent[] = [];

// ---- Force field parameter setup ----
function rebuildTopology(): void {
  // Snapshot previous topology for reaction detection
  const savedPrevBonds = hasPrevTopology ? [...bonds] : [];
  const savedPrevMolIds = prevMoleculeIds;
  const savedPrevMolInfo = prevMoleculeInfo;

  // Extract previous H-bonds for hysteresis BEFORE detectBonds() overwrites
  // the bonds array (detectBonds never returns hydrogen-type bonds)
  const previousHBonds = bonds.filter((b) => b.type === 'hydrogen');

  // Detect bonds with hysteresis (existing bonds get wider break tolerance)
  // When PBC is active, pass box dimensions so minimum image convention is
  // applied to interatomic distances — this detects bonds across boundaries.
  const pbcBox = box.periodic ? box.size : undefined;
  bonds = detectBonds(
    positions,
    Array.from(atomicNumbers),
    1.2,
    bonds,
    1.5,
    pbcBox,
  );

  // Add hydrogen bonds (with hysteresis from previous frame)
  const hBonds = detectHydrogenBonds(
    positions,
    Array.from(atomicNumbers),
    bonds,
    previousHBonds,
    pbcBox,
  );
  bonds = [...bonds.filter((b) => b.type !== 'hydrogen'), ...hBonds];

  // Build angle list
  angles = buildAngleList(bonds, nAtoms);

  // Cache bond parameters & build exclusion set (1-2 and 1-3)
  bondParams = [];
  exclusionSet.clear();
  for (const bond of bonds) {
    // H-bonds are non-covalent — their energy comes from LJ/Coulomb,
    // so they must NOT be added to the exclusion set. Excluding them
    // would suppress the very electrostatic attraction that creates them.
    // Van der Waals bonds similarly should not create Morse terms but
    // they do need exclusion (handled by their own force computation).
    if (bond.type === 'hydrogen') continue;
    // 1-2 exclusion: bonded pairs skip LJ (Morse handles them)
    exclusionSet.add(
      `${Math.min(bond.atomA, bond.atomB)}-${Math.max(bond.atomA, bond.atomB)}`,
    );
    if (bond.type === 'vanderwaals') continue;
    const params = getMorseBondParams(
      atomicNumbers[bond.atomA],
      atomicNumbers[bond.atomB],
      bond.order,
      hybridizations[bond.atomA],
      hybridizations[bond.atomB],
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
      1,
      1,
      hybridizations[central],
    );
    angleParams.push({ i: ti, j: central, k: tk, kAngle, theta0 });
  }

  buildTorsionParams();

  // Build 1-4 scaling set from dihedral terminal atoms.
  // Pairs that are both 1-3 (in exclusionSet) and 1-4 are fully excluded
  // (1-3 takes precedence), so we skip those here.
  scale14Set.clear();
  for (const [di, , , dl] of dihedrals) {
    const key = `${Math.min(di, dl)}-${Math.max(di, dl)}`;
    if (!exclusionSet.has(key)) {
      scale14Set.add(key);
    }
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

  // Detect reactions by comparing current topology with previous snapshot.
  // buildTorsionParams() has already computed moleculeIds and moleculeInfo,
  // so both the previous and current molecule data are available.
  if (hasPrevTopology) {
    const bondChanges = diffBonds(savedPrevBonds, bonds);
    if (bondChanges.length > 0) {
      const events = detectReactions(
        bondChanges,
        savedPrevMolIds,
        moleculeIds,
        savedPrevMolInfo,
        moleculeInfo,
        atomicNumbers,
        step,
      );
      pendingReactionEvents.push(...events);
    }
  }
  // Save current state as "previous" for next topology rebuild
  prevMoleculeIds = moleculeIds.slice();
  prevMoleculeInfo = [...moleculeInfo];
  hasPrevTopology = true;
}

/**
 * Build dihedral list and precompute torsion parameters.
 * The UFF barrier V is the total barrier for rotation around the
 * central bond j-k. When multiple dihedrals share the same j-k
 * bond, V must be divided by the count to avoid over-counting.
 * Source: Rappé et al., JACS 114, 10024 (1992), p. 10034.
 */
function buildTorsionParams(): void {
  dihedrals = buildDihedralList(bonds, nAtoms);
  // Count dihedrals per central bond
  const dihedralCountPerBond = new Map<string, number>();
  for (const [, dj, dk] of dihedrals) {
    const bondKey = `${Math.min(dj, dk)}-${Math.max(dj, dk)}`;
    dihedralCountPerBond.set(
      bondKey,
      (dihedralCountPerBond.get(bondKey) ?? 0) + 1,
    );
  }
  torsionParams = [];
  for (const [di, dj, dk, dl] of dihedrals) {
    const {
      V,
      n: nPeriod,
      phi0,
    } = getUFFTorsionParams(
      atomicNumbers[dj],
      atomicNumbers[dk],
      hybridizations[dj],
      hybridizations[dk],
      1,
    );
    if (V > 0) {
      const bondKey = `${Math.min(dj, dk)}-${Math.max(dj, dk)}`;
      const nDihedrals = dihedralCountPerBond.get(bondKey) ?? 1;
      torsionParams.push({
        i: di,
        j: dj,
        k: dk,
        l: dl,
        V: V / nDihedrals,
        n: nPeriod,
        phi0,
      });
    }
  }

  // Build inversion (out-of-plane) parameters for sp2/sp3 centers.
  // K is divided by the total number of OOP terms per center to
  // avoid over-counting the inversion barrier.
  // Source: Rappé et al., JACS 114, 10024 (1992), Eq. 17.
  const { inversions, termsPerCenter } = buildInversionList(
    bonds,
    nAtoms,
    Array.from(atomicNumbers),
    hybridizations,
  );
  inversionParams = [];
  // Build neighbor map to check for sp2 oxygen neighbors (carbonyl C)
  const neighborMap: number[][] = Array.from({ length: nAtoms }, () => []);
  for (const bond of bonds) {
    if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;
    neighborMap[bond.atomA].push(bond.atomB);
    neighborMap[bond.atomB].push(bond.atomA);
  }
  for (const [ii, ij, ik, il] of inversions) {
    const hasONeighbor = neighborMap[ij].some(
      (nb) => atomicNumbers[nb] === 8 && hybridizations[nb] === 'sp2',
    );
    const params = getUFFInversionParams(
      atomicNumbers[ij],
      hybridizations[ij],
      hasONeighbor,
    );
    if (params) {
      const nTerms = termsPerCenter.get(ij) ?? 1;
      inversionParams.push({
        i: ii,
        j: ij,
        k: ik,
        l: il,
        K: params.K / nTerms,
        C0: params.C0,
        C1: params.C1,
        C2: params.C2,
      });
    }
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

  // Identify molecules (connected components of the bond graph)
  moleculeIds = findMolecules(bonds, nAtoms);
  moleculeInfo = computeMoleculeInfo(
    moleculeIds,
    positions,
    charges,
    masses,
    nAtoms,
  );
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

/** Cached per-force-type energy breakdown from the last computeAllForces call */
let cachedEnergyBreakdown: EnergyBreakdown = {
  morse: 0,
  angle: 0,
  torsion: 0,
  inversion: 0,
  lj: 0,
  coulomb: 0,
};

/**
 * Compute all forces and return potential energy.
 * Also populates cachedEnergyBreakdown with per-force-type contributions.
 */
function computeAllForces(pos: Float64Array, frc: Float64Array): number {
  let potentialEnergy = 0;
  let morseE = 0;
  let angleE = 0;
  let torsionE = 0;
  let inversionE = 0;
  let ljE = 0;
  let coulombE = 0;

  // PBC minimum image box size — used for both bonded and non-bonded forces.
  // Reference: Allen & Tildesley, "Computer Simulation of Liquids", Ch. 1.5.2
  const pbcBoxSize = box.periodic ? box.size : undefined;

  // 1. Bonded forces (Morse)
  for (const bp of bondParams) {
    const e = morseBondForce(
      pos,
      frc,
      bp.i,
      bp.j,
      bp.De,
      bp.alpha,
      bp.re,
      pbcBoxSize,
    );
    morseE += e;
    potentialEnergy += e;
  }

  // 2. Angle forces (harmonic) — using precomputed params
  for (const ap of angleParams) {
    const e = harmonicAngleForce(
      pos,
      frc,
      ap.i,
      ap.j,
      ap.k,
      ap.kAngle,
      ap.theta0,
      pbcBoxSize,
    );
    angleE += e;
    potentialEnergy += e;
  }

  // 2.5. Torsion forces — using precomputed params
  for (const tp of torsionParams) {
    const e = torsionForce(
      pos,
      frc,
      tp.i,
      tp.j,
      tp.k,
      tp.l,
      tp.V,
      tp.n,
      tp.phi0,
      pbcBoxSize,
    );
    torsionE += e;
    potentialEnergy += e;
  }

  // 2.75. Inversion (out-of-plane) forces — using precomputed params
  for (const ip of inversionParams) {
    const e = inversionForce(
      pos,
      frc,
      ip.i,
      ip.j,
      ip.k,
      ip.l,
      ip.K,
      ip.C0,
      ip.C1,
      ip.C2,
      pbcBoxSize,
    );
    inversionE += e;
    potentialEnergy += e;
  }

  // 3. Non-bonded forces (LJ + Coulomb) using cell list or brute force
  // 1-2 and 1-3 pairs are fully excluded; 1-4 pairs get SCALE_14 (0.5×).
  // Source: Cornell et al., JACS 117, 5179 (1995) — AMBER/OPLS convention.
  const cutoff = config.cutoff;
  const wc = wolfConst;
  const pairCallback = (i: number, j: number): void => {
    // Skip 1-2 (bonded) and 1-3 (angle) pairs
    const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
    if (exclusionSet.has(key)) return;

    // 1-4 pairs: scale LJ epsilon and Coulomb by SCALE_14
    const is14 = scale14Set.has(key);
    const scaleFactor = is14 ? SCALE_14 : 1.0;

    const { sigma, epsilon } = getLJCached(atomicNumbers[i], atomicNumbers[j]);
    const eLJ = ljForce(
      pos,
      frc,
      i,
      j,
      sigma,
      epsilon * scaleFactor,
      cutoff,
      pbcBoxSize,
    );
    ljE += eLJ;
    potentialEnergy += eLJ;
    const eCoul = coulombForce(
      pos,
      frc,
      i,
      j,
      charges[i] * scaleFactor,
      charges[j],
      wc,
      pbcBoxSize,
    );
    coulombE += eCoul;
    potentialEnergy += eCoul;
  };

  if (nAtoms < 50) {
    CellList.forEachPairBrute(pos, nAtoms, cutoff, pairCallback, pbcBoxSize);
  } else {
    if (box.periodic) {
      cellList!.buildPeriodic(pos, nAtoms, box.size);
    } else {
      cellList!.build(pos, nAtoms);
    }
    cellList!.forEachPair(pos, cutoff, pairCallback, pbcBoxSize);
  }

  // 3.5. Wolf self-energy correction (position-independent, affects PE only)
  // Uses actual (unscaled) charges — the 1-4 scaling only applies to pair terms.
  // Reference: Wolf et al., J. Chem. Phys. 110, 8254 (1999), Eq. 2.
  const wolfSelf = wolfSelfEnergy(charges, nAtoms, wc);
  coulombE += wolfSelf;
  potentialEnergy += wolfSelf;

  // 4. Drag force (spring to target position)
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

  // Cache per-force-type breakdown for the quantity dashboard
  cachedEnergyBreakdown = {
    morse: morseE,
    angle: angleE,
    torsion: torsionE,
    inversion: inversionE,
    lj: ljE,
    coulomb: coulombE,
  };

  return potentialEnergy;
}

// ---- Initialize from atoms ----
function initSimulation(
  atoms: Atom[],
  inputBonds: Bond[],
  inputBox: SimulationBox,
  cfg: SimulationConfig,
): void {
  config = { ...config, ...cfg };
  box = { ...inputBox };
  wolfConst = computeWolfConstants(config.cutoff);
  nAtoms = atoms.length;
  cachedEnergiesValid = false;

  atomicNumbers = new Int32Array(nAtoms);
  positions = new Float64Array(nAtoms * 3);
  velocities = new Float64Array(nAtoms * 3);
  forces = new Float64Array(nAtoms * 3);
  masses = new Float64Array(nAtoms);
  charges = new Float64Array(nAtoms);
  fixed = new Uint8Array(nAtoms);
  hybridizations = new Array(nAtoms);

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
    hybridizations[i] = atom.hybridization;
  }

  cellList = new CellList(config.cutoff, Math.max(nAtoms, 100));

  // Use provided bonds or detect them
  if (inputBonds.length > 0) {
    bonds = inputBonds;
    bondParams = [];
    exclusionSet.clear();
    for (const bond of bonds) {
      // H-bonds are non-covalent — their energy comes from LJ/Coulomb,
      // so they must NOT be added to the exclusion set.
      if (bond.type === 'hydrogen') continue;
      exclusionSet.add(
        `${Math.min(bond.atomA, bond.atomB)}-${Math.max(bond.atomA, bond.atomB)}`,
      );
      if (bond.type === 'vanderwaals') continue;
      const params = getMorseBondParams(
        atomicNumbers[bond.atomA],
        atomicNumbers[bond.atomB],
        bond.order,
        hybridizations[bond.atomA],
        hybridizations[bond.atomB],
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
        1,
        1,
        hybridizations[central],
      );
      angleParams.push({ i: ti, j: central, k: tk, kAngle, theta0 });
    }
    buildTorsionParams();
    // Build 1-4 scaling set for provided bonds
    scale14Set.clear();
    for (const [di, , , dl] of dihedrals) {
      const key = `${Math.min(di, dl)}-${Math.max(di, dl)}`;
      if (!exclusionSet.has(key)) {
        scale14Set.add(key);
      }
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

  // Reset reaction detection state for fresh simulation
  hasPrevTopology = false;
  prevMoleculeIds = new Int32Array(0);
  prevMoleculeInfo = [];
  pendingReactionEvents = [];

  // Initialize Nosé-Hoover chain state for the new system
  nhChainState = createNoseHooverChainState(
    nAtoms,
    config.temperature,
    config.thermostatTau,
  );

  sendState();
}

// ---- Run MD steps ----
function computeKineticEnergy(): number {
  const CONV = 103.6427; // 1 eV = 103.6427 amu·Å²/fs²
  let ke = 0;
  for (let i = 0; i < nAtoms; i++) {
    const i3 = i * 3;
    const vx = velocities[i3];
    const vy = velocities[i3 + 1];
    const vz = velocities[i3 + 2];
    ke += 0.5 * masses[i] * (vx * vx + vy * vy + vz * vz) * CONV;
  }
  return ke;
}

function runSteps(nSteps: number): void {
  let lastPE = 0;

  for (let s = 0; s < nSteps; s++) {
    // --- NH thermostat half-step BEFORE Verlet ---
    // Split integration: apply thermostat at dt/2 before and after
    // the Verlet step for time-reversible O(dt³) accuracy.
    // Source: Martyna, Tuckerman, Tobias, Klein, Mol. Phys. 87, 1117 (1996)
    if (config.thermostat === 'nose-hoover' && nhChainState) {
      const ke = computeKineticEnergy();
      noseHooverChainStep(
        velocities,
        masses,
        fixed,
        ke,
        config.temperature,
        config.timestep * 0.5,
        nhChainState,
      );
    }

    const { kineticEnergy, potentialEnergy } = velocityVerletStep(
      positions,
      velocities,
      forces,
      masses,
      fixed,
      config.timestep,
      computeAllForces,
    );

    // Wrap positions into primary cell if PBC is enabled
    if (box.periodic) {
      wrapPositions(positions, nAtoms, box.size);
    }

    lastPE = potentialEnergy;

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
    } else if (config.thermostat === 'nose-hoover' && nhChainState) {
      // --- NH thermostat half-step AFTER Verlet ---
      noseHooverChainStep(
        velocities,
        masses,
        fixed,
        kineticEnergy,
        config.temperature,
        config.timestep * 0.5,
        nhChainState,
      );
    }

    step++;
  }

  // Cache PE from the last integration step (positions unchanged since then).
  cachedPE = lastPE;

  // Recompute KE after thermostat, since Berendsen/Nosé-Hoover scale velocities.
  cachedKE = computeKineticEnergy();
  cachedEnergiesValid = true;

  // Re-detect bonds every frame for physically accurate dynamic bonding.
  // Valence constraints in detectBonds prevent spurious bonds.
  // LJ repulsion on 1-3 pairs prevents angle collapse.
  rebuildTopology();

  sendState();
}

// ---- Add atom ----
function addAtom(atom: Atom): void {
  cachedEnergiesValid = false;
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
  hybridizations.push(atom.hybridization);
  nAtoms = newN;

  rebuildTopology();
  sendState();
}

// ---- Remove atom ----
function removeAtom(atomId: number): void {
  if (atomId < 0 || atomId >= nAtoms) return;
  cachedEnergiesValid = false;

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
  hybridizations.splice(atomId, 1);
  nAtoms = newN;

  rebuildTopology();
  sendState();
}

// ---- Transmute atom (change element in place) ----
function transmuteAtom(atomId: number, newElementNumber: number): void {
  if (atomId < 0 || atomId >= nAtoms) return;
  const el = elements[newElementNumber];
  if (!el) return; // reject unknown elements
  cachedEnergiesValid = false;

  // Rescale velocity to conserve momentum: p = m_old * v_old = m_new * v_new
  // This prevents kinetic energy discontinuities when the mass changes.
  const oldMass = masses[atomId];
  const newMass = el.mass;
  if (newMass > 0) {
    const scale = oldMass / newMass;
    const i3 = atomId * 3;
    velocities[i3] *= scale;
    velocities[i3 + 1] *= scale;
    velocities[i3 + 2] *= scale;
  }

  // Update element and mass in place — no array resizing needed
  atomicNumbers[atomId] = newElementNumber;
  masses[atomId] = newMass;
  // Reset hybridization; rebuildTopology() will redetect it
  hybridizations[atomId] = 'sp3';

  // LJ params depend on element — clear cache
  ljCache.clear();

  rebuildTopology();
  sendState();
}

// ---- Minimize ----
function minimize(maxSteps: number, tolerance: number): void {
  cachedEnergiesValid = false;
  steepestDescent(
    positions,
    forces,
    fixed,
    nAtoms,
    computeAllForces,
    maxSteps,
    tolerance,
  );
  // Wrap positions into primary cell if PBC is enabled
  if (box.periodic) {
    wrapPositions(positions, nAtoms, box.size);
  }
  // Zero velocities after minimization
  velocities.fill(0);
  rebuildTopology();
  sendState();
}

// ---- Send state back to main thread ----
function sendState(): void {
  let potentialEnergy: number;
  let kineticEnergy: number;

  if (cachedEnergiesValid) {
    // Hot path: reuse energies from the most recent velocityVerletStep().
    // Avoids a redundant O(N²) computeAllForces() call.
    potentialEnergy = cachedPE;
    kineticEnergy = cachedKE;
    cachedEnergiesValid = false;
  } else {
    // Cold path: no cached value available (init, addAtom, removeAtom,
    // minimize, set-velocities). Recompute from scratch.
    forces.fill(0);
    potentialEnergy = computeAllForces(positions, forces);
    kineticEnergy = computeKineticEnergy();
  }

  const temperature = computeTemperature(kineticEnergy, nAtoms);

  // Compute thermostat energy for the extended Hamiltonian diagnostic.
  // Only non-zero when Nosé-Hoover is active.
  const thermostatEnergy =
    config.thermostat === 'nose-hoover' && nhChainState
      ? computeNoseHooverEnergy(nhChainState, config.temperature)
      : 0;

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
      thermostat: thermostatEnergy,
    },
    energyBreakdown: { ...cachedEnergyBreakdown },
    temperature,
    moleculeIds: moleculeIds.slice(),
    molecules: [...moleculeInfo],
    box: { ...box },
    reactionEvents: [...pendingReactionEvents],
  };

  // Clear pending reaction events after sending
  pendingReactionEvents = [];

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
      // Only reset NH chain state when thermostat parameters actually change value
      const needsNHReset =
        (msg.config.thermostat !== undefined &&
          msg.config.thermostat !== config.thermostat) ||
        (msg.config.temperature !== undefined &&
          msg.config.temperature !== config.temperature) ||
        (msg.config.thermostatTau !== undefined &&
          msg.config.thermostatTau !== config.thermostatTau);
      Object.assign(config, msg.config);
      wolfConst = computeWolfConstants(config.cutoff);
      if (needsNHReset && nAtoms > 0) {
        nhChainState = createNoseHooverChainState(
          nAtoms,
          config.temperature,
          config.thermostatTau,
        );
      }
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

    case 'transmute-atom':
      transmuteAtom(msg.atomId, msg.newElementNumber);
      break;

    case 'drag':
      dragAtomId = msg.atomId;
      dragTarget = msg.targetPosition;
      break;

    case 'minimize':
      stopLoop();
      minimize(msg.maxSteps, msg.tolerance);
      break;

    case 'set-velocities':
      cachedEnergiesValid = false;
      for (const entry of msg.entries) {
        const idx = entry.atomIndex;
        if (idx >= 0 && idx < nAtoms) {
          velocities[idx * 3] = entry.velocity[0];
          velocities[idx * 3 + 1] = entry.velocity[1];
          velocities[idx * 3 + 2] = entry.velocity[2];
        }
      }
      sendState();
      break;

    case 'box':
      box = { ...box, ...msg.box };
      // Wrap positions immediately when enabling PBC
      if (box.periodic) {
        wrapPositions(positions, nAtoms, box.size);
      }
      sendState();
      break;
  }
};

// Signal ready
self.postMessage({ type: 'ready' });
