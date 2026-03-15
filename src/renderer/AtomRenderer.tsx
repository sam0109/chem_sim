// ==============================================================
// AtomRenderer — renders atoms as instanced impostor spheres
// Uses ray-cast sphere impostors on billboarded quads for
// pixel-perfect spheres at ~100× fewer vertices than tessellated
// SphereGeometry. (2 triangles per atom instead of ~1000 vertices)
//
// Shaders: src/renderer/shaders/impostor-sphere.{vert,frag}.glsl
// ==============================================================

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimContextStoreApi } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';

import vertexShader from './shaders/impostor-sphere.vert.glsl';
import fragmentShader from './shaders/impostor-sphere.frag.glsl';

const _tempObject = new THREE.Object3D();
const _tempColor = new THREE.Color();

const MAX_ATOMS = 2000;

/** Pre-allocated instanced attribute buffers (module-level to avoid GC) */
const _radiusBuf = new Float32Array(MAX_ATOMS);
const _colorBuf = new Float32Array(MAX_ATOMS * 3);
const _selectedBuf = new Float32Array(MAX_ATOMS);

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

/**
 * Build a unit quad geometry for billboarded impostor rendering.
 * Vertices at (-1,-1), (1,-1), (1,1), (-1,1) in XY plane,
 * used by the vertex shader as UV offsets for billboard expansion.
 */
function createQuadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  // prettier-ignore
  const verts = new Float32Array([
    -1, -1, 0,
     1, -1, 0,
     1,  1, 0,
    -1,  1, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

export const AtomRenderer: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const simStore = useSimContextStoreApi();
  const renderMode = useUIStore((s) => s.renderMode);
  const selectedAtomIds = useUIStore((s) => s.selectedAtomIds);
  const hoveredAtomId = useUIStore((s) => s.hoveredAtomId);
  const colorMode = useUIStore((s) => s.colorMode);

  // Billboard quad geometry — 2 triangles, 4 vertices
  const geometry = useMemo(() => createQuadGeometry(), []);

  // ShaderMaterial with impostor shaders
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uScale: { value: 1.0 },
        uLightDir: { value: new THREE.Vector3(0.5774, 0.5774, 0.5774) }, // normalized (1,1,1): 1/sqrt(3)
        uAmbient: { value: new THREE.Vector3(0.25, 0.25, 0.25) },
        uShininess: { value: 40.0 },
      },
      // Required for gl_FragDepth to work correctly
      depthTest: true,
      depthWrite: true,
      // Disable back-face culling since quads face the camera
      side: THREE.DoubleSide,
    });
  }, []);

  // Set up instanced buffer attributes after geometry is created
  useEffect(() => {
    geometry.setAttribute(
      'aRadius',
      new THREE.InstancedBufferAttribute(_radiusBuf, 1),
    );
    geometry.setAttribute(
      'aColor',
      new THREE.InstancedBufferAttribute(_colorBuf, 3),
    );
    geometry.setAttribute(
      'aSelected',
      new THREE.InstancedBufferAttribute(_selectedBuf, 1),
    );
  }, [geometry]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { atoms, positions, moleculeIds } = simStore.getState();
    const nAtoms = atoms.length;

    if (nAtoms === 0) {
      mesh.count = 0;
      return;
    }

    mesh.count = nAtoms;
    const radii = _radiusBuf;
    const colors = _colorBuf;
    const selected = _selectedBuf;

    for (let i = 0; i < nAtoms; i++) {
      const atom = atoms[i];
      const el = elements[atom.elementNumber];

      // Position from flat array (more up-to-date than atom.position)
      const x = positions.length > i * 3 ? positions[i * 3] : atom.position[0];
      const y =
        positions.length > i * 3 + 1 ? positions[i * 3 + 1] : atom.position[1];
      const z =
        positions.length > i * 3 + 2 ? positions[i * 3 + 2] : atom.position[2];

      // Set position via instanceMatrix (scale=1, shader uses aRadius)
      _tempObject.position.set(x, y, z);
      _tempObject.scale.setScalar(1);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(i, _tempObject.matrix);

      // Radius based on render mode
      let radius: number;
      if (renderMode === 'space-filling') {
        radius = el ? el.vdwRadius : 1.5;
      } else if (renderMode === 'wireframe') {
        radius = 0.15;
      } else {
        // ball-and-stick: use covalent radius scaled down
        radius = el ? el.covalentRadius * 0.4 : 0.3;
      }
      radii[i] = radius;

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

      // Selection flag for shader highlight
      selected[i] = isSelected || isHovered ? 1.0 : 0.0;
    }

    mesh.instanceMatrix.needsUpdate = true;

    // Mark instanced attributes as needing update
    const radiusAttr = geometry.getAttribute(
      'aRadius',
    ) as THREE.InstancedBufferAttribute;
    const colorAttr = geometry.getAttribute(
      'aColor',
    ) as THREE.InstancedBufferAttribute;
    const selectedAttr = geometry.getAttribute(
      'aSelected',
    ) as THREE.InstancedBufferAttribute;
    radiusAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    selectedAttr.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_ATOMS]}
      frustumCulled={false}
    />
  );
};
