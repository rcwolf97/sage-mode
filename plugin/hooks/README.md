# hooks/

Shell scripts that Cursor and Claude Code each run at specific moments.
`hooks.json` (Cursor) and `hooks-claude.json` (Claude Code) wire the same
scripts to each host's own events — the two hosts use different event names
and different nesting for the hooks-config JSON itself; see the comments at
the top of each file. All hooks source `json-safe.sh` and `host-detect.sh`,
are POSIX `sh` (tested under both `dash` and `bash`), detect which host
they're running under via `host-detect.sh`'s `sage_detect_host`, and emit
host-shaped JSON via `json-safe.sh`'s `emit_deny`/`emit_ask`/`emit_allow`/
`emit_followup` — see the block comment above those functions in
`json-safe.sh` for the exact Cursor vs. Claude Code response shapes. Every
hook is covered by golden-payload fixtures in `tests/`, run under both hosts
and both shells by `tests/run.sh`.

## Host detection (`host-detect.sh`)

`SAGE_HOST` (`cursor`|`claude`) and `SAGE_PROJECT_DIR` are resolved by
`sage_detect_host` in this priority order: `CURSOR_PLUGIN_ROOT`/
`CURSOR_PROJECT_DIR` (checked first — a Cursor host has been observed to
also set `CLAUDE_PLUGIN_ROOT`, which would misdetect it as Claude Code if
checked first) → `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PROJECT_DIR` → the hook
payload's own `hook_event_name` (PascalCase → claude, camelCase → cursor)
→ default `cursor` (the pre-existing behavior, preserved as the final
fallback). See the comments in `host-detect.sh` for the full detail.

## Lane enforcement: `sage-lane` vs. `sage-lane-after`

`sage-lane` is the *preventive* path — it denies an out-of-lane `Write`/
`Delete`/`Edit`/etc. before it happens — registered on `preToolUse`
(Cursor) / `PreToolUse` matcher `Write|Edit|MultiEdit|NotebookEdit`
(Claude Code).

`sage-lane-after` is the *detect-and-log* fallback for whichever host/tool
combination does not expose a usable file path to the preventive hook (see
`docs/spikes/SPIKE-01.md` and `tools/spikes/spike-01-write-path/` for how to
check this against a live host). It is registered **in addition to**
`sage-lane`, not instead of it: `afterFileEdit` (Cursor) / `PostToolUse`
matcher `Write|Edit|MultiEdit|NotebookEdit` (Claude Code). Because it fires
after the edit already happened, it can only log a violation to
`.sage/lane-violations.jsonl` — it never denies, on either host.

## Claude Code gaps (things this directory cannot enforce there)

- **`sage-solo` / reviewer-cannot-spawn-subagents**: Claude Code's
  `SubagentStart` event (if it exists at all) is LOW confidence and is
  deliberately not wired in `hooks-claude.json`. On Claude Code this
  guarantee is unenforced by any hook — it must be carried as an
  instruction on the reviewer/red-team/design-critic agent cards instead.
- **`sage-bootstrap` / real env-var injection**: Cursor's `sessionStart`
  hook can set actual process env vars (`SAGE_HOME`, `SAGE_SPRINT`) via its
  `env` output field. Claude Code's `SessionStart` hook has no known
  equivalent — `SAGE_HOME`/`SAGE_SPRINT` reach a Claude Code session only as
  text inside `additionalContext`, never as real env vars.
- **rules/sage-conduct.mdc**: Claude Code has no `rules` concept. This
  file's content needs another delivery path there (e.g. folded into a
  skill or `CLAUDE.md`) — not solved in this directory; flagged here so it
  isn't lost.
