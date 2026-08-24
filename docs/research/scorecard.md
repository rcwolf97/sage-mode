# Scorecard: sage-mode vs. the five

**Date:** 2026-08-21 · Scores are judgements, not measurements. The method and every caveat are below.

> **In plain terms:** Twelve dimensions, six systems, one to ten. Five of these systems are real software people use every day. The sixth is a document I wrote this week. That asymmetry is the most important thing on this page, so maturity is scored separately and never folded into the total — and the honest reading of the result is at the bottom, under "where sage-mode loses."

---

## 1. How to read this

Three rules I held myself to:

1. **sage-mode is scored as designed, not as built.** Every other score reflects code you can run today. sage-mode's reflects intent. A design document always outscores shipped software, because a design document has never met a user.
2. **Maturity is a separate row.** It is not averaged in, because averaging it in would let a 9 on "cost control" cancel a 1 on "does it exist." sage-mode scores **1**. superpowers scores **9**.
3. **The weights are mine and they're arguable.** Context economy and cost control are weighted 1.1 because they decide whether a system is usable daily. Time-to-first-value is weighted 0.8 because a tool you use for a year can afford a slow start. Reweight and the ranking moves — that's the point of showing them.

Scores draw on the [five teardowns](./overview.html), the [gstack implementation deep-dive](./gstack-coding-mechanics.html), and measurement where measurement was possible (line counts, file counts, `find` output).

---

## 2. The rubric

| Dimension | A 10 looks like | A 3 looks like |
|---|---|---|
| **Intake & planning** | Interrogates you one question at a time until the problem is genuinely pinned, and challenges the premise | Takes your prompt at face value and starts planning |
| **Implementation orchestration** | File-based briefs, compaction-proof ledger, worktrees, joins, bounded fix loops | One agent, one long turn, hope |
| **Review rigour** | Independent context, scoped specialists, structured findings, false positives mechanically suppressed | "Looks good to me" from the model that wrote it |
| **Runtime verification** | Real browser, real suite, evidence bound to content so it can't go stale | The agent says the tests passed |
| **Mechanical enforcement** | Hooks that deny the tool call, fail-closed | Instructions in a prompt |
| **Memory / compounding** | Learnings written, indexed, deduped, and actually read by later work | Nothing survives the session |
| **Context economy** | Retrieval, skeleton skills, nothing loaded speculatively | Everything in the prompt, every time |
| **Cost control** | Model tier pinned per role, wired and verifiable | Documented in prose, pinned nowhere |
| **Parallel throughput** | Many independent lanes, isolated, safely merged | Strictly serial |
| **Design / frontend depth** | Produces UI you'd ship, and can see what it built | No opinion, no eyes |
| **Lifecycle breadth** | Observability, migrations, security, ADRs, deprecation, release | Code and tests only |
| **Time to first value** | Install and go | Hours of setup and a private dependency |

---

## 3. The matrix

<div class="tw smx"><table>
<thead><tr><th class="dim">Dimension</th><th>agent-skills</th><th>compound-eng</th><th>gstack</th><th>superpowers</th><th>ui-ux-pro-max</th><th>sage-mode*</th></tr></thead><tbody>
<tr><td class="dim"><b>Intake &amp; planning quality</b><span class="note">Does it interrogate you properly before anything gets built?</span><span class="wt">weight 1.2</span></td><td class="sc"><span class="bw"><span class="b" style="width:70%"></span></span><span class="sv">7</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:90%"></span></span><span class="sv">9</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:30%"></span></span><span class="sv">3</span></td><td class="sc"><span class="bw"><span class="b design" style="width:90%"></span></span><span class="sv">9</span></td></tr>
<tr><td class="dim"><b>Implementation orchestration</b><span class="note">Dispatch, briefs, ledgers, worktrees — the machinery of many agents building.</span><span class="wt">weight 1.2</span></td><td class="sc"><span class="bw"><span class="b" style="width:60%"></span></span><span class="sv">6</span></td><td class="sc"><span class="bw"><span class="b" style="width:70%"></span></span><span class="sv">7</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:90%"></span></span><span class="sv">9</span></td><td class="sc"><span class="bw"><span class="b" style="width:60%"></span></span><span class="sv">6</span></td><td class="sc"><span class="bw"><span class="b design" style="width:90%"></span></span><span class="sv">9</span></td></tr>
<tr><td class="dim"><b>Review rigour</b><span class="note">Adversarial independence, finding schemas, false-positive suppression.</span><span class="wt">weight 1.2</span></td><td class="sc"><span class="bw"><span class="b" style="width:70%"></span></span><span class="sv">7</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:100%"></span></span><span class="sv">10</span></td><td class="sc"><span class="bw"><span class="b" style="width:70%"></span></span><span class="sv">7</span></td><td class="sc"><span class="bw"><span class="b" style="width:70%"></span></span><span class="sv">7</span></td><td class="sc"><span class="bw"><span class="b design" style="width:90%"></span></span><span class="sv">9</span></td></tr>
<tr><td class="dim"><b>Runtime verification</b><span class="note">Real evidence — browsers, suites, content-bound freshness — not self-report.</span><span class="wt">weight 1.0</span></td><td class="sc"><span class="bw"><span class="b" style="width:50%"></span></span><span class="sv">5</span></td><td class="sc"><span class="bw"><span class="b" style="width:50%"></span></span><span class="sv">5</span></td><td class="sc"><span class="bw"><span class="b" style="width:90%"></span></span><span class="sv">9</span></td><td class="sc"><span class="bw"><span class="b" style="width:40%"></span></span><span class="sv">4</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b design" style="width:90%"></span></span><span class="sv">9</span></td></tr>
<tr><td class="dim"><b>Mechanical enforcement</b><span class="note">Hooks that actually deny, versus instructions the model may ignore.</span><span class="wt">weight 1.0</span></td><td class="sc"><span class="bw"><span class="b" style="width:30%"></span></span><span class="sv">3</span></td><td class="sc"><span class="bw"><span class="b" style="width:20%"></span></span><span class="sv">2</span></td><td class="sc"><span class="bw"><span class="b" style="width:90%"></span></span><span class="sv">9</span></td><td class="sc"><span class="bw"><span class="b" style="width:40%"></span></span><span class="sv">4</span></td><td class="sc"><span class="bw"><span class="b" style="width:20%"></span></span><span class="sv">2</span></td><td class="sc"><span class="bw"><span class="b design" style="width:80%"></span></span><span class="sv">8</span></td></tr>
<tr><td class="dim"><b>Memory / compounding</b><span class="note">Does last month's work make this month cheaper?</span><span class="wt">weight 1.0</span></td><td class="sc"><span class="bw"><span class="b" style="width:10%"></span></span><span class="sv">1</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:70%"></span></span><span class="sv">7</span></td><td class="sc"><span class="bw"><span class="b" style="width:10%"></span></span><span class="sv">1</span></td><td class="sc"><span class="bw"><span class="b" style="width:50%"></span></span><span class="sv">5</span></td><td class="sc"><span class="bw"><span class="b design" style="width:90%"></span></span><span class="sv">9</span></td></tr>
<tr><td class="dim"><b>Context economy</b><span class="note">Tokens burned before any work happens.</span><span class="wt">weight 1.1</span></td><td class="sc"><span class="bw"><span class="b" style="width:50%"></span></span><span class="sv">5</span></td><td class="sc"><span class="bw"><span class="b" style="width:30%"></span></span><span class="sv">3</span></td><td class="sc"><span class="bw"><span class="b" style="width:20%"></span></span><span class="sv">2</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:100%"></span></span><span class="sv">10</span></td><td class="sc"><span class="bw"><span class="b design" style="width:90%"></span></span><span class="sv">9</span></td></tr>
<tr><td class="dim"><b>Cost control</b><span class="note">Model tiering that is actually wired, not documented.</span><span class="wt">weight 1.1</span></td><td class="sc"><span class="bw"><span class="b" style="width:30%"></span></span><span class="sv">3</span></td><td class="sc"><span class="bw"><span class="b" style="width:50%"></span></span><span class="sv">5</span></td><td class="sc"><span class="bw"><span class="b" style="width:20%"></span></span><span class="sv">2</span></td><td class="sc"><span class="bw"><span class="b" style="width:60%"></span></span><span class="sv">6</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b design" style="width:100%"></span></span><span class="sv">10</span></td></tr>
<tr><td class="dim"><b>Parallel throughput</b><span class="note">Independent work in flight at once.</span><span class="wt">weight 0.9</span></td><td class="sc"><span class="bw"><span class="b" style="width:50%"></span></span><span class="sv">5</span></td><td class="sc"><span class="bw"><span class="b" style="width:60%"></span></span><span class="sv">6</span></td><td class="sc"><span class="bw"><span class="b" style="width:70%"></span></span><span class="sv">7</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:40%"></span></span><span class="sv">4</span></td><td class="sc"><span class="bw"><span class="b design" style="width:90%"></span></span><span class="sv">9</span></td></tr>
<tr><td class="dim"><b>Design / frontend depth</b><span class="note">Can it produce UI you would ship?</span><span class="wt">weight 0.9</span></td><td class="sc"><span class="bw"><span class="b" style="width:50%"></span></span><span class="sv">5</span></td><td class="sc"><span class="bw"><span class="b" style="width:30%"></span></span><span class="sv">3</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:10%"></span></span><span class="sv">1</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b design" style="width:90%"></span></span><span class="sv">9</span></td></tr>
<tr><td class="dim"><b>Lifecycle breadth</b><span class="note">Observability, migrations, security, ADRs, deprecation, release.</span><span class="wt">weight 0.8</span></td><td class="sc"><span class="bw"><span class="b" style="width:90%"></span></span><span class="sv">9</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:100%"></span></span><span class="sv">10</span></td><td class="sc"><span class="bw"><span class="b" style="width:40%"></span></span><span class="sv">4</span></td><td class="sc"><span class="bw"><span class="b" style="width:30%"></span></span><span class="sv">3</span></td><td class="sc"><span class="bw"><span class="b design" style="width:80%"></span></span><span class="sv">8</span></td></tr>
<tr><td class="dim"><b>Time to first value</b><span class="note">Install to useful output.</span><span class="wt">weight 0.8</span></td><td class="sc"><span class="bw"><span class="b" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b" style="width:30%"></span></span><span class="sv">3</span></td><td class="sc"><span class="bw"><span class="b" style="width:20%"></span></span><span class="sv">2</span></td><td class="sc"><span class="bw"><span class="b" style="width:90%"></span></span><span class="sv">9</span></td><td class="sc"><span class="bw"><span class="b" style="width:70%"></span></span><span class="sv">7</span></td><td class="sc"><span class="bw"><span class="b design" style="width:40%"></span></span><span class="sv">4</span></td></tr>
</tbody><tfoot>
<tr class="tot"><td class="dim"><b>Weighted capability</b><span class="note">% of the maximum score across the twelve dimensions</span></td><td class="sc"><span class="bw"><span class="b" style="width:53%"></span></span><span class="sv">53%</span></td><td class="sc"><span class="bw"><span class="b" style="width:56%"></span></span><span class="sv">56%</span></td><td class="sc"><span class="bw"><span class="b" style="width:70%"></span></span><span class="sv">70%</span></td><td class="sc"><span class="bw"><span class="b" style="width:59%"></span></span><span class="sv">59%</span></td><td class="sc"><span class="bw"><span class="b" style="width:60%"></span></span><span class="sv">60%</span></td><td class="sc"><span class="bw"><span class="b design" style="width:86%"></span></span><span class="sv">86%</span></td></tr>
<tr class="mat"><td class="dim"><b>Maturity — proven in use</b><span class="note">Scored separately and never averaged in. sage-mode is a document.</span></td><td class="sc"><span class="bw"><span class="b mat" style="width:70%"></span></span><span class="sv">7</span></td><td class="sc"><span class="bw"><span class="b mat" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b mat" style="width:80%"></span></span><span class="sv">8</span></td><td class="sc"><span class="bw"><span class="b mat" style="width:90%"></span></span><span class="sv">9</span></td><td class="sc"><span class="bw"><span class="b mat" style="width:60%"></span></span><span class="sv">6</span></td><td class="sc"><span class="bw"><span class="b mat" style="width:10%"></span></span><span class="sv">1</span></td></tr>
</tfoot></table></div>

<p class="cap">Bars encode the score out of ten; length, not colour, carries the value. The darker bar marks sage-mode for reference, and the grey bar in the last row marks maturity — both are emphasis, not a separate quantity. The numbers are the table view.</p>

---

## 4. Where each one genuinely wins

> **In plain terms:** Every one of these is best in the world at something. Here is what each would be irresponsible to ignore.

**gstack — 70%, the highest of anything that actually exists.** It wins review, enforcement, runtime verification, and breadth, and it isn't close. The pre-emit verification gate (quote the motivating line or your confidence caps at 4-5), the content-addressed working-tree fingerprint that keeps "tests passed" valid across a rebase but not across a real edit, tiered hook polarity where ask-tier fails open and deny-tier fails closed — nothing else in the set has any of it. What drags it down is measurable: 62% of its entire skill corpus is duplicated preamble, and its subagents pin no model at all.

**superpowers — best implementation orchestration and best time-to-value.** Fourteen skills, zero dependencies, one hook. `subagent-driven-development` is the most carefully thought-out multi-agent build loop in the set: fresh implementer per task, two-stage review, five-round fix loop with model escalation, and a ledger that survives compaction because the maintainers watched controllers re-dispatch entire completed task sequences. It also has the best textual enforcement in existence — rationalization tables built from observed pressure-test failures — while being honest that textual enforcement is a losing arms race.

**ui-ux-pro-max — best context economy in the set, by a distance.** Twenty-two CSVs, a from-scratch BM25 engine, and a subprocess that returns three to ten rows. Its knowledge grows without its context cost growing. Everyone else's prompt library gets heavier as it gets smarter; this one doesn't. That architecture, applied to something other than design data, is the single most transferable idea across all five.

**Compound Engineering — best memory.** `ce-compound` writes one learning per cycle and every later planning skill is instructed to read the folder. The retrieval is weak and the folder rots, but it's the only system in the set where last month's work is supposed to make this month cheaper — and the epistemics are the sharpest of the five: *"Two personas reasoned inside one context are two perspectives, not two witnesses."*

**agent-skills — best curriculum.** Twenty-four skills including the unglamorous ones nobody else bothers with: observability and instrumentation, deprecation and migration, ADRs, CI/CD, API contract design. If you want a checklist of what a senior engineer is supposed to think about, this is the most complete one here, and it installs in a minute.

---

## 5. Where sage-mode is actually differentiated

> **In plain terms:** Most of sage-mode is assembly — taking the best mechanism from each and putting it in one place. That's worth doing but it isn't novel. Three things are genuinely new.

**Cost architecture (10, and the next best is 8).** Nobody else routes work across an included lane, a flat-rate subscription lane, and a metered lane on the principle that metered tokens buy judgment and never production. gstack scores 2 here — a single `/review` was measured at 15M tokens. agent-skills documents Haiku/Sonnet/Opus tiering in prose and pins `model:` in none of its four persona files. Cursor has shipped per-subagent model selection with effort and context parameters, and not one of the five uses it.

**The notebook as both the human artifact and the retrieval layer.** Compound Engineering writes learnings for machines; nobody writes them for you. A `docs/` site you browse *is* the corpus the agents search. That's one mechanism serving two jobs, and it's the reason the memory score is a 9 rather than an 8.

**Assembly across the seams.** Individually these are borrowed. Together they interlock in ways none of the sources managed: gstack's content-addressed evidence ledger feeding superpowers' compaction-proof build ledger; ui-ux-pro-max's retrieval architecture applied to the skill catalog so lifecycle breadth costs nothing until used; Compound Engineering's cross-vendor independence requirement satisfied by a Cursor frontmatter field rather than an external CLI.

---

## 6. Where sage-mode loses

> **In plain terms:** The parts of this page that should worry you.

**Maturity: 1.** Zero lines of code. superpowers has a documented 94% PR rejection rate and runs evals on its own skill text. gstack has telemetry from real daily use. Every sage-mode score is a claim about software that does not exist, and the history of this kind of document is that the assembly is harder than the parts.

**Time to first value: 4** — third from last, ahead only of gstack and Compound Engineering. Eight commands, an org chart, three cost lanes, a notebook renderer, an evidence ledger, and four hooks is a lot of surface before the first useful output. superpowers gets to value in one hook and fourteen files. If sage-mode is not usable at the end of phase 1, the design is wrong.

**Mechanical enforcement: 8, not gstack's 9** — and that gap is a platform limit, not a design choice. Cursor's `stop` hook cannot block; documented, plainly: *"Can block: No."* The verification gate is a nag loop capped at five iterations rather than a wall. Cursor's `beforeReadFile` cannot rewrite content, so the trick of making code invisible to the model doesn't port either.

**Two scores rest on unverified assumptions.** Cost control (10) assumes plugin-shipped subagents honor their `model` frontmatter — documented for `.cursor/agents/`, never stated for plugins. Parallel throughput (9) assumes `preToolUse`'s `tool_input` carries `file_path` for Write, which Cursor's docs never show. **If the second assumption is wrong, lane enforcement isn't buildable and parallel throughput drops to about a 5.** Both are an hour of testing.

**And the design score is a promise.** A 9 on design depth is contingent on the [design org](../design/design-org.html) working — which is a harder problem than any of the engineering ones here, because it's a taste problem wearing a systems costume.

---

## 7. What would falsify this

Three cheap experiments, in order of how much they'd change the picture:

1. **Build phase 1 and time it.** If the interrogation-to-roadmap loop isn't useful in an afternoon, time-to-value is worse than 4 and the phasing is wrong.
2. **A/B the cheap reviewer.** Same diff, `gemini-3.7-flash` versus a frontier model, count confirmed findings. If Flash finds materially fewer real bugs, the cost architecture's headline number is fiction and Lane C has to move upmarket.
3. **Run one real sprint with four parallel lanes.** Cursor's own research names split-brain duplication, planner contention, merge conflicts, megafiles, and ossification. The `owns`-glob constraint is supposed to prevent the first three at planning time. Either it does or it doesn't, and one sprint answers it.
