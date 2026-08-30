#!/usr/bin/env sh
# json-safe.sh — parse stdin JSON (BOM-stripped) and emit JSON without interpolation.
# Every hook sources this. Prefer jq, then python3, then node.

json_read() {
  JSON_IN=$(dd bs=65536 count=8 2>/dev/null || cat)
  # Strip UTF-8 BOM
  JSON_IN=$(printf '%s' "$JSON_IN" | sed "1s/^$(printf '\357\273\277')//")
}

json_get() {
  # json_get <dot.path>  e.g. tool_input.path
  _path=$1
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$JSON_IN" | jq -er ".$_path // empty" 2>/dev/null || true
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$JSON_IN" | python3 -c "
import json,sys
p=sys.argv[1].split('.')
try:
    d=json.load(sys.stdin)
except Exception:
    sys.exit(0)
for k in p:
    if isinstance(d, dict):
        d=d.get(k)
    else:
        d=None
        break
if d is None:
    sys.exit(0)
print(d if not isinstance(d, (dict,list)) else json.dumps(d))
" "$_path" 2>/dev/null || true
    return
  fi
  if command -v node >/dev/null 2>&1; then
    printf '%s' "$JSON_IN" | node -e "
let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{
  try { d=JSON.parse(s); } catch(e){ process.exit(0); }
  for (const k of process.argv[1].split('.')) d = d && d[k];
  if (d==null) process.exit(0);
  process.stdout.write(typeof d==='object'?JSON.stringify(d):String(d));
});
" "$_path" 2>/dev/null || true
    return
  fi
}

json_get_from() {
  # json_get_from <json-text> <dot.path> — same as json_get, but reads from
  # an explicit JSON string instead of the global $JSON_IN. Used by hooks
  # whose core logic runs in an embedded python/node script that reports
  # its decision back to the shell as a small internal-protocol JSON object
  # (e.g. {"sage_decision":"deny","sage_message":"..."}) rather than
  # printing the final host-shaped response itself — the shell then reads
  # that decision out with this and hands it to emit_deny/emit_allow/etc.,
  # which is what actually knows how to shape it per $SAGE_HOST.
  _jgf_saved="${JSON_IN:-}"
  JSON_IN=$1
  json_get "$2"
  JSON_IN="$_jgf_saved"
  unset _jgf_saved
}

json_emit() {
  # json_emit <json-string-already-valid>
  printf '%s\n' "$1"
}

json_obj() {
  # json_obj key value key value ...  values are strings; encoded via python/node/jq
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json,sys
args=sys.argv[1:]
o={}
for i in range(0,len(args),2):
    o[args[i]]=args[i+1]
print(json.dumps(o))
" "$@"
    return
  fi
  if command -v node >/dev/null 2>&1; then
    node -e "
const a=process.argv.slice(1); const o={};
for (let i=0;i<a.length;i+=2) o[a[i]]=a[i+1];
process.stdout.write(JSON.stringify(o)+'\n');
" "$@"
    return
  fi
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg a "$1" --arg b "$2" '{($a):$b}' >/dev/null
  fi
  printf '%s\n' '{}'
}

json_valid() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$JSON_IN" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null
    return $?
  fi
  if command -v node >/dev/null 2>&1; then
    printf '%s' "$JSON_IN" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{JSON.parse(s)})" 2>/dev/null
    return $?
  fi
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$JSON_IN" | jq -e . >/dev/null 2>&1
    return $?
  fi
  return 1
}

# =============================================================================
# Host-aware emit helpers — emit_deny / emit_ask / emit_allow / emit_followup.
#
# These are the ONLY place in this codebase that should build final hook
# response JSON. Every hook script calls one of these instead of hand-writing
# JSON (via printf/sed or an ad hoc python/node one-liner), so the
# Cursor-vs-Claude-Code response shape lives in exactly one place. Source
# hooks/host-detect.sh and call sage_detect_host before using these (they
# read $SAGE_HOST, defaulting to "cursor" — the pre-existing behavior — if
# it was never set).
#
# Each function IS terminal: it prints the response and calls `exit` itself
# (see per-function exit code below), matching how every hook in this
# directory already ends its deny/ask/allow branches. A hook that needs to
# run cleanup first (e.g. an EXIT trap removing a temp file) already gets
# that for free since `exit` still runs any `trap ... EXIT`.
#
# Response shapes:
#
#   Cursor deny/ask:
#     {"permission":"deny"|"ask","agent_message":<msg>,"user_message":<msg>}
#   Cursor allow/no-op:
#     {}
#   Cursor followup (Stop only — Stop cannot block on Cursor):
#     {"followup_message":<msg>}
#
#   Claude Code deny (PreToolUse):
#     BOTH the modern hookSpecificOutput.permissionDecision shape AND the
#     legacy top-level decision/reason shape, in the SAME object:
#       {"hookSpecificOutput":{"hookEventName":<event>,
#                               "permissionDecision":"deny",
#                               "permissionDecisionReason":<msg>},
#        "decision":"block","reason":<msg>}
#     Why both: one (secondary, unverified) source claims Claude Code no
#     longer parses the legacy {"decision":"block","reason":...} PreToolUse
#     shape. That claim is not trusted enough to bet a security hook on, so
#     both shapes are emitted together — they are different top-level keys
#     and do not collide — as belt, braces, and a third backstop: on TOP of
#     emitting both shapes, the process also exits 2 (the documented
#     "blocking error" exit code), which blocks the tool call even if BOTH
#     JSON shapes above were somehow ignored.
#   Claude Code ask (PreToolUse):
#     {"hookSpecificOutput":{"hookEventName":<event>,
#                             "permissionDecision":"ask",
#                             "permissionDecisionReason":<msg>}}
#     No legacy analogue is doubled up here — the legacy decision/reason
#     shape only ever expressed "block" (approve/deny), never a third "ask"
#     state, so there is nothing legacy to fall back to.
#   Claude Code allow/no-op:
#     {} — identical to Cursor; both hosts treat empty-object-on-exit-0 as
#     "no decision, proceed."
#   Claude Code followup (Stop only — Stop CAN block on Claude Code, unlike
#   Cursor, so the followup lever becomes a real block instead of a soft,
#   loop_limit-capped nudge):
#     {"decision":"block","reason":<msg>}
#
# Exit codes: emit_deny exits 2 on Claude Code (blocking-error convention)
# and 0 on Cursor (Cursor has no such convention — its deny lives entirely
# in the JSON body). emit_ask, emit_allow, and emit_followup all exit 0 on
# both hosts — none of those are the documented Claude Code blocking-error
# case, only emit_deny is.
# =============================================================================

_sage_host() {
  printf '%s' "${SAGE_HOST:-cursor}"
}

# _json_escape_fallback <string>
# Last-resort, interpreter-free JSON string escaping (backslash, double
# quote, tab, embedded newlines). Used ONLY when python3, node, AND jq are
# ALL unavailable — the one scenario this can actually be reached in is the
# hooks/tests/*/no-interpreter.* fixtures, where every emit_* helper below
# has already exhausted its python3/node/jq attempts. Every other path in
# this file uses python3's json.dumps, node's JSON.stringify, or jq's -Rn/
# --arg, which are all fully RFC 8259 correct; this exists only so the
# genuine no-interpreter case still produces valid JSON instead of broken
# JSON, on a strictly-POSIX toolchain (awk, present per hooks/tests/run.sh's
# own NOBIN allowlist) that works identically under dash and bash.
_json_escape_fallback() {
  # awk's line-oriented reconstruction below (split on "\n" via NR, rejoin
  # with a literal "\n" escape between records) is correct for every
  # newline EXCEPT one or more trailing newlines: awk's default record
  # splitting treats a trailing separator as a terminator, not as
  # introducing a further empty final record, so `printf 'a\n'` reads as a
  # single one-line record "a" with no trace that a newline followed it —
  # the trailing newline is silently dropped from the output instead of
  # being escaped. An adversarial test proved this with a deny/ask message
  # ending in "\n": the emitted JSON stayed valid, but the message text was
  # silently truncated. Strip and count trailing newlines in the shell
  # first (POSIX suffix removal on a literal, not a glob, so this is exact,
  # not pattern-matching), hand the now-non-newline-terminated remainder to
  # awk for the interior-newline reconstruction it already does correctly,
  # then re-append one "\n" escape per newline that was stripped.
  _jef_nl='
'
  _jef_body=$1
  _jef_trail=""
  while :; do
    case $_jef_body in
      *"$_jef_nl") _jef_body=${_jef_body%"$_jef_nl"}; _jef_trail="${_jef_trail}\\n" ;;
      *) break ;;
    esac
  done
  _jef_tab=$(printf '\t')
  printf '%s' "$_jef_body" | awk -v tab="$_jef_tab" '
    BEGIN { ORS = "" }
    {
      line = $0
      gsub(/\\/, "\\\\", line)
      gsub(/"/, "\\\"", line)
      gsub(tab, "\\t", line)
      if (NR > 1) printf "\\n"
      printf "%s", line
    }'
  printf '%s' "$_jef_trail"
}

# _sage_hook_event [default]
# Best-effort hookEventName for the Claude Code hookSpecificOutput envelope:
# read it from the payload's own hook_event_name when available (so the
# response echoes back whatever event actually invoked the hook), else fall
# back to the caller-supplied default.
_sage_hook_event() {
  _she_evt=""
  if [ -n "${JSON_IN:-}" ]; then
    _she_evt=$(json_get hook_event_name)
  fi
  [ -n "$_she_evt" ] || _she_evt=${1:-PreToolUse}
  printf '%s' "$_she_evt"
}

# _sage_cursor_permission <deny|ask> <msg>
_sage_cursor_permission() {
  _scp_perm=$1
  _scp_msg=$2
  if command -v python3 >/dev/null 2>&1; then
    _scp_out=$(python3 -c '
import json, sys
perm, msg = sys.argv[1], sys.argv[2]
print(json.dumps({"permission": perm, "agent_message": msg, "user_message": msg}))
' "$_scp_perm" "$_scp_msg" 2>/dev/null) && [ -n "$_scp_out" ] && { printf '%s\n' "$_scp_out"; return; }
  fi
  if command -v node >/dev/null 2>&1; then
    _scp_out=$(node -e '
const [perm, msg] = process.argv.slice(1);
process.stdout.write(JSON.stringify({ permission: perm, agent_message: msg, user_message: msg }) + "\n");
' "$_scp_perm" "$_scp_msg" 2>/dev/null) && [ -n "$_scp_out" ] && { printf '%s\n' "$_scp_out"; return; }
  fi
  if command -v jq >/dev/null 2>&1; then
    _scp_out=$(jq -cn --arg p "$_scp_perm" --arg m "$_scp_msg" '{permission:$p,agent_message:$m,user_message:$m}' 2>/dev/null) && [ -n "$_scp_out" ] && { printf '%s\n' "$_scp_out"; return; }
  fi
  _scp_esc=$(_json_escape_fallback "$_scp_msg")
  printf '{"permission":"%s","agent_message":"%s","user_message":"%s"}\n' "$_scp_perm" "$_scp_esc" "$_scp_esc"
}

# _sage_claude_permission <deny|ask> <msg>
_sage_claude_permission() {
  _scl_perm=$1
  _scl_msg=$2
  _scl_evt=$(_sage_hook_event PreToolUse)
  if [ "$_scl_perm" = "deny" ]; then
    if command -v python3 >/dev/null 2>&1; then
      _scl_out=$(python3 -c '
import json, sys
evt, msg = sys.argv[1], sys.argv[2]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": evt,
        "permissionDecision": "deny",
        "permissionDecisionReason": msg,
    },
    "decision": "block",
    "reason": msg,
}))
' "$_scl_evt" "$_scl_msg" 2>/dev/null) && [ -n "$_scl_out" ] && { printf '%s\n' "$_scl_out"; return; }
    fi
    if command -v node >/dev/null 2>&1; then
      _scl_out=$(node -e '
const [evt, msg] = process.argv.slice(1);
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: evt, permissionDecision: "deny", permissionDecisionReason: msg },
  decision: "block",
  reason: msg,
}) + "\n");
' "$_scl_evt" "$_scl_msg" 2>/dev/null) && [ -n "$_scl_out" ] && { printf '%s\n' "$_scl_out"; return; }
    fi
    if command -v jq >/dev/null 2>&1; then
      _scl_out=$(jq -cn --arg e "$_scl_evt" --arg m "$_scl_msg" \
        '{hookSpecificOutput:{hookEventName:$e,permissionDecision:"deny",permissionDecisionReason:$m},decision:"block",reason:$m}' 2>/dev/null) && [ -n "$_scl_out" ] && { printf '%s\n' "$_scl_out"; return; }
    fi
    _scl_eesc=$(_json_escape_fallback "$_scl_evt")
    _scl_mesc=$(_json_escape_fallback "$_scl_msg")
    printf '{"hookSpecificOutput":{"hookEventName":"%s","permissionDecision":"deny","permissionDecisionReason":"%s"},"decision":"block","reason":"%s"}\n' "$_scl_eesc" "$_scl_mesc" "$_scl_mesc"
    return
  fi
  # ask — no legacy shape to double up (see block comment above).
  if command -v python3 >/dev/null 2>&1; then
    _scl_out=$(python3 -c '
import json, sys
evt, msg = sys.argv[1], sys.argv[2]
print(json.dumps({"hookSpecificOutput": {"hookEventName": evt, "permissionDecision": "ask", "permissionDecisionReason": msg}}))
' "$_scl_evt" "$_scl_msg" 2>/dev/null) && [ -n "$_scl_out" ] && { printf '%s\n' "$_scl_out"; return; }
  fi
  if command -v node >/dev/null 2>&1; then
    _scl_out=$(node -e '
const [evt, msg] = process.argv.slice(1);
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: evt, permissionDecision: "ask", permissionDecisionReason: msg } }) + "\n");
' "$_scl_evt" "$_scl_msg" 2>/dev/null) && [ -n "$_scl_out" ] && { printf '%s\n' "$_scl_out"; return; }
  fi
  if command -v jq >/dev/null 2>&1; then
    _scl_out=$(jq -cn --arg e "$_scl_evt" --arg m "$_scl_msg" \
      '{hookSpecificOutput:{hookEventName:$e,permissionDecision:"ask",permissionDecisionReason:$m}}' 2>/dev/null) && [ -n "$_scl_out" ] && { printf '%s\n' "$_scl_out"; return; }
  fi
  _scl_eesc=$(_json_escape_fallback "$_scl_evt")
  _scl_mesc=$(_json_escape_fallback "$_scl_msg")
  printf '{"hookSpecificOutput":{"hookEventName":"%s","permissionDecision":"ask","permissionDecisionReason":"%s"}}\n' "$_scl_eesc" "$_scl_mesc"
}

emit_deny() {
  _msg=$1
  if [ "$(_sage_host)" = "claude" ]; then
    _sage_claude_permission deny "$_msg"
    exit 2
  fi
  _sage_cursor_permission deny "$_msg"
  exit 0
}

emit_ask() {
  _msg=$1
  if [ "$(_sage_host)" = "claude" ]; then
    _sage_claude_permission ask "$_msg"
  else
    _sage_cursor_permission ask "$_msg"
  fi
  exit 0
}

emit_allow() {
  printf '%s\n' '{}'
  exit 0
}

emit_followup() {
  _msg=$1
  if [ "$(_sage_host)" = "claude" ]; then
    # Stop CAN block on Claude Code (unlike Cursor): the followup lever
    # becomes a real block via {"decision":"block","reason":...}.
    if command -v python3 >/dev/null 2>&1; then
      _fu_out=$(python3 -c 'import json,sys; print(json.dumps({"decision":"block","reason":sys.argv[1]}))' "$_msg" 2>/dev/null) && [ -n "$_fu_out" ] && { printf '%s\n' "$_fu_out"; exit 0; }
    fi
    if command -v node >/dev/null 2>&1; then
      _fu_out=$(node -e 'process.stdout.write(JSON.stringify({decision:"block",reason:process.argv[1]})+"\n");' "$_msg" 2>/dev/null) && [ -n "$_fu_out" ] && { printf '%s\n' "$_fu_out"; exit 0; }
    fi
    if command -v jq >/dev/null 2>&1; then
      _fu_out=$(jq -cn --arg m "$_msg" '{decision:"block",reason:$m}' 2>/dev/null) && [ -n "$_fu_out" ] && { printf '%s\n' "$_fu_out"; exit 0; }
    fi
    _fu_esc=$(_json_escape_fallback "$_msg")
    printf '{"decision":"block","reason":"%s"}\n' "$_fu_esc"
    exit 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    _fu_out=$(python3 -c 'import json,sys; print(json.dumps({"followup_message":sys.argv[1]}))' "$_msg" 2>/dev/null) && [ -n "$_fu_out" ] && { printf '%s\n' "$_fu_out"; exit 0; }
  fi
  if command -v node >/dev/null 2>&1; then
    _fu_out=$(node -e 'process.stdout.write(JSON.stringify({followup_message:process.argv[1]})+"\n");' "$_msg" 2>/dev/null) && [ -n "$_fu_out" ] && { printf '%s\n' "$_fu_out"; exit 0; }
  fi
  if command -v jq >/dev/null 2>&1; then
    _fu_out=$(jq -cn --arg m "$_msg" '{followup_message:$m}' 2>/dev/null) && [ -n "$_fu_out" ] && { printf '%s\n' "$_fu_out"; exit 0; }
  fi
  _fu_esc=$(_json_escape_fallback "$_msg")
  printf '{"followup_message":"%s"}\n' "$_fu_esc"
  exit 0
}
