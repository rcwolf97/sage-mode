# SPIKE-01 — does preToolUse/PreToolUse expose a file path for Write?

## The question

`hooks/sage-lane` is registered on `preToolUse` (Cursor) / `PreToolUse`
(Claude Code) to DENY an out-of-lane `Write`/`Edit`/etc. before it happens.
It reads the file path out of the tool-call payload, trying several
plausible keys (`tool_input.path`, `tool_input.file_path`, ...). Whether any
of those keys is actually populated for a real `Write` call, on a real
running host, has never been confirmed against a live Cursor or Claude Code
session — only assumed. If none of them is populated, `sage-lane` fails
closed on every single Write (denies everything, citing "no file path"),
which is a very loud failure mode you'd notice immediately in practice —
but this spike is how you'd find out WHY, and confirm the fallback
(`hooks/sage-lane-after`, already registered on `afterFileEdit`/
`PostToolUse` for exactly this reason) is what's actually carrying the
weight.

This harness does not answer the question by itself — it only captures
what a real host actually sends, so a human can read it and decide. See
"Do not fabricate results" — nothing in this repo claims SPIKE-01 has been
run for real; only this harness plus, once you run it, whatever lands in
`out/`.

## What to run

**In Cursor:**
1. Open a terminal in this plugin's repo (with sage-mode installed as a
   Cursor plugin so its hooks are actually live).
2. `./tools/spikes/spike-01-write-path/install.sh` — the one command that
   wires the probe in. It edits `hooks/hooks.json` in place (after backing
   it up) so Cursor needs to pick up the change — reload the plugin/reload
   the window if Cursor doesn't hot-reload hook config.
3. Ask your Cursor agent, in a normal chat, to write or edit any file (a
   scratch file is fine — the probe never blocks anything, but if you want
   zero side effects, ask it to edit a file already tracked by git and
   `git checkout` it after).
4. `./tools/spikes/spike-01-write-path/read-result.sh` — the one command to
   see what was captured.
5. `./tools/spikes/spike-01-write-path/uninstall.sh` when done — restores
   `hooks/hooks.json` exactly as it was.

**In Claude Code:**
Same four commands — `install.sh` also patches `hooks/hooks-claude.json`
in the same run, so nothing else to do differently. Claude Code plugins
typically need a session restart (or `/plugin reload` if your build has
it) to pick up a changed `hooks-claude.json`; restart your Claude Code
session after `install.sh` and before asking it to write/edit a file.

Run it in BOTH hosts if you can — the two hosts may answer this question
differently, and `sage-lane`/`sage-lane-after` are registered on both.

## Where the output lands

`tools/spikes/spike-01-write-path/out/`:
- `verdict.txt` — one human-readable block per captured call: which key (if
  any) carried the file path, plus the full list of top-level and
  `tool_input` keys the payload actually had (so you can spot a key this
  harness didn't think to check).
- `payloads.jsonl` — the raw payload, BOM-stripped, one JSON object per
  line (`{"ts": ..., "raw": "<the exact bytes the hook received>"}`) — the
  ground truth if `verdict.txt`'s automatic key-check missed something.
- `payloads-raw-fallback.txt` — only appears if `python3` wasn't available
  when the probe ran; plain text instead of JSONL for the same reason
  `hooks/json-safe.sh` avoids printf/sed for JSON construction (can't build
  valid JSON safely without a real encoder).

## How to read the result

Open `verdict.txt`. Each block ends with one of:
- `VERDICT: file path WAS exposed, via: <key>=<value>` — SPIKE-01 passes;
  `sage-lane`'s existing key list already covers it (or, if the key named
  isn't in `hooks/sage-lane`'s own candidate list, that's a real gap to
  fix in `sage-lane`, found by this run).
- `VERDICT: NO candidate key carried a file path.` — SPIKE-01 fails for
  that host/tool; `sage-lane` will fail closed (deny) on every Write there,
  and `sage-lane-after`'s `afterFileEdit`/`PostToolUse` detect-and-log path
  is doing the real enforcement, not `sage-lane`'s preventive deny. Given
  `sage-lane` is `failClosed: true`, this is a correctness problem worth
  raising, not just a documentation footnote — a fail-closed hook that
  denies 100% of Writes because it can never find a path is not "safely
  degraded," it blocks all legitimate work too.

If Cursor and Claude Code disagree (one exposes a path, the other doesn't),
note that explicitly — the fallback registration matters more for whichever
host fails.
