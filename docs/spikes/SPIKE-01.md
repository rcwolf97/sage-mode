---
title: SPIKE-01 — Does preToolUse expose file_path for Write?
kind: note
status: decided
created: 2026-08-24
updated: 2026-08-31
tags: [spike, hooks, lane]
---

# SPIKE-01 — Does `preToolUse` expose `file_path` for Write?

> **In plain terms:** Lane enforcement needs a path on Write before the write happens. Cursor's hook docs only show a Shell example. The live Cursor Write capture for this integration was not re-run (probe must not stay installed in committed `hooks.json`). Decision below is from the path-key list already in `sage-lane`, the registered `afterFileEdit` fallback, and the synthetic probe record in `plugin/tools/spikes/spike-01-write-path/out/verdict.txt`.

## Status: decided

**Verdict: PASS on the keys sage-lane already reads; keep `sage-lane-after` registered as the after-the-fact net.**

`sage-lane` extracts a path from `tool_input`, in order: `path` · `file_path` · `filePath` · `target_file` · `file`, then a top-level `file_path`. The synthetic probe record showed `tool_input.path`. No additional key was added this pass. A live Write in a new chat after installing the probe was **not** captured here — do not treat the synthetic `/tmp/synthetic-path.ts` timestamp as a live host payload.

Phase 0 already fixed macOS bash 3.2 heredoc-in-`$()` fail-open. A path-key capture is not independent proof that deny works; that proof is the Phase 0 hand-check (`src/web/x.ts` outside `src/api/**` → deny JSON, exit 0).

## What ships

`hooks/hooks.json` registers **both**:

- `preToolUse → sage-lane` (preventive, failClosed)
- `afterFileEdit → sage-lane-after` (detect-and-log; **registered**, not a one-line switch waiting to happen)

The older claim that `sage-lane-after` was left unregistered so the FAIL path was a one-line config change is **stale** and is withdrawn.

## If a live capture later FAILS

Keep relying on `sage-lane-after`. Do not uninstall it. Add any newly observed key to the extract list and a golden fixture. Uninstall the spike probe before every commit (`plugin/tools/spikes/spike-01-write-path/uninstall.sh`) — a probe install writes an absolute path into `hooks.json`.

## Probe harness

`plugin/tools/spikes/spike-01-write-path/` (not the older `sage-mode/tools/spikes/spike-01/` stub). Synthetic `out/verdict.txt` exists; no live `/tmp/pretooluse-write.json` from this session.
