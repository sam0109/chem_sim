# ChemSim — Guardrails

This document defines the automated checks, manual review standards, and process discipline that keep ChemSim from accumulating tech debt, broken features, or drift from its core mission: **a physically accurate, interactive chemistry bonding simulator.**

---

## 1. Continuous Integration (GitHub Actions)

Every push and pull request must pass the following automated pipeline before merge.

### 1.1 CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx tsc --noEmit

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build

  physics-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx tsx src/engine/tests.ts

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx vitest run

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
```

### 1.2 Required Checks (Branch Protection)

Enable on `main`:
- ✅ `lint` must pass
- ✅ `typecheck` must pass
- ✅ `build` must pass
- ✅ `physics-tests` must pass (exit code 0 = all physics invariants hold)
- ✅ `unit-tests` must pass
- ✅ `e2e-tests` must pass
- ✅ At least 1 approving review
- ✅ No force pushes to `main`

---

## 2. Linting & Formatting

### 2.1 ESLint (already configured)

Current config: `eslint.config.js` with TypeScript + React hooks + React Refresh rules.

**Additions needed:**
- Enable `no-console` as a warning (allow `console.log` only in `debug.ts` and `tests.ts`)
- Enable `@typescript-eslint/no-explicit-any` as an error — force proper typing
- Enable `@typescript-eslint/no-unused-vars` as an error (not just warning)
- Add `eslint-plugin-import` for import ordering and no circular dependencies

### 2.2 Prettier (to be added)

Install `prettier` and create `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

Add `npm run format` and `npm run format:check` scripts. CI runs `format:check`.

### 2.3 Pre-commit Hook

Install `husky` + `lint-staged`:
```json
// package.json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml}": ["prettier --write"]
}
```

This catches formatting issues before they reach CI.

---

## 3. Testing Strategy

### 3.1 Physics Invariant Tests (`src/engine/tests.ts`)

**What:** Run the MD simulation for N steps on known molecules and check physically meaningful invariants (energy conservation, bond lengths, angles, temperatures). These are the ground truth for whether the simulator is working correctly.

**When:** Every CI run. Blocking — if any physics test regresses, the PR cannot merge.

**Rule:** Physics tests must NEVER be weakened to make a PR pass. If a change breaks a physics test, either fix the change or document the regression in IMPROVEMENTS.md as a known issue with a plan to fix it.

**Current:** 16/22 passing. Target: monotonically increasing.

### 3.2 Unit Tests (Vitest)

**What:** Isolated tests for individual functions: force computations, bond detection, integrator, thermostat, minimizer, data lookups.

**Structure:**
```
src/
├── engine/
│   ├── forces/
│   │   ├── morse.ts
│   │   └── morse.test.ts          ← unit test
│   ├── bondDetector.ts
│   └── bondDetector.test.ts       ← unit test
├── data/
│   ├── uff.ts
│   └── uff.test.ts                ← unit test
```

**Requirements:**
- Every force function must have a test verifying: (a) correct energy at known distance, (b) force = −dE/dr via numerical gradient, (c) Newton's 3rd law (F_i = −F_j), (d) zero force at equilibrium
- Every data lookup function must have a test for at least 3 elements
- Bond detection must be tested with known geometries: water (2 bonds), methane (4 bonds), separated atoms (0 bonds)
- Coverage target: 80%+ for `src/engine/` and `src/data/`

### 3.3 UI Tests (Playwright)

**What:** End-to-end browser tests that verify the UI renders correctly and interactions work.

**Structure:**
```
e2e/
├── smoke.spec.ts           ← App loads, canvas renders, no console errors
├── periodic-table.spec.ts  ← Click element → selected element changes
├── simulation.spec.ts      ← Load water → press play → atoms move
├── tools.spec.ts           ← Switch tools via keyboard shortcuts
├── examples.spec.ts        ← Load each built-in molecule → correct atom count
├── controls.spec.ts        ← Temperature slider → value updates
```

**Requirements:**
- Smoke test must pass: page loads in <5s, canvas renders, no uncaught exceptions
- Each built-in molecule loads without errors
- Play/pause toggles correctly
- Periodic table element selection works
- Keyboard shortcuts trigger correct tool changes

### 3.4 Visual Regression (Optional, Future)

Use Playwright screenshot comparison to catch unintended rendering changes. Low priority — physics correctness matters more than pixel-perfect visuals.

---

## 4. Pull Request Checklist

Every PR must include a comment with this checklist filled out. Copy-paste this into your PR description:

```markdown
## PR Checklist

### Purpose
- [ ] This change contributes toward one of the stated goals in README.md or IMPROVEMENTS.md
- [ ] I can name the specific improvement/bug this addresses: _______________

### Physics Accuracy
- [ ] If this changes any force computation, the numerical gradient test still passes
- [ ] If this changes the integrator, NVE energy conservation tests still pass
- [ ] If this adds a new potential/force, I added a gradient consistency test for it
- [ ] If this changes bond detection, the structural invariant tests still pass
- [ ] I have NOT weakened any physics test tolerance to make this PR pass
- [ ] Any new physical constants or parameters cite their source (paper, database, or derivation)

### Code Quality
- [ ] No `any` types introduced
- [ ] No `console.log` left in production code (only in debug.ts/tests.ts)
- [ ] No duplicated logic — if similar code exists elsewhere, I refactored to share it
- [ ] Functions are <50 lines where possible; complex logic is commented
- [ ] New files follow the existing directory structure conventions
- [ ] Variable names are descriptive (no single-letter names outside loop indices and math formulas)

### Testing
- [ ] All existing tests pass (CI green)
- [ ] I added tests for new functionality
- [ ] My tests actually test what they claim — they would FAIL if the feature were broken
- [ ] Tests are not tautological (e.g., `expect(add(2,3)).toBe(add(2,3))` tests nothing)
- [ ] Tests use physically meaningful assertions, not arbitrary magic numbers
- [ ] If I can't test something (e.g., visual rendering), I documented why

### Performance
- [ ] I haven't introduced O(N²) loops where O(N) or O(N log N) is possible
- [ ] If this runs in the hot loop (inside `computeAllForces` or `velocityVerletStep`), I benchmarked it
- [ ] No unnecessary allocations per frame (reuse typed arrays, avoid object spread in hot paths)

### Documentation
- [ ] README.md is updated if this changes the public API, architecture, or usage
- [ ] IMPROVEMENTS.md is updated: mark completed items, add new items if discovered
- [ ] Complex algorithms have inline comments explaining the math
- [ ] Any "temporary hack" or "TODO" is tracked in IMPROVEMENTS.md Priority 4 (tech debt)

### Follow-ups
- [ ] I've added items to IMPROVEMENTS.md for any related work that's important but out of scope for this PR
- [ ] I've noted any known limitations of this change in the PR description

### Final
- [ ] I would mass approve a PR of this quality from someone else
- [ ] The codebase is better after this change than before
```

---

## 5. Architecture Rules

These rules prevent structural decay over time.

### 5.1 Separation of Concerns

| Layer | Allowed dependencies | Forbidden |
|-------|---------------------|-----------|
| `src/data/` | Standard library only | No imports from engine, renderer, store, ui |
| `src/engine/` | `src/data/` only | No React, no Three.js, no DOM APIs |
| `src/renderer/` | `src/data/`, `src/store/`, Three.js, React | No direct engine imports (use store) |
| `src/store/` | `src/data/`, `src/worker-comms.ts` | No renderer, no engine, no UI |
| `src/ui/` | `src/data/`, `src/store/`, React | No Three.js, no direct engine imports |
| `src/io/` | `src/data/` only | No engine, no renderer |

**Enforcement:** Add an ESLint `no-restricted-imports` rule per directory, or use `eslint-plugin-boundaries`.

### 5.2 Worker Boundary

The engine runs in a Web Worker. It MUST NOT:
- Import React or any DOM API
- Import Three.js
- Access `window`, `document`, or `localStorage`
- Depend on the store

All communication goes through `postMessage` with typed messages defined in `types.ts`.

### 5.3 No Magic Numbers in Physics

Every numerical constant in the engine must either:
- Come from a named constant with a comment citing the source (e.g., `const KE = 14.3996; // eV·Å/e², Coulomb constant`)
- Be derived from UFF parameters via a documented formula
- Be documented as an approximation with a reference to the IMPROVEMENTS.md item that would replace it

### 5.4 Force Functions Must Be Pure

Every function in `src/engine/forces/` must:
- Take positions and forces arrays as arguments (no global state)
- Accumulate forces additively (not overwrite)
- Return potential energy
- Be deterministic (no randomness)
- Have analytically correct gradients (verified by numerical test)

---

## 6. Regression Prevention

### 6.1 Physics Test Ratchet

The number of passing physics tests must **never decrease** on `main`. Track in CI:

```bash
PASSING=$(npx tsx src/engine/tests.ts 2>&1 | grep "PASSED:" | grep -oP '\d+')
PREVIOUS=$(cat .physics-test-count 2>/dev/null || echo 0)
if [ "$PASSING" -lt "$PREVIOUS" ]; then
  echo "❌ Physics test regression: was $PREVIOUS, now $PASSING"
  exit 1
fi
echo "$PASSING" > .physics-test-count
```

### 6.2 Bundle Size Budget

The production JS bundle should stay under 1.5 MB (currently ~1.18 MB). If a dependency adds >100 KB, it needs justification.

### 6.3 Performance Budget

The simulation should maintain 60 fps with ≤10 atoms on a 2020-era laptop. If a change drops frame rate, it needs profiling data in the PR.

---

## 7. Dependency Management

### 7.1 Adding Dependencies

Before adding a new npm package:
1. Is there a way to do this without a dependency? (Prefer native APIs)
2. How large is it? (`npm pack --dry-run` or bundlephobia.com)
3. Is it maintained? (last release <12 months, >100 GitHub stars)
4. Does it have TypeScript types?
5. Does it work in a Web Worker? (if needed by the engine)

### 7.2 Updating Dependencies

Run `npm audit` monthly. Update Three.js and R3F together (they share a version matrix). Pin exact versions for physics-critical packages (Three.js rendering can change between minors).

---

## 8. Review Culture

### 8.1 What Makes a Good Review

- **Check the physics first.** Does the math match the cited formula? Are units consistent? Would a chemist agree with the result?
- **Run the tests locally.** Don't trust CI alone — run `npx tsx src/engine/tests.ts` and check the numbers make sense, not just PASS/FAIL.
- **Read the numerical values.** If a test asserts `angle > 99 && angle < 110`, ask: why those bounds? What is the experimental value? Is the tolerance justified?
- **Try breaking the code.** What happens at edge cases? Zero atoms? One atom? Overlapping atoms? Temperature = 0?
- **Question magic numbers.** If you see `0.5 * Math.sqrt(uffI.Z * uffK.Z)`, ask where that formula comes from and whether it matches the paper.

### 8.2 Red Flags in a PR

Reject or request changes if you see:
- 🚩 A physics test tolerance was loosened
- 🚩 `as any` or type assertion on physics data
- 🚩 A force function that doesn't have a gradient test
- 🚩 New code in the worker that imports from `src/renderer/` or `src/ui/`
- 🚩 A hardcoded numerical constant without a comment
- 🚩 A "temporary fix" without a corresponding IMPROVEMENTS.md item
- 🚩 Tests that only check "does not throw" without checking outputs
- 🚩 Changes to `computeAllForces` without profiling data

---

## 9. Setup Checklist

To fully implement these guardrails:

- [ ] Create `.github/workflows/ci.yml` with the workflow above
- [ ] Install and configure Prettier (`npm install -D prettier`)
- [ ] Install Husky + lint-staged (`npx husky init`, configure `pre-commit`)
- [ ] Install Vitest (`npm install -D vitest`)
- [ ] Write initial unit tests for all force functions
- [ ] Install Playwright (`npm install -D @playwright/test`)
- [ ] Write initial e2e smoke test
- [ ] Enable branch protection on `main` in GitHub repo settings
- [ ] Add `.physics-test-count` file tracking current passing count
- [ ] Create `.github/PULL_REQUEST_TEMPLATE.md` with the PR checklist
- [ ] Configure `eslint-plugin-boundaries` for layer dependency enforcement
- [ ] Add `npm run test` script that runs all test suites in sequence
