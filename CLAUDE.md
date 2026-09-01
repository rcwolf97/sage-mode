# Sage Mode — contributor notes

This repo is a Cursor + Claude Code plugin. The installable plugin is `plugins/sage-mode/`. Skills live in `plugins/sage-mode/skills/`. Claude Code slash entry is `plugins/sage-mode/commands/`. Cursor slash entry is the skills themselves (`disable-model-invocation: true`). Do not register `commands/` in `.cursor-plugin/plugin.json` or Cursor lists every command twice.

Unslop is always on: `plugins/sage-mode/rules/unslop.mdc` (`alwaysApply: true`) plus `plugins/sage-mode/skills/unslop/SKILL.md` with no `disable-model-invocation`. Do not add that flag to unslop. Do not restore SessionStart injection. Do not add harness support. Do not remove `disable-model-invocation: true` from any other skill.

`/requesting-code-review` is an alias. The skill is `plugins/sage-mode/skills/code-review/`. Do not recreate `skills/requesting-code-review/`.

Docs for humans are HTML off `docs/index.html`. First screen is the point. Extra goes in `<details>`. `/multi-phase-plan` writes `docs/plans/<slug>/`. `/writing-plans` writes tickets under `docs/tickets/` for the current phase, not a plan essay.

`/ce-compound` writes to `docs/learnings/` in the **target repo**, not into this plugin's tree except when dogfooding.

## Tests

```bash
bash tests/hooks/test-session-start.sh
bash tests/shell-lint/test-lint-shell.sh
```
