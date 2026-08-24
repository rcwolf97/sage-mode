---
name: sage-status
description: Show active sprint and the next ledger action.
disable-model-invocation: true
---

# sage-status

## Procedure

1. Determine the active sprint: use `SAGE_SPRINT` from the environment if `sage-bootstrap` set it this session; otherwise let `sage status` resolve it from `.sage/sprints/`. If no ledger exists under `.sage/sprints/` at all, report "no active sprint" and stop — don't infer one from chat history or from `docs/roadmap.md`.
2. Run `sage status` and `sage board next`. `board next` returns `{ action, nodes }` computed purely from the ledger and git state: `dispatch` (nodes ready to hand to implementers), `join` (a wave finished, integration verify pending), `rule` (a blocker needs a ruling), `review` (nodes waiting on review), or `done` (sprint complete).
3. Report: sprint id, current wave, the action and its nodes, and any node in `blocked` status by name — surface blocked nodes even when the headline action is something else.
4. Never report `done` while any node is `blocked`, `in-review`, or missing `verify: PASS`. Read the actual per-node status column; don't infer completion from the action alone.

## Common Rationalizations
| Rationalization | Reality |
|---|---|
| "I'll infer status from chat history" | Status lives in the ledger — the one thing designed to survive `/clear`. Chat history is not the source of truth. |
| "The action says 'review', close enough to done" | `review` and `done` are different ledger states. Report what's actually there. |

## Red Flags
- Reporting `done` when any node is `blocked` or `in-review`
- Answering from memory of an earlier turn instead of re-running `sage status`
- Dropping blocked nodes from the report because the headline action is something else

## Done when
The active sprint, current wave, the next action from `sage board next`, and every blocked node are shown — or an explicit "no active sprint" if none exists.
