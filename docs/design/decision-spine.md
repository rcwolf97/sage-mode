# The Decision Spine — a second, independent pass on sage-mode

**Prepared:** 2026-08-31 · **Builds on, does not supersede:** [two-spines-roadmap](./two-spines-roadmap.html), which stays as written and stays approved. This document adds a third axis to it, corrects three of its claims, and adds fourteen work packages it does not contain.
**Method:** an independent read of the repo and the eight reference plugins, with no memory of the sessions that produced [ship-plan](./ship-plan.html), [adoption-pstack-skills](./adoption-pstack-skills.html), or two-spines-roadmap. Every claim below carries a `file:line` this pass opened directly. Nothing is taken on a prior document's word — including the three prior documents' own re-verified claims, ten of which are re-checked in §6.
**Steering signal:** the user's own statement of what he likes and how he works, quoted in §1. It is weighted above every scorecard in this repo.

---

## 1. What this adds, and what it corrects

Two-spines-roadmap's framing is right and this document does not touch it. Spine A (the eight-command sprint week) and Spine B (four cheap daily commands) remain exactly as it defines them, in the sequence it gives them.

What it could not account for is a preference the user stated afterward:

> *"Out of all of the repos — the things I like the most (other than sage-mode) are Matt Pocock's skill. I like gstack's `office-hours` skill and the 'you lead an army of agents' parts of gstack and pstack. To me compound engineering has the best self-improvement loop. Matt Pocock's skills are pretty thorough of the type of work that I want to do which is 'start with questions' → write a spec → convert to tickets → wayfinder for big work."*

Four preferences. Reading them against source produced a result worth stating up front, because it changes what "10x better" means here:

**Three of the four are things sage-mode already half-has, and in two places has more strongly than the repo it would be copying from.** `sage-shape` is a harder version of office-hours' Startup mode. `sage-plan` → `sage-dag` is a richer version of `to-spec` → `to-tickets`. `sage-retro` already carries a bounded staleness re-check and a transcript-grounded rationalization miner that `ce-compound` does not have. Porting any of them in would be building sage-mode twice.

**One of the four is genuinely absent, and one of the four is a missing *surface*, not a missing mechanism.** There is no wayfinder equivalent anywhere in the repo — no artifact that holds a decision that isn't a feature, spans more than one session, and can terminate in "we decided not to." And the "army of agents" feeling is absent not because sage-mode lacks agents (it has 19, with lanes, ownership globs, worktrees, and a mechanical circuit breaker — more per-agent structure than any reference repo) but because the entire user-facing view of them is a 28-line status skill and a flat markdown table.

That observation is what §7 turns into a structural argument. The short version: **everything the user just asked for points at decisions, and both existing spines point at code.**

### 1.1 Three corrections to prior documents

Two-spines-roadmap opened with a drift table because the codebase moves between audits. The same discipline, applied to *it*, turns up three:

| Prior claim | Source | This pass |
|---|---|---|
| *"I checked whether sage-mode already does [claim/evidence separation]: it doesn't."* | two-spines §5.3 | **Half wrong.** The doctrine is present, explicit, and stated more strongly than agent-skills': `skills/sage-review/SKILL.md:85-91` — *"The reviewer receives ARTIFACT (the diff) and CONTRACT (the node's acceptance criteria) only — never the implementer's `reports/<id>.md`… if you hand over conclusions, you get back validation of conclusions."* Repeated at `:114-116` (the red team gets the same treatment), `:193` (rationalization row), `skills/sage-build/SKILL.md:104-105`, `agents/reviewer.md:14,17,31`, and `skills/sage-review/references/checklists/correctness.md:3`. What is genuinely absent is only that **no code enforces it** — confirmed, `grep -n "conclusion\|CLAIM\|verdict\|narrative" lib/review/index.ts lib/consult/index.ts` returns one unrelated comment at `lib/review/index.ts:454`. The recommendation survives; its framing must change, and so does its fix location. This is not "adopt an idea from agent-skills," it is "make sage-mode's own already-written rule mechanical" — which means an assertion in the dispatch-payload builder plus a tier-3 scenario, not a new doctrine paragraph. |
| *"`ce-compound` dispatches six specialist research subagents… before writing a learning."* | two-spines §4.4 (and §0's closing paragraph) | **Wrong on three counts.** `ce-compound`'s Full Mode dispatches **three** parallel subagents — Context Analyzer, Solution Extractor, Related Docs Finder (`skills/ce-compound/references/research.md:51-54`, dispatch at `:58`) — plus one session-history synthesis agent. The six named specialists live in `skills/ce-compound/references/enhancement.md:11-19`, where they are **Phase 3: after the doc is written, interactive-only, and routed by problem type** (`performance_issue → performance-oracle`, `security_issue → security-sentinel`, `database_issue → data-integrity-guardian`). Typically one fires. Never six. Two-spines reached the right conclusion (don't build it) from the wrong mechanism, which means the deferral argument has to be re-run against what is actually there — §5 does that, and reaches a different answer. |
| *"Cross-model 'independent review' … **half-fixed**."* | two-spines §0 | **Confirmed accurate**, and worth restating precisely because it is the one place the repo already does what §4 asks for elsewhere: `lib/consult/index.ts:58-64` parses `modelUsage` off the response envelope and sets `verified: true` with named models or `verified: false` when the field is absent. No correction needed; noted so §4's board design can build on it rather than re-derive it. |

And one contradiction that seven prior documents have all walked past — new in §6 as **N-1**: `rules/sage-conduct.mdc:48` says *"Batch every open question into a single decision call. Do not interrupt N times."* `skills/sage-shape/SKILL.md:35` says *"Ask exactly one question… never fold two into a single turn."* `skills/sage-plan/SKILL.md:108` puts batching in its rationalization table as the failure mode. The conduct rule is `alwaysApply: true` and loads first. Nothing scopes line 48 to gates. This is not a nitpick: it decides the texture of every intake session sage-mode will ever run, and it is currently undecided in the source of truth.

---

## 2. Thread 1 — grill → spec → tickets → wayfinder

### 2.1 What Matt's pipeline actually is

Read in full, the four skills are smaller and sharper than their reputations.

**`grilling`** (`skills/productivity/grilling/SKILL.md`, 27 lines) is the whole primitive. Its mechanics, verbatim in substance:

- The conversation is a **design tree**: every decision branches into the decisions that hang off it (`:6`).
- The **frontier** is every decision whose prerequisites are already settled (`:8`). Work the tree in **rounds**: ask the *whole frontier* in one round, number each question, and **give your recommended answer to each** (`:8`, format block at `:12-22`).
- Each round's answers reshape the tree; recompute the frontier. *"A question whose answer depends on another question still open in this round belongs to a later round, not this one"* (`:24`).
- **"Finding facts is your job, never the user's."** When a frontier question needs an environment fact, dispatch a sub-agent — and **don't block on it**: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait, and the rest of the frontier gets asked now (`:26`).
- Done when the frontier is empty (`:27`).

`grill-me` (`skills/productivity/grill-me/SKILL.md:7`) is one line: *"Call the Skill tool with 'grilling'."* `grill-with-docs` (`skills/engineering/grill-with-docs/SKILL.md:7`) is one line: *"Call the Skill tool twice, for 'grilling' and 'domain-modeling'."* That is a design lesson in itself — the interview is one file, and the two entry points are one line each.

**`domain-modeling`** (`skills/engineering/domain-modeling/SKILL.md`) is the "docs" half the user singled out. Four in-session moves: challenge a term against the existing glossary the moment it conflicts (`:46`), sharpen fuzzy/overloaded language into a canonical term (`:50`), stress-test relationships with invented edge-case scenarios (`:54`), and cross-reference claims against code — *"Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"* (`:58`). `CONTEXT.md` is updated inline, never batched (`:62`), and is *"totally devoid of implementation details… a glossary and nothing else"* (`:64`). ADRs are offered only when all three hold: hard to reverse, surprising without context, the result of a real trade-off (`:68-73`). Files are created lazily, only when there is something to write (`:40`).

**`to-spec`** (`skills/engineering/to-spec/SKILL.md`) has one rule that matters most: **no interview** — *"just synthesize what you already know"* (`:7`). The interview already happened. Its distinctive step is **seams**: sketch the test boundaries first, prefer existing seams, use the highest seam possible, *"the fewer seams across the codebase, the better — the ideal number is one,"* and check them with the user before writing (`:15-17`). The template is Problem Statement / Solution / a deliberately **long** numbered User Stories list / Implementation Decisions / Testing Decisions / Out of Scope / Further Notes, with an explicit ban on file paths and code snippets because *"they may end up being outdated very quickly"* (`:55`).

**`to-tickets`** (`skills/engineering/to-tickets/SKILL.md`) defines the two terms precisely:

- A **tracer-bullet ticket** is a *vertical slice*: *"cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests): vertical, NOT a horizontal slice of one layer"*; demoable or verifiable on its own; **sized to fit in a single fresh context window**; prefactoring done first (`:29-36`).
- A **blocking edge** is the set of tickets that must complete before this one can start; no blockers means start immediately (`:38`). The **frontier** is any ticket whose blockers are done (`:65`).
- The exception is a **wide refactor** — one mechanical change whose blast radius fans across the codebase so no vertical slice can land green. That gets **expand–contract**: an expand ticket adding the new form beside the old, migrate batches sized by blast radius (per package, per directory) each blocked by the expand, and a contract ticket blocked by *every* migrate batch (`:40`). When even the batches cannot stay green alone, they share an integration branch and green is promised only at a final integrate-and-verify ticket.
- The user is quizzed on granularity and on whether *each ticket only depends on tickets that genuinely gate it* (`:50-56`), and publication is in dependency order so edges can reference real ids (`:63`).

**`wayfinder`** (`skills/engineering/wayfinder/SKILL.md`, 127 lines) is the densest of the four and the one with no sage-mode analogue.

- The unit is a **decision ticket** — *"questions whose resolution is a decision, not slices of a build to execute"* (`:7`).
- **Naming the destination is the first act of charting**, because it fixes the scope (`:9`, `:111`).
- **"Plan, don't do."** *"The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off… absent that, produce decisions, not deliverables"* (`:13`).
- The **map is an index, not a store**: a decision lives in exactly one place, its ticket; the map gists and links (`:23`). Body sections are exactly five — Destination / Notes / **Decisions so far** / **Not yet specified** / **Out of scope** (`:31-53`). Open tickets are *not* listed on the map; they are found by query (`:29`).
- A ticket body is one heading: `## Question` (`:59-63`). Its four types (`:73-80`) split on **HITL vs AFK**: `research` (AFK, subagent), `prototype` (HITL), `grilling` (HITL, the default), `task` (the one type that *does* rather than decides, and *"earns its place by unblocking a decision, not by delivering the destination"*).
- A session **claims** a ticket by assigning it *before any work*, so concurrent sessions skip it (`:67`). Blocking uses the tracker's native relationship *"because it renders the frontier visually in the tracker's own UI"* (`:69`).
- **Fog of war** (`:82-93`): the map is deliberately incomplete. *"The test is whether you can state the question precisely now, not whether you can answer it now."* Ticket when the question is sharp, even if blocked. Fog when it isn't. **Don't pre-slice the fog.**
- **Out of scope never graduates** (`:95-101`). A mis-scoped ticket is *closed* (a closed ticket is unambiguously off the frontier) with one line in Out of scope — and it stays out of Decisions so far, *"which records the route actually walked; a scope boundary isn't a step on it."*
- **Never resolve more than one ticket per session**, research excepted (`:105`). Charting is one session's work and hand-resolves nothing (`:116`).
- When the map clears, **it hands off, it does not build**: merge onto the main flow at `to-spec`, which collapses the map's linked decisions into a buildable plan. *"Looping the map straight into `/implement` skips that collapse and throws the linked detail away"* (`ask-matt/SKILL.md:46`).

### 2.2 What sage-mode already does, honestly

**`sage-shape`** (427 lines) is a product-intake interrogation. Seven mandatory topics — who has the problem (`:47`), what they do instead (`:66`), narrowest wedge (`:85`), user stories in their words (`:104`), the flow screen-by-screen (`:123`), the observable (`:142`), out of scope (`:161`) — each with three worked bad-answer/follow-up pairs. Then a 13-row demand-evidence table plus a **cost-to-give** heuristic (`:196-213`), a **mandatory Lane B premise challenge** with a rule that its strongest objection is recorded in full even when the decision goes the other way (`:275`), **mandatory materially-different alternatives** with a test for what "materially different" means (`:277-297`), a self-check (`:299-309`), the roadmap write with amend-never-replace semantics (`:338`), a render, and a gate.

**`sage-plan`** (124 lines) refuses without an approved roadmap (`:24`), proposes candidates from unshipped roadmap rows plus open findings (`:30`), asks one question at a time on priority and sequence (`:33`), consults the Architect on anything non-obvious via a **path, never pasted contents** (`:37-45`), names non-goals (`:46`), defines "shipped" per item as an observable (`:48`), and writes a spec with `readiness: requirements-only` (`:52`). The readiness contract (`:65-80`) is a genuinely good piece of machinery: `sage-plan` may never write `implementation-ready`; only `sage-dag` flips it forward, and only after `sage dag validate` passes clean.

**`sage-dag`** (143 lines) surveys the codebase for what each item actually touches so `owns` globs are real rather than guessed (`:25`), dispatches the Architect against a brief path (`:30`), and then runs the **D1–D7 validate loop** (`:51-67`, invariants table at `:84-92`), bounded at two round trips before escalation. It renders `plan.html` with a mermaid DAG and wave table, sets readiness, and surfaces three things at the gate: every `verify: "none"` node, every `risk: high` node, and the concurrency plan (`:75`).

Mapping to Matt's four steps:

| Matt | sage-mode | Verdict |
|---|---|---|
| `grilling` | `sage-shape` step 2 | sage-mode is **stronger on content**, weaker on *loop shape*. The seven topics with worked follow-ups beat a bare frontier; the serial one-question loop loses to rounds. |
| `domain-modeling` | *nothing in-session*; a 39-line `skills/catalog/adr/SKILL.md` retrievable by BM25 | **Absent.** There is no glossary artifact, no term-challenging move, and nothing that writes an ADR during intake. |
| `to-spec` | `sage-plan`'s `spec.md` | **Different artifact.** sage-plan writes a *sprint* contract (goal, items with observables and owners, non-goals, risks, verification profile — `:52-58`). Matt writes a *feature* spec (user stories, implementation decisions, **seams**, testing decisions). Neither contains the other. |
| `to-tickets` | `sage-dag`'s `dag.json` nodes | sage-mode is **strictly richer** — `owns` globs, a `verify` command that must exist and exit non-zero, observable acceptance criteria enforced by D4, blast-radius containment by D7. And `depends_on` **is** a blocking edge; D1 already enforces the acyclic frontier. But see 2.3: the *decomposition philosophy* is inverted. |
| `wayfinder` | **nothing** | Confirmed absent. The roadmap is the nearest artifact and it is not close: a roadmap row is a *feature* with `Why / Observable success / Status / Spec` (`sage-shape:317-325`), not a *question*; it has no blocking edges, no fog section, no claim mechanism, and no terminal state that is a decision rather than a shipped thing. |

### 2.3 The sharpest finding in this thread: D2 quietly inverts tracer-bullet decomposition

`sage-dag`'s D2 (`skills/sage-dag/SKILL.md:87`) reads: *"No two nodes that can run **concurrently** have intersecting `owns` globs."* And the node-authoring rules the Architect brief must convey include *"Prefer more nodes with tighter lanes over fewer nodes with wide ones"* (`:44`).

Both are correct as **concurrency-safety** rules. But D2 is the *only mechanical check on decomposition* in the entire pipeline, and a rule that is the only check becomes the philosophy whether it meant to or not. A genuine tracer bullet touches schema, API, UI, and tests. Two tracer bullets in the same feature will almost certainly intersect on at least one shared file. Under D2 the Architect has exactly two escapes: put them in different waves (serialize, losing the parallelism the DAG exists for), or **cut horizontally** so each node owns one layer and the globs stay disjoint. The second is easier, produces a prettier wave table, and is exactly what `to-tickets:31` forbids.

Nothing in the D-invariants, the node-authoring rules, or `agents/architect.md` names verticality. There is no D-code for "this node ships no user-observable behavior."

This is not a bug — it is an unexamined interaction between a safety invariant and an absent one. It is also the single most consequential thing in this thread, because it shapes every sprint sage-mode will ever plan.

### 2.4 Design

**T1-A · `/sage-grill` — extract the interview primitive.** *(WP-18)*

A new `skills/sage-grill/SKILL.md`, ~90 lines, owning the design-tree / frontier / round mechanics and nothing else. Three call sites: `sage-shape` step 2, `sage-plan` step 4, and `/sage-map`'s grilling tickets (T1-E). `sage-shape` keeps its seven topics — they become the tree's **root set**, not the loop.

The round format is `grilling`'s, with one sage-mode-native addition: each recommended answer carries the **evidence rung** it rests on (adoption-pstack-skills' A-2 ladder), so a recommendation grounded in a `sage recall` hit is visibly different from one grounded in the model's prior. That is a thing neither Matt nor pstack can do, because neither has a graded evidence primitive.

Take `grilling:26` verbatim in substance: facts are the agent's job, dispatched to a subagent, **non-blocking** — only downstream questions wait. sage-mode already has the right agent for this (`agents/librarian.md`, lane A). Today `sage-shape` step 1 reads everything synchronously up front and has no way to acquire a fact mid-interrogation.

And **resolve N-1 in the same package**: amend `rules/sage-conduct.mdc`'s Decision-brief section to distinguish a **decision call** (batched into one, unchanged) from an **interview round** (a frontier's worth, numbered, each with a recommendation). Both are batched; they are batched differently and for different reasons. Right now line 48 and `sage-shape:35` flatly contradict, and whichever the model happens to weight wins.

**T1-B · Domain modeling as a reference and a recall kind, not a command.** *(WP-19)*

Add `skills/sage-grill/references/domain-modeling.md` carrying the four in-session moves and the glossary-only rule, plus the three-condition ADR bar. Add `<notebook>/CONTEXT.md` as `kind: glossary` in `lib/recall` so terms are retrievable alongside learnings.

Argue against a nineteenth command: `lib/lint`'s `command-skill-pairing` rule (`lib/lint/index.ts:651,672`) means every new command costs a command file, a skill, a lint entry, a tier-2 query, and a tier-3 scenario. Matt's own `domain-modeling` is model-invoked and reached *by* other skills, never a user entry point (`skills/engineering/ask-matt/SKILL.md:58`). Copy that shape.

**T1-C · `/sage-spec` — the feature spec, distinct from the sprint spec.** *(WP-20)*

Do **not** restructure `sage-plan`. Its `spec.md` is the artifact `readiness` gates and `sage-dag`/`sage-build` read; changing its shape breaks a contract that works.

Add `/sage-spec`, writing `<notebook>/specs/<slug>.md` from a new `templates/feature-spec.md` with Matt's seven sections. It runs **no interview** (`to-spec:7`) — `/sage-grill` already did that. Two things sage-mode can add that Matt cannot:

- **Seams become checkable.** Each declared seam is a frontmatter entry naming a test-invocable boundary. `sage-dag` step 2's survey reads them, and a node whose `verify` command exercises no declared seam is flagged at the gate. Matt's seam step is a conversation; sage-mode's can be an assertion.
- **Out of Scope writes to the registry.** The section's entries append to `.sage/out-of-scope/` (adoption doc A-7), one file per concept, closing a loop the adoption plan opened and nothing has yet closed.

`sage-plan` gains one branch in step 3: if a spec exists for a candidate roadmap row, read it and carry its user stories into the sprint spec's item list rather than re-deriving requirements. ~15 lines, not a rewrite.

**T1-D · Tracer-bullet discipline inside the DAG.** *(WP-21)*

- Add `slice` to `schemas/dag.schema.json`, required, enum `vertical | prefactor | refactor-batch` — mirroring to-tickets' three shapes exactly.
- **D8 (gate-surfaced, like D5, not a hard reject):** a `slice: vertical` node whose acceptance criteria contain no user- or caller-observable outcome is flagged by name at the gate. Some nodes are legitimately one-layer; the point is that the choice becomes visible rather than a side effect of D2.
- **D9 (gate-surfaced):** when two nodes were pushed into different waves *because* their `owns` intersected, say so at the gate. Today that serialization decision is invisible; the user sees a wave table and cannot tell whether it reflects real dependencies or glob collisions.
- Write expand–contract into `skills/sage-dag/references/` as the sanctioned wide-refactor shape, with the contract node depending on every migrate batch. D1 already expresses this natively.
- State plainly in `agents/architect.md`: **`depends_on` is a blocking edge, and nodes are cut vertically unless they are prefactors or refactor batches.** One paragraph. It is the missing half of D2.

**T1-E · `/sage-map` — wayfinder, built on machinery that already exists.** *(WP-24 in Thread 3's numbering is taken; this is WP-35, sequenced late — see §8)*

Wayfinder's entire substrate is an issue tracker. sage-mode has none and should not acquire one. It has something better suited: a validated-DAG engine and a notebook.

- **Artifacts.** `<notebook>/maps/<slug>/map.md` — the five wayfinder sections, verbatim — rendered by `sage notebook render` (which accepts an arbitrary path, `lib/cli.ts:262-273`) and indexed by `sage recall` as `kind: map`. Tickets at `<notebook>/maps/<slug>/tickets/NNN-<slug>.md`, body `## Question`, frontmatter `type: research|prototype|grilling|task`, `mode: HITL|AFK`, `blocked_by: [NNN]`, `status: open|claimed|closed`, `answer_ref:`.
- **The frontier is computed, never maintained.** New CLI verb `sage map frontier <slug>` — open ∧ unblocked ∧ unclaimed — implemented over the topological machinery in `lib/dag/index.ts` (629 lines, already does acyclicity and layering). *A map is a DAG whose nodes are questions instead of build tasks.* This is the single strongest argument for building `/sage-map` at all: the graph engine, the validator, and the renderer all exist. What is new is a skill file, one CLI subcommand, and a template.
- **One ticket per session, research excepted** (`wayfinder:105`) becomes mechanical: `sage map claim <slug> <id>` records a claim keyed on session; a second non-research claim in the same session is refused. Wayfinder states this rule and cannot enforce it. sage-mode can.
- **Research tickets** dispatch `librarian` on Lane A, in parallel. **Grilling tickets** call `/sage-grill` — which is why T1-A must land first.
- **Fog rule verbatim** (`:88-91`), plus a lint rule wayfinder has no way to write: a map with a non-empty *Not yet specified* and **zero open tickets** is stalled — flag it.
- **Out of scope** on a map writes to the same `.sage/out-of-scope/` registry as `/sage-spec`.
- **Handoff, enforced.** When the frontier empties, `/sage-map` refuses to build and hands to `/sage-spec` (`ask-matt:46`). That is the merge point between the map and Spine A, and it is the answer §7 needs: `/sage-map → /sage-spec → /sage-plan → /sage-dag → /sage-build`.

---

## 3. Thread 2 — `office-hours`, and why most of it is already here

### 3.1 What it actually is

`gstack/office-hours/SKILL.md` is 1,729 lines, of which roughly 850 are shared preamble (update checks, telemetry, AskUserQuestion formatting, brain-cache preflight). The skill proper starts at `:904`.

**Two modes, chosen by one explicit question** (`:1008-1023`): the user picks from six goals and they map to two modes — startup/intrapreneurship → **Startup mode** (Phase 2A), and hackathon/OSS/research/learning/fun → **Builder mode** (Phase 2B) (`:1021-1023`). Startup mode additionally assesses product stage: pre-product / has users / has paying customers (`:1025-1028`).

**Startup mode** carries six operating principles (`:1054-1064`): specificity is the only currency; **interest is not demand**; the user's words beat the founder's pitch; watch, don't demo; the status quo is your real competitor; narrow beats wide. Response posture is *"direct to the point of discomfort… comfort means you haven't pushed hard enough"* (`:1068`), with **calibrated acknowledgment, not praise** — *"the best reward for a good answer is a harder follow-up"* (`:1070`) — and it **ends with the assignment**: one concrete action, not a strategy (`:1072`). Five phrases are banned outright (`:1076-1081`), and five BAD/GOOD pushback pairs teach the difference between soft exploration and diagnosis (`:1091-1114`).

**The six forcing questions** (`:1116-1194`): Demand Reality, Status Quo, Desperate Specificity, Narrowest Wedge, Observation & Surprise, Future-Fit. Asked one at a time. With **stage-based smart routing** (`:1120-1124`): pre-product → Q1,Q2,Q3; has users → Q2,Q4,Q5; paying → Q4,Q5,Q6; **pure engineering/infra → Q2, Q4 only**. Escape hatch on impatience: two more, then proceed; respect a second pushback; never ask a third time (`:1201-1206`).

Then: related-design discovery by keyword grep over prior design docs (`:1256-1272`); **landscape awareness behind a privacy gate** — the search sends *generalized category terms, never the user's product name or stealth idea* (`:1282-1287`) — with a three-layer synthesis and a named `EUREKA` when Layer 3 finds conventional wisdom wrong here (`:1300-1307`); a **premise challenge** rendered as agree/disagree statements (`:1313-1331`); an **optional cross-model second opinion** printed **verbatim in a bordered block, explicitly not truncated or summarized** (`:1408-1422`), followed by a 3-5 bullet synthesis naming where the two agree and disagree and an explicit re-decision when a premise was challenged (`:1424-1435`); and **mandatory 2-3 alternatives** — one minimal-viable, one ideal-architecture, one creative/lateral — with a hard STOP for approval (`:1439-1471`).

The artifact is a design doc written to both `docs/designs/{slug}.md` in the repo and `~/.gstack/projects/`, with a `Supersedes:` field forming a revision chain (`sections/design-and-handoff.md:13-20`), redaction-scanned at the sink before the repo copy (`:28-32`), and held to **decision-record concision** — *"one bullet per decision with its why; an approach the user ruled out DURING the session gets one line, never a resurrected full section"* (`:39-44`). Its last two sections are **The Assignment** and **What I noticed about how you think** (quote the user's words back, don't characterize them — `:105-109`).

And, before the user ever sees it, the **Spec Review Loop** (`:167-227`): an independent reviewer subagent that **cannot see the brainstorming conversation, only the document**, scoring five dimensions (completeness, consistency, clarity, scope, feasibility) 1-10; fix and re-dispatch, max 3 iterations; a **convergence guard** — same issues twice means stop and persist them as a `## Reviewer Concerns` section rather than looping; **non-blocking**, skipped entirely if the subagent is unavailable.

### 3.2 The pushback

**`sage-shape` is office-hours' Startup mode, already, and in three places stronger.** Anyone who proposes porting office-hours into sage-mode is proposing to build `sage-shape` twice.

- Interest-is-not-demand: gstack states it as a principle (`:1056`) and one question (`:1130`). `sage-shape:194-213` states it, gives a **13-row signal table** with rulings and reasons, and adds a **cost-to-give heuristic** for signals not on the table. Stronger.
- Premise challenge: gstack's Phase 3.5 cross-model second opinion is **optional**, gated on an AskUserQuestion (`:1343-1349`). `sage-shape` step 4 is **mandatory, on a different lane, in both product modes**, with an explicit send-back-once rule when the response is generic (`:273`) and a requirement to record the objection *in full* in the roadmap even when the decision goes the other way (`:275`). Stronger.
- Alternatives: both mandatory, both 2-3, both requiring a real trade-off. `sage-shape:279` adds a test for what "materially different" means. Marginally stronger.
- Anti-sycophancy: gstack lists five banned phrases inline. sage-mode has it as a conduct rule (`rules/sage-conduct.mdc:56`) plus 19 agent rationalization tables. Equivalent or stronger.

So the adoption list is short and specific. What office-hours has that `sage-shape` does not:

1. **A cheap mode.** Builder mode (`:1210-1252`) is generative rather than interrogative: five questions, enthusiastic posture, *"end with concrete build steps, not business validation tasks."* `sage-shape` has one posture and one output — an approved roadmap that gates `/sage-plan`. **There is no way to use sage-mode to think about an idea without committing to a roadmap.** That is the Spine-B-shaped hole in the *intake* surface, exactly parallel to the one two-spines found in the build surface.
2. **Stage-based question routing.** `sage-shape:39` — the seven topics *"MUST all be covered."* §2.8 (`:182`) adjusts what counts as a good answer by project type but never which questions get asked. For a solo engineer's own tooling, "who has the problem" and "what do they do instead" are three-word answers. gstack's *"pure engineering/infra → Q2, Q4 only"* is the right shape and costs one table.
3. **A verdict, including "no."** office-hours ends with **The Assignment** — one concrete action, explicitly *not* "go build it." `sage-shape`'s completion condition (`:425-427`) requires a rendered roadmap, an evidenced why per row, and an explicit approval. **There is no terminal state in which the answer is "don't build this."** The premise challenge can argue it; step 6 writes the roadmap anyway.
4. **The Spec Review Loop.** A reviewer that sees only the document and never the conversation. That is *precisely* the ARTIFACT+CONTRACT principle `sage-review` already enforces for code (`skills/sage-review/SKILL.md:85-91`), applied to a design doc — and sage-mode does it for **none** of its own planning artifacts. `sage-shape`'s roadmap, `sage-plan`'s spec, and `sage-dag`'s `plan.html` are all presented to the user unreviewed. That is a real asymmetry: code is reviewed adversarially by a different model on a metered lane, and the documents that decide *what code gets written* are reviewed by nobody.
5. **"What I noticed about how you think."** Cheap, and it is the layer that makes gstack feel like a mentor rather than a form.

### 3.3 Design

**T2-A · `/sage-oh` — the gut check, upstream of both spines.** *(WP-22)*

**Placement, argued:** it is neither Spine A nor Spine B, and forcing it into either would break the thing that makes it useful. Spine A's unit is a sprint. Spine B's unit is one *existing* thing — a diff, a bug, a question about code that exists. An idea with no code, which may never have any, and whose best possible outcome is sometimes "don't," is neither. It belongs with `/sage-map`, and that pairing is what §7 argues is a third structural concept.

Concretely:

- **Two postures, one question.** Reject gstack's six-option goal menu — for a solo engineer, startup/intrapreneurship/hackathon/OSS/learning/fun collapses to two: *"is this something I'm deciding whether to ship"* vs *"is this something I want to play with."* One question, two paths.
- **It does not re-implement `sage-shape`'s interrogation.** It calls `/sage-grill`, seeded with a **stage-routed subset** of the seven topics, and points at `skills/sage-shape/references/demand-test.md` by reference. Not a copy — `lib/lint`'s `conduct-dupe` and `templated-duplicate` rules exist precisely to punish copies.
- **Output: `<notebook>/ideas/<slug>.md`**, `kind: idea` in recall, carrying a **verdict** — `build | build-smaller | don't-build | needs-evidence` — and a required **Assignment** line: one concrete action, never "go build it." `don't-build` and `needs-evidence` are first-class terminal outcomes. That is the thing `sage-shape` structurally cannot say.
- **Handoffs.** `build` → `/sage-shape` (new roadmap) or `/sage-spec` (a feature on an existing one). `build-smaller` → back into `/sage-grill` with the narrowed wedge. `don't-build` → **write to `.sage/out-of-scope/`** with the reasoning and the evidence, so `/sage-plan` and `/sage-shape` surface the rejection when the idea comes back in four months. That last one is the payoff: gstack's office-hours produces a design doc that dies in a folder; sage-mode's version produces a **durable rejection with a citation**, which is the house thesis applied to the one category the notebook does not capture at all.
- **Reuses:** `lib/recall` (prior ideas, learnings, the out-of-scope registry), `lib/consult` (premise challenge on Lane B, with `extractModelReceipt` at `lib/consult/index.ts:58` proving which model actually argued), `lib/redact` + `lib/egress` (the privacy gate), `lib/notebook` (render + index).
- **One gstack mechanic worth taking verbatim:** the landscape-search privacy gate with generalized-category-terms-only (`:1282-1287`). gstack asks the user and trusts the model to comply. sage-mode has a redaction scanner and an egress ledger — it can *enforce* the category-terms rule and log the row. Strictly better, and it costs a wiring, not a mechanism.

**T2-B · `sage review doc` — the Spec Review Loop, generalized.** *(WP-23)*

The highest value-per-hour item in this document, and it serves Spine A as much as Spine C.

A new `lib/review` entry point that dispatches Lane C, readonly, seeing **only a document path** — never the conversation — against a five-dimension rubric in `skills/sage-review/references/checklists/design-doc.md`. Take gstack's convergence guard verbatim: same issues on consecutive iterations → stop, persist as `## Reviewer Concerns` in the document, do not loop. **Non-blocking**, like gstack's — a doc review that hard-gates a roadmap turns intake into a two-model argument the user has to referee.

Wire it as a pre-gate step in five places: `/sage-shape` (7.5), `/sage-plan` (10.5), `/sage-dag` (6.5), `/sage-oh`, `/sage-map`.

It is `lib/review`'s existing gate and dedup machinery pointed at a markdown file instead of a diff. Roughly 4 hours. And it can be run against `docs/design/*.md` — this repo's own eight unreviewed planning documents — the day it lands.

---

## 4. Thread 3 — the commander console

### 4.1 What "leading an army" actually consists of

It is a UX preference, so it has to be decomposed before it can be ported. Four mechanisms, from source:

**(1) Named personas with standing permissions the user granted.** `gstack/plan-ceo-review/SKILL.md:889-898`: *"You are not here to rubber-stamp this plan."* The user picks a **mode** — SCOPE EXPANSION / SELECTIVE EXPANSION / HOLD SCOPE / SCOPE REDUCTION — and the persona then **commits to it**: *"Once the user selects a mode, COMMIT to it. Do not silently drift toward a different mode… Raise concerns once in Step 0 — after that, execute the chosen mode faithfully"* (`:897`). Nine Prime Directives (`:900-909`) include #9: *"You have permission to say 'scrap it and do this instead.'"* The commander feeling comes from the agent having **explicit standing permissions granted by the user**, not from a different system prompt.

**(2) Competing takes surfaced side by side, verbatim, never silently merged.** `office-hours:1408-1422` prints the second opinion in a bordered block with the instruction *"full codex output, verbatim — do not truncate or summarize"*, then a synthesis naming agreement and disagreement, then an **explicit user decision** when a premise was challenged (`:1429-1435`). `pstack/skills/interrogate/SKILL.md:90-113` outputs **Act On / Consider / Noted / Dismissed** — *"Dismissed: rejected findings with brief rationale. This shows the user what was filtered out and why, so they can override your judgment if they disagree"* — plus an **Agreement Map**: *"where did models agree, where did they diverge, and what does the pattern of agreement/disagreement tell us?"*

**(3) Adjudication is named as the human's, and the tool shows its work.** `interrogate:74`: *"You are the lead reviewer, a pragmatic senior engineer, not a neutral aggregator."* `pstack/skills/arena/SKILL.md:59`: *"Record what was grafted, from which candidate, and what was rejected and why. The rejection notes are the highest-signal part of the record."*

**(4) Convergence and divergence are themselves reported as signal.** `arena:41` puts a cross-judge on a **different model family** from the parent, and `:47` reads: *"Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous."* `:61`: N candidates converging is a strong signal, ship the consensus; N candidates wildly diverging means Phase A was under-specified — *"reframe and re-run rather than averaging the divergence."* `pstack/skills/swarm/SKILL.md:23` requires declaring the selection rule (`first pass` / `rank all` / `best-of`) **before spawning**.

### 4.2 What sage-mode shows the user today

Verified:

- 19 agents, each with `lane` and (for 16 of 19) a `model` pin. `sage-build:59-65` dispatches all nodes of a wave in one message with `is_background: false`.
- The entire user-facing surface is `skills/sage-status/SKILL.md` — **28 lines** — reporting sprint id, wave, the `sage board next` action, and blocked nodes (`:11-14`).
- `lib/board/index.ts:117-121` renders one flat markdown table: `| id | status | worktree | model | attempts | verify | commit | updated |`. The `model` column is *parsed back out of that same table* at `:85` — it is whatever was written in, never checked against anything. `extractModelReceipt` exists (`lib/consult/index.ts:58`) and is wired only to the Lane B consult path; nothing feeds a receipt into the ledger's model column.
- Review findings carry a `specialist` field (`schemas/finding.schema.json:18`) and dedup computes multi-specialist agreement (`skills/sage-review/SKILL.md:99-104` — `MULTI-SPECIALIST CONFIRMED (a + b)`, +1 confidence, capped at 10). The rendering step then organizes the output **by confidence band** (`:152-160`), discarding the attribution. **sage-mode computes multi-agent agreement and throws it away at the presentation layer.**
- **Every AUTO-FIX finding is applied** (`:141`). There is no Dismissed bucket, no per-specialist disagreement surface, and — confirmed by grep across `skills/`, `rules/`, `agents/`, and `lib/` — **no path by which an implementer can dispute a finding.** The only hits for pushback/dispute language are `sage-shape`'s interrogation prose and `agents/product.md`'s premise-challenge instruction.
- The one place sage-mode already does surface a machine judgment about the team's state is the circuit breaker: `computeWtf` at `lib/board/index.ts:398` is a pure function of five mechanically-sourced signals, with a decomposed `WtfBreakdown` (`:371-377`). It is genuinely good and it is currently rendered as a single integer.

**sage-mode has an army and no situation room.** More per-agent structure than any reference repo, and the thinnest possible view of it.

### 4.3 Design

**T3-A · `sage board render` and a commander's status line.** *(WP-24)* — ~4h

- New CLI verb `sage board render [--sprint NN]` writing `<notebook>/sprints/NN/board.html` through the existing `lib/notebook` `render()`, which already accepts an arbitrary path (`lib/cli.ts:262-273`). No new renderer.
- Per wave, per node: the **agent card that owns it, by name**, not a model string; lane; status; attempts; review cycles; verify grade; **evidence freshness**; and the `owns` glob set.
- The **WTF breakdown, decomposed** — surface all five components from `WtfBreakdown` (revert / file-spread / fix-count / low-findings / out-of-lane points), not just the total. An out-of-lane touch and a revert mean completely different things about the team's state, and today they are the same number.
- A **declared-vs-observed model column**: `declared: grok-4.5 · observed: —`. Fill `observed` wherever SPIKE-02 (ship-plan WP-5) establishes a receipt is obtainable; where it is not, print `—` and say once, at the top of the board, that Lane A/C dispatch is unverified **by construction**. That converts a known architectural hole into a visible one instead of a silent one, which is the same move `extractModelReceipt`'s `verified: false` already makes for Lane B.
- `/sage-status` gains one line at the top, in the commander's register, built only from mechanical inputs: *"Wave 2 of 4 · 3 agents building, 1 blocked on a ruling you owe · WTF 15 (2 out-of-lane touches)."*

**T3-B · Per-specialist attribution, an Agreement Map, and a Dismissed bucket.** *(WP-25)* — ~4h

- `sage-review` step 10 renders **by agreement structure first, confidence second**: a `## Confirmed by N specialists` section (the dedup already computes exactly this), then per-specialist singletons under named headings, then `## Dismissed`.
- Adopt interrogate's four buckets (Act on / Consider / Noted / Dismissed) as a classification layer **above** the existing AUTO-FIX/ASK, not instead of it. They are orthogonal: AUTO-FIX/ASK answers *who applies it*; Act-on/Dismissed answers *whether it applies at all*. Dismissals are shown with a one-line rationale so the user can override — `interrogate:110`.
- An **Agreement Map** line. sage-mode can do this better than pstack, for a reason worth stating: pstack's diversity is **model** diversity, so its agreement map can only say "three of four models flagged this." sage-mode's specialists are **role**-differentiated — eight named checklists at `skills/sage-review/references/checklists/` (correctness, security, performance, testing, maintainability, api-contract, design, data-migration). Divergence between the security checklist and the performance checklist on the same line is *information about a trade-off*, which model diversity alone cannot produce.

**T3-C · The `disputed` disposition — an implementer rebuttal path.** *(WP-26)* — ~4h, needs WP-25

This is the gap no prior document has named. sage-mode hardened the reviewer exhaustively and left the reviewed party with exactly one option: comply.

`superpowers/skills/receiving-code-review/SKILL.md` is the other half of the protocol, and it is a genuinely un-mined file. Its pattern (`:16-25`): READ → UNDERSTAND → **VERIFY against codebase reality** → EVALUATE → RESPOND (technical acknowledgment or reasoned pushback) → IMPLEMENT one at a time. Its push-back conditions (`:113-121`): the suggestion breaks existing functionality, the reviewer lacks full context, it violates YAGNI, it is technically wrong for this stack, legacy reasons exist. Its YAGNI check (`:88-96`) is mechanical: grep the codebase for actual usage before "implementing properly."

Make it mechanical in sage-mode:

- New finding disposition `disputed`, written by the implementer with a required `rebuttal_evidence` field — a `file:line` or a command plus its output, i.e. **rung ≥ 2 on the A-2 ladder**. A dispute with no evidence is not a dispute.
- A `disputed` finding is never silently applied and never silently dropped. It goes into the ASK batch with both sides shown, and the user rules.
- **Bound it, or `disputed` becomes the new `done`:** at most two disputes per node per cycle, and a dispute the user overrules counts against the three-cycle budget.

**T3-D · Reject four persona review commands; take one sentence instead.** *(WP-27)* — ~1h

Do **not** port gstack's `plan-ceo-review` / `plan-eng-review` / `plan-design-review` / `plan-devex-review`. They are 1,102–1,540 lines each, the large majority of it shared preamble, and sage-mode's `/sage-review` already runs eight role-differentiated checklists over the same 19 agents. Four more commands over the same roster is surface, not capability.

What is worth taking is one mechanism: **the committed mode**. Add a `posture: expand | hold | reduce` field to `/sage-plan`'s and `/sage-dag`'s gate, chosen by the user once, recorded in the spec frontmatter, and **binding on the Architect consult for the rest of the sprint** (`plan-ceo-review:897`). One frontmatter field, one paragraph in `agents/architect.md`, one lint rule. It is the single highest-leverage sentence in 1,520 lines of gstack, and it is the thing that makes an agent feel like it took an order rather than a prompt.

---

## 5. Thread 4 — the self-improvement loop, re-argued from the real mechanism

### 5.1 What compound-engineering actually has

With the six-specialist error corrected (§1.1), `ce-compound`'s loop is four mechanisms, in descending order of value:

**(1) Grounding validation** — `skills/ce-compound/references/grounding-validation.md`. The framing is the point: *"The doc just written becomes permanent, trusted knowledge — future agents will act on its claims without re-verifying them. This phase checks the claims against reality before they compound"* (`:3`).

Two passes. A **deterministic mechanical pass** flags cited paths that do not exist, hex SHAs that do not resolve or resolve only locally, drafting scaffold (`Learning 3`, `{{…}}`), and broken relative links — with a **nine-row adjudication table** (`:18-29`) resolving each as **fix / annotate / confirm intentional**, *"never an automatic rewrite and never an automatic pass."* Then a **semantic pass**: one read-only validator subagent, prompt at `:38-72`, checking three claim categories — **code-behavior** claims against the local tree (quote the defining `file:line`), **merge-state** claims against remote truth (`gh pr view` primary, git reachability only as fallback), and **internal completeness** (countable assertions like "six PRs" — count the substantiating items *in the doc itself*). Verdicts are verified / contradicted / unverifiable, and the orchestrator's handling (`:74-80`) is the sharpest part: *contradicted* → fix using the quoted evidence, because *"the quote, not the conversation, is authoritative"*; *unverifiable* → **soften or attribute** ("per this session's conclusion…"), never assert and never silently delete.

**(2) Corpus-first vocabulary** (`references/research.md:68`) — the Context Analyzer samples the existing corpus's frontmatter and directory names **before** choosing a category, and **records whether each value came from the corpus or from the default.** That is what stops a knowledge base from sprouting forty near-synonymous categories.

**(3) Five-dimension overlap scoring** (`research.md:109-112`) — problem statement, root cause, solution approach, referenced files, prevention rules. High = 4-5 dimensions match (*"essentially the same problem solved again"*), Moderate = 2-3, Low = 0-1.

**(4) One learning per run, never batched** (`SKILL.md:13`, `research.md:3`) — because grounding, overlap detection, and cross-referencing all assume a single solved problem, and batching leaks drafting-context artifacts into written docs.

`ce-retune` is a different animal, and its best idea is a refusal:

- **Phase 0, the measurement gate** (`SKILL.md:32-42`): it will not run without (a) a run archive with per-run traces, terminal markers and token counts, (b) a **build selector** letting the harness point a run at a specific source checkout of the corpus, and (c) a repeatable task. *"Do not fall back to a static audit and present it as retuning: an audit can say what looks cuttable and never whether cutting helped."*
- **The A/A noise floor** (`references/noise-floor.md:5-19`): two byte-identical checkouts, hashed and asserted equal before the first run, 12+ runs **interleaved** (A,B,A,B, alternating which arm goes first), and **the bar registered in writing before any change exists** — *"a bar chosen after seeing results is not a bar."* Their real numbers: workflow adherence 7 of 12, output tokens 21,872 to 155,682, a **7.12× spread on identical code**, which *"retired every small-sample claim in flight."*
- **Provenance per row** (`:29-41`): read the durable post-completion build field, fall back to the transient in-flight one, and **fail loud** on any row whose arm cannot be established.
- **The adversarial corpus audit** (`references/corpus-audit.md:7-25`): two waves, **as separate dispatched agents** — proposers, then defenders whose job is to find a reason each targeted line exists. A defender must search three sources and **say which it searched**: project learnings, the test suite (grep a distinctive substring of the target text), and version history (`git log -S '<substring>'` for the introducing commit). **Without git history, a defender may not return `cut`.** The warning is explicit: *"The same context arguing both sides still emits confident `cut` rulings, and Phase 4 deletes on them: that is the demolition."*
- Eight cut classes ordered by expected behavior change (`:51-60`), with **`phantom-handoff` first** — *"prose written as if a second party were waiting teaches the model to stop and wait"* — and `halt_sites` named the highest-value output of the whole phase.
- Non-goal, stated: word reduction (`SKILL.md:16`).

### 5.2 Re-arguing the deferral

Two-spines §4.4 deferred on the grounds that you shouldn't *"build a six-specialist fan-out for a tool that has run zero sprints."*

That reasoning **survives for the fan-out** — which, correctly characterized, is optional, post-write, and problem-type-routed anyway, so there is even less to build than the deferral assumed.

It **collapses for grounding validation**, for a reason two-spines could not see because it had the mechanism wrong. Grounding validation is not a quality enhancement to learnings that needs sprints to justify. It is a **correctness check on claims that compound** — and sage-mode already has a corpus of exactly the kind it protects. Not learnings. **This repo's own eight design documents.**

Look at the actual failure rate. Two-spines' §0 caught three claims that had gone stale between audits. This pass caught three more (§1.1). Across two consecutive audit rounds, roughly six load-bearing claims about source were wrong when re-checked. The thing that keeps happening in this repo is **documents asserting things about the codebase that stopped being true**, and `grounding-validation.md` is a mechanism against precisely and only that.

So the honest answer to "does Rohit's preference change the priority" is: **yes, but not in the direction the preference alone would push.** Elevating "the self-improvement loop" does not mean building the specialist fan-out sooner. It means building the one part of `ce-compound` that has a live, demonstrated, six-instance failure in this repo *today*, and building it as a general `lib/` capability rather than as a step inside `sage-retro` — because a step inside `sage-retro` fires zero times until a sprint runs, which is the exact trap two-spines was right to name.

### 5.3 Design

**T4-A · `sage ground <file>` — claim grounding as a first-class CLI verb.** *(WP-28)* — ~6h

Not a retro step. A verb.

- **Mechanical pass**, deterministic, in `lib/`: scan a markdown file for (i) `path:line` and bare-path citations → assert the path exists in the tree; (ii) 7–40 char hex SHAs → `git cat-file -e` plus reachability from HEAD and from upstream; (iii) scaffold leaks (`Learning N`, `{{…}}`, `TODO(`, `<slug>`); (iv) relative markdown links. Emit the flag table with `grounding-validation.md:18-29`'s exact classifications. **Adjudication is the caller's — never an automatic rewrite, never an automatic pass.**
- **Semantic pass**: one Lane C readonly dispatch, prompt taken near-verbatim from `grounding-validation.md:38-72` — three claim categories, per-claim verdict with a quoted `file:line`, and the softening policy for *unverifiable*. Lane C is the correct lane by sage-mode's own rule: it is review, it is readonly, it generates no production code (`rules/sage-conduct.mdc:102`).
- **Where it runs, in priority order:** (1) `docs/design/*.md` — this repo's own planning corpus, today; (2) `/sage-retro` step 3, before a learning is written; (3) `/sage-ship`'s PR body; (4) `/sage-spec` and `/sage-map` decision records.
- **Acceptance, and this is the point:** running `sage ground docs/design/two-spines-roadmap.md` flags §4.4's characterization of `ce-compound`'s specialists as a claim its cited path does not support, and flags nothing that is actually correct. **That test is executable this afternoon, on files that exist, with zero sprints run and zero Spine B commands built.** No other proposal in this document, or in the three before it, has that property.

**T4-B · `sage-retro` gets grounding and real overlap scoring, not specialists.** *(WP-29)* — ~3h

`sage-retro` is stronger than the prior documents give it credit for. It already has: dedup-before-write with an explicit update-not-duplicate rule (`skills/sage-retro/SKILL.md:34-44`), a **bounded staleness re-check** capped hard at three learnings per retro with a relevance-filtered candidate pool and oldest-`last_confirmed` selection (`:64-95`), a supersede-never-delete convention (`:105-112`), model-receipt reporting in the cost block (`:126-133`), rationalization mining **from actual transcripts, never invented** (`:140-144`), and a gated tuning diff that is never applied silently (`:146-152`). Note also `:71-74`, where it *explicitly argues against* the standalone periodic full-corpus sweep, on the grounds that such a sweep *"is easy to skip and, by its own maintainers' account, often is."* That argument is correct and §5.3's T4-C respects it.

Three additions:

- **Step 3 calls `sage ground`** on the draft before writing it.
- **Replace the single-threshold dedup** with ce-compound's five dimensions. Today `dedupAppliesWhen` (`lib/recall/index.ts:163-176`) is one BM25-or-Jaccard number against a `0.55` threshold: a 0.54 and a 0.56 are opposite decisions with zero visibility into why. Map the five dimensions onto the learning template's own structure — problem (`## What happened`), root cause (`## Why it happened`), approach (`## What to do next time`), files referenced (frontmatter `tags` + cited paths), detection signal (`## How we'd detect it earlier`). High (4-5) → update; Moderate (2-3) → show the user both; Low → write new.
- **Step 4 gains a third resolution.** Today it is "still holds → bump `last_confirmed`" or "no longer holds → supersede." Add **"cannot verify from this sprint"** — leave `last_confirmed` untouched and record the attempt. Right now nothing distinguishes a learning re-confirmed against evidence from one that merely looked plausible, and the field is the retro's only staleness signal.

Do **not** add the six specialists. State why in the skill: they are optional, post-write, and problem-type-routed in the source, and adopting them means building a routing table for a corpus that currently holds zero learnings.

**T4-C · `sage-retune` — build the *gate*, defer the *program*.** *(WP-31)* — ~4h for the gate; the rest unscheduled

The most useful thing in `ce-retune` is its refusal, and sage-mode cannot currently pass it. Checked against source:

| Phase 0 requirement | sage-mode today |
|---|---|
| Run archive with traces, terminal markers, token counts | **Partial.** `.sage/egress.jsonl` and evidence records exist; there is no per-run eval trace. |
| **Build selector** — point a run at a specific corpus checkout | **Absent.** `evals/tier3/run.ts:32-35` computes `PLUGIN_ROOT` from its own file location. There is no override. |
| A repeatable task the corpus executes end to end | **Yes, but.** `npm run eval:tier3` runs, and its own header (`run.ts:13-21`) says several scenarios are marked SKIPPED because the assertion *"is inherently a judgement call only a live model can make."* It is a deterministic **machinery** harness, not a model-in-the-loop one. |

So the honest first deliverable is to make the refusal true and legible, plus the cheapest of the three missing pieces:

- Add `--corpus <path>` to `evals/tier3/run.ts`, replacing the hardcoded `PLUGIN_ROOT`, plus a `SAGE_CORPUS` env var read by `lib/util.ts`'s `pluginRoot` (`lib/util.ts:10`). That is the build selector, and it is an afternoon.
- Append a run-archive row per tier-3 execution to `.sage/eval-runs.jsonl`: `{run_id, corpus_commit, corpus_path, scenario, status, duration_s, terminal_marker}`, reusing `lib/evidence`'s record shape and its `cmd_sha256` discipline.
- Ship `sage retune --check`, which prints exactly which of the three Phase-0 requirements is missing and **refuses**. Nothing else.

Defer the A/A noise floor (it needs a live-model harness sage-mode does not have and should not build speculatively), the adversarial audit, and the cut passes.

**But take two pieces now, because together they cost a lint rule and twenty lines of prose:** *(WP-32)* — ~3h

- **`phantom-handoff` as a lint rule.** Grep every SKILL.md for prose naming a second party ("hand off to", "the reviewer will", "returns to the caller", "waits for") and check that the named party appears in that skill's own dispatch list or the agent roster. This is the class `corpus-audit.md:64` calls out as *"the class that causes halts"*, and sage-mode — with 44 skills, 19 agents, and a hook layer — has exactly the shape where a phantom handoff is a real, findable defect. Ship it with the fires / does-not-fire / real-corpus triple that `test/conventions.test.ts` already uses for its seven covered rules.
- **The defender-wave doctrine, written down now.** Add to `skills/catalog/skill-authoring/SKILL.md`: any future cull of sage-mode's own skill corpus runs proposer and defender as **separate dispatched agents**, and a defender working without git history may not return `cut`. Capturing the rule costs twenty lines; re-deriving it after a bad cull costs a corpus.

---

## 6. The fresh pass — re-verification, and what nobody has found yet

### 6.1 Ten prior claims, re-checked against current source

| # | Claim | Source | Verdict |
|---|---|---|---|
| 1 | `sage-lane` nests a heredoc inside `$( )` at five sites; two apostrophe comments trigger the bash 3.2 parse failure | ship-plan WP-1 | **Confirmed, still open.** `hooks/sage-lane:38,116`; `hooks/sage-proof:32`; `hooks/sage-solo:54,69`. Both apostrophes still present verbatim at `hooks/sage-lane:127` (*"Match Python's list repr"*) and `:176` (*"mirroring Python's"*). |
| 2 | The golden harness normalizes empty stdout to `{}` | ship-plan WP-2 | **Confirmed, still open.** `hooks/tests/run.sh:70` — `s=sys.stdin.read().strip() or '{}'`. |
| 3 | Lane B consult passes `--allowedTools "Read,Grep,Glob"`; no `--bare` guard | ship-plan WP-11 | **Confirmed.** `lib/consult/index.ts:265`. The only other `bare` in the file is an unrelated comment at `:75`. |
| 4 | Cross-session dedup is prose, not code | ship-plan WP-10 | **Confirmed.** Rule stated correctly at `skills/sage-review/SKILL.md:104-106`. `grep -n "skipped\|prior\|contentHash" lib/review/index.ts` → zero hits. |
| 5 | Scorecard still says *"Maturity: 1. Zero lines of code"* | ship-plan WP-12 | **Confirmed, still stale.** `docs/research/scorecard.md:14`, `:58`, `:97`. Also still there: *"Time to first value: 4 — third from last"* at `:99`, which two-spines §1 relies on. That one is a judgment, not a stale fact, and it stands. |
| 6 | Three items flagged 2026-08-25 are already fixed: the `sage-careful` MEDIUM matcher, agent rationalization tables, the scope valve | two-spines §0 | **All three confirmed fixed.** `hooks/sage-careful:186-204` (token-aware `MED_HAS_RM`/`HAS_R`, plus `CMD_UPPER` for case-insensitive SQL, with comments naming the bug they replace); `grep -rl "Common Rationalizations" agents/*.md` returns **19 of 19**; `rules/sage-conduct.mdc:60-62` carries the `NOTICED BUT NOT TOUCHING` pattern. |
| 7 | `extractModelReceipt` closes Lane B verification | two-spines §0 | **Confirmed.** `lib/consult/index.ts:58-64`, with `verified: boolean` at `:13` and the never-guess rule documented at `:53-57`. |
| 8 | *"sage-mode has no claim/evidence separation; it doesn't do this"* | two-spines §5.3 | **Corrected — see §1.1.** The doctrine is at `skills/sage-review/SKILL.md:85-91,114-116,193`, `skills/sage-build/SKILL.md:104-105`, `agents/reviewer.md:14,17,31`. Only the mechanism is missing. |
| 9 | *"`ce-compound` dispatches six specialist research subagents before writing a learning"* | two-spines §4.4 | **Corrected — see §1.1.** Three subagents pre-write (`ce-compound/references/research.md:51-54`); six specialists are optional post-write, problem-type-routed (`references/enhancement.md:11-19`). |
| 10 | Tier-2 evals have no pairwise skill-collision check | two-spines §6 | **Confirmed** — `test/evals.test.ts:11-27` asserts rank-1 accuracy only, over 62 queries covering 37 distinct expected ids. Worth adding that the fix is **cheaper than the proposal implied**: `RecallIndex` already carries per-document `terms` and corpus `df` (`lib/recall/index.ts:25,77,99-104`), and `overlap()` at `:178-183` is already a Jaccard. A pairwise pass is ~30 lines over data that exists — no new indexing. |

Two-spines' methodological claim holds up: re-verifying against source is where the value is. Four of ten needed a correction or a material sharpening.

### 6.2 New findings

**N-1 · The conduct rule contradicts both intake skills on batching.**
`rules/sage-conduct.mdc:48`: *"Batch every open question into a single decision call. Do not interrupt N times."* `skills/sage-shape/SKILL.md:35`: *"Ask exactly one question… never fold two into a single turn because it 'feels more efficient.'"* `skills/sage-plan/SKILL.md:108`, rationalization table: *"I'll batch the priority and sequence questions"* → *"One at a time is the method."* The conduct rule is `alwaysApply: true` and loads first; nothing in it scopes line 48 to gates rather than to all questions. Seven design documents have walked past this. Severity: it determines the texture of every intake session, and the source of truth currently says both things. Fixed in WP-17, jointly with `/sage-grill`'s round format.

**N-2 · Compiled `.js` is committed beside its `.ts`, and CI is structurally blind to their drift.**
`plugin/tsconfig.json` sets `"outDir": "."` and `"rootDir": "."`, so TypeScript compiles in place. `git ls-files` shows **17 tracked `.js` under `plugin/lib/`, 15 under `plugin/test/`**, plus `plugin/evals/tier3/run.js`. Neither `.gitignore` excludes them. `.github/workflows/ci.yml` runs `npm run build` *before* `npm test`, `lint`, `hooks:test`, and `eval:tier3` — so CI always exercises **freshly compiled** output and can never observe that the committed `.js` is stale. The workflow's own comment records this having already happened once: *"It used to be excluded, which is how the .ts and the committed .js were free to drift apart unnoticed."* And a plugin **install copies files; it does not build** — the committed `.js` is what a user actually runs. Checked by mtime across six modules: currently in sync. So this is a latent hazard, not a live bug, and it is 30 minutes to close permanently (WP-16).

**N-3 · `lib/recall` — the retrieval backbone of the entire catalog design — has one unit test.**
`test/recall.test.ts` is **18 lines** asserting a single negative case (a zero-hit query returns `[]`). The BM25 scorer (`lib/recall/index.ts:132-142`), the index builder (`:93-112`), `dedupAppliesWhen`'s threshold logic (`:163-176`), and `overlap()` (`:178-183`) have no direct coverage. The only other exercise is the aggregate rank-1 assertion in `test/evals.test.ts:11-27`, which passes or fails as one number over 25 catalog skills. For contrast: `test/setup.test.ts` is 746 lines, `test/dag.test.ts` 617. This matters concretely, because the two things this document proposes to build on top of `lib/recall` — the five-dimension overlap score (WP-29) and the pairwise-collision eval — both need a tested scorer underneath them.

**N-4 · Roughly half of `lib/lint`'s rules have no dedicated test, including `failClosed`.**
`lib/lint/index.ts` is 712 lines and emits ~20 rule codes. `test/conventions.test.ts` covers seven of them well, with a fires / does-not-fire / real-corpus triple each (`:72-355`): `reference-integrity`, `self-containment`, `conduct-parity`, `frontmatter-validity`, `roster-checklist-coverage`, `command-skill-pairing`, `notebook-root-literal`. `lib/lint/index.test.ts` (71 lines, 2 tests) covers `line-floor` and `empty-references` together. Untested: `line-cap`, `conduct-dupe`, `templated-duplicate`, `disable-model-invocation`, `required-section`, `role-cap`, `lane`, `conduct-cap`, `schema-fixture`, and — notably — **`failClosed`** (`lib/lint/index.ts:686-699`), the rule that asserts every deny-tier hook declares `failClosed: true`. Given that ship-plan WP-1 is a fail-closed hook that fails open, the rule guarding that property having no test is worth one line in the plan. The fix is cheap and the pattern already exists: extend `conventions.test.ts`'s triple to the remaining rules, and require it of every new rule this document proposes.

**N-5 · `sage-retro` is sprint-scoped, and two-spines' own sequencing guarantees no sprints for a week or more.**
`skills/sage-retro/SKILL.md:15-18` reads *"the sprint's ledger, board files, review residuals, verify findings, `.sage/specialist-stats.json`"*, and step 2 (`:27-32`) gathers from `ledger.md`'s Rulings section and `board/<id>.blocker.md` pairs. **Every input is a sprint artifact.** Two-spines §5.1 asserts that all four Spine B commands *"write findings/evidence into the same `.sage/` structures so `/sage-retro` still sees them"* — but `/sage-retro` does not read `.sage/` generically; it reads `.sage/sprints/NN/`. Two-spines' Phase 4 is explicitly a week of Spine B use *before* Phase 10's first sprint. **In that window, the learning loop never fires.** This is the largest structural hole in the two-spines plan, and it is caused by its own (correct) sequencing decision. Fix: a fifth Spine B command, `/sage-learn`, running ce-compound's one-learning-per-run shape against whatever just happened, sprint or not (WP-30). Cheaper and better than teaching `sage-retro` a sprint-less mode, because it also gives Spine B a reason to compound.

**N-6 · A third of the command surface is unscheduled and unevaluated in every plan written so far.**
The design org is six commands (`design-intake`, `design-direction`, `design-system`, `design-build`, `design-critique`, `design-motion`) and seven `design-*` agent cards. ship-plan mentions it once, as documentation drift (WP-12: *"an entire design organization… appears nowhere in architecture-v3"*). Two-spines places it in neither spine and touches it only in §8, to *reject* adopting ui-ux-pro-max because `design-critique` is already strong — which this pass confirms (`skills/design-critique/SKILL.md` runs a genuine capture/judgment split with `qa-driver` capturing and the Critic judging). But "this part is good" is not "this part is planned." Concretely: `evals/tier2/queries.json` has 62 queries over 37 distinct expected ids, of which **three** are design-related (`design-system`, `design-critique`, `design-direction`) — so half the design commands have no retrieval coverage — and none of `evals/tier3/README.md`'s eight process-adherence scenarios touches a design skill. Decide it explicitly (WP-34): a phase in Spine A, its own thing, or split into a separate plugin. Right now it is the largest unowned surface in the repo.

---

## 7. Does the two-spines framing need a third piece? Yes — and here is the argument both ways

### 7.1 State the spines' actual defining property

Two-spines defines them by ceremony: Spine A is heavy and gated, Spine B is cheap and ungated. That is true but it is not the load-bearing distinction. The load-bearing one is:

- **Spine A's unit is a sprint** — coordinated multi-node work with a DAG, worktrees, joins, and a ship gate. Bounded by a week.
- **Spine B's unit is one existing thing** — a diff, a bug, a question about code that already exists. Bounded by one session.
- **Both spines' output is a change to a codebase.** Neither has a terminal state that produces no code.

### 7.2 Test the four asks against that

| Ask | Fits? |
|---|---|
| grill → spec → tickets | **Yes.** Grilling is Spine A's front door, improved. `/sage-spec` and the tracer-bullet discipline are `sage-plan`/`sage-dag`, improved. No new concept. |
| commander console | **Yes.** It is a presentation layer over Spine A's existing execution. No new concept. |
| self-improvement | **Almost.** `sage ground` is a `lib/` verb usable anywhere. But N-5 shows the *capture* half currently belongs to Spine A alone, and Spine B produces nothing it reads. That is a bug in the framing, fixable inside it (`/sage-learn` as Spine B's fifth command). |
| `office-hours` | **No.** Its legitimate terminal state is *"don't build this."* Neither spine has one. |
| `wayfinder` | **No.** Its unit is an effort larger than one session and smaller than a commitment. It explicitly *"produces decisions, not deliverables"* (`wayfinder:13`) and spans many sessions. Spine A's ledger is sprint-scoped; a decision ticket has no `owns`, no `verify`, and no diff. |

Two of five don't fit, and they are the two the user named as things he wants.

### 7.3 The case for a third spine

**Spine C — the decision spine. Work whose output is a decision, not a diff.**

- **Unit of work:** one resolved question.
- **Members:** `/sage-oh` (should this exist at all), `/sage-map` (what must be decided before this can be built), `/sage-spec` (what exactly are we building), with `/sage-grill` and the glossary/ADR discipline underneath as shared primitives.
- **Ledger:** the map, and `.sage/out-of-scope/`.
- **Artifact:** a decision record with a citation.
- **Terminal states include "no."** This is the property neither existing spine has and the reason a mode won't do.
- **Merge point:** `/sage-map` → `/sage-spec` → `/sage-plan`. Spine C hands to Spine A and never builds. That is Matt's own rule (`ask-matt:46`) and it is what keeps the three concepts from blurring.

### 7.4 The case against, taken seriously

Two real objections.

**(a) "Make it a mode of `/sage-shape`."** The strongest counter-argument, and it nearly works. `sage-shape` is already the intake skill, already runs a premise challenge, already generates alternatives. Against it: `sage-shape`'s completion condition **requires** a rendered roadmap with an evidenced why per row and an explicit approval (`:425-427`); `/sage-plan` refuses without `status: approved` on that roadmap (`:24`); and `:190` rules that the seven topics, the demand test, the premise challenge and the alternatives are *"the skill, not optional scaffolding around it."* Adding "and sometimes it produces no roadmap and spans six sessions" to that file is not a mode — it is a different skill wearing `sage-shape`'s frontmatter and inheriting its gate. Note also that `lib/lint`'s line cap was already raised specially for this file (`lib/lint/index.ts:11-14`: `"sage-shape": 900` against a `DEFAULT_CAP` of 250, currently at 427 lines). The file is already the exception. Making it the exception twice over is how a 900-line cap becomes a 900-line file.

**(b) "A third spine is more surface, and surface is the diagnosed problem."** This one lands, and it should be conceded rather than argued around. Two-spines' whole thesis rests on the scorecard's self-diagnosed *"Time to first value: 4 — third from last… Eight commands, an org chart, three cost lanes, a notebook renderer, an evidence ledger, and four hooks is a lot of surface before the first useful output"* (`docs/research/scorecard.md:99`). Spine C adds three commands to a repo that already has seventeen and has shipped zero sprints. Each one costs a command file, a skill, a `command-skill-pairing` lint entry, a tier-2 query, and a tier-3 scenario.

### 7.5 The call

**Name the concept. Build two of its three members. Sequence it last.**

- **Name it**, because the alternative is three commands with no shared story, and because "work whose output is a decision" is the sentence that makes `/sage-oh`'s `don't-build` verdict and `/sage-map`'s fog section look like the same idea rather than two unrelated imports.
- **Build `/sage-spec` and `/sage-oh`.** `/sage-spec` is mostly a template plus a wiring to the out-of-scope registry. `/sage-oh` is `/sage-grill` plus a verdict plus a write. Both are cheap because `/sage-grill` (WP-18) carries their weight.
- **Defer `/sage-map`** to after Spine B has been used for a week and after Spine C's cheaper members have proven the concept. It is the most expensive item in this document, and its honest first test case is sage-mode itself — an effort that has visibly outgrown one session and is currently being managed with eight design documents instead of a map, which is exactly the failure wayfinder names.
- **Set a falsifiable test.** If after a month `/sage-oh` has fired and produced at least one `don't-build` verdict that prevented real work, Spine C earned its surface. If every run ends in `build`, it was ceremony, and it should collapse back into `/sage-shape` as a mode after all. Write that test into the skill's own header, so the collapse is a planned outcome rather than an admission.

---

## 8. Work packages

Numbered from WP-16 to continue ship-plan's sequence. Each is problem / design / acceptance. Effort is engineering hours unless stated.

### Phase 0-adjacent — cheap, do alongside ship-plan's correctness day

**WP-16 · Build-freshness gate** — *30m*
**Problem.** `tsconfig.json` compiles in place (`outDir: "."`), 33 generated `.js` files are tracked in git, `.gitignore` excludes none, and CI runs `npm run build` before every check — so it can never observe that the committed `.js` is stale. A plugin install copies files rather than building them, so committed `.js` is what a user runs. The workflow's own comment records this drift having happened once already. (N-2)
**Design.** Add a `build:check` script running `npm run build && git diff --exit-code -- '*.js'`. Wire it into `npm run verify` and into `ci.yml` immediately after `npm run build`.
**Acceptance.** Editing a `.ts` without rebuilding fails `npm run verify` and CI with the offending file named.

**WP-17 · Resolve the batching contradiction** — *30m*
**Problem.** `rules/sage-conduct.mdc:48` mandates batching every open question; `skills/sage-shape/SKILL.md:35` and `skills/sage-plan/SKILL.md:108` forbid it. The conduct rule is `alwaysApply: true`. (N-1)
**Design.** Amend the conduct rule's Decision-brief section to distinguish a **decision call** (every open decision batched into one — unchanged) from an **interview round** (one frontier's worth of questions, numbered, each carrying a recommendation). Update `sage-shape:35` and `sage-plan`'s rationalization row to cite the distinction rather than contradict it.
**Acceptance.** `sage lint`'s `conduct-parity` rule passes; no skill states a batching rule that contradicts the conduct file; a reader of either file reaches the same answer.

**WP-33 · `lib/recall` unit coverage** — *3h*
**Problem.** The retrieval backbone has 18 lines of test asserting one negative case. (N-3) Two later packages (WP-29's overlap scoring, the pairwise-collision eval) build directly on the untested scorer.
**Design.** Direct tests for `bm25` (idf monotonicity, length normalization), `buildIndex` (frontmatter kinds, df computation), `overlap`, and `dedupAppliesWhen` around its `0.55` boundary in both directions.
**Acceptance.** Every exported function in `lib/recall/index.ts` has at least one direct assertion; the `dedupAppliesWhen` threshold has a both-sides test.

### Thread 1 — the working style

**WP-18 · `/sage-grill`, the interview primitive** — *1 day* · **blocks WP-20, WP-22, WP-35**
**Problem.** `sage-shape`'s interrogation loop is serial, one question per turn, with no recommendation attached and no way to acquire a fact mid-interrogation. The user prefers `grilling`'s frontier rounds.
**Design.** New `skills/sage-grill/SKILL.md` owning design-tree / frontier / round mechanics (§2.4 T1-A). Round format per `grilling:12-22`, extended with an evidence rung per recommendation. Non-blocking fact dispatch to `librarian` on Lane A. `sage-shape` step 2 and `sage-plan` step 4 call it; `sage-shape` keeps its seven topics as the root set.
**Acceptance.** A `/sage-shape` run asks a whole frontier in one numbered round with a recommendation per question; a fact-dependent question is deferred to the next round while the rest of the frontier is asked; the session ends only when the frontier is empty; `npm run lint` passes with the new skill paired to a command and a tier-2 query.

**WP-19 · Domain-modeling reference + glossary in recall** — *3h*
**Problem.** Nothing challenges terminology during intake, and there is no glossary artifact. `catalog/adr` exists but is retrieval-only and never fires during a conversation. (§2.2)
**Design.** `skills/sage-grill/references/domain-modeling.md` — the four in-session moves, the glossary-only rule for `CONTEXT.md`, the three-condition ADR bar. Add `kind: glossary` to `lib/recall`'s index for `<notebook>/CONTEXT.md`. No new command.
**Acceptance.** `sage recall "<a project term>" --kind glossary` returns the term's entry; a `/sage-grill` run that resolves a fuzzy term writes it to `CONTEXT.md` inline, not batched.

**WP-20 · `/sage-spec` — the feature spec** — *1 day* · needs WP-18, adoption A-7
**Problem.** `sage-plan`'s `spec.md` is a sprint contract, not a feature spec: no user stories, no seams, no testing decisions. The user's stated pipeline has a spec step between grilling and tickets and sage-mode does not have that artifact.
**Design.** §2.4 T1-C. New command + skill + `templates/feature-spec.md`; no interview; declared seams as frontmatter read by `sage-dag`'s survey; Out-of-Scope entries append to `.sage/out-of-scope/`. `sage-plan` step 3 reads an existing spec for a candidate row.
**Acceptance.** A spec written from a `/sage-grill` conversation renders, declares at least one seam, and its out-of-scope entries appear as files under `.sage/out-of-scope/`; a later `/sage-plan` on that roadmap row surfaces them.

**WP-21 · Tracer-bullet discipline in `/sage-dag`** — *5h*
**Problem.** D2 is the only mechanical check on decomposition, and it rewards horizontal slicing — the opposite of what a tracer bullet is. Verticality is named nowhere in the D-invariants, the node-authoring rules, or `agents/architect.md`. (§2.3)
**Design.** `slice: vertical | prefactor | refactor-batch` required in `dag.schema.json`. **D8** (gate-surfaced): a `vertical` node with no observable outcome in its acceptance criteria. **D9** (gate-surfaced): report every pair serialized because their `owns` intersected. Expand–contract written into `skills/sage-dag/references/`. One paragraph in `agents/architect.md` naming `depends_on` as a blocking edge and verticality as the default cut.
**Acceptance.** `sage dag validate` rejects a node missing `slice`; the gate summary names every D8 and D9 hit; a fixture DAG with two vertical nodes forced apart by a glob collision reports the serialization by name.

### Thread 2 — the gut check

**WP-22 · `/sage-oh`** — *1 day* · needs WP-18
**Problem.** There is no way to use sage-mode to think about an idea without committing to a roadmap, and no terminal state in which the answer is "don't build this." (§3.2)
**Design.** §3.3 T2-A. Two postures; calls `/sage-grill` with stage-routed topics; references `sage-shape`'s demand table rather than copying it; writes `<notebook>/ideas/<slug>.md` with a verdict and an Assignment; `don't-build` writes to `.sage/out-of-scope/`; landscape search enforced through `lib/redact` + `lib/egress` with category terms only.
**Acceptance.** A run ending in `don't-build` writes an out-of-scope entry that a later `/sage-plan` surfaces when the same concept is proposed; a run's premise challenge carries a `verified` model receipt; no web search leaves the machine without a redacted query and an egress row.

**WP-23 · `sage review doc` — the spec review loop** — *4h* · **highest value per hour in this document**
**Problem.** sage-mode reviews code adversarially with a different model on a metered lane, and reviews the documents that decide what code gets written with nothing at all. (§3.2)
**Design.** §3.3 T2-B. New `lib/review` entry point; Lane C readonly; sees only a document path; five-dimension rubric in `skills/sage-review/references/checklists/design-doc.md`; max 3 iterations; convergence guard persisting unresolved items as `## Reviewer Concerns`; non-blocking. Wired pre-gate into `/sage-shape`, `/sage-plan`, `/sage-dag`, `/sage-oh`, `/sage-map`.
**Acceptance.** Running it on `docs/design/two-spines-roadmap.md` returns a scored report; a document whose reviewer returns the same issue twice gains a `## Reviewer Concerns` section and the loop stops; an unavailable reviewer produces a one-line notice and does not block the gate.

### Thread 3 — the console

**WP-24 · `sage board render` + status line** — *4h*
**Problem.** Nineteen agents with lanes, ownership globs and a mechanical circuit breaker, presented as a 28-line skill and a flat markdown table with a `model` column nothing verifies. (§4.2)
**Design.** §4.3 T3-A. New CLI verb using the existing `lib/notebook` renderer; per-node agent name, lane, attempts, review cycles, evidence freshness, `owns`; the five-component WTF breakdown; a declared-vs-observed model column with an explicit unverified-by-construction note where SPIKE-02 says no receipt exists; a one-line commander summary at the top of `/sage-status`.
**Acceptance.** `sage board render` produces HTML from a fixture ledger with every node's owning agent named; the WTF total equals the sum of the five displayed components; the model column never shows an `observed` value that did not come from a receipt.

**WP-25 · Per-specialist attribution, Agreement Map, Dismissed bucket** — *4h*
**Problem.** The review pipeline computes multi-specialist agreement and discards it at render time; there is no Dismissed surface and no place the user adjudicates a disagreement. (§4.2)
**Design.** §4.3 T3-B. Render by agreement structure first, confidence second; interrogate's four buckets above the existing AUTO-FIX/ASK; dismissals shown with rationale; an Agreement Map keyed on the eight role checklists.
**Acceptance.** A review whose specialists disagree on the same line renders both positions under named headings; every dismissed finding carries a one-line rationale; no finding disappears from the report without appearing in exactly one bucket.

**WP-26 · The `disputed` disposition** — *4h* · needs WP-25
**Problem.** Every AUTO-FIX finding is applied unconditionally (`skills/sage-review/SKILL.md:141`). The implementer has no path to say a finding is wrong. sage-mode hardened one side of the review protocol and left the other with no options. (§4.2, §4.3 T3-C)
**Design.** New disposition `disputed` with a required `rebuttal_evidence` field at rung ≥ 2; disputed findings route to the ASK batch with both sides shown; bounded at two per node per cycle, and an overruled dispute counts against the three-cycle budget. Add `superpowers/receiving-code-review`'s push-back conditions and its YAGNI grep as a reference under `skills/sage-review/references/`.
**Acceptance.** A dispute with no `rebuttal_evidence` is rejected by the schema; a disputed finding never lands as an AUTO-FIX; a third dispute in one cycle is refused with the bound named.

**WP-27 · `posture:` on the plan and DAG gates** — *1h*
**Problem.** Review postures are implicit; an Architect consult has no standing instruction about whether the user wants scope expanded, held, or cut, and nothing binds it across a sprint. (§4.3 T3-D)
**Design.** `posture: expand | hold | reduce` in the spec frontmatter, chosen once at the `/sage-plan` gate, binding on every Architect consult for the sprint, with gstack's commit-to-it rule (`plan-ceo-review:897`) in `agents/architect.md`. One lint rule requiring the field when `readiness` is set.
**Acceptance.** `sage lint` fails a spec with `readiness` set and no `posture`; the Architect brief carries the posture; a `/sage-dag` consult that proposes scope contrary to the recorded posture is flagged at the gate.

### Thread 4 — grounding and compounding

**WP-28 · `sage ground <file>`** — *6h* · **the one item testable today**
**Problem.** Documents in this repo assert things about source that stop being true; two consecutive audit rounds found roughly six such claims. Nothing checks. (§5.2)
**Design.** §5.3 T4-A. Mechanical pass (paths, SHAs, scaffold, relative links) with `grounding-validation.md:18-29`'s adjudication table; semantic pass as one Lane C readonly dispatch over three claim categories with the softening policy for unverifiable claims. Never auto-rewrites, never auto-passes.
**Acceptance.** `sage ground docs/design/two-spines-roadmap.md` flags §4.4's specialist claim as unsupported by its cited path and flags nothing that is correct; a file with a fabricated SHA and a `{{scaffold}}` leak produces both flags with the right classifications; running it twice after adjudication produces a clean report.

**WP-29 · `sage-retro`: grounding, five-dimension overlap, third staleness verdict** — *3h* · needs WP-28, WP-33
**Problem.** Learnings' claims are never verified before they compound; dedup is a single threshold with no visibility; the staleness re-check cannot express "couldn't tell." (§5.3 T4-B)
**Design.** Step 3 calls `sage ground`. Replace `dedupAppliesWhen`'s single score with five dimensions mapped onto the learning template's own sections; High → update, Moderate → show both, Low → new. Step 4 gains "cannot verify from this sprint," which leaves `last_confirmed` untouched and records the attempt.
**Acceptance.** A retro drafting a learning that cites a deleted path is flagged before the file is written; a Moderate-overlap dedup presents both records to the user rather than silently choosing; a learning that could not be checked this sprint does not have its `last_confirmed` bumped.

**WP-30 · `/sage-learn` — sprint-less learning capture** — *3h*
**Problem.** Every `sage-retro` input is a sprint artifact, and two-spines' own sequencing puts a week of Spine B use before the first sprint. In that window the learning loop never fires. (N-5)
**Design.** Spine B's fifth command. One learning per run, ce-compound's shape (`ce-compound/SKILL.md:13`), reading a rolling window of `.sage/findings/` and `.sage/evidence/` rather than `.sage/sprints/NN/`. Same dedup, same grounding pass, same template, same supersede convention. Writes into the same `<notebook>/learnings/`.
**Acceptance.** A `/sage-fix` session followed by `/sage-learn` produces a deduped, grounded learning with no sprint present; running it twice on the same problem updates rather than duplicates.

**WP-31 · Retune Phase-0 gate** — *4h*
**Problem.** sage-mode cannot run a measured corpus retune and has no way to say so legibly. The missing piece is the build selector; `evals/tier3/run.ts:32-35` hardcodes the corpus root. (§5.3 T4-C)
**Design.** `--corpus <path>` on the tier-3 runner and a `SAGE_CORPUS` override in `lib/util.ts`; a run-archive row per scenario appended to `.sage/eval-runs.jsonl` reusing `lib/evidence`'s record shape; `sage retune --check` printing which of the three Phase-0 requirements is present and refusing when any is missing. Defer the noise floor, the audit, and the cut passes.
**Acceptance.** `node evals/tier3/run.js --corpus <other checkout>` runs against that checkout and every archive row carries its `corpus_commit`; `sage retune --check` names the model-in-the-loop harness as the missing requirement and exits non-zero.

**WP-32 · `phantom-handoff` lint rule + defender doctrine** — *3h* · needs WP-33's pattern
**Problem.** Prose written as if a second party were waiting teaches the model to end its turn; `ce-retune` names this the highest-value defect class in a skill corpus, and sage-mode has 44 skills, 19 agents and a hook layer. (§5.3)
**Design.** Lint rule grepping every SKILL.md for handoff prose and asserting the named party exists in that skill's dispatch list or the agent roster. Ship with the fires / does-not-fire / real-corpus triple `test/conventions.test.ts` already uses. Separately, write `corpus-audit.md`'s defender-wave rule into `skills/catalog/skill-authoring/SKILL.md`.
**Acceptance.** The rule fires on a fixture skill naming a nonexistent reviewer and does not fire on a real dispatch; the real-corpus case passes or names every genuine phantom handoff; `skill-authoring` states the proposer/defender separation and the no-history-no-`cut` rule.

### Fresh-pass hygiene

**WP-34 · Place the design org** — *2h*
**Problem.** Six commands and seven agents are unscheduled in all four plans, have retrieval coverage for three of six, and have zero tier-3 scenarios. (N-6)
**Design.** Decide explicitly: a phase inside Spine A, a member of Spine C, or a separate plugin. Whichever is chosen, add tier-2 queries for the three uncovered commands and one tier-3 scenario for `design-critique`'s capture/judgment split (which is the mechanic worth protecting).
**Acceptance.** Every design command has at least one non-optional tier-2 query; one tier-3 scenario asserts that the capturer is not the judge; the chosen placement is written into whichever roadmap document survives.

**WP-35 · `/sage-map` — wayfinder on the DAG engine** — *2 days* · needs WP-18, WP-20; **sequence last**
**Problem.** No artifact in the repo holds a decision that isn't a feature, spans more than one session, and can terminate in a scope boundary. (§2.2, §7)
**Design.** §2.4 T1-E. Map and ticket artifacts under `<notebook>/maps/`; `sage map frontier` and `sage map claim` implemented over `lib/dag`'s existing topological machinery; four ticket types with HITL/AFK split; fog rules and the never-graduates out-of-scope rule verbatim; hands off to `/sage-spec` and never builds; a lint rule for stalled maps.
**Acceptance.** A charted map's frontier is computed, not stored, and matches a hand-derived answer on a fixture; a second non-research claim in one session is refused; resolving a ticket that graduates fog removes the graduated text from *Not yet specified*; an emptied frontier refuses to build and names `/sage-spec`.

### Sequencing, merged into two-spines' phases

```
Phase 0   Hygiene + Foundation      ship-plan WP-14 → WP-2 → WP-1 → WP-3
                                    + WP-16 (build-freshness)  + WP-17 (batching)
Phase 1   Platform truth            ship-plan WP-4, WP-5
Phase 1.5 Grounding                 WP-28  ← run it on docs/design/ the day it lands
Phase 2   Spine B foundations       A-2, A-3, A-6, A-7  + WP-33 (recall coverage)
Phase 3   Build Spine B             /sage-look → /sage-crit → /sage-fix → /sage-debug
                                    + WP-30 (/sage-learn, Spine B's fifth)
Phase 3.5 Doc review                WP-23  ← serves every gate in every spine
Phase 4   USE Spine B for a week    unchanged — two-spines' definition-of-done #7
Phase 4.5 The interview             WP-18 (/sage-grill) → WP-19 (glossary)
Phase 5   Claude Code               ship-plan WP-6 → WP-7 → WP-8
Phase 6   Cost-lane closure         SPIKE-02 result → WP-24 (console) consumes it
Phase 7   Quality machinery         A-4, A-5, collision eval, RED/GREEN/REFACTOR
                                    + WP-32 (phantom-handoff)  + WP-34 (design org)
Phase 7.5 The commander             WP-24 → WP-25 → WP-26 → WP-27
Phase 8   Coordination              A-8 doctrine → the two hooks
Phase 9   Docs + hygiene            ship-plan WP-10..13
Phase 10  The real sprint           ship-plan WP-15
                                    + WP-21 (tracer-bullet discipline) lands before it
Phase 11  Spine C                   WP-20 (/sage-spec) → WP-22 (/sage-oh)
Phase 12  Deferred                  WP-29 (retro upgrade, after a real retro exists)
                                    WP-31 (retune gate)
                                    WP-35 (/sage-map) — after Spine C has proven itself
```

**Estimate:** ≈ 7 additional days of engineering on top of two-spines' ≈ 9. That is a lot, and pretending otherwise would repeat the mistake this document is partly about.

**The cut, if only three things get built:** **WP-16 (30m), WP-23 (4h), WP-28 (6h).** Roughly one day, total. The reason those three: **all three pay off against artifacts that already exist, today, with zero sprints run and zero Spine B commands built.** WP-16 makes CI able to see a bug class it is currently structurally blind to. WP-23 puts an adversarial reader on the documents that decide what gets written, in a repo that reviews code obsessively and its own plans not at all. WP-28 is the mechanism against the one failure this repo has demonstrated repeatedly and measurably — documents asserting things about source that stopped being true.

Everything else in this document is worth doing after the tool has been used.

---

## 9. The thing worth saying plainly

This is the eighth design document in `docs/design/` and the fourth in two days. The pattern is real and it is worth naming precisely rather than gesturing at, because the obvious reading of it is wrong.

The obvious reading is "too much planning, not enough building." But look at what the last two audit rounds actually produced. Two-spines' §0 caught three claims that had gone stale between audits — and that was its most valuable output, by its own admission. This pass caught three more, plus a contradiction sitting in the conduct rule that seven documents walked past. That is not a repo that is over-planned. That is a repo where **the planning and the building are running on different clocks and nothing reconciles them.** Six wrong claims in two rounds is a measurement, and it is the measurement that puts `sage ground` at the top of the cut list rather than anywhere near the bottom.

Here is the sharper version, and it is uncomfortable. The repo's whole thesis is that unreviewed, unevidenced output is worth less than reviewed, evidenced output. It enforces that thesis on code with a fail-closed hook tier, a content-addressed evidence fingerprint, an adversarial reviewer on a separate model lane that is forbidden from seeing the author's claim, and a mechanical confidence gate. And **its eight largest artifacts — every document in `docs/design/`, including this one — were written with no interrogation, no gate, no review pass, and no evidence record.** The one activity sage-mode's machinery has never been pointed at is the activity this repo spends most of its time on. WP-23 and WP-28 are the two items that close that, and they are the two that can run before anything else here.

On the four preferences that prompted this pass: three of them turned out to be things sage-mode already half-has, and in two places has more strongly than the repo it would be copying from. `sage-shape` is a harder `office-hours`. `sage-dag` is a richer `to-tickets`. `sage-retro` already does bounded staleness re-checking and transcript-grounded rationalization mining that `ce-compound` does not. **The answer to "what do we need to be 10x better" is not "port four repos in."** It is: extract the interview loop so it can be reused, give the decision work its own name and its own terminal state, put a screen in front of the army, and start checking whether the documents are telling the truth.

The genuinely absent things are two. There is no wayfinder — nothing that holds a question rather than a feature, spans sessions, and can end in a scope boundary. And there is no console — nineteen agents with lanes, ownership globs, worktrees and an auditable circuit breaker, all of it rendered as a markdown table with an unverified model column. Those two, plus the grounding verb, are what would actually change how this feels to use.

Two-spines closed by saying that Phase 4 — four cheap commands used on real work for a week — is the cheapest experiment available and should decide how much of the rest gets built. That is still right, and nothing here should be read as a reason to delay it. But there is now a cheaper one, available before Phase 0 finishes: run `sage ground` against `docs/design/`. If it flags a wrong claim in *this* document, it has earned itself and everything downstream of it. If it flags nothing across eight documents that two audit rounds have already found six errors in, then the mechanism doesn't work and should be cut — which is also a result, and a much cheaper one than another audit.

One `don't-build` verdict, or one wrong claim caught mechanically, would each be worth more than the ninth design document.
