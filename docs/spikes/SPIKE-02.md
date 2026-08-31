---
title: SPIKE-02 — Do plugin-shipped subagents honor model frontmatter?
kind: note
status: decided
created: 2026-08-24
updated: 2026-08-31
tags: [spike, agents, cost-lanes]
---

# SPIKE-02 — Do plugin-shipped subagents honor `model` frontmatter?

> **In plain terms:** The cost architecture requires pinning Reviewer/Red Team to a non-Anthropic model from a plugin-shipped role card. Cursor documents `model` on `.cursor/agents/` files. Plugin-shipped cards did not enter this session's Task enum. Claude Code plugin-shipped cards failed to load. Path A withdraws Claude Code; Cursor lane pins move to a model that exists on the Task enum.

## Status: decided

**Cursor plugin-shipped `model:`: unproven.** This chat's `Task` enum is `generalPurpose | explore | shell | cursor-guide | ci-investigator | bugbot | security-review | best-of-n-runner`. Plugin agent names are not in that list. Reload Window after the local plugin symlink was **not** performed in the original capture (`plugin/tools/spikes/spike-02-subagent-model/out/observations.md`). No host usage/cost line naming a plugin card's `model:` frontmatter exists for Cursor. Board render therefore leaves **observed model** blank and says so once at the top.

**Claude Code arm (Path A evidence, not remaining work):**

- Plugin-shipped `--plugin-dir`: **FAIL** (`--agent` not found; cards never in `agent_listing_delta`)
- Project-local `.claude/agents/` + `model: haiku`: **PASS** (host `modelUsage` named `claude-haiku-4-5-20251001`)
- Project-local gemini pin: **FAIL** (host served Claude anyway)

Path A withdraws the dual-host product claim. Claude Code results stay as the reason we do not ship a Claude Code install path, not as a fix queue.

## What ships

`/sage-setup` **does** install role cards into `<project>/.cursor/agents/` (see `plugin/lib/setup/index.ts`). The older sentence claiming setup does not copy them is **false** and is withdrawn.

Lane C cards (`reviewer.md`, `red-team.md`, `design-critic.md`) pin **`gpt-5.6-sol-medium`**, the model that exists on the current Task enum. Egress tests may still use `gemini-3.7-flash` as a fixture sink label; that is not a product pin.

Declared-vs-observed: fill observed only if a later session produces a real host usage/cost line for a plugin-shipped card. Until then, declared values are frontmatter only.

## Probe harness

`plugin/tools/spikes/spike-02-subagent-model/`. Uninstall before commit (`uninstall.sh`).
