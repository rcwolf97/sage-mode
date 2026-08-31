---
name: sage-plan
description: Sprint planning. Product + Architect. Writes <notebook>/sprints/NN-<slug>/spec.md.
disable-model-invocation: true
---

# sage-plan

Models Monday-morning sprint planning: the product manager and the engineering
manager arguing about what ships this week, with the user in the room. Product
runs on Lane B as in `sage-shape` (`sage consult --role product --session --brief
<file>`); the Architect is consulted as a Cursor subagent on Lane A (`grok-4.6`)
for feasibility and risk only — turning the approved spec into a task graph is
`/sage-dag`'s job, not this one.

**Reads:** `<notebook>/roadmap.md`, open findings from the last `/sage-review`,
`sage recall`.
**Writes:** `<notebook>/sprints/NN-<slug>/spec.{md,html}`, the roadmap status
column. (`<notebook>` is the configured notebook root, `docs/` by default —
see `rules/sage-conduct.mdc`.)

## Procedure

1. **Refuse if no approved roadmap exists.** `<notebook>/roadmap.md` must exist with
   `status: approved`. Point the user at `/sage-shape` instead of guessing at
   scope from nothing.
2. **Ground.** Read the roadmap, and `sage recall "<candidate sprint framing>"
   --kind learning` plus `--kind out-of-scope` for prior sprints that touched
   the same area. A sprint that repeats a documented mistake is a planning
   failure, not bad luck. An out-of-scope hit is a previously rejected
   concept — do not put it on the candidate list without naming the reject.
3. **Propose candidates.** Pull from roadmap rows not yet shipped, plus open
   findings carried over from the last review. Present them as a plain numbered
   list first — this is a menu, not yet a decision.
4. **One question at a time on priority and sequence.** Use the decision-brief
   shape from `rules/sage-conduct.mdc` (not restated here). Typical questions:
   which candidates make the cut, what order they build in, whether any two
   compete for the same files or the same review budget.
5. **Consult the Architect for anything non-obvious.** "Obvious" means an
   experienced engineer would size it the same way without looking: a CRUD
   field, a copy change. Anything else — a new integration, a schema change on
   a live table, a cross-cutting refactor, an item whose done-condition depends
   on a system you have not read — gets a consult. Write the question to
   `.sage/sprints/NN/plan-brief.md` and dispatch `architect` against that
   **path**; never paste the brief's contents into the dispatch prompt. See
   `references/architect-consult.md` if it is unclear whether a given candidate
   crosses the "non-obvious" line.
6. **State what is explicitly not in this sprint.** One line per excluded
   candidate and why. An unwritten non-goal gets built by week's end.
7. **Define "shipped" per item as an observable.** Not "the feature works" —
   the specific command, response, or screen state that proves it. See
   `references/spec-quality.md` if a done-condition keeps drifting back to
   "works correctly."
8. **Write the spec** to `<notebook>/sprints/NN-<slug>/spec.md` from
   `templates/spec.md`, with `readiness: requirements-only`. It MUST contain:
   - the goal, in one sentence;
   - the item list, each with an observable done-condition and an owner;
   - explicit non-goals;
   - named risks, each with an owner;
   - the verification profile: `web` / `api` / `cli` / `ai-product`.
9. **Update the roadmap** status column for each item taken into the sprint,
   linking to the spec. Amend, do not delete — mark superseded rows.
10. **Render.** `sage notebook render <notebook>/sprints/NN-<slug>/spec.md`, then
    `sage notebook index`. Advisory, non-blocking: `sage review doc` on that spec
    (checklist `skills/sage-review/references/checklists/design-doc.md`).
    Unavailable reviewer → one-line notice, do not block the gate.
11. **Gate.** Decision brief on the assembled spec. Stop.

## The readiness contract

`spec.md` carries a `readiness` frontmatter field two other skills gate on:

```yaml
readiness: requirements-only   # set here, by /sage-plan
```

`/sage-dag` reads this spec and MUST refuse to run if `readiness` is unset or
the spec is not approved — it only ever flips the field forward, to
`implementation-ready`, once its own task graph passes `sage dag validate`
clean. `/sage-build` MUST refuse a plan whose spec is not
`implementation-ready`. This skill never writes `implementation-ready` itself
— doing so would let a sprint reach `/sage-build` with a spec nobody checked
for a buildable decomposition. If a spec needs revision after `/sage-dag` has
already run, whoever edits it MUST reset `readiness` to `requirements-only`.

## Conduct

Assumes `rules/sage-conduct.mdc` is loaded. Cursor applies it automatically
every session. sage-mode is Cursor-only.

## Non-interactive

Steps 4 and 11 have no one to answer them. Take every proposed candidate
from step 3 rather than asking which makes the cut, order them by roadmap
row order and dependency, and write the spec unapproved — `readiness:
requirements-only` still gates `/sage-dag` behind a human eventually
approving it, so nothing downstream runs on an un-reviewed guess. Terminal:
`Plan complete: spec drafted, unapproved` or `Plan blocked: <reason>` (e.g.
no approved roadmap).

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll figure out done-conditions during build" | Vague done-conditions become unbounded sprints. Write observables now. |
| "Non-goals are obvious" | If they are not written, they get built. |
| "Skip the architect, I know the stack" | Feasibility is the Architect's job. Consult on anything non-obvious. |
| "This is just a bugfix, no spec needed" | A sprint without a spec cannot be verified or shipped. |
| "One risk line covers the whole sprint" | An unowned risk is nobody's job when it fires. Name an owner per risk. |
| "I'll batch the priority and sequence questions" | A wall of questions gets a wall of shallow answers. One at a time is the method. |
| "The roadmap already says why, no need to repeat it" | The spec is what `/sage-dag` and `/sage-build` read. If the why isn't in the spec, it isn't in the sprint. |

## Red Flags

- Spec missing `readiness` frontmatter, or `readiness` set to `implementation-ready` by this skill
- Items without observable done-conditions ("works", "correctly", "as expected" with no qualifier)
- No named risks, or a risk with no owner
- Verification profile unset
- Architect brief contents pasted into the dispatch prompt instead of a path
- Proceeding without an explicit user approval

## Done when

Spec HTML renders, `readiness: requirements-only` is set, every item has an
observable done-condition and an owner, non-goals and risks are named, the
verification profile is set, and the user approved the sprint.
