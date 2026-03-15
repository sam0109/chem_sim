// ==============================================================
// ElectronDensityRenderer — renders an electron density isosurface
//
// Computes a Gaussian superposition electron density for all atoms
// in the simulation, extracts an isosurface via marching cubes, and
// renders it as a translucent mesh.
// ==============================================================

import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useSimContextStoreApi } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import {
  computeElectronDensityGrid,
  type DensityAtomInput,
} from '../data/electronDensity';
import { marchingCubes, type MarchingCubesMesh } from '../data/marchingCubes';

/** Color for the electron density surface — translucent cyan/blue */
// Cyan-blue chosen to distinguish from orbital lobes (red/blue)
// and to evoke the conventional "electron cloud" appearance
const DENSITY_COLOR = 0x44aadd;

/**
 * Compute the electron density mesh for a given set of atoms and isovalue.
 * Pure function — no React refs or hooks.
 */
function computeDensityMesh(
  atoms: ReadonlyArray<{
    elementNumber: number;
    position: [number, number, number];
  }>,
  positions: Float64Array,
  isovalue: number,
): MarchingCubesMesh | null {
  if (atoms.length === 0) return null;

  // Build input array from current positions
  const densityAtoms: DensityAtomInput[] = atoms.map((atom, i) => ({
    elementNumber: atom.elementNumber,
    position:
      positions.length > i * 3 + 2
        ? [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]
        : [atom.position[0], atom.position[1], atom.position[2]],
  }));

  // Compute density grid
  // Grid indexing convention: field[iz * ny * nx + iy * nx + ix]
  // matching the marchingCubes() expectation from marchingCubes.ts
  const grid = computeElectronDensityGrid(densityAtoms);
  if (grid.values.length === 0) return null;

  // Extract isosurface
  return marchingCubes(
    grid.values,
    grid.dimensions,
    grid.origin,
    grid.cellSize,
    isovalue,
  );
}

/**
 * ElectronDensityRenderer — displays an electron density isosurface
 * for all atoms in the simulation.
 *
 * Reads atom positions from the simulation store and UI toggles
 * from the UI store. Recomputes whenever the toggle or isovalue changes.
 */
export const ElectronDensityRenderer: React.FC = () => {
  const simStore = useSimContextStoreApi();
  const showElectronDensity = useUIStore((s) => s.showElectronDensity);
  const electronDensityIsovalue = useUIStore((s) => s.electronDensityIsovalue);
  const electronDensityOpacity = useUIStore((s) => s.electronDensityOpacity);

  // Compute the isosurface mesh data
  const meshData: MarchingCubesMesh | null = useMemo(() => {
    if (!showElectronDensity) return null;

    const { atoms, positions } = simStore.getState();
    return computeDensityMesh(atoms, positions, electronDensityIsovalue);
  }, [showElectronDensity, electronDensityIsovalue, simStore]);

  // Build Three.js geometry from mesh data
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (!meshData || meshData.positions.length === 0) return geo;

    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(meshData.positions, 3),
    );
    geo.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    return geo;
  }, [meshData]);

  // Dispose old geometry when it changes or on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (!showElectronDensity || !meshData || meshData.positions.length === 0) {
    return null;
  }

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={DENSITY_COLOR}
        transparent
        opacity={electronDensityOpacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
};
