// ==============================================================
// SMILES string parser — converts SMILES notation to Atom[]
//
// Uses openchemlib (https://github.com/cheminfo/openchemlib-js)
// for SMILES parsing and 3D conformer generation.
//
// Why openchemlib instead of @rdkit/rdkit (RDKit.js)?
// RDKit's JS/WASM build (MinimalLib) does not expose 3D
// conformer generation (EmbedMolecule / ETKDG). See:
// https://github.com/rdkit/rdkit-js/issues/338
// ==============================================================

import { Molecule, ConformerGenerator } from 'openchemlib';
import type { Atom } from '../data/types';
import { getElement } from '../data/elements';

/**
 * Parse a SMILES string and generate 3D coordinates.
 *
 * @param smiles — SMILES notation (e.g. "CCO" for ethanol, "c1ccccc1" for benzene)
 * @returns Atom[] ready to feed into initSimulation(), or throws on failure
 *
 * @throws {Error} If the SMILES string is invalid or 3D generation fails
 */
export function parseSMILES(smiles: string): Atom[] {
  const trimmed = smiles.trim();
  if (trimmed.length === 0) {
    throw new Error('Empty SMILES string');
  }

  // Parse SMILES → molecular graph
  // Molecule.fromSmiles throws on invalid SMILES
  const mol = Molecule.fromSmiles(trimmed);

  // Generate a 3D conformer with explicit hydrogens.
  // getOneConformerAsMolecule is a convenience method that:
  //   1. Adds explicit H atoms to fill free valences
  //   2. Generates 3D coordinates using ETKDG-like algorithm
  //   3. Returns null on failure
  // Seed 42 for reproducible conformer generation.
  const gen = new ConformerGenerator(42);
  const conformer = gen.getOneConformerAsMolecule(mol);

  if (conformer === null) {
    throw new Error(
      `Failed to generate 3D coordinates for SMILES: "${trimmed}"`,
    );
  }

  // Extract atoms with their 3D positions
  const atomCount = conformer.getAllAtoms();
  const atoms: Atom[] = [];

  for (let i = 0; i < atomCount; i++) {
    const atomicNo = conformer.getAtomicNo(i);

    // Skip atoms we don't have element data for
    const el = getElement(atomicNo);
    if (!el) continue;

    atoms.push({
      id: atoms.length,
      elementNumber: atomicNo,
      // openchemlib outputs coordinates in Angstroms — matches our unit system
      position: [
        conformer.getAtomX(i),
        conformer.getAtomY(i),
        conformer.getAtomZ(i),
      ],
      velocity: [0, 0, 0],
      force: [0, 0, 0],
      charge: 0, // Gasteiger charge assignment happens in the worker
      hybridization: 'sp3', // Bond detector will reassign
      fixed: false,
    });
  }

  if (atoms.length === 0) {
    throw new Error(`SMILES "${trimmed}" produced no recognizable atoms`);
  }

  return atoms;
}
