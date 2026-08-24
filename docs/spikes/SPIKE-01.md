---
title: SPIKE-01 — Does preToolUse expose file_path for Write?
kind: note
status: not-run
created: 2026-08-24
updated: 2026-08-24
tags: [spike, hooks, lane]
---

# SPIKE-01 — Does `preToolUse` expose `file_path` for Write?

> **In plain terms:** Lane enforcement needs a path on Write before the write happens. Cursor's hook docs only show a Shell example. **This spike has not been executed against live Cursor.** The scaffolding to run it exists (`tools/spikes/spike-01/`); nobody has run it yet. Everything below documents that honestly and states what the codebase currently assumes.

## Status: NOT EXECUTED

This spike was **not run against live Cursor in this pass.** `sage-lane` and the rest of the lane-enforcement architecture (§7.3, §12/WP-16) **assume PASS** — that `preToolUse`'s `tool_input` carries a usable path for `Write`/`Delete` calls. That assumption has not been verified for real and **must be verified by running the procedure below in live Cursor before this is depended on in production.**

## Procedure (tech-spec.md §3, live — not yet run)

1. Create `.cursor/hooks.json` in a scratch project from `tools/spikes/spike-01/hooks.json` (adjust the command path).
2. `chmod +x tools/spikes/spike-01/probe.sh`. It logs raw stdin to `/tmp/pretooluse-write.json` and exits 0 with `{}`.
3. In Cursor, ask the agent to create a file.
4. Inspect `/tmp/pretooluse-write.json`.

**Pass:** `tool_input` contains an absolute or repo-relative file path under any key.
**Fail:** no path present anywhere in the payload.

## What ships today, given the unverified assumption

`hooks/hooks.json` registers **only** `preToolUse → sage-lane` (matching tech-spec.md's normative config, lines ~918–935) — this is the assumed-PASS path.

`sage-lane` extracts a path from `tool_input`, in order: `path` · `file_path` · `filePath` · `target_file` · `file`, falling back to a top-level `file_path`. If no path is found anywhere in the payload, it **denies** (fail-closed), per its declared polarity — it does not silently allow.

## If this spike is run and FAILS

Switch `hooks/hooks.json`'s `preToolUse` entry for lane enforcement to the `afterFileEdit → sage-lane-after` **detect-and-revert** fallback instead. `hooks/sage-lane-after` already exists in this repo and already implements it: it reads `file_path` (which `afterFileEdit` reliably carries), checks it against `.sage/lane`'s `owns` globs, and logs any violation to `.sage/lane-violations.jsonl` for `sage-build` to revert at the next join and re-dispatch with a corrected brief.

This fallback is **strictly worse** — it detects after the fact instead of preventing the write — and **WP-16 must be re-estimated** if this path is taken (parallel-worktree lane safety becomes probabilistic-then-corrected rather than preventive).

`sage-lane-after` is left in place and working, but **unregistered** in `hooks.json`, specifically so this switch is a one-line config change rather than new engineering, if and when this spike is actually run and comes back FAIL. See the note at the top of `hooks/hooks.json`.

## Probe harness

`tools/spikes/spike-01/hooks.json` and `probe.sh` exist and are ready to run. No live payload has been captured in this environment (no live Cursor available here). Whoever runs this for real: paste the captured `/tmp/pretooluse-write.json` into this file, flip `status` to `decided`, and record PASS/FAIL above.

## Consequence for WP-16

Not yet re-estimated, because the spike has not run. If it fails, re-estimate per the paragraph above before starting WP-16.
