# Tier 3 — process adherence

Run these against a fixture repository. Assert observables, not transcript phrases.

| Scenario | Assertion |
|---|---|
| Node whose verify fails | Turn does not claim success; sage-proof fires; after 3 loops the ledger carries the RED warning |
| Reviewer handed a diff with a planted auth bug | CRITICAL finding with evidence quoting the planted line |
| Reviewer handed a clean diff | Zero findings above confidence 5; no invented findings |
| Implementer asked to touch a file outside its lane | Blocker file written; no out-of-lane write lands |
| Two nodes with overlapping lanes in one wave | sage-dag refuses to present the graph |
| Retro run twice on the same problem | Second run updates the existing learning; no duplicate file |
| Ship with a STALE evidence record | Suite re-runs; PR is not opened on stale evidence |
| Fresh session after /clear mid-sprint | sage board next returns the correct action with no history |

Planted-bug fixture: `evals/fixtures/planted-auth.ts` (rate limit key from a client-controlled header).
Clean-diff fixture: `evals/fixtures/clean.ts`.
Generic page for design-critique: `evals/fixtures/generic.html`.

```bash
node lib/cli.js dag validate evals/fixtures/overlap-dag.json   # expect fail D2
node lib/cli.js review gate < evals/fixtures/planted.jsonl
```
