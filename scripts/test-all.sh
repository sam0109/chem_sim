#!/usr/bin/env bash
# test-all.sh — Runs all ChemSim test suites in sequence.
#
# Suites:
#   1. Physics invariant tests  (npx tsx src/engine/tests.ts)
#   2. Vitest unit tests         (npx vitest run) — skipped if not in devDependencies
#   3. Playwright e2e tests      (npx playwright test) — skipped if not in devDependencies
#
# Exit code: non-zero if any non-skipped suite fails.
# Usage: bash scripts/test-all.sh   (or: npm test)

set -uo pipefail

exit_code=0
skipped=0
ran=0

# Check if a package is installed locally (in node_modules).
has_local_pkg() {
  [ -d "node_modules/$1" ]
}

echo "=============================="
echo " ChemSim — Test Runner"
echo "=============================="

# --- 1. Physics tests ---
echo ""
echo ">>> [1/3] Physics invariant tests"
echo ""
npx tsx src/engine/tests.ts
physics_exit=$?
ran=$((ran + 1))
if [ $physics_exit -ne 0 ]; then
  echo ""
  echo "    Physics tests exited with code $physics_exit"
  exit_code=1
fi

# --- 2. Vitest unit tests ---
echo ""
echo ">>> [2/3] Vitest unit tests"
echo ""
if has_local_pkg vitest; then
  npx vitest run
  vitest_exit=$?
  ran=$((ran + 1))
  if [ $vitest_exit -ne 0 ]; then
    echo ""
    echo "    Vitest tests exited with code $vitest_exit"
    exit_code=1
  fi
else
  echo "    SKIPPED — vitest is not installed (see issue #47)"
  skipped=$((skipped + 1))
fi

# --- 3. Playwright e2e tests ---
echo ""
echo ">>> [3/3] Playwright e2e tests"
echo ""
if has_local_pkg "@playwright/test"; then
  npx playwright test
  playwright_exit=$?
  ran=$((ran + 1))
  if [ $playwright_exit -ne 0 ]; then
    echo ""
    echo "    Playwright tests exited with code $playwright_exit"
    exit_code=1
  fi
else
  echo "    SKIPPED — @playwright/test is not installed (see issue #48)"
  skipped=$((skipped + 1))
fi

# --- Summary ---
echo ""
echo "=============================="
echo " Test Runner Summary"
echo "=============================="
echo "  Suites run:     $ran"
echo "  Suites skipped: $skipped"
if [ $exit_code -eq 0 ]; then
  echo "  Result:         ALL PASSED"
else
  echo "  Result:         FAILURES DETECTED"
fi
echo ""

exit $exit_code
