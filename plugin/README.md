# Sage Mode plugin

Sprint-shaped delivery for **Cursor**. macOS is the supported platform. Claude Code is not a supported host — reopen only if you actually start using it regularly.

## What this is

An engineering organization you command: `/sage-shape` → `/sage-plan` → `/sage-dag` →
`/sage-build` → `/sage-review` → `/sage-verify` → `/sage-ship` → `/sage-retro`, plus
the everyday Spine B verbs `/sage-crit` `/sage-fix` `/sage-look` `/sage-oh`.
Discipline is enforced in code rather than requested in prose — the confidence gate, the
dedup fingerprint, the WTF circuit breaker and the recommendation check are all executable
and are the only paths to their results.

## Install (local development)

This directory (`plugin/`) is the plugin root — it is what Cursor loads, not the
repository root.

**Cursor**
```bash
ln -s "$PWD" ~/.cursor/plugins/local/sage-mode
# Cursor: Developer: Reload Window
```

Cursor reads `.cursor-plugin/plugin.json` and `hooks/hooks.json`. Do **not** use
`/add-plugin <this-repo-url>` — the repository root one level up is a *marketplace*,
not this plugin.

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

## Audit surface

```bash
sage egress list      # every payload sent to a third-party model
sage egress verify    # recompute the hash chain; exit 3 on tamper
sage egress grants    # what can leave, and the exact command that revokes it
sage ground <file>    # mechanical + semantic citation check
sage review doc <file>
```
Lane B sends to Anthropic, Lane C sends diffs to a metered reviewer. Payloads are redacted for
secrets before they leave and every send is recorded.

## Development

```bash
npm install
npm run verify           # build:check, test, lint, hooks, eval:tier3
```

Zero runtime npm dependencies. `marked` and `mermaid` are vendored.
