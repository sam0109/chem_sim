// ==============================================================
// Scene — main R3F scene composition
// ==============================================================

import React, { useEffect, useCallback, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { AtomRenderer } from './AtomRenderer';
import { BondRenderer } from './BondRenderer';
import { AtomLabels } from './AtomLabels';
import { useSimContextStoreApi } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';
import type { Atom } from '../data/types';

// ---- Interaction handler (inside Canvas) ----
const Interaction: React.FC = () => {
  const { camera, raycaster, gl } = useThree();
  const simStore = useSimContextStoreApi();
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const mouseRef = useRef(new THREE.Vector2());
  const intersectPoint = useRef(new THREE.Vector3());

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const activeTool = useUIStore.getState().activeTool;
      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );

      raycaster.setFromCamera(mouseRef.current, camera);

      if (activeTool === 'place-atom') {
        // Intersect with ground plane (y=0)
        const hit = raycaster.ray.intersectPlane(
          planeRef.current,
          intersectPoint.current,
        );
        if (hit) {
          const selectedElement = useUIStore.getState().selectedElement;
          const newAtom: Atom = {
            id: Date.now(),
            elementNumber: selectedElement,
            position: [hit.x, hit.y, hit.z],
            velocity: [0, 0, 0],
            force: [0, 0, 0],
            charge: 0,
            hybridization: 'sp3',
            fixed: false,
          };
          simStore.getState().addAtom(newAtom);
        }
      } else if (activeTool === 'select') {
        // Try to pick an atom — simple proximity check
        const { atoms, positions } = simStore.getState();
        let closest = -1;
        let closestDist = Infinity;

        for (let i = 0; i < atoms.length; i++) {
          const x =
            positions.length > i * 3 ? positions[i * 3] : atoms[i].position[0];
          const y =
            positions.length > i * 3 + 1
              ? positions[i * 3 + 1]
              : atoms[i].position[1];
          const z =
            positions.length > i * 3 + 2
              ? positions[i * 3 + 2]
              : atoms[i].position[2];
          const atomPos = new THREE.Vector3(x, y, z);

          const el = elements[atoms[i].elementNumber];
          const radius = el ? el.covalentRadius * 0.5 : 0.3;

          // Ray-sphere test
          const toAtom = atomPos.clone().sub(raycaster.ray.origin);
          const proj = toAtom.dot(raycaster.ray.direction);
          if (proj < 0) continue;

          const closest_point = raycaster.ray.origin
            .clone()
            .add(raycaster.ray.direction.clone().multiplyScalar(proj));
          const dist = closest_point.distanceTo(atomPos);

          if (dist < radius && proj < closestDist) {
            closest = i;
            closestDist = proj;
          }
        }

        if (closest >= 0) {
          useUIStore.getState().selectAtom(closest, event.shiftKey);
        } else {
          useUIStore.getState().clearSelection();
        }
      } else if (activeTool === 'delete') {
        // Pick nearest atom and delete
        const { atoms, positions } = simStore.getState();
        let closest = -1;
        let closestDist = Infinity;

        for (let i = 0; i < atoms.length; i++) {
          const x =
            positions.length > i * 3 ? positions[i * 3] : atoms[i].position[0];
          const y =
            positions.length > i * 3 + 1
              ? positions[i * 3 + 1]
              : atoms[i].position[1];
          const z =
            positions.length > i * 3 + 2
              ? positions[i * 3 + 2]
              : atoms[i].position[2];
          const atomPos = new THREE.Vector3(x, y, z);

          const toAtom = atomPos.clone().sub(raycaster.ray.origin);
          const proj = toAtom.dot(raycaster.ray.direction);
          if (proj < 0) continue;

          const closest_point = raycaster.ray.origin
            .clone()
            .add(raycaster.ray.direction.clone().multiplyScalar(proj));
          const el = elements[atoms[i].elementNumber];
          const radius = el ? el.covalentRadius * 0.5 : 0.3;
          const dist = closest_point.distanceTo(atomPos);

          if (dist < radius && proj < closestDist) {
            closest = i;
            closestDist = proj;
          }
        }

        if (closest >= 0) {
          simStore.getState().removeAtom(closest);
        }
      }
    },
    [camera, raycaster, gl, simStore],
  );

  useEffect(() => {
    gl.domElement.addEventListener('click', handleClick);
    return () => gl.domElement.removeEventListener('click', handleClick);
  }, [gl, handleClick]);

  return null;
};

// ---- Main Scene component ----
export const Scene: React.FC = () => {
  return (
    <Canvas
      camera={{ position: [0, 8, 15], fov: 50, near: 0.1, far: 1000 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#1a1a2e');
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      <pointLight position={[0, 10, 0]} intensity={0.2} />

      {/* Environment for reflections */}
      <Environment preset="studio" />

      {/* Grid at y=0 */}
      <Grid
        args={[50, 50]}
        position={[0, -0.01, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a2a4e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3a3a6e"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
      />

      {/* Renderers */}
      <AtomRenderer />
      <BondRenderer />
      <AtomLabels />

      {/* Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        panSpeed={0.8}
        minDistance={2}
        maxDistance={100}
      />

      {/* Interaction */}
      <Interaction />
    </Canvas>
  );
};
