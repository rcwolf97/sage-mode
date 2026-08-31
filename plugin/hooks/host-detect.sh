#!/usr/bin/env sh
# host-detect.sh — sourced helper. Defines sage_detect_host, which exports
# SAGE_HOST (cursor|claude) and SAGE_PROJECT_DIR.
#
# Source this AFTER hooks/json-safe.sh, and call sage_detect_host AFTER the
# caller has populated $JSON_IN (i.e. after json_read, when the hook uses
# it) — the stdin-payload fallback below reads $JSON_IN via json_get, which
# is a silent no-op when JSON_IN is empty/unset, so it's always safe to
# source and call this even from a hook that never calls json_read itself.
#
# Detection order (first match wins):
#   1. CURSOR_PLUGIN_ROOT or CURSOR_PROJECT_DIR set -> cursor.
#      Checked FIRST, deliberately: a live Cursor host has been observed to
#      ALSO set CLAUDE_PLUGIN_ROOT (superpowers' finding). Checking the
#      Claude var first would misdetect that Cursor session as Claude Code.
#   2. Else CLAUDE_PLUGIN_ROOT or CLAUDE_PROJECT_DIR set -> claude.
#   3. Else inspect the hook stdin payload's `hook_event_name`: Claude Code
#      event names are PascalCase (PreToolUse, PostToolUse, SessionStart,
#      Stop, SubagentStop); Cursor's are camelCase (preToolUse,
#      beforeShellExecution, sessionStart, stop, subagentStart,
#      subagentStop, afterFileEdit). A leading uppercase letter -> claude;
#      anything else (leading lowercase, empty, unparseable) -> cursor.
#   4. Else default to cursor. This is the ORIGINAL, pre-Claude-Code
#      behavior of every hook in this directory (they all hardcoded
#      `${CURSOR_PROJECT_DIR:-.}`) — preserved as the fallback so an
#      environment with none of the above signals keeps behaving exactly as
#      it did before Claude Code support was added.
#
# SAGE_PROJECT_DIR: CURSOR_PROJECT_DIR, else CLAUDE_PROJECT_DIR, else the
# payload's `cwd` (present on every Claude Code hook payload; Cursor's
# payloads are not documented to carry an equivalent top-level field, so
# this branch is Claude-Code-oriented in practice), else `.`.

sage_detect_host() {
  if [ -n "${CURSOR_PLUGIN_ROOT:-}" ] || [ -n "${CURSOR_PROJECT_DIR:-}" ]; then
    SAGE_HOST=cursor
  elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] || [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    SAGE_HOST=claude
  else
    _sdh_evt=""
    if [ -n "${JSON_IN:-}" ]; then
      _sdh_evt=$(json_get hook_event_name)
    fi
    case "$_sdh_evt" in
      [A-Z]*) SAGE_HOST=claude ;;
      *) SAGE_HOST=cursor ;;
    esac
    unset _sdh_evt
  fi

  SAGE_PROJECT_DIR="${CURSOR_PROJECT_DIR:-}"
  if [ -z "$SAGE_PROJECT_DIR" ]; then
    SAGE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
  fi
  if [ -z "$SAGE_PROJECT_DIR" ] && [ -n "${JSON_IN:-}" ]; then
    SAGE_PROJECT_DIR=$(json_get cwd)
  fi
  if [ -z "$SAGE_PROJECT_DIR" ]; then
    SAGE_PROJECT_DIR="."
  fi

  export SAGE_HOST SAGE_PROJECT_DIR
}
