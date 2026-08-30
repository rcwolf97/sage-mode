#!/usr/bin/env sh
# read-result.sh — the ONE command to see what SPIKE-01 has captured so
# far. Safe to run any time, including before install.sh / before any
# payload has landed (says so plainly instead of erroring).
set -eu
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
OUT="$DIR/out"

if [ ! -f "$OUT/verdict.txt" ] && [ ! -f "$OUT/payloads-raw-fallback.txt" ]; then
  echo "No captures yet."
  echo "1. Run ./install.sh"
  echo "2. In your agent (Cursor or Claude Code), ask it to write or edit any file"
  echo "3. Re-run this script"
  exit 0
fi

if [ -f "$OUT/verdict.txt" ]; then
  echo "=== verdict.txt (one entry per captured Write call) ==="
  cat "$OUT/verdict.txt"
fi
if [ -f "$OUT/payloads.jsonl" ]; then
  echo "=== payloads.jsonl (raw BOM-stripped payload per call, JSONL) ==="
  cat "$OUT/payloads.jsonl"
fi
if [ -f "$OUT/payloads-raw-fallback.txt" ]; then
  echo "=== payloads-raw-fallback.txt (captured with no python3 available) ==="
  cat "$OUT/payloads-raw-fallback.txt"
fi
