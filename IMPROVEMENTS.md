# ChemSim — Improvements Roadmap

This document catalogs every known shortcut, approximation, and missing feature in ChemSim, organized by priority. The guiding principle: **this simulation should take as few shortcuts as possible and be as close to true chemistry as possible.**

Each improvement includes its physical justification, what invariant it would fix or enable, and an estimate of implementation complexity.

---

## Test Suite — The Ground Truth

Before any improvement is implemented, we need a test suite that defines *what correct chemistry looks like*. The test suite (`src/engine/tests.ts`) runs the simulation for N steps on known molecules and checks physically meaningful invariants. Improvements are measured by how many invariants they satisfy.

### Test Categories

#### 1. Energy Conservation (NVE ensemble)

These tests run **without a thermostat** and verify that the velocity Verlet integrator conserves total energy.

| Test ID | Molecule | Steps | dt (fs) | Invariant | Tolerance | Status |
|---------|----------|-------|---------|-----------|-----------|--------|
| `NVE-01` | H₂O | 10,000 | 0.5 | \|ΔE/E₀\| < 5% | 0.05 | ✅ PASS (0.18%) |
| `NVE-02` | CH₄ | 10,000 | 0.5 | \|ΔE/E₀\| < 5% | 0.05 | ❌ FAIL (explodes) |
| `NVE-03` | CO₂ | 10,000 | 0.5 | \|ΔE/E₀\| < 5% | 0.05 | ✅ PASS (0.00%) |
| `NVE-04` | C₂H₅OH | 10,000 | 0.5 | \|ΔE/E₀\| < 10% | 0.10 | ✅ PASS (0.47%) |
| `NVE-05` | Ar₂₀ (LJ cluster) | 50,000 | 1.0 | \|ΔE/E₀\| < 0.01% | 0.0001 | Needs Ar data |
| `NVE-06` | H₂O at dt=1.0 | 10,000 | 1.0 | \|ΔE/E₀\| < 10% | 0.10 | ✅ PASS (8.78%) |

#### 2. Structural Invariants (NVT ensemble, 300 K)

These tests run **with Berendsen thermostat** and verify that molecular geometry is maintained.

| Test ID | Molecule | Steps | Invariant | Expected | Tolerance | Status |
|---------|----------|-------|-----------|----------|-----------|--------|
| `GEO-01` | H₂O | 6,000 | ∠HOH mean | 104.5° | ±5° | ✅ PASS (104.6°) |
| `GEO-02` | H₂O | 6,000 | r(O-H) mean | 0.99 Å | ±0.05 Å | ✅ PASS (0.994 Å) |
| `GEO-03` | H₂O | 6,000 | No H-H bond ever detected | 0 | 0 | ✅ PASS |
| `GEO-04` | H₂O | 6,000 | Bond count always = 2 | 2 | 0 | ✅ PASS |
| `GEO-05` | CH₄ | 6,000 | ∠HCH mean | 109.5° | ±10° | ❌ FAIL (explodes) |
| `GEO-06` | CH₄ | 6,000 | r(C-H) mean | 1.09 Å | ±0.10 Å | ❌ FAIL (explodes) |
| `GEO-07` | CH₄ | 6,000 | Bond count always = 4 | 4 | 0 | ❌ FAIL (0-4) |
| `GEO-08` | CO₂ | 6,000 | ∠OCO mean | 180° | ±10° | ✅ PASS (180.0°) |
| `GEO-09` | CO₂ | 6,000 | r(C=O) mean | 1.16 Å | ±0.15 Å | ❌ FAIL (explodes) |
| `GEO-10` | CO₂ | 6,000 | Bond order = 2 | 2 | 0 | ⚠️ Untested |
| `GEO-11` | NaCl | 6,000 | r(Na-Cl) mean | 2.36 Å | ±0.3 Å | ✅ PASS (2.590 Å) |
| `GEO-12` | C₂H₅OH | 6,000 | r(C-C) mean | 1.52 Å | ±0.1 Å | Untested |
| `GEO-13` | C₂H₅OH | 6,000 | r(C-O) mean | 1.43 Å | ±0.1 Å | Untested |
| `GEO-14` | C₂H₅OH | 6,000 | r(O-H) mean | 0.96 Å | ±0.05 Å | Untested |
| `GEO-15` | C₂H₅OH | 6,000 | All bonds maintained | 8 | 0 | Untested |

#### 3. Gradient Consistency

These tests verify that analytical forces exactly match numerical gradients (central differences). Any mismatch means the integrator cannot conserve energy.

| Test ID | Function | Invariant | Tolerance | Status |
|---------|----------|-----------|-----------|--------|
| `GRAD-01` | Morse potential | \|F_anal − F_num\| < ε | 1e-7 eV/Å | ✅ PASS (6.4e-9) |
| `GRAD-02` | LJ 12-6 | \|F_anal − F_num\| < ε | 1e-7 eV/Å | ✅ PASS (7.8e-12) |
| `GRAD-03` | Coulomb | \|F_anal − F_num\| < ε | 1e-7 eV/Å | ✅ PASS (4.6e-11) |
| `GRAD-04` | Cosine angle | \|F_anal − F_num\| < ε | 1e-7 eV/Å | ✅ PASS (6.6e-11) |
| `GRAD-05` | Pauli repulsion | \|F_anal − F_num\| < ε | 1e-7 eV/Å | ✅ PASS |
| `GRAD-06` | Full H₂O system | \|F_anal − F_num\| < ε | 1e-7 eV/Å | ✅ PASS (2.8e-9) |
| `GRAD-07` | Torsion potential | Not yet implemented | — | ❌ N/A |

#### 4. Thermodynamic Invariants

| Test ID | System | Steps | Invariant | Expected | Tolerance | Status |
|---------|--------|-------|-----------|----------|-----------|--------|
| `THERMO-01` | H₂O NVT 300K | 10,000 | ⟨T⟩ | 300 K | ±30 K | ✅ PASS (300.9 K) |
| `THERMO-02` | H₂O NVT 300K | 10,000 | σ_T / ⟨T⟩ | ~0.3 (3 atoms) | ±0.2 | Untested |
| `THERMO-03` | CH₄ NVT 300K | 10,000 | ⟨T⟩ | 300 K | ±20 K | Untested |
| `THERMO-04` | 20×Ar NVT 300K | 50,000 | ⟨T⟩ | 300 K | ±10 K | Needs Ar data |
| `THERMO-05` | H₂O NVE | 10,000 | ⟨KE⟩/⟨PE⟩ ratio | ~1 for harmonic | ±0.5 | Untested |

#### 5. Reaction / Dynamic Bond Tests

| Test ID | System | Steps | Invariant | Status |
|---------|--------|-------|-----------|--------|
| `RXN-01` | Na + Cl (separated 5 Å) | 5,000 | Form ionic bond | ⚠️ Untested |
| `RXN-02` | H + H (separated 3 Å) | 5,000 | Form H₂ molecule | ⚠️ Untested |
| `RXN-03` | H₂O at 5000 K | 20,000 | O-H bond breaks | ⚠️ Untested |
| `RXN-04` | H₂ + F₂ → 2HF | 50,000 | Products form | ❌ Needs torsions |

---

## Priority 1 — Critical Physics Gaps

These are approximations or missing features that cause incorrect behavior for common molecules.

### 1.1 Torsion (Dihedral) Potential

**Current state:** Not implemented.
**Impact:** Any molecule with ≥4 heavy atoms (ethanol, proteins, etc.) lacks rotational barriers. Internal rotation is completely free, producing physically wrong conformations. Ethanol would not distinguish gauche from anti conformations.
**Fix:** Implement UFF torsion potential:
$$V(\phi) = \frac{V_n}{2} [1 - \cos(n\phi) \cos(n\phi_0)]$$
with UFF parameters from Rappé et al. Eq. 16. Requires dihedral list built from bond topology.
**Tests enabled:** `GEO-12` through `GEO-15`, `RXN-04`
**Complexity:** Medium

### 1.2 Linear Molecule Handling (CO₂)

**Current state:** The cosine-based angle potential works well for bent molecules (~100–120°) but has a flat derivative at θ=180° (cos(180°) = −1), providing no restoring force for linear geometries.
**Impact:** CO₂ angle bending is uncontrolled. The molecule's linearity is maintained only by symmetry of the Morse bonds, not by the angle potential.
**Fix:** Special-case linear angles (θ₀ > 170°): use the UFF linear penalty function V(θ) = k(1 + cosθ) instead of harmonic cosine.
**Tests enabled:** `GEO-08`, `GEO-09`, `GEO-10`
**Complexity:** Low

### 1.3 Double/Triple Bond Parametrization

**Current state:** Bond order is *detected* (distance heuristic) but Morse De is computed as De = 70 × bond_order kcal/mol — a rough universal estimate. Real C=O (173 kcal/mol) vs C=C (146 kcal/mol) vs C≡C (200 kcal/mol) differ significantly.
**Impact:** Double and triple bonds have incorrect dissociation energies and stiffnesses.
**Fix:** Add a lookup table of experimental bond dissociation energies indexed by (element pair, bond order). Fall back to UFF estimate when no data available.
**Tests enabled:** `GEO-09` (C=O in CO₂)
**Complexity:** Low–Medium

### 1.4 Charge Equilibration

**Current state:** Partial charges are hardcoded per molecule (e.g., SPC water charges). Newly placed atoms have charge=0.
**Impact:** Any dynamically created molecule has no electrostatic interactions. Ionic bonds (NaCl) rely on manually assigned charges.
**Fix:** Implement QEq (Charge Equilibration) from Rappé & Goddard: minimize electronegativity equalization functional to compute charges from electronegativities and geometry. Or simpler: Gasteiger charges (iterative partial equalization).
**Tests enabled:** `RXN-01`, `RXN-02`, and all molecules with dynamic charge.
**Complexity:** Medium–High

### 1.5 Multi-Molecule Interaction & Reaction Dynamics

**Current state:** The simulator treats all atoms in the scene as a single flat array. There is no concept of separate molecules — bond detection, angle detection, and exclusion lists operate on the global atom pool. While this technically allows inter-molecular interactions (LJ and Coulomb already act between all non-excluded pairs), there is no way to:
- Place two distinct molecules at a controlled separation
- Track which atoms belong to which molecule over time
- Observe bond formation *between* molecules (e.g., 2H₂ + O₂ → 2H₂O)
- Measure inter-molecular distances, binding energies, or approach trajectories
- Visualize molecule identity (color-code by molecule)

**Impact:** Multi-molecule chemistry is where the most interesting physics happens — acid-base reactions, ligand binding, solvation, polymerization, combustion. Without explicit multi-molecule support, the simulator can only study isolated molecules vibrating in a vacuum. The dynamic bond detection already supports bond formation/breaking in principle, but there's no workflow to set up, observe, and analyze inter-molecular encounters.

**Fix — phased approach:**

**Phase A: Multi-molecule placement & tracking (Low complexity)**
1. Add a `moleculeId: number` field to the `Atom` interface that tracks which molecule each atom belongs to
2. When placing atoms, assign them to the "active molecule" (a new molecule counter in the UI store). A toolbar button or keyboard shortcut starts a new molecule.
3. After each topology rebuild, recompute `moleculeId` via connected-component analysis on the bond graph — atoms connected by covalent/ionic bonds share a molecule ID. This means when a bond forms between molecules, their IDs merge automatically. When a bond breaks, the molecule splits.
4. Renderer colors atoms/bonds with a faint tint by molecule ID so users can visually track which atoms belong together
5. PropertyPanel shows molecule composition (e.g., "Molecule 1: H₂O, 3 atoms, 2 bonds")

**Phase B: Controlled encounter setup (Medium complexity)**
1. Add an "Add Molecule" workflow: choose from built-in examples or import, then place the second molecule at a specified distance from the first (e.g., "place H₂ at 5 Å from O₂")
2. Optionally give the second molecule an initial velocity toward the first (collision trajectory) with a user-specified kinetic energy in eV or equivalent temperature
3. Add a **separation plot**: track center-of-mass distance between two molecules over time, overlaid on the energy plot
4. Add a **bond evolution timeline**: horizontal bar chart showing which bonds exist at each frame, color-coded by type. When an inter-molecular bond forms, it appears as a new bar — making reaction events visually obvious.

**Phase C: Reaction analysis (Medium–High complexity)**
1. Detect "reaction events" — frames where the bond topology changes (bond formed or broken between atoms with different `moleculeId`). Log these with timestamp, atoms involved, bond type, and energy.
2. Compute reaction energy: ΔE = total PE after reaction − total PE before (averaged over a small window to smooth vibrations)
3. Display a reaction event timeline in the UI with clickable events that scrub the simulation to that frame
4. Allow the user to reset atom positions to a saved snapshot and replay with different initial conditions (temperature, approach velocity, orientation) to explore reaction probability.

**Physical considerations:**
- The force field already handles inter-molecular forces correctly (LJ for van der Waals attraction/repulsion, Coulomb for electrostatics). What's missing is the *workflow* and *analysis*.
- For reactions to occur dynamically, the system needs enough kinetic energy to overcome activation barriers. The Morse potential allows bond dissociation (De is finite), so in principle a high-energy collision can break bonds. However, without torsion potentials (1.1) and charge equilibration (1.4), reaction products may not relax to the correct geometry.
- The Berendsen thermostat will absorb energy from exothermic reactions — consider allowing NVE mode during the reaction encounter, with thermostat applied only to spectator atoms.

**Tests enabled:**
| Test ID | System | Steps | Invariant |
|---------|--------|-------|-----------|
| `RXN-05` | H₂O + H₂O (5 Å apart) | 10,000 | Molecules stay intact, correct H-bonds form |
| `RXN-06` | Na + Cl (10 Å, 0.5 eV collision) | 5,000 | Ionic bond forms, distance equilibrates ~2.4 Å |
| `RXN-07` | CH₄ + F (radical) | 50,000 | C-H bond breaks, H-F forms (requires high T) |
| `MOL-01` | Two H₂O placed 5 Å apart | 6,000 | `moleculeId` tracking: both stay as separate molecules |
| `MOL-02` | Na + Cl → NaCl | 5,000 | `moleculeId` merges when ionic bond forms |

**Complexity:** Low (Phase A) / Medium (Phase B) / Medium–High (Phase C)

---

## Priority 2 — Accuracy Improvements

### 2.1 Proper UFF Angle Force Constant

**Current state:** The UFF angle K is computed from Rappé Eq. 13 but with an extra `r_IJ * r_JK` factor that doesn't match the published formula. The result is clamped to [0.5, 5.0] eV/rad².
**Impact:** Angle stiffnesses may be quantitatively off by up to ~2× for some atom pairs.
**Fix:** Re-derive K_angle strictly from Eq. 13 of the UFF paper. Validate against tabulated MMFF94 force constants for organic molecules.
**Tests enabled:** Tighter tolerances on `GEO-01`, `GEO-05`
**Complexity:** Low

### 2.2 Replace Pauli Repulsion with Proper 1-3 Treatment

**Current state:** Pauli exponential repulsion is applied to ALL pairs as a catch-all anti-overlap. This is not a standard MD technique. 1-3 pairs are fully excluded from LJ.
**Impact:** The Pauli potential adds artificial energy to close contacts that would, in a real force field, be handled by the 1-3 scaled Lennard-Jones. Energy curves near compressed angles don't match UFF exactly.
**Fix:** Use **scaled 1-3 LJ** (standard in AMBER/OPLS: 1-4 scaled by 0.5; 1-3 could use a reduced σ) or implement the UFF non-bonded correction for 1-3 pairs. Remove the ad-hoc Pauli term.
**Tests enabled:** More accurate potential energy surfaces for all angles
**Complexity:** Medium

### 2.3 Ewald / PME Electrostatics

**Current state:** Shifted Coulomb with 10 Å cutoff. No long-range correction.
**Impact:** For systems >20 atoms with significant charges, the electrostatic energy is systematically underestimated. Ionic crystals (NaCl lattice) would have completely wrong energies.
**Fix:** Implement smooth particle mesh Ewald (SPME) using FFT. Or, for smaller systems, direct Ewald summation. Wolf summation (damped, α>0) is a simpler intermediate step.
**Tests enabled:** `RXN-01`, NaCl lattice tests, any system with long-range charge ordering
**Complexity:** High

### 2.4 Periodic Boundary Conditions

**Current state:** `SimulationBox` has a `periodic` flag but it's never used. All simulations are in vacuum.
**Impact:** Cannot simulate bulk liquids, crystals, or solvated systems. Molecules near the simulation edge experience asymmetric forces.
**Fix:** Implement minimum image convention in all pair calculations. Modify cell list to wrap across boundaries.
**Tests enabled:** Bulk water density test, NaCl crystal structure
**Complexity:** Medium

### 2.5 Nosé-Hoover Thermostat

**Current state:** Only Berendsen is implemented. It does not generate the correct canonical (NVT) ensemble — it suppresses energy fluctuations.
**Impact:** Thermodynamic properties (heat capacity, fluctuations) are quantitatively wrong. Berendsen is a "flying thermostat" that doesn't sample the Boltzmann distribution correctly.
**Fix:** Implement Nosé-Hoover chains (standard: 3–5 chain thermostats). This is the gold standard for NVT in production MD.
**Tests enabled:** `THERMO-02` (correct fluctuations), proper ensemble averages
**Complexity:** Medium

---

## Priority 3 — Feature Additions

### 3.1 Orbital Visualization

**Current state:** Commented-out orbital renderer concept. No actual orbital computation.
**Fix:** Compute hydrogen-like atomic orbital wavefunctions (spherical harmonics × radial functions). Render as 3D isosurfaces via marching cubes, or as volumetric ray-marched textures.
**Complexity:** High

### 3.2 Electron Density Visualization

**Current state:** Not implemented.
**Fix:** Superposition of Gaussian approximations to atomic densities. Render as translucent isosurface.
**Complexity:** Medium

### 3.3 Crystal Lattice Builder

**Current state:** Only single molecules. No periodic structures.
**Fix:** Replicate unit cells for common crystal types (NaCl, CsCl, diamond, FCC, BCC, HCP). Combine with PBC.
**Complexity:** Medium

### 3.4 WebGPU Compute for N-body Forces

**Current state:** All computation is single-threaded JS in a Web Worker.
**Fix:** Move non-bonded force calculation to WebGPU compute shaders. Each atom's force contribution is independent and parallelizable.
**Complexity:** High

### 3.5 Impostor Rendering

**Current state:** GLSL shaders written but unused. Atoms rendered as tessellated sphere meshes.
**Fix:** Switch AtomRenderer to use the existing impostor shaders (ray-cast spheres on billboarded quads). 2 triangles per atom instead of hundreds. Write correct depth for intersections.
**Complexity:** Medium

### 3.6 SMILES Parser (via RDKit.js)

**Current state:** Only XYZ import.
**Fix:** Integrate rdkit.js (RDKit compiled to WASM). Parse SMILES → 3D coordinates via conformer generation. Also provides MMFF94 force field parameters.
**Complexity:** Medium

### 3.7 Reaction Path Finding

**Current state:** No transition state search.
**Fix:** Implement Nudged Elastic Band (NEB) method: connect reactant and product geometries with a chain of images, optimize the minimum energy path.
**Complexity:** High

### 3.8 Covalent vs Ionic Bond Visualization

**Current state:** All bonds are rendered identically as solid half-colored cylinders regardless of type. The engine classifies bonds as covalent, ionic, metallic, hydrogen, or van der Waals (based on electronegativity difference: |Δχ| > 1.7 → ionic), but the renderer ignores this classification.
**Impact:** Users cannot visually distinguish a covalent C-H bond from an ionic Na-Cl bond. This is a significant gap for an educational/research simulator — bond type is one of the most fundamental concepts in chemistry.
**Fix:** Differentiate bond rendering by type:
- **Covalent bonds**: solid cylinder (current style), with single/double/triple bond visual distinctions (parallel cylinders or flattened elliptical cross-section for double bonds, three cylinders for triple)
- **Ionic bonds**: dashed or dotted line (no electron sharing — ions are held by electrostatic attraction, not a shared electron pair). Optionally show partial charge labels (δ+/δ−) near the atoms.
- **Metallic bonds**: translucent/glowing shared region (electron sea model) — colored differently from covalent
- **Hydrogen bonds**: thin dashed line (already partially supported, but not visually distinct enough)
- **Van der Waals**: very faint dotted line, only shown when explicitly enabled
- Bond type should be shown in the PropertyPanel tooltip and color-coded in the bond list.
- Add a legend or toggle in the toolbar so users can enable/disable visualization of each bond type independently.
**Tests enabled:** Visual regression tests comparing bond rendering for NaCl (ionic) vs H₂O (covalent) vs metallic clusters
**Complexity:** Medium

### 3.9 Atom Transmutation (Element Swap)

**Current state:** Once an atom is placed, its element cannot be changed. The only way to explore "what if this were potassium instead of sodium?" is to delete the atom and place a new one at approximately the same location — losing velocity, bonds, and simulation continuity.
**Impact:** Element substitution is one of the most powerful ways to build chemical intuition. Swapping Na→K in NaCl, or C→Si in methane, or O→S in water, lets users instantly see how atomic size, electronegativity, and mass affect molecular geometry, bond strength, and dynamics. Without this, exploratory "what-if" experiments require tedious manual reconstruction.
**Fix:** Add a **transmute tool** or **right-click → Change Element** action:
1. Select an atom (or multiple atoms)
2. Pick a new element from the periodic table
3. The worker receives a `'transmute'` message with `{ atomId, newElement }`
4. Worker updates `atomicNumbers[id]`, `masses[id]`, and `charges[id]` in place — position and velocity are preserved
5. Trigger `rebuildTopology()` — bonds, angles, and force field parameters recompute automatically based on the new element's covalent radius, electronegativity, and UFF parameters
6. Optionally run a quick energy minimization (50–100 steps) to relax the geometry to the new equilibrium since bond lengths and angles will differ

**Worker message:**
```typescript
interface WorkerTransmuteMessage {
  type: 'transmute';
  atomId: number;
  newElementNumber: number;
}
```

**UI integration:**
- With the select tool active, clicking an atom then clicking a different element in the periodic table transmutes it
- Keyboard shortcut: `T` to enter transmute mode, then click atom, then click element
- PropertyPanel shows the element with a small "swap" icon button

**Physical considerations:**
- Charges should ideally be recomputed via charge equilibration (see 1.4) after transmutation. As a shortcut, reset the transmuted atom's charge to 0 and let the user set it manually.
- If the new element has a different valence, bonds may be created or destroyed during topology rebuild — this is physically correct behavior (e.g., replacing C (valence 4) with O (valence 2) should drop two bonds).
- Mass change affects dynamics immediately — heavier atoms vibrate slower (lower frequency), which users can observe in real time.

**Tests enabled:** Transmute Na→K in NaCl pair, verify new equilibrium distance shifts from ~2.36 Å to ~2.67 Å (KCl experimental). Transmute O→S in water, verify angle changes from 104.5° toward 92.1° (H₂S experimental).
**Complexity:** Low–Medium

---

## Priority 4 — Known Bugs & Technical Debt

### 4.1 `writeXYZ` Bug

The `writeXYZ()` function calls `getElementBySymbol(String(atom.elementNumber))` — it passes an atomic number as a string to a function expecting an element symbol. Should use `getElement(atom.elementNumber)?.symbol` instead.

### 4.2 Bond Detection Tolerance Sensitivity

The bond detection uses fixed tolerance factors (form=1.2, break=1.5). These work for light elements (H, C, N, O) but may be too tight for larger atoms (transition metals, I) where covalent radii are less precise.

### 4.3 Missing Elements

Only 36 elements (Z=1–36) plus Br(35) and I(53) have data. The periodic table UI shows 4 rows (1–36). Adding Z=37–86 would cover most of chemistry.

### 4.4 Hydrogen Bond Dynamic Detection

Hydrogen bonds are detected once during `rebuildTopology()` but use geometric criteria that may not update correctly as the donor-H-acceptor geometry changes during dynamics.

### 4.5 `sendState()` Double Force Computation

`sendState()` calls `computeAllForces()` to compute PE for reporting, even though forces were just computed during the last integration step. This wastes ~50% of computation. Should cache the last PE from the integrator.

### 4.6 O(N²) Pauli Repulsion

Pauli repulsion loops over all pairs regardless of distance. For >50 atoms this becomes the bottleneck. Should use the cell list with a short cutoff (~1 Å).

---

## Measurement: How to Track Progress

Each improvement should be accompanied by:

1. A new test in `src/engine/tests.ts` that verifies the invariant
2. The test must FAIL before the improvement and PASS after
3. The test must run in <10 seconds on a modern laptop (no human interaction needed)
4. The test must print PASS/FAIL with the measured value and expected range

Run all tests:
```bash
npx tsx src/engine/tests.ts
```

Target: **17+ passing tests** currently (of 22). Goal: **35+ passing tests** across all categories to claim "physically accurate for small organic molecules at 300 K."

---

## Priority 5 — Ambitious Vision

These are the big-dream features that would transform ChemSim from a molecular dynamics toy into something genuinely unprecedented in a browser. Each one is a substantial project, but none are impossible with modern web technology.

### 5.1 Semi-Empirical Quantum Mechanics (PM7 / GFN2-xTB)

**Current state:** All forces come from classical mechanics — balls connected by springs, pairwise potentials, fixed charge models. This fundamentally cannot describe: electron delocalization, aromaticity, conjugation, reaction barriers, photochemistry, or any property that depends on the electronic wavefunction.
**Vision:** Integrate a semi-empirical QM engine that solves an approximate Schrödinger equation at each step. GFN2-xTB (Grimme group) is parameterized for the entire periodic table, handles 100–1000 atoms in seconds, and gives qualitatively correct reaction barriers, charges, and geometries — all from first principles rather than fitted potentials.
**Implementation path:**
- Compile xtb (Fortran) to WASM via Emscripten, or use the existing `xtb-python` bindings via Pyodide
- Alternative: implement PM7 in TypeScript — the core is a Fock matrix build + diagonalization on a minimal basis set, ~2000 lines of dense linear algebra
- Run QM every N steps (e.g., every 10 MD steps), interpolate forces between QM evaluations (Car-Parrinello-like)
- Display HOMO/LUMO orbitals from the eigenvectors — this is the *real* electronic structure, not a spherical harmonic approximation
**Impact:** Would be the first browser-based tool where you can actually *watch* a chemical reaction happen with quantum-mechanically correct energetics. A user could set up HCl + NaOH and watch the proton transfer in real time with the correct ~0 kcal/mol barrier.
**Complexity:** Very High

### 5.2 Real-Time Spectroscopy from Dynamics

**Current state:** The simulation computes positions and velocities at each step but extracts no spectroscopic information.
**Vision:** Compute vibrational spectra (IR, Raman) directly from the molecular dynamics trajectory using the Fourier transform of the velocity autocorrelation function (VACF) or dipole autocorrelation function (DACF). Display the spectrum as a live plot alongside the 3D view.
**Implementation:**
- Accumulate velocity history for the last ~2000 steps
- Compute VACF: $C(t) = \langle v(0) \cdot v(t) \rangle$
- FFT → power spectrum → frequency axis in cm⁻¹
- For IR: compute dipole moment $\mu(t) = \sum q_i r_i(t)$ and use DACF
- Overlay computed peak positions on an experimental reference spectrum (NIST WebBook data)
- Users could see the O-H stretch at ~3500 cm⁻¹, the H-O-H bend at ~1640 cm⁻¹, etc. and watch peaks shift when they swap atoms or change temperature
**Impact:** Bridges the gap between simulation and experiment. Students could predict "what would the IR spectrum look like if I replaced H with D?" and verify against known deuteration shifts.
**Tests enabled:** Water O-H stretch frequency within 10% of 3657 cm⁻¹; H-O-H bend within 10% of 1595 cm⁻¹
**Complexity:** Medium–High

### 5.3 Solvation — Drop a Molecule in Water

**Current state:** All simulations are in vacuum. There is no solvent.
**Vision:** One-click solvation: select a solute molecule, click "Solvate", and the simulator fills a periodic box with TIP3P/SPC water molecules around it. Run MD and watch hydration shells form, hydrogen bond networks reorganize, and ionic species dissociate.
**Implementation:**
- Pre-equilibrated water box template (e.g., 10×10×10 Å = ~33 waters)
- Pack solute into box center, remove overlapping waters (within 2.5 Å of solute)
- Requires PBC (improvement 2.4) and Ewald electrostatics (2.3) for correct long-range interactions
- Alternatively: implicit solvation via Generalized Born / Surface Area (GBSA) model — adds a solvation free energy correction without explicit water atoms. Cheaper, still physically meaningful.
- Display solvent as translucent spheres or as a density isosurface rather than individual atoms
**Impact:** Solvation is *the* context in which most chemistry happens. NaCl should dissociate in water. HCl should donate its proton to water. Proteins fold in water. Nothing in chemistry makes sense except in light of solvation.
**Tests enabled:** NaCl dissociates into Na⁺(aq) + Cl⁻(aq) within 50 ps in explicit water. Water density equilibrates to ~1.0 g/cm³.
**Complexity:** High (explicit) / Medium (implicit GBSA)

### 5.5 Free Energy Perturbation

**Current state:** No free energy calculations.
**Vision:** Compute the free energy difference between two states — e.g., "how much more stable is the NaCl crystal vs the separated ions?" or "what is the binding free energy of this drug to this receptor?" This is the gold standard for computational chemistry predictions.
**Implementation:**
- Thermodynamic integration (TI): slowly mutate one system into another (λ=0→1), compute ⟨∂V/∂λ⟩ at each λ
- Or: free energy perturbation (FEP) via Zwanzig equation: ΔF = -kT ln⟨exp(-ΔV/kT)⟩
- Combined with the transmute tool (3.9), this could answer "by how much does the binding energy change when we swap Na→K?"
- Requires proper ensemble sampling (Nosé-Hoover, improvement 2.5) and long simulation times
**Impact:** The first browser-based free energy calculator. Would be genuinely useful for research-level questions in drug design.
**Complexity:** Very High

### 5.7 Machine-Learned Force Fields (ANI / MACE)

**Current state:** Classical force field with fixed functional forms (Morse, LJ, harmonic).
**Vision:** Replace the classical force field with a neural network potential trained on quantum chemistry data. Models like ANI-2x (Isayev group) or MACE (Csányi group) achieve DFT-level accuracy at a fraction of the compute cost, covering organic chemistry with H, C, N, O, F, S, Cl.
**Implementation:**
- Export a pre-trained ANI-2x model to ONNX format
- Run inference via ONNX Runtime for Web (WASM backend) or WebGPU backend
- The model takes atomic numbers + coordinates → energies + forces, replacing `computeAllForces`
- Symmetry functions (AEVs for ANI) or message-passing (MACE) need to be computed per frame — this is the bottleneck
- Hybrid: use the ML potential for intramolecular forces and classical LJ/Coulomb for intermolecular
**Impact:** Near-quantum accuracy without solving the Schrödinger equation. Reactions, conformational changes, tautomerism — all handled correctly by the learned PES. Would leapfrog every existing browser chemistry tool.
**Complexity:** Very High

### 5.8 Collaborative Multi-User Simulation

**Current state:** Single-user, single-browser.
**Vision:** Multiple users connect to the same simulation via WebSocket. Each user can place atoms, adjust temperature, drag molecules. Changes propagate in real time. A teacher demonstrates acid-base chemistry while 30 students watch and interact.
**Implementation:**
- WebSocket server (Node.js) holding the canonical simulation state
- Optimistic local prediction with server reconciliation (like multiplayer game netcode)
- Or: peer-to-peer via WebRTC data channels (no server needed for 2–5 users)
- Cursor positions, selections, and tool states shared across clients
- "Presenter mode" where one user controls the simulation and others observe
**Impact:** Turns chemistry simulation into a social experience. A virtual chemistry lab where students can experiment together from anywhere.
**Complexity:** High

### 5.9 Time-Resolved Visualization (Trajectory Replay)

**Current state:** The simulation runs forward only. Once a frame is gone, it's gone. There is no way to rewind, replay, or scrub through a trajectory.
**Vision:** Record the full trajectory (positions, velocities, bonds, energy at each frame) into a ring buffer. Add a timeline scrubber to the UI that lets users pause, rewind, and replay the simulation. Highlight specific events (bond formation, bond breaking, energy spikes) on the timeline.
**Implementation:**
- Store snapshots every N steps in a circular buffer (e.g., last 10,000 frames × 3 atoms × 3 coords × 8 bytes = tiny for small molecules, ~2.4 MB for 100 atoms)
- Timeline UI: horizontal bar under the 3D view with markers for topology changes
- Play/pause/rewind controls with adjustable playback speed
- Export trajectory to XYZ multi-frame format or a custom binary format for later analysis
- "Slow motion" mode: interpolate between stored frames for smooth sub-step playback
**Impact:** Essential for studying rare events (reactions). A user runs the simulation at 1000K, a bond breaks at step 5000 — they can rewind and watch the exact moment from any camera angle.
**Complexity:** Medium

### 5.10 Electrochemistry — Electrode Surfaces & Redox

**Current state:** No surfaces, no electrodes, no applied electric fields.
**Vision:** Model a metal surface (e.g., Au(111), Pt(111)) as a fixed lattice. Place molecules above the surface and simulate adsorption, catalysis, and electron transfer. Apply an external electric field to drive electrochemical reactions.
**Implementation:**
- Surface builder: create a 2D periodic slab of metal atoms with fixed positions
- Add an external electric field term to the Hamiltonian: $V_{ext} = -q_i E \cdot r_i$
- For redox: implement Marcus theory for electron transfer rates between metal surface and adsorbed species
- Render the surface as a dense grid of metallic spheres or as a solid reflective plane
**Impact:** Electrochemistry is the basis of batteries, fuel cells, corrosion, and electrolysis. Visualizing a lithium ion intercalating into a graphite layer, or oxygen reducing on a platinum surface, would be extraordinarily pedagogically powerful.
**Complexity:** Very High

### 5.11 Phonon Dispersion & Thermal Properties

**Current state:** Temperature is a single number (Berendsen thermostat). No analysis of vibrational modes or thermal transport.
**Vision:** Compute the phonon dispersion relation for a crystal: build a supercell, compute the dynamical matrix from finite-displacement forces, diagonalize to get phonon frequencies and eigenvectors. Display as a dispersion plot (ω vs k) and animate the phonon modes in 3D.
**Implementation:**
- Requires PBC (2.4) and a crystal builder (3.3)
- Finite displacement method: displace each atom in each direction by ±δ, compute force matrix → dynamical matrix
- Diagonalize for each k-point along high-symmetry path (Γ-X-M-Γ etc.)
- Animate: displace atoms according to eigenvector × sin(ωt) for a selected mode
- Compute heat capacity from phonon DOS: $C_v = \int g(\omega) c_{Einstein}(\omega, T) d\omega$
**Impact:** Connects the atomistic simulation to macroscopic thermal properties. Students could see *why* diamond has high thermal conductivity (stiff bonds → high phonon frequencies → fast heat transport).
**Complexity:** High

### 5.14 Reaction Network Discovery

**Current state:** A user can manually set up specific reactions. There is no automated way to explore what reactions are possible.
**Vision:** Given a set of reactant molecules and a temperature, automatically explore the space of possible reactions by running many short high-temperature MD simulations from different initial orientations. Catalog all observed bond topology changes as a reaction network graph.
**Implementation:**
- Sample N initial configurations (random relative orientation, random collision velocity from Maxwell-Boltzmann at the specified temperature)
- Run each for a short burst (1–10 ps)
- Detect topology changes (bond formed/broken between molecules)
- Cluster outcomes by product bond topology
- Display as a directed graph: reactants → products, edge labels show yield (fraction of trials that produced that outcome) and estimated activation energy
- This is essentially an automated version of nanoreactor MD (Wang et al., Nature Chemistry 2014)
**Impact:** Lets users discover chemistry they didn't anticipate. "I put methane and oxygen together at 2000K — it found pathways to CO₂, H₂O, CO, formaldehyde, and methanol. Here are the rates."
**Complexity:** High

---

## Priority 6 — Educational Features (Physically Grounded)

The goal of this section is not to simplify the physics but to **make the real physics legible**. Every educational feature below should derive its explanations and visualizations directly from the simulation data — no canned animations, no pre-recorded answers. If the simulation gets the physics wrong, the educational overlay should faithfully show the wrong answer, motivating the user (or developer) to fix the underlying model.

### 6.1 Guided Experiments with Predictions

**Current state:** Users get a blank canvas and 5 example molecules. There is no guidance on what to try or what to observe.
**Vision:** A library of structured experiments, each with:
1. **Setup**: which molecules to place and at what conditions (temperature, separation)
2. **Prediction prompt**: "Before you press Play — what do you think will happen to the bond angle if we raise the temperature from 300K to 1000K?" (user types or selects an answer)
3. **Run**: simulation executes for a defined number of steps
4. **Observation**: the simulator highlights the relevant measurement (angle, bond length, energy) with annotations
5. **Explanation**: after the user has seen the result, show a text panel explaining *why* — rooted in the actual forces computed. "The angle widened because the harmonic restoring force (k=5.0 eV/rad²) was overcome by thermal kinetic energy (kT=0.086 eV at 1000K)."

**Example experiments:**
- "What happens when you heat water?" (T: 300→1000→3000K — observe bond vibration amplitude increase, eventual dissociation)
- "Ionic vs covalent: NaCl vs H₂" (compare bond stiffness, response to temperature)
- "Noble gas behavior: why doesn't helium bond?" (place two He atoms, observe only weak LJ attraction, no bond forms)
- "Electronegativity and bond polarity" (compare HF, HCl, HBr — see how partial charges and bond lengths change)
- "What determines molecular shape?" (build H₂O, NH₃, CH₄ — see VSEPR in action via angle equilibria)

**Implementation:**
- `src/experiments/` directory with JSON/TS definitions for each experiment
- Experiment runner UI: step-through wizard overlaid on the 3D view
- Annotations: arrows pointing to specific atoms/bonds with dynamic values ("this O-H bond is currently 1.03 Å, stretched from equilibrium 0.99 Å")
- Prediction UI: multiple-choice or free-text input, stored for self-assessment
**Complexity:** Medium

### 6.2 Real-Time Quantity Dashboard with Physical Explanations

**Current state:** The SimulationControls panel shows KE, PE, total E, and temperature as bare numbers. There is no context for what these numbers mean or why they change.
**Vision:** An expandable dashboard where every displayed quantity links to its physical definition and its real-time dependencies:
- **Temperature**: show the formula T = 2KE/(3NkB), with a tooltip explaining degrees of freedom. Highlight that for 3 atoms, fluctuations are huge (±50%) — this is physically correct, not a bug.
- **Bond energy**: for a selected bond, show the Morse potential curve with a dot indicating the current bond length. As the bond vibrates, the dot moves along the curve in real time.
- **Angle energy**: similar curve for the cosine potential, with the current angle marked
- **Force vectors**: toggle to overlay force arrows on each atom, scaled and colored by magnitude. Show decomposition: "2.1 eV/Å from Morse bond + 0.3 eV/Å from angle bending + 0.01 eV/Å from LJ"
- **Virial and pressure**: compute instantaneous pressure from the virial theorem and display it (requires PBC, but educational even without)

**Implementation:**
- Expandable cards in the right panel, one per quantity
- Each card: current value, mini-chart of history, formula, plain-English explanation
- Force decomposition: compute and cache per-atom contributions from each force type (Morse, angle, LJ, Coulomb, Pauli) separately during `computeAllForces`
- Potential energy curve widget: small canvas showing V(r) or V(θ) with a moving indicator
**Complexity:** Medium

### 6.3 Periodic Table Deep Dive

**Current state:** The periodic table shows element symbols and atomic numbers. Clicking selects an element for placement.
**Vision:** Make the periodic table itself an educational tool:
- **Hover**: show a rich tooltip with all properties (mass, electronegativity, covalent/vdW radius, electron configuration, ionization energy, common oxidation states) — already in the data, just not displayed
- **Color modes**: toggle coloring by electronegativity, atomic radius, electron affinity, ionization energy, or category. Gradient color maps make trends visually obvious (electronegativity increases left→right, radius increases top→bottom).
- **Trend annotations**: optional overlay arrows showing "electronegativity increases →" and "atomic radius increases ↓"
- **"Compare two elements"**: select two elements and see a side-by-side comparison card showing how their properties differ and what that implies for bonding (e.g., "Na (EN=0.93) + Cl (EN=3.16) → ΔEN=2.23 → ionic bond expected")
- **Link to simulation**: "tap to see what happens when you bond this element to [current selection]" — auto-places a diatomic and runs minimization

**Implementation:**
- Extended `PeriodicTable.tsx` with color mode selector and trend overlays
- Comparison modal component
- All data already exists in `elements.ts` — this is purely a UI feature
**Complexity:** Low–Medium

### 6.4 Concept Annotations on the 3D Scene

**Current state:** The 3D scene shows atoms, bonds, and element labels. There are no annotations explaining what the user is seeing in chemical terms.
**Vision:** Toggle-able annotation layers that overlay chemistry concepts directly onto the 3D molecular view:
- **Electronegativity & polarity**: show δ+ / δ− labels near atoms based on partial charges. Draw a dipole moment arrow for the whole molecule (μ = Σ qᵢrᵢ). Color-code bonds by polarity (gradient from less electronegative to more electronegative atom).
- **Lone pairs**: for atoms with fewer bonds than their valence shell allows (e.g., O in H₂O has 2 bonds but 4 electron pairs), show teardrop-shaped lone pair lobes at the expected VSEPR positions.
- **Hybridization geometry**: semi-transparent guides showing the tetrahedral (sp3), trigonal planar (sp2), or linear (sp) framework around each atom.
- **Bond energy labels**: show the Morse De value on each bond in eV or kcal/mol.
- **Formal charges**: compute and display formal charge from valence − (lone pairs + bonds/2).

**All values computed from the simulation, not hardcoded.** The δ+ / δ− comes from the actual `charges` array. The hybridization geometry comes from the actual detected bond angles. The bond energy comes from the actual Morse parameters.

**Implementation:**
- Annotation layer component that reads from the simulation store
- HTML overlays (via `<Html>` from drei) or 3D geometries (for lone pair lobes)
- Toggle checkboxes in the toolbar for each annotation type
**Complexity:** Medium

### 6.5 "Why Did That Happen?" Interaction Logger

**Current state:** When something happens in the simulation (bond breaks, molecule flies apart, temperature spikes), there is no explanation of the cause.
**Vision:** An event log panel that detects physically significant events and explains them in plain language, referencing the actual forces and energies:
- **Bond broken**: "O-H bond between atoms 0 and 2 broke at step 5,234. The bond had stretched to 1.82 Å (equilibrium: 0.99 Å). The kinetic energy of H(2) was 0.45 eV, exceeding the Morse dissociation energy De = 3.04 eV only because the angle compression added 2.8 eV of potential energy."
- **Bond formed**: "Na(0) and Cl(1) formed an ionic bond at step 312. They approached to 2.41 Å (< threshold 3.25 Å). Electronegativity difference: 2.23 → classified as ionic."
- **Temperature spike**: "Temperature jumped from 305K to 892K at step 1,100. This coincided with a topology rebuild where bond O-H(0-1) was lost, releasing 3.04 eV of Morse potential energy into kinetic energy."
- **Energy non-conservation**: "Warning: total energy drifted by 5.2% over the last 1000 steps. This may indicate a timestep that is too large for the stiffest vibration (current dt=1.0 fs, recommended dt≤0.5 fs for O-H bonds)."

**Implementation:**
- Event detector running after each `sendState()` — compare current topology/energy with previous
- Heuristic rules: |ΔE|/E > threshold → log energy event; bond count change → log bond event; T spike → log thermal event
- Each event stores: step number, type, atoms involved, energy values, a generated explanation string
- UI: scrollable log panel, clickable events that highlight the relevant atoms in the 3D view
**Complexity:** Medium

### 6.6 Challenge Mode — Predict the Outcome

**Current state:** No gamification or self-assessment.
**Vision:** A set of chemistry challenges where the simulator presents a scenario and the user must predict the outcome before running it. Scored by accuracy.

**Example challenges:**
- "Which bond is longer: O-H or S-H?" (user picks one, simulation measures both → S-H is longer because S has larger covalent radius)
- "At what temperature does this H₂O molecule dissociate?" (user guesses, simulation ramps T until bond breaks → compare)
- "Arrange these three molecules by bond angle: H₂O, H₂S, NH₃" (user orders them, simulation measures → H₂O 104.5° > NH₃ 107° > H₂S 92°)
- "What happens when you bring Na and Cl close together? Does a bond form? What type?" (user predicts ionic, simulation confirms)
- "If you replace the O in water with S, does the molecule stay bent or become linear?" (user predicts, transmute tool shows the answer)

**Key principle:** Every answer comes from running the actual simulation, not from a lookup table. If the force field gets it wrong (e.g., if NH₃ gives the wrong angle), the challenge *should* fail — this motivates improving the physics.

**Implementation:**
- Challenge definitions in `src/experiments/challenges.ts`
- Challenge runner UI: setup → predict → simulate → score → explain
- Leaderboard (local storage) tracking correct predictions
**Complexity:** Medium

### 6.7 Side-by-Side Comparison Mode

**Current state:** Only one simulation runs at a time. To compare two molecules, you have to run one, remember the numbers, then run the other.
**Vision:** Split the 3D viewport into two synchronized panels, each running an independent simulation. Both share the same temperature, timestep, and thermostat settings. Users can compare:
- H₂O vs H₂S (angle difference)
- NaCl vs NaF (bond length difference)
- CH₄ vs SiH₄ (tetrahedral angle + bond length)
- Same molecule at two different temperatures
- Before and after an atom transmutation

Measurements from both panels displayed in a shared comparison table.

**Implementation:**
- Two `SimulationWorker` instances running in parallel
- Split `<Canvas>` into two viewports (Three.js supports this via scissor/viewport)
- Shared controls panel that dispatches config changes to both workers
- Comparison table component showing matching measurements side by side
**Complexity:** Medium–High

### 6.8 Export Simulation as Shareable Lesson

**Current state:** No way to save or share a specific simulation state.
**Vision:** Package a simulation snapshot (atom positions, velocities, bonds, config, camera angle, active annotations) into a shareable URL or downloadable file. A teacher sets up "water at 300K with force vectors and polarity annotations visible" and shares a URL. Students open it and see the exact same scene, ready to interact.

**Implementation:**
- Serialize full simulation state to a compact JSON blob
- Compress with zlib or LZ-string → encode as base64 URL parameter
- Or: save to a `.chemsim` JSON file with a defined schema
- "Share" button generates a URL; "Load" accepts URL parameter or file drop
- Include experiment instructions/annotations in the saved state
**Complexity:** Low–Medium
