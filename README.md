# ChemSim — Interactive 3D Chemistry Bonding Simulator

A physically accurate, browser-based molecular dynamics simulator built with TypeScript, React Three Fiber, and a custom force-field engine running in a Web Worker. ChemSim aims to reproduce real chemistry with **as few shortcuts as possible** — every force, every constant, and every detection algorithm is derived from published physics rather than ad-hoc heuristics.

## Quick Start

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Design Philosophy

**Physical accuracy over visual spectacle.** Every interaction in ChemSim is computed from a real potential energy function with analytically correct gradients:

- **Bonds** use the Morse potential (not harmonic springs), allowing realistic dissociation
- **Angles** use a cosine-based harmonic potential derived from the UFF force field
- **Van der Waals** uses Lennard-Jones 12-6 with geometric combining rules
- **Electrostatics** uses shifted Coulomb with published partial charges
- **Integration** uses velocity Verlet (symplectic, time-reversible, energy-conserving)
- **Bond detection** uses covalent radii with hysteresis and valence constraints — not fixed topology
- **Parameters** come from the Universal Force Field (Rappé et al. JACS 1992) and Blue Obelisk Data Repository

The simulation recomputes bonds at every frame based on inter-atomic distances, atomic valences, and electronegativity. Molecules can form and break dynamically.

## Architecture

```
┌─────────────────────────────────────────────┐
│           Main Thread (React / R3F)         │
│  ┌────────────┐  ┌────────────────────────┐ │
│  │ UI Panels   │  │ Three.js Scene         │ │
│  │ (React)     │  │  - Instanced spheres   │ │
│  │             │  │  - Instanced cylinders  │ │
│  │ Controls    │  │  - HTML labels          │ │
│  │ Tables      │  │  - Orbit controls       │ │
│  └────────────┘  └────────────────────────┘ │
│         ↕ Zustand stores                     │
│         ↕ postMessage (positions/bonds)      │
├─────────────────────────────────────────────┤
│           Web Worker                         │
│  ┌────────────────────────────────────────┐ │
│  │ MD Engine                               │ │
│  │  - Velocity Verlet integrator           │ │
│  │  - Morse / LJ / Coulomb / Angle forces  │ │
│  │  - 1-4 pair scaling (AMBER/OPLS)        │ │
│  │  - Cell list neighbor search            │ │
│  │  - Hysteresis bond detection            │ │
│  │  - Berendsen thermostat                 │ │
│  │  - Steepest descent minimizer           │ │
│  └────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────┐ │
│  │ Chemistry Data                          │ │
│  │  - Periodic table (Blue Obelisk)        │ │
│  │  - UFF parameters (Rappé et al. 1992)   │ │
│  │  - Bond detection rules + valence       │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Source Structure

```
src/
├── data/                    # Chemistry data & type definitions
│   ├── types.ts             # Core interfaces: Atom, Bond, SimulationConfig, etc.
│   ├── elements.ts          # Periodic table: Z=1–36 + select heavier elements
│   └── uff.ts               # UFF force field parameters & derived functions
├── engine/                  # Simulation engine (runs in Web Worker)
│   ├── worker.ts            # Worker entry: message handling, sim loop, topology
│   ├── integrator.ts        # Velocity Verlet + Maxwell-Boltzmann initialization
│   ├── neighborList.ts      # Cell list (linked-cell) for O(N) pair search
│   ├── bondDetector.ts      # Hysteresis bond detection with valence constraints
│   ├── thermostat.ts        # Berendsen thermostat + velocity rescaling
│   ├── minimizer.ts         # Steepest descent energy minimizer
│   ├── debug.ts             # CLI debug harness (npx tsx src/engine/debug.ts)
│   └── forces/
│       ├── morse.ts         # Morse potential (covalent bonds)
│       ├── lennardJones.ts  # LJ 12-6 (van der Waals)
│       ├── coulomb.ts       # Shifted Coulomb (electrostatics)
│       ├── harmonic.ts      # Cosine-based angle bending
│       ├── torsion.ts       # Dihedral torsion potential
│       └── inversion.ts     # Out-of-plane inversion potential
├── renderer/                # 3D visualization (React Three Fiber)
│   ├── Scene.tsx            # R3F Canvas, lighting, controls, interaction
│   ├── AtomRenderer.tsx     # Instanced sphere mesh (up to 2000 atoms)
│   ├── BondRenderer.tsx     # Instanced cylinder mesh (up to 2000 bonds)
│   ├── AtomLabels.tsx       # HTML overlay labels (up to 100)
│   └── shaders/             # GLSL impostor shaders (future use)
├── store/
│   ├── simulationStore.ts   # Zustand: atoms, bonds, energy, worker interface
│   └── uiStore.ts           # Zustand: tools, selection, render mode, panels
├── ui/
│   ├── PeriodicTable.tsx    # Interactive element picker (Z=1–36)
│   ├── SimulationControls.tsx # Play/pause, temperature, timestep, thermostat
│   ├── PropertyPanel.tsx    # Selected atom/bond properties
│   ├── Toolbar.tsx          # Tool selection + render mode + keyboard shortcuts
│   └── EnergyPlot.tsx       # Real-time KE/PE/Total canvas chart
├── io/
│   ├── examples.ts          # Built-in molecules: H₂O, CH₄, C₂H₅OH, NaCl, CO₂
│   └── xyz.ts               # XYZ file format reader/writer
├── worker-comms.ts          # SimulationWorker class (message protocol)
├── App.tsx                  # Main application shell
├── main.tsx                 # React entry point
└── index.css                # Global dark theme styles
```

## Force Field

### Potentials

| Interaction    | Potential                                   | Parameters from      |
| -------------- | ------------------------------------------- | -------------------- |
| Covalent bonds | Morse: V = Dₑ[1 − e^(−α(r−rₑ))]²            | UFF bond radii + Z\* |
| Angle bending  | Cosine harmonic: V = (k_c/2)(cosθ − cosθ₀)² | UFF Eq. 13           |
| Van der Waals  | LJ 12-6: V = 4ε[(σ/r)¹² − (σ/r)⁶]           | UFF xᵢ, Dᵢ           |
| Electrostatics | Shifted Coulomb: V = kₑ qᵢqⱼ (1/r − 1/rₓ)   | Partial charges      |

### Exclusion Rules

- **1-2 pairs** (directly bonded): excluded from LJ and Coulomb (Morse handles them)
- **1-3 pairs** (connected through an angle): excluded from LJ and Coulomb (angle potential handles them)
- **1-4 pairs** (dihedral terminals): LJ and Coulomb scaled by 0.5 (AMBER/OPLS convention; Cornell et al., JACS 117, 5179, 1995)
- **1-5+ pairs**: full LJ + Coulomb

### Bond Detection

Bonds are recomputed every frame from atomic positions using:

1. **Distance criterion**: d < (r_cov,A + r_cov,B) × t where t = 1.2 (formation) or 1.5 (breaking, for existing bonds — hysteresis)
2. **Valence constraint**: each atom tracks its current bond count; bonds exceeding `maxValence` are rejected
3. **Priority**: existing bonds are retained preferentially; new candidates sorted by shortest distance
4. **Classification**: |Δχ| > 1.7 → ionic; both metals → metallic; else → covalent
5. **Bond order**: estimated from d/d_single ratio (< 0.82 → triple, < 0.92 → double, else single)

### Integration

Velocity Verlet with unit conversion factor CONV = 103.6427 (1 eV = 103.6427 amu·Å²/fs²):

1. v(t + Δt/2) = v(t) + F(t)/(2m·CONV) · Δt
2. r(t + Δt) = r(t) + v(t + Δt/2) · Δt
3. Compute F(t + Δt)
4. v(t + Δt) = v(t + Δt/2) + F(t + Δt)/(2m·CONV) · Δt

Default timestep: 0.5 fs. 5 steps per rendered frame at 60 fps = 2.5 fs/frame = 150 fs/s real time.

### Temperature Control

Berendsen thermostat: λ = √(1 + Δt/τ · (T_target/T − 1)), clamped to [0.9, 1.1]. Default τ = 100 fs.

## UI Controls

| Key | Action          |
| --- | --------------- |
| S   | Select tool     |
| A   | Place atom tool |
| D   | Delete tool     |
| G   | Drag tool       |
| M   | Measure tool    |
| L   | Toggle labels   |

## Built-in Molecules

| Name            | Atoms | Formula | Key properties                         |
| --------------- | ----- | ------- | -------------------------------------- |
| Water           | 3     | H₂O     | O-H 0.990 Å, ∠HOH 104.51°, SPC charges |
| Methane         | 5     | CH₄     | Tetrahedral, C-H 1.09 Å                |
| Ethanol         | 9     | C₂H₅OH  | C-C 1.52 Å, C-O + O-H bonds            |
| Sodium Chloride | 2     | NaCl    | Ionic, 2.36 Å separation, ±1.0 e       |
| Carbon Dioxide  | 3     | CO₂     | Linear, C=O 1.16 Å                     |

## Running Tests

```bash
npx tsx src/engine/tests.ts       # Physics invariant tests
npx vitest run                    # Unit tests (force functions)
npm run test                      # All test suites
npx tsx src/engine/debug.ts       # Interactive water molecule debug harness
```

### Physics Test Suite

The physics tests (`src/engine/tests.ts`) run the simulation for N steps on known molecules and check physically meaningful invariants. The test count must **never decrease** on `main` (ratchet).

**Current status: 17/22 passing.** 5 pre-existing failures in methane/CO₂ (tracked in issues #1–#4).

| Category                    | Tests                   | What they check                                           |
| --------------------------- | ----------------------- | --------------------------------------------------------- |
| NVE (energy conservation)   | NVE-01 through NVE-06   | \|ΔE/E₀\| stays within tolerance without thermostat       |
| GEO (structural invariants) | GEO-01 through GEO-15   | Bond lengths, angles, and dihedrals at 300K NVT           |
| THERMO (temperature)        | THERMO-01, THERMO-02    | Thermostat convergence and ensemble correctness           |
| GRAD (gradient consistency) | GRAD-01 through GRAD-06 | Analytical force = −dE/dr via numerical finite difference |
| RXN (reactions)             | RXN-01 through RXN-05   | Bond formation/breaking under controlled conditions       |
| MOL (molecule tracking)     | MOL-01, MOL-02          | Connected component identification                        |

**Rule:** Physics tests must NEVER be weakened to make a change pass. If a change breaks a test, fix the change.

See [GitHub Issues](https://github.com/sam0109/chem_sim/issues) for the full roadmap.

## Architecture Rules

These rules prevent structural decay. They are enforced by ESLint (`eslint-plugin-boundaries`) and CI.

### Layer Dependencies

| Layer           | Allowed imports                            | Forbidden                         |
| --------------- | ------------------------------------------ | --------------------------------- |
| `src/data/`     | Standard library only                      | engine, renderer, store, ui       |
| `src/engine/`   | `src/data/` only                           | React, Three.js, DOM APIs         |
| `src/renderer/` | `src/data/`, `src/store/`, Three.js, React | Direct engine imports (use store) |
| `src/store/`    | `src/data/`, `src/worker-comms.ts`         | renderer, engine, ui              |
| `src/ui/`       | `src/data/`, `src/store/`, React           | Three.js, direct engine imports   |
| `src/io/`       | `src/data/` only                           | engine, renderer                  |

### Worker Boundary

The engine runs in a Web Worker and must NOT import React, Three.js, DOM APIs, or the store. All communication goes through `postMessage` with typed messages in `types.ts`.

### Force Function Purity

Every function in `src/engine/forces/` must:

- Take positions and forces arrays as arguments (no global state)
- Accumulate forces additively (not overwrite)
- Return potential energy
- Be deterministic (no randomness)
- Have analytically correct gradients (verified by GRAD tests)

### No Magic Numbers

Every numerical constant in the engine must cite its source (paper, database, or derivation). No hardcoded values without comments.

## Dependencies

| Package                     | Purpose                                 |
| --------------------------- | --------------------------------------- |
| three                       | 3D rendering engine                     |
| @react-three/fiber          | React renderer for Three.js             |
| @react-three/drei           | R3F helpers (OrbitControls, Html, Grid) |
| @react-three/postprocessing | Post-processing effects (future)        |
| zustand                     | Lightweight state management            |
| react / react-dom           | UI framework                            |
| vite                        | Build tool + HMR                        |
| vite-plugin-glsl            | GLSL shader imports                     |

## References

- Rappé, A.K. _et al._ "UFF, a Full Periodic Table Force Field." _J. Am. Chem. Soc._ **114**, 10024–10035 (1992).
- Blue Obelisk Data Repository — atomic radii, CPK colors, electronegativities
- NIST CCCBDB — experimental bond lengths and angles for validation

## Running an Agent

ChemSim uses AI agents to implement features from GitHub Issues. See [AGENTS.md](AGENTS.md) for the full workflow.

### Launching an agent

**Option A — Dev container (recommended):**

```bash
# 1. Copy .env.example to .env and add your GitHub PAT
cp .env.example .env
# Edit .env and set GH_TOKEN=ghp_...

# 2. Ensure your Anthropic proxy is running on localhost:4141

# 3. Launch the agent
docker compose run --rm agent
```

The container clones the repo, installs dependencies, and launches Claude Code with `--dangerously-skip-permissions`. Claude Code follows AGENTS.md autonomously — it selects an unclaimed issue, claims it, creates a branch, implements the fix, opens a PR, reviews it, and merges.

**Option B — Git worktree (no Docker needed):**

```bash
cd chem_sim
git worktree add ../chem_sim-42 -b 42-my-feature main
cd ../chem_sim-42
npm install
claude --dangerously-skip-permissions --print "Follow AGENTS.md"
```

The agent follows AGENTS.md end-to-end: claim issue, plan, implement, PR, review, merge, and reflect.

### Launching multiple agents in parallel

```bash
python3 scripts/launch-agents.py -n 3   # maintain 3 concurrent agents
```

The pool manager keeps N agents running at all times. When one finishes, a replacement launches immediately if unclaimed issues remain. Agents use a claim-hash locking protocol (see AGENTS.md Step 0) to avoid duplicate issue claims. The script stops launching when no unclaimed issues are left.

Ctrl-C once stops new launches but lets running agents finish; Ctrl-C twice stops running containers immediately.
