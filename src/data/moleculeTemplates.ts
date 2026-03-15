// ==============================================================
// Molecule template registry
//
// Maps template names to lazy imports of factory functions.
// This file lives in data/ so both store and UI layers can
// reference the template name list without violating boundaries.
// The actual factory functions are registered at app init time
// from io/examples.ts via registerMoleculeTemplates().
// ==============================================================

import type { Atom } from './types';

export type MoleculeFactory = () => Atom[];

const registry = new Map<string, MoleculeFactory>();

/** Register molecule templates (called once from App.tsx at init) */
export function registerMoleculeTemplates(
  templates: Record<string, MoleculeFactory>,
): void {
  registry.clear();
  for (const [name, factory] of Object.entries(templates)) {
    registry.set(name, factory);
  }
}

/** Get all registered template names */
export function getMoleculeTemplateNames(): string[] {
  return Array.from(registry.keys());
}

/** Get a factory by name, or undefined if not registered */
export function getMoleculeFactory(name: string): MoleculeFactory | undefined {
  return registry.get(name);
}
