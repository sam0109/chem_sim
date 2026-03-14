# ChemSim — Agent Workflow

This document defines the process by which an AI agent claims, plans, implements, reviews, and closes a GitHub issue. The workflow is designed to be **global and idempotent** — multiple agents can operate concurrently without conflicts.

---

## Prerequisites

- The agent has access to `gh` CLI (authenticated)
- The agent can run terminal commands, read/write files, and create git branches
- The repo is at `sam0109/chem_sim`
- All work happens on feature branches, never directly on `main`

---

## Step 0: Select and Claim an Issue

**Goal:** Pick an unassigned issue and atomically claim it so no other agent works on it.

```bash
# 1. List unclaimed issues (no assignee), sorted by priority label
gh issue list --assignee "" --limit 20 --json number,title,labels

# 2. Pick the highest-priority unclaimed issue
#    Priority order: guardrails > P1 > P2 > P3 > P4 > P6 > P5

# 3. Claim it by self-assigning (idempotent — safe if already assigned to you)
gh issue edit <NUMBER> --add-assignee "@me"

# 4. Verify you got it (another agent may have claimed it in the same instant)
ASSIGNEE=$(gh issue view <NUMBER> --json assignees -q '.assignees[0].login')
if [ "$ASSIGNEE" != "<your-username>" ]; then
  echo "Issue was claimed by $ASSIGNEE — pick another"
  exit 1
fi

# 5. Add "in progress" label
gh issue edit <NUMBER> --add-label "in progress"
```

**Idempotency:** If the issue already has an assignee that isn't you, skip it and pick another. The assign + verify pattern prevents race conditions.

---

## Step 1: Write and Post a Plan

**Goal:** Break the issue into small, concrete, verifiable steps. Post the plan to the issue as a comment before writing any code.

### Plan requirements:
- Each step must be completable in isolation (no step depends on uncommitted work from another step)
- Each step must have a **verification criterion** — how you'll know it's done
- Steps should be ordered: data/types first, engine logic second, tests third, UI last
- Include a "Step 0: Understand the current code" that lists which files you'll read
- Include a final step for running the full test suite

### Template:

```markdown
## Implementation Plan

**Issue:** #<NUMBER> — <title>
**Branch:** `<number>-short-description`

### Steps

- [ ] **Step 0 — Context gathering**
  Read: <list of files to understand>
  Verify: Can describe the current behavior and what needs to change

- [ ] **Step 1 — <concrete change>**
  Files: <which files are created or modified>
  Verify: <how to check this step worked — a specific test, a command, or an assertion>

- [ ] **Step 2 — <concrete change>**
  Files: ...
  Verify: ...

...

- [ ] **Step N — Run full test suite**
  Command: `npx tsx src/engine/tests.ts`
  Verify: No regressions — passing count >= previous count
  Command: `npx vite build`
  Verify: Clean build, no errors

### Risks / Open Questions
- <anything uncertain that might change the plan>
```

### Post it:

```bash
gh issue comment <NUMBER> --body "<plan markdown>"
```

---

## Step 2: Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b <NUMBER>-short-description
# Example: git checkout -b 3-double-bond-params
```

**If using git worktrees (recommended for concurrent agents):**

Each agent should work in its own worktree so multiple agents can operate on different branches simultaneously without interfering with each other's working directory.

```bash
# From the main repo directory, create a worktree for this issue
git worktree add ../chem_sim-<NUMBER> -b <NUMBER>-short-description main

# Enter the worktree
cd ../chem_sim-<NUMBER>

# Install dependencies (each worktree needs its own node_modules)
npm install
```

When done (after merge), clean up the worktree:
```bash
cd ../chem_sim
git worktree remove ../chem_sim-<NUMBER>
```

---

## Step 3: Implement — One Step at a Time

For each step in the plan:

1. **Mark the step in-progress** (update your local tracking)
2. **Make the change** — edit files, create files, run commands
3. **Verify the step** — run the specific verification from the plan
4. **Commit with a descriptive message** referencing the issue:
   ```bash
   git add -A
   git commit -m "<step description> (#<NUMBER>)"
   ```
5. **Mark the step complete**

### Rules during implementation:
- **One concern per commit.** Don't mix refactoring with new features.
- **Run physics tests after every engine change:** `npx tsx src/engine/tests.ts`
- **Run type check after every change:** `npx tsc --noEmit`
- **Never weaken a test tolerance to make your change pass.**
- **If you discover out-of-scope work**, note it — you'll create a follow-up issue in Step 7.

---

## Step 4: Push and Open a Pull Request

```bash
git push -u origin <NUMBER>-short-description

gh pr create \
  --title "<Issue title> (#<NUMBER>)" \
  --body "Closes #<NUMBER>

## Summary
<1-3 sentence description of what changed and why>

## Changes
- <bullet list of what was added/modified/removed>

## Test Results
- Physics tests: X/Y passing (was A/B before)
- Build: clean
- Type check: clean

## PR Checklist

### Purpose
- [ ] This change contributes toward a stated goal (issue #<NUMBER>)
- [ ] Specific improvement addressed: <name it>

### Physics Accuracy
- [ ] If force computation changed: gradient test still passes
- [ ] If integrator changed: NVE energy conservation tests still pass
- [ ] New potential/force has a gradient consistency test
- [ ] No physics test tolerance was weakened

### Code Quality
- [ ] No \`any\` types introduced
- [ ] No \`console.log\` in production code
- [ ] No duplicated logic
- [ ] Functions < 50 lines where possible
- [ ] Constants cite their source

### Testing
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Tests would FAIL if the feature were broken
- [ ] Tests are not tautological

### Performance
- [ ] No unnecessary O(N^2) in hot loops
- [ ] No per-frame allocations in hot paths

### Documentation
- [ ] README.md updated if public API/usage changed
- [ ] Complex algorithms have inline comments

### Follow-ups
- [ ] Follow-up issues created for out-of-scope work discovered during implementation
"
```

---

## Step 5: Sub-Agent Review

Spawn a sub-agent to review the PR. The reviewer agent must:

### Review process:

1. **Read the diff:**
   ```bash
   gh pr diff <PR-NUMBER>
   ```

2. **Check physics first:**
   - Do the equations match cited formulas?
   - Are units consistent (eV, Å, fs, amu)?
   - Would a chemist agree with the result?

3. **Check test quality:**
   - Do tests actually test the claimed behavior?
   - Would they fail if the feature were removed?
   - Are the tolerances physically justified?

4. **Check architecture:**
   - Does engine code import from renderer/UI? (reject)
   - Are there magic numbers without comments? (reject)
   - Is there duplicated logic? (request refactor)

5. **Run the tests locally:**
   ```bash
   git checkout <branch>
   npx tsx src/engine/tests.ts
   npx vite build
   ```

6. **Post review as a PR comment:**
   ```bash
   gh pr review <PR-NUMBER> --approve --body "<review summary>"
   # OR
   gh pr review <PR-NUMBER> --request-changes --body "<issues found>"
   ```

### If changes requested:
- The implementing agent addresses each comment
- Pushes fixes as new commits
- Re-requests review

---

## Step 6: Merge

Once the PR is approved and all checks pass:

```bash
gh pr merge <PR-NUMBER> --squash --delete-branch
```

Use squash merge to keep `main` history clean. The squash message should be:
```
<Issue title> (#<NUMBER>)
```

---

## Step 7: Reflection and Closure

**Goal:** Capture what went well and what went poorly so the workflow improves over time.

### Post a reflection comment on the issue:

```markdown
## Reflection

### What went well
- <bullet points — e.g., "Plan was accurate, no steps needed to be added mid-implementation">
- <e.g., "Gradient test caught a sign error before it reached main">

### What went poorly
- <bullet points — e.g., "Step 3 was too large — should have been split into two steps">
- <e.g., "Spent 30 minutes debugging a unit conversion that should have been caught by reading the existing code more carefully in Step 0">

### Lessons for future agents
- <actionable advice — e.g., "Always run the debug harness (npx tsx src/engine/debug.ts) before and after engine changes, not just the test suite">
- <e.g., "When adding a new force function, write the gradient test FIRST, then implement the force">

### Metrics
- **Plan accuracy:** X of Y steps completed as written (Z added, W removed)
- **Test impact:** Physics tests went from A/B to C/D passing
- **Review rounds:** N (1 = approved first time)
- **Follow-up issues created:** <list issue numbers or "none">

### Time estimate vs actual
- Estimated: <X steps, roughly Y complexity>
- Actual: <what happened>
```

### Close the issue:

```bash
gh issue close <NUMBER> --comment "<reflection markdown above>"
```

### Create follow-up issues (if any):

Before creating a follow-up issue, **check that it doesn't duplicate or overlap with an existing issue:**

```bash
# 1. Search existing issues for related keywords
gh issue list --limit 100 --json number,title,labels --jq '.[] | "\(.number) \(.title)"' | grep -i "<keyword>"

# 2. If a matching issue exists, comment on it instead of creating a new one
gh issue comment <EXISTING-NUMBER> --body "Additional context from #<YOUR-NUMBER>: <what you discovered>"

# 3. Only create a new issue if no existing issue covers this work
gh issue create --title "<follow-up title>" --label "<appropriate label>" --body "Discovered during #<NUMBER>. <description>"
```

**Rules for follow-up issues:**
- Search existing issues by keyword before creating. If in doubt, don't create — comment on the closest existing issue instead.
- Never create an issue that is a subset of an existing issue. Add a comment to the existing issue noting the new detail.
- If the follow-up overlaps partially with an existing issue, reference both in the new issue body and explain what is distinct.

---

## Workflow Summary

```
┌─────────────────┐
│ 0. Claim issue   │ ← gh issue edit --add-assignee + verify
└────────┬────────┘
         ▼
┌─────────────────┐
│ 1. Write plan    │ ← Post to issue as comment
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. Create branch │ ← git checkout -b <N>-description
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. Implement     │ ← One step at a time, commit per step
│    (loop)        │    Run tests after each engine change
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. Push + PR     │ ← gh pr create with checklist
└────────┬────────┘
         ▼
┌─────────────────┐
│ 5. Sub-agent     │ ← Review diff, physics, tests, architecture
│    review        │    Approve or request changes
└────────┬────────┘
         ▼
┌─────────────────┐
│ 6. Merge         │ ← gh pr merge --squash
└────────┬────────┘
         ▼
┌─────────────────┐
│ 7. Reflect +     │ ← Post reflection, close issue,
│    close         │    create follow-up issues
└─────────────────┘
```

---

## Concurrency Rules

- **One agent per issue.** The assign-and-verify pattern in Step 0 prevents duplicates.
- **Multiple agents can work in parallel** on different issues — they're on separate branches.
- **If two PRs conflict**, the second to merge must rebase onto the updated `main` and re-run tests before merging.
- **The physics test ratchet applies**: if your PR causes a previously-passing physics test to fail, it cannot merge, period. Fix the regression or revert.

---

## Labels Reference

| Label | Meaning |
|-------|---------|
| `in progress` | An agent has claimed and is actively working on this |
| `P1: critical physics` | Missing physics causing incorrect behavior |
| `P2: accuracy` | Accuracy improvements to existing physics |
| `P3: feature` | New feature additions |
| `P4: tech debt` | Known bugs and technical debt |
| `P5: ambitious` | Big-dream features |
| `P6: education` | Educational features (physically grounded) |
| `guardrails` | CI, testing, process infrastructure |
