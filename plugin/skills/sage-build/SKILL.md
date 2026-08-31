---
name: sage-build
description: Execute the DAG. Serial at minimum, parallel worktrees when lanes allow. Resume from the ledger.
disable-model-invocation: true
---

# sage-build

Executes a validated `dag.json` — the week, not the sprint plan. Eng Manager
persona runs in this thread and owns the ledger, dispatch, joins, and
rulings; Implementers are Lane A subagents, one worktree each. Pin
`is_background: false` on every dispatch: Cursor subagents run in the
background by default, a harness default that can change under you silently,
so name the flag you depend on rather than trust the default.

**Refuse if the plan's spec is not `readiness: implementation-ready`.** Point
the user at `/sage-dag` rather than building against an unvalidated graph.
**Conduct:** assumes `rules/sage-conduct.mdc` is loaded. Cursor applies it automatically. sage-mode is Cursor-only.

**Reads:** `dag.json`, `ledger.md`.
**Writes:** commits in worktrees, `ledger.md`, board files, node reports,
evidence records.

## Procedure

### 1. Resume — never restart

Run `sage board next`. If `ledger.md` exists for this sprint, resume from
whatever it returns — never re-run `sage dag plan` from scratch and re-dispatch
everything. **Re-dispatching completed work is the single most expensive
failure mode in this system**: it burns the tokens for work already done, and
it risks a second writer landing on files a first writer already committed
inside a now-removed worktree. `sage board next` is the resume contract's own
acceptance test — given only the ledger and git state (no conversation
history), it must return the correct next action: `dispatch`, `join`, `rule`,
`review`, or `done`.

### 2. Plan waves

`sage dag plan` returns the topological waves. For each wave, in order:

**a. Check lanes, abort on any intersection.** `sage dag lanes --wave N` —
**waves are 0-indexed** (the array `sage dag plan` returns), so the first
wave is `--wave 0`; the wrong index checks the wrong wave and triggers a
spurious full-build abort. An intersection is a **planning bug**, not a
runtime condition — a graph that already passed `/sage-dag` validation
somehow reached build with overlapping lanes (a stale `dag.json`, a manual
edit, a skipped re-validation). Don't serialize the two nodes yourself; stop
the wave and send it back to `/sage-dag`.

**b. Set up worktree, lane, and brief — per node.** For each node in the
wave: `sage dag worktree <id>` to allocate `.worktrees/s<NN>-<id>`; write
`.sage/lane` inside it as `{"node": "<id>", "owns": [...]}` so the lane-boundary
hook has something to enforce; write `briefs/<id>.md` from `templates/brief.md`,
filling in the node's id, title, role, `owns`, `reads`, acceptance criteria,
`verify` command, and risk level from `dag.json`.

**c. Dispatch all nodes of the wave in a single message.** One Task call per
node, in the same assistant turn, so Cursor actually parallelizes them —
waiting and dispatching one at a time defeats the point of a wave. Pass each
Implementer the brief's **path**, never its contents. **Set `is_background:
false` explicitly on every dispatch** — all of them must finish before the
wave can join; don't omit the flag and rely on whatever the current default
happens to be.

**d. Partial failure is not fatal.** If one node in the wave blocks, errors,
or times out, log it and continue with the nodes that completed. Report the
partial state at the join — do not stall the whole wave on one stuck node,
and do not silently drop it either.

### 3. The Implementer contract

Every Implementer subagent (`agents/implementer-*.md`), per node:

1. Read the brief at its path.
2. Write a **failing test first**.
3. Implement minimally — enough to pass the test and satisfy the acceptance
   criteria, nothing beyond the node's `owns`.
4. Run `sage evidence run --label <id> -- <verify>`. **Refuses to start if
   `.sage/` or `.worktrees/` aren't gitignored** — its own writes would land
   in the fingerprint the freshness check reads later and grade it STALE
   forever. Fix `.gitignore`, or pass `--allow-unignored` knowing this run's
   evidence can never grade FRESH.
5. Commit, one commit per acceptance criterion.
6. Write `reports/<id>.md`.

**Code written before its test is deleted, not adapted.** This is stated in
exactly those words because softening it — "adapted," "refactored to fit" —
reopens the loophole it exists to close: code that predates its own test was
never actually driven by the test, and quietly keeping it defeats the point
of writing the test first. Delete it and start from the failing test.

High-risk nodes (`risk: high`) route to the harder model in the implementer
lane config, not the default. An Implementer that needs a file outside `owns`
does not widen its own lane — see Blockers, step 7. A blocker's escalation
path never crosses into Lane C: rulings come from the Eng Manager on Lane A,
and review stays where it already runs — a metered token must not generate
production code, and a blocker ruling is production-adjacent decision-making,
not review.

### 4. Reviewer, per node

Dispatch the Reviewer (mechanics in `/sage-review`) on the node's diff —
ARTIFACT+CONTRACT only, the reviewer never sees the Implementer's own claim
about what it did. Findings loop back to the Implementer for a fix; **bound
fix cycles at 3**. If the third cycle still produces findings, stop and report
which findings keep reappearing rather than looping further or forcing the
node to `done` unreviewed.

### 5. Join

Merge the wave's worktrees **in dependency order** — a node's changes land
before a node that depended on it, never the reverse. **The Eng Manager owns
conflict resolution, never an Implementer** — an Implementer resolving its own
merge conflict is reviewing its own work with no fresh eyes on it, the same
problem the Reviewer step exists to avoid. Then:

- Run the integration verify (the sprint's overall `verify`, not any one
  node's).
- Update `ledger.md`: node statuses, the join record, evidence pointers.
- Remove only **clean** worktrees. A worktree with uncommitted changes is left
  in place and reported — never deleted out from under unfinished work.

See `references/join-mechanics.md` at the first join of a sprint, or whenever
a merge conflict actually appears, for a worked example of merge order and
what "clean" means for worktree removal.

### 6. Circuit breaker

Maintain a scope-creep score across the sprint, computed from mechanical
signals only — never from a judgment call, so it can't be rationalized away
by the agent it governs:

| Signal | Score |
|---|---|
| Start of sprint | 0 |
| Each revert | +15 |
| Each fix touching more than 3 files | +5 |
| Each fix after the 15th fix in the sprint | +1 |
| All remaining findings are Low severity | +10 |
| Touching a file outside any node's `owns` | +20 |

This score is **computed, not narrated.** `computeWtf` in `lib/board/index.ts`
is the formula above as a pure function; `deriveWtfSignals` feeds it from real
repo state — revert commits and per-fix file counts from git history on each
node's branch, out-of-lane touches by diffing those files against the node's
`owns` globs in `dag.json`, and the Low-severity signal from `findings.jsonl`
(never from an empty read — no findings on record is "no data," not "all
Low"). **The Eng Manager never writes a WTF-LIKELIHOOD number into the ledger
by hand** — call `sage board wtf --sprint <id> --json` and copy its `score`
verbatim into the ledger's Circuit section. That command is the only path to
`evaluateCircuitBreaker`; there is no other way to get this number. A number
that didn't come from that call is not the circuit breaker, it's the exact
self-report failure mode this mechanism exists to close.

**Score > 20 → STOP.** Show the user what has been done so far and ask
whether to continue. This is not a suggestion to wrap up soon — halt the
current dispatch and surface the decision brief before doing anything else.

**Hard cap: 50 fixes per sprint**, full stop, regardless of score. See
`references/circuit-breaker-rationale.md` for why each signal is weighted the
way it is and a worked scoring example.

### 7. Blockers — rulings, not stalls

An Implementer that needs a ruling it cannot make itself writes
`board/<id>.blocker.md` (the question, what was tried, what unblocking would
look like) and **exits** rather than guessing. The Eng Manager reads it, rules,
and writes `board/<id>.answer.md` with the ruling and any changed constraint —
then the node can be re-dispatched against the updated brief.

**Only four categories escalate to the user mid-sprint** — everything else the
Eng Manager rules on its own and logs to the ledger:

1. Destructive operations (data loss, irreversible external side effects).
2. Security-sensitive decisions (auth, secrets, permission boundaries).
3. Effects outside the worktree (anything that isn't undone by discarding the
   branch).
4. Plan defects that invalidate the spec (the blocker reveals the sprint spec
   itself was wrong, not just under-specified).

Everything else — "table or column," "which existing helper to reuse," "this
edge case wasn't in the acceptance criteria, here's the sane reading" — gets a
ruling from the Eng Manager, logged, and the node continues. This is the
build-specific instance of `rules/sage-conduct.mdc`'s rulings-not-stalls
principle; the four categories above are the whole list of exceptions to it
for this skill. See `references/blocker-categories.md` for worked examples on
the line between the two.

## Lane enforcement

`.sage/lane` is active only during `/sage-build`, one node at a time inside
its worktree; if the file doesn't exist, writes are unrestricted — the
boundary is opt-in. Out-of-lane `Write`/`Delete` calls are denied by the
`sage-lane` hook (or, if the platform's tool payload doesn't carry a path,
recorded for revert at the next join instead — strictly worse, since it
detects after the fact). This is not a security boundary: a Bash call doing
`sed -i` on an out-of-lane file is not intercepted, only the `Write`/`Delete`
tools are. Amend a node's `owns` only after `sage dag lanes` still passes with
the widened glob — an amendment that reintroduces a wave intersection is
exactly the bug step 2a exists to catch.

## Design gate

If a node has `design: required` and `docs/design/brief.md` does not exist,
block that node and tell the user to run `/design-intake` first rather than
letting the Implementer improvise a design.

## Non-interactive

The four escalation categories and a circuit-breaker stop still halt and
report, never a silent ruling; everything else rules per
`rules/sage-conduct.mdc` and continues, logged. Terminal: `Build complete: N
nodes done` or `Build blocked: <blocker path>`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll re-run the whole wave, it's simpler" | Re-dispatching completed work is the most expensive failure in this system. Resume from the ledger. |
| "I'll paste the brief into the Task prompt so they don't miss it" | Pasted content stays resident in your context for the rest of the session. Pass the path. |
| "Background subagents are fine, the wave will still finish" | Pin `is_background: false`. Defaults change under you without warning. |
| "I tested it manually, it's fine" | Manual testing doesn't persist past this turn. Evidence records do — run `sage evidence run`. |
| "One more file outside the lane, it's a two-line fix" | Write a blocker. Widening a lane in secret is exactly what `sage-lane` exists to catch. |
| "The score's at 18, I'll just finish this one fix" | The stop is at >20, not "when it feels risky." One fix that touches 4 files crosses it mid-fix. |
| "I'll just estimate the WTF score and write it in, computing it is slower" | The number only means anything if it came from `evaluateCircuitBreaker`. A hand-written estimate is the same self-report failure this mechanism exists to close, just with a mechanical-looking label on it. |
| "This blocker is basically a plan defect, I'll just decide" | If it's genuinely a plan defect, that's one of the four categories — escalate it, don't rule on it yourself. |
| "The merge conflict is trivial, the Implementer can just resolve it" | Join-time conflict resolution is the Eng Manager's job specifically so the resolution gets fresh eyes. |

## Red Flags

- Restarting a sprint that already has a ledger
- Dispatching a node id the ledger already marks `done`
- A node marked `done` with no evidence record
- WTF-likelihood score above 20 with no stop-and-ask
- A WTF-LIKELIHOOD value in the ledger that didn't come from `evaluateCircuitBreaker`
- More than 50 fixes in the sprint
- An Implementer guessing on an out-of-lane need instead of writing a blocker
- A blocker in one of the four escalation categories ruled on without asking the user
- A merge conflict resolved by the Implementer that authored one side of it
- A worktree with uncommitted changes removed anyway

## Done when

Every node is `done` or `abandoned` in the ledger, every `done` node has a
fresh evidence record, every join ran the integration verify, and the
integrated branch is presented for approval with the ledger, findings, and
evidence summary.
