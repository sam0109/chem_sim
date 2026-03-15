// ==============================================================
// OrbitalRenderer -- renders orbital isosurfaces for selected atoms
// Uses marching cubes on computed wavefunction grids to produce
// semi-transparent meshes showing positive (red) and negative (blue) lobes.
// ==============================================================

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useSimContextStoreApi } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import { computeOrbitalGrid, getEffectiveZ } from '../data/orbital';
import { marchingCubes } from '../data/marchingCubes';

/** Colors for positive and negative orbital lobes */
// Red/blue convention is standard in chemistry textbooks
// Source: Atkins, "Physical Chemistry" 10th ed., Chapter 7
const POSITIVE_LOBE_COLOR = 0xcc3333;
const NEGATIVE_LOBE_COLOR = 0x3333cc;
const LOBE_OPACITY = 0.45;

/** Grid resolution for orbital computation (points per dimension) */
const GRID_RES = 40;

interface LobeMeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

/**
 * Compute isosurface meshes for a single orbital at a given atom position.
 * Returns meshes for both positive and negative lobes.
 */
function computeOrbitalMeshes(
  n: number,
  l: number,
  m: number,
  atomicNumber: number,
  center: [number, number, number],
  isovalue: number,
): { positive: LobeMeshData; negative: LobeMeshData } {
  const Zeff = getEffectiveZ(atomicNumber, n, l);
  const grid = computeOrbitalGrid(n, l, m, Zeff, center, GRID_RES);

  // Positive lobe: isosurface at +isovalue
  const positive = marchingCubes(
    grid.values,
    grid.dimensions,
    grid.origin,
    grid.cellSize,
    isovalue,
  );

  // Negative lobe: negate the field and extract at +isovalue
  // This is equivalent to extracting at -isovalue from the original field
  const negField = new Float32Array(grid.values.length);
  for (let i = 0; i < grid.values.length; i++) {
    negField[i] = -grid.values[i];
  }
  const negative = marchingCubes(
    negField,
    grid.dimensions,
    grid.origin,
    grid.cellSize,
    isovalue,
  );

  return { positive, negative };
}

/** A single orbital lobe mesh component */
const LobeMesh: React.FC<{
  data: LobeMeshData;
  color: number;
}> = ({ data, color }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (data.positions.length === 0) return geo;

    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return geo;
  }, [data]);

  // Clean up geometry on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (data.positions.length === 0) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={LOBE_OPACITY}
        side={THREE.DoubleSide}
        depthWrite={false}
        roughness={0.6}
        metalness={0.0}
      />
    </mesh>
  );
};

/**
 * OrbitalRenderer -- displays orbital isosurfaces for selected atoms.
 *
 * Reads the selected atom IDs and orbital quantum numbers from the UI store,
 * computes the orbital wavefunction on a 3D grid, extracts isosurfaces via
 * marching cubes, and renders them as semi-transparent red/blue meshes.
 *
 * Performance: Only recomputes when the orbital selection or isovalue changes.
 * The grid computation runs on the main thread but is fast enough for a
 * single atom at 40^3 resolution (~64k points).
 */
export const OrbitalRenderer: React.FC = () => {
  const simStore = useSimContextStoreApi();
  const showOrbitals = useUIStore((s) => s.showOrbitals);
  const selectedOrbital = useUIStore((s) => s.selectedOrbital);
  const orbitalIsovalue = useUIStore((s) => s.orbitalIsovalue);
  const selectedAtomIds = useUIStore((s) => s.selectedAtomIds);

  // Compute orbital meshes for all selected atoms
  const lobeMeshes = useMemo(() => {
    if (!showOrbitals || !selectedOrbital || selectedAtomIds.length === 0) {
      return [];
    }

    const { atoms, positions } = simStore.getState();
    const { n, l, m } = selectedOrbital;

    const meshes: Array<{
      atomId: number;
      positive: LobeMeshData;
      negative: LobeMeshData;
    }> = [];

    for (const atomId of selectedAtomIds) {
      if (atomId >= atoms.length) continue;

      const atom = atoms[atomId];
      // Use latest position from flat array if available
      const center: [number, number, number] =
        positions.length > atomId * 3 + 2
          ? [
              positions[atomId * 3],
              positions[atomId * 3 + 1],
              positions[atomId * 3 + 2],
            ]
          : [atom.position[0], atom.position[1], atom.position[2]];

      const { positive, negative } = computeOrbitalMeshes(
        n,
        l,
        m,
        atom.elementNumber,
        center,
        orbitalIsovalue,
      );

      meshes.push({ atomId, positive, negative });
    }

    return meshes;
  }, [
    showOrbitals,
    selectedOrbital,
    orbitalIsovalue,
    selectedAtomIds,
    simStore,
  ]);

  if (!showOrbitals || lobeMeshes.length === 0) return null;

  return (
    <group>
      {lobeMeshes.map(({ atomId, positive, negative }) => (
        <group key={atomId}>
          <LobeMesh data={positive} color={POSITIVE_LOBE_COLOR} />
          <LobeMesh data={negative} color={NEGATIVE_LOBE_COLOR} />
        </group>
      ))}
    </group>
  );
};
