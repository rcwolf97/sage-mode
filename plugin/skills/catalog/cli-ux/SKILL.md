---
name: cli-ux
description: Catalog skill — flags, exit codes, --help, first-run success. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "designing or reviewing a command-line interface"
---

# cli-ux

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Run the tool with zero arguments and with `--help` before writing another line — if either produces a stack trace, a wall of usage text with no example, or silent success doing nothing, fix that first; it's the first thing every new user sees.
2. Pick exit code conventions and hold them: 0 success, 1 general failure, and any distinct machine-checkable failure modes (e.g. "not found" vs. "invalid input" vs. "network error") get their own code, documented, never reused for an unrelated failure later.
3. Separate stdout (machine-consumable output, safe to pipe) from stderr (progress, warnings, prompts) — a `--json` or `--quiet` flag should make stdout parseable with nothing else mixed in.
4. Make destructive actions require explicit confirmation or an explicit flag (`--force`/`-y`) — never make "no flags" the destructive default.
5. Every flag needs a one-line description in `--help` a first-time user can act on without reading source; abbreviations get expanded (`-f, --force`), never shipped alone.
6. Test the actual first-run path yourself: fresh shell, no cached config, minimal permissions — the number of commands it takes to get from `install` to a first successful real action is what matters, not the feature count.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Power users will read the docs" | The people evaluating whether to adopt the tool are, by definition, not power users yet — first-run failure is when you lose them, before they ever open the docs. |
| "The error message has all the info, it's just verbose" | A stack trace has all the info too. "Has the info" and "communicates the fix" are different bars — a good CLI error names what to do next, not just what went wrong. |
| "Exit codes don't matter, humans read the output" | Scripts and CI pipelines branch on exit codes, not on parsing your prose. An undocumented or inconsistent exit code silently breaks every automation built on top of the tool. |
| "--force is obviously implied by running the destructive command" | The command name sounding scary is not an explicit opt-in; the point of a force flag is that the default path stays safe to run by accident. |

## Red Flags

- Zero-argument invocation prints a stack trace instead of usage
- Machine-readable output (`--json`) mixed with human progress text on the same stream
- A destructive command with no confirmation and no dedicated flag
- Exit code 1 used for both "invalid input" and "network timeout" with no way to distinguish them programmatically

## Done when

Zero-arg and `--help` both produce something a new user can act on, exit codes are documented and distinct per failure class, stdout is clean enough to pipe when asked to be, and destructive actions require explicit opt-in.
