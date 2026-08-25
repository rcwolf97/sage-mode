---
name: dead-code
description: Catalog skill — unreachable exports, unused flags, deleted callers. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "removing code that is no longer executed"
---

# dead-code

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Confirm reachability from real runtime entry points — routes, cron schedules, CLI commands, message consumers — with a call-graph or reference search, not just "no import found in this file's neighborhood."
2. For exported symbols, separate "unused in this repo" from "unused anywhere": check a monorepo-wide index or downstream package consumers before treating a public export as dead.
3. For a feature flag's dead branch, confirm the flag is at 100% and has been stable across every environment (including long-lived clients or cached config) before deleting the branch it guards — then delete the flag check and the branch together, not one and not the other.
4. Delete callers before callees: remove the call site first, and only delete the callee once it genuinely has zero remaining callers, so a dynamically-typed language doesn't leave a dangling reference to an undefined symbol.
5. Check test files and fixtures separately from production code — a test can be the last caller of a production path, which makes coverage look green while the path is dead at runtime.
6. Land the deletion as one isolated, reviewable commit rather than folding it into an unrelated feature branch, so a future bisect can attribute a regression to "removed X" cleanly.
7. Run a full build/typecheck/test pass after deletion — this is what catches a dynamic reference (reflection, string-based routing, dynamic import) that static reachability analysis missed.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Zero references in this repo, safe to delete" | Zero local references doesn't mean zero external callers for a published or exported symbol — check downstream consumers, not just this repo's grep results. |
| "The flag's rollout is basically done" | "Basically 100%" still has stragglers on old client versions or cached config; deleting the guarded branch before every environment confirms migration takes out whichever surface hasn't caught up. |
| "The static analyzer flagged it as unused" | Most dead-code tools miss reflection, dynamic dispatch, and string-based route or plugin registration — a common source of false positives that break a path invoked by name at runtime. |
| "Tests still pass after I deleted it" | Passing tests only prove the paths the tests exercise; a path only hit by a rare production input has no test to notice its removal. |

## Red Flags

- Deleted symbol is exported from the package's public API surface
- A flag's dead branch removed without confirming 100% rollout in every environment
- Reachability check was run once, long ago, and not re-verified before deleting
- No build or typecheck pass after deletion — silent runtime failure on a dynamic reference

## Done when

Reachability is confirmed against real entry points, not just a local unused-import lint, the deletion lands as one isolated commit, and a full build/typecheck/test run is green afterward.

