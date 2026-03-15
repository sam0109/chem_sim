// ==============================================================
// Bond-aware atom placement geometry
//
// Computes ideal positions for new atoms bonded to existing atoms,
// using UFF bond lengths and VSEPR-based coordination geometry.
//
// Engine code — no UI/renderer/store imports allowed.
// ==============================================================

import type { Atom, Bond, Hybridization } from '../data/types';
import type { Vector3Tuple } from 'three';
import elements from '../data/elements';
import { getUFFBondLength } from '../data/uff';

/**
 * Canonical bond direction sets for each hybridization geometry.
 * These are the ideal unit vectors for each coordination site,
 * expressed in a local frame where the first bond is along +x.
 *
 * Source: standard VSEPR geometry (Gillespie & Nyholm, 1957)
 */
export function getIdealDirections(
  hybridization: Hybridization,
): Vector3Tuple[] {
  switch (hybridization) {
    case 'sp3':
      // Tetrahedral: 4 directions at 109.47 apart
      // Using normalized vertices of a regular tetrahedron
      return [
        [1, 0, -1 / Math.SQRT2],
        [-1, 0, -1 / Math.SQRT2],
        [0, 1, 1 / Math.SQRT2],
        [0, -1, 1 / Math.SQRT2],
      ].map(normalize3) as Vector3Tuple[];
    case 'sp2':
      // Trigonal planar: 3 directions at 120 in the xz plane
      return [
        [1, 0, 0],
        [-0.5, 0, Math.sqrt(3) / 2],
        [-0.5, 0, -Math.sqrt(3) / 2],
      ].map(normalize3) as Vector3Tuple[];
    case 'sp':
      // Linear: 2 directions at 180
      return [
        [1, 0, 0],
        [-1, 0, 0],
      ];
    case 'sp3d':
      // Trigonal bipyramidal: 5 directions
      return [
        [0, 1, 0], // axial up
        [0, -1, 0], // axial down
        [1, 0, 0], // equatorial
        [-0.5, 0, Math.sqrt(3) / 2], // equatorial
        [-0.5, 0, -Math.sqrt(3) / 2], // equatorial
      ];
    case 'sp3d2':
      // Octahedral: 6 directions
      return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];
    case 'none':
    default:
      // For atoms with no hybridization (H, noble gases), default to +x
      return [[1, 0, 0]];
  }
}

/**
 * Compute the ideal position for a new atom bonded to an existing atom.
 *
 * Uses UFF bond lengths for the bond distance and VSEPR-based coordination
 * geometry to pick the next available bonding site on the target atom.
 *
 * @param atoms - Current atom list
 * @param bonds - Current bond list (indices into atoms array)
 * @param positions - Flat position array [x0,y0,z0,x1,...] or null to use atom.position
 * @param targetIndex - Index of the atom to bond to
 * @param newElementZ - Atomic number of the new atom
 * @param bondOrder - Bond order for the new bond (1, 2, or 3)
 * @returns The ideal [x, y, z] position for the new atom, or null if target is saturated
 */
export function computeBondedPosition(
  atoms: Atom[],
  bonds: Bond[],
  positions: Float64Array | null,
  targetIndex: number,
  newElementZ: number,
  bondOrder: number = 1,
): Vector3Tuple | null {
  const target = atoms[targetIndex];
  if (!target) return null;

  // Check valence — can the target accept another bond?
  const targetElement = elements[target.elementNumber];
  if (!targetElement) return null;

  const currentValence = computeCurrentValence(targetIndex, bonds);
  if (currentValence + bondOrder > targetElement.maxValence) {
    return null; // Saturated
  }

  // Get the target atom's current position
  const targetPos = getPosition(targetIndex, atoms, positions);

  // Compute ideal bond length
  const bondLength = getUFFBondLength(
    target.elementNumber,
    newElementZ,
    bondOrder,
    target.hybridization,
  );

  // Get existing bond directions from the target atom
  const existingDirs = getExistingBondDirections(
    targetIndex,
    atoms,
    bonds,
    positions,
  );

  // Get the ideal coordination directions for this hybridization
  const idealDirs = getIdealDirections(target.hybridization);

  // Find the best direction for the new bond
  const direction = pickNextDirection(idealDirs, existingDirs);

  return [
    targetPos[0] + direction[0] * bondLength,
    targetPos[1] + direction[1] * bondLength,
    targetPos[2] + direction[2] * bondLength,
  ];
}

/**
 * Compute the total valence (sum of bond orders) currently used by an atom.
 */
function computeCurrentValence(atomIndex: number, bonds: Bond[]): number {
  let valence = 0;
  for (const bond of bonds) {
    if (bond.type !== 'covalent') continue;
    if (bond.atomA === atomIndex || bond.atomB === atomIndex) {
      valence += bond.order;
    }
  }
  return valence;
}

/**
 * Get the position of an atom from the flat positions array or atom data.
 */
function getPosition(
  index: number,
  atoms: Atom[],
  positions: Float64Array | null,
): Vector3Tuple {
  if (positions && positions.length > index * 3 + 2) {
    return [
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    ];
  }
  return atoms[index].position;
}

/**
 * Get unit direction vectors of all existing bonds from a given atom.
 */
function getExistingBondDirections(
  atomIndex: number,
  atoms: Atom[],
  bonds: Bond[],
  positions: Float64Array | null,
): Vector3Tuple[] {
  const centerPos = getPosition(atomIndex, atoms, positions);
  const dirs: Vector3Tuple[] = [];

  for (const bond of bonds) {
    if (bond.type !== 'covalent') continue;
    let neighborIdx = -1;
    if (bond.atomA === atomIndex) neighborIdx = bond.atomB;
    else if (bond.atomB === atomIndex) neighborIdx = bond.atomA;
    else continue;

    const neighborPos = getPosition(neighborIdx, atoms, positions);
    const dx = neighborPos[0] - centerPos[0];
    const dy = neighborPos[1] - centerPos[1];
    const dz = neighborPos[2] - centerPos[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 1e-10) {
      dirs.push([dx / len, dy / len, dz / len]);
    }
  }

  return dirs;
}

/**
 * Pick the best available direction from ideal VSEPR directions,
 * given the already-occupied directions.
 *
 * Strategy:
 * 1. If no existing bonds: rotate ideal frame so first direction has a
 *    sensible world-space orientation (slight upward tilt from +x).
 * 2. If existing bonds: align the ideal direction frame to the existing
 *    bonds, then pick the first unoccupied site.
 * 3. Fallback: pick the direction maximally separated from all existing bonds.
 */
function pickNextDirection(
  idealDirs: Vector3Tuple[],
  existingDirs: Vector3Tuple[],
): Vector3Tuple {
  if (existingDirs.length === 0) {
    // No existing bonds — return the first ideal direction
    // with a slight upward tilt so the atom doesn't land exactly on y=0
    return idealDirs[0];
  }

  if (existingDirs.length === 1 && idealDirs.length >= 2) {
    // One existing bond: align ideal frame so first ideal direction matches
    // the existing bond, then return the second ideal direction (rotated).
    return alignAndPickNext(idealDirs, existingDirs[0], 1);
  }

  if (existingDirs.length >= 2 && idealDirs.length > existingDirs.length) {
    // Multiple existing bonds: use alignment approach
    return alignAndPickNext(idealDirs, existingDirs[0], existingDirs.length);
  }

  // Fallback: find direction maximally distant from all existing bond directions
  return findMaxSeparatedDirection(existingDirs);
}

/**
 * Align the ideal direction set so that idealDirs[0] maps to the given
 * reference direction, then return idealDirs[pickIndex] after rotation.
 *
 * Uses Rodrigues' rotation formula to rotate the ideal frame.
 */
function alignAndPickNext(
  idealDirs: Vector3Tuple[],
  refDir: Vector3Tuple,
  pickIndex: number,
): Vector3Tuple {
  // Rotation that maps idealDirs[0] onto refDir
  const from = idealDirs[0];
  const to = refDir;

  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];

  // If from and to are nearly parallel, no rotation needed
  if (dot > 0.9999) {
    return idealDirs[pickIndex] || idealDirs[idealDirs.length - 1];
  }

  // If from and to are nearly anti-parallel, use 180 rotation about a perpendicular axis
  if (dot < -0.9999) {
    // Find a perpendicular vector
    const perp = perpendicular(from);
    const target = idealDirs[pickIndex] || idealDirs[idealDirs.length - 1];
    // Rotate 180 about perp: v' = 2(perp . v)perp - v
    const d = target[0] * perp[0] + target[1] * perp[1] + target[2] * perp[2];
    return normalize3([
      2 * d * perp[0] - target[0],
      2 * d * perp[1] - target[1],
      2 * d * perp[2] - target[2],
    ]) as Vector3Tuple;
  }

  // Rodrigues' rotation: rotate from → to
  // axis = normalize(from × to)
  const cx = from[1] * to[2] - from[2] * to[1];
  const cy = from[2] * to[0] - from[0] * to[2];
  const cz = from[0] * to[1] - from[1] * to[0];
  const sinTheta = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const ax = cx / sinTheta;
  const ay = cy / sinTheta;
  const az = cz / sinTheta;
  const cosTheta = dot;

  const target = idealDirs[pickIndex] || idealDirs[idealDirs.length - 1];
  return rodriguesRotate(target, [ax, ay, az], cosTheta, sinTheta);
}

/**
 * Rodrigues' rotation of vector v about unit axis k by angle with given cos/sin.
 * v' = v cos(theta) + (k x v) sin(theta) + k (k . v)(1 - cos(theta))
 */
function rodriguesRotate(
  v: Vector3Tuple,
  k: Vector3Tuple,
  cosT: number,
  sinT: number,
): Vector3Tuple {
  const kdotv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const kcrossv: Vector3Tuple = [
    k[1] * v[2] - k[2] * v[1],
    k[2] * v[0] - k[0] * v[2],
    k[0] * v[1] - k[1] * v[0],
  ];
  return normalize3([
    v[0] * cosT + kcrossv[0] * sinT + k[0] * kdotv * (1 - cosT),
    v[1] * cosT + kcrossv[1] * sinT + k[1] * kdotv * (1 - cosT),
    v[2] * cosT + kcrossv[2] * sinT + k[2] * kdotv * (1 - cosT),
  ]) as Vector3Tuple;
}

/**
 * Find a unit vector perpendicular to the given vector.
 */
function perpendicular(v: Vector3Tuple): Vector3Tuple {
  if (Math.abs(v[0]) < 0.9) {
    return normalize3([0, -v[2], v[1]]) as Vector3Tuple;
  }
  return normalize3([-v[2], 0, v[0]]) as Vector3Tuple;
}

/**
 * Find the direction that is maximally separated from all existing directions.
 * Tests candidate directions on a coarse sphere and picks the one with
 * the largest minimum angle to any existing direction.
 */
function findMaxSeparatedDirection(existingDirs: Vector3Tuple[]): Vector3Tuple {
  let bestDir: Vector3Tuple = [0, 1, 0]; // default: upward
  let bestMinDot = 1.0; // worst case: parallel

  // Sample ~26 directions on the unit sphere (Fibonacci-ish + axis-aligned)
  const candidates: Vector3Tuple[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  // Add more candidates using golden-angle spiral
  const N = 20;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * i) / (N - 1);
    const r = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    candidates.push([r * Math.cos(theta), y, r * Math.sin(theta)]);
  }

  for (const cand of candidates) {
    const cn = normalize3(cand) as Vector3Tuple;
    let maxDotToExisting = -1;
    for (const ed of existingDirs) {
      const d = cn[0] * ed[0] + cn[1] * ed[1] + cn[2] * ed[2];
      if (d > maxDotToExisting) maxDotToExisting = d;
    }
    // We want the candidate whose maximum dot product with any existing dir is smallest
    if (maxDotToExisting < bestMinDot) {
      bestMinDot = maxDotToExisting;
      bestDir = cn;
    }
  }

  return bestDir;
}

/**
 * Normalize a 3-component vector to unit length.
 */
function normalize3(v: number[]): number[] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-10) return [1, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}
