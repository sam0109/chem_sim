// ==============================================================
// EncounterPanel — controls for setting up molecular encounters
//
// Allows the user to:
// 1. Select a molecule template to place as a second molecule
// 2. Set separation distance, approach speed, and impact parameter
// 3. Place the second molecule and launch the encounter
// ==============================================================

import React from 'react';
import { useUIStore } from '../store/uiStore';
import { useSimContextStore } from '../store/SimulationContext';
import {
  getMoleculeTemplateNames,
  getMoleculeFactory,
} from '../data/moleculeTemplates';

export const EncounterPanel: React.FC = () => {
  const showEncounterPanel = useUIStore((s) => s.showEncounterPanel);
  const selectedTemplate = useUIStore((s) => s.selectedMoleculeTemplate);
  const setSelectedTemplate = useUIStore((s) => s.setSelectedMoleculeTemplate);
  const separation = useUIStore((s) => s.encounterSeparation);
  const setSeparation = useUIStore((s) => s.setEncounterSeparation);
  const speed = useUIStore((s) => s.encounterSpeed);
  const setSpeed = useUIStore((s) => s.setEncounterSpeed);
  const impactParam = useUIStore((s) => s.encounterImpactParam);
  const setImpactParam = useUIStore((s) => s.setEncounterImpactParam);

  const molecules = useSimContextStore((s) => s.molecules);
  const atoms = useSimContextStore((s) => s.atoms);
  const addMolecule = useSimContextStore((s) => s.addMolecule);
  const launchEncounter = useSimContextStore((s) => s.launchEncounter);
  const positions = useSimContextStore((s) => s.positions);

  if (!showEncounterPanel) return null;

  const templateNames = getMoleculeTemplateNames();
  const hasTwoMolecules = molecules.length >= 2;

  const handlePlace = () => {
    if (!selectedTemplate) return;
    const factory = getMoleculeFactory(selectedTemplate);
    if (!factory) return;

    const templateAtoms = factory();

    // Use the first molecule's COM from the tracker (mass-weighted)
    // for accurate placement, with fallback to geometric centroid
    let comX = 0;
    let comY = 0;
    let comZ = 0;
    if (molecules.length > 0) {
      const mol = molecules[0];
      comX = mol.centerOfMass[0];
      comY = mol.centerOfMass[1];
      comZ = mol.centerOfMass[2];
    } else if (atoms.length > 0) {
      for (let i = 0; i < atoms.length; i++) {
        const px =
          positions.length > i * 3 ? positions[i * 3] : atoms[i].position[0];
        const py =
          positions.length > i * 3 + 1
            ? positions[i * 3 + 1]
            : atoms[i].position[1];
        const pz =
          positions.length > i * 3 + 2
            ? positions[i * 3 + 2]
            : atoms[i].position[2];
        comX += px;
        comY += py;
        comZ += pz;
      }
      comX /= atoms.length;
      comY /= atoms.length;
      comZ /= atoms.length;
    }

    // Place new molecule along x-axis at `separation` distance from COM
    const offsetAtoms = templateAtoms.map((a) => ({
      ...a,
      position: [
        a.position[0] + comX + separation,
        a.position[1] + comY,
        a.position[2] + comZ,
      ] as [number, number, number],
    }));

    addMolecule(offsetAtoms);
  };

  const handleLaunch = () => {
    if (molecules.length < 2) return;
    const molA = molecules[0];
    const molB = molecules[1];
    launchEncounter(molA.atomIndices, molB.atomIndices, speed, impactParam);
  };

  return (
    <div
      data-testid="encounter-panel"
      style={{
        position: 'absolute',
        bottom: 30,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20, 20, 40, 0.95)',
        borderRadius: 8,
        padding: '12px 16px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        color: '#ddd',
        fontFamily: 'monospace',
        fontSize: 12,
        minWidth: 320,
        zIndex: 100,
      }}
    >
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: 8,
          fontSize: 13,
          color: '#aaccff',
        }}
      >
        Encounter Setup
      </div>

      {/* Molecule template selection */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ marginBottom: 2 }}>Molecule to place</div>
        <select
          data-testid="molecule-template-select"
          value={selectedTemplate ?? ''}
          onChange={(e) => setSelectedTemplate(e.target.value || null)}
          style={{
            width: '100%',
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(30,30,50,0.9)',
            color: '#ddd',
            fontFamily: 'monospace',
            fontSize: 11,
          }}
        >
          <option value="">-- Select --</option>
          {templateNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Separation distance */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <span>Separation</span>
          <span style={{ color: '#ffaa44' }}>{separation.toFixed(1)} Å</span>
        </div>
        <input
          data-testid="separation-slider"
          type="range"
          min={3}
          max={20}
          step={0.5}
          value={separation}
          onChange={(e) => setSeparation(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#ffaa44' }}
        />
      </div>

      {/* Approach speed */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <span>Approach speed</span>
          <span style={{ color: '#88ccff' }}>{speed.toFixed(4)} Å/fs</span>
        </div>
        <input
          data-testid="speed-slider"
          type="range"
          min={0.001}
          max={0.05}
          step={0.001}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#88ccff' }}
        />
      </div>

      {/* Impact parameter */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <span>Impact parameter</span>
          <span style={{ color: '#aaffaa' }}>{impactParam.toFixed(1)} Å</span>
        </div>
        <input
          data-testid="impact-slider"
          type="range"
          min={0}
          max={5}
          step={0.1}
          value={impactParam}
          onChange={(e) => setImpactParam(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#aaffaa' }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          data-testid="place-molecule-button"
          onClick={handlePlace}
          disabled={!selectedTemplate}
          style={{
            flex: 1,
            padding: '6px 12px',
            borderRadius: 4,
            border: 'none',
            background: selectedTemplate ? '#4e7dc4' : 'rgba(80,80,100,0.5)',
            color: '#fff',
            cursor: selectedTemplate ? 'pointer' : 'not-allowed',
            fontFamily: 'monospace',
            fontSize: 12,
            opacity: selectedTemplate ? 1 : 0.5,
          }}
        >
          Place Molecule
        </button>
        <button
          data-testid="launch-encounter-button"
          onClick={handleLaunch}
          disabled={!hasTwoMolecules}
          style={{
            flex: 1,
            padding: '6px 12px',
            borderRadius: 4,
            border: 'none',
            background: hasTwoMolecules ? '#4a9c47' : 'rgba(80,80,100,0.5)',
            color: '#fff',
            cursor: hasTwoMolecules ? 'pointer' : 'not-allowed',
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: 'bold',
            opacity: hasTwoMolecules ? 1 : 0.5,
          }}
        >
          Launch
        </button>
      </div>

      {/* Status info */}
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: '#888',
          textAlign: 'center',
        }}
      >
        {molecules.length === 0
          ? 'Load a molecule first'
          : molecules.length === 1
            ? 'Place a second molecule, then launch'
            : `${molecules.length} molecules detected — ready to launch`}
      </div>
    </div>
  );
};
