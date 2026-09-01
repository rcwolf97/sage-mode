#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGIN_ROOT="$REPO_ROOT/plugins/sage-mode"
FAILURES=0

pass() { echo "  [PASS] $1"; }
fail() { echo "  [FAIL] $1"; FAILURES=$((FAILURES + 1)); }

echo "Opt-in / no SessionStart tests"

if node -e '
const fs = require("fs");
const hooks = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (hooks.hooks && Object.keys(hooks.hooks).length) {
  console.error("hooks.json still registers hooks:", Object.keys(hooks.hooks));
  process.exit(1);
}
' "$PLUGIN_ROOT/hooks/hooks.json"; then
  pass "hooks.json registers no hooks"
else
  fail "hooks.json registers no hooks"
fi

if node -e '
const fs = require("fs");
const hooks = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (hooks.hooks && Object.keys(hooks.hooks).length) {
  console.error("hooks-cursor.json still registers hooks:", Object.keys(hooks.hooks));
  process.exit(1);
}
' "$PLUGIN_ROOT/hooks/hooks-cursor.json"; then
  pass "hooks-cursor.json registers no hooks"
else
  fail "hooks-cursor.json registers no hooks"
fi

if [[ -e "$PLUGIN_ROOT/hooks/session-start" ]]; then
  fail "hooks/session-start is gone"
else
  pass "hooks/session-start is gone"
fi

if node -e '
const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
if (p.hooks) { console.error("cursor plugin.json still has hooks"); process.exit(1); }
if (p.commands) { console.error("cursor plugin.json must not register commands"); process.exit(1); }
if (p.skills !== "./skills/") { console.error("missing skills"); process.exit(1); }
if (p.rules !== "./rules/") { console.error("missing rules"); process.exit(1); }
' "$PLUGIN_ROOT/.cursor-plugin/plugin.json"; then
  pass "cursor plugin.json has skills, rules, no commands or hooks"
else
  fail "cursor plugin.json has skills, rules, no commands or hooks"
fi

if node -e '
const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
if (p.commands !== "./commands/") process.exit(1);
' "$PLUGIN_ROOT/.claude-plugin/plugin.json"; then
  pass "claude plugin.json still registers commands"
else
  fail "claude plugin.json still registers commands"
fi

if node -e '
const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
if (m.metadata.pluginRoot !== "plugins") process.exit(1);
if (m.plugins[0].source !== "sage-mode") process.exit(1);
' "$REPO_ROOT/.cursor-plugin/marketplace.json"; then
  pass "cursor marketplace.json indexes plugins/sage-mode"
else
  fail "cursor marketplace.json indexes plugins/sage-mode"
fi

missing=0
while IFS= read -r skill; do
  name=$(basename "$skill")
  if [[ ! -f "$PLUGIN_ROOT/commands/${name}.md" ]]; then
    echo "    missing command for $name"
    missing=$((missing + 1))
  fi
  if [[ "$name" == "unslop" ]]; then
    if grep -q "^disable-model-invocation:" "$skill/SKILL.md"; then
      echo "    unslop must not have disable-model-invocation"
      missing=$((missing + 1))
    fi
    continue
  fi
  if ! grep -q "^disable-model-invocation: true" "$skill/SKILL.md"; then
    echo "    $name missing disable-model-invocation"
    missing=$((missing + 1))
  fi
done < <(find "$PLUGIN_ROOT/skills" -mindepth 1 -maxdepth 1 -type d)

if [[ "$missing" -eq 0 ]]; then
  pass "every skill has a command; unslop has no DMI; others have DMI"
else
  fail "skill command / DMI contract ($missing)"
fi

if [[ ! -f "$PLUGIN_ROOT/rules/unslop.mdc" ]] || ! grep -q "alwaysApply: true" "$PLUGIN_ROOT/rules/unslop.mdc"; then
  fail "rules/unslop.mdc alwaysApply"
else
  pass "rules/unslop.mdc alwaysApply"
fi

if [[ ! -f "$REPO_ROOT/docs/index.html" ]] || [[ ! -f "$REPO_ROOT/docs/assets/sage-docs.css" ]]; then
  fail "docs/index.html and CSS present"
else
  pass "docs/index.html and CSS present"
fi

if [[ ! -f "$PLUGIN_ROOT/skills/ce-compound/references/schema.yaml" ]]; then
  fail "ce-compound schema.yaml present"
else
  pass "ce-compound schema.yaml present"
fi
if [[ ! -f "$PLUGIN_ROOT/skills/ce-compound/scripts/validate-frontmatter.py" ]] || \
    [[ ! -f "$PLUGIN_ROOT/skills/ce-compound/scripts/validate-doc-claims.py" ]]; then
  fail "ce-compound validators present"
else
  pass "ce-compound validators present"
fi
if [[ ! -d "$REPO_ROOT/docs/learnings" ]]; then
  fail "docs/learnings exists"
else
  pass "docs/learnings exists"
fi

TMP_HTML="$(mktemp "${TMPDIR:-/tmp}/sage-learn.XXXXXX.html")"
cat > "$TMP_HTML" << 'EOF'
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Sample</title>
<!--
---
title: sample
module: test
---
-->
<body>
<p>A learning.</p>
</body>
</html>
EOF
if python3 "$PLUGIN_ROOT/skills/ce-compound/scripts/validate-frontmatter.py" "$TMP_HTML"; then
  pass "validator unwraps HTML comment frontmatter"
else
  fail "validator unwraps HTML comment frontmatter"
fi
rm -f "$TMP_HTML"


if [[ -d "$PLUGIN_ROOT/skills/requesting-code-review" ]]; then
  fail "skills/requesting-code-review is gone (merged into code-review)"
else
  pass "skills/requesting-code-review is gone (merged into code-review)"
fi

if [[ ! -f "$PLUGIN_ROOT/agents/code-reviewer.md" ]] || ! grep -q "gemini-3.7-flash" "$PLUGIN_ROOT/agents/code-reviewer.md"; then
  fail "agents/code-reviewer.md pins gemini-3.7-flash"
else
  pass "agents/code-reviewer.md pins gemini-3.7-flash"
fi

if node -e '
const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
if (p.agents !== "./agents/") process.exit(1);
' "$PLUGIN_ROOT/.cursor-plugin/plugin.json"; then
  pass "cursor plugin.json registers agents"
else
  fail "cursor plugin.json registers agents"
fi

if ! grep -q "pressure-test" "$PLUGIN_ROOT/skills/brainstorming/SKILL.md"; then
  fail "brainstorming points business questions at pressure-test"
else
  pass "brainstorming points business questions at pressure-test"
fi

if ! grep -q "multi-phase-plan" "$PLUGIN_ROOT/skills/brainstorming/SKILL.md"; then
  fail "brainstorming hands architectural specs to multi-phase-plan"
else
  pass "brainstorming hands architectural specs to multi-phase-plan"
fi

if grep -q "Invoke writing-plans skill" "$PLUGIN_ROOT/skills/brainstorming/SKILL.md"; then
  fail "brainstorming no longer jumps to writing-plans"
else
  pass "brainstorming no longer jumps to writing-plans"
fi

if ! grep -q "current phase" "$PLUGIN_ROOT/skills/writing-plans/SKILL.md"; then
  fail "writing-plans tickets the current phase"
else
  pass "writing-plans tickets the current phase"
fi

if ! grep -q "<h2>Plans</h2>" "$REPO_ROOT/docs/index.html"; then
  fail "docs hub has Plans"
else
  pass "docs hub has Plans"
fi

if [[ "$FAILURES" -gt 0 ]]; then
  echo "STATUS: FAILED ($FAILURES failure(s))"
  exit 1
fi
echo "STATUS: PASSED"
