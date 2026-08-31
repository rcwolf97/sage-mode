#!/usr/bin/env sh
# uninstall.sh — restores hooks/hooks.json and hooks/hooks-claude.json from
# the backups install.sh made, then removes the backups. Safe to run even
# if install.sh was never run (no-op).
set -eu
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PLUGIN_ROOT=$(CDPATH= cd -- "$DIR/../../.." && pwd)
CURSOR_HOOKS="$PLUGIN_ROOT/hooks/hooks.json"
CLAUDE_HOOKS="$PLUGIN_ROOT/hooks/hooks-claude.json"

restored=0
if [ -f "$CURSOR_HOOKS.spike01-orig" ]; then
  mv "$CURSOR_HOOKS.spike01-orig" "$CURSOR_HOOKS"
  echo "restored $CURSOR_HOOKS"
  restored=1
fi
if [ -f "$CLAUDE_HOOKS.spike01-orig" ]; then
  mv "$CLAUDE_HOOKS.spike01-orig" "$CLAUDE_HOOKS"
  echo "restored $CLAUDE_HOOKS"
  restored=1
fi
if [ "$restored" = 0 ]; then
  echo "nothing to restore — install.sh was not run, or was already undone."
fi
