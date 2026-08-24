#!/usr/bin/env bash
# Golden-payload runner for sage-mode hooks.
set -euo pipefail
HOOKS=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
fail=0
run_case() {
  local hook=$1 payload=$2 expect_file=$3
  local got
  got=$(printf '%s' "$(cat "$payload")" | env CURSOR_PROJECT_DIR="${TMPDIR:-/tmp}/sage-hook-empty" "$HOOKS/$hook" || true)
  # normalize
  echo "$got" | python3 -c "import json,sys; s=sys.stdin.read().strip() or '{}';
try:
  print(json.dumps(json.loads(s), sort_keys=True))
except Exception:
  print(s)" > /tmp/sage-got.json
  python3 -c "import json,sys
exp=json.dumps(json.loads(open(sys.argv[1]).read() or '{}'), sort_keys=True)
got=open('/tmp/sage-got.json').read().strip()
if exp!=got:
    print('FAIL', sys.argv[1], '\n expect', exp, '\n got   ', got)
    sys.exit(1)
" "$expect_file" || fail=1
}
shopt -s nullglob
for hook in sage-careful sage-lane sage-solo sage-proof sage-bootstrap; do
  dir="$HOOKS/tests/$hook"
  [ -d "$dir" ] || continue
  for payload in "$dir"/*.in.json; do
    base=$(basename "$payload" .in.json)
    exp="$dir/$base.out.json"
    [ -f "$exp" ] || { echo "missing $exp"; fail=1; continue; }
    echo "test $hook $base"
    # special: lane tests get a lane file in a temp project
    if [ "$hook" = "sage-lane" ]; then
      tmp=$(mktemp -d)
      mkdir -p "$tmp/.sage"
      printf '%s\n' '{"owns":["src/api/**"],"node":"n1"}' > "$tmp/.sage/lane"
      mkdir -p "$tmp/src/api"
      got=$(CURSOR_PROJECT_DIR="$tmp" "$HOOKS/$hook" < "$payload" || true)
      echo "$got" | python3 -c "import json,sys; s=sys.stdin.read().strip() or '{}'; print(json.dumps(json.loads(s), sort_keys=True))" > /tmp/sage-got.json
      python3 -c "import json,sys
exp=json.dumps(json.loads(open(sys.argv[1]).read() or '{}'), sort_keys=True)
got=open('/tmp/sage-got.json').read().strip()
if exp!=got:
    print('FAIL', sys.argv[1], '\n expect', exp, '\n got   ', got); sys.exit(1)
print('ok')" "$exp" || fail=1
      rm -rf "$tmp"
    else
      got=$(CURSOR_PROJECT_DIR="${TMPDIR:-/tmp}" "$HOOKS/$hook" < "$payload" || true)
      echo "$got" | python3 -c "import json,sys; s=sys.stdin.read().strip() or '{}';
try: print(json.dumps(json.loads(s), sort_keys=True))
except Exception: print(s)" > /tmp/sage-got.json
      python3 -c "import json,sys
exp=json.dumps(json.loads(open(sys.argv[1]).read() or '{}'), sort_keys=True)
got=open('/tmp/sage-got.json').read().strip()
if exp!=got:
    print('FAIL', sys.argv[1], '\n expect', exp, '\n got   ', got); sys.exit(1)
print('ok')" "$exp" || fail=1
    fi
  done
done
exit $fail
