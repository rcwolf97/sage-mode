---
name: sage-plan
description: Sprint planning. Product + Architect. Writes docs/sprints/NN-<slug>/spec.md.
disable-model-invocation: true
---

# sage-plan

Models Monday-morning sprint planning. Product on Lane B as in sage-shape; Architect as a Lane A `grok-4.6` subagent for feasibility.

## Procedure

1. Refuse if no approved roadmap exists.
2. Propose candidates from the roadmap and open findings (`sage recall`).
3. One question at a time on priority and sequence.
4. Consult Architect on feasibility and risk for anything non-obvious. Pass a brief **path**.
5. State what is explicitly **not** in this sprint.
6. Define "shipped" per item as an observable.
7. Write `docs/sprints/NN-<slug>/spec.md` from `templates/spec.md` with `readiness: requirements-only`.
8. Update the roadmap status column with a link.
9. Render spec + index. Gate with a decision brief.

`/sage-dag` MUST refuse a spec that is not at least `requirements-only`. `/sage-build` MUST refuse a plan whose spec is not `implementation-ready`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll figure out done-conditions during build" | Vague done-conditions become unbounded sprints. Write observables now. |
| "Non-goals are obvious" | If they are not written, they get built. |
| "Skip the architect, I know the stack" | Feasibility is the Architect's job. Consult on anything non-obvious. |
| "This is just a bugfix, no spec needed" | A sprint without a spec cannot be verified or shipped. |

## Red Flags

- Spec missing readiness frontmatter
- Items without observable done-conditions
- No named risks
- Verification profile unset
- Proceeding without approval

## Done when

Spec HTML renders, readiness is set, every item has an observable, non-goals and risks are named, and the user approved the sprint.
