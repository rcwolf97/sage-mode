---
kind: idea
concept: savereviewstate-writer
posture: ship
verdict: build-smaller
verified: false
date: 2026-08-31
---

# Should `saveReviewState`'s writer be wired now, or should the dead code be deleted?

## Question

`plugin/lib/review/index.ts:269` defines `saveReviewState(sprint, state, root)` for cross-run review-finding dedup. `plugin/lib/cli.ts:436-438,467-469` calls `loadReviewState` + `applyCrossRunDedup` (the read side) — but nothing in `lib/`, `test/`, `skills/`, `commands/`, or `agents/` ever calls `saveReviewState` (the write side). The state file it reads from (`.sage/sprints/NN/review-state.json`) is therefore permanently absent in practice, and cross-run dedup is a fully-tested no-op. A second function, `shouldRedTeam` (`:491`), is defined, tested nowhere, and referenced nowhere — fully dead.

## Recall

- `sage recall "cross-run review dedup" --kind out-of-scope` -> no results (never previously rejected).
- `sage recall "cross-run review dedup" --kind learning` -> no results (no prior retro flagged this).

No prior verdict exists to inherit; this is a first pass.

## Premise challenge (degraded -- see note)

`sage consult --role product --brief <brief>` was attempted and did not return usable output in this environment: `node lib/cli.js consult --role product --brief brief.md` exited 2 with empty stdout/stderr under `timeout 100`. The `claude` binary reachable from this sandbox is a restricted stub ("only `claude -p \"<prompt>\"` is supported in this environment") that is very likely not the same authenticated CLI `consult()` expects on the machine where sage-mode actually runs -- this is an environment boundary, not a code bug in `consult()` itself, and it was not debugged further here since it isn't this idea's subject.

Per `consult()`'s own documented degraded path ("claude CLI absent -- fall back to Lane A: product role reasons in-thread"), the premise challenge below was done in-thread, not via a verified external consult. **`verified: false`** is recorded honestly, per this skill's own red-flag rule, rather than implied.

In-thread premise challenge: is this worth a ship decision at all, or is it scope creep? -- No user-visible behavior depends on either function today; nothing crashes or lies as a result of the gap. That argues against blocking a ship decision on it. But `saveReviewState` is not speculative -- it already has a tested, waiting consumer (`applyCrossRunDedup` + `loadReviewState`) and a designed call site (end of `sage review gate`'s CLI handler, after gate/dedup produce a state to persist); wiring it is a same-file, few-line change with an existing test harness to lock it down, not new design. `shouldRedTeam` has no equivalent waiting consumer anywhere in the corpus -- it reads as either an abandoned direction or a stub for work that was never scoped. Treating both the same way (wire both, or delete both) would either under-invest in a designed-and-nearly-finished feature or over-invest in reviving something with no evidence anyone still wants it.

## Verdict: build-smaller

Wire the missing `saveReviewState` call into `sage review gate`'s CLI path (the one call site `applyCrossRunDedup`'s tests already assume exists) -- small, same-file, matches existing test coverage. Delete `shouldRedTeam` rather than build toward it; nothing in the skill or command corpus names a caller it was meant to have, and reviving dead code on spec is exactly the kind of unvalidated feature-building this whole ship-readiness pass exists to stop doing.

**Assignment:** wire `saveReviewState` into `sage review gate`'s handler in the same change that fixes the `hooks/sage-careful` `git -C <path> push --force` escape -- both are small, both have existing tests to run against, do them together rather than as separate passes.

## Correction, recorded during the /sage-fix attempt

The Assignment above ("wire `saveReviewState` into `sage review gate`'s handler ... small, same-file change") was wrong, and phase 2 of `/sage-fix` (root-cause) caught it before any code was written on that half: `gate()` has no per-finding `disposition: "skipped"|"fixed"` to write — that value is a human/agent judgment made when a review cycle *closes*, not something `gate()` computes. There is no existing call site to wire; a real fix needs a new disposition-capture step (e.g. a `sage review disposition <fingerprint> --skip|--fix` command, or a step inside `sage-retro`/`sage-ship` that walks open findings and asks) before `saveReviewState` has anything correct to persist. That is new design, not a two-line wire-up, and it does not belong in a "minimal fix" pass.

Verdict stands as **build-smaller**, revised: `shouldRedTeam` was deleted (`lib/review/index.ts`, confirmed zero callers before removal, `npm run build` + `npm test` clean afterward — 298/298 non-skipped passing). `saveReviewState`'s writer is **not** wired this pass; it is correctly out of scope until the disposition-capture mechanism it depends on is itself designed and prioritized — filing that as its own future idea rather than silently reopening it here.
