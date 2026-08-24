---
name: sage-dag
description: Decompose an approved sprint spec into a validated task DAG with file lanes.
disable-model-invocation: true
---

# sage-dag

Architect as a Cursor subagent on Lane A (`grok-4.6`). There is no `--json-schema` on subagents — `sage dag validate` is load-bearing.

## Procedure

1. Refuse if the spec's `readiness` is unset or the spec is unapproved.
2. Survey the codebase for files each item touches so `owns` globs are real.
3. Write `.sage/sprints/NN/architect-brief.md` and dispatch `architect` against that **path**.
4. Run `sage dag validate` and `sage dag lanes --wave N` for every wave. On any D1–D7 violation, **do not present the graph** — return violations to the Architect, up to twice, then escalate to the user with the specific conflict.
5. Write `docs/sprints/NN-<slug>/dag.json` and `plan.md`. Render plan HTML with a mermaid DAG.
6. Set spec `readiness: implementation-ready` only after a valid graph is approved.
7. Gate, surfacing every `verify: "none"`, every `risk: high`, and the concurrency plan.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Validation can happen after the user sees it" | A violating graph must never be presented as a plan. |
| "owns: src/** is simpler" | A node owning src/** is a planning failure. |
| "I'll skip lanes check, files don't exist yet" | Prefix overlap still intersects on an empty tree. False positives are acceptable; false negatives are not. |
| "One node for the whole sprint" | Objective is maximum independent work per review, not fewer nodes. |

## Red Flags

- Presenting a graph that failed validate
- Acceptance containing "works" / "correctly" / "as expected" with no qualifier
- High-risk nodes in a wave of more than two others
- Brief contents pasted into the Task prompt

## Done when

`dag.json` validates, parallel nodes have disjoint lanes, plan.html renders, verify-none and high-risk nodes were shown, and the user approved the graph.
