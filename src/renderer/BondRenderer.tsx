// ==============================================================
// BondRenderer — renders bonds as instanced cylinders
// Each bond: cylinder from atom A to atom B, colored half-and-half
// ==============================================================

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimContextStoreApi } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';
import { BOND_TYPE_COLORS } from '../data/bondColors';

const _tempObject = new THREE.Object3D();
const _tempColor = new THREE.Color();
const _start = new THREE.Vector3();
const _end = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

const MAX_BONDS = 4000; // 2 halves per bond

export const BondRenderer: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colorArrayRef = useRef(new Float32Array(MAX_BONDS * 3));
  const simStore = useSimContextStoreApi();
  const renderMode = useUIStore((s) => s.renderMode);
  const bondColorMode = useUIStore((s) => s.bondColorMode);

  const geometry = useMemo(() => {
    return new THREE.CylinderGeometry(1, 1, 1, 8, 1);
  }, []);

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

    const colors = colorArrayRef.current;
    let instanceIdx = 0;
    const bondRadius = renderMode === 'wireframe' ? 0.02 : 0.08;

    for (const bond of bonds) {
      if (bond.atomA >= atoms.length || bond.atomB >= atoms.length) continue;
      if (instanceIdx + 2 > MAX_BONDS) break;

      const getPos = (i: number) => {
        if (positions.length > i * 3 + 2) {
          return new THREE.Vector3(
            positions[i * 3],
            positions[i * 3 + 1],
            positions[i * 3 + 2],
          );
        }
        return new THREE.Vector3(...atoms[i].position);
      };

      _start.copy(getPos(bond.atomA));
      _end.copy(getPos(bond.atomB));
      _mid.lerpVectors(_start, _end, 0.5);

      const fullLength = _start.distanceTo(_end);
      const halfLength = fullLength / 2;

      if (fullLength < 0.01) continue;

      // Direction vector
      _dir.subVectors(_end, _start).normalize();

      // Quaternion to rotate Y-axis cylinder to bond direction
      _quat.setFromUnitVectors(_up, _dir);

      // Determine cylinder radius based on bond type
      let radius = bondRadius;
      if (bond.type === 'hydrogen' || bond.type === 'vanderwaals') {
        radius *= 0.5;
      }

      // For double/triple bonds, we'd offset parallel cylinders
      // For now, scale radius by sqrt(order) as visual hint
      radius *= Math.sqrt(bond.order);

      // First half: start → mid (colored by atom A or bond type)
      const midA = new THREE.Vector3().lerpVectors(_start, _mid, 0.5);
      _tempObject.position.copy(midA);
      // Midpoint of first half
      _tempObject.position.lerpVectors(_start, _mid, 0.5);
      _tempObject.quaternion.copy(_quat);
      _tempObject.scale.set(radius, halfLength, radius);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(instanceIdx, _tempObject.matrix);

      if (bondColorMode === 'bondType') {
        _tempColor.set(BOND_TYPE_COLORS[bond.type]);
      } else {
        const elA = elements[atoms[bond.atomA].elementNumber];
        _tempColor.set(elA?.color ?? '#cccccc');
      }
      colors[instanceIdx * 3] = _tempColor.r;
      colors[instanceIdx * 3 + 1] = _tempColor.g;
      colors[instanceIdx * 3 + 2] = _tempColor.b;
      instanceIdx++;

      // Second half: mid → end (colored by atom B or bond type)
      _tempObject.position.lerpVectors(_mid, _end, 0.5);
      _tempObject.quaternion.copy(_quat);
      _tempObject.scale.set(radius, halfLength, radius);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(instanceIdx, _tempObject.matrix);

      if (bondColorMode === 'bondType') {
        _tempColor.set(BOND_TYPE_COLORS[bond.type]);
      } else {
        const elB = elements[atoms[bond.atomB].elementNumber];
        _tempColor.set(elB?.color ?? '#cccccc');
      }
      colors[instanceIdx * 3] = _tempColor.r;
      colors[instanceIdx * 3 + 1] = _tempColor.g;
      colors[instanceIdx * 3 + 2] = _tempColor.b;
      instanceIdx++;
    }

    mesh.count = instanceIdx;
    mesh.instanceMatrix.needsUpdate = true;

    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        colors.slice(0, instanceIdx * 3),
        3,
      );
    } else {
      const attr = mesh.instanceColor as THREE.InstancedBufferAttribute;
      if (attr.count !== instanceIdx) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(
          colors.slice(0, instanceIdx * 3),
          3,
        );
      } else {
        attr.array = colors.slice(0, instanceIdx * 3);
        attr.needsUpdate = true;
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, MAX_BONDS]}
      frustumCulled={false}
    >
      <meshStandardMaterial vertexColors roughness={0.5} metalness={0.0} />
    </instancedMesh>
  );
};
