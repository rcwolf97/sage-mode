---
name: sage-setup
description: Install SAGE_HOME, the sage shim, project config, gitignore, assets, and optional project agent copies.
disable-model-invocation: true
---

# sage-setup

The bootstrap every other skill and hook depends on. A bug here breaks path resolution — and therefore every `sage <subcommand>` call — everywhere else. Safe and expected to re-run: re-running repairs drift (a plugin update, a stale cached path), it doesn't duplicate state.

## Procedure, in order

1. **Resolve the plugin root for this session.** Cursor installs plugins into content-hashed cache directories that change on every update, and cloud agents have a documented bug where the advertised skill path doesn't exist on the VM. Resolve the actual path this session is running from — never hardcode or reuse a remembered one.
2. **Write `~/.sage/config.json`:** `{ "sageHome": "<resolved path>", "version": "<plugin version>", "installedAt": "<ISO timestamp>" }`. Also add the current repo's root to a trusted-roots list in the same file — `sage consult` refuses to run outside a repo listed there, so skipping this breaks the first consult call of the sprint.
3. **Install the shim at `~/.sage/bin/sage`** and `chmod +x` it:
   ```bash
   #!/usr/bin/env sh
   SAGE_HOME=$(sed -n 's/.*"sageHome"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$HOME/.sage/config.json")
   exec node "$SAGE_HOME/lib/cli.js" "$@"
   ```
   Every skill invokes functionality as `sage <subcommand>`, falling back to `"$HOME/.sage/bin/sage"` when the shim isn't on `PATH`. If this step is skipped, or the file isn't executable, every downstream `sage` call fails with a confusing "command not found" rather than an obvious setup error — verify it actually runs, don't just confirm the file exists.
4. **Add `.sage/` to the project's `.gitignore`.** Append the entry if it's not already present; don't duplicate it on a re-run. Confirm `docs/` is NOT gitignored — `.sage/` is machine state, `docs/` is the committed notebook.
5. **Copy the plugin's vendored notebook assets** (`marked`, `mermaid.min.js`, `notebook.css`, and their licence files) into `<project>/docs/assets/`. This is required for self-contained rendering: `sage-notebook`'s output must work from `file://` with zero network fetches, so the JS/CSS it references has to actually exist in the project, not just in the plugin.
6. **Write `<project>/.sage/config.json`** — the project profile, verify commands, and lane config that the rest of sage-mode reads.
7. **Unless `--no-project-agents`:** copy role cards into `<project>/.cursor/agents/` — the fallback path for per-role model pinning when the plugin's own `agents` manifest field doesn't compose with subagent model selection.

## Verify
- `~/.sage/bin/sage --version` runs from a shell where only `$HOME/.sage/bin` might be on `PATH` — this confirms the shim actually resolves and execs, not just that the file exists.
- `~/.sage/config.json` shows `sageHome` matching the real, current plugin root (not a stale cache path from a prior version) and lists this repo under trusted roots.
- `.sage/` is gitignored; `docs/` is not.
- `docs/assets/notebook.css` and `docs/assets/mermaid.min.js` exist in the project.

## Common Rationalizations
| Rationalization | Reality |
|---|---|
| "The plugin is installed, skip setup" | Every skill calls `sage <subcommand>`. Without the shim and a correctly resolved `sageHome`, that call resolves to nothing — or to a stale cached path after an update. |
| "I'll skip the trusted-root write, they can add it later" | `sage consult` refuses to run outside a trusted root. Skipping this breaks the very first consult call in the sprint. |
| "Setup already ran once, re-running is redundant" | Cursor's plugin path is content-hashed and changes on update. Re-running repairs a stale `sageHome`; treat setup as idempotent, not one-shot. |

## Red Flags
- Shim written but not executable, or `sage --version` fails from a clean shell
- `sageHome` in config.json pointing at a path that no longer exists on disk
- `.sage/` committed to git, or `docs/` accidentally gitignored
- `docs/assets/` missing `mermaid.min.js` or `notebook.css` after setup claims success
- Role cards not copied when the project has no `.cursor/agents/` and the fallback is actually needed

## Done when
`~/.sage/bin/sage --version` succeeds from a fresh shell, `~/.sage/config.json` has the correct `sageHome` and lists the current repo as a trusted root, the project has `.sage/config.json` and a gitignored `.sage/`, and `docs/assets/` contains the vendored renderer assets.
