## Summary

<!-- 1-3 sentence description of what changed and why -->

Closes #<!-- issue number -->

## Changes

<!-- Bullet list of what was added/modified/removed -->

-

## Test Results

- Physics tests: X/Y passing (was A/B before)
- Build: clean / not tested
- Type check: clean / not tested

## PR Checklist

### Purpose
- [ ] This change contributes toward a stated goal (references an issue)
- [ ] Specific improvement addressed: <!-- name it -->

### Physics Accuracy
- [ ] If force computation changed: gradient test still passes
- [ ] If integrator changed: NVE energy conservation tests still pass
- [ ] New potential/force has a gradient consistency test
- [ ] No physics test tolerance was weakened

### Code Quality
- [ ] No `any` types introduced
- [ ] No `console.log` in production code
- [ ] No duplicated logic
- [ ] Functions < 50 lines where possible
- [ ] Constants cite their source

### Testing
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Tests would FAIL if the feature were broken
- [ ] Tests are not tautological

### Performance
- [ ] No unnecessary O(N²) in hot loops
- [ ] No per-frame allocations in hot paths

### Documentation
- [ ] README.md updated if public API/usage changed
- [ ] Complex algorithms have inline comments

### Follow-ups
- [ ] Follow-up issues created for out-of-scope work discovered during implementation
