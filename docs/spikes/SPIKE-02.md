---
title: SPIKE-02 — Do plugin-shipped subagents honor model frontmatter?
kind: note
status: decided
created: 2026-08-24
updated: 2026-08-24
tags: [spike, agents, cost-lanes]
---

# SPIKE-02 — Do plugin-shipped subagents honor `model` frontmatter?

> **In plain terms:** The cost architecture requires pinning Reviewer/Red Team to a non-Anthropic model from a plugin. Cursor documents `model` on `.cursor/agents/` files and an `agents` path on plugin manifests, but not that they compose.

## Procedure (live)

1. `ln -s "$PWD/tools/spikes/spike-02" ~/.cursor/plugins/local/sage-probe`
2. **Developer: Reload Window**
3. Dispatch: `Use the probe subagent.`
4. Confirm the reply names `gemini-3.7-flash` and usage attributes tokens to it.

**Pass:** plugin-shipped `agents/*.md` honor `model:`.
**Fail:** `/sage-setup` copies role cards into `<project>/.cursor/agents/`.

## Implementation decision (not blocked)

Ship **both**:

1. Role cards live in `plugin/agents/` and are declared on the plugin manifest.
2. `/sage-setup` copies them into `<project>/.cursor/agents/` unless `--no-project-agents` is passed.

Skills always pass the brief **path** and name the role. If the plugin pin is honored, project copies are redundant but identical. If not, the project copies preserve Lane A/B/C.

Staleness: `/sage-setup` overwrites project copies when the plugin version in `~/.sage/config.json` changes.

## Probe harness

See `tools/spikes/spike-02/`. Live result:

```
(not yet captured in this environment — dual-install ships)
```

## Consequence for WP-01 / WP-09

Architect, reviewer, red-team, implementers, and design roles all ship with `model:` frontmatter. WP-09 does not wait on a live confirmation.
