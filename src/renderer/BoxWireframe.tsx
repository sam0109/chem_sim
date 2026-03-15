// ==============================================================
// BoxWireframe — renders the periodic simulation box as a wireframe
// ==============================================================

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../store/simulationStore';

/**
 * Renders a wireframe cube representing the simulation box boundaries.
 * Only visible when periodic boundary conditions are enabled.
 * The box is positioned with one corner at the origin [0,0,0]
 * and extends to [Lx, Ly, Lz], matching the position wrapping domain.
 */
export const BoxWireframe: React.FC = () => {
  const box = useSimulationStore((s) => s.box);

  const edgesGeometry = useMemo(() => {
    const [lx, ly, lz] = box.size;
    const boxGeo = new THREE.BoxGeometry(lx, ly, lz);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();
    return edges;
  }, [box.size]);

  if (!box.periodic) return null;

  const [lx, ly, lz] = box.size;

  return (
    <lineSegments geometry={edgesGeometry} position={[lx / 2, ly / 2, lz / 2]}>
      <lineBasicMaterial
        color="#aa88ff"
        transparent
        opacity={0.4}
        linewidth={1}
      />
    </lineSegments>
  );
};
