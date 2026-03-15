// ==============================================================
// BondRenderer — renders bonds as instanced impostor cylinders
// Uses ray-cast cylinder impostors on view-aligned quads for
// pixel-perfect cylinders at far fewer vertices than tessellated
// CylinderGeometry. (2 triangles per bond instead of ~100 vertices)
//
// Shaders: src/renderer/shaders/impostor-bond.{vert,frag}.glsl
// ==============================================================

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimContextStoreApi } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';
import { BOND_TYPE_COLORS } from '../data/bondColors';

import vertexShader from './shaders/impostor-bond.vert.glsl';
import fragmentShader from './shaders/impostor-bond.frag.glsl';

const _tempColor = new THREE.Color();

// One instance per bond (not two halves) — shader handles color interpolation
const MAX_BONDS = 2000;

/** Pre-allocated instanced attribute buffers (module-level to avoid GC) */
const _startBuf = new Float32Array(MAX_BONDS * 3);
const _endBuf = new Float32Array(MAX_BONDS * 3);
const _colorABuf = new Float32Array(MAX_BONDS * 3);
const _colorBBuf = new Float32Array(MAX_BONDS * 3);
const _radiusBuf = new Float32Array(MAX_BONDS);
const _orderBuf = new Float32Array(MAX_BONDS);

/**
 * Build a bond quad geometry for impostor rendering.
 * x ∈ [-1, 1] (across cylinder width), y ∈ [0, 1] (along bond axis).
 * The vertex shader expands this in view space along the bond direction.
 */
function createBondQuadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  // prettier-ignore
  const verts = new Float32Array([
    -1, 0, 0,
     1, 0, 0,
     1, 1, 0,
    -1, 1, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/** Shared ShaderMaterial for bond impostor rendering (module-level singleton) */
const _bondMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uBondRadius: { value: 0.08 },
    uLightDir: { value: new THREE.Vector3(0.57, 0.57, 0.57) },
    uAmbient: { value: new THREE.Vector3(0.25, 0.25, 0.25) },
  },
  depthTest: true,
  depthWrite: true,
  side: THREE.DoubleSide,
});

export const BondRenderer: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const simStore = useSimContextStoreApi();
  const renderMode = useUIStore((s) => s.renderMode);
  const bondColorMode = useUIStore((s) => s.bondColorMode);

  // Bond quad geometry — 2 triangles, 4 vertices
  const geometry = useMemo(() => createBondQuadGeometry(), []);

  // Set up instanced buffer attributes after geometry is created
  useEffect(() => {
    geometry.setAttribute(
      'aStart',
      new THREE.InstancedBufferAttribute(_startBuf, 3),
    );
    geometry.setAttribute(
      'aEnd',
      new THREE.InstancedBufferAttribute(_endBuf, 3),
    );
    geometry.setAttribute(
      'aColorA',
      new THREE.InstancedBufferAttribute(_colorABuf, 3),
    );
    geometry.setAttribute(
      'aColorB',
      new THREE.InstancedBufferAttribute(_colorBBuf, 3),
    );
    geometry.setAttribute(
      'aRadiusA',
      new THREE.InstancedBufferAttribute(_radiusBuf, 1),
    );
    geometry.setAttribute(
      'aBondOrder',
      new THREE.InstancedBufferAttribute(_orderBuf, 1),
    );
  }, [geometry]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { atoms, bonds, positions } = simStore.getState();
    if (atoms.length === 0 || bonds.length === 0) {
      mesh.count = 0;
      return;
    }

    if (renderMode === 'space-filling') {
      mesh.count = 0;
      return;
    }

    const bondRadius = renderMode === 'wireframe' ? 0.02 : 0.08;
    _bondMaterial.uniforms.uBondRadius.value = bondRadius;

    let instanceIdx = 0;

    for (const bond of bonds) {
      if (bond.atomA >= atoms.length || bond.atomB >= atoms.length) continue;
      if (instanceIdx >= MAX_BONDS) break;

      // Atom positions from flat array
      const ax =
        positions.length > bond.atomA * 3
          ? positions[bond.atomA * 3]
          : atoms[bond.atomA].position[0];
      const ay =
        positions.length > bond.atomA * 3 + 1
          ? positions[bond.atomA * 3 + 1]
          : atoms[bond.atomA].position[1];
      const az =
        positions.length > bond.atomA * 3 + 2
          ? positions[bond.atomA * 3 + 2]
          : atoms[bond.atomA].position[2];

      const bx =
        positions.length > bond.atomB * 3
          ? positions[bond.atomB * 3]
          : atoms[bond.atomB].position[0];
      const by =
        positions.length > bond.atomB * 3 + 1
          ? positions[bond.atomB * 3 + 1]
          : atoms[bond.atomB].position[1];
      const bz =
        positions.length > bond.atomB * 3 + 2
          ? positions[bond.atomB * 3 + 2]
          : atoms[bond.atomB].position[2];

      // Skip degenerate bonds
      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;
      if (dx * dx + dy * dy + dz * dz < 0.0001) continue;

      const i3 = instanceIdx * 3;

      // Start/end positions
      _startBuf[i3] = ax;
      _startBuf[i3 + 1] = ay;
      _startBuf[i3 + 2] = az;
      _endBuf[i3] = bx;
      _endBuf[i3 + 1] = by;
      _endBuf[i3 + 2] = bz;

      // Colors
      if (bondColorMode === 'bondType') {
        _tempColor.set(BOND_TYPE_COLORS[bond.type]);
        _colorABuf[i3] = _tempColor.r;
        _colorABuf[i3 + 1] = _tempColor.g;
        _colorABuf[i3 + 2] = _tempColor.b;
        _colorBBuf[i3] = _tempColor.r;
        _colorBBuf[i3 + 1] = _tempColor.g;
        _colorBBuf[i3 + 2] = _tempColor.b;
      } else {
        const elA = elements[atoms[bond.atomA].elementNumber];
        _tempColor.set(elA?.color ?? '#cccccc');
        _colorABuf[i3] = _tempColor.r;
        _colorABuf[i3 + 1] = _tempColor.g;
        _colorABuf[i3 + 2] = _tempColor.b;

        const elB = elements[atoms[bond.atomB].elementNumber];
        _tempColor.set(elB?.color ?? '#cccccc');
        _colorBBuf[i3] = _tempColor.r;
        _colorBBuf[i3 + 1] = _tempColor.g;
        _colorBBuf[i3 + 2] = _tempColor.b;
      }

      // Radius (adjusted for weak bond types)
      let radius = bondRadius;
      if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') {
        radius *= 0.5;
      }
      radius *= Math.sqrt(bond.order);
      _radiusBuf[instanceIdx] = radius;

      // Bond order for double/triple bond gap rendering
      _orderBuf[instanceIdx] = bond.order;

      instanceIdx++;
    }

    mesh.count = instanceIdx;

    // The shader uses aStart/aEnd for positioning, so we still need
    // instanceMatrix for Three.js — set identity matrices
    mesh.instanceMatrix.needsUpdate = true;

    // Mark instanced attributes as needing update
    const startAttr = geometry.getAttribute(
      'aStart',
    ) as THREE.InstancedBufferAttribute;
    const endAttr = geometry.getAttribute(
      'aEnd',
    ) as THREE.InstancedBufferAttribute;
    const colorAAttr = geometry.getAttribute(
      'aColorA',
    ) as THREE.InstancedBufferAttribute;
    const colorBAttr = geometry.getAttribute(
      'aColorB',
    ) as THREE.InstancedBufferAttribute;
    const radiusAttr = geometry.getAttribute(
      'aRadiusA',
    ) as THREE.InstancedBufferAttribute;
    const orderAttr = geometry.getAttribute(
      'aBondOrder',
    ) as THREE.InstancedBufferAttribute;
    startAttr.needsUpdate = true;
    endAttr.needsUpdate = true;
    colorAAttr.needsUpdate = true;
    colorBAttr.needsUpdate = true;
    radiusAttr.needsUpdate = true;
    orderAttr.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, _bondMaterial, MAX_BONDS]}
      frustumCulled={false}
    />
  );
};
