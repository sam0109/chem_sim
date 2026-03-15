// ==============================================================
// Scene — main R3F scene composition
// ==============================================================

import React, { useEffect, useCallback, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { AtomRenderer } from './AtomRenderer';
import { BondRenderer } from './BondRenderer';
import { AtomLabels } from './AtomLabels';
import { BoxWireframe } from './BoxWireframe';
import { OrbitalRenderer } from './OrbitalRenderer';
import { ElectronDensityRenderer } from './ElectronDensityRenderer';
import { ChargeAnnotations } from './ChargeAnnotations';
import { BondEnergyAnnotations } from './BondEnergyAnnotations';
import { DipoleAnnotations } from './DipoleAnnotations';
import { useSimContextStoreApi } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import elements from '../data/elements';
import { computeBondedPosition } from '../data/bondPlacement';
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

      // Shared helper: pick the closest atom under the cursor via ray-sphere test
      const pickAtom = (): number => {
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

          const closestPoint = raycaster.ray.origin
            .clone()
            .add(raycaster.ray.direction.clone().multiplyScalar(proj));
          const dist = closestPoint.distanceTo(atomPos);

          if (dist < radius && proj < closestDist) {
            closest = i;
            closestDist = proj;
          }
        }

        return closest;
      };

      if (activeTool === 'place-atom') {
        const { selectedElement, selectedBondOrder } = useUIStore.getState();

        // First, try to pick an existing atom to bond to
        const targetIdx = pickAtom();

        if (targetIdx >= 0) {
          // Bond-aware placement: compute ideal bonded position
          const { atoms, bonds, positions } = simStore.getState();
          const newPos = computeBondedPosition(
            atoms,
            bonds,
            positions,
            targetIdx,
            selectedElement,
            selectedBondOrder,
          );

          if (newPos) {
            const newAtom: Atom = {
              id: Date.now(),
              elementNumber: selectedElement,
              position: newPos,
              velocity: [0, 0, 0],
              force: [0, 0, 0],
              charge: 0,
              hybridization: 'sp3',
              fixed: false,
            };
            simStore.getState().addAtom(newAtom);
          }
          // If newPos is null, atom is saturated — do nothing
        } else {
          // No atom under cursor — fall back to ground plane placement
          const hit = raycaster.ray.intersectPlane(
            planeRef.current,
            intersectPoint.current,
          );
          if (hit) {
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
        }
      } else if (activeTool === 'select') {
        const closest = pickAtom();

        if (closest >= 0) {
          useUIStore.getState().selectAtom(closest, event.shiftKey);
        } else {
          useUIStore.getState().clearSelection();
        }
      } else if (activeTool === 'delete') {
        const closest = pickAtom();

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

// ---- Camera tracker for encounter pair COM ----
// When 2+ molecules are detected and the simulation is running,
// smoothly moves the OrbitControls target to the pair's center of mass.
const CameraTracker: React.FC<{
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}> = ({ controlsRef }) => {
  const targetRef = useRef(new THREE.Vector3());
  const simStore = useSimContextStoreApi();

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const { molecules, config } = simStore.getState();
    const showEncounter = useUIStore.getState().showEncounterPanel;

    // Only auto-track when encounter panel is active, 2+ molecules, and running
    if (!showEncounter || molecules.length < 2 || !config.running) return;

    // Compute the center of mass of all molecules' COMs
    // (weighted equally — could weight by mass but COMs are sufficient)
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const mol of molecules) {
      cx += mol.centerOfMass[0];
      cy += mol.centerOfMass[1];
      cz += mol.centerOfMass[2];
    }
    cx /= molecules.length;
    cy /= molecules.length;
    cz /= molecules.length;

    // Smoothly interpolate the target toward the pair COM.
    // Lerp factor 0.05 per frame (~60fps) gives ~3s to reach 95% of target,
    // preventing jarring camera jumps during fast encounters.
    targetRef.current.set(cx, cy, cz);
    controls.target.lerp(targetRef.current, 0.05);
    controls.update();
  });

  return null;
};

// ---- Main Scene component ----
export const Scene: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);

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
      <BoxWireframe />
      <OrbitalRenderer />
      <ElectronDensityRenderer />
      <ChargeAnnotations />
      <BondEnergyAnnotations />
      <DipoleAnnotations />

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        panSpeed={0.8}
        minDistance={2}
        maxDistance={100}
      />

      {/* Camera tracking for encounters */}
      <CameraTracker controlsRef={controlsRef} />

      {/* Interaction */}
      <Interaction />
    </Canvas>
  );
};
