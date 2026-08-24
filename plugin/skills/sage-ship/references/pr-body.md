# PR body template

**Trigger:** load this while assembling the PR body in step 4 of `SKILL.md`,
or when it's unclear whether something belongs in the residuals section.

## Layout

```markdown
## Sprint goal
<one sentence, from the sprint spec>

## Shipped
- <item>: <done-condition>, confirmed by <evidence link>
- <item>: <done-condition>, confirmed by <evidence link>

## Review summary
<confidence-band counts, e.g. "3 findings ≥7, 1 at 5-6, 2 in appendix">
Full review: <link to docs/sprints/NN/review.html>

## Evidence
- suite: FRESH, <evidence.jsonl line / timestamp>
- typecheck: FRESH, <...>
- viewports: FRESH, <...>
- a11y: FRESH, <...>

## Residuals
- <finding summary> (confidence N, <category>) — accepted: <why>
- <finding summary> (confidence N, <category>) — deferred to <next sprint / follow-up node>: <why>
```

## What counts as a residual

Any finding from review or verify that is real (survived the confidence
gate) and did **not** get fixed before shipping — whether because the user
explicitly accepted the risk, or because it was deliberately deferred to a
later sprint. Both need a stated reason; "not fixed" alone is not a residual
entry, it's a missing decision (see `SKILL.md` step 2 — that blocks ship
entirely if the finding was CRITICAL).

A residual that never makes it into the PR body — mentioned only in chat, or
only in the ledger's Rulings section — has not reached a durable sink. The
ledger is internal machine state under `.sage/`, gitignored; the PR is the
externally visible, durable record. Both should agree, but the PR is the one
that counts for "did the run report itself done correctly."

## Worked example

> ## Residuals
> - Rate-limit key still falls back to `req.ip` when no API key is present
>   (confidence 6, security) — accepted: matches existing behavior on every
>   other endpoint in this service; tracked as a cross-cutting fix, not
>   sprint-03 scope.
> - `getOrderLineItems` still issues one query per line item under 50+ items
>   (confidence 5, performance) — deferred to sprint 04: no customer currently
>   has an order that large, and the eager-load rewrite is bigger than this
>   sprint's budget.

Both entries name a concrete reason and, where relevant, where the follow-up
lives. Neither reads as "we didn't get to it."
