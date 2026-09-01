---
name: writing-plans
description: Use when you have an approved spec and a multi-phase plan, or a named phase, before touching code. Breaks one phase into tickets, not a plan essay.
disable-model-invocation: true
---

# Writing plans

Turn **one phase** of an approved spec into **tickets**. A ticket is a tracer-bullet vertical slice: one demoable path through the stack, sized for one fresh context window. Do not write a ten-page plan document. Do not re-slice the whole spec into phases. That is `/multi-phase-plan`.

**Announce:** "I'm breaking this phase into tickets."

## Before tickets

If `/pressure-test` has not run and this is a new product, say so. Do not invent a customer. Technical tickets on an untested business idea are still optional if the human already accepted that risk.

Need a spec? `/brainstorming` first. This skill does not invent architecture.

Need a sequence of features that build the spec? `/multi-phase-plan` first. If an architectural spec exists and `docs/plans/<feature-slug>/` does not, stop and run that skill. Do not invent phases here.

Name the phase. Read the spec and that phase section. Tickets cover this phase only. Later phases wait.

Bounded work with no spec and no plan can still get tickets from the requirements in this conversation.

## Slice rules

- Vertical, not horizontal. Schema + API + UI + tests for one behavior, not "all the models" then "all the endpoints".
- A finished ticket is demoable or verifiable on its own.
- Prefactor first when the change is currently hard. Wide refactors are expand → migrate in batches → contract, not one tracer bullet.
- Each ticket lists **Blocked by**. No blockers means it can start now.
- Fold setup and docs into the ticket whose deliverable needs them.

## Quiz, then publish

Show the breakdown as a numbered list. For each ticket: title, blocked by, what it delivers. Ask: too coarse or too fine? Wrong edges? Merge or split?

Do not publish until they approve.

## Where tickets live

If `docs/agents/issue-tracker.md` exists, follow it. Otherwise ask where issues live. If they want local files, or they don't have a tracker:

Write HTML off `docs/index.html`:

- `docs/tickets/<feature-slug>/index.html` — first screen: spec link, current phase id, goal, approach, what would be wrong if we skip this, the frontier (tickets with no open blockers).
- `docs/tickets/<feature-slug>/<NN>-<slug>.html` — one file per ticket, numbered with blockers first.

Copy `docs/assets/sage-docs.css` if missing. Link the index from the hub. Unslop every page.

On GitHub or Linear: one issue per ticket, blockers first, native blocking links if the tracker has them. Still write the local HTML index so the hub stays the map.

Do not close or edit a parent issue.

## Ticket body

Every ticket heading is `Task N: title` (`<h1>Task N: title</h1>` in HTML). Executors extract by that heading. Number from 01 in blocker order.

First screen:

- **What to build:** end-to-end behavior, user's view.
- **Blocked by:** ids, or none.
- **Acceptance:** checkboxes. Each one is a completion criterion, not a vibe.

`<details>` for executor notes. Keep `- [ ]` in the file.

Inside details, enough that an engineer with no session history can TDD it:

- Files to create or modify (exact paths).
- Interfaces this ticket consumes and produces (names and types).
- The failing test, in code, not "add tests".
- The command that must fail, then pass.
- Commit message.

**Plan failures.** Never write: TBD, "handle edge cases", "tests for the above" with no test, "similar to ticket N", steps with no code.

File paths go stale. Put them in anyway. The ticket is for this week. If a prototype already encoded a decision (schema, state machine), paste the decision-rich bit and say it came from a prototype.

## Self-check

Point every requirement in this phase at a ticket. Spec flows that belong to later phases stay off this set. Scan for the failures above. Names and types must match across tickets. Fix inline.

## Handoff

Tickets published at `docs/tickets/<feature-slug>/`. Work this phase's frontier.

Pass the executor the spec, this phase from `docs/plans/<feature-slug>/`, and the ticket. Not the rest of the program.

1. Subagent-driven (`/subagent-driven-development`) — one fresh subagent per ticket, review between.
2. Inline (`/executing-plans`) — this session, frontier order.

When this phase's tickets are done, review, merge, then `/writing-plans` for the next unblocked phase. Do not rewrite the multi-phase plan.

Which approach?
