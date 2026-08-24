#!/usr/bin/env bash
# SPIKE-01 probe: log raw preToolUse stdin for Write, then allow.
set -euo pipefail
OUT="${SPIKE_LOG:-/tmp/pretooluse-write.json}"
# Strip UTF-8 BOM if present, then dump.
python3 -c '
import sys
data = sys.stdin.buffer.read()
if data.startswith(b"\xef\xbb\xbf"):
    data = data[3:]
open(sys.argv[1], "wb").write(data)
' "$OUT" || {
  cat > "$OUT"
}
printf '%s\n' '{}'
