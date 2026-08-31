#!/usr/bin/env bash
# Golden-payload runner for sage-mode hooks.
#
# Two independent dimensions, both exercised for every fixture:
#
#   SHELL:  once letting each hook's own `#!/usr/bin/env sh` shebang pick
#   the interpreter (whatever /bin/sh happens to resolve to on this
#   machine), and once with the hook FORCIBLY invoked under `dash` when
#   it's installed. Every sage-mode hook declares `#!/usr/bin/env sh`, and
#   `sh` is `dash` (not `bash`) on Debian/Ubuntu/GitHub Actions
#   `ubuntu-latest` — bashisms that only bash tolerates (`$'...'` ANSI-C
#   quoting, etc.) pass silently on a dev box where /bin/sh happens to be
#   bash-compatible and only break in that real environment. Forcing an
#   explicit dash pass here makes that break reproducible locally instead
#   of only in CI.
#
#   HOST:   once as Cursor (CURSOR_PROJECT_DIR set, compared against the
#   fixture's plain <base>.out.json) and once as Claude Code
#   (CLAUDE_PROJECT_DIR set, compared against <base>.claude.out.json) — see
#   hooks/host-detect.sh and hooks/json-safe.sh's emit_* functions for what
#   each host's shape actually is. compare.py also checks exit status: 2
#   for a Claude Code deny, 0 for everything else (Cursor and every
#   non-deny Claude Code case).
#
# Empty stdout is NOT coerced to `{}` (the allow fixture). A hook that
# crashed or never ran used to report `ok` because both this runner and
# compare.py treated blank stdout as allow. Empty/whitespace stdout is
# now emitted as the sentinel `__EMPTY__`, and compare.py fails loudly
# on it. ubuntu-latest's `sh` is dash, so the bash-3.2 heredoc-in-`$()`
# class of bug is invisible to CI regardless — `test/hooks-shell-portability.test.ts`
# is the construct-guard that actually prevents recurrence.
set -euo pipefail
HOOKS=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
COMPARE="$HOOKS/tests/compare.py"
fail=0

# A PATH with a POSIX shell and coreutils but NEITHER python3 NOR node NOR jq
# — used by the "*-no-interpreter" fixtures (M1) to prove sage-lane/sage-solo
# fail per their own declared polarity, rather than crashing uncaught, when
# none of the declared JSON-parsing prerequisites (tech-spec.md §4.1) exist.
NOBIN=$(mktemp -d)
# GOT_FILE holds the normalized "got" JSON for compare.py. Previously a
# hardcoded /tmp/sage-got.json, which fails with "Permission denied" on any
# shared-/tmp machine where another user already owns that exact path (a
# stale file from a different user's earlier run — /tmp is not per-user).
# mktemp gives this run its own private, unpredictable path; both temp
# paths are cleaned up by the same EXIT trap regardless of how the script
# exits (success, failure, or an unexpected error).
GOT_FILE=$(mktemp "${TMPDIR:-/tmp}/sage-hooks-test.XXXXXX")
trap 'rm -rf "$NOBIN"; rm -f "$GOT_FILE"' EXIT

for b in sh dash bash mktemp cat rm dirname basename sed awk head find sort tail cp mkdir printf true env grep; do
  p=$(command -v "$b" 2>/dev/null) || continue
  ln -sf "$p" "$NOBIN/$b"
done

shopt -s nullglob

# run_and_compare <hook> <payload> <exp> <env-args...>
# Invokes the hook with the given `env` arguments (e.g. `CURSOR_PROJECT_DIR=
# /tmp/x` or `-i PATH=$NOBIN CLAUDE_PROJECT_DIR=/tmp/x HOME=... TMPDIR=...`),
# respecting $FORCE_SHELL, capturing BOTH stdout and exit status without
# ever tripping `set -e` (a deny case's exit 2 on Claude Code is an
# EXPECTED, asserted outcome, not a script error), then hands both off to
# compare.py.
run_and_compare() {
  local hook=$1 payload=$2 exp=$3
  shift 3
  local got status
  set +e
  if [ -n "${FORCE_SHELL:-}" ]; then
    got=$(env "$@" "$FORCE_SHELL" "$HOOKS/$hook" < "$payload")
  else
    got=$(env "$@" "$HOOKS/$hook" < "$payload")
  fi
  status=$?
  set -e
  echo "$got" | python3 -c "import json,sys; s=sys.stdin.read().strip()
if not s:
    print('__EMPTY__')
else:
    try: print(json.dumps(json.loads(s), sort_keys=True))
    except Exception: print(s)" > "$GOT_FILE"
  python3 "$COMPARE" "$exp" "$GOT_FILE" "$status" || fail=1
}

run_all_fixtures() {
  local pass_label=${FORCE_SHELL:-"(shebang default)"}
  for hook in sage-careful sage-lane sage-solo sage-proof sage-bootstrap; do
    dir="$HOOKS/tests/$hook"
    [ -d "$dir" ] || continue
    for payload in "$dir"/*.in.json; do
      base=$(basename "$payload" .in.json)
      for host in cursor claude; do
        if [ "$host" = cursor ]; then
          projvar=CURSOR_PROJECT_DIR
          exp="$dir/$base.out.json"
        else
          projvar=CLAUDE_PROJECT_DIR
          exp="$dir/$base.claude.out.json"
        fi
        [ -f "$exp" ] || { echo "missing $exp"; fail=1; continue; }
        # *-no-interpreter fixtures assert behavior under a PATH with no
        # python3/node/jq at all; they're PATH-dependent, not
        # shell-dependent, and only meaningful in the default (unforced)
        # pass.
        case "$base" in
          *no-interpreter*) [ -n "${FORCE_SHELL:-}" ] && continue ;;
        esac
        echo "test [$pass_label][$host] $hook $base"
        if [ "$hook" = "sage-lane" ]; then
          tmp=$(mktemp -d)
          mkdir -p "$tmp/.sage"
          printf '%s\n' '{"owns":["src/api/**"],"node":"n1"}' > "$tmp/.sage/lane"
          mkdir -p "$tmp/src/api"
        else
          tmp="${TMPDIR:-/tmp}"
        fi
        case "$base" in
          *no-interpreter*)
            run_and_compare "$hook" "$payload" "$exp" \
              -i PATH="$NOBIN" "$projvar=$tmp" HOME="${HOME:-/root}" TMPDIR="${TMPDIR:-/tmp}"
            ;;
          *)
            run_and_compare "$hook" "$payload" "$exp" "$projvar=$tmp"
            ;;
        esac
        # NOT written as `[ ... ] && rm -rf "$tmp"`: under `set -e`, a `&&`
        # list's non-last operand failing is normally exempt from
        # triggering -e — EXCEPT when that list is the last command
        # actually executed inside a function (its exit status then
        # becomes the function's own return status), which it is here on
        # every non-sage-lane hook's very last fixture/host iteration. That
        # propagated a false "failure" up through the unguarded
        # `run_all_fixtures` call in main and aborted the whole script
        # after only the very first pass. `if` avoids it: `if false; then
        # ...; fi` with no else always returns 0.
        if [ "$hook" = "sage-lane" ]; then
          rm -rf "$tmp"
        fi
      done
    done
  done
}

unset FORCE_SHELL
run_all_fixtures

if command -v dash >/dev/null 2>&1; then
  FORCE_SHELL=$(command -v dash) run_all_fixtures
else
  echo "NOTE: dash not installed in this environment — skipping the forced-dash pass. Install dash to exercise the real /bin/sh on Debian/Ubuntu/ubuntu-latest."
fi

# M2 — back-to-back subagentStart dispatches must each get the CORRECT
# decision, and a parent-role marker must never outlive the dispatch it was
# written for (the "stale marker denies everything forever" bug). Run this
# sequence under both bash and dash (when available). sage-solo has no
# Claude Code registration (see hooks-claude.json's own comments), so this
# sequence stays Cursor-only, unlike run_all_fixtures above.
run_solo_sequence() {
  local shell_bin=$1 label=$2
  echo "test [$label] sage-solo back-to-back-dispatch-sequence"
  local seq_fail=0
  local tmp
  tmp=$(mktemp -d)
  mkdir -p "$tmp/.sage"

  # A: parent=eng-manager dispatches an implementer -> allow.
  printf '%s\n' 'eng-manager' > "$tmp/.sage/parent-role"
  local got_a
  got_a=$(printf '{"subagent_type":"implementer-backend"}' | CURSOR_PROJECT_DIR="$tmp" "$shell_bin" "$HOOKS/sage-solo")
  [ "$got_a" = "{}" ] || { echo "FAIL step A: expected {} got $got_a"; seq_fail=1; }
  [ -f "$tmp/.sage/parent-role" ] && { echo "FAIL step A: marker not consumed"; seq_fail=1; }

  # B: immediately after, dispatch again with NO marker rewritten (simulates
  # a caller that forgot) -> must fall back to allow, not incorrectly deny.
  local got_b
  got_b=$(printf '{"subagent_type":"implementer-frontend"}' | CURSOR_PROJECT_DIR="$tmp" "$shell_bin" "$HOOKS/sage-solo")
  [ "$got_b" = "{}" ] || { echo "FAIL step B: expected {} got $got_b"; seq_fail=1; }

  # C: from within a reviewer subagent, parent=reviewer -> deny.
  printf '%s\n' 'reviewer' > "$tmp/.sage/parent-role"
  local got_c
  got_c=$(printf '{"subagent_type":"explore"}' | CURSOR_PROJECT_DIR="$tmp" "$shell_bin" "$HOOKS/sage-solo")
  echo "$got_c" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('permission')=='deny' else 1)" \
    || { echo "FAIL step C: expected deny got $got_c"; seq_fail=1; }
  [ -f "$tmp/.sage/parent-role" ] && { echo "FAIL step C: marker not consumed"; seq_fail=1; }

  # D: immediately after C's deny, parent=eng-manager again -> allow. Proves
  # the reviewer marker consumed in C did not leak forward and deny D.
  printf '%s\n' 'eng-manager' > "$tmp/.sage/parent-role"
  local got_d
  got_d=$(printf '{"subagent_type":"implementer-backend"}' | CURSOR_PROJECT_DIR="$tmp" "$shell_bin" "$HOOKS/sage-solo")
  [ "$got_d" = "{}" ] || { echo "FAIL step D: expected {} got $got_d"; seq_fail=1; }

  rm -rf "$tmp"
  if [ "$seq_fail" = 1 ]; then
    fail=1
  else
    echo "ok"
  fi
}

run_solo_sequence "$(command -v bash)" bash
if command -v dash >/dev/null 2>&1; then
  run_solo_sequence "$(command -v dash)" dash
fi

# M3 — direct probe of json-safe.sh's pure-awk _json_escape_fallback, the
# last-resort tier reached only when python3, node, AND jq are ALL
# unavailable. No current hook caller actually routes attacker/dynamic
# content through this tier today (every dynamic deny message is built by
# python3/node before emit_* ever runs, and emit_*'s own python3/node/jq
# checks would already have succeeded in that case) — but it is the
# explicitly least-trusted tier (see the block comment above
# _json_escape_fallback), so it gets a direct, interpreter-bypassing round
# trip here rather than relying on it being exercised incidentally through
# some hook's fixture. Source json-safe.sh under $NOBIN (no python3/node/jq)
# and call the deny cascade directly with pathological messages, then
# validate + round-trip the result with the REAL python3 (outside $NOBIN).
# Regression target: a message ending in "\n" (one or more) used to be
# silently truncated by awk's default record splitting (RS="\n" treats a
# trailing separator as a terminator, not as introducing an empty final
# record) — the JSON stayed valid, but the message content was corrupted.
run_awk_fallback_probe() {
  echo "test [(shebang default)] json-safe.sh _json_escape_fallback (awk-only tier)"
  local probe_fail=0
  local probe
  probe=$(mktemp "${TMPDIR:-/tmp}/sage-hooks-awkprobe.XXXXXX")
  cat > "$probe" <<'EOSH'
DIR="$1"; MSG="$2"
. "$DIR/json-safe.sh"
SAGE_HOST=claude
_sage_claude_permission deny "$MSG"
EOSH
  check_one() {
    local label="$1" msg="$2"
    local out
    out=$(env -i PATH="$NOBIN" HOME="${HOME:-/root}" sh "$probe" "$HOOKS" "$msg" 2>&1)
    python3 - "$out" "$msg" "$label" <<'EOPY' || probe_fail=1
import json, sys
out, msg, label = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    d = json.loads(out)
except Exception as e:
    print("FAIL awk-fallback", label, "invalid JSON:", e, "\n got:", out)
    sys.exit(1)
reason = d.get("hookSpecificOutput", {}).get("permissionDecisionReason")
if reason != msg:
    print("FAIL awk-fallback", label, "\n expect", repr(msg), "\n got   ", repr(reason))
    sys.exit(1)
print("ok", label)
EOPY
  }
  # printf -v (a bash builtin assignment), NOT "$(printf ...)": a command
  # substitution strips ALL trailing newlines from its own output, which
  # would silently zero out exactly the trailing-newline cases below before
  # msg is ever passed to check_one — the same class of bug this probe
  # exists to catch, just relocated into the test harness itself. An
  # earlier version of this probe made that mistake and passed unconditionally
  # (the stripped expected value matched the stripped-by-the-same-bug actual
  # value) even against the pre-fix, actually-broken _json_escape_fallback.
  local msg
  printf -v msg 'line1\nline2\n'; check_one "trailing-1nl" "$msg"
  printf -v msg 'line1\n\n'; check_one "trailing-2nl" "$msg"
  printf -v msg '\n'; check_one "only-nl" "$msg"
  printf -v msg '\nabc'; check_one "leading-nl" "$msg"
  printf -v msg 'a\nb\n\nc'; check_one "interior-multi-nl" "$msg"
  check_one "quote" 'a"b'
  check_one "backslash" 'a\b'
  printf -v msg 'a\tb'; check_one "tab" "$msg"
  check_one "emoji-utf8" 'héllo 😀 世界'
  printf -v msg '%*s' 5000 ''; msg=${msg// /x}; check_one "long4kb" "$msg"
  rm -f "$probe"
  if [ "$probe_fail" = 1 ]; then
    fail=1
  fi
}
run_awk_fallback_probe

exit $fail
