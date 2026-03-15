// ==============================================================
// ElectronDensityRenderer — renders an electron density isosurface
//
// Computes a Gaussian superposition electron density for all atoms
// in the simulation, extracts an isosurface via marching cubes, and
// renders it as a translucent mesh. Updates only when atom positions
// change significantly or when the user adjusts the isovalue/opacity.
// ==============================================================

import React, { useMemo, useRef, useEffect } from 'react';
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
 * Squared distance threshold (in Angstrom^2) for triggering a
 * recomputation. If any atom moves more than sqrt(RECOMPUTE_THRESHOLD)
 * from its last-computed position, the density is recomputed.
 *
 * 0.25 Angstrom^2 = 0.5 Angstrom displacement — balances
 * responsiveness with performance.
 */
const RECOMPUTE_THRESHOLD = 0.25;

/**
 * ElectronDensityRenderer — displays an electron density isosurface
 * for all atoms in the simulation.
 *
 * Reads atom positions from the simulation store and UI toggles
 * from the UI store. Only recomputes the density grid when atom
 * positions change beyond a threshold or when the isovalue changes.
 */
export const ElectronDensityRenderer: React.FC = () => {
  const simStore = useSimContextStoreApi();
  const showElectronDensity = useUIStore((s) => s.showElectronDensity);
  const electronDensityIsovalue = useUIStore((s) => s.electronDensityIsovalue);
  const electronDensityOpacity = useUIStore((s) => s.electronDensityOpacity);

  // Track last-computed positions to avoid unnecessary recomputations
  const lastPositionsRef = useRef<Float64Array>(new Float64Array(0));
  const lastAtomCountRef = useRef<number>(0);
  const lastIsovalueRef = useRef<number>(electronDensityIsovalue);

  // Check whether positions have changed enough to warrant recomputation
  const needsRecompute = (
    positions: Float64Array,
    atomCount: number,
  ): boolean => {
    if (atomCount !== lastAtomCountRef.current) return true;
    if (electronDensityIsovalue !== lastIsovalueRef.current) return true;
    if (lastPositionsRef.current.length !== positions.length) return true;

    const prev = lastPositionsRef.current;
    for (let i = 0; i < atomCount; i++) {
      const dx = positions[i * 3] - prev[i * 3];
      const dy = positions[i * 3 + 1] - prev[i * 3 + 1];
      const dz = positions[i * 3 + 2] - prev[i * 3 + 2];
      if (dx * dx + dy * dy + dz * dz > RECOMPUTE_THRESHOLD) {
        return true;
      }
    }
    return false;
  };

  // Compute the isosurface mesh data
  const meshData: MarchingCubesMesh | null = useMemo(() => {
    if (!showElectronDensity) return null;

    const { atoms, positions } = simStore.getState();
    if (atoms.length === 0) return null;

    // Check if recomputation is needed
    if (!needsRecompute(positions, atoms.length)) {
      // Return a sentinel to keep the previous mesh
      return undefined as unknown as MarchingCubesMesh | null;
    }

    // Build input array from current positions
    const densityAtoms: DensityAtomInput[] = atoms.map((atom, i) => ({
      elementNumber: atom.elementNumber,
      position:
        positions.length > i * 3 + 2
          ? [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]
          : [atom.position[0], atom.position[1], atom.position[2]],
    }));

    // Compute density grid
    const grid = computeElectronDensityGrid(densityAtoms);
    if (grid.values.length === 0) return null;

    // Extract isosurface
    const mesh = marchingCubes(
      grid.values,
      grid.dimensions,
      grid.origin,
      grid.cellSize,
      electronDensityIsovalue,
    );

    // Update tracking refs
    lastPositionsRef.current = new Float64Array(positions);
    lastAtomCountRef.current = atoms.length;
    lastIsovalueRef.current = electronDensityIsovalue;

    return mesh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Clean up geometry on unmount
  const geoRef = useRef(geometry);
  geoRef.current = geometry;
  useEffect(() => {
    return () => {
      geoRef.current.dispose();
    };
  }, []);

  // Dispose old geometry when it changes
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
