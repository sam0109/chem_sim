# ChemSim — Claude Code Instructions

## Key Commands
- `npm run build` — tsc -b && vite build
- `npm run lint` — eslint .
- `npx tsx src/engine/tests.ts` — physics test suite (custom, no framework)
- `npx tsc --noEmit` — typecheck only
- `npx vite build` — build only

## Architecture
- `src/data/` — types, element data, UFF params
- `src/engine/` — forces, integrator, thermostat, tests (NO UI imports allowed)
- `src/renderer/` — Three.js rendering components
- `src/store/` — Zustand stores
- `src/ui/` — React UI components
- `src/io/` — file I/O, example molecules

## Rules
- Engine code (`src/engine/`) must NEVER import from renderer, store, or UI
- Never weaken a test tolerance to make a change pass
- Run `npx tsx src/engine/tests.ts` after every engine change
- Run `npx tsc --noEmit` after every change
- No `any` types, no `console.log` in production code
- Constants must cite their source (paper, database)
- One concern per commit — don't mix refactoring with new features

## CI Pipeline (.github/workflows/ci.yml)
- 6 jobs: lint, typecheck, build, physics-tests, unit-tests, e2e-tests
- lint and physics-tests use continue-on-error (pre-existing failures)
- unit-tests and e2e-tests are placeholders (issues #47, #48)

## Known State
- Physics tests: 17/22 passing (5 pre-existing failures in methane/CO2)
- ESLint: 6 pre-existing errors (prefer-const, no-unused-vars, no-case-declarations)
- No test framework installed (no vitest/jest)
- No Prettier configured

## Lessons Learned
- Always validate CI YAML with `python3 -c "import yaml; yaml.safe_load(open('file'))"` not just visual inspection
- In YAML, `#` in unquoted strings starts a comment — use single quotes around echo commands with issue refs
- Run ALL CI-equivalent commands locally before committing CI changes (including lint)
- When adding CI for existing tools, check if they pass on main first — use continue-on-error if not
