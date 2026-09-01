# Sage Mode — contributor notes

This repo is a Cursor + Claude Code plugin. Skills live in `skills/`. Slash commands in `commands/` are the entry point for every skill except unslop.

Unslop is always on: `rules/unslop.mdc` (`alwaysApply: true`) plus `skills/unslop/SKILL.md` with no `disable-model-invocation`. Do not add that flag to unslop. Do not restore SessionStart injection. Do not add harness support. Do not remove `disable-model-invocation: true` from any other skill.

`/requesting-code-review` is an alias. The skill is `skills/code-review/`. Do not recreate `skills/requesting-code-review/`.

Docs for humans are HTML off `docs/index.html`. First screen is the point. Extra goes in `<details>`. `/multi-phase-plan` writes `docs/plans/<slug>/`. `/writing-plans` writes tickets under `docs/tickets/` for the current phase, not a plan essay.

`/ce-compound` writes to `docs/learnings/` in the **target repo**, not into this plugin's tree except when dogfooding.

## Tests

```bash
bash tests/hooks/test-session-start.sh
bash tests/shell-lint/test-lint-shell.sh
```
