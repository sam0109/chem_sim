// ==============================================================
// Reaction Detector — detects bond topology changes between frames
//
// Compares bond lists between consecutive topology rebuilds to
// identify formed and broken bonds. When bond changes cross
// molecule boundaries, groups them into ReactionEvents with
// reactant/product molecule info and estimated ΔE from BDE data.
//
// Only tracks covalent, ionic, and metallic bond changes.
// Hydrogen bonds and van der Waals interactions are excluded
// since they don't constitute chemical reactions.
// ==============================================================

import type {
  Bond,
  BondChangeEvent,
  MoleculeInfo,
  ReactionEvent,
} from '../data/types';
import { getBDE } from '../data/bondEnergies';

// Conversion factor: kcal/mol → eV
// Source: NIST (1 kcal/mol = 0.0433641 eV)
const KCAL_TO_EV = 0.0433641;

/**
 * Create a canonical bond key string for comparison.
 * Always puts the smaller atom index first.
 */
function bondKey(atomA: number, atomB: number): string {
  return atomA < atomB ? `${atomA}-${atomB}` : `${atomB}-${atomA}`;
}

/**
 * Build a map from bond key to Bond for efficient lookup.
 * Only includes covalent, ionic, and metallic bonds (molecule-defining).
 */
function buildBondMap(bonds: ReadonlyArray<Bond>): Map<string, Bond> {
  const map = new Map<string, Bond>();
  for (const bond of bonds) {
    if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;
    map.set(bondKey(bond.atomA, bond.atomB), bond);
  }
  return map;
}

/**
 * Compute the diff between two bond lists.
 * Returns an array of BondChangeEvents describing which bonds
 * were formed or broken between the previous and current states.
 *
 * Only considers covalent, ionic, and metallic bonds.
 * Hydrogen bond and van der Waals changes are ignored.
 *
 * @param prevBonds  Bond list from the previous topology rebuild
 * @param currBonds  Bond list from the current topology rebuild
 * @returns Array of bond change events (empty if no changes)
 */
export function diffBonds(
  prevBonds: ReadonlyArray<Bond>,
  currBonds: ReadonlyArray<Bond>,
): BondChangeEvent[] {
  const prevMap = buildBondMap(prevBonds);
  const currMap = buildBondMap(currBonds);
  const changes: BondChangeEvent[] = [];

  // Bonds that exist in current but not in previous → formed
  for (const [key, bond] of currMap) {
    if (!prevMap.has(key)) {
      changes.push({
        atomA: Math.min(bond.atomA, bond.atomB),
        atomB: Math.max(bond.atomA, bond.atomB),
        order: bond.order,
        type: bond.type,
        change: 'formed',
      });
    }
  }

  // Bonds that exist in previous but not in current → broken
  for (const [key, bond] of prevMap) {
    if (!currMap.has(key)) {
      changes.push({
        atomA: Math.min(bond.atomA, bond.atomB),
        atomB: Math.max(bond.atomA, bond.atomB),
        order: bond.order,
        type: bond.type,
        change: 'broken',
      });
    }
  }

  return changes;
}

/**
 * Estimate the reaction energy (ΔE) from bond changes using BDE data.
 *
 * ΔE = Σ BDE(bonds broken) − Σ BDE(bonds formed)
 *
 * Positive ΔE = endothermic (energy absorbed)
 * Negative ΔE = exothermic (energy released)
 *
 * Returns null if BDE data is unavailable for any bond involved.
 *
 * @param bondChanges  Array of bond change events
 * @param atomicNumbers  Atomic numbers for all atoms
 * @returns Estimated ΔE in eV, or null
 */
export function estimateReactionEnergy(
  bondChanges: ReadonlyArray<BondChangeEvent>,
  atomicNumbers: Int32Array,
): number | null {
  let totalBrokenBDE = 0;
  let totalFormedBDE = 0;

  for (const change of bondChanges) {
    const z1 = atomicNumbers[change.atomA];
    const z2 = atomicNumbers[change.atomB];
    const bde = getBDE(z1, z2, change.order);
    if (bde === undefined) return null;

    if (change.change === 'broken') {
      totalBrokenBDE += bde;
    } else {
      totalFormedBDE += bde;
    }
  }

  // ΔE = energy to break bonds − energy released by forming bonds
  return (totalBrokenBDE - totalFormedBDE) * KCAL_TO_EV;
}

/**
 * Detect reaction events from bond changes and molecule topology.
 *
 * A reaction occurs when bond changes cause the molecule topology
 * to change — i.e., when bonds form between atoms of different
 * molecules (merge) or bonds break within a molecule (split).
 *
 * Groups related bond changes into a single ReactionEvent with
 * the affected reactant and product molecules.
 *
 * @param bondChanges     Bond changes from diffBonds()
 * @param prevMoleculeIds Molecule IDs per atom from previous frame
 * @param currMoleculeIds Molecule IDs per atom from current frame
 * @param prevMolecules   MoleculeInfo array from previous frame
 * @param currMolecules   MoleculeInfo array from current frame
 * @param atomicNumbers   Atomic numbers for all atoms
 * @param currentStep     Current simulation step number
 * @returns Array of ReactionEvents (empty if no topology changes)
 */
export function detectReactions(
  bondChanges: ReadonlyArray<BondChangeEvent>,
  prevMoleculeIds: Int32Array,
  currMoleculeIds: Int32Array,
  prevMolecules: ReadonlyArray<MoleculeInfo>,
  currMolecules: ReadonlyArray<MoleculeInfo>,
  atomicNumbers: Int32Array,
  currentStep: number,
): ReactionEvent[] {
  if (bondChanges.length === 0) return [];

  // Collect all affected molecule IDs (both previous and current)
  const affectedPrevMolIds = new Set<number>();
  const affectedCurrMolIds = new Set<number>();

  for (const change of bondChanges) {
    // Track which previous molecules are involved
    if (prevMoleculeIds.length > 0) {
      affectedPrevMolIds.add(prevMoleculeIds[change.atomA]);
      affectedPrevMolIds.add(prevMoleculeIds[change.atomB]);
    }
    // Track which current molecules are involved
    if (currMoleculeIds.length > 0) {
      affectedCurrMolIds.add(currMoleculeIds[change.atomA]);
      affectedCurrMolIds.add(currMoleculeIds[change.atomB]);
    }
  }

  // Check if the molecule topology actually changed
  // (bond order changes within the same molecule aren't reactions)
  const prevMolCount = affectedPrevMolIds.size;
  const currMolCount = affectedCurrMolIds.size;

  // If the same set of atoms maps to the same number of molecules
  // and each molecule has the same atoms, it's not a reaction
  // (could just be a bond order change or intramolecular rearrangement)
  if (prevMolCount === currMolCount && prevMolCount === 1) {
    // Single molecule involved on both sides — check if it's the same atoms
    const prevId = [...affectedPrevMolIds][0];
    const currId = [...affectedCurrMolIds][0];
    const prevAtoms = prevMolecules[prevId]?.atomIndices ?? [];
    const currAtoms = currMolecules[currId]?.atomIndices ?? [];

    if (prevAtoms.length === currAtoms.length) {
      const prevSet = new Set(prevAtoms);
      const allSame = currAtoms.every((a) => prevSet.has(a));
      if (allSame) {
        // Same molecule with internal bond rearrangement, not a reaction
        return [];
      }
    }
  }

  // Build the reaction event
  const reactants: MoleculeInfo[] = [];
  for (const molId of affectedPrevMolIds) {
    const mol = prevMolecules[molId];
    if (mol) reactants.push(mol);
  }

  const products: MoleculeInfo[] = [];
  for (const molId of affectedCurrMolIds) {
    const mol = currMolecules[molId];
    if (mol) products.push(mol);
  }

  const deltaE = estimateReactionEnergy(bondChanges, atomicNumbers);

  return [
    {
      step: currentStep,
      bondChanges: [...bondChanges],
      reactants,
      products,
      deltaE,
    },
  ];
}
