#!/usr/bin/env sh
# json-safe.sh — parse stdin JSON (BOM-stripped) and emit JSON without interpolation.
# Every hook sources this. Prefer jq, then python3, then node.

json_read() {
  JSON_IN=$(dd bs=65536 count=8 2>/dev/null || cat)
  # Strip UTF-8 BOM
  JSON_IN=$(printf '%s' "$JSON_IN" | sed $'1s/^\xEF\xBB\xBF//')
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
