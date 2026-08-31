# sage-mode — Ship Tech Spec

**Prepared:** 2026-08-31 · **Status:** the buildable spec. Supersedes nothing on disk — `ship-plan.md`, `adoption-pstack-skills.md`, `two-spines-roadmap.md`, and `decision-spine.md` stay as historical record — but this is the one an engineer should actually work from. It applies the modify-vs-add and essential-vs-speculative framework from the prior conversation turn to every open item across all four documents and gives each one exactly one of three dispositions: **build now** (full spec below), **defer** (named, with the condition that would revive it), or **cut** (named, with the one-line reason).

**The headline number.** The four prior documents, added up, propose roughly 16 additional engineering days. This spec is **≈5.5 blocking days**, one calendar week of real use, then **≈3 more days** of high-value-but-non-blocking work sequenced after that week reports back. Everything else named in this document is deferred or cut, on the record, so it doesn't get silently re-proposed.

---

## 0. Disposition of every open item

Read this table before reading anything else. It is the actual answer to "why do we need to change things, and what's real."

| Item | Source | Disposition |
|---|---|---|
| `sage-lane`/`sage-proof`/`sage-solo` heredoc-in-`$()` fail-open bug | ship-plan WP-1 | **Build — §2.1** |
| Golden harness reports `ok` for a hook that never ran | ship-plan WP-2 | **Build — §2.2** |
| `npm test` makes live billable `claude -p` calls by default | ship-plan WP-3 | **Build — §2.3** |
| Lane B tool-allowance narrower than spec; no `--bare` guard | ship-plan WP-11 | **Build — §2.4** (bundled into correctness) |
| Working-tree hygiene (probe artifacts, absolute paths) | ship-plan WP-14 | **Build — §2.5** |
| SPIKE-01 (does `preToolUse` expose a file path) | ship-plan WP-4 | **Build — §3.1** (procedural) |
| SPIKE-02 (does Cursor honor plugin-shipped `model:`) | ship-plan WP-5 | **Build — §3.2** (procedural) |
| Claude Code: manifest rejected, `model:` values break dispatch, no `.claude/agents/` install path | ship-plan WP-6/7/8 | **Decision point — §3.3.** Two paths spec'd; default recommendation is to drop the Claude Code claim, not fix it, absent evidence Rohit uses Claude Code regularly. |
| Two unbuilt coordination hooks (`subagentStop`, `postToolUse`) | ship-plan WP-9, adoption A-8 | **Defer.** Automates a loop (`/sage-build` self-chaining) that has never run once. Revive when a real sprint (§8, Phase 10) shows the manual `sage board next` loop is actually the bottleneck — not before. |
| Cross-session dedup is prose, not code | ship-plan WP-10 | **Build, non-blocking — §7.3.** Real, cheap-ish, sequenced after Spine B ships. |
| Doc drift (stale scorecard claims, stale line counts) | ship-plan WP-12 | **Build, lightweight — §7.5.** A find-and-fix pass, not engineering. |
| `docs/build.py` unrunnable | ship-plan WP-13 | **Defer.** Blocks rendering the notebook to HTML, not the plugin's function. |
| Run one real sprint | ship-plan WP-15 | **Build — §8, Phase 10.** The actual ship gate. |
| `/sage-crit`, `/sage-fix`, `/sage-look` | adoption A-1 | **Build — §5.2–§5.4.** |
| `/sage-debug` as a fifth, separate command | adoption A-1, decision-spine | **Cut.** Folded into `/sage-fix` phase 1 — see §5.3. Two commands for one workflow was the mistake. |
| Evidence ladder (`rung` on findings) | adoption A-2 | **Build — §4.1.** |
| Verdict grade on `EvidenceRecord` | adoption A-3 | **Build — §4.2.** |
| `writing-for-agents` lint rules (negation, environment-cache, disclosure, leading-word) | adoption A-4 | **Defer.** Real, low priority, prose-quality polish on a catalog that isn't the bottleneck right now. |
| Skill lifecycle (`in-progress`/promoted/deprecated) | adoption A-5 | **Defer.** Organizational, not blocking. |
| Verbatim step copy with visible `skip:` | adoption A-6 | **Build, cheap — §4.3.** |
| `.sage/out-of-scope/` registry | adoption A-7 | **Build — §4.4.** Direct dependency of `/sage-oh`'s one distinguishing feature. |
| Skill-text eval harness (RED/GREEN/REFACTOR expansion, TF-IDF collision) | adoption A-9, two-spines §6 | **Defer.** Already deferred in its own source document; nothing here changes that. |
| `defineHost()`-style host model-mapping | two-spines §4.2 | **Folded into the Claude Code decision point — §3.3.** Only relevant if that path is chosen. |
| Claim/evidence separation "mechanization" | two-spines §5.3, corrected in decision-spine §1.1 | **Narrowed and built — §5.1.** The doctrine already exists in `sage-review/SKILL.md`; the actual gap is that the *new* Spine B commands don't inherit it yet. No lib code change turns out to be honestly buildable here — see §5.1 for why, and what ships instead. |
| `/sage-grill` extraction | decision-spine WP-18 | **Defer.** UX polish to `sage-shape`'s interrogation loop; internal-only machinery either way, never user-facing surface, not blocking. |
| Domain-modeling reference + glossary in recall | decision-spine WP-19 | **Defer.** Depends on WP-18. |
| `/sage-spec` | decision-spine WP-20 | **Cut.** No reader without `/sage-map`, which is also cut/deferred below. An artifact type with no consumer is the exact "noise" this spec exists to avoid. |
| Tracer-bullet discipline in `sage-dag` (`slice`, D8, D9) | decision-spine WP-21 | **Build — §6.1.** Fixes an incentive that's actively wrong in shipped code today; not speculative. |
| `/sage-oh` | decision-spine WP-22 | **Build, deliberately small — §5.5.** |
| `sage review doc` | decision-spine WP-23 | **Build — §4.5.** Highest value-per-hour item in this document. |
| `sage board render` / commander console | decision-spine WP-24 | **Build, minimal slice only — §6.2.** |
| Per-specialist attribution / Agreement Map / Dismissed bucket | decision-spine WP-25 | **Defer.** Needs real review-cycle data (from a real sprint) to design against; building it now is designing for a hypothetical. |
| `disputed` disposition | decision-spine WP-26 | **Defer.** Depends on WP-25. |
| `posture:` field | decision-spine WP-27 | **Defer.** Small, but ties to the WP-25/26 chain; no standalone value yet. |
| `sage ground <file>` | decision-spine WP-28 | **Build — §4.6.** The single highest-confidence item in this whole spec: closes a demonstrated, repeated, measured failure (six wrong claims across two independent audit passes on this repo's own docs). |
| `sage-retro`: grounding call + scope parameter | decision-spine WP-29, WP-30 (`/sage-learn`) | **Build, narrowed — §5.6.** Grounding call: yes. Five-dimension overlap rewrite: deferred (§7.3 territory, not urgent). `/sage-learn` as a *separate* command: **cut** — folded into `sage-retro` taking a `scope` parameter instead. Same reasoning as `/sage-debug`. |
| `sage retune --check` / corpus retuning | decision-spine WP-31 | **Defer entirely**, including the cheap gate-check. There is no point gating a corpus-retune capability before the corpus (Spine B's findings, `sage-retro`'s learnings) has any real mileage on it. |
| `phantom-handoff` lint rule + defender doctrine | decision-spine WP-32 | **Defer.** Real, cheap-ish, but polish — sequence after the catalog has skills worth auditing for this. |
| `lib/recall` unit test coverage | decision-spine WP-33 | **Build — §4.7.** Foundational: `sage ground`, the out-of-scope registry, and `sage-retro`'s grounding call all lean on `lib/recall` being correct. |
| Design-org placement decision | decision-spine WP-34 | **Build, lightweight — §7.5.** A decision and a paragraph, not new engineering. |
| `/sage-map` (wayfinder), a named "Spine C" | decision-spine WP-35, §7 | **Cut for now.** Its own author recommended deferring the build; this spec goes further and declines to name a third architectural spine for one shipped command (`/sage-oh`, already Spine-B-adjacent) and one deferred one. Revisit only if `/sage-oh` produces a `don't-build` verdict that visibly prevented real wasted work — the falsifiable test decision-spine §7.5 already wrote. |

---

## 1. Definition of done

Supersedes ship-plan §0 and two-spines §2, trimmed to match §0 above.

1. `npm run verify` exits 0 on macOS: `hooks/tests/run.sh` passes under bash 3.2, dash, and bash 5, and can no longer report `ok` for a hook that produced no output.
2. SPIKE-01 has a live host payload recorded, `status: decided`.
3. SPIKE-02's Cursor arm is decided with a usage/cost line as evidence.
4. The Claude Code decision point (§3.3) is resolved one way or the other — fixed, or the claim is formally withdrawn from the manifest and docs. No half-port either way.
5. `sage ground` and `sage review doc` have each run against this repo's own `docs/design/*.md` and produced a report — cheaper than a sprint, and the first real test of whether the grounding mechanism works at all.
6. `/sage-crit`, `/sage-fix`, and `/sage-look` have each fired at least once against real work — not a fixture.
7. `/sage-oh` has fired at least once.
8. One real sprint has run end-to-end and `evals/comparison.md` is filled in, including a bad result if there is one.

Conditions 5–7 are new relative to ship-plan, deliberately sequenced before condition 8 — they're cheaper, and they de-risk the sprint rather than the other way around.

---

## 2. Correctness — blocking, do first (~1.5 days)

### 2.1 WP-1 — `sage-lane` cannot deny on macOS

Unchanged from ship-plan WP-1. Five sites nest a heredoc inside `$( )` command substitution, which bash 3.2 (`/bin/sh` on macOS) cannot parse:

| File | Line | Interpreter | Polarity |
|---|---|---|---|
| `hooks/sage-lane` | 38 | python3 | deny, `failClosed` |
| `hooks/sage-lane` | 116 | node | deny, `failClosed` — **breaks today**, triggered by apostrophes at lines 127, 176 |
| `hooks/sage-proof` | 32 | python3 | bounded nag |
| `hooks/sage-solo` | 54 | python3 | deny, `failClosed` |
| `hooks/sage-solo` | 69 | node | deny, `failClosed` |

**Fix.** Write the embedded interpreter source to a temp file, execute the file — no heredoc inside `$( )`:

```sh
LANE_SRC=$(mktemp "${TMPDIR:-/tmp}/sage-lane-src.XXXXXX")
trap 'rm -f "$PAY" "$LANE_SRC"' EXIT
cat > "$LANE_SRC" <<'JS'
  ... unchanged body ...
JS
LANE_RESULT=$(node "$LANE_SRC" "$ROOT" "$LANE" "$PAY")
```

Move all five bodies byte-identically; diff the extracted bodies against the originals before landing. `node -` (stdin) becomes `node "$FILE"` — verify `argv` indexing per site, don't assume it's unchanged. Reword the two apostrophe comments regardless (cheap insurance, not the fix).

**Acceptance.** `hooks/tests/run.sh` passes under bash 3.2/dash/bash 5. Hand-check on macOS: the WP-1 reproduction (`printf '%s' '{"tool_input":{"path":"src/web/x.ts"}}' | CURSOR_PROJECT_DIR="$TMP" ./hooks/sage-lane`) emits the deny JSON and exits 0/2 correctly. `npm run eval:tier3` scenario 4 passes on macOS.

### 2.2 WP-2 — the golden harness can't distinguish "allowed" from "never ran"

`hooks/tests/run.sh:70` normalizes empty stdout to `{}`, identical to the allow fixture (`hooks/tests/sage-lane/allow-in-lane.out.json` is literally `{}`). A crashed hook reports `ok`.

**Fix.**
1. Emit a distinguishable sentinel (`__EMPTY__`) instead of coercing to `{}` when stdout is empty/whitespace.
2. `hooks/tests/compare.py` fails loudly on that sentinel: `FAIL <fixture> — hook produced NO output (parse error or crash?)`.
3. New `test/hooks-shell-portability.test.ts`: grep every file in `hooks/` for `=\$\((python3|node|awk|sed)\b[^)]*<<` and fail with file:line if found — the regression guard for §2.1.
4. Document in `run.sh`'s header that `ubuntu-latest`'s `sh` is dash, so this class of bug is invisible to CI regardless — the guard in (3) is what actually prevents recurrence.

**Sequencing.** Do this *before* §2.1 — you need a test that can see the bug before you can prove the fix.

**Acceptance.** With §2.1 deliberately reverted, `run.sh` fails on the allow fixtures instead of printing `ok`. With §2.1 applied, everything passes under all three shells. The construct-guard test fails when a heredoc-in-`$()` is reintroduced anywhere in `hooks/`.

### 2.3 WP-3 — `npm test` dispatches live, billable model calls

`test/consult.test.ts:84` and the redaction tests at lines 135, 185 call `consult()` for real when `claude` is on `PATH`. On the machine this was observed on, one test took 181 seconds and billed metered API rates (not the subscription) because `ANTHROPIC_API_KEY` was set — the exact failure Lane B exists to prevent.

**Fix.** Gate the live-dispatch assertions behind `SAGE_TEST_LIVE_CONSULT=1`, skipped with a clear reason otherwise. Keep the offline assertions (structure, pre-spawn redaction, egress-row shape) running always — they already use the fake-`claude`-on-`PATH` helper around line 153, they don't need a real dispatch. When the live path *is* enabled, make `consult()`'s `ANTHROPIC_API_KEY` warning fail the run rather than just warn.

**Acceptance.** `npm test` completes in well under 30s with zero network egress and zero `claude` invocation. `SAGE_TEST_LIVE_CONSULT=1 npm test` still exercises the live path.

### 2.4 WP-11 — Lane B consult: tool allowance and `--bare` guard

`lib/consult/index.ts:265` passes `--allowedTools "Read,Grep,Glob"`. §5 of architecture-v3 specifies `"Read,Grep,Glob,Bash(git diff *),Bash(git log *)"` — the Architect consult can't read git history today. Restore the two scoped patterns, or record explicitly why they were dropped.

Separately: nothing asserts `--bare` is never passed to the `claude` CLI (bare mode bypasses subscription login, reverting silently to metered billing). Add a test asserting `--bare` is absent from the spawned argv, next to the fake-CLI harness already in `test/consult.test.ts`.

**Acceptance.** Architect consults can read `git diff`/`git log` output. A test fails if `--bare` is ever added to the spawned argv.

### 2.5 WP-14 — Working-tree hygiene, standing rule

**Verified clean today** — no action needed on current state. The standing rule: while a spike probe is installed (§3.1, §3.2), `hooks/hooks.json` / `hooks/hooks-claude.json` carry a hardcoded absolute path by design. Before every commit during spike work:

```bash
cd plugin
./tools/spikes/spike-01-write-path/uninstall.sh
./tools/spikes/spike-02-subagent-model/uninstall.sh
git diff --stat hooks/     # must be empty
```

**New this pass — bundle WP-16 here (build-freshness gate).** `tsconfig.json` sets `"outDir": "."` and `"rootDir": "."` (both confirmed), so TypeScript compiles in place. `git ls-files` shows 17 tracked `.js` under `plugin/lib/`, 15 under `plugin/test/`, plus `evals/tier3/run.js` — nothing in `.gitignore` excludes them, and `ci.yml` runs `npm run build` (line 19 of `.github/workflows/ci.yml`) *before* every other check, so CI always evaluates freshly compiled output and can never observe committed `.js` going stale relative to its `.ts`. A plugin install copies files rather than building them — the committed `.js` is what a user actually runs.

**Fix.** New script `"build:check": "npm run build && git diff --exit-code -- '*.js'"`, wired into `npm run verify` (`package.json`) immediately after `build` and before `test`, and into `ci.yml` the same way.

**Acceptance.** Editing a `.ts` file without rebuilding fails `npm run verify` and CI, naming the offending `.js` file.

---

## 3. Platform truth — blocking, procedural (~0.5 day + decision)

### 3.1 SPIKE-01

Unchanged from ship-plan WP-4. `plugin/tools/spikes/spike-01-write-path/out/verdict.txt` currently contains only synthetic same-second self-check payloads — not a live capture. Reload window, install the probe, have the agent `Write` a file in a **new** chat, capture the real payload, record `status: decided` in `docs/spikes/SPIKE-01.md`. If the path key found isn't already in `sage-lane`'s parse list (`path`, `file_path`, `filePath`, `target_file`, `file`), add it plus a golden fixture. If it fails outright, switch the lane hook from `preToolUse` to `afterFileEdit`/`PostToolUse` (`sage-lane-after`, already built and registered as a fallback) and re-estimate §6.1's tracer-bullet work as corrective rather than preventive.

### 3.2 SPIKE-02 (Cursor arm)

Unchanged from ship-plan WP-5. The Claude Code arm is already decided (haiku PASS, gemini FAIL, `--plugin-dir` FAIL). The Cursor arm — whether plugin-shipped `agents/*.md`'s `model:` frontmatter is honored at all — is not. Test the enum question first: the reporting session's Cursor `Task` tool accepted `inherit | claude-4.5-haiku-thinking | claude-4.6-sonnet-medium-thinking | composer-2.5 | composer-2.5-fast | cursor-grok-4.6-high | gpt-5.6-sol-medium` — no `gemini-3.7-flash`. If plugin agents dispatch through that enum, Lane C cannot be `gemini-3.7-flash` regardless of frontmatter, and the fix is moving Lane C to `gpt-5.6-sol-medium` across `reviewer.md`, `red-team.md`, `design-critic.md`. The only PASS that counts is a usage/cost line naming the model — a subagent's self-report is not evidence.

### 3.3 Claude Code — decision point

**The recommendation: drop the claim, ship Cursor-only, revisit later.** This is a real decision, not a default — spec both paths so whichever is chosen is a real choice, not an accident.

**Path A — drop it.** Remove `agents`, `commands`, `skills`, `hooks` (the Claude-specific declarations) from `.claude-plugin/plugin.json` where they duplicate default-location auto-discovery; remove the `_comment_no_rules` field; update the manifest and every doc that currently claims dual-host support to say Cursor-only. Cost: ~1 hour, mostly doc edits. Reopen only when Rohit reports actually reaching for Claude Code regularly.

**Path B — fix it.** Two sub-problems, and they must land together (fixing dispatch without fixing model values converts silent absence into loud breakage of every persona):

1. **Manifest.** `claude plugin validate` rejects `"agents": "./agents"` and inspects the wrong hooks file. Delete the redundant `skills`/`agents`/`commands` declarations (components at default locations auto-discover per Claude Code's own docs); iterate on the `hooks` key until validation inspects `hooks-claude.json` rather than Cursor's `hooks.json`; test against a real plugin install, not just `--plugin-dir`.
2. **Model mapping.** 16 of 19 role cards pin `grok-4.5`/`grok-4.6`/`gemini-3.7-flash`, none of which Claude Code accepts. Structure the mapping as a single-source-of-truth object rather than duplicated host-specific card files — gstack's `hosts/define-host.ts` factory is the proven prior art: a `defineHost()`-style function where each host supplies only its overrides and everything else (paths, tool-name rewrites, cross-model-resolver suppression) comes from shared defaults constructed fresh per call. Concretely: `lib/setup/hosts.ts` exporting one `HOST_MODEL_MAP` (`{ cursor: {...identity map...}, claude: { "grok-4.6": "opus", "grok-4.5": "sonnet", "gemini-3.7-flash": "haiku" } }`), consumed by `sage setup`'s install step (`lib/setup/index.ts:57` currently only builds `.cursor/agents/` targets — add `.claude/agents/` here too, applying the mapping) and by a new lint rule: a card's `model:` must be valid for at least one declared host, and the mapping must be total.

Cost: ~1 day (§4.2 of ship-plan's original estimate holds). Only worth it if Path A's "revisit later" trigger actually fires.

---

## 4. Verification infrastructure — blocking (~1.5 days)

This section is the actual center of gravity of this spec. None of it is a new command. All of it is testable today, against artifacts (this repo's own `docs/design/*.md`) that already exist, before a single Spine B command is built.

### 4.1 Evidence ladder — `rung` on findings

**Schema.** `schemas/finding.schema.json` — add:

```json
"rung": { "type": "integer", "minimum": 1, "maximum": 5, "description": "1=stated, 2=cited (file:line), 3=walked (failure traced step by step), 4=run (a command whose output is quoted), 5=reproduced live" }
```

Not required — existing findings without it behave as today. `lib/review/index.ts`'s `gate()` (line 150) extended: a finding claiming `rung >= 4` must carry an `evidence` field containing something that looks like a command-and-output pair (a heuristic: contains a shell prompt marker or a code-fence), or it's demoted to rung 3 and its confidence capped the same way missing evidence already caps it today. Unset `rung` defaults to the existing behavior (quote-the-line-or-cap-at-5) unchanged.

**Acceptance.** A finding claiming `rung: 5` with no evidence field is demoted and its confidence capped; a finding claiming `rung: 4` with a quoted command and output passes through unmodified; existing findings with no `rung` field behave exactly as before this change.

### 4.2 Verdict grade on `EvidenceRecord`

**Schema.** `lib/evidence/index.ts`'s `EvidenceRecord` interface (line 20) — add:

```ts
grade?: "type-check-only" | "unit-test-verified" | "live-verified" | "verifier-blocked";
```

Optional, backward compatible. `sage-verify`'s profiles (referenced but not detailed here — check `profiles/*.json` at implementation time) declare a minimum grade per check kind where one is meaningful. `/sage-ship` gains one check: refuse to cite a `type-check-only` record for a node whose acceptance criteria describe runtime behavior (a heuristic on the acceptance text, same class of heuristic as §6.1's D8).

**Acceptance.** A `run()` call can set `grade`; `readEvidence()` returns it unchanged; an existing record with no `grade` is unaffected.

### 4.3 Verbatim step copy with visible `skip:`

One paragraph in `rules/sage-conduct.mdc` (new section, after "Rulings, not stalls"): a command skill's first todo-list actions are the matched procedure's own steps, copied in verbatim, before task-specific todos and before any bespoke re-planning; a step not done stays in the list with `skip: <reason>` rather than silently disappearing.

Mechanical half: `sage-build` already writes step state to the ledger — a skipped step with no recorded reason fails `sage lint`'s existing lint pass (extend `conventions.test.ts`'s pattern, one new rule).

**Acceptance.** A ledger entry with `status: skipped` and no `reason` field fails lint; one with a reason passes.

### 4.4 `.sage/out-of-scope/` registry

**Format.** One markdown file per rejected *concept* (not per session), `.sage/out-of-scope/<slug>.md`:

```markdown
---
kind: out-of-scope
concept: <short name>
rejected: 2026-08-31
---

## Why

<the reasoning>

## Prior mentions

- <date> — <where it came up>
```

**Wiring.** `lib/recall`'s `buildIndex()` (line 93) currently takes `docsRoot`/`skillsRoot` — add a third optional root, `scopeRoot` (default `.sage/out-of-scope`), walked the same way `indexFile()` (line 67) already walks the other two, tagged `kind: out-of-scope` via the existing `kindFallback` mechanism. `/sage-oh`'s `don't-build` path (§5.5) writes here; `sage-shape` and `sage-plan` read here before proposing a candidate (one `search()` call each, `lib/recall/index.ts:144`).

**Acceptance.** `sage recall "<a rejected concept>" --kind out-of-scope` returns the entry; a `/sage-shape` run on a previously-rejected concept surfaces the rejection before the interrogation starts.

### 4.5 `sage review doc` — the design-doc review loop

The highest value-per-hour item in this spec.

**New entry point**, `lib/review/index.ts` or a new `lib/review-doc/index.ts` (pick based on how much of `gate`/`dedup` genuinely reuses — likely most of it, since the shape is the same: dispatch, gate, render). Dispatches Lane C, `readonly: true`, seeing **only a document path**, never the conversation that produced it — the same ARTIFACT+CONTRACT principle `sage-review` already enforces for code, applied here for the first time to the artifacts that decide what code gets written.

**Rubric.** New `skills/sage-review/references/checklists/design-doc.md`, five dimensions: completeness, consistency, clarity, scope, feasibility, each 1–10.

**Convergence guard**, taken from gstack's office-hours Spec Review Loop verbatim in substance: fix and re-dispatch, max 3 iterations; if the same issue appears on two consecutive iterations, stop and persist it as a `## Reviewer Concerns` section in the document rather than looping. **Non-blocking** — a doc review that hard-gates a roadmap turns intake into a two-model argument the user has to referee, which is exactly the failure mode §5.1 exists to avoid elsewhere.

**Wiring.** Pre-gate step (advisory, not blocking) at `/sage-shape`'s roadmap-render step, `/sage-plan`'s spec-write step, `/sage-dag`'s DAG-render step, and `/sage-oh`'s verdict-write step.

**Acceptance.** `sage review doc docs/design/decision-spine.md` (or any doc) returns a scored report on all five dimensions; a document whose reviewer flags the same issue on two consecutive passes gets a `## Reviewer Concerns` section and the loop stops; an unavailable reviewer produces a one-line notice and does not block whichever gate called it.

### 4.6 `sage ground <file>`

The single highest-confidence item in this document. Not speculative — this repo has produced six wrong source claims across two independent audit passes (three in two-spines' own re-check of an earlier audit; three more in decision-spine's re-check of two-spines). This is the mechanism against exactly that failure.

**Mechanical pass** (deterministic, pure Node, no model call): scan a markdown file for
- `path:line` and bare-path citations → assert the path exists in the working tree
- 7–40 character hex strings that look like SHAs → `git cat-file -e`, plus reachability from `HEAD`
- scaffold leaks (`Learning N`, `{{...}}`, `TODO(`, `<slug>`)
- relative markdown links → assert they resolve

Emit a flag table classifying each hit as **fix / annotate / confirm-intentional** — never an automatic rewrite, never an automatic pass. This mirrors compound-engineering-plugin's `grounding-validation.md` adjudication table closely enough to be worth citing as the source, not reinventing independently.

**Semantic pass**: one Lane C, `readonly: true` dispatch, checking three claim categories against the source it's handed a path to (never pasted content) — code-behavior claims against the local tree (quote the defining `file:line`), merge-state claims against remote truth, internal-completeness claims (a countable assertion like "six items" checked by counting the substantiating items in the document itself). Verdict per claim: verified / contradicted / unverifiable. **Contradicted** → fix using the quoted evidence, because the quote is authoritative, not the conversation that produced the claim. **Unverifiable** → soften or attribute ("per this session's conclusion…"), never silently delete and never silently assert.

**CLI.** `sage ground <path>` — new `cmd === "ground"` branch in `lib/cli.ts`, alongside the existing `review`/`evidence`/`dag` verbs.

**Where it runs, in priority order:** (1) `docs/design/*.md` today — this repo's own planning corpus; (2) `sage-retro`'s grounding call (§5.6) before a learning is written; (3) `/sage-ship`'s PR body.

**Acceptance — this is the point.** `sage ground docs/design/two-spines-roadmap.md` flags §4.4's now-known-incorrect characterization of `ce-compound` as an unsupported claim against its own cited path, and flags nothing that's actually correct. **That test is runnable this afternoon**, against a file that already exists, with zero sprints run and zero Spine B commands built. Nothing else in this spec has that property.

### 4.7 `lib/recall` unit coverage

`test/recall.test.ts` is 18 lines, one negative-case assertion. The BM25 scorer (`lib/recall/index.ts:132`), the index builder (`:93`), `dedupAppliesWhen`'s threshold logic (`:163`), and `overlap()` (`:178`) have no direct coverage — everything else in §4 (`sage ground`'s out-of-scope lookups, `sage-retro`'s grounding call, the out-of-scope registry) leans on this being correct.

**Fix.** Direct tests for `bm25` (idf monotonicity, length normalization), `buildIndex` (frontmatter `kind` parsing, df computation across the three roots including the new `scopeRoot`), `overlap`, and `dedupAppliesWhen` on both sides of its `0.55` default threshold.

**Acceptance.** Every exported function in `lib/recall/index.ts` has at least one direct assertion.

---

## 5. Spine B — blocking (~2 days for the core three, ~0.5 day for `/sage-oh`)

### 5.1 The claim/evidence separation question, resolved honestly

Two-spines flagged this as missing; decision-spine corrected that — `sage-review/SKILL.md:85-91` already states it explicitly (*"the reviewer receives ARTIFACT and CONTRACT only — never the implementer's report... if you hand over conclusions, you get back validation of conclusions"*), and `agents/reviewer.md` states it too. What's actually missing is narrower and, on inspection, **not cheaply mechanizable the way it first looked**: there is no hook that intercepts a Task-tool dispatch's prompt content before it's sent, so there's no interception point to enforce this in code short of building a new `subagentStart`-tier content filter — which is real new surface for a benefit that's already covered by the discipline working correctly in `sage-review` today.

**What actually ships instead:** every new Spine B command that dispatches a reviewer (`/sage-crit`, `/sage-fix`) inherits `sage-review`'s exact step-4 language and Common-Rationalizations-table entry verbatim, not paraphrased — this is the cheap, honest version of "mechanize the rule," and it's a documentation discipline applied consistently, not a code change. If a live failure of this ever shows up (a real dispatch caught leaking a claim), that's the trigger to revisit the hook-based enforcement idea with actual evidence instead of building it speculatively now.

### 5.2 `/sage-crit`

**Build first** — cheapest, reuses the most.

`commands/sage-crit.md`:
```yaml
---
name: sage-crit
description: Review an arbitrary diff, branch, or PR with no sprint required.
---
Invoke the `sage-crit` skill. Arguments: $ARGUMENTS
```

`skills/sage-crit/SKILL.md` — `sage-review`'s procedure (§steps 1–11 as documented above) with exactly one structural change: step 1's scope resolution accepts an explicit base ref/branch/PR argument instead of requiring an active sprint, and step 10's write target is `.sage/reviews/<date>-<slug>/review.{md,html}` instead of `<notebook>/sprints/NN/review.{md,html}`. Everything else — roster selection, dispatch, gate, dedup, red team, classification, the Recommendation-line requirement, the rung field from §4.1 — is inherited, not reimplemented. Cross-reference `sage-review/SKILL.md` for the full procedure rather than duplicating it (`lib/lint`'s `conduct-dupe`/`templated-duplicate` rules exist precisely to catch this kind of copy).

**Acceptance.** `/sage-crit <branch>` with no active sprint produces a review with the same gate/dedup/classification guarantees as `/sage-review`; `sage lint` passes with the new command-skill pair registered.

### 5.3 `/sage-fix`

Folds what was proposed as two commands (`/sage-fix` + `/sage-debug`) into one, phased.

`skills/sage-fix/SKILL.md`, four phases:

1. **Reproduce.** Refuses to theorize about root cause before a red-capable check exists — a failing test, a reproducible command, or a captured error. This *is* the entirety of what the separate `/sage-debug` command would have been; there was never a reason for it to have its own gate, ledger entry, and tier-3 scenario. `rules/sage-conduct.mdc`'s existing Evidence section ("no completion claim without a command run in the same message") already backs this.
2. **Root-cause.** Trace the failure to its actual origin — `systematic-debugging`'s Iron Law in substance, not superpowers' exact prose (`conduct-dupe` again).
3. **Minimal fix.** TDD discipline inherited from the existing `implementer-*.md` persona rule, applied inline rather than via a dispatched subagent (this is a single-session command, not a sprint node).
4. **Evidence.** Writes a `rung`-tagged finding/evidence record (§4.1, §4.2) to `.sage/evidence/session/` (see §5.6 for the sprint-less evidence-path change this needs). Refuses to report "done" without a `rung >= 4` record bound to the working-tree fingerprint.

**Acceptance.** A `/sage-fix` run on a real bug produces a fix, a passing verification command, and an evidence record with `rung >= 4`; a run that skips reproduction (phase 1) is refused by the skill's own procedure, not just documented as forbidden.

### 5.4 `/sage-look`

Deliberately the cheapest file in the new surface — if it grows past ~30 lines, something's wrong, because it's pure composition of two things that already exist.

`skills/sage-look/SKILL.md`: dispatch `librarian` (Lane A) with `sage recall`'s existing search plus read-only file access, answering "how does X work" / "why was it built this way." No writes, no evidence record, no gate. This is the command that gets used on an ordinary Tuesday, and its entire value is that it costs nothing to reach for.

**Acceptance.** `/sage-look "<question about the codebase>"` returns an answer with citations, touches no files, and completes without any gate or approval step.

### 5.5 `/sage-oh`

Kept deliberately small — closer to Matt Pocock's one-line `grill-me` (*"call the Skill tool with 'grilling'"*) than to gstack's 1,729-line `office-hours`.

`skills/sage-oh/SKILL.md`:

- **One question, two postures.** *"Is this something you're deciding whether to ship, or something you want to play with?"* — collapses gstack's six-option goal menu to the two that matter for a solo engineer's own tooling.
- **No new interrogation engine.** Points at `sage-shape`'s existing demand-test reference (`skills/sage-shape/references/`) for the questions to draw from; does not duplicate them.
- **Output:** `<notebook>/ideas/<slug>.md`, `kind: idea` in recall, carrying a required verdict — `build | build-smaller | don't-build | needs-evidence` — and a one-line Assignment (a concrete next action, never "go build it").
- **Handoffs.** `build` → `/sage-shape`. `build-smaller` → the interrogation continues with a narrower wedge. `don't-build` / `needs-evidence` → writes to `.sage/out-of-scope/` (§4.4) with the reasoning, so the rejection is durable and searchable rather than dying in a chat transcript.
- **Reuses:** `lib/recall` (prior ideas, learnings, the out-of-scope registry), `lib/consult` (a premise challenge on Lane B, with `extractModelReceipt` proving which model actually argued it — `lib/consult/index.ts:58`), `lib/redact` + `lib/egress` for any web research (generalized category terms only, never the idea's specifics, enforced via the existing redaction scanner rather than trusted to the model's compliance the way gstack's version is).

**Acceptance.** A run ending in `don't-build` writes a durable out-of-scope entry that a later `/sage-shape` run on the same concept surfaces before interrogation starts; a run's premise challenge carries a `verified: true` or `verified: false` model receipt, never neither.

### 5.6 `sage-retro`: grounding call + scope parameter

**Grounding.** Step 3 of `sage-retro/SKILL.md` calls `sage ground` (§4.6) on the drafted learning before it's written — the same mechanism, applied to the exact category of artifact it was designed to protect (a doc whose claims become "permanent, trusted knowledge" the moment it's written, per compound-engineering-plugin's own framing of why this matters).

**Scope parameter, replacing the separately-proposed `/sage-learn` command.** `sage-retro`'s current "Reads" section (`skills/sage-retro/SKILL.md:15-18`) is sprint-only — `.sage/sprints/NN/`'s ledger, board files, review residuals. Add a `scope: sprint | session` parameter: `sprint` (default) is today's unchanged behavior; `session` reads a rolling window of `.sage/findings/session/` and `.sage/evidence/session/` instead — which requires `/sage-crit` and `/sage-fix` to write there (§5.2, §5.3) rather than only into sprint-scoped paths. Same dedup, same grounding call, same learning template, same supersede-never-delete convention — one skill with a parameter, not a forked twin (the `conduct-dupe`/`templated-duplicate` reasoning applies here exactly as it does to `/sage-debug` and `/sage-look`).

This closes a real bug the two-spines sequencing otherwise has: its own Phase 4 (a week of Spine B use, before the first sprint) means the learning loop never fires in that window under the sprint-only reading — every Spine B input is a sprint artifact and there are no sprints yet.

**Acceptance.** `sage-retro --scope session` after a `/sage-fix` run produces a deduped, grounded learning with no sprint present; running it twice on the same problem updates the existing learning rather than duplicating it.

---

## 6. Spine A quality fixes — blocking-adjacent, cheap, zero new skills (~1 day)

### 6.1 Tracer-bullet discipline in `sage-dag`

D2 (`sage-dag/SKILL.md:87`, *"No two nodes that can run concurrently have intersecting `owns` globs"*) is currently the *only* mechanical check on decomposition, and it rewards horizontal slicing (one node per layer, disjoint globs) over vertical tracer bullets (one node per user-observable slice, which will almost always touch shared files) — the opposite of what `to-tickets`' own definition of a tracer bullet requires. Nothing in the D-invariants or `agents/architect.md` names verticality.

**Schema.** `dag.schema.json`, node object — add:
```json
"slice": { "enum": ["vertical", "prefactor", "refactor-batch"] }
```
required.

**D8 (gate-surfaced advisory, not a hard `Violation`** — "no user-observable outcome" isn't perfectly mechanically decidable): flag a `slice: vertical` node whose `owns` globs all share a single top-level path segment (e.g., all under `src/api/`) as likely mis-sliced, surfaced by name at the gate for the Architect/user to confirm or override — not rejected outright.

**D9 (gate-surfaced, fully mechanical — reuses existing code):** `lib/dag/index.ts` already has `globIntersect(a, b, treePaths?)` at line 331. Add a new function `crossWaveIntersections(dag, waves)` that runs `globIntersect` across every pair of nodes placed in *different* waves and reports any pair that would have intersected had they been concurrent — today that serialization decision is invisible; the gate should name it.

One paragraph in `agents/architect.md`: `depends_on` is a blocking edge; nodes are cut vertically by default, and `slice: prefactor`/`refactor-batch` are the sanctioned exceptions, not workarounds.

**Acceptance.** `sage dag validate` rejects a node missing `slice`. The gate summary names every D8 and D9 hit by node id. A fixture DAG with two vertical nodes forced into different waves by an `owns` collision reports the serialization explicitly.

### 6.2 `sage board render` — minimal commander console

The one item from decision-spine's "commander console" thread kept in blocking scope, deliberately the cheapest slice of it: a render, not a redesign of the review pipeline (§WP-25/26/27, all deferred until real review-cycle data exists to design against).

**New CLI verb**, `cmd === "board"`, `sub === "render"` in `lib/cli.ts` (alongside the existing `next`/`status`/`blocker` sub-verbs at lines 509–523) — `sage board render [--sprint NN]`, writing `<notebook>/sprints/NN/board.html` through the existing `lib/notebook` renderer (the same one `notebook render` already uses generically, per `lib/cli.ts:262-273`).

**Content, per wave, per node:** the owning agent's name (not just its `model` string — a small new lookup mapping node `role` to the matching `agents/*.md` display name), lane, status, attempts, `owns` globs, and the full `WtfBreakdown` (already exported at `lib/board/index.ts:371`) decomposed into its five components rather than collapsed into one integer — a revert and an out-of-lane touch mean different things about the sprint's state and today they're the same number. A `declared-vs-observed` model column: `declared: grok-4.5 · observed: —`, filled in only where §3.2's SPIKE-02 result establishes a receipt is actually obtainable; where it isn't, the board says so once at the top rather than implying a verified value it doesn't have.

**Acceptance.** `sage board render` produces HTML from a fixture ledger with every node's owning agent named by persona, not just by model string; the displayed WTF total equals the sum of its five displayed components.

---

## 7. Non-blocking, sequence after Phase 4 (~0.5–1 day, do when useful)

### 7.3 Cross-session review dedup, real code

`sage-review/SKILL.md:104` already states the rule correctly (a fingerprint the user previously marked `skipped` is suppressed only if the file hasn't changed since; `fixed` findings are never suppressed). `lib/review/index.ts` has no code for it — within-run dedup (fingerprint collapse, multi-specialist confirmation, the +1 confidence boost) is fully mechanical; cross-run state is not. Implement prior-run state under `.sage/sprints/NN/review-state.json`, keyed on fingerprint, storing the file's content hash at the time of a `skipped` disposition.

### 7.5 Doc drift + design-org placement — one pass, not deep engineering

Fix the specific stale claims already catalogued (ship-plan WP-12: `docs/research/scorecard.md`'s "Maturity: 1, zero lines of code" and "Cost control: 10" claims, `SPIKE-01.md`'s stale `sage-lane-after` registration claim, architecture-v3's stale command/agent/module counts). Separately, make one explicit decision on the six-command design org's placement (a phase inside Spine A, or its own plugin — decision-spine WP-34) and write it down; don't leave it the largest unowned surface in the repo by default. Neither of these is engineering — both are a focused afternoon.

---

## 8. Sequencing and estimate

```
Phase 0   Correctness                §2.1–§2.5                          ~1.5 days
Phase 1   Platform truth             §3.1, §3.2, §3.3 (decision)        ~0.5 day + decision
Phase 2   Verification infra         §4.1–§4.7, in this order:
                                      recall coverage → rung/grade →
                                      out-of-scope registry → sage ground
                                      → sage review doc                  ~1.5 days
Phase 3   Spine B core               §5.2–§5.4                          ~2 days
Phase 4   USE IT — one week          Definition-of-done #6, #7           calendar week, not effort
Phase 5   Spine B completion         §5.5 (/sage-oh), §5.6 (sage-retro)  ~0.5 day
Phase 6   Spine A quality            §6.1 (tracer-bullet), §6.2 (board)  ~1 day
Phase 7   Non-blocking cleanup       §7.3, §7.5                          ~0.5–1 day
Phase 8   The real sprint            §1 condition #8                     ~1 day
```

**Blocking total: ≈5.5 days.** **Recommended-but-sequenced-after: ≈2.5–3 days**, deliberately placed after Phase 4 reports back rather than before it.

**If only three things get built before anything else:** `§2.5`'s build-freshness gate (30 min — closes a live CI blind spot), `§4.5` `sage review doc` (4h — puts an adversarial reader on the eight documents that have decided everything built so far, none of which has ever been reviewed), `§4.6` `sage ground` (6h — the mechanism against the one failure mode this whole planning cycle has demonstrated, repeatedly, with numbers). Roughly one day, testable this afternoon, zero new commands, zero new skill files.

---

## 9. What was deliberately not written into this spec, and why that's the point

Four documents and roughly two days of research produced more good ideas than any solo engineer's tool should carry as live surface at once. The discipline this spec applies — modify before adding, cut anything without a downstream reader, defer anything without evidence yet — removed eleven proposed commands, one proposed architectural spine, and about half the proposed engineering days, without removing a single piece of the actual differentiating value: the evidence ladder, the grounding mechanism, the two Spine B commands that fix the tool's own self-diagnosed weakest score, and the one small command that gives it a way to say no.

The pattern worth naming plainly, one more time: this is the ninth design document in `docs/design/`, and its own existence is a small instance of the exact failure `sage ground` (§4.6) was built to catch — a claim about what's needed, compounding, unverified. The test that actually matters is not whether this document is thorough. It's whether `sage ground docs/design/ship-tech-spec.md`, run after this file lands in the repo, finds anything wrong with it. Run that before anything else in Phase 2 ships.
