# The WTF-likelihood circuit breaker — worked example and rationale

Load this when the score is climbing toward the stop threshold, when deciding
whether to override a stop, or when it's unclear why a specific signal is
weighted the way it is.

## Why mechanical signals, not judgment

The score in `SKILL.md` step 6 is deliberately built only from countable
facts — reverts, files touched per fix, fix count, findings severity,
out-of-lane touches. None of it asks "does this feel like it's going off the
rails," because that question is exactly the one an agent under time pressure
will answer wrong in its own favor. A purely mechanical score can't be argued
down by the same process it's meant to catch.

Concretely, this is `computeWtf` in `lib/board/index.ts`: a pure function of
a `WtfSignals` struct, so it can be unit-tested with hand-built counts the
same way `lib/dag/index.ts`'s `globIntersect` is tested against explicit
`treePaths` instead of a real checkout. `deriveWtfSignals` is the part that
touches a real sprint — it counts revert commits and per-fix file counts from
`git log`/`git diff-tree` on each node's own branch, checks each touched file
against that node's `owns` globs from `dag.json` for the out-of-lane signal,
and reads `findings.jsonl` for the Low-severity signal. **None of those three
sources is the build-loop agent describing its own work** — git history and
`dag.json` are structural facts, and `findings.jsonl` is the *reviewer's*
structured output about the code, not the implementer's narrative about
itself. That last distinction matters: the old implementation's failure
wasn't "an LLM was involved somewhere upstream of the number," it was that
the same agent being graded was the one filling in the grade. Swapping in a
different subagent's structured, schema-conformant output is not that
failure mode.

## Why each signal is weighted the way it is

- **Revert (+15), the heaviest single signal.** A revert means a fix already
  landed and then had to be undone — the most direct evidence available that
  a "done" claim was wrong. Two reverts alone crosses the stop threshold,
  which is intentional: a sprint reverting its own fixes repeatedly is
  thrashing, not converging.
- **A fix touching more than 3 files (+5).** Not a hard rule that fixes must
  stay small — some genuinely need to touch several files. It's a proxy for
  "this fix is reaching outside where the bug actually was," which correlates
  with scope creep even when each individual instance is defensible.
- **After the 15th fix, +1 each (+1 per fix past 15).** A sprint that needed
  15 fixes to converge is already unusual; every fix past that point is
  weighted as a small, accumulating sign that the underlying issue isn't a
  fix problem but a plan or approach problem.
- **All remaining findings are Low severity (+10).** Sourced from
  `findings.jsonl`'s `NITPICK` band — this schema's lowest tier, and the
  mechanical stand-in for "Low" (see `lib/review/index.ts`'s `Finding`
  type). This is not a penalty for having nitpicks; it fires only when
  *everything left* is a nitpick, which is the moment a fix loop has stopped
  fixing bugs and started grinding on cosmetics. That's autonomous-continue
  territory turning into "is this worth the tokens," which is exactly the
  kind of call this mechanism exists to surface rather than let the loop
  decide for itself. It requires at least one recorded finding — an empty or
  missing `findings.jsonl` is "no data" and contributes nothing, never "all
  Low" by default.
- **Touching a file outside any node's `owns` (+20), the single largest
  signal.** This is the lane boundary being crossed entirely outside the
  amendment process — by construction it should never happen if blockers are
  being written correctly, so a single occurrence is treated as seriously as
  more than one revert.

## Worked example

A sprint with 4 nodes hits, over its build:

1. Node `n2`'s reviewer finds 2 issues; both fixed within the node's own
   files. Score: 0.
2. Join after wave 1 surfaces an integration failure; the fix touches 5 files
   across two nodes' worktrees to reconcile an interface mismatch. Score: +5
   → **5**.
3. That fix, on re-verify, breaks a different node's tests; it's reverted.
   Score: +15 → **20**.
4. A follow-up fix for the same interface mismatch touches 2 files (under the
   3-file threshold) and passes. Score unchanged → **20**.
5. A fifth, unrelated fix on a different node touches a config file that
   isn't in any node's `owns` — a genuinely small change, but outside every
   lane. Score: +20 → **40**.

At step 5 the sprint should have stopped **before** landing that fix — the
score was already at 20 after step 3, sitting exactly at the threshold, and
the out-of-lane touch alone would have pushed it well past 20. The correct
behavior at step 3 was to show the user the revert and the fix history and
ask whether to continue, not to keep going because the score hadn't yet
crossed the line. When a signal at the threshold and a new event both land in
the same turn, evaluate the score before acting on the event, not after.

## What "ask whether to continue" should show

Not just the number — the decision brief at a >20 stop should show: which
nodes triggered which signals, the current state of the branch (what's
`done`, what's mid-fix), and a specific recommendation (continue with a
narrower plan, pause and replan the remaining nodes, or stop and hand back
what's been built so far). A bare "score is 24, continue? y/n" doesn't give
the user enough to decide well.

## The hard cap is not a target

50 fixes per sprint is a backstop for a sprint that somehow never crosses the
>20 threshold — e.g. many small, cheap, in-lane single-file fixes that never
individually trip a signal. It should essentially never be reached in
practice; reaching it without an earlier >20 stop is itself worth noting as a
gap in the scoring, not treated as proof the sprint was healthy the whole way.
