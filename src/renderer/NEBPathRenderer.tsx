// ==============================================================
// NEBPathRenderer — visualizes the NEB reaction path in 3D
//
// Renders ghost atoms at each image position along the path with
// a smooth tube connecting the centers of mass, color-coded by
// energy (blue=low, red=high). The transition state image is
// highlighted.
// ==============================================================

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimContextStore } from '../store/SimulationContext';
import elements from '../data/elements';

/** Maximum atoms to render ghost copies for (performance limit) */
const MAX_GHOST_ATOMS = 300;

/**
 * Compute the center of mass for a set of positions.
 * Uses flat Float64Array [x0,y0,z0,x1,...] format.
 */
function computeCOM(positions: Float64Array, nAtoms: number): THREE.Vector3 {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < nAtoms; i++) {
    cx += positions[i * 3];
    cy += positions[i * 3 + 1];
    cz += positions[i * 3 + 2];
  }
  if (nAtoms > 0) {
    cx /= nAtoms;
    cy /= nAtoms;
    cz /= nAtoms;
  }
  return new THREE.Vector3(cx, cy, cz);
}

/**
 * Map a normalized value [0..1] to a color gradient:
 * blue (low energy) → white (mid) → red (high energy)
 */
function energyColor(t: number): THREE.Color {
  // Blue → White → Red
  if (t < 0.5) {
    const s = t * 2; // 0..1
    return new THREE.Color(s, s, 1);
  }
  const s = (t - 0.5) * 2; // 0..1
  return new THREE.Color(1, 1 - s, 1 - s);
}

export const NEBPathRenderer: React.FC = () => {
  const nebResult = useSimContextStore((s) => s.nebResult);
  const atoms = useSimContextStore((s) => s.atoms);
  const ghostMeshRef = useRef<THREE.InstancedMesh>(null);
  const tubeRef = useRef<THREE.Mesh>(null);

  // Compute path data from NEB result
  const pathData = useMemo(() => {
    if (!nebResult || nebResult.images.length < 2 || atoms.length === 0) {
      return null;
    }

    const nAtoms = atoms.length;
    const images = nebResult.images;
    const energies = nebResult.energyProfile;
    const minE = Math.min(...energies);
    const maxE = Math.max(...energies);
    const rangeE = maxE - minE || 1;

    // Compute centers of mass for the tube path
    const comPoints = images.map((img) => computeCOM(img.positions, nAtoms));

    // Create a smooth curve through the COMs
    const curve = new THREE.CatmullRomCurve3(
      comPoints,
      false,
      'catmullrom',
      0.5,
    );

    // Build ghost atom data: for each image, store atom positions and colors
    const ghostInstances: Array<{
      position: THREE.Vector3;
      color: THREE.Color;
      scale: number;
    }> = [];

    for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
      const img = images[imgIdx];
      const t = (energies[imgIdx] - minE) / rangeE;
      const color = energyColor(t);
      const isTS = imgIdx === nebResult.tsImageIndex;
      // Skip endpoints (reactant and product are already rendered by AtomRenderer)
      if (imgIdx === 0 || imgIdx === images.length - 1) continue;

      for (
        let a = 0;
        a < nAtoms && ghostInstances.length < MAX_GHOST_ATOMS;
        a++
      ) {
        const el = elements[atoms[a].elementNumber];
        const radius = el ? el.covalentRadius * 0.25 : 0.15;
        ghostInstances.push({
          position: new THREE.Vector3(
            img.positions[a * 3],
            img.positions[a * 3 + 1],
            img.positions[a * 3 + 2],
          ),
          color: isTS ? new THREE.Color(1, 0.4, 0.4) : color,
          scale: isTS ? radius * 1.5 : radius,
        });
      }
    }

    return { curve, ghostInstances, comPoints, energies, minE, rangeE };
  }, [nebResult, atoms]);

  // Update instanced mesh each frame
  useFrame(() => {
    if (!ghostMeshRef.current || !pathData) return;

    const mesh = ghostMeshRef.current;
    const { ghostInstances } = pathData;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < ghostInstances.length; i++) {
      const inst = ghostInstances[i];
      dummy.position.copy(inst.position);
      dummy.scale.setScalar(inst.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, inst.color);
    }

    mesh.count = ghostInstances.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (!pathData) return null;

  const { curve, ghostInstances } = pathData;
  const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.03, 8, false);

  return (
    <group>
      {/* Ghost atoms along the NEB path */}
      <instancedMesh
        ref={ghostMeshRef}
        args={[undefined, undefined, Math.max(ghostInstances.length, 1)]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial
          transparent
          opacity={0.35}
          roughness={0.6}
          metalness={0.1}
        />
      </instancedMesh>

      {/* Tube connecting centers of mass */}
      <mesh ref={tubeRef} geometry={tubeGeometry}>
        <meshStandardMaterial
          color="#88aaff"
          transparent
          opacity={0.5}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
};
