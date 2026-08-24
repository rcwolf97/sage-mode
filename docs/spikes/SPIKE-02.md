---
title: SPIKE-02 — Do plugin-shipped subagents honor model frontmatter?
kind: note
status: not-run
created: 2026-08-24
updated: 2026-08-24
tags: [spike, agents, cost-lanes]
---

# SPIKE-02 — Do plugin-shipped subagents honor `model` frontmatter?

> **In plain terms:** The cost architecture requires pinning Reviewer/Red Team/etc. to a non-Anthropic model from a plugin-shipped role card. Cursor documents `model` on `.cursor/agents/` files and an `agents` path on plugin manifests separately, but never states the two compose. **This spike has not been executed against live Cursor.**

## Status: NOT EXECUTED

This spike was **not run against live Cursor in this pass.** The entire cost architecture (§2.3) and role-card system (§9) **assume PASS** — that a plugin manifest's `agents` path is honored the same way `<project>/.cursor/agents/` is, including the `model:` frontmatter pin. That assumption has not been verified for real and **must be verified by running the procedure below in live Cursor before this is depended on in production.**

## Procedure (tech-spec.md §3, live — not yet run)

1. `ln -s "$PWD/tools/spikes/spike-02" ~/.cursor/plugins/local/sage-probe`
2. **Developer: Reload Window**
3. Dispatch: `Use the probe subagent.`
4. Confirm the reply names the pinned model (`gemini-3.7-flash`) and that Cursor's usage breakdown attributes the tokens to it.

**Pass:** the reply names the pinned model, and usage attributes to it.
**Fail:** the subagent runs on the session's default model instead.

## What ships today, given the unverified assumption

Every role card in `plugin/agents/*.md` declares its `model:` frontmatter directly (Architect → `grok-4.6`, Reviewer/Red Team/Design Critic → `gemini-3.7-flash`, implementers → `grok-4.5`, etc.), shipped from the plugin's `agents/` path exactly as the normative role-card format in §9 specifies. This is the assumed-PASS path and nothing in this repo currently installs a project-local copy under `<project>/.cursor/agents/`.

## If this spike is run and FAILS

Per tech-spec.md §3's stated fallback: role cards must instead be installed into `<project>/.cursor/agents/` by `/sage-setup`, since project-local agent files are documented to honor `model:`. This adds an install step and a staleness problem (project copies drifting from the plugin's shipped versions as sage-mode is updated), and **WP-01 and WP-09 change** to account for the install/refresh step and the staleness handling.

## Probe harness

`tools/spikes/spike-02/` (a minimal plugin with `.cursor-plugin/plugin.json` and `agents/probe.md`) exists and is ready to run. No live result has been captured in this environment (no live Cursor available here). Whoever runs this for real: record the actual reply and usage attribution here, flip `status` to `decided`, and record PASS/FAIL above.

## Consequence for WP-01 / WP-09

Not yet re-estimated, because the spike has not run. If it fails, re-estimate per the paragraph above before role cards are relied on for cost-lane pinning in production.
