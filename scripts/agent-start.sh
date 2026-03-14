#!/usr/bin/env bash
# scripts/agent-start.sh — Bootstrap an agent environment for a given issue.
#
# Usage:
#   ./scripts/agent-start.sh <issue-number>
#
# This script is designed to run inside a dev container or any fresh
# environment. It:
#   1. Verifies prerequisites (git, gh, node)
#   2. Fetches the issue title to build a branch name
#   3. Creates a feature branch from main
#   4. Installs dependencies
#   5. Prints next-step instructions

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <issue-number>"
  exit 1
fi

ISSUE_NUM="$1"
REPO="sam0109/chem_sim"

# --- Prerequisites -----------------------------------------------------------

for cmd in git gh node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is not installed."
    exit 1
  fi
done

if ! gh auth status &>/dev/null; then
  echo "Error: gh CLI is not authenticated. Run 'gh auth login' first."
  exit 1
fi

# --- Fetch issue info ---------------------------------------------------------

ISSUE_TITLE=$(gh issue view "$ISSUE_NUM" --repo "$REPO" --json title -q '.title')
if [ -z "$ISSUE_TITLE" ]; then
  echo "Error: Could not fetch issue #$ISSUE_NUM from $REPO."
  exit 1
fi

# Build a slug from the title: lowercase, replace non-alphanum with hyphens, trim
SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)
BRANCH="${ISSUE_NUM}-${SLUG}"

echo "=== ChemSim Agent Bootstrap ==="
echo "Issue:  #$ISSUE_NUM — $ISSUE_TITLE"
echo "Branch: $BRANCH"
echo ""

# --- Set up branch ------------------------------------------------------------

git fetch origin main
git checkout -b "$BRANCH" origin/main 2>/dev/null || git checkout "$BRANCH"

# --- Install dependencies -----------------------------------------------------

echo "Installing dependencies..."
npm install

# --- Done ---------------------------------------------------------------------

echo ""
echo "=== Ready ==="
echo "Branch '$BRANCH' is checked out and dependencies are installed."
echo ""
echo "Launching Claude Code agent..."
echo ""

exec claude --print "Follow AGENTS.md"
