---
name: sage-status
description: Show active sprint and the next ledger action.
disable-model-invocation: true
---

# sage-status

Run `sage status` / `sage board next`. Report sprint, action, nodes.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll infer status from chat history" | Status lives in the ledger. Chat history is not the source of truth. |

## Red Flags

- Reporting done when nodes are blocked
- Ignoring the ledger file

## Done when

The next action from the ledger is shown.
