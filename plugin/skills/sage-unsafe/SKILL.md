---
name: sage-unsafe
description: One-turn escape hatch for sage-careful. Writes .sage/unsafe and logs the reason.
disable-model-invocation: true
---

# sage-unsafe

`sage unsafe <reason>`. The careful hook consumes and deletes the token. Log the reason on the ledger if a sprint is active.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll just disable the hook" | The hatch is one turn. Persistent disable is not allowed. |

## Red Flags

- Empty reason
- Using unsafe to rm -rf /

## Done when

Token written with a reason the user can audit.
