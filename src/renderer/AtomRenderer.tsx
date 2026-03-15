// ==============================================================
// AtomRenderer — renders atoms as instanced spheres
// Uses InstancedMesh with per-instance color/scale for performance
// ==============================================================

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../store/simulationStore';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';

const _tempObject = new THREE.Object3D();
const _tempColor = new THREE.Color();

const MAX_ATOMS = 2000;

/**
 * Distinct color palette for molecule coloring.
 * 10 perceptually distinct colors chosen for accessibility.
 * Source: Tableau 10 categorical palette.
 */
const MOLECULE_PALETTE = [
  '#4e79a7', // blue
  '#f28e2b', // orange
  '#e15759', // red
  '#76b7b2', // teal
  '#59a14f', // green
  '#edc948', // yellow
  '#b07aa1', // purple
  '#ff9da7', // pink
  '#9c755f', // brown
  '#bab0ac', // gray
];

export const AtomRenderer: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colorArrayRef = useRef(new Float32Array(MAX_ATOMS * 3));
  const renderMode = useUIStore((s) => s.renderMode);
  const selectedAtomIds = useUIStore((s) => s.selectedAtomIds);
  const hoveredAtomId = useUIStore((s) => s.hoveredAtomId);
  const colorMode = useUIStore((s) => s.colorMode);

  // Create shared geometry
  const geometry = useMemo(() => {
    const detail = renderMode === 'space-filling' ? 32 : 16;
    return new THREE.SphereGeometry(1, detail, detail);
  }, [renderMode]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { atoms, positions, moleculeIds } = useSimulationStore.getState();
    const nAtoms = atoms.length;

    if (nAtoms === 0) {
      mesh.count = 0;
      return;
    }

    mesh.count = nAtoms;
    const colors = colorArrayRef.current;

    for (let i = 0; i < nAtoms; i++) {
      const atom = atoms[i];
      const el = elements[atom.elementNumber];

      // Position from flat array (more up-to-date than atom.position)
      const x = positions.length > i * 3 ? positions[i * 3] : atom.position[0];
      const y =
        positions.length > i * 3 + 1 ? positions[i * 3 + 1] : atom.position[1];
      const z =
        positions.length > i * 3 + 2 ? positions[i * 3 + 2] : atom.position[2];

      _tempObject.position.set(x, y, z);

      // Scale based on render mode
      let radius: number;
      if (renderMode === 'space-filling') {
        radius = el ? el.vdwRadius : 1.5;
      } else if (renderMode === 'wireframe') {
        radius = 0.15;
      } else {
        // ball-and-stick: use covalent radius scaled down
        radius = el ? el.covalentRadius * 0.4 : 0.3;
      }

      _tempObject.scale.setScalar(radius);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(i, _tempObject.matrix);

      // Color
      const isSelected = selectedAtomIds.includes(i);
      const isHovered = hoveredAtomId === i;

      if (isSelected) {
        _tempColor.set(0x4da6ff);
      } else if (isHovered) {
        _tempColor.set(0x88ccff);
      } else if (colorMode === 'molecule' && moleculeIds.length > i) {
        const molId = moleculeIds[i];
        _tempColor.set(MOLECULE_PALETTE[molId % MOLECULE_PALETTE.length]);
      } else {
        _tempColor.set(el?.color ?? '#cccccc');
      }

      colors[i * 3] = _tempColor.r;
      colors[i * 3 + 1] = _tempColor.g;
      colors[i * 3 + 2] = _tempColor.b;
    }

    mesh.instanceMatrix.needsUpdate = true;

    // Update instance colors
    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        colors.slice(0, nAtoms * 3),
        3,
      );
    } else {
      const attr = mesh.instanceColor as THREE.InstancedBufferAttribute;
      if (attr.count !== nAtoms) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(
          colors.slice(0, nAtoms * 3),
          3,
        );
      } else {
        attr.array = colors.slice(0, nAtoms * 3);
        attr.needsUpdate = true;
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, MAX_ATOMS]}
      frustumCulled={false}
    >
      <meshStandardMaterial vertexColors roughness={0.4} metalness={0.1} />
    </instancedMesh>
  );
};
