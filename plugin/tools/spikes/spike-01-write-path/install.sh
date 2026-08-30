#!/usr/bin/env sh
# install.sh — the ONE command for SPIKE-01. Idempotently wires probe-hook
# into BOTH hooks/hooks.json (Cursor) and hooks/hooks-claude.json (Claude
# Code) as an EXTRA preToolUse/PreToolUse entry (matcher "Write"), alongside
# the real sage-lane entry, not instead of it. Backs up both files first
# (once — a second run does not clobber the backup with an already-patched
# copy). Safe to leave installed: probe-hook always emits {} (allow) and
# never blocks anything.
#
# Run this, then in the SAME plugin install (Cursor or Claude Code, or
# both, if you can test both from here), ask your agent to write or edit a
# file. Then run ./read-result.sh (also one command) to see what was
# captured. See README.md for the exact step-by-step.
set -eu
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PLUGIN_ROOT=$(CDPATH= cd -- "$DIR/../../.." && pwd)
CURSOR_HOOKS="$PLUGIN_ROOT/hooks/hooks.json"
CLAUDE_HOOKS="$PLUGIN_ROOT/hooks/hooks-claude.json"
PROBE="$DIR/probe-hook"
chmod +x "$PROBE"

if [ ! -f "$CURSOR_HOOKS.spike01-orig" ]; then
  cp "$CURSOR_HOOKS" "$CURSOR_HOOKS.spike01-orig"
fi
if [ ! -f "$CLAUDE_HOOKS.spike01-orig" ]; then
  cp "$CLAUDE_HOOKS" "$CLAUDE_HOOKS.spike01-orig"
fi

python3 - "$CURSOR_HOOKS" "$PROBE" <<'PY'
import json, sys
path, probe = sys.argv[1], sys.argv[2]
with open(path) as f:
    cfg = json.load(f)
entries = cfg.setdefault("hooks", {}).setdefault("preToolUse", [])
entries[:] = [e for e in entries if e.get("command") != probe]
entries.append({"command": probe, "type": "command", "timeout": 5, "matcher": "Write"})
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
print("patched", path)
PY

python3 - "$CLAUDE_HOOKS" "$PROBE" <<'PY'
import json, sys
path, probe = sys.argv[1], sys.argv[2]
with open(path) as f:
    cfg = json.load(f)
matchers = cfg.setdefault("hooks", {}).setdefault("PreToolUse", [])
# Identify a prior probe entry by its command (not the matcher string,
# which must stay a real, valid "Write" tool-name matcher — an unanchored
# regex — not decorated with any marker text, or it would never actually
# match the real Write tool and this whole spike would silently observe
# nothing).
matchers[:] = [m for m in matchers if not any(h.get("command") == probe for h in m.get("hooks", []))]
matchers.append({
    "matcher": "Write",
    "hooks": [{"type": "command", "command": probe, "timeout": 5}],
})
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
print("patched", path)
PY

echo
echo "Installed. Now: ask your agent (in the host you want to test) to write"
echo "or edit any file, then run: $DIR/read-result.sh"
echo "When done, restore the originals with: $DIR/uninstall.sh"
