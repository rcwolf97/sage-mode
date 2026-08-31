#!/usr/bin/env sh
# uninstall.sh — removes exactly the two zz-spike02-*.md files install.sh
# copied into the real agents/ directory. Safe to run even if install.sh
# was never run (no-op).
set -eu
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PLUGIN_ROOT=$(CDPATH= cd -- "$DIR/../../.." && pwd)
AGENTS_DIR="$PLUGIN_ROOT/agents"

removed=0
for f in "$AGENTS_DIR"/zz-spike02-*.md; do
  [ -f "$f" ] || continue
  rm -f "$f"
  echo "removed $f"
  removed=1
done
if [ "$removed" = 0 ]; then
  echo "nothing to remove — install.sh was not run, or was already undone."
fi
