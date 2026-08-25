---
name: ci-cd
description: Catalog skill — pipelines, caches, required checks, artifacts. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "changing how the repo builds, tests, or deploys in CI"
---

# ci-cd

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Read the current pipeline file end to end before changing it — know which jobs are required-for-merge (branch protection) vs. advisory, and which run on which triggers (PR, push to main, tag, schedule).
2. Change the fewest jobs necessary; a "quick CI fix" that reorganizes a dozen unrelated jobs makes the actual fix impossible to review and the failure mode impossible to bisect later.
3. Verify what the change actually runs, not what you intended: a glob meant to match `test/**/*.test.js` that doesn't match nested directories will silently skip tests, and CI will still go green.
4. Check cache correctness, not just cache existence: a cache keyed only on branch name (not on a lockfile hash) serves stale dependencies after a lockfile bump, and no one notices until a bug reproduces only in CI.
5. If you're touching required checks, confirm the branch protection rule references the job by its exact name — renaming a required job silently removes the gate; the PR shows green because the now-nonexistent named check simply never reports.
6. Test the failure path deliberately: intentionally break something the pipeline should catch, and confirm it actually fails red, not just that the happy path is green.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The pipeline passed, so the change is correct" | A pipeline can pass while silently not running the tests you think it's running — glob mismatches, skipped stages, and cache staleness all produce a green check with no coverage. Passing is not the same as having been exercised. |
| "I renamed the job, obviously the branch protection still applies" | Branch protection matches on job name as a string. A rename is a silent, unannounced removal of that gate until someone manually updates the protected-branch settings to match. |
| "Caching will just make it faster, no real risk" | A cache keyed wrong doesn't fail loudly — it serves stale artifacts that pass tests written against the old dependency version, a correctness bug wearing a performance optimization's clothes. |
| "We can clean up the unrelated jobs while we're in here" | Every unrelated change in a CI diff is something the reviewer now has to separately verify didn't break an unrelated pipeline; scope creep here is expensive precisely because CI failures are hard to bisect across a large diff. |

## Red Flags

- A test glob change with no confirmation of the before/after file count matched
- Cache key that doesn't include a lockfile or dependency-manifest hash
- A required-check rename with no corresponding branch-protection update
- No deliberate "does this actually fail red" check before merging

## Done when

The exact set of affected files/jobs is known and minimal, the cache key is provably tied to what invalidates it, required-check names in branch protection still match, and a deliberate failure case confirmed the pipeline still catches what it's supposed to.
