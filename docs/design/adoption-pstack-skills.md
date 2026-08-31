# Adoption Plan — what to take from pstack and mattpocock/skills

**Prepared:** 2026-08-31 · **Sources audited:** `pstack` (Lauren Tan, v0.14.5) · `skills` (Matt Pocock, v1.2.3)
**Against:** [architecture-v3](./architecture-v3.html) · [ship-plan](./ship-plan.html) · [audit](./audit-2026-08-31.html)
**Method:** both plugins read end to end by parallel auditors — every SKILL.md body, playbook, reference file, script, and repo-level doc. Every load-bearing claim below was then re-verified against source by hand.

> **The finding in one sentence.** sage-mode has one gear. pstack has twenty-two and Matt has thirty-seven, and both of them have a cheap gear — the thing you reach for on a Tuesday afternoon. That, not any individual mechanic, is why sage-mode has never been used, and it is the single change worth making.

---

## 1. The structural finding

Put the three surfaces side by side and the gap is not subtle:

| | Entry point | Cheapest useful invocation | Gate before work starts |
|---|---|---|---|
| **sage-mode** | 8 sprint commands | a whole sprint | `/sage-plan` **refuses** without an approved roadmap |
| **pstack** | `/poteto-mode` → 22 playbooks | a read-only "how does X work" | none |
| **skills** | 22 user-invoked skills à la carte | `/wait-what`, 3 lines | none |

Both new sources make the same architectural bet sage-mode did not: **the process scales down.** pstack's playbook set runs from a read-only investigation through a bug fix to an overnight autopilot program, all through one entry point. Matt's skills are individually invocable, and the "main flow" is an optional path through them rather than a wall.

sage-mode's minimum unit of value is a week-shaped sprint behind four approval gates. That is a real design choice with real benefits — the ledger, the DAG, the evidence chain all depend on it — but it means the tool pays out a few times a quarter, and **a tool you reach for a few times a quarter compounds nothing.** The `/sage-retro` learning loop, the BM25 catalog, the notebook: all of them are amortized over a usage rate that is currently zero.

So the headline recommendation is not a list of steals. It is: **add a second spine.**

---

## 2. The two sources, characterized

### pstack — rigor primitives behind a sticky mode

45 skills (21 of them `principle-*`), 22 playbooks, 6,638 LOC of tested TypeScript/shell, 69 tests, 11 guide pages. **Zero hooks, zero CI.**

Its centre of gravity is *operational scar tissue*. Playbooks name specific past failures with costs attached — "severed a 41-PR chain and cost a day of repair", "twenty-one verdicts went stale this way in one run with no signal at all". Eight of the 22 playbooks exist for work the human isn't watching. It ships a PR-state watcher and an orchestration-state CLI with atomic writes, PID locking, and spreadsheet-formula-injection defense in the evidence cells.

It is also the closest thing to a direct competitor sage-mode has: a Cursor plugin, by a Cursor engineer, doing multi-model role assignment for rigorous engineering work.

**Where it beats sage-mode:** everyday-task surface, unattended operation, and having actually been run in anger.
**Where sage-mode beats it:** the evidence primitive, mechanical enforcement, and cost. pstack mentions cost *zero times in 7,807 lines* and will fan four max-tier reasoning models at a single code review.

### skills — a documented craft of writing prompts

37 skills across five lifecycle buckets, ~3,900 lines of skill markdown, ~2,100 lines of human docs. **472 LOC of code total, none of it implementing a skill.** No tests, no linter, no eval harness, no CI gate on content.

Its real product is not the skills; it is `writing-for-agents` — a genuine theory of prompt authoring — plus a set of repo invariants (invocation axis, graduation checklist, docs evidence rule) enforced entirely by hand.

**Where it beats sage-mode:** everyday-task coverage and skill-authoring craft, plainly and not closely.
**Where sage-mode beats it:** everything mechanical. Its `code-review` returns under 400 words of unstructured prose with no confidence, no dedup, no line-citation requirement.

### The trade that defines this whole document

> **Matt has an excellent theory of skill quality and no way to check whether any file obeys it. sage-mode has 20+ lint rules, 277 tests, and a hook tier — and no theory.**

`lib/lint/index.ts` already enforces `conduct-dupe`, `templated-duplicate`, `line-cap`, `line-floor`, `self-containment`, `reference-integrity`. That is exactly the machinery `writing-for-agents` needs and has never had. Taking the theory and running it through the checker produces something **neither repo has**, and it is the most defensible thing in this plan.

---

## 3. What to adopt

Nine items. Each names the source file, why it fits sage-mode's thesis specifically, and — the important column — **what sage-mode can do with it that the source cannot**, because sage-mode has enforcement and they don't.

### A-1 · A second spine: the task command set  *(Large — this is the plan)*

**Source:** `pstack/skills/poteto-mode/playbooks/` (bug-fix, perf-issue, investigation, runtime-forensics), `skills/skills/engineering/{diagnosing-bugs,code-review,resolving-merge-conflicts}/SKILL.md`

Add a small set of commands that share sage-mode's machinery but not its ceremony:

| Command | Does | Reuses |
|---|---|---|
| `/sage-fix` | One defect: reproduce → root-cause → minimal fix → evidence | `lib/evidence`, `lib/review`, conduct rule |
| `/sage-debug` | Diagnosis loop; refuses to theorize before a red-capable command exists | `lib/evidence` |
| `/sage-look` | Read-only: how does X work, why was it built this way | `lib/recall`, Explore |
| `/sage-crit` | Review an arbitrary diff, branch, or PR with no sprint | `lib/review` entire |

**None of them read the roadmap. None create a sprint. All of them write evidence and findings into the same `.sage/` structures**, so a task-spine session still feeds `/sage-retro` and the notebook.

**Why it fits the thesis.** It doesn't touch "commands, not routing" — these are four more explicit verbs. It doesn't touch the cost lanes. It extends "the sprint is the unit" honestly: the sprint remains the unit *of coordinated multi-node work*, and a bug fix was never that. The evidence and conduct machinery is what carries across, which is the part actually worth having.

**What sage-mode adds that the sources can't.** pstack's bug-fix playbook says "verify on the matching surface, 'inconclusive' is not a pass" — as prose, in six different files, unenforced. sage-mode can make `/sage-fix` refuse to report done without a FRESH evidence record bound to the working-tree fingerprint. Same discipline, mechanically closed.

**Do not** build a router to pick between them. pstack's `/poteto-mode` is a sticky mode that silently re-classifies on every turn, with no logging and no way to see why a task matched Feature instead of Refactoring — its own guide has to teach users the magic words "new task" to force re-matching. Four explicit verbs beat that.

---

### A-2 · The evidence ladder  *(Small — highest value per hour in this document)*

**Source:** `pstack/skills/blast-radius/SKILL.md:23-29`, verified verbatim:

> 1. You said so. Worthless on its own.
> 2. You pointed at the line. A real `file:line`, or the library's own source.
> 3. You showed the bad case can't happen. You walked the failure step by step and it doesn't reach.
> 4. You ran it. A script or test that calls the real code and fails loud if you're wrong.
> 5. You reproduced it in the running app.
>
> *"Any safety fact you can't get to step 4, say so out loud. Don't write it up as settled."*

**Why it fits.** sage-mode's confidence gate already has the right instinct — quote the motivating line or confidence caps at 5. That is rung 2, hardcoded. The ladder generalizes it from *citation* to *proof*, and each rung names an **action** rather than a feeling, which is why it beats a numeric confidence score.

**Implementation.** Add `rung: 1..5` to the finding schema (`plugin/schemas/finding.schema.json`), and rewrite the gate in `lib/review/index.ts`: the existing "cap at 5 without evidence" becomes "a finding claiming rung ≥ 4 must carry a command and its output, or it is demoted to the rung it can prove." Wire it into `sage-verify` and the `cannot_verify` classification you already have.

**What sage-mode adds.** pstack asks the model to be honest about which rung it reached. sage-mode can *verify* rung 4 — a rung-4 claim is exactly a `sage evidence run` record, and the wtree fingerprint proves it was run against this content. **The ladder becomes checkable rather than confessional.** Neither source can do this.

---

### A-3 · Verdict taxonomy on evidence records  *(Small)*

**Source:** `pstack/skills/poteto-mode/scripts/orch/store.ts` — the typed verdict enum: `live-ui-verified | unit-test-verified | type-check-only | verifier-blocked | verifier-failed`, with the rules *"Behavioral work needs better than `type-check-only`"* and *"CI green is an input to a verdict, not a verdict."*

**Why it fits.** This is the honest gap in sage-mode's best idea. The wtree fingerprint proves *when* a run happened against *what content*. It says nothing about whether the run was worth anything — a passing type-check and a passing live browser walkthrough are the same FRESH record today.

**Implementation.** Add a `grade` field to `EvidenceRecord` in `lib/evidence/index.ts`. Let `sage-verify`'s profiles declare the minimum grade per check kind. `/sage-ship` refuses to cite a `type-check-only` record for a node whose acceptance criteria describe behavior.

**Note the direction of the trade here.** pstack's ledger key is `(PR, SHA)`, which over-invalidates on any rebase — so much so that pstack has to bolt a manual `git patch-id` comparison on top in two separate playbooks to recover what content-addressing gives for free. **sage-mode's primitive is strictly better and should not be touched.** Take the grading scale, not the key.

---

### A-4 · `writing-for-agents` as lint rules  *(Medium — the most defensible thing here)*

**Source:** `skills/skills/productivity/writing-for-agents/SKILL.md` + `SKILL-MECHANICS.md`

The theory names and defines: **the two loads** (context load on the window vs cognitive load on the human, and the claim that cognitive load is *not* to be minimized because it is the price of human agency); **progressive disclosure** as hierarchy protection rather than token saving; **leading words** (recruit a pretrained concept as a single token); **negation** as a failure mode; and a pruning suite — **single source of truth**, **cache** (the environment is authoritative, so restating `package.json` is a cache that must earn its load), **relevance**, **sediment**, and the **no-op test**:

> *"an instruction the model already obeys by default pays load to say nothing. The test (does it change behaviour versus the default?) is model-relative, not reader-relative: two people disagreeing about a no-op disagree about the default, and settle it by running the document, not by debate. When a sentence fails, delete the whole sentence rather than trim words from it."*

**Why it fits.** You have 38 skills of uneven quality and no rubric. This is the rubric. It also directly vindicates a design choice you already made: the 25-skill `disable-model-invocation` catalog reached only by BM25 pays **zero context load** and buys it with cognitive load — which is exactly what the two-loads framing says to do, and it is strictly better than Matt's own hand-maintained prose router.

**Implementation.** Add to `lib/lint/index.ts`, which already has the shape for this:

- `negation` — flag `don't`/`never`/`avoid` clusters above a density threshold in a SKILL.md body; every one should have a positive-steer alternative considered.
- `environment-cache` — flag a skill that restates a command already in `package.json` scripts without saying why.
- `disclosure` — flag a skill whose body inlines material only some branches reach while its `references/` dir sits empty (you already have `empty-references`; this is the inverse).
- `leading-word` — an advisory rule flagging known-weak intensifiers ("be thorough", "carefully", "make sure") as candidate no-ops.

The no-op test itself is not statically checkable — it's model-relative and settled by *running* the document. That is the eval harness neither repo has, and it is a real project, not a lint rule. Scope it separately (A-9).

---

### A-5 · Skill lifecycle: `in-progress` → promoted → deleted-with-redirect  *(Small)*

**Source:** `skills/CLAUDE.md`, `skills/skills/in-progress/README.md`, `skills/skills/deprecated/README.md`

Real, and evidenced in git history — `wait-what`, `wizard`, `to-questionnaire`, `wayfinder`, `code-review`, `teach`, `handoff` all moved `in-progress/ → promoted/` in commits named `feat: graduate X`. `teach` moved *backwards* first. The sharpest part is the deprecation policy:

> *"This bucket is currently empty: a retired skill is deleted, and the changeset that removes it names whatever replaced it."*

**Deprecation as a redirect obligation, not a graveyard.** That is a better policy than most codebases have.

**Why it fits.** Your catalog is 25 skills written in one pass, of uneven quality, with no promotion bar and no removal path. Adding tiers costs a directory.

**What sage-mode adds.** Matt's graduation checklist is enforced by an agent reading `CLAUDE.md`. Yours can be a lint rule: a skill in `catalog/` must have a passing tier-2 retrieval eval (you already have `evals/tier2/queries.json`), a `references/` dir or a documented reason it needs none, and an entry in the catalog index. `in-progress/` skills are exempt and excluded from the BM25 index. **The bar becomes mechanical.**

---

### A-6 · Verbatim step copy with visible `skip:`  *(Small)*

**Source:** `pstack/skills/poteto-mode/SKILL.md:114`, verified verbatim:

> *"Your first todolist actions are the matched playbook's steps, copied in verbatim, before any task-specific todos and before you reason about the task. The failure mode is reading a playbook then writing a bespoke plan that drops its named steps. A step you choose not to do stays in the list with a one-line `skip: <reason>`; skipping silently is not allowed."*

**Why it fits.** This attacks read-then-improvise — the agent reads a procedure, internalizes a vibe, and writes a bespoke plan that quietly drops the expensive steps. It is the failure mode every long sage-mode SKILL.md is exposed to, and `sage-shape` at 427 lines is the most exposed of all.

**Implementation.** One paragraph in `rules/sage-conduct.mdc`, applying to every command skill. Then the mechanical half: `/sage-build` already writes step state to the ledger, so make the skipped-step-with-reason a **ledger row**, and add it to the ledger linter proposed in the ship plan's WP-4 discussion. A skipped step with no recorded reason fails the lint.

---

### A-7 · The out-of-scope registry  *(Small — cheapest cross-sprint memory available)*

**Source:** `skills/skills/engineering/triage/OUT-OF-SCOPE.md`, dogfooded at `skills/.out-of-scope/` — three real files, each citing the GitHub issue it rejects.

One markdown file per rejected **concept**, not per issue, with a `## Prior requests` list of everything that asked. Matched by concept similarity, not keyword ("night theme" matches `dark-mode.md`). One rule that is easy to get wrong and they got right: **only rejected enhancements go here** — never bugs, never "already implemented", because that would poison the dedup with false rejections.

**Why it fits.** `/sage-plan` step 6 already requires stating what is explicitly *not* in this sprint, one line each. Today that line dies with the sprint spec. A `.sage/out-of-scope/` registry makes it durable and searchable, and it is the only artifact in either source that records **rejections** — a category sage-mode's notebook does not capture at all. A rejection with a reason and a citation is evidence, which is the house thesis.

**Implementation.** New `kind: out-of-scope` in the notebook, indexed by `sage recall`. `/sage-plan` reads the registry before proposing candidates and writes to it when a candidate is cut. `/sage-shape` reads it during grounding.

---

### A-8 · Liveness doctrine for the unbuilt coordination hooks  *(Medium — feeds ship-plan WP-9)*

**Source:** `pstack/skills/poteto-mode/playbooks/orchestrate.md`, "Liveness and failure" + "Queue and drain"

The rules, each of which reads like something learned the hard way:

- **Count only side effects as progress** — commits, pushes, PR or check deltas. A lane that passes its expected runtime with no side effect is stuck; stand it down and dispatch a replacement rather than waiting for a polite return.
- **Never resume an agent to check on it** — a resume restarts an idle one. Probe read-only.
- **Transcript mtime is not liveness.**
- **Completions are queue events, not interrupts.**
- **Externalize immediately** — work that exists only on one VM when that VM dies was never done.
- **Bound your own retries** — after a few consecutive tool aborts, write a terminal handoff to durable state; hours of retry loops against a dead executor produce nothing a handoff would not.

**Why it fits.** Ship-plan WP-9 records that §10's two coordination hooks (`subagentStop` auto-chaining, `postToolUse` ledger injection) were never built and calls it the largest design-to-code gap in the repo. **This is the design doc for them, written by someone who already ate the failures.**

**Take the doctrine, not the program.** `orchestrate.md`'s own text records a losing head-to-head: *"measured head-to-head, this playbook's ceremony turned a half-hour 12-unit job into 1 landed unit while a plain agent landed all 12."* Admirably honest, and a clear warning. sage-mode's sprint *is* its coordination unit; grafting a second heavier layer with a competing store on top would duplicate the ledger.

---

### A-9 · An eval harness for skill text  *(Large — build last, or never)*

Neither repo has this. Matt has the rubric and no checker; pstack ships an `eval.md` playbook with genuinely good blinding discipline (no `eval`/`candidate`/`judge` in any path the candidate sees; chain-following graded from which files the transcript shows were *opened*, not from self-report) — **and then ships no evals at all.** No `evals/` directory, no recorded results, no baseline. The measurement apparatus exists and was never pointed at the product.

sage-mode has `evals/tier2/queries.json` (retrieval accuracy) and `evals/tier3/run.js` (process adherence, now wired to CI). Extending to tier 4 — does a skill's text actually change model behavior versus its absence — is the natural end state and the thing that would make skill quality measurable rather than argued.

**Scope it honestly: this is a project, not a task, and it is worth nothing until the skills it would grade are actually in daily use.** Listed here for completeness, sequenced last on purpose.

---

## 4. What to reject, and why

| Rejected | Source | Why |
|---|---|---|
| **The 21 `principle-*` read-in-full protocol** | pstack | Requires reading an index of 21 plus every applicable leaf, per task, forever. In direct tension with pstack's own `principle-guard-the-context-window`. You solved this better already: a retrievable catalog + BM25. **Retrieval beats mandatory preamble — do not regress.** |
| **`ask-matt`, the prose router** | skills | 90 hand-maintained lines that go stale the moment a skill changes; their own `CLAUDE.md` names the failure "a router that lies." Your BM25 index cannot go stale. Take the *content* (flow map, phase-boundary tree) as retrievable documents; not the pattern. |
| **The `(PR, SHA)` verdict key** | pstack | Strictly weaker than your wtree fingerprint, and pstack itself patches around it with `git patch-id` in two playbooks. Adopting it is a downgrade. |
| **Cost-blind panel fan-out** | pstack | `interrogate`, `arena`, `architect`, and `how`-critique each default to four concurrent max-tier reasoning models. pstack never mentions cost once. Under Lane C that is a 4× metered bill per review. Take `interrogate`'s **lead-judgment bucketing** (Act on / Consider / Noted / **Dismissed**, with dismissals shown so the user can override) and keep your single-metered-reviewer lane. |
| **`orchestrate.md` wholesale** | pstack | Published losing benchmark; would duplicate your ledger with a competing store. Doctrine only (A-8). |
| **`unslop` as an always-applied skill** | pstack | 31 style patterns, always live. You already spend an always-applied budget on a 161-line conduct rule; a second always-on skill spends it on prose policing. (pstack also violates it: `unslop` bans em dashes while three of its own skill descriptions ship them.) |
| **`check-plan.mjs` as a file** | pstack | Hardcodes the literal string ``"Ten lanes on `grok-4.6-fast-xhigh`"`` and asserts exactly lanes 1–10 — so a user who remaps models via `setup-pstack` fails their own linter. Steal the *idea* (make a prose artifact's shape machine-checkable), write your own against the ledger. |
| **`misc/` as a bucket** | skills | A graveyard with no exit criteria; two of its four skills hardcode the author's private CLI. `in-progress/` and `deprecated/` are the good half of that taxonomy. |
| **Composability as a stated value** | skills | Their README positions against systems that "own the process" — a framing the repo's own main flow, hard-dependency ADR, and mandatory setup step contradict. The real difference is enforcement, not process. **The moment a step is optional prose, the model skips it under load.** Your fail-closed hooks are the stronger design; do not trade them for a marketing position. |
| **benny's Slack pipeline** | pstack | A bug-intake product, not a workflow primitive, and it depends on Cursor Automations plus three integrations. Steal only its **capability fence**: children never receive credentials for the channel the parent posts to, and *"if a child needs Slack write access to run, do not launch it."* That is a good rule for your egress ledger. |

---

## 5. Implementation plan

### Sequencing against the ship plan

Nothing here starts before ship-plan **WP-1 and WP-2**. `sage-lane` currently cannot deny on macOS — a fail-closed security boundary that allows everything — and the golden harness reports `ok` for hooks that never ran. Adding surface on top of a broken enforcement layer means every new command inherits the defect.

After that, the ordering below deliberately **inverts one item in the ship plan**: see §6.

---

### Phase I — Foundations *(≈1.5 days, after ship-plan WP-1/WP-2)*

| # | Item | Lands in | Effort |
|---|---|---|---|
| I-1 | **A-2 evidence ladder** — `rung` on the finding schema, gate rewritten to demote unprovable rungs | `schemas/finding.schema.json`, `lib/review/index.ts` | 4h |
| I-2 | **A-3 verdict grade** — `grade` on `EvidenceRecord`, minimum grade per profile check | `lib/evidence/index.ts`, `profiles/*.json` | 3h |
| I-3 | **A-6 verbatim step copy** — one conduct paragraph + ledger row for every `skip:` | `rules/sage-conduct.mdc`, `lib/board/index.ts` | 2h |
| I-4 | **A-7 out-of-scope registry** — new notebook kind, indexed by recall, read/written by `/sage-plan` | `lib/recall`, `skills/sage-plan` | 3h |

These are all small, all internal, and all sharpen mechanics that already exist. I-1 and I-2 together turn "we have evidence" into "we have graded, laddered evidence" — which is the strongest version of the house thesis and something no other plugin in the reference set has.

---

### Phase II — The second spine *(≈2 days)*

The whole point. Build the four task commands, sharing everything and gating nothing.

| # | Item | Notes |
|---|---|---|
| II-1 | `/sage-crit` | **Build first.** It is `lib/review` with the sprint requirement removed — the cheapest command to build and the easiest to prove. |
| II-2 | `/sage-fix` | Reproduce → root-cause → minimal fix → evidence. Refuses "done" without a FRESH record at rung ≥ 4. Port the discipline from `skills/engineering/diagnosing-bugs` and `pstack/playbooks/bug-fix.md`. |
| II-3 | `/sage-debug` | The Phase-1 gate is the whole idea: *no red-capable command already run once, no theorizing.* Philosophically identical to your evidence layer; make it mechanical. |
| II-4 | `/sage-look` | Read-only. `lib/recall` + Explore. Cheapest possible entry point — this is the one that gets used on a Tuesday. |

**Hard constraints for all four:**

- No roadmap gate, no sprint creation, no DAG.
- All four write findings and evidence into the same `.sage/` structures, so `/sage-retro` still sees them.
- All four obey `rules/sage-conduct.mdc` unchanged.
- Lane assignment unchanged: production on Lane A, review on Lane C, interrogation on Lane B.
- Each ships with a tier-3 eval scenario, per the harness now wired to CI.

**Then use them.** See §6.

---

### Phase III — Quality machinery *(≈1.5 days)*

| # | Item | Lands in |
|---|---|---|
| III-1 | **A-4 lint rules** — `negation`, `environment-cache`, `disclosure`, `leading-word` | `lib/lint/index.ts` |
| III-2 | **A-5 lifecycle** — `catalog/in-progress/` tier, excluded from BM25; graduation gated by lint on retrieval-eval + index entry; deprecation-as-redirect | `skills/catalog/`, `lib/lint`, `lib/recall` |
| III-3 | Audit all 38 existing skills against the `writing-for-agents` pruning suite; demote failures to `in-progress/` | `skills/**` |

III-3 is where the theory pays for itself. Run the new lint across the catalog and expect casualties — the 25 catalog skills were written in one pass and are uniform at ~40 lines, which is itself a smell the `templated-duplicate` rule was added to catch once already.

---

### Phase IV — Coordination *(≈1 day, merges with ship-plan WP-9)*

| # | Item |
|---|---|
| IV-1 | Write **A-8's liveness doctrine** into `skills/sage-build/references/` as the spec for the two hooks |
| IV-2 | Build `subagentStop → followup_message` and `postToolUse → additional_context` against that spec |
| IV-3 | Adopt `interrogate`'s **lead-judgment bucketing** — Act on / Consider / Noted / Dismissed, dismissals shown with rationale — into `sage-review`, on the existing single Lane C reviewer |

---

### Phase V — Deferred

**A-9, the skill-text eval harness.** Do not start this until the task spine has been in daily use for a month and you know which skills actually fire and which are dead weight. Building a grader for skills nobody has run is measuring the wrong thing precisely.

---

## 6. The sequencing argument — and the honest note

### Invert WP-15

The ship plan's WP-15 is "run one real sprint," estimated at a day, and it is described there as the only package that answers whether any of this is worth using. That is still true. But this audit changes the cheapest way to get that answer.

**Prove the task spine first.** A `/sage-crit` run against a real diff is fifteen minutes. A `/sage-fix` on a real bug is an hour. A sprint is a day, and it exercises the DAG, the worktrees, the joins, and the ship gate all at once — so when it goes wrong, you learn that *something* was wrong.

Phase II gives you four cheap, independent probes of the same underlying machinery — evidence, review, conduct, lanes — each of which fails in one identifiable place. Run those, fix what they surface, *then* run the sprint. The sprint gets a much better chance of succeeding, and you find out inside a week rather than at the end of one.

Concretely: **Phase I → Phase II → use the four commands on real work for a week → then ship-plan WP-15 → then Phase III/IV.**

### The thing worth saying plainly

You have a repo with a live fail-open security bug, two unanswered platform spikes, a plugin that doesn't load on one of its two declared hosts, and zero sprints run. You have just added two more plugins to study, and this document is now the fifth design artifact in a repo whose documentation already outweighs its runtime.

That is the pattern where interesting tool-building displaces the work the tool was supposed to accelerate. The audit was worth doing — the everyday-surface finding is real and it explains why the tool is unused — but the correct output of it is **four small commands you actually use next week**, not another design phase.

If only one thing from this document gets built, build `/sage-crit`. It is a day of work, it reuses machinery you already have and already tested, and it is the first thing in this project that would have earned its keep on an ordinary Tuesday.
