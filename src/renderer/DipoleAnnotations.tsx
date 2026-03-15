// ==============================================================
// DipoleAnnotations — renders dipole moment arrows for molecules
// Data source: MoleculeInfo.dipoleMoment from simulation store
// Arrow placed at molecule COM, pointing in dipole direction,
// length proportional to magnitude
// ==============================================================

import React from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

import { useSimContextStore } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import type { MoleculeInfo } from '../data/types';

/**
 * Minimum dipole magnitude (e*Å) to display an arrow.
 * Magnitudes below this are considered negligible.
 * For reference, water has ~0.7 e*Å (≈ 1.85 Debye).
 */
const DIPOLE_DISPLAY_THRESHOLD = 0.05;

/**
 * Scale factor: arrow length (Å) = magnitude (e*Å) * scale.
 * Chosen so that water's dipole (~0.7 e*Å) gives a ~2.8 Å arrow,
 * clearly visible but not overwhelming.
 */
const DIPOLE_ARROW_SCALE = 4.0;

/** Maximum number of dipole arrows to render */
const MAX_DIPOLE_ARROWS = 20;

const ARROW_COLOR = '#44ddff';
const CONE_RADIUS = 0.12;
const CONE_HEIGHT = 0.35;
const SHAFT_RADIUS = 0.04;

const _up = new THREE.Vector3(0, 1, 0);

/**
 * A single dipole arrow (shaft cylinder + cone arrowhead + label).
 * Declarative R3F approach: each arrow is a React component
 * that computes its own transform from molecule data.
 */
const DipoleArrow: React.FC<{ molecule: MoleculeInfo }> = ({ molecule }) => {
  const [cx, cy, cz] = molecule.centerOfMass;
  const [dx, dy, dz] = molecule.dipoleMoment;
  const mag = molecule.dipoleMagnitude;

  // Arrow length (capped for very large dipoles)
  const arrowLen = Math.min(mag * DIPOLE_ARROW_SCALE, 8.0);
  const shaftLen = Math.max(arrowLen - CONE_HEIGHT, 0.1);

  // Normalized direction
  const dir = new THREE.Vector3(dx / mag, dy / mag, dz / mag);

  // Quaternion to rotate Y-axis to dipole direction
  const quat = new THREE.Quaternion().setFromUnitVectors(_up, dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);

  // Shaft center position: COM + half shaft along direction
  const shaftPos: [number, number, number] = [
    cx + (dir.x * shaftLen) / 2,
    cy + (dir.y * shaftLen) / 2,
    cz + (dir.z * shaftLen) / 2,
  ];

  // Cone position: at shaft tip
  const conePos: [number, number, number] = [
    cx + dir.x * (shaftLen + CONE_HEIGHT / 2),
    cy + dir.y * (shaftLen + CONE_HEIGHT / 2),
    cz + dir.z * (shaftLen + CONE_HEIGHT / 2),
  ];

  // Label position: beyond cone tip
  const labelPos: [number, number, number] = [
    cx + dir.x * (arrowLen + 0.3),
    cy + dir.y * (arrowLen + 0.3),
    cz + dir.z * (arrowLen + 0.3),
  ];

  return (
    <>
      {/* Shaft cylinder */}
      <mesh position={shaftPos} rotation={euler} scale={[1, shaftLen, 1]}>
        <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, 1, 6]} />
        <meshStandardMaterial
          color={ARROW_COLOR}
          emissive={ARROW_COLOR}
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Cone arrowhead */}
      <mesh position={conePos} rotation={euler}>
        <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, 8]} />
        <meshStandardMaterial
          color={ARROW_COLOR}
          emissive={ARROW_COLOR}
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Magnitude label */}
      <Html
        position={labelPos}
        center
        style={{
          color: ARROW_COLOR,
          fontSize: '9px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          textShadow: '0 0 3px rgba(0,0,0,0.9)',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {mag.toFixed(2)} e&middot;A
      </Html>
    </>
  );
};

/**
 * Renders dipole moment arrows for all molecules with significant dipoles.
 * Subscribes to molecules via Zustand for automatic re-renders.
 */
export const DipoleAnnotations: React.FC = () => {
  const showAnnotations = useUIStore((s) => s.showAnnotations);
  const showDipole = useUIStore((s) => s.annotationDipole);
  const molecules = useSimContextStore((s) => s.molecules);

  if (!showAnnotations || !showDipole) return null;

  // Filter to molecules with significant dipole moments
  const dipoleMolecules = molecules
    .filter((mol) => mol.dipoleMagnitude >= DIPOLE_DISPLAY_THRESHOLD)
    .slice(0, MAX_DIPOLE_ARROWS);

  if (dipoleMolecules.length === 0) return null;

  return (
    <>
      {dipoleMolecules.map((mol) => (
        <DipoleArrow key={mol.id} molecule={mol} />
      ))}
    </>
  );
};
