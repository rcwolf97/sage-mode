---
name: sage-ship
description: Cite fresh evidence, changelog, open a PR. Do not merge. Do not deploy.
disable-model-invocation: true
---

# sage-ship

## Procedure

1. `sage evidence check` for every required label. **FRESH → cite the record and do not re-run.** STALE → re-run. Refuse to open a PR on stale evidence.
2. Confirm every ledger node is `done`, and every CRITICAL finding is fixed or has an explicit user decision.
3. Bump version, generate changelog from node reports and the sprint spec.
4. Open the PR via `gh` (if missing, print the PR body and stop). Embed: sprint goal, items with done-conditions, review summary with confidence bands, links to evidence, **residuals**.
5. **Stop.** No merge, no deploy.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Tests passed earlier today" | Freshness is the wtree, not the clock. Check, then cite. |
| "I'll merge it, the user asked to ship" | Ship opens a PR. The user merges. The user deploys. |
| "Residuals can live in the chat" | A residual must reach a durable sink (the PR) before the run reports done. |
| "CRITICAL is accepted implicitly" | CRITICAL needs an explicit user decision recorded. |

## Red Flags

- PR opened on STALE evidence
- Merge or deploy attempted
- Residuals omitted
- gh missing and PR body not printed

## Done when

PR is open (or body printed) containing findings, evidence links, and residuals; no merge; no deploy.
