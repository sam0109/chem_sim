#!/usr/bin/env bash
# Setup branch protection rules for the main branch.
#
# Implements GUARDRAILS.md 1.2:
#   - Require all CI checks to pass before merging
#   - Require at least 1 approving review
#   - No force pushes to main
#
# Prerequisites:
#   - gh CLI authenticated with a token that has admin access to the repo
#   - Run from the repo root (or set REPO below)
#
# Usage: bash scripts/setup-branch-protection.sh
#
# Reference: https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection

set -euo pipefail

REPO="sam0109/chem_sim"
BRANCH="main"

echo "Configuring branch protection for $REPO ($BRANCH)..."
echo ""

# Required status checks — these match the job names in .github/workflows/ci.yml
# If a job is renamed or removed, update this list accordingly.
gh api \
  --method PUT \
  "repos/$REPO/branches/$BRANCH/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Format Check",
      "Lint",
      "Type Check",
      "Build",
      "Physics Tests (Ratchet)",
      "Unit Tests",
      "E2E Tests"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "required_conversation_resolution": false
}
JSON

echo ""
echo "Branch protection configured successfully!"
echo ""
echo "Rules applied:"
echo "  - Required status checks (strict mode): Format Check, Lint, Type Check,"
echo "    Build, Physics Tests (Ratchet), Unit Tests, E2E Tests"
echo "  - Require at least 1 approving review (stale reviews dismissed)"
echo "  - Enforce for administrators"
echo "  - Force pushes: BLOCKED"
echo "  - Branch deletion: BLOCKED"
echo ""
echo "To verify, run:"
echo "  gh api repos/$REPO/branches/$BRANCH/protection"
