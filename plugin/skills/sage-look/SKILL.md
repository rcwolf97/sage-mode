---
name: sage-look
description: Read-only librarian lookup. No writes, no evidence, no gate.
disable-model-invocation: true
---

# sage-look

Dispatch `librarian` (Lane A) plus `sage recall`. Read-only. No writes, no evidence, no gate, no sprint.

## Procedure

1. Restate the question in one line.
2. `sage recall "<question>"` and `sage recall "<question>" --kind out-of-scope`.
3. Dispatch `librarian` with the question only — never a write tool.
4. Answer from those hits. Stop.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll just edit this file, I already see the bug" | This command does not write. Hand off to `/sage-fix`. |

## Red Flags

- Any Write, Edit, or `sage evidence run`

## Done when

- The user has an answer or a pointer, and the working tree is unchanged.
