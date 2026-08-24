# What makes a spec item actually observable

Load this when drafting per-item done-conditions or non-goals in step 7-8 of
`SKILL.md`, and a wording keeps drifting back toward "works," "correctly," or
"as expected."

## Done-conditions: bad vs good

The test is: could two different people, checking the same running system,
disagree about whether this item is done? If yes, it isn't written tightly
enough yet.

| Bad (not observable) | Good (observable) |
|---|---|
| "Rate limiting works" | "A client sending more than 100 requests/minute/key receives HTTP 429 with a `Retry-After` header." |
| "Search is fast" | "A search over the demo dataset (10k rows) returns in under 300ms p95, measured by `sage evidence run --label search-perf -- <bench cmd>`." |
| "Users can export their data" | "`GET /export` streams a CSV containing every row the user owns, verified by a fixture user with 3 rows across 2 tables." |
| "Errors are handled gracefully" | "A malformed webhook payload returns 400 with `{error: 'invalid_signature'}` and is logged with the payload hash, not the raw body." |
| "The dashboard looks right" | "The dashboard renders the same three widgets in the same order for a fixture account, screenshot-diffed against `baseline.png`." |

The pattern: name the input, the exact system response, and — where relevant —
the command or check that proves it. This is the same standard `/sage-dag`'s
D4 invariant enforces mechanically on acceptance criteria (it rejects the bare
substrings "works", "correctly", "properly", "as expected"), so writing it
tight here means the Architect doesn't have to rewrite it during decomposition.

## Non-goals: what actually needs stating

Not every possible feature needs a non-goals line — that would be an infinite
list. State a non-goal when:

- A reasonable reader of the goal would assume it's included (e.g. a "billing"
  sprint that does not do proration needs that said explicitly).
- The team discussed and rejected an approach — write down what was rejected,
  not just what was chosen, so it isn't re-litigated mid-sprint.
- A candidate got cut from this sprint for priority reasons, not because it's
  wrong — say when it's expected to land, or say "not scheduled."

## Risks: what "named" means

A risk line without an owner is a hope, not a risk record. Every risk needs:
one sentence naming the failure mode, and a name (a role or a specific person)
who is responsible for watching for it during the build. "The Architect flags
this in the DAG's risk field" counts as an owner; "someone should check" does
not.
