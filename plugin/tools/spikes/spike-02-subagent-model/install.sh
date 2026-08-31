#!/usr/bin/env sh
# install.sh — copies the two SPIKE-02 probe agent cards into the plugin's
# real agents/ directory (that's the only place either host will discover
# them as dispatchable subagents — plugin.json declares agents at
# "./agents" for both hosts). Idempotent; uninstall.sh removes exactly
# these two files and nothing else.
set -eu
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PLUGIN_ROOT=$(CDPATH= cd -- "$DIR/../../.." && pwd)
AGENTS_DIR="$PLUGIN_ROOT/agents"

for f in "$DIR/agents"/zz-spike02-*.md; do
  cp "$f" "$AGENTS_DIR/"
  echo "installed $AGENTS_DIR/$(basename "$f")"
done

echo
echo "Installed. Both hosts discover plugin agents from agents/ — restart"
echo "your Cursor/Claude Code session if it doesn't pick up new agent files"
echo "on its own. Then see README.md for the exact dispatch prompt."
echo "When done: $DIR/uninstall.sh"
