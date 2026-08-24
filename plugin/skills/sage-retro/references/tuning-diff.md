# Tuning diff: expected shape

**Trigger:** load this while preparing the tuning diff in step 7 of
`SKILL.md`.

## What "a diff" means here

An actual unified diff against the real skill file — the kind `git diff`
would produce — not a paragraph describing the change. The user is
approving a specific edit, not a proposal to edit something later.

```diff
--- a/skills/sage-plan/SKILL.md
+++ b/skills/sage-plan/SKILL.md
@@ ## Common Rationalizations
 | "This is just a bugfix, no spec needed" | A sprint without a spec cannot be verified or shipped. |
+| "The architect consult is slow, I'll size it myself, it's probably simple" | Sprint 06's ledger shows this exact call on node n3 — "probably simple" cost two extra review cycles once the actual complexity surfaced. Consult on anything non-obvious. |
```

## Where the row text comes from

Not invented for the occasion. Step 6 of `SKILL.md` says to pull it from an
actual transcript or blocker text — trace the proposed row back to the
specific node, sprint, and ledger entry that produced it, and say so in the
decision brief presenting the diff, the way the example row above cites
"sprint 06's ledger... node n3." A rationalization row with no traceable
source is exactly the kind of invented content rule 4 of the skill-authoring
rules (§4.6) forbids.

## Gating

The diff goes behind a decision brief (shape defined once in
`rules/sage-conduct.mdc`, not restated here) — options are typically **A)
apply this diff as shown**, **B) apply with an edit**, **C) don't apply, log
the observation without changing the skill**. Never presented as already
applied with an offer to revert; the skill file is unmodified until the user
picks A or B.

## Batch multiple proposed diffs into one call

If a retro surfaces tuning for more than one skill (e.g., a rationalization
row for `sage-plan` and a red-flag addition for `sage-build`), batch every
proposed diff into a single decision call rather than one approval round per
skill file — the same batching discipline `/sage-review` applies to ASK
findings.
