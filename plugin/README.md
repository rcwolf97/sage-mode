# Sage Mode plugin

Sprint-shaped delivery for **Cursor** and **Claude Code**. macOS is the supported platform.

## What this is

An engineering organization you command: `/sage-shape` → `/sage-plan` → `/sage-dag` →
`/sage-build` → `/sage-review` → `/sage-verify` → `/sage-ship` → `/sage-retro`.
Discipline is enforced in code rather than requested in prose — the confidence gate, the
dedup fingerprint, the WTF circuit breaker and the recommendation check are all executable
and are the only paths to their results.

## Install (local development)

This directory (`plugin/`) is the plugin root — it is what the host loads, not the
repository root.

**Cursor**
```bash
ln -s "$PWD" ~/.cursor/plugins/local/sage-mode
# Cursor: Developer: Reload Window
```

**Claude Code**
```bash
claude plugin install "$PWD"     # or symlink into your plugin dir
```
Cursor reads `.cursor-plugin/plugin.json` and `hooks/hooks.json`; Claude Code reads
`.claude-plugin/plugin.json` and `hooks/hooks-claude.json`. Both share one `skills/`,
`agents/` and `commands/` tree. Hooks detect the host at runtime and emit that host's
decision shape.

Do **not** use `/add-plugin <this-repo-url>` — the repository root one level up is a
*marketplace*, not this plugin.

## First run

```bash
sage setup --check      # read-only capability report: what works, what's missing, why
sage setup              # install; reports {written, preserved, refreshed}
sage uninstall --yes    # removes only what setup wrote; never your edits
```

`sage setup --check` writes nothing. Missing optional tools are reported as gaps, not
failures — `ok: false` means something is genuinely broken, not that setup hasn't run.

**Your customizations are safe.** Setup records what it wrote in
`.sage/install-manifest.json` and never overwrites a file you edited or one it did not
write. Uninstall removes only what it still owns.

## Host differences

| Guarantee | Cursor | Claude Code |
|---|---|---|
| Lane boundary (`sage-lane`) | `preToolUse`, fail-closed | `PreToolUse`, deny + exit 2 |
| Post-hoc lane check | `afterFileEdit` | `PostToolUse` |
| Shell guard (`sage-careful`) | `beforeShellExecution` | `PreToolUse` matcher `Bash` |
| Reviewer may not spawn subagents | `subagentStart` hook | **no equivalent event** — carried as an agent-card instruction |
| Always-loaded conduct | `rules/sage-conduct.mdc` | **no `rules` concept** — load its content via your instructions file |
| Model pinning | `model:` frontmatter (grok / gemini) | `model:` frontmatter (sonnet / opus / haiku) |

Two host behaviors remain unverified against a live session — whether `preToolUse` exposes
a file path for Write, and whether plugin-shipped subagents honor `model:`. Both have
probe harnesses in `tools/spikes/` and both have coded fallbacks. Run them first.

## Audit surface

```bash
sage egress list      # every payload sent to a third-party model
sage egress verify    # recompute the hash chain; exit 3 on tamper
sage egress grants    # what can leave, and the exact command that revokes it
```
Lane B sends to Anthropic, Lane C sends diffs to Google. Payloads are redacted for
secrets before they leave and every send is recorded.

## Development

```bash
npm install
npx tsc -p tsconfig.json     # .ts and compiled .js are BOTH committed
npm test                     # 277 unit + integration tests
bash hooks/tests/run.sh      # 204 hook golden cases, per host, under sh and dash
node lib/cli.js lint
```

Zero runtime npm dependencies. `marked` and `mermaid` are vendored.
