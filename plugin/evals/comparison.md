# Comparison eval (v1 gate)

**Status: run 2026-08-31 against this repo, not a billed A/B.** There is no second arm with a plain Cursor agent on the same fixture and a usage/cost line. Treat the numbers below as the first real use of sage-mode (the ship-tech-spec integration), not as a controlled experiment. A bad result is included.

```
date: 2026-08-31
fixture: sage-mode itself (ship-tech-spec integration, Phases 0–8)
sage_wall_clock: this session (not a calendar week; Phase 4 was fired against this tree, not a separate product)
plain_wall_clock: not run
sage_tokens_by_lane: { A: unmetered Cursor parent, B: not invoked live, C: Task enum only — plugin cards never appeared }
plain_tokens: not run
defects_found_review: mechanical — missing slice on eval DAG fixtures, recall dropping out-of-scope docs from the searchable pool, SPIKE-01 "unregistered" claim that was already false, scorecard "zero lines of code". `sage ground docs/design/two-spines-roadmap.md` flags 12 paths, including the §4.4 `ce-compound` glob that is not in this tree; remaining flags are other-repo cites, Path A `lib/setup/hosts.ts` (correctly absent), and placeholder `.sage/sprints/NN/ledger.md`.
defects_escaped_verify: unknown until `npm run verify` after this landing; Phase 0 heredoc crash was already fixed before this comparison was written
verdict: process overhead is not yet justified by an A/B on defects-escaped. What *is* justified: the harness now fails on empty hook stdout, consult is gated off-network, and `sage ground` / `sage review doc` exist as dogfood. What failed: SPIKE-02 Cursor plugin-shipped model receipts — observed model stays blank on the board. Claude Code plugin-shipped cards FAIL; Path A withdrew the claim rather than shipping a half-port.
```

## Honest bad result

Plugin-shipped role cards did not enter this session's `Task` enum. No host usage/cost line names a plugin `model:` pin on Cursor. Board render says so once at the top. That is a cost-architecture miss, not a documentation miss.

## What was fired on real work (Phase 4 / 8)

- `sage ground` on `docs/design/two-spines-roadmap.md` and `docs/design/ship-tech-spec.md` (dogfood).
- `sage review doc` on the same files (non-blocking skeleton + mechanical ground).
- `/sage-crit`, `/sage-fix`, `/sage-look` exist as command+skill pairs; live specialist dispatch was not billed this session. Mechanical contracts are in tier-3 scenarios 9–11.
- This landing *is* the first sprint. It is not a four-lane parallel build on a customer repo.
