---
name: code-simplify
description: Catalog skill — delete, reduce branching, name the residual complexity. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "making a module smaller without changing behaviour"
---

# code-simplify

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Measure before touching anything: branch count, nesting depth, or cyclomatic complexity per function. A baseline number, not a feeling about how the code reads.
2. Distinguish shorter from simpler: collapsing five lines into one dense expression cuts line count but not the number of states a reader has to hold at once. Only count it as a win if the branch count drops too.
3. Replace nested conditionals with guard clauses that return early, eliminating whole else-branches, rather than just re-indenting the nesting.
4. Delete before you abstract: check whether a branch handles a case that no longer occurs (a retired format, a flag that's now always true) before building a cleaner wrapper around it.
5. When complexity is genuinely irreducible, name it: extract the branchy part into one well-named function or a lookup table so every caller sees one call instead of the branching, even if total line count barely moves.
6. Re-run the existing test suite before and after; where coverage of the exact branch you're touching is thin, add a characterization test first so "simplify" can't silently become "change behavior."
7. Review the diff line by line and confirm each removed line was inert — a deleted null check that happened to be load-bearing for one caller is a regression wearing a cleanup's clothes.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Fewer characters means simpler code" | A dense one-liner with three chained ternaries has the same branch count as the nested if it replaced — the reader now has to unpack it in one pass instead of several. |
| "This function is only 15 lines, it's already simple" | Line count doesn't track cyclomatic complexity. A 15-line function with six nested conditionals is harder to reason about than an 80-line flat dispatch table. |
| "I'll simplify by adding a helper layer" | An extra indirection that doesn't eliminate a branch just relocates it. The reader now follows a hop to find the same complexity, in a worse spot. |
| "I can tell this branch is unreachable, I'll cut it" | Confirm it with a reachability check or a coverage report before deleting — "I can tell" is exactly the assumption dead code review exists to catch. |

## Red Flags

- Diff adds files or indirection but the total branch count is unchanged
- A "simplification" PR touches call sites outside the stated target
- A comment is added to explain why removed logic was safe, instead of the ambiguity actually being resolved
- No test file touched despite an edge-case branch being deleted

## Done when

A complexity metric (branch count or cyclomatic complexity, not LOC) measurably decreased, the full test suite passes unchanged, and any remaining irreducible complexity is named at its boundary in code or a comment.
