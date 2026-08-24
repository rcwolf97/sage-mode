---
name: sage-unsafe
description: One-turn escape hatch for sage-careful. Writes .sage/unsafe and logs the reason.
disable-model-invocation: true
---

# sage-unsafe

Escape hatch for the `sage-careful` `beforeShellExecution` guard. Writes `.sage/unsafe`; `sage-careful` checks for that file before it evaluates the *next* shell command, consumes it (deletes it), and lets that one command through. Every command after that is checked normally again — this authorizes exactly one command, not the rest of the session.

## Procedure

1. **Require a real, specific reason.** `<reason>` is not optional. If `/sage-unsafe` was invoked with no reason, or a placeholder like "testing", stop and ask for a specific one before writing anything — the reason is the entire audit trail for a command that skipped the safety guard, and a vague one makes that trail useless.
2. **Check whether `.sage/unsafe` already exists first.** If it does, an earlier escape-hatch call was never consumed — either no shell command has run since, or a prior session ended before the hook fired. Don't silently overwrite it: surface the existing reason to the user and confirm before replacing it, since overwriting without asking risks authorizing a different command than the one the earlier reason justified.
3. **Write the token:** `sage unsafe <reason>` — let the CLI own the file format.
4. **Log it.** If a sprint is active, the reason is appended to `ledger.md`. If no sprint is active, the token is still written and still logged by `sage-careful` when it fires, but there's no ledger entry to append to.
5. **Tell the user plainly** which single command this now authorizes, and that the exemption expires the instant that command runs (or is superseded by a different shell call before it does).

## Common Rationalizations
| Rationalization | Reality |
|---|---|
| "I'll just disable the hook" | Not what this does, and not available. The hatch authorizes one command, one time — not a persistent bypass. |
| "The reason can be generic, it's just for the log" | The reason is the only audit trail for a command that bypassed the safety guard. A vague reason makes that trail worthless later. |
| "There's already a token, I'll just overwrite it" | An unconsumed token means a prior authorization was never used. Overwriting it without asking risks approving the wrong command, or losing track of what was actually reasoned about. |

## Red Flags
- Empty or placeholder reason ("just because", "testing")
- `.sage/unsafe` already present and overwritten without surfacing that to the user
- The hatch reached for routinely on destructive-command shapes rather than as a rare, explained exception
- Anyone treating the hatch as covering more than the single next command

## Done when
`.sage/unsafe` holds a real, specific reason, that reason has been shown to the user and logged wherever a ledger exists, and the user understands the exemption covers exactly the next shell command.
