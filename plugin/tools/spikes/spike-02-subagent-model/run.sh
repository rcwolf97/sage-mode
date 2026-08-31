#!/usr/bin/env sh
# run.sh — the ONE command for SPIKE-02. A subagent dispatch is an AGENT
# action (Task tool / "@agent-name"), not something a shell script can
# trigger — so this script does everything that IS scriptable: validates
# both probe agent cards' frontmatter parses, ensures they're installed,
# sets up out/ with a comparison template, and prints the exact prompt to
# give your live agent for each of the two dispatches. Re-run any time; it
# never overwrites out/observations.md if you've already started filling
# it in.
set -eu
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PLUGIN_ROOT=$(CDPATH= cd -- "$DIR/../../.." && pwd)
AGENTS_DIR="$PLUGIN_ROOT/agents"
OUT="$DIR/out"
mkdir -p "$OUT"

fail=0
for name in zz-spike02-declared-model zz-spike02-default-model zz-spike02-cursor-lane-c; do
  f="$AGENTS_DIR/$name.md"
  if [ ! -f "$f" ]; then
    echo "NOT INSTALLED: $f — run $DIR/install.sh first."
    fail=1
    continue
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import sys
raw = open('$f').read()
if not raw.startswith('---'):
    print('BAD FRONTMATTER: $f has no --- opening fence'); sys.exit(1)
rest = raw[3:]
end = rest.find('---')
if end == -1:
    print('BAD FRONTMATTER: $f has no closing --- fence'); sys.exit(1)
fm = rest[:end]
if 'name:' not in fm:
    print('BAD FRONTMATTER: $f missing name:'); sys.exit(1)
print('frontmatter OK: $f')
" || fail=1
  else
    echo "python3 not available — skipping frontmatter validation for $f (eyeball it instead)."
  fi
done

if [ ! -f "$OUT/observations.md" ]; then
  cat > "$OUT/observations.md" <<'TEMPLATE'
# SPIKE-02 observations

Paste each subagent's verbatim response below, plus your own read on it.
Do NOT let either agent's own self-report settle the question by itself —
LLMs are not reliable narrators of their own model identity. Weigh: which
host/UI surface (if any) showed a model name for the dispatched subagent;
response latency; response quality/correctness on the prime-number check;
tone/verbosity differences consistent with a smaller vs larger model.

## Host tested

(Cursor / Claude Code / both — say which, and the exact version if you have it)

## zz-spike02-declared-model (model: haiku)

Dispatch prompt used: "Dispatch the zz-spike02-declared-model subagent and report its exact response verbatim."

Verbatim response:
```
(paste here)
```

## zz-spike02-default-model (no model field) — CONTROL

Dispatch prompt used: "Dispatch the zz-spike02-default-model subagent and report its exact response verbatim."

Verbatim response:
```
(paste here)
```

## zz-spike02-cursor-lane-c (model: gemini-3.7-flash) — CURSOR, the one that matters

This is the probe that answers the question the cost architecture rests on:
does Cursor honor a NON-Anthropic `model:` pin shipped from a plugin's
agents/ path? `gemini-3.7-flash` is the literal value agents/reviewer.md,
agents/red-team.md and agents/design-critic.md already carry. Skip this one
under Claude Code — the value is inert there by design.

Dispatch prompt used: "Dispatch the zz-spike02-cursor-lane-c subagent and report its exact response verbatim."

Verbatim response (or the exact dispatch error, which is an equally valid result):
```
(paste here)
```

## Verdict

Did the host visibly honor `model: haiku` for the first subagent (different
from whatever it used for the second)? State your evidence, not just a
yes/no — this file is the record future readers will trust, so back the
verdict with what you actually saw, not what you expected to see.
TEMPLATE
  echo "wrote $OUT/observations.md — fill it in after the dispatches."
else
  echo "$OUT/observations.md already exists — not overwriting your notes."
fi

echo
echo "Next: in your agent chat (the host you're testing), send these"
echo "prompts ONE AT A TIME and record each verbatim response in"
echo "$OUT/observations.md:"
echo
echo "  1. Dispatch the zz-spike02-default-model subagent and report its exact response verbatim."
echo "  2. Dispatch the zz-spike02-declared-model subagent and report its exact response verbatim."
echo "  3. Dispatch the zz-spike02-cursor-lane-c subagent and report its exact response verbatim."
echo
echo "Prompt 1 is the CONTROL (no model: field). Prompt 2 answers the"
echo "question for Claude Code (model: haiku). Prompt 3 answers it for"
echo "CURSOR (model: gemini-3.7-flash) — that is the one the Lane A/B/C"
echo "cost architecture actually depends on. In Cursor, run 1 and 3. In"
echo "Claude Code, run 1 and 2; 3 will be inert there by design."
echo
echo "When done: $DIR/uninstall.sh to remove the probe agent cards."

exit $fail
