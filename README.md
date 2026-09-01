# Sage Mode

Opt-in skills for Cursor and Claude Code. Unslop is always on. Everything else waits for a slash command.

This is a fork of [obra/superpowers](https://github.com/obra/superpowers), trimmed to Cursor + Claude, plus compounding, teach, unslop, pressure-test, multi-phase-plan, and Pocock checklists.

**Read the docs in a browser:** open [`docs/index.html`](docs/index.html). First screen is the point.

## Install

### Cursor

1. Open **Customize → Plugins**.
2. Add a marketplace: `https://github.com/rcwolf97/sage-mode`
3. Install **sage-mode**.
4. **Developer: Reload Window**.

Local checkout (plugin directory, not the repo root):

```bash
ln -s "$(pwd)/plugins/sage-mode" ~/.cursor/plugins/local/sage-mode
```

### Claude Code

```bash
/plugin marketplace add rcwolf97/sage-mode
/plugin install sage-mode@sage-mode
```

## Commands

Type the slash command. Skills do not auto-trigger except unslop, which is a rule. On Cursor, `/requesting-code-review` is not listed; use `/code-review`.

**Business**
`/pressure-test`

**Workflow**
`/brainstorming` `/multi-phase-plan` `/writing-plans` `/executing-plans` `/subagent-driven-development` `/test-driven-development` `/systematic-debugging` `/verification-before-completion` `/code-review` `/receiving-code-review` `/using-git-worktrees` `/finishing-a-development-branch` `/dispatching-parallel-agents` `/writing-skills` `/writing-for-agents`

`/brainstorming` writes the spec. `/multi-phase-plan` sequences it into stacked features. `/writing-plans` publishes tickets for the current phase. `/code-review` dispatches a gemini-3.7-flash reviewer. `/requesting-code-review` is the same command.

**Explain**
`/teach`

**Compounding**
`/ce-compound`

**Checklists**
`/diagnosing-bugs` `/wayfinder` `/triage`

`/unslop` cleans an existing file. You do not need it for new replies.

`/using-sage-mode` lists the same catalog if you forget.

## Layout

```
.cursor-plugin/marketplace.json   Cursor marketplace (pluginRoot: plugins)
.claude-plugin/marketplace.json   Claude Code marketplace
plugins/sage-mode/                plugin body
  .cursor-plugin/plugin.json
  .claude-plugin/plugin.json
  claude-commands/                Claude Code slash files (not commands/, so Cursor will not list them)
  skills/                         skill bodies; Cursor slash via disable-model-invocation
  agents/                         code-reviewer (gemini-3.7-flash)
  rules/                          unslop, always on
  hooks/                          present but empty
docs/index.html                   hub
```

## Tests

```bash
bash tests/hooks/test-session-start.sh
bash tests/shell-lint/test-lint-shell.sh
```

See [docs/testing.html](docs/testing.html).

## License

MIT. See LICENSE. Upstream copyright remains with Jesse Vincent. `/ce-compound` is from Compound Engineering. `/teach` and `/unslop` are from pstack. `/multi-phase-plan` is adapted from pstack's multi-phase playbook. `/pressure-test` draws from gstack office-hours and Pocock grilling. Tickets from Pocock to-tickets. `/writing-for-agents` from Pocock. Checklists from Matt Pocock. This fork: [rcwolf97/sage-mode](https://github.com/rcwolf97/sage-mode).
