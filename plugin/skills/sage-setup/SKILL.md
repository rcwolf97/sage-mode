---
name: sage-setup
description: Install SAGE_HOME, the sage shim, project config, gitignore, assets, and optional project agent copies.
disable-model-invocation: true
---

# sage-setup

Run `sage setup`. Resolves plugin root, writes `~/.sage/config.json` and `~/.sage/bin/sage`, adds `.sage/` to `.gitignore`, copies notebook assets, writes `.sage/config.json`, copies role cards into `.cursor/agents/` unless `--no-project-agents`.

Trust the current repo as a consult root.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The plugin is installed, skip setup" | Commands call `sage`. Without the shim, SAGE_HOME is wrong after a cache-hashed install. |

## Red Flags

- Shim not executable
- `.sage/` committed
- Agents not copied when SPIKE-02 fallback is needed

## Done when

`~/.sage/bin/sage --version` works from a fresh shell and the project has `.sage/config.json`.
