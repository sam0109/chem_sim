// ==============================================================
// Event Detector — detects physically significant simulation events
// and generates plain-language explanations.
//
// Pure functions only — no UI, store, or renderer imports.
// Runs on the main thread in handleWorkerState().
// ==============================================================

import type {
  Bond,
  BondType,
  ReactionEvent,
  SimulationEvent,
  SimulationEventSeverity,
  BondEventMetadata,
  TemperatureSpikeMetadata,
  EnergyDriftMetadata,
  BondStrainMetadata,
} from '../data/types';
import elements from '../data/elements';
import { getMorseBondParams } from '../data/uff';

// ---- Thresholds ----

/**
 * Temperature spike threshold: flag when |ΔT|/T_prev exceeds this ratio.
 * A 50% relative jump is physically noteworthy and typically corresponds to
 * a bond-breaking event or sudden energy release.
 */
const TEMPERATURE_SPIKE_RATIO = 0.5;

/**
 * Minimum absolute temperature change (K) to trigger a spike event.
 * Prevents false positives at very low temperatures where small
 * absolute changes produce large relative ratios.
 */
const TEMPERATURE_SPIKE_MIN_DELTA = 50;

/**
 * Energy drift threshold: flag when |ΔE|/|E_initial| exceeds this fraction
 * over the rolling window. 5% drift indicates integration instability.
 * Source: Frenkel & Smit, "Understanding Molecular Simulation", §4.1 —
 * NVE energy conservation is a standard diagnostic for timestep adequacy.
 */
const ENERGY_DRIFT_RATIO = 0.05;

/**
 * Bond strain threshold: flag when distance / equilibrium exceeds this ratio.
 * At 1.3× equilibrium, a Morse bond is significantly stretched and near the
 * dissociation shoulder, providing early warning before breakage.
 */
const BOND_STRAIN_RATIO = 1.3;

/**
 * Cooldown in simulation steps between consecutive events of the same type
 * involving the same atoms. Prevents log spam from oscillating bonds or
 * fluctuating temperatures.
 */
const EVENT_COOLDOWN_STEPS = 50;

// ---- State for cooldown tracking ----

/** Key for cooldown: "type:atomIndices" */
function cooldownKey(type: string, atomIndices: number[]): string {
  return `${type}:${[...atomIndices].sort((a, b) => a - b).join(',')}`;
}

/**
 * Check whether an event should be suppressed due to cooldown.
 * Updates the cooldown map in-place if the event is allowed.
 */
function checkCooldown(
  key: string,
  step: number,
  cooldownMap: Map<string, number>,
): boolean {
  const lastStep = cooldownMap.get(key);
  if (lastStep !== undefined && step - lastStep < EVENT_COOLDOWN_STEPS) {
    return true; // suppressed
  }
  cooldownMap.set(key, step);
  return false; // allowed
}

// ---- Bond event detection ----

/**
 * Generate enriched events from reaction events (bond changes).
 * Adds physical context: distances, equilibrium lengths, dissociation energies.
 */
export function detectBondEvents(
  reactionEvents: ReadonlyArray<ReactionEvent>,
  positions: Float64Array,
  atomicNumbers: ReadonlyArray<number>,
  cooldownMap: Map<string, number>,
): SimulationEvent[] {
  const events: SimulationEvent[] = [];

  for (const rxn of reactionEvents) {
    for (const bc of rxn.bondChanges) {
      // Skip hydrogen bonds and van der Waals — they form/break constantly
      if (bc.type === 'hydrogen' || bc.type === 'vanderwaals') continue;

      const key = cooldownKey(
        bc.change === 'formed' ? 'bond-formed' : 'bond-broken',
        [bc.atomA, bc.atomB],
      );
      if (checkCooldown(key, rxn.step, cooldownMap)) continue;

      const distance = atomDistance(positions, bc.atomA, bc.atomB);
      const z1 = atomicNumbers[bc.atomA];
      const z2 = atomicNumbers[bc.atomB];
      const params = getMorseBondParams(z1, z2, bc.order);
      const sym1 = elements[z1]?.symbol ?? `Z${z1}`;
      const sym2 = elements[z2]?.symbol ?? `Z${z2}`;

      const metadata: BondEventMetadata = {
        kind: 'bond',
        distance,
        equilibriumDistance: params.re,
        bondOrder: bc.order,
        bondType: bc.type,
        dissociationEnergy: params.De,
      };

      const explanation =
        bc.change === 'broken'
          ? formatBondBroken(
              sym1,
              bc.atomA,
              sym2,
              bc.atomB,
              distance,
              params.re,
              params.De,
              bc.order,
            )
          : formatBondFormed(
              sym1,
              bc.atomA,
              sym2,
              bc.atomB,
              distance,
              params.re,
              bc.type,
              bc.order,
            );

      events.push({
        step: rxn.step,
        type: bc.change === 'formed' ? 'bond-formed' : 'bond-broken',
        atomIndices: [bc.atomA, bc.atomB],
        explanation,
        severity: 'info',
        metadata,
      });
    }
  }

  return events;
}

// ---- Temperature spike detection ----

/**
 * Detect sudden temperature spikes between consecutive frames.
 */
export function detectTemperatureSpike(
  step: number,
  prevTemperature: number,
  currentTemperature: number,
  cooldownMap: Map<string, number>,
): SimulationEvent | null {
  if (prevTemperature <= 0) return null;

  const deltaT = currentTemperature - prevTemperature;
  const absDeltaT = Math.abs(deltaT);
  const relativeChange = absDeltaT / prevTemperature;

  if (
    relativeChange < TEMPERATURE_SPIKE_RATIO ||
    absDeltaT < TEMPERATURE_SPIKE_MIN_DELTA
  ) {
    return null;
  }

  const key = cooldownKey('temperature-spike', []);
  if (checkCooldown(key, step, cooldownMap)) return null;

  const direction = deltaT > 0 ? 'jumped' : 'dropped';
  const severity: SimulationEventSeverity =
    relativeChange > 1.0 ? 'warning' : 'info';

  const metadata: TemperatureSpikeMetadata = {
    kind: 'temperature',
    previousTemperature: prevTemperature,
    currentTemperature,
    relativeChange,
  };

  const explanation =
    `Temperature ${direction} from ${prevTemperature.toFixed(0)}K to ` +
    `${currentTemperature.toFixed(0)}K (${(relativeChange * 100).toFixed(0)}% change). ` +
    `This may indicate a bond breaking/forming event that released or absorbed energy.`;

  return {
    step,
    type: 'temperature-spike',
    atomIndices: [],
    explanation,
    severity,
    metadata,
  };
}

// ---- Energy drift detection ----

/**
 * Detect total energy drift over a rolling window.
 * Only meaningful for NVE (thermostat=none) or as a diagnostic.
 *
 * @param energyHistory - rolling window of {step, total} entries
 * @param timestep - current integration timestep in fs
 */
export function detectEnergyDrift(
  step: number,
  energyHistory: ReadonlyArray<{ step: number; total: number }>,
  timestep: number,
  thermostat: string,
  cooldownMap: Map<string, number>,
): SimulationEvent | null {
  // Need enough history to measure drift — at least 100 samples
  if (energyHistory.length < 100) return null;

  // Only report for NVE — thermostats intentionally modify energy
  if (thermostat !== 'none') return null;

  const initial = energyHistory[0];
  const current = energyHistory[energyHistory.length - 1];

  if (Math.abs(initial.total) < 1e-10) return null; // avoid divide by zero

  const relativeDrift =
    Math.abs(current.total - initial.total) / Math.abs(initial.total);

  if (relativeDrift < ENERGY_DRIFT_RATIO) return null;

  const key = cooldownKey('energy-drift', []);
  if (checkCooldown(key, step, cooldownMap)) return null;

  const windowSteps = current.step - initial.step;
  const severity: SimulationEventSeverity =
    relativeDrift > 0.1 ? 'error' : 'warning';

  // Suggest a smaller timestep for stiff bonds
  // Rule of thumb: dt should be ~1/10 of the fastest vibrational period.
  // O-H stretch period ≈ 10 fs → dt ≤ 1.0 fs; C-H ≈ 11 fs → dt ≤ 1.1 fs
  // Source: Allen & Tildesley, "Computer Simulation of Liquids", §3.2.2
  const suggestedDt = Math.min(timestep * 0.5, 0.5);

  const metadata: EnergyDriftMetadata = {
    kind: 'energy',
    initialEnergy: initial.total,
    currentEnergy: current.total,
    relativeDrift,
    windowSteps,
    timestep,
  };

  const explanation =
    `Total energy drifted by ${(relativeDrift * 100).toFixed(1)}% over ${windowSteps} steps. ` +
    `This indicates the timestep (dt=${timestep.toFixed(1)} fs) may be too large. ` +
    `Try reducing to dt≤${suggestedDt.toFixed(1)} fs for better energy conservation.`;

  return {
    step,
    type: 'energy-drift',
    atomIndices: [],
    explanation,
    severity,
    metadata,
  };
}

// ---- Bond strain detection ----

/**
 * Detect bonds that are stretched significantly beyond their equilibrium length.
 * Provides early warning before bond breakage.
 */
export function detectBondStrain(
  step: number,
  bonds: ReadonlyArray<Bond>,
  positions: Float64Array,
  atomicNumbers: ReadonlyArray<number>,
  cooldownMap: Map<string, number>,
): SimulationEvent[] {
  const events: SimulationEvent[] = [];

  for (const bond of bonds) {
    // Skip non-covalent bonds
    if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') continue;

    const distance = atomDistance(positions, bond.atomA, bond.atomB);
    const z1 = atomicNumbers[bond.atomA];
    const z2 = atomicNumbers[bond.atomB];
    const params = getMorseBondParams(z1, z2, bond.order);
    const strainRatio = distance / params.re;

    if (strainRatio < BOND_STRAIN_RATIO) continue;

    const key = cooldownKey('bond-strain', [bond.atomA, bond.atomB]);
    if (checkCooldown(key, step, cooldownMap)) continue;

    const sym1 = elements[z1]?.symbol ?? `Z${z1}`;
    const sym2 = elements[z2]?.symbol ?? `Z${z2}`;
    const severity: SimulationEventSeverity =
      strainRatio > 1.5 ? 'warning' : 'info';

    const metadata: BondStrainMetadata = {
      kind: 'strain',
      distance,
      equilibriumDistance: params.re,
      strainRatio,
      bondOrder: bond.order,
    };

    const explanation =
      `${sym1}(${bond.atomA})-${sym2}(${bond.atomB}) bond stretched to ` +
      `${distance.toFixed(2)} Å (equilibrium: ${params.re.toFixed(2)} Å, ` +
      `${((strainRatio - 1) * 100).toFixed(0)}% strain). ` +
      `Dissociation energy De=${params.De.toFixed(2)} eV — ` +
      `${strainRatio > 1.5 ? 'bond may break soon.' : 'bond is under significant strain.'}`;

    events.push({
      step,
      type: 'bond-strain',
      atomIndices: [bond.atomA, bond.atomB],
      explanation,
      severity,
      metadata,
    });
  }

  return events;
}

// ---- Explanation formatters ----

function formatBondBroken(
  sym1: string,
  idx1: number,
  sym2: string,
  idx2: number,
  distance: number,
  re: number,
  De: number,
  order: number,
): string {
  const orderStr = order === 2 ? 'double ' : order === 3 ? 'triple ' : '';
  return (
    `${sym1}(${idx1})-${sym2}(${idx2}) ${orderStr}bond broke. ` +
    `The bond had stretched to ${distance.toFixed(2)} Å ` +
    `(equilibrium: ${re.toFixed(2)} Å). ` +
    `Morse dissociation energy De=${De.toFixed(2)} eV.`
  );
}

function formatBondFormed(
  sym1: string,
  idx1: number,
  sym2: string,
  idx2: number,
  distance: number,
  re: number,
  bondType: BondType,
  order: number,
): string {
  const orderStr = order === 2 ? 'double ' : order === 3 ? 'triple ' : '';
  const typeStr = bondType === 'ionic' ? ' (ionic)' : '';
  return (
    `${sym1}(${idx1})-${sym2}(${idx2}) formed a ${orderStr}bond${typeStr}. ` +
    `They approached to ${distance.toFixed(2)} Å ` +
    `(equilibrium: ${re.toFixed(2)} Å).`
  );
}

// ---- Utilities ----

/** Compute Euclidean distance between two atoms from flat position array */
function atomDistance(positions: Float64Array, i: number, j: number): number {
  const i3 = i * 3;
  const j3 = j * 3;
  const dx = positions[i3] - positions[j3];
  const dy = positions[i3 + 1] - positions[j3 + 1];
  const dz = positions[i3 + 2] - positions[j3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
