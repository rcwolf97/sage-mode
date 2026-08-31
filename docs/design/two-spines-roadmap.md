# The Two-Spines Roadmap — consolidating everything into one ship-ready plan

**Prepared:** 2026-08-31 · **Supersedes:** nothing — this merges [ship-plan](./ship-plan.html) (WP-1–15, sage-mode's own defects) and [adoption-pstack-skills](./adoption-pstack-skills.html) (A-1–9, pstack/skills adoption) into one sequence, and adds what's adoptable from the four repos studied first (gstack, superpowers, compound-engineering-plugin) plus two studied since but never mined for adoption (agent-skills, ui-ux-pro-max-skill).
**Organizing principle:** the user's own framing — *"we have two spines: sprint week AND daily usage (skills that can run no matter the sprint)."*
**Method:** every claim below that isn't already sourced in ship-plan.md or adoption-pstack-skills.md was re-verified against the actual files on disk today (2026-08-31), not taken on the earlier documents' word. Three of them turned out to be **already fixed** since the last review pass — see §0 before reading anything else.

---

## 0. What's changed since the last audit round — read this first

The competitive-analysis (2026-08-25) and adoption-pstack-skills (earlier today) documents both fed this plan, but the codebase has moved since the earlier one was written. Re-checking every candidate item against current source before proposing it as new work turned up three that are **already done**:

| Finding (2026-08-25) | Status today (verified) |
|---|---|
| `sage-careful` MEDIUM tier matched `rm -r` and SQL keywords with literal case-substring patterns — `rm -fr`, `--force --recursive`, and lowercase `drop table` all sailed through as silent allow | **Fixed.** `hooks/sage-careful:188-203` now reuses a token-aware `MED_HAS_RM`/`HAS_R` scan (catches any flag order) and uppercases a copy of `$CMD` before matching SQL keywords, with comments explicitly naming the old bug they replace. Fixtures `ask-lowercase-drop-table` and `ask-rm-fr-flag-order` now exist under `hooks/tests/sage-careful/` and pass. |
| 0 of 19 `agents/*.md` files carried a "Common Rationalizations" table (vs. 44/44 `skills/*/SKILL.md`) — the layer under the most execution pressure was the one left unhardened | **Fixed.** `grep -rl "Common Rationalizations" agents/*.md` now returns all 19 files, with real table content (verified on `implementer-backend.md`), not just a header. |
| No scope-discipline escape valve — an agent either silently fixes an unrelated issue or silently ignores it | **Already present.** `rules/sage-conduct.mdc:60-62` carries agent-skills' `NOTICED BUT NOT TOUCHING: <path> <what> (unrelated) → Want me to create a task?` pattern verbatim, applying to every command that inherits the conduct rule. |
| Cross-model "independent review" had zero verifying code — `lib/consult/index.ts` only ever spawned `claude`, with nothing checking which model actually ran | **Half-fixed.** `lib/consult/index.ts:58` now has `extractModelReceipt()`, parsing `claude -p --output-format json`'s `modelUsage` field and marking the call `verified: true` with named models or `verified: false` — never assumed — when the field is absent (recorded at line 277-278, egress-logged). This is compound-engineering-plugin's receipt pattern (Part 1 of the competitive analysis), independently arrived at. **This closes Lane B.** Lane A/C — whether Cursor's host honors `agents/*.md`'s `model:` frontmatter at all — is untouched and still rests entirely on SPIKE-02 (ship-plan WP-5). Don't let the Lane B fix read as the whole problem solved; §4 below is explicit about what's left. |

Two more candidates I checked and did **not** find fixed, so they stay in this plan: `design-critique` already runs a genuine 5-viewport browser-evidence loop with capture/judgment split (`skills/design-critique/SKILL.md:9-21` — `qa-driver` captures, the Critic judges, "the capturer marking its own work would be one witness reviewing itself") that matches or exceeds ui-ux-pro-max-skill's `design-review` subagent, so **there is nothing to adopt there** — noted in §8 as a deliberate non-adoption, not an oversight. And `sage-retro` still has no external-research grounding equivalent to `ce-compound`'s six specialist subagents (`grep -n "researcher\|specialist" skills/sage-retro/SKILL.md` finds only `specialist-stats.json`, a self-referential metric, not a research pass) — that one is real and is in §4.

---

## 1. The two spines, defined

| | **Spine A — sprint week** | **Spine B — daily usage** |
|---|---|---|
| Entry point | `/sage-shape → ... → /sage-retro`, 8 commands | `/sage-crit`, `/sage-fix`, `/sage-debug`, `/sage-look` |
| Unit of work | A week-shaped sprint with a DAG, worktrees, joins | One diff, one bug, one question |
| Gate before starting | `/sage-plan` refuses without an approved roadmap | None |
| Ledger / evidence | `.sage/sprints/NN/ledger.md`, full DAG state | Same `.sage/` structures, no sprint number required |
| Cost lanes | A/B/C exactly as designed | A/B/C exactly as designed — unchanged |
| Conduct rule | `rules/sage-conduct.mdc` | Same file, same rule — including the `NOTICED BUT NOT TOUCHING` line above |
| Status today | Built, unproven — zero sprints ever run (ship-plan WP-15) | Does not exist |

This is not two products. Spine B is new *entry points* into machinery Spine A already built and tested — `lib/evidence`, `lib/review`, `lib/redact`, `lib/egress`, the conduct rule, the cost lanes — with the roadmap gate and DAG removed. Nothing in Spine B duplicates a lib module; adoption-pstack-skills' A-1 said this and it's worth restating because it's the one architectural decision the rest of this document assumes: **do not build a router between the spines.** Four explicit verbs, same as pstack's own postmortem on its sticky `/poteto-mode` router argues for (adoption doc, rejection table).

The reason this matters for shipping, not just architecture: sage-mode's own scorecard (`docs/research/scorecard.md` §6) scores **time-to-first-value at 4/10** — third-worst of six systems compared, ahead only of gstack and compound-engineering-plugin, both of which require external infrastructure sage-mode doesn't. *"Eight commands, an org chart, three cost lanes, a notebook renderer, an evidence ledger, and four hooks is a lot of surface before the first useful output... If sage-mode is not usable at the end of phase 1, the design is wrong."* Spine B is the fix for that specific, self-diagnosed, still-unresolved score.

---

## 2. Definition of done — updated for two spines

Ship-plan's six conditions still stand (`npm run verify` green on macOS; hooks harness can't lie; both spikes decided; Claude Code loads or is dropped; one real sprint run). Add a seventh, since this document adds Spine B as a real deliverable, not a stretch goal:

**7. All four Spine B commands have run at least once against real work, and at least one produced a finding or fix that mattered.** Not a synthetic fixture — a real diff, a real bug, a real question about the actual codebase. This is cheaper than condition 6 (a full sprint) and should happen *before* it — see §9.

---

## 3. Foundation — unchanged, still blocks everything

Ship-plan WP-1 (`sage-lane` fail-open on macOS), WP-2 (golden harness reports `ok` for a hook that never ran), WP-3 (`npm test` makes live billable calls) are correctness bugs, not adoption items, and nothing in this document changes their priority or their fix. Full detail is in ship-plan.md; summarized:

| WP | Problem | Est. |
|---|---|---|
| WP-14 | Working-tree hygiene (probe artifacts, absolute paths) — do first, 15m | 15m |
| WP-2 | `hooks/tests/run.sh:70` normalizes empty stdout to `{}`, identical to the allow fixture — a crashed hook reads as a pass | 2h |
| WP-1 | `sage-lane`/`sage-proof`/`sage-solo` nest a heredoc inside `$( )`, which bash 3.2 (macOS `/bin/sh`) cannot parse — a `failClosed: true` deny-tier hook silently allows everything when this trips | 4-6h |
| WP-3 | `test/consult.test.ts` dispatches live, billable `claude -p` calls in the default `npm test` run | 1h |

**Do WP-2 before WP-1** (you need a test that can see the bug before you can prove the fix). Nothing in Spine B or the quality-machinery work below should start until these three are green — building a second command surface on a hook layer that can silently fail open just doubles the blast radius.

---

## 4. Spine A — closing the gap to ship-ready

This is ship-plan's WP-4 through WP-13, restated by spine relevance, plus what's newly adoptable from gstack and compound-engineering-plugin now that both have been mined specifically for this.

### 4.1 The two platform spikes (WP-4, WP-5) — unchanged
SPIKE-01 (does `preToolUse` expose a file path?) and SPIKE-02 (does Cursor honor plugin-shipped `model:` frontmatter?) remain exactly as scoped in ship-plan. Nothing here changes them. They gate 4.2 and 4.3 below.

### 4.2 Claude Code loading (WP-6, WP-7, WP-8) — new prior art for the model-mapping decision

Ship-plan WP-7 lays out three options for reconciling `agents/*.md`'s Cursor-native `model: grok-4.6` / `gemini-3.7-flash` values with Claude Code's `sonnet|opus|haiku|fable|inherit` vocabulary, and recommends (b) — single card, host-resolved at install — with (a) — host-gated duplicate cards — rejected mainly because it "introduces a duplication/staleness problem."

**gstack already solved exactly this**, and it's worth taking the shape of the solution rather than re-deriving it. `gstack/hosts/define-host.ts` is a `defineHost()` factory: every host config (`claude.ts`, `codex.ts`, `cursor.ts`, `kiro.ts`, `opencode.ts`, six more) supplies only the fields it overrides; everything else — paths, allowlist frontmatter, path-rewrite rules, tool-name rewrites (`hosts/define-host.ts:44-60`, e.g. `'use the Bash tool' → 'use the exec tool'` for OpenClaw-style runtimes) — comes from shared defaults constructed fresh per call, so "no two host configs ever share a mutable array/object" (file header comment). It even names a `CROSS_MODEL_RESOLVERS` list (`define-host.ts:22-29`) that's suppressed per-host for exactly sage-mode's Lane C problem: hosts that can't or shouldn't invoke a second model get those resolvers turned off centrally, not by editing N files.

**Recommendation: keep ship-plan's option (b) as the default (host-resolved model mapping at `sage setup` time — less new surface, and WP-8 already needs to write host-specific install targets), but structure the mapping table itself as a `defineHost()`-style single object with per-host overrides**, not a flat lookup. That gets you (a)'s clarity — you can read one file and see exactly what Claude Code gets — without (a)'s duplication cost, because the object *is* the single source of truth `lib/setup` and `lib/manifest` read from. Concretely: a `lib/setup/hosts.ts` exporting one `HOST_MODEL_MAP` object (`{ cursor: { grok-4.6: 'grok-4.6', ... }, claude: { 'grok-4.6': 'opus', 'grok-4.5': 'sonnet', 'gemini-3.7-flash': 'haiku' } }`), consumed by both `sage setup`'s install step and the new lint rule ship-plan WP-7 already calls for ("a card's `model:` must be valid for at least one declared host, and the host mapping must be total").

### 4.3 Cost-lane verification — Lane B is done, Lane A/C is the open half

As §0 established, `extractModelReceipt()` already gives Lane B (the `claude -p` consult path) exactly compound-engineering-plugin's verified-receipt guarantee — a real dispatch is confirmed by parsing the response envelope, not assumed from the request. **Do not re-propose building this; it exists.**

What's still open, and what SPIKE-02 (WP-5) exists to answer: whether Cursor's host reports back which model actually served a plugin-shipped `agents/*.md` dispatch at all. If it does — even as a usage/cost line rather than a structured field — extend the same pattern: a second, Cursor-specific receipt extractor reading whatever shape that line takes, wired into `lib/board` (which already displays, but per the earlier competitive-analysis, never verifies, the `model` field on a node — `lib/board/index.ts:119,132`). If SPIKE-02 comes back FAIL — no such signal exists — then Lane A/C's cost-tiering claim has no verification path *by construction*, not by omission, and the scorecard's own math already says what that's worth: cost control drops from 10 to "about a 6" (`docs/research/scorecard.md` §6). Record whichever outcome and move on; this is not a WP that can be worked around, only resolved by the spike.

### 4.4 `sage-retro`'s learning capture — optional, not blocking

`ce-compound` dispatches six specialist research subagents (best-practices-researcher, framework-docs-researcher, pattern-recognition-specialist, security-sentinel, performance-oracle, data-integrity-guardian — `compound-engineering-plugin/skills/ce-compound/references/agents/*.md`) before writing a learning, plus `validate-doc-claims.py`/`validate-frontmatter.py` to catch a learning that cites something that isn't true. `sage-retro/SKILL.md` step 3 drafts a learning directly from what the orchestrator itself observed in the sprint just finished, with no independent research pass — confirmed still true today (§0).

This is real, but scope it honestly: it's an enhancement to learning *quality*, and sage-mode's retro discipline already has something ce-compound doesn't — a transcript-grounding requirement (`sage-retro/SKILL.md:132-136`, rationalization-table entries must trace to an actual transcript) and dedup/bounded-staleness resampling the earlier competitive-analysis called out as a genuine strength. Don't build a six-specialist fan-out for a tool that has run zero sprints. If WP-15's real sprint surfaces retro entries that are wrong or ungrounded, revisit this then, with an actual failure to design against instead of a hypothetical one.

### 4.5 Everything else in ship-plan (WP-9 through WP-13) — unchanged, cross-referenced below
WP-9 (unbuilt coordination hooks) is addressed in §7. WP-10 (cross-session dedup, prose-only), WP-11 (Lane B consult tool allowance narrower than spec), WP-12 (doc drift), WP-13 (`docs/build.py` unrunnable) carry over exactly as ship-plan states them.

### 4.6 WP-15 — the real sprint, still required, now sequenced after Spine B (see §9)

---

## 5. Spine B — the daily-usage commands

This section condenses adoption-pstack-skills' A-1 through A-3, A-6, A-7 (full detail there) and adds one new item this mining pass found still genuinely open.

### 5.1 The four commands

| Command | Does | Reuses |
|---|---|---|
| `/sage-look` | Read-only: how does X work, why was it built this way | `lib/recall`, Explore — **build first**, cheapest entry point, the one used on a Tuesday |
| `/sage-crit` | Review an arbitrary diff/branch/PR, no sprint | `lib/review` entire — **build second**, it's `lib/review` with the sprint requirement removed |
| `/sage-fix` | One defect: reproduce → root-cause → minimal fix → evidence | `lib/evidence`, `lib/review`, conduct rule |
| `/sage-debug` | Diagnosis loop; refuses to theorize before a red-capable command exists | `lib/evidence` |

None read the roadmap, none create a sprint, none touch the DAG. All four write findings/evidence into the same `.sage/` structures so `/sage-retro` still sees them, and all four ship with a tier-3 eval scenario per the harness now wired to CI.

### 5.2 Supporting mechanics (from pstack)

- **A-2, the evidence ladder** — `rung: 1..5` on the finding schema (pstack's `blast-radius/SKILL.md:23-29`: stated → cited → walked → run → reproduced-live); a rung-4+ claim must carry a command and its output or gets demoted. Makes the confidence gate checkable rather than confessional.
- **A-3, verdict grade on evidence records** — `type-check-only | unit-test-verified | live-ui-verified` etc. on `EvidenceRecord`, so a passing type-check and a passing live walkthrough stop looking identical. Take pstack's grading scale; do **not** take its `(PR, SHA)` verdict key — sage-mode's content-addressed wtree fingerprint is strictly better and pstack itself has to patch around its own key with manual `git patch-id` recompares in two playbooks.
- **A-6, verbatim step copy with visible `skip:`** — one conduct-rule paragraph plus a ledger row for every skipped step; a skip with no reason fails lint.
- **A-7, the out-of-scope registry** — `.sage/out-of-scope/` durable rejection log, one file per concept, read by `/sage-plan` and `/sage-shape`.

### 5.3 New for this pass: separate the claim from the evidence before review

agent-skills' `doubt-driven-development` skill has a specific anti-sycophancy mechanic: never hand a reviewer the author's own conclusion, only the artifact and the contract it's supposed to satisfy — *"if you hand over conclusions, you'll get back validation of your conclusions"* (`skills/doubt-driven-development/SKILL.md`). I checked whether sage-mode already does this: it doesn't. `lib/consult/index.ts` and `lib/review/index.ts` have no code that strips an implementer's summary/rationale before a Lane C dispatch — a `grep -n "conclusion|CLAIM|verdict"` across both files finds nothing that separates the two.

This is small and cheap, and it's most valuable exactly where Spine B puts review closest to the person who just wrote the code: `/sage-crit` and `/sage-fix`'s evidence-gathering step should pass the Critic/Reviewer the diff and the acceptance criteria, never the implementer's own "here's what I did and why it's right" narrative. Concretely: when `/sage-fix` builds its Lane C dispatch payload, drop any field carrying the implementer's stated conclusion (root-cause narrative, "this should fix it" framing) and keep only the diff, the reproduction, and the acceptance criteria. One field removed from a payload builder, not a new module.

---

## 6. Quality machinery — serves both spines

Condensed from adoption-pstack-skills' A-4 and A-5 (full detail there), plus two new items from agent-skills and superpowers that weren't mined before.

- **A-4, `writing-for-agents` as lint rules** — `negation`, `environment-cache`, `disclosure`, `leading-word` added to `lib/lint/index.ts`. The theory (two loads, progressive disclosure, the no-op test) has never had a rubric to check catalog skills against; sage-mode already has the linter shape, Matt's theory has never had one.
- **A-5, skill lifecycle** — `catalog/in-progress/` tier excluded from BM25, promotion gated by a passing tier-2 retrieval eval plus a catalog-index entry, deprecation-as-redirect (a retired skill is deleted, the removing changeset names its replacement — never a graveyard bucket).
- **New — TF-IDF trigger-collision testing for the skill catalog.** agent-skills' `evals/README.md` Tier 2 computes stemmed TF-IDF over every skill's description, asserts the correct skill ranks first ≥80% of the time, and separately flags any pair of skills whose descriptions are ≥50%/≥75% similar (a collision waiting to misroute a query). Checked: sage-mode's own `evals/tier2` has retrieval-accuracy testing (`test/evals.test.ts:10-24`) but nothing that checks skills *against each other* for collision — a `grep -n "collision|similar|pairwise"` across `evals/tier2/*` and `test/evals.test.ts` returns nothing. With 25 catalog skills "written in one pass" and "uniform at ~40 lines" (adoption-pstack-skills §Phase III, already flagging this as a smell), a pairwise-similarity check is a cheap, deterministic CI addition that would catch it mechanically instead of by manual audit.
- **New — superpowers' RED/GREEN/REFACTOR as the method for finishing the tier-3 eval harness.** Ship-plan and the earlier competitive-analysis both flag that `evals/tier3`'s process-adherence scenarios are mostly documented, not executed as tests. Neither document says *how* to write the missing ones well. superpowers' `writing-skills/testing-skills-with-subagents.md` describes the method directly: run the scenario with no skill loaded and real pressure, capture the subagent's exact rationalization verbatim (RED) — not an imagined one — write skill text that specifically counters that excuse (GREEN), then re-run under pressure and close whatever new loophole appears (REFACTOR). `systematic-debugging/CREATION-LOG.md` documents this having actually been done once, with the specific language changes it produced. Apply this method to each remaining tier-3 scenario as it's built out — it's the missing "how," not new machinery.

---

## 7. Coordination — the two unbuilt hooks

Ship-plan WP-9 documents that architecture-v3 §10's two coordination hooks (`subagentStop → followup_message`, `postToolUse → additional_context`) were never built, calling it "the largest design-to-code gap in the repo." Adoption-pstack-skills' A-8 already supplies the design doc for them — pstack's `orchestrate.md` liveness doctrine (count only side effects as progress; never resume an agent to check on it; transcript mtime is not liveness; externalize immediately; bound your own retries) — with the explicit warning to take the doctrine, not pstack's own competing orchestration-state store, which would duplicate sage-mode's ledger. Nothing new to add here beyond flagging the sequencing: write A-8 into `skills/sage-build/references/` as the spec, then build the two hooks against it, after WP-1 (don't extend a hook layer that's still capable of silently failing open).

---

## 8. Explicitly rejected or deferred — and why

Adoption-pstack-skills already has a full rejection table for pstack and skills; not repeated here. New from this pass:

| Rejected / deferred | Source | Why |
|---|---|---|
| **gbrain — semantic/embedding code search, cross-machine memory sync** | gstack | The single biggest capability gap the competitive-analysis found (gstack 70% overall, driven substantially by this) — and correctly out of scope. It needs an embedding provider, a trust-triad security model, and cross-machine sync infrastructure sage-mode has no other use for. BM25-over-own-docs is right-sized for a solo engineer's own project; building gbrain's provider-abstraction contract (`lib/code-intelligence/contract.ts`) for a tool with one user and one machine is solving a multi-tenant problem nobody has. Revisit only if sage-mode ever needs cross-project or cross-machine memory — not before. |
| **Multi-host portability beyond Cursor + Claude Code** | gstack, compound-engineering-plugin, superpowers all ship 6-12+ conversion targets (`.codex-plugin`, `.cline`, `.devin-plugin`, `.hermes-plugin`, etc.) | sage-mode has one user on two hosts. Shipping a dozen host adapters for a personal tool is pure surface with no payoff; WP-6/7/8 (§4.2) already cost real effort to get right for the two hosts that matter. |
| **The full `ce-compound` six-specialist research fan-out** | compound-engineering-plugin | Real, but scoped down to "revisit if WP-15 surfaces a bad learning" — see §4.4. Building it now optimizes a step (`sage-retro`) that has run zero times. |
| **ui-ux-pro-max-skill's CSV knowledge base, ported wholesale** | ui-ux-pro-max-skill | Two reasons: (1) `design-critique` already runs a genuine evidence-bound browser-verification loop that matches ui-ux-pro-max's own `design-review` subagent in rigor (§0) — there's no verification-loop gap to close; (2) their 22 CSVs encode *generic web design taste* (glassmorphism vs. brutalism, Google Fonts pairings) for arbitrary client projects. sage-mode's design org serves one project's own design system. Porting a generic taste database in is solving the wrong problem; if the design org's rubric prose (`anti-slop-rubric.md`, `accessibility-pass.md`) starts bloating the way sage-mode's own catalog skills did, the *retrieval pattern* (CSV + from-scratch BM25 instead of markdown-in-context) is the piece worth reusing then — not before, and not their data. |
| **agent-skills' textual-only enforcement model, wholesale** | agent-skills | Their own weaknesses section says it plainly: outside `SessionStart` injection, nothing stops a skip, and their two real hooks (`sdd-cache`, `simplify-ignore`) ship unwired by default. sage-mode's fail-closed hook tier is already stricter on every axis that matters; nothing to gain by importing a weaker enforcement model. |
| **`simplify-ignore.sh`'s content-hiding trick (swap annotated blocks for `BLOCK_<hash>` placeholders on Read, restore on Stop)** | agent-skills | Genuinely clever — a hard technical guarantee instead of a soft "don't touch this" instruction — but there's no current sage-mode use case for hiding file content from a model that's allowed to read it. Note it as an idea for if one arises (e.g., protecting vendored code from `/sage-fix` "helpfully" touching it); don't build it speculatively. |
| **agent-skills' full spec→plan→build→ship command surface** | agent-skills | sage-mode's own 8-command sprint spine already covers this territory with mechanical (not textual-only) enforcement. The curriculum-breadth items worth having (observability, deprecation, ADRs, CI/CD as named concerns) are already skills in sage-mode's catalog per architecture-v3 — nothing new to cut and paste here beyond the cherry-picks already listed in §5-6. |

---

## 9. Sequencing — one merged order

```
Phase 0  Hygiene + Foundation           WP-14 → WP-2 → WP-1 → WP-3                         (§3)
Phase 1  Platform truth                 WP-4, WP-5                                          (§4.1)
Phase 2  Spine B foundations            A-2, A-3, A-6, A-7                                   (§5.2)
Phase 3  Build Spine B                  /sage-look → /sage-crit → /sage-fix → /sage-debug,
                                         with the claim/evidence separation from §5.3 built
                                         into /sage-crit and /sage-fix from day one           (§5.1, §5.3)
Phase 4  USE Spine B for a week         real work, real diffs, real bugs — this is
                                         definition-of-done condition 7                        (§2)
Phase 5  Claude Code                    WP-6 (defineHost-style mapping) → WP-7 → WP-8         (§4.2)
Phase 6  Cost-lane closure              SPIKE-02 result → extend receipt verification to
                                         Lane A/C, or record the FAIL and the score drop       (§4.3)
Phase 7  Quality machinery              A-4, A-5, TF-IDF collision eval, RED/GREEN/REFACTOR
                                         tier-3 expansion                                      (§6)
Phase 8  Coordination                   A-8 doctrine written → the two hooks built            (§7)
Phase 9  Docs + remaining hygiene       WP-10, WP-11, WP-12, WP-13                            (§4.5)
Phase 10 The real test                  WP-15 — one real sprint, now run by someone who
                                         has already used Spine B for a week and knows the
                                         machinery works                                       (§4.6)
Phase 11 Deferred, not scheduled        sage-retro grounding (§4.4), design-org retrieval
                                         pattern (§8), A-9 skill-text eval harness              (§4.4, §8)
```

**Why Spine B moves before Claude Code and before the sprint, not after:** this is adoption-pstack-skills' §6 argument, unchanged and still correct — a `/sage-crit` run is fifteen minutes, a `/sage-fix` is an hour, both exercise evidence/review/conduct/lanes independently and fail in one identifiable place when something's wrong. A sprint is a day and exercises the DAG, worktrees, joins, and ship gate all at once, so a failure there tells you *something* broke, not *what*. Running Spine B first means Phase 10's sprint has already had its dependencies proven.

**Why Claude Code (Phase 5) comes after Spine B and not before:** WP-6/7/8 is roughly a day of work whose entire payoff is a host Spine A and Spine B both need eventually, but neither strictly needs to prove itself first. Spine B's four commands are useful on Cursor alone. Sequencing Claude Code after gets a working daily-usage habit established before spending a day on a platform-compatibility problem that doesn't block using the tool at all today.

---

## 10. Estimate

| Phase | Work | Est. |
|---|---|---|
| 0 | Hygiene + correctness | 1 day |
| 1 | Platform truth (spikes) | 0.5 day |
| 2 | Spine B foundations | 0.5 day |
| 3 | Build Spine B | 1.5 days |
| 4 | Use it for a week | *(calendar time, not effort — runs alongside other work)* |
| 5 | Claude Code | 1 day |
| 6 | Cost-lane closure | 0.5 day *(mostly the SPIKE-02 result already captured in Phase 1)* |
| 7 | Quality machinery | 1.5 days |
| 8 | Coordination | 1 day |
| 9 | Docs + hygiene | 0.5 day |
| 10 | The real sprint | 1 day |

**≈ 9 days of engineering effort, spread across at least two calendar weeks** because Phase 4 is deliberately a week of ordinary use, not a work package. That's longer than either prior document's estimate (ship-plan's ~5 days; adoption's phases layered on top) because this is the actual sum of both, honestly added rather than run in parallel universes. If the target is still "ship this," the cut that preserves the most value per hour is: do Phases 0-4 (correctness + Spine B + a week of real use) and stop there. That's ~3.5 days of effort plus a week of calendar time, and it's the version of this plan that answers the only question that has mattered since WP-15 was first written: is any of this worth using. Phases 5-10 are real, sequenced, and worth doing — after that question has an answer.

---

## 11. The thing worth saying plainly, again

This is the seventh design document in `docs/design/` and the third one in a single day to propose more work before any of the first six's proposals have been built. Two items in §0 turned out to already be fixed since the last read of the codebase — which is a good sign about actual progress happening, and also means at least some of this planning cycle's value came from *re-verifying claims against source*, not from writing new prose. That's worth noticing as a pattern: the highest-value thing this session did today was catching two false "still broken" claims and one false "not yet built" claim before they became wasted work for whoever implements this.

The honest reading of Phase 4 in §9 is the same one adoption-pstack-skills closed with: the four Spine B commands, used on real work for a week, are the cheapest experiment available that would tell you whether any of the rest of this — the sprint spine, the design org, the cost-lane architecture, the notebook — is worth the calendar time it's already cost. Build Phases 0 through 4, use the tool, and let Phase 4's actual results — not another audit — decide how much of Phases 5 through 11 gets built at all.
