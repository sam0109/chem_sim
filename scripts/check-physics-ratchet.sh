#!/usr/bin/env bash
# Physics test ratchet — ensures physics tests never regress.
# Reads the baseline from .physics-test-count, runs the test suite,
# and fails if the passing count drops below the baseline.
#
# If the count increases, the baseline file is updated so that
# future runs hold the higher standard.
#
# Usage: bash scripts/check-physics-ratchet.sh
# Exit codes: 0 = pass (no regression), 1 = regression detected

set -euo pipefail

RATCHET_FILE=".physics-test-count"

# --- Read baseline ---
if [ ! -f "$RATCHET_FILE" ]; then
  echo "ERROR: $RATCHET_FILE not found. Create it with the current passing count."
  exit 1
fi

baseline=$(cat "$RATCHET_FILE" | tr -d '[:space:]')

if ! [[ "$baseline" =~ ^[0-9]+$ ]]; then
  echo "ERROR: $RATCHET_FILE contains invalid content: '$baseline' (expected an integer)"
  exit 1
fi

echo "Physics test ratchet baseline: $baseline"
echo ""

# --- Run the test suite and capture output ---
# tests.ts exits non-zero when any test fails, which is expected.
# We capture output regardless of exit code.
output=$(npx tsx src/engine/tests.ts 2>&1) || true
echo "$output"
echo ""

# --- Parse the PASSED: X/Y line ---
passed_line=$(echo "$output" | grep -oP 'PASSED:\s+\K[0-9]+(?=/[0-9]+)')

if [ -z "$passed_line" ]; then
  echo "ERROR: Could not parse passing count from test output."
  echo "Expected a line matching 'PASSED: X/Y'"
  exit 1
fi

current=$passed_line
echo "--- Ratchet Check ---"
echo "Baseline: $baseline"
echo "Current:  $current"

# --- Compare ---
if [ "$current" -lt "$baseline" ]; then
  echo ""
  echo "REGRESSION DETECTED: passing count dropped from $baseline to $current."
  echo "Fix the regression or update $RATCHET_FILE if this is intentional."
  exit 1
fi

if [ "$current" -gt "$baseline" ]; then
  echo ""
  echo "IMPROVEMENT: passing count increased from $baseline to $current!"
  echo "Updating $RATCHET_FILE to $current."
  echo "$current" > "$RATCHET_FILE"
fi

if [ "$current" -eq "$baseline" ]; then
  echo ""
  echo "No change — $current tests passing (matches baseline)."
fi

echo "Ratchet check PASSED."
exit 0
