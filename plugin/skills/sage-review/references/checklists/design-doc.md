# Design-doc checklist

Used by `sage review doc`, not by the frontend/UI specialist (`design.md`).
Dispatch Lane C, `readonly: true`, document path only. Score each dimension 1–10.
Non-blocking. Max 3 iterations; the same issue on two consecutive passes → persist
`## Reviewer Concerns` and stop.

## Completeness (1–10)

- Every claim that names a path, SHA, or command is checkable (`sage ground` already ran mechanically; this dimension is whether the *argument* has the pieces it needs).
- Missing alternatives, missing non-goals, missing "what would falsify this."

## Consistency (1–10)

- Terms match other `docs/design/*.md` in this tree. A renamed command here that is still the old name elsewhere is a 4, not a 9 with a footnote.
- Numbers (command counts, agent counts, line counts) match the tree today.

## Clarity (1–10)

- A reader who has not seen the other design docs can act. Jargon is defined on first use.
- "In plain terms" exists where the notebook kinds require it.

## Scope (1–10)

- The doc says what it will not do. Deferred/cut items stay deferred/cut.
- No silent expansion into a second project.

## Feasibility (1–10)

- Named owners and a sequence a single operator can actually run.
- Operator-gated steps (Reload Window, live Write, a calendar week) are labeled as such, not as code the agent will finish.
