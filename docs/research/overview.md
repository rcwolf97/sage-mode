# Overview: Five Agent-Engineering Repos, Compared

What five different people believe about how software should get built by agents — and what that implies for `sage-mode`.

Analyzed 2026-08-21 against these commits:

| Repo | Commit | Author | Size |
|---|---|---|---|
| [agent-skills](https://github.com/addyosmani/agent-skills) | `df1edb2` | Addy Osmani | 24 skills, 4 personas, 8 commands, 5 hooks |
| [compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin) | `12d3d8c` | Every Inc / Kieran Klaassen | 33 skills, ~11k LOC converter CLI, 0 hooks |
| [gstack](https://github.com/garrytan/gstack) | `51932ec` | Garry Tan | 53 command units, 88 bin/ tools, 7 hooks |
| [superpowers](https://github.com/obra/superpowers) | `b36e082` | Jesse Vincent | 14 skills, 1 hook, 0 dependencies |
| [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `bc826e2` | nextlevelbuilder | 7 skills, 22 CSVs, BM25 search engine |

Per-repo teardowns live beside this file: [`agent-skills.md`](./agent-skills.md), [`compound-engineering-plugin.md`](./compound-engineering-plugin.md), [`gstack.md`](./gstack.md), [`superpowers.md`](./superpowers.md), [`ui-ux-pro-max-skill.md`](./ui-ux-pro-max-skill.md).

---

## 1. The fundamental truth each repo believes

Each of these is a bet on *what actually goes wrong* when an agent builds software. The rest of the repo is downstream of that bet.

**superpowers — "The model will talk itself out of the process. Discipline is the product."**
Jesse Vincent's bet is that capability is not the bottleneck; rationalization is. A model that knows TDD will still write code first and call it pragmatism. So every discipline skill ships an "Excuse | Reality" table built from rationalizations *observed during adversarial pressure-testing*, and the Iron Laws are stated in ALL CAPS as non-negotiable: `"NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"`, `"Write code before the test? Delete it. Start over."` The tell is `writing-skills/SKILL.md`, which treats skill text as tested code and documents an A/B finding that prohibitions backfire for shape-of-output problems. This is the only repo of the five doing empirical prompt engineering on its own artifacts.

**agent-skills — "The industry already solved this. Encode it."**
Addy Osmani's bet is that the answer is not novel — it's Google's engineering practices, and the job is faithful transcription into a form an agent will follow. Hyrum's Law, the Beyoncé Rule, trunk-based development, Shift Left, Chesterton's Fence, ~100-line changes, five-axis code review. Twenty-four skills covering a full SDLC including the unglamorous parts nobody else has: `deprecation-and-migration`, `observability-and-instrumentation`, `documentation-and-adrs`. Belief in one line: `"Code without a spec is guessing."` It is the most *complete* curriculum and the least opinionated about orchestration.

**compound-engineering-plugin — "Each unit of work must make the next one cheaper."**
Every's bet is that the value isn't in any single cycle — it's in the residue. `ce-compound` writes one learning per run to `docs/solutions/*.md` and updates `CONCEPTS.md`; every future `ce-brainstorm`, `ce-plan`, and `ce-code-review` is instructed to read that directory first. The compounding is literal file I/O — no embeddings, no memory API. Corollary belief, and the sharpest epistemics of the five: `"Two personas reasoned inside one context are two perspectives, not two witnesses."` Independence must be bought with process isolation, not costume changes. Stated split: 80% planning and review, 20% execution.

**gstack — "AI made completeness cheap. Simulate the whole org and boil the ocean."**
Garry Tan's bet is that the shortcut is now the expensive option: `"When the complete implementation costs minutes more than the shortcut — do the complete thing. Every time."` So one solo builder gets a CEO reviewing scope, an eng manager locking architecture, a designer rating dimensions 0-10, a DX reviewer timing time-to-hello-world, a security officer running a 14-phase OWASP+STRIDE audit, and a QA that drives a real Chromium. Counterweighted by the only user-supremacy principle in the set: `"Two AI models agreeing on a change is a strong signal. It is not a mandate... the user is right. Always."` — coded into `autoplan` as a non-auto-decidable "User Challenge" class.

**ui-ux-pro-max-skill — "The model has no taste and no eyes. Give it data and a browser."**
nextlevelbuilder's bet is that design failure is an *information* problem, not a prompting problem: `"Most AI design fails because the model never sees what it built and has no opinionated point of view."` Fix one half with 22 curated CSVs (88 styles, 192 product→palette mappings, 1,935 licensed fonts, 119 UX guidelines) served through a from-scratch BM25 search subprocess — never dumped into context. Fix the other half by opening the real page in Playwright at five viewport widths and auditing what is actually on screen. It is the only repo whose knowledge scales without its context cost scaling.

---

## 2. Where all five agree (the consensus stack)

Despite wildly different sizes, five independent authors converged on the same skeleton. Treat this as settled and don't re-litigate it in `sage-mode`:

1. **A written artifact between intent and code.** `SPEC.md` (agent-skills) / `docs/plans/*-plan.md` (CE) / `docs/superpowers/specs/*.md` (superpowers) / a design doc gated by `## GSTACK REVIEW REPORT` (gstack). Nobody lets the agent go from chat to implementation.
2. **A hard human approval gate before code.** Universal. superpowers is most explicit: `"the ceremony scales with the task; the approval gate never does."`
3. **Small, ordered, independently verifiable units of work.** 2–5 minute tasks (superpowers), U-IDs (CE), `tasks/todo.md` with acceptance criteria (agent-skills).
4. **Tests as the definition of done, written first.** All four engineering repos. superpowers deletes untested code rather than back-filling.
5. **Fresh-context adversarial review before merge.** The single strongest consensus, and every repo independently discovered the same failure mode — a reviewer that sees your conclusion validates your conclusion. agent-skills strips the claim (`ARTIFACT + CONTRACT`, never `CLAIM`); CE requires separate execution contexts; gstack dispatches a scope-gated "review army" with fingerprinted findings; superpowers dispatches a per-task reviewer with a file-based `review-package`.
6. **Severity taxonomies that map to a merge decision.** Critical/Important/Suggestion, Blocker/High/Medium/Nitpick, GO/NO-GO. Not scores — decisions.
7. **Anti-fabrication rules.** `"Never fabricate metrics"` (agent-skills). `"never invent findings"` (ui-ux). `"If you cannot quote the motivating line(s), the finding is unverified — force its confidence to 4-5"` (gstack). `"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"` (superpowers).
8. **Progressive disclosure of the prompt library.** Skeleton `SKILL.md` + `references/` or `sections/` loaded on trigger. All five, in four different implementations.

---

## 3. Where they genuinely conflict

These are the real forks in the road. `sage-mode` has to pick a side on each; it cannot inherit both.

| Axis | Pole A | Pole B | The stakes |
|---|---|---|---|
| **Scope default** | gstack: *Boil the Ocean* — completeness is cheap, do the whole thing | agent-skills/superpowers: smallest viable change, ~100-line commits, `"if you build 1000 lines and 100 would suffice, you have failed"` | gstack's own `model-overlays/gpt-5.6-sol.md` contradicts its ETHOS (`"never as permission to widen it"`). Even gstack can't hold this line consistently. |
| **Autonomy** | gstack `/autoplan` auto-answers everything but taste; CE `lfg` runs hands-off with STOP gates | superpowers: the approval gate never scales away | Determines whether a "day" is 6 supervised hours or 2 hours of your attention plus unattended runs. |
| **Enforcement** | gstack: real `PreToolUse` hooks that hard-deny (`careful`/`freeze`/`guard`), a `Stop` verify-gate | superpowers/CE/agent-skills: textual persuasion; agent-skills' two mechanical hooks ship *unwired* | Textual enforcement is a permanent arms race the repos themselves document losing. Mechanical enforcement is the only thing that actually holds. |
| **Independence** | CE: only separate execution contexts count as witnesses | gstack: 23 "specialists" are personas written into prompt text; subagents are all generic `general-purpose` with inherited models | CE is epistemically right. gstack is cheaper. |
| **Knowledge form** | ui-ux: CSV + BM25 subprocess, top-N rows returned | everyone else: markdown prose loaded into context | The only approach that survives a library growing past ~30 skills. gstack's `office-hours/SKILL.md` is ~1,740 lines *before* its six questions start; a tool exists (`gstack-context-bill`) solely to audit this. |
| **Learning** | CE: `ce-compound` writes a durable learning every cycle | superpowers/agent-skills: none; skills are hand-tuned offline by maintainers | Without this, you re-solve the same problem monthly. With it (unindexed), you accumulate 78 files nobody reads — CE needed `ce-compound-refresh` to manage the rot. |
| **Front half** | gstack `/office-hours`: demand reality, narrowest wedge, `"Interest is not demand"` | everyone else: assumes the feature is worth building | Only gstack asks whether the thing should exist. For a solo builder choosing what to ship, that's not optional. |

---

## 4. What each is actually best at

| Capability | Best in class | Why |
|---|---|---|
| Stopping the agent from cheating | **superpowers** | Rationalization tables from observed pressure-test failures; Iron Laws; letter=spirit clause |
| Breadth of engineering practice | **agent-skills** | 24 skills incl. observability, deprecation, ADRs, CI/CD, API contracts |
| Cross-session memory | **compound-engineering** | `ce-compound` → `docs/solutions/` → required read for all planning skills |
| Multi-perspective review | **gstack** + CE | Scope-gated specialist army with fingerprint dedup + confidence gating; CE's risk-selected 16-persona roster |
| Mechanical guardrails | **gstack** | `PreToolUse` hard-deny hooks, directory freeze, content-addressed test evidence (`gstack-wtree`) |
| Real runtime verification | **gstack** `/qa` + **ui-ux** `design-review` | Actual headless Chromium, real screenshots, real console errors |
| Knowledge at scale without context cost | **ui-ux-pro-max** | BM25 subprocess over 22 CSVs; nothing loaded until queried |
| Deciding what's worth building | **gstack** `/office-hours` | Six forcing questions; behavior-over-interest demand test |
| Subagent orchestration hygiene | **superpowers** | File-based briefs, no-recursive-subagents contract, compaction-proof ledger |
| Portability across harnesses | **compound-engineering** | 11k-line converter to 8+ platforms (also its biggest irrelevance) |

---

## 5. What none of them solve

This is the wedge for `sage-mode`.

1. **Nobody optimizes for wall-clock.** Every repo optimizes for correctness or completeness; none has a time budget, a latency model, or a "this feature has 6 hours" mode. gstack targets 10–15 *parallel sprints*; superpowers targets long unattended runs; CE targets team compounding. Idea → shipped, solo, today is an unoccupied point in the design space.
2. **Nobody routes intelligently.** With 24–53 skills installed, *which* runs for this task is left to the model reading descriptions. agent-skills' TF-IDF eval (rank-1 ≥80%) is the only attempt, and it tests whether the right *name* gets picked, not whether the right *workflow* ran.
3. **Enforcement is mostly theater.** Four of five rely on the model choosing to comply. Only gstack blocks anything at the tool layer, and its verify-gate is opt-in per repo. Nothing in any repo blocks a commit with a failing suite.
4. **The learning loop is write-only.** CE is the only one that writes learnings, and it writes them to a flat directory with no index, no dedup, and no retrieval beyond "read the folder." That is a search problem with a known solution — one that ui-ux-pro-max already implemented for a different domain and CE never borrowed.
5. **Cost is invisible.** Zero token accounting, zero model-tier discipline that's actually wired. agent-skills documents Haiku/Sonnet/Opus assignments in prose and pins `model:` in none of its four persona files; gstack's subagents all inherit the parent model.
6. **No repo proves it works.** gstack's productivity claims are fed by its own telemetry. superpowers has evals only for skill text. Nobody benchmarks "features shipped per day" against a control.

---

## 6. Implications for sage-mode

Five positions worth arguing about, drawn from the comparison above:

- **Steal the consensus stack wholesale** (§2). It's free and it's settled. The differentiation is not there.
- **Side with superpowers on discipline, gstack on enforcement.** Rationalization tables *plus* real `PreToolUse`/`Stop` hooks. Textual rules are the spec; hooks are the compiler.
- **Side with agent-skills/superpowers on scope, against gstack.** "Boil the ocean" is directly incompatible with shipping in a day, and gstack's own model overlay quietly walks it back.
- **Steal ui-ux's architecture, not its content.** A BM25/ripgrep-searchable index over skills *and* accumulated learnings solves both the routing problem (§5.2) and the retrieval half of the learning problem (§5.4) with one mechanism. This is the single highest-leverage idea in all five repos and nobody applied it to skills themselves.
- **Steal CE's compounding, fix its retrieval.** `ce-compound`'s instinct is right; its flat unindexed folder is the bug.
- **Keep gstack's `/office-hours` front half, drop its org simulation.** Six forcing questions cost minutes and prevent shipping the wrong thing. Four persona plan reviews cost hours.
- **Add the thing none of them have: a time budget.** A `sage-mode` run should know how long it has, and pick its ceremony tier from that — not from task classification alone.
