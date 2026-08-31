---
name: sage-dag
description: Decompose an approved sprint spec into a validated task DAG with file lanes.
disable-model-invocation: true
---

# sage-dag

Turns an approved spec into a task graph the parallel build in `/sage-build`
can actually execute. Architect runs as a Cursor subagent on Lane A
(`grok-4.6`). There is no `--json-schema` equivalent on a Cursor subagent the
way there is on a `claude -p` call — the schema cannot be enforced at the tool
layer, which is why step 4's validate loop is load-bearing and not a safety
net (see below).

**Reads:** the approved spec, the codebase.
**Writes:** `dag.json`, `plan.{md,html}`.

## Procedure

1. **Refuse if the spec's `readiness` is unset, or the spec is unapproved.**
   `requirements-only` or later is the minimum. Point the user at `/sage-plan`
   rather than guessing at scope from an incomplete spec.
2. **Survey the codebase for what each item actually touches.** This is what
   makes `owns` globs real instead of guessed. For each spec item, find the
   files and directories a change would plausibly land in — read the relevant
   modules, don't infer from naming conventions alone. Note candidate
   directories per item; this becomes the raw material the Architect's `owns`
   globs are checked against, not a replacement for the Architect's own read.
3. **Build the brief and dispatch the Architect.** Write
   `.sage/sprints/NN/architect-brief.md` containing the spec's goal, item
   list with done-conditions, the survey from step 2, and the node-authoring
   rules below. Dispatch `architect` against that **path** — never paste the
   brief's contents into the dispatch prompt.

   **Node-authoring rules the brief MUST convey**, stated in
   `agents/architect.md`:
   - Every acceptance criterion is observable: "returns 429 after 100
     requests/minute/key," not "rate limiting works."
   - Every `verify` is a command that exists in this repo and exits non-zero
     on failure.
   - `owns` is the narrowest glob set that can complete the node. A node
     owning `src/**` is a planning failure, not a shortcut.
   - Prefer more nodes with tighter lanes over fewer nodes with wide ones.
     **The objective is maximum independent work per review, not maximum
     concurrency** — parallelism costs tokens linearly and review effort
     superlinearly.
   - Name failure modes specifically: the exception class, what triggers it,
     what catches it, what the user sees, whether it's tested. Never "handle
     errors."
4. **Validate every wave. On any violation, do not present the graph.** Run
   `sage dag validate` against the returned `dag.json`, then `sage dag lanes
   --wave N` for every wave `sage dag plan` produces. If either reports a
   D1–D7 violation (table below), return the specific violations to the
   Architect and re-consult — **up to twice**. If a third round still fails,
   stop and escalate to the user with the specific conflict named; do not
   keep iterating past two round trips on your own judgment. Budget for two
   round trips as the normal case, not a sign something is wrong.

   **Why this loop is load-bearing, not a safety net:** a `claude -p` call can
   enforce `--json-schema` at the tool layer — a malformed response simply
   fails to parse. A Cursor subagent has no equivalent; the Architect's
   `dag.json` reaches you as ordinary output, schema-shaped only if the model
   got it right. `sage dag validate` and `sage dag lanes` are therefore the
   only thing standing between a malformed or unsafe graph and `/sage-build`
   actually dispatching parallel writers against it. Treat a validate failure
   as the expected first draft, not an anomaly to route around.
5. **Render `plan.html`.** DAG as a mermaid diagram, the wave table, and
   per-node acceptance criteria, from `templates/plan.md`. See
   `references/plan-rendering.md` for the mermaid structure and wave table
   columns.
6. **Set `readiness: implementation-ready`** on the spec, but only after a
   valid graph exists — never speculatively, and never before validation
   passes clean.
7. **Gate**, surfacing three things explicitly in the decision brief: every
   node with `verify: "none"`, every `risk: high` node, and the concurrency
   plan (which waves run how many nodes in parallel).

## D1–D7 — the invariants `sage dag validate` enforces

Not expressible in the JSON Schema alone; violating any of these is why step 4
refuses to present the graph.

| # | Invariant | Why |
|---|---|---|
| D1 | `depends_on` references exist; the graph is acyclic | Executability |
| D2 | No two nodes that can run **concurrently** have intersecting `owns` globs | Prevents split-brain duplication and same-file merge conflicts before they happen |
| D3 | A node's `owns` is not `**`, `*`, or the repo root | A lane that owns everything is not a lane |
| D4 | Every `acceptance` string is observable — the substrings "works", "correctly", "properly", "as expected" with no further qualifier are rejected | "Seems right" is not done |
| D5 | `verify: "none"` is surfaced in the gate summary with the node id | The user approves the absence of verification explicitly, never silently |
| D6 | A node whose `owns` resolves to a single file over 800 lines is flagged | The "megafile" swarm failure mode |
| D7 | A `risk: high` node is not scheduled in the same wave as more than two others | Blast-radius containment |

D2 is evaluated over concurrency classes from the topological layering, not
over all pairs — two nodes with overlapping lanes are legal if one depends on
the other and so never actually runs alongside it. See
`references/glob-intersection.md` if a `sage dag lanes` violation names an
overlap that isn't obvious from reading the globs.

## Conduct

Assumes `rules/sage-conduct.mdc` is loaded. Cursor applies it automatically;
on a host without an always-applied rules mechanism (Claude Code), the
operator must get its content into the session some other way (e.g. folded
into the project's `CLAUDE.md`) before running this skill.

## Non-interactive

Step 7's gate has no one to answer it. If the validated graph carries no
`verify: "none"` node and no `risk: high` node, set `readiness:
implementation-ready` and proceed unapproved — those two conditions are
exactly what the gate exists to surface for a human, so their absence is a
safe default. If either is present, stop before setting `readiness` and
report it rather than guessing at an approval. Terminal: `Dag complete:
graph validated, readiness set` or `Dag blocked: <node id> needs
verify/risk review`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Validation can happen after the user sees it" | A graph that failed validate must never be presented as a plan. Fix it first. |
| "owns: src/** is simpler" | A node owning `src/**` is a planning failure — it blocks every other node from running alongside it. |
| "I'll skip the lanes check, the files don't exist yet" | Prefix overlap still intersects on an empty tree. False positives are acceptable; false negatives are not. |
| "One node for the whole sprint" | The objective is maximum independent work per review, not fewer nodes. |
| "Three round trips can't hurt, the graph will be better" | Two is the budget. A third round trip means the disagreement is real — escalate it, don't keep negotiating alone. |
| "I already surveyed the codebase for the spec, no need to redo it" | The spec's survey was for feasibility sizing. This survey is for exact `owns` globs — different granularity, redo it. |

## Red Flags

- Presenting a graph that failed `sage dag validate` or `sage dag lanes`
- Acceptance criteria containing "works" / "correctly" / "as expected" with no qualifier
- A high-risk node scheduled in a wave with more than two others
- Architect brief contents pasted into the Task dispatch prompt instead of a path
- More than two re-consult round trips without escalating to the user
- `readiness: implementation-ready` set before a valid graph exists

## Done when

`dag.json` validates clean, every wave's parallel nodes have disjoint lanes,
`plan.html` renders with the mermaid DAG and wave table, every `verify: "none"`
and `risk: high` node was shown at the gate, `readiness: implementation-ready`
is set, and the user approved the graph.
