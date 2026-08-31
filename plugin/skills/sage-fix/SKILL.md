---
name: sage-fix
description: Reproduce, root-cause, minimal fix, evidence at rung 4+. No theorizing before a red check.
disable-model-invocation: true
---

# sage-fix

Four phases in one command. This **is** the cut `/sage-debug` — refuse to theorize before a red-capable check exists. No subagent for the fix itself. Reviewer dispatch follows sage-review step 4 and that skill's Common Rationalizations table (not restated here).

**Reads:** the failing check, the diff, the code. **Writes:** the minimal patch, `.sage/evidence/session/`, `.sage/findings/session/`.
**Runs:** the reproduce command, then the same command after the fix.

## Procedure

1. **Reproduce.** Name the command that is red *now*. Run it via `sage evidence run --session --label reproduce --grade verifier-blocked -- <cmd>` until it fails, or stop: you do not have a bug, you have a story. No hypothesis until that record exists.
2. **Root-cause.** Read the failure. Name the one function or invariant. If you cannot point at a `path:line`, you are still in phase 1.
3. **Minimal fix.** TDD inline in this thread — no implementer subagent. Change the smallest surface that turns the reproduce command green. Do not "while I'm here" adjacent cleanup.
4. **Evidence.** Re-run the same command: `sage evidence run --session --label fix --grade unit-test-verified -- <cmd>`. The finding that claims the fix is `rung >= 4` and `looksLikeCommandOutput`, bound to the session wtree. If evidence is `type-check-only` and the bug was runtime, you are not done. Hand a reviewer the ARTIFACT + CONTRACT only.

## Non-interactive

Terminal: `Fix complete: <path:line> evidence=<label>` or `Fix blocked: no red reproduce command`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I can see the bug, running the test is ceremony" | Without a red check this command has nothing to turn green. That's `/sage-look`, not this. |
| "Typecheck passing is evidence enough" | Runtime bugs need a runtime grade. `/sage-ship` will refuse the type-check-only citation later. |

## Red Flags

- A "done" with no session evidence record
- A fix landed before the reproduce command was red
- Reviewer handed the implementer's narrative

## Done when

- Session evidence for the fix is `rung >= 4` (or the terminal line names why not).
