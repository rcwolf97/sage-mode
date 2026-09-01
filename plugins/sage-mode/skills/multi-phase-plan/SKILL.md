---
name: multi-phase-plan
description: Use when an approved spec exists and work spans more than one stacked feature. Break the spec into a sequence of phases that build on each other. Do not write tickets. Do not implement.
disable-model-invocation: true
---

# Multi-phase plan

**You own the plan, not the code.** The plan is a sequence of features that build the spec. `/writing-plans` turns one phase into tickets. Do not implement.

**Announce:** "I'm breaking the spec into a multi-phase plan."

Adapted from pstack's multi-phase playbook. Phases are units of work that stack. They are not PRs and they are not tickets.

## Before you write

1. Need a spec? `/brainstorming` first. This skill does not invent the product.
2. The spec must be written and approved. If they are still arguing the design, stop.
3. When the change is one or two files with an obvious approach and no spec, skip the plan. Say so and send them to the normal workflow.
4. One independently shippable capability still gets a plan. One phase. `/writing-plans` needs a named unit plus the spec.

## How to slice

Order work so each phase ends in a state you can check, and the next phase builds on it. A break caught at the phase that caused it is cheap. A break after a batch is buried.

- **Vertical features, not layers.** A phase is something someone can use. Not "all the schema" then "all the API."
- **Depends on.** No cycles. If two features each need the other, they are one phase.
- **Stable ids.** Kebab-case, chosen once. Tickets and later commands select work by these ids.
- **Coverage.** Every in-scope spec flow lands in a phase. A flow with no phase is a map bug. Out of scope stays out.
- **Prefactor first** when the change is currently hard. Then the features that need it.
- Do not drop in-scope flows to make the list shorter. Do not add features the spec did not ask for.

**Detection that you need more than one phase.** Distinct capabilities with their own consumers or data. Acceptance that could ship and be verified separately. One capability you could cut without rewriting the others.

## Quiz, then publish

Show the breakdown as a numbered list. For each phase: id, title, depends on, what you can demo when it is done, which spec sections it covers.

Ask: too coarse or too fine? Wrong edges? Merge or split? Wrong build order?

Do not publish until they approve.

## Where the plan lives

Write HTML off `docs/index.html`:

- `docs/plans/<feature-slug>/index.html`

Copy `docs/assets/sage-docs.css` if missing. Link the page from the hub under Plans. Unslop the page.

Keep every heading and every sub-block in the order shown. One section per phase.

## Skeleton

Fill every placeholder. First screen is the point. Appendices in `<details>`.

````html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><Feature> plan</title>
<link rel="stylesheet" href="../../assets/sage-docs.css">
<body>
<nav><a href="../../index.html">Docs</a></nav>
<h1><Feature> plan</h1>
<p class="lede"><What it builds, for whom, the spec it implements, the phase ids in order. Under ten lines.></p>

<p><strong>Spec.</strong> <a href="SPEC_HREF">path to the approved spec</a></p>

<h2>How to read this</h2>
<p>One section is one phase. A phase is a group of features that work together and can be checked on their own. Work the frontier: phases whose dependencies are done. <code>/writing-plans</code> turns the current phase into tickets. Then implement, review, merge. Then the next unblocked phase. Do not reticket the whole spec each time.</p>
<p>The sequence proves itself. Each phase stays green before the next begins.</p>

<h2>Build order</h2>
<table>
  <thead><tr><th>Phase</th><th>Depends on</th><th>You see</th></tr></thead>
  <tbody>
    <tr><td><code>phase-id</code></td><td>None</td><td><Demo when this phase is done.></td></tr>
  </tbody>
</table>
<p>Build order: <code>a</code> → <code>b</code>, <code>c</code> → <code>d</code></p>

<details>
<summary>Phases</summary>

<h2><Task as a verb phrase> (<phase-id>)</h2>
<p><strong>Depends on.</strong> <phase-id, or None.></p>
<p><strong>Spec.</strong> Sections this phase covers. Quote the requirement names, not "see spec."</p>
<p><strong>You see.</strong> One observable result when this phase is done. Behavior, not a layer.</p>
<p><strong>Builds.</strong> What this adds on top of its dependencies. What the next phase can assume exists.</p>
<p><strong>Out of this phase.</strong> What waits. Do not sneak it in.</p>

<h2>Close</h2>
<ul>
  <li>Every in-scope spec flow has a phase.</li>
  <li>The next step is <code>/writing-plans</code> for the frontier phase, with this plan and the spec.</li>
</ul>

<h2>Appendix A. Prototype evidence</h2>
<p>Each open question a prototype answered, with the branch, the SHA, and the artifact. Each question that stays unproven.</p>

<h2>Appendix B. Alternatives rejected</h2>
<p>Each approach weighed and why it lost.</p>

<h2>Appendix C. Risks</h2>
<p>Each risk with the phase it lands in and what to watch.</p>

<h2>Appendix D. Links</h2>
<p>Docs to read before the first tickets. The spec path again.</p>
</details>
</body>
</html>
````

Do not put file paths, failing tests, or commit messages in a phase. That is `/writing-plans`.

## Self-check

- Every spec requirement points at a phase.
- Each phase answers "what can I demo when this is done?" A phase with no answer is a horizontal slice. Split or rewrite it.
- The first phase has no blockers.
- No TBD, no "the rest of the spec," no "similar to phase N."
- Phase ids are stable kebab-case. No cycles.

## Handoff

Plan published at `docs/plans/<feature-slug>/`. Stop. Do not write tickets. Do not start `/executing-plans`.

The next skill is `/writing-plans`. It gets the spec and **this phase**, not the rest of the program.

Which phase is first?
