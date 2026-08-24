# The WTF-likelihood circuit breaker — worked example and rationale

Load this when the score is climbing toward the stop threshold, when deciding
whether to override a stop, or when it's unclear why a specific signal is
weighted the way it is.

## Why mechanical signals, not judgment

The score in `SKILL.md` step 6 is deliberately built only from countable
facts — reverts, files touched per fix, fix count, out-of-lane touches. None
of it asks "does this feel like it's going off the rails," because that
question is exactly the one an agent under time pressure will answer wrong in
its own favor. A purely mechanical score can't be argued down by the same
process it's meant to catch.

## Why each signal is weighted the way it is

- **Revert (+15), the heaviest single signal.** A revert means a fix already
  landed and then had to be undone — the most direct evidence available that
  a "done" claim was wrong. Three reverts alone crosses the stop threshold,
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
