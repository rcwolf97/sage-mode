---
name: using-sage-mode
description: Catalog of sage-mode commands. Use only when the user asks how to invoke sage-mode, not at session start.
disable-model-invocation: true
---

# Using Sage Mode

Unslop is always on. It rewrites every reply and every doc. You do not invoke it for that. `/unslop` exists only to clean a file that already exists.

Every other skill waits for a command. Do not brainstorm, plan, review, or compound unprompted.

User instructions (CLAUDE.md, AGENTS.md, Cursor rules, direct requests) take precedence.

Docs live at `docs/index.html`. Specs, plans, tickets, pressure-tests, and learnings are short HTML. First screen is the point.

## Commands

Invoke the matching skill and follow it exactly.

**Business**
- `/pressure-test` — right problem, named customer, or kill it. Before technical design.

**Core workflow**
- `/brainstorming` — technical design only. Writes the spec.
- `/multi-phase-plan` — sequence the spec into stacked features. Not tickets.
- `/writing-plans` — tickets for the current phase, not a plan essay
- `/executing-plans` `/subagent-driven-development`
- `/test-driven-development` `/systematic-debugging` `/verification-before-completion`
- `/code-review` — gemini-3.7-flash subagent. `/requesting-code-review` is the same command
- `/receiving-code-review` — how to take findings
- `/using-git-worktrees` `/finishing-a-development-branch`
- `/dispatching-parallel-agents` `/writing-skills` `/writing-for-agents`

**Explain**
- `/teach` — how it works and why, at the person's pace

**Compounding**
- `/ce-compound` — one solved problem → `docs/learnings/<slug>.html`

**Checklists**
- `/diagnosing-bugs` — ranked hypotheses when you are already in a bug
- `/systematic-debugging` — first pass on an unfamiliar failure
- `/wayfinder` `/triage`
