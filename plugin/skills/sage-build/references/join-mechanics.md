# Join mechanics — merging a wave's worktrees

Load this at the first join of a sprint, or when a merge conflict actually
appears during step 5 of `SKILL.md`.

## Why dependency order, not wave order

A wave's nodes ran in parallel, but the graph's `depends_on` edges still
impose an order the *merge* has to respect even though the *build* didn't
need to serialize on it (each node built in its own worktree against the
sprint's base, not against its dependency's output). Merge a dependency
before its dependent so the dependent's worktree — which may have read the
dependency's pre-build state — gets reconciled against what the dependency
actually shipped, not the reverse.

Concretely: if `n4 depends_on n1`, merge `n1` into the integration branch
first, then merge `n4`. If `n4`'s work assumed something about `n1` that
changed during `n1`'s own review/fix cycle, that's exactly the kind of
mismatch the integration verify after `n4`'s merge is there to catch.

## Why the Eng Manager, never an Implementer

An Implementer resolving its own merge conflict is making the same kind of
judgment call the Reviewer step exists to catch — except with no fresh eyes on
it at all, on code the Implementer already has a stake in believing is
correct. The Eng Manager, who has seen every node's report and the shape of
the whole wave, is positioned to know which side of a conflict reflects the
sprint's actual intent. If the conflict is substantial enough that even the
Eng Manager can't resolve it confidently, that is itself worth a blocker-style
note in the ledger — it usually means two nodes' lanes should not have been
adjacent in the first place, which is feedback for the next `/sage-dag` run.

## Worked example

Wave 2 has `n4` (owns `src/api/invoices/**`) and `n5` (owns
`src/api/invoices/lines.ts`, depends_on `n4`). Both ran in parallel worktrees
against the same base commit. At join:

1. Merge `n4`'s worktree into the integration branch first (it has no
   dependencies of its own in this wave).
2. Rebase or merge `n5`'s worktree onto the now-updated integration branch.
   `n5` had built `lines.ts` against the base's version of the invoices
   module; if `n4` changed a function signature `lines.ts` calls, this step
   is where that surfaces — as a merge conflict or, worse, a silent type
   mismatch the integration verify should catch.
3. Run the integration verify (the sprint-level `verify`, distinct from
   either node's own `verify`) against the merged result, not just each
   node's individual evidence record — a node passing its own verify in
   isolation does not guarantee the combination is correct.
4. Update `ledger.md`: both nodes' status, the join's own record (which
   nodes joined, whether the integration verify passed), and pointers to the
   evidence.
5. Remove both worktrees only if the merge left them clean. If resolving the
   conflict required a commit inside `n5`'s worktree that hasn't been
   reflected back, leave that worktree in place and report it rather than
   deleting work that only exists there.

## What "clean" means for worktree removal

A worktree is clean to remove when its own branch has been fully merged and
`git status` inside it reports no uncommitted changes. A worktree with
uncommitted changes — even ones that look trivial, like a stray debug log
line — is left in place. Deleting it would destroy the only copy of that
change; the cost of leaving one extra worktree around for a cycle is far
lower than the cost of silently losing work.
