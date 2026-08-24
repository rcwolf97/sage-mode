---
name: sage-build
description: Execute the DAG. Serial at minimum, parallel worktrees when lanes allow. Resume from the ledger.
disable-model-invocation: true
---

# sage-build

Eng Manager persona in this thread. Implementers are Lane A subagents. Pin `is_background: false`.

## Procedure

1. `sage board next`. If a ledger exists, **resume** — never restart.
2. `sage dag plan` → waves. For each wave:
   a. `sage dag lanes --wave N`. Abort the wave on any intersection.
   b. For each node: `sage dag worktree <id>`, write `.sage/lane` (`{"node","owns"}`), write `briefs/<id>.md` from the template.
   c. Dispatch **all nodes of the wave in a single message**, one Task per node, brief **path** only.
   d. Partial failure is not fatal: log, continue, report at the join.
3. **Implementer contract:** failing test first; implement minimally; `sage evidence run --label <id> -- <verify>`; commit per acceptance; write `reports/<id>.md`. Code written before its test is deleted, not adapted. High-risk nodes use `grok-4.6`. Escalation never crosses into Lane C.
4. **Per node, dispatch Reviewer** on the node diff (ARTIFACT+CONTRACT). At most 3 fix cycles.
5. **Join.** Merge worktrees in dependency order. You own conflicts. Integration verify. Update ledger. Remove only clean worktrees.
6. **Circuit breaker** (mechanical counts only):

```
WTF-LIKELIHOOD: start 0
  each revert: +15
  each fix touching >3 files: +5
  after the 15th fix: +1 each
  touching files outside any node's owns: +20
> 20 → STOP and ask. Hard cap: 50 fixes per sprint.
```

7. **Blockers.** Implementer writes `board/<id>.blocker.md` and exits. You rule into `board/<id>.answer.md`. Escalate only: destructive ops, security, effects outside the worktree, plan defects.

Lane enforcement: `.sage/lane` is active during a node. Out-of-lane writes are denied (or recorded for revert). Amend owns only after `sage dag lanes` still passes.

If no `docs/design/brief.md` exists and a node has `design: required`, block that node and tell the user to run `/design-intake` first.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll re-run the whole wave, it's simpler" | Re-dispatching completed work is the most expensive failure in this system. Resume from the ledger. |
| "I'll paste the brief into Task so they don't miss it" | Pasted briefs stay in your context forever. Pass the path. |
| "Background subagents are fine" | Pin is_background false. Defaults change under you. |
| "I tested it manually" | Manual testing doesn't persist. Evidence records do. |
| "One more file outside the lane" | Write a blocker. Do not widen in secret. |

## Red Flags

- Restarting a sprint that has a ledger
- Dispatching completed node ids
- No evidence record on a done node
- WTF score ignored past 20
- Implementer guessing instead of blocking

## Done when

Every node is `done` or `abandoned`, the ledger is current, joins have integration verify, and the branch is presented for approval.
