---
title: SPIKE-01 — Does preToolUse expose file_path for Write?
kind: note
status: decided
created: 2026-08-24
updated: 2026-08-24
tags: [spike, hooks, lane]
---

# SPIKE-01 — Does `preToolUse` expose `file_path` for Write?

> **In plain terms:** Lane enforcement needs a path on Write before the write happens. Cursor's hook docs only show a Shell example. This spike records what we can prove from docs plus a live probe harness, and the dual-path implementation we ship so WP-16 is not blocked.

## Procedure (live)

1. Copy `tools/spikes/spike-01/hooks.json` and `probe.sh` into a scratch project's `.cursor/hooks.json` (adjust the command path).
2. `chmod +x probe.sh`.
3. In Cursor, ask the agent to create a file.
4. Inspect `/tmp/pretooluse-write.json`.

**Pass:** `tool_input` contains an absolute or repo-relative file path under any key.
**Fail:** no path → detect-and-revert via `afterFileEdit`.

## What the docs prove (2026-08)

Cursor's published `preToolUse` example is Shell-only: `tool_input: { command, working_directory }`. No Write/Edit example exists. `afterFileEdit` **does** carry top-level `file_path`. `preToolUse` payloads include `tool_name` and `tool_input` as an object.

Raw documentation excerpt (hooks research, 2026-08):

```json
{
  "hook_event_name": "preToolUse",
  "tool_name": "Write",
  "tool_input": { "<undocumented>" }
}
```

## Implementation decision (not blocked)

Ship **both** paths. `sage-lane` extracts a path from `tool_input` using, in order:

`path` · `file_path` · `filePath` · `target_file` · `file`

If a path is present → deny-tier lane check (designed hook).
If a path is absent and `.sage/lane` is active → **deny** (fail closed) rather than allow a blind write, and `sage-build` also registers `afterFileEdit` detect-and-revert.

Project config field `lane_enforcement`: `"hook"` | `"detect-revert"` | `"both"` (default `"both"`).

`.sage/config.json` is written by `/sage-setup`. Operators who confirm a live payload can pin `"hook"`; a confirmed miss pins `"detect-revert"`.

## Probe harness

See `tools/spikes/spike-01/`. Attach the live `/tmp/pretooluse-write.json` here when run:

```
(payload not yet captured in this environment — dual-path ships)
```

## Consequence for WP-16

Parallel worktrees ship. Lane enforcement is fail-closed when a sprint is active. False-positive denies (unparseable Write payload) are the accepted cost; a missed intersection is not.
