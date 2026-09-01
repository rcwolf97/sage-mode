---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
disable-model-invocation: true
---

# Executing Plans

## Overview

Load the spec, the current phase from the multi-phase plan, and the ticket index. Review critically, execute this phase's frontier, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement these tickets."

**Note:** Sage Mode works much better with subagents (Cursor and Claude Code both qualify). If subagents are available, use sage-mode:subagent-driven-development instead of this skill.

## The Process

### Step 1: Load tickets
1. Isolated workspace: sage-mode:using-git-worktrees
2. Read the spec, the current phase section in `docs/plans/<feature>/index.html`, and `docs/tickets/<feature>/index.html` (or the tracker set they named)
3. Review the breakdown against this phase only. Raise real problems before starting.
4. Todos: every ticket whose blockers are done. That is the frontier.

### Step 2: Execute the frontier

For each unblocked ticket:
1. Mark in_progress
2. Follow that ticket. TDD. Do not start a blocked ticket.
3. Run the verifications it names
4. Mark completed, then recompute the frontier

### Step 3: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use sage-mode:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice
- After merge, the next unblocked phase in the multi-phase plan is a new `/writing-plans` run. Do not reticket this phase.

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Tickets have critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow the ticket exactly
- Don't skip verifications
- Reference skills when a ticket says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent
