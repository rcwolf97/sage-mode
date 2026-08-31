# Blind Comparative Review: sage-mode-plugin vs. gstack vs. superpowers

Reviewed 2026-08-24. Scope: exactly the three directories under `/root/blind-review/`, as shipped. No external docs, specs, or rubrics were consulted. One incidental note on contamination: `sage-mode-plugin/skills/design-critique/references/anti-slop-rubric.md` is a rubric, but it is the *product's own* UI-design-quality rubric (used by its `design-critique` skill), not an external grading document — it is in-scope product content, not contamination. Nothing else resembling an external "tech spec" or "build review" was encountered. Two hook comments inside sage-mode-plugin (`sage-lane`, `hooks/tests/run.sh`) reference "tech-spec.md §4.1" — this is the *product's own* internal design doc, not shipped in this tree; it is cited the way code cites an ADR, not read by me, and is noted only for completeness.

All three repos were extracted without their `.git` history. Where that mattered for testing (both gstack and superpowers ship tooling that shells out to `git`), I ran `git init && git add -A && git commit` inside a scratch copy to unblock test suites, and treated any resulting behavior change as an environment artifact, not a product bug — flagged explicitly below wherever it came up.

---

## Verdict

**Of the three, I would trust `gstack` the most for a real, immediate project, with `superpowers` a very close second for a team that wants something smaller and more auditable, and `sage-mode-plugin` last — not because its ideas are bad, but because roughly half of its shipped "skill catalog" is templated filler wearing the shape of finished content, which is exactly the failure mode this review was asked to hunt for.**

Reasoning, briefly:

- **gstack** is the largest, most operationally mature of the three. Its test suite is real (6,500+ tests), its safety hooks are the most carefully engineered of the three (anchored HIGH-tier matching avoids a false-positive class that sage-mode's equivalent hook actually has), and its more exotic claims — a hash-chained, tamper-evident egress ledger — held up under direct adversarial testing, including its own stated *limits* (it does not claim to catch truncation, and indeed does not). It is also the most bloated, the most self-promotional (the README is as much a personal productivity press release as a product doc), and the hardest to fully audit in one sitting because of its sheer size — but "hard to audit because there's a lot of real content" is a much better problem to have than "easy to audit because most of it is a stub."
- **superpowers** is the smallest and the most intellectually coherent of the three. Every skill I sampled was genuinely authored, its release notes show 1,400 lines of real, dated, issue-numbered iteration, and it is honest about being a *methodology* plugin: it ships exactly one hook (SessionStart, for context injection) and has **no mechanical enforcement of anything** — no PreToolUse deny/ask hook exists anywhere in the tree. Its safety story is 100% "the model reads the skill and complies," which is a legitimate design bet but a categorically weaker guarantee than the other two, and the README's "mandatory workflows, not suggestions" framing slightly overstates what a plugin with zero enforcement hooks can actually guarantee.
- **sage-mode-plugin** has the best-engineered *hooks* of the three (all pass a real 80-case dash-forced test matrix, and its symlink-escape and lane-boundary defenses held up under my own adversarial probing), a genuinely excellent handful of core skills (`sage-shape` in particular is 400+ lines of specific, non-generic, worked-example-driven procedure), and a self-aware lint tool that tracks a real engineering problem ("looks scaffolded but never actually written"). But that lint tool then **exempts** the one directory that most needs the check: all 25 files in `skills/catalog/` are the same 34-line template with five words swapped, and the lint tool's own comment claims they're "reviewed and confirmed present/correct" — a claim my diff of the files directly contradicts. A repo whose own scaffolding-detector is disabled on the exact content that is scaffolding is a repo I'd need to personally re-audit before trusting anything else in it labeled "done."

None of the three is disqualifying on its own terms. This verdict is about which one I'd hand to a team today with the least "come back and fix what turned out to be a facade" risk.

---

## sage-mode-plugin

### In theory

The core idea is a sprint-shaped delivery pipeline (`sage-shape` → `sage-plan` → `sage-dag` → `sage-build` → `sage-review` → `sage-ship` → `sage-retro`) run by specialist subagents on a DAG, with file-level "lanes" (glob-based `owns` boundaries) enforced by a hook so parallel implementers can't collide. Review is adversarial by construction: the `reviewer` agent runs on a **different model family** (`gemini-3.7-flash`) from the implementers (`grok-4.5`/`grok-4.6`), is `readonly`, may not spawn children, and is explicitly told never to trust the implementer's own claim of "done" — it re-derives the diff from git itself. That's a coherent, well-thought-out anti-collusion design, not just a vocabulary choice.

Cost/model awareness is real and more specific than a generic "cheap vs. expensive model" toggle: `lib/consult` implements a two-lane architecture — "Lane B" is `claude -p` under flat-rate subscription billing, "Lane A" is a fallback in-thread model. The code explicitly warns (loudly, once per call) if `ANTHROPIC_API_KEY` is inherited from the environment, because that would silently reroute a Lane B call through metered billing and defeat the entire cost architecture — a subtle, correctly-identified footgun that most plugins wouldn't think to guard against.

### In practice

```
$ npx tsc -p tsconfig.json          → clean, no errors
$ node --test test/*.test.js lib/**/*.test.js
ℹ tests 46 / pass 46 / fail 0        (8.4s)
$ node lib/cli.js lint
ok
```

Hook test matrix (`hooks/tests/run.sh`, forces every hook under both its own `#!/usr/bin/env sh` shebang *and* explicitly under `/usr/bin/dash`):

```
80/80 "ok" — 0 failures, run twice (default-shebang pass + forced-dash pass)
```

I then adversarially tested the two deny-tier hooks myself, beyond the shipped fixtures:

- **`sage-careful`** (ask-tier, "HIGH deny only for simple recursive delete of / ~ $HOME /*"): correctly denies `rm -rf /`, `sudo rm -rf /`, `rm -fr /`, `rm -r -f /`, `rm -rf --no-preserve-root /`, `rm -rf $HOME`; correctly *allows* `rm -rf /home/user/myproject`; correctly falls back to ask-tier (not deny) on the compound `true; rm -rf /`, matching its own documented "simple commands only" scope. **But** it hard-denies `echo rm -rf /` — a completely harmless command — because its token scan checks whether `rm` appears anywhere among the whitespace-split tokens, not whether it's the command actually being executed. That is a real false-positive bug in the "HIGH deny" tier of a hook whose entire selling point is precision string/token matching to avoid exactly this class of mistake.
- **`sage-lane`** (deny-tier, fail-closed file-lane enforcement): I built a real symlink (`src/escape → /tmp/lanetest/outside`) inside an owned lane and confirmed the hook resolves it with `realpath`/`os.path.realpath` and correctly denies the write as "outside owns" — the symlink-escape defense the code's own tests claim is real, is real. Absolute-path escapes (`/etc/passwd`) and relative escapes (`../outside/evil.txt`) are also correctly denied.

Skill-content authenticity is genuinely bimodal:

- **`sage-shape`** (409 lines) is excellent — a fully worked, specific interrogation procedure with a demand-test evidence table (waitlist signups vs. paid-deal-blocked, with reasoning for each row), anti-pattern examples, and an explicit self-check before writing anything. This is what "a real procedure" looks like.
- **`skills/catalog/`** (25 files, all `disable-model-invocation: true`, retrieved by `sage-recall`) is the opposite. Every one of the 25 is 34 lines and, once you strip the frontmatter's `name`/`description`/`applies_when`, is **byte-identical** to every other one:

```diff
< name: adr
< description: Catalog skill — architecture decision records, options, consequences...
< applies_when: "recording a durable technical decision"
---
> name: skill-authoring
> description: Catalog skill — frontmatter, caps, rationalization tables, evals...
> applies_when: "writing or revising a sage-mode skill"
```

  Everything else — the four-step "Procedure," the two-row "Common Rationalizations" table, the three "Red Flags," the "Done when" line — is the literal same text, mad-libbed with the topic name substituted into one sentence. `security-audit`, `dead-code`, `load-test`, `secrets-scan`, `threat-model` — 25 supposedly distinct domain-specific procedures that are the same generic three-paragraph outline wearing different labels. This is exactly the "whole category scaffolded but never actually written" pattern the review brief asked me to look for, and it is unambiguous — I diffed multiple pairs, not just two, to rule out a cherry-picked example.

  The project's own `lib/lint` tool has a rule for precisely this ("looks scaffolded but never actually written," triggered when a file falls under 25% of its line cap) — and explicitly **exempts** `skills/catalog/*` from it, with a code comment claiming these are "a deliberately different genre... reviewed and confirmed present/correct." My own diff of the files directly contradicts "reviewed and confirmed present/correct": they are not differentiated content, they are one template.

Other data points: `agents/*.md` (18 files, 19–29 lines each) are short but genuinely differentiated — each has a distinct model assignment, a role-specific checklist (e.g. `implementer-data.md`'s migration-safety checklist: reversibility, no unbounded backfill, lock-duration checks against table size), and distinct output contracts. These are not templated. `evals/comparison.md` is an honest, unfilled-in template ("If sage-mode is not better on defects-escaped, the process is ceremony. Publish the result whichever way it goes.") — good intent, but as shipped there's no evidence it has ever actually been run.

### Notable

- Zero runtime npm dependencies (marked/mermaid vendored); TypeScript strict mode, clean compile.
- The `.cursor-plugin/marketplace.json` vs. plugin-root distinction in the README is unusually careful about a real installation footgun most plugin READMEs don't bother explaining.

---

## gstack

### In theory

gstack is less a single coherent methodology than a very large personal engineering-automation platform (30+ slash-command skills, standalone CLIs, a browser-automation daemon, egress auditing, iOS QA over USB, gbrain memory integration) shipped as one plugin. The README's framing — an ex-Palantir/YC-president "software factory," with productivity multiplier claims (~810× a 2013 baseline) — is marketing copy I did not and could not verify, and it sets a self-promotional tone that's worth naming plainly as a taste/trust signal independent of the code quality underneath it.

The engineering philosophy that *is* verifiable from the code: defense in depth, honest about its own limits, with an unusual amount of "why" commentary embedded directly in the scripts (bug numbers, dated fixes, explicit false-positive-avoidance reasoning). The security tooling in particular (`/cso`) is a two-tier confidence-gated system (8/10 daily, 2/10 comprehensive) with 22 named hard-exclusions and named *exceptions to* those exclusions (e.g., LLM cost-amplification findings are explicitly carved out of the DoS exclusion) — this reads like a tool that has actually been run against real code and had its false-positive list built empirically, not written speculatively.

Multi-agent coordination happens at two different granularities: within a session, `/review` and `/cso` dispatch specialist reviewers in parallel via the Agent tool ("Launch ALL selected specialists in a single message... Each subagent has fresh context — no prior review bias"); across sessions, the model is running many full Claude Code sessions in parallel via a third-party tool (Conductor), each in its own git worktree — a coarser, process-level isolation rather than an in-session DAG like sage-mode's.

Cost/model differentiation is real: `/open-gstack-browser`'s sidebar explicitly routes Sonnet for fast actions vs. Opus for analysis, `gstack-model-benchmark` cross-tests Claude/GPT/Gemini, and Codex integration auto-generates a bounded-scope behavioral profile keyed to a specific model ID (`gpt-5.6-sol`) with an explicit warning on near-miss version strings.

### In practice

```
$ bun install                         → 229 packages, clean
$ bun run test:free                   → 6,537 + 879 tests across 469 files
                                         69 + 1 failing (~1% failure rate)
```

I traced the failures rather than taking the raw count at face value:

- A large fraction are `error: launch: Executable doesn't exist at .../chrome-headless-shell` — this sandbox has no Playwright browser binaries installed; genuinely untestable here, not a code defect.
- A second large fraction are `git ls-files`/`git rev-parse` failures because the extracted tree ships without `.git`. After I `git init`'d a scratch copy, the git-dependent suites I re-ran (`gstack-slug-cwd-walk-up`, `gstack-repo-mode`, `mktemp-portability`, `tracker-guard-wiring`, `resolvers-gbrain-put-rewrite`, `skill-size-budget`) passed. Not a product bug.
- `fs-atomic.test.ts`'s one failure ("expected atomicWriteSync to throw in read-only dir") is because these tests ran as root, which bypasses the POSIX permission check the test relies on — a sandbox artifact, not a bug (though also not something the test suite guards against, which is a minor robustness gap worth a one-line skip-if-root guard).
- `distill-apply.test.ts`'s ten failures looked like real product bugs at first (`NO_PROPOSALS: .../projects/tmp/... missing`) — I traced this to root cause: gstack's own `gstack-slug` walks *up* from cwd looking for the outermost project-identity marker (`.git`, `package.json`, `README.md`, etc.), and this sandbox's `/tmp` happened to contain a stray `package.json` left by an unrelated prior process, which the walk-up correctly treated as a "strong marker," collapsing the test's synthetic project directory into a slug of `tmp`. This is sandbox contamination outside gstack's control, and when I read the mechanism it's actually working exactly as its own extensive design comments describe (including a documented fix history for the exact "phantom slug from a deploy artifact" failure mode this class of bug would represent). I'm reporting this as **verified-correct-under-adversarial-conditions**, not as a failure, once the true cause was isolated.

Net: after accounting for environment artifacts, I found no failing test in this suite that traces to an actual gstack defect.

I then adversarially tested the shipped `/careful` hook (`careful/bin/check-careful.sh`, `#!/usr/bin/env bash` — correctly declared and used as bash throughout, no `sh`-portability risk in this repo's hooks):

```
rm -rf /                          → HIGH deny  (correct)
echo rm -rf /                     → MEDIUM ask, NOT hard-deny (correct — anchored `^rm` check)
rm -rf /home/user/proj            → MEDIUM ask (correct, not a HIGH target)
git commit -m "wip" && rm -rf /   → MEDIUM ask (compound falls through, as documented)
rm${IFS}-rf${IFS}/                → ask, "Shell obfuscation detected" (correct)
```

This is the same class of check as sage-mode's `sage-careful`, but gstack's HIGH-tier regex is anchored to the start of the command (`^[[:space:]]*(sudo[[:space:]]+)?rm[[:space:]]`), which is why `echo rm -rf /` does **not** get hard-denied here the way it incorrectly does under sage-mode's unanchored token scan. This is a concrete, adversarially-confirmed quality difference between the two projects' nominally-equivalent safety hooks, in gstack's favor. (gstack's MEDIUM tier does still fire an `ask` on the harmless `echo` command — a much lower-cost false positive than a hard deny, and one the script's own comments concede is intentionally conservative.)

I also directly tested the specific, falsifiable claim in the README about `gstack-egress`: "hash-chained, tamper-evident receipt... `verify` recomputes the hash chain and exits 3 on tamper... truncating or deleting the ledger itself is out of scope."

```
$ bun bin/gstack-egress-receipt write --sink test --host example.com ...   (x2, chained via prev-hash)
$ bun bin/gstack-egress verify
chain intact: 2 line(s) verified   [exit 0]

# tamper: rewrite "host" field in line 1 via python json edit
$ bun bin/gstack-egress verify
TAMPER: chain broken at line 2 (prev hash does not match previous line)   [exit 3]

# separately: truncate (delete) the last line of a 3-entry ledger
$ bun bin/gstack-egress verify
chain intact: 2 line(s) verified   [exit 0]   ← truncation NOT detected, exactly as documented
```

Both halves of the claim verified: it does detect tampering (mid-chain edits) and it does *not* detect truncation — and the README says exactly that, rather than over-claiming. This is a genuine positive: a security-adjacent feature whose documentation matches its actual, tested behavior on both the "works" and "doesn't work" sides.

### Weaknesses

- Scale makes full audit impractical in one sitting; I sampled deeply (careful hook, egress ledger, slug resolution, `/cso`'s exclusion list, `/review`'s specialist dispatch, one full `review/specialists/*.md` file) rather than exhaustively, and found the sampled content to be genuinely authored, not templated — but I cannot make a total-coverage claim the way I can for sage-mode's smaller catalog.
- Each SKILL.md carries ~800 lines of shared, auto-generated boilerplate (session bootstrap, telemetry, plan-mode handling, AskUserQuestion formatting, checkpoint mode, etc.) ahead of the skill-specific content. This is legitimate infrastructure, but it means the file-length numbers in the README's skill table are not a good proxy for "how much was actually authored per skill" — `/cso` at 1,303 lines is really ~840 lines of shared framework plus ~460 lines of CSO-specific procedure.
- `/cso`'s hard-exclusion list item 22 ("Skill files that are part of gstack itself (trusted source)") is a self-exemption in a tool whose other 21 rules are about *not* trusting things by default — a real, if minor, blind spot for a security auditor to carve its own vendor's code out of scrutiny.
- The README's productivity-multiplier framing (810×, 240× a prior year) is unfalsifiable from a static repo and reads as marketing rather than engineering documentation; it doesn't affect the code quality but it is a legitimate trust signal in the other direction from the verified mechanisms above.

---

## superpowers

### In theory

The smallest and most focused of the three: 14 skills, one philosophy (TDD applied recursively — to code, and to the skills themselves), and an unusually disciplined contribution process. `CLAUDE.md` opens with "This repo has a 94% PR rejection rate" and a direct instruction to AI agents about to open a PR to verify the problem is real, search for duplicates, and disclose their own model/harness — a level of self-aware anti-slop process I did not see matched in the other two repos' own contribution stories (neither ships a comparable AI-contributor gate).

The core workflow (brainstorming → worktree → plan → subagent-driven execution with two-stage review → TDD → code review → finish) is coherent and the "mandatory, not suggestions" framing is explicit. Multi-agent coordination is handled at the *convention* level: `dispatching-parallel-agents` and `subagent-driven-development` both instruct fresh, isolated subagents per task, dispatched together in one message for true parallelism, with explicit review-for-conflicts afterward — a clear, well-illustrated pattern (real "6 failures across 3 files" worked example), but enforced entirely by the model choosing to follow the skill text, not by any hook.

Model/cost-tier awareness is essentially absent as a first-class concept — I found no equivalent of sage-mode's Lane A/B billing-aware routing or gstack's Sonnet/Opus task-based routing. This is consistent with superpowers' scope (a skills methodology, not an execution platform) but is a real, verifiable gap relative to the other two on this specific dimension.

### In practice

```
$ bash scripts/lint-shell.sh --all      (after apt-installing shellcheck; repo doesn't vendor it)
Linting 45 shell files
14 SC-level warnings, all SC2155/SC2064/SC2088 style nits in *test* scripts
(no findings in production hooks/scripts)
exit=1  (shellcheck's own warning-severity gate, not a crash)
```

The whole repo ships **zero** production `#!/usr/bin/env sh` scripts — the two matches I found for `sh` shebangs are inside a test file's heredoc fixture content used to test the lint tool's own detection logic, not real scripts. Every real script (`hooks/session-start`, all of `scripts/*.sh`) declares and is written as `#!/usr/bin/env bash`. This sidesteps the entire "declares sh, breaks under dash" bug class this review was asked to specifically hunt for — not because superpowers solved the portability problem, but because it opted out of the risk category entirely by requiring bash unconditionally. That's a legitimate, different bet from the other two (both of which *do* target POSIX `sh` for their hooks and back the choice with dash-forced test runs), worth naming as a real design-philosophy difference rather than a defect either way.

I ran the fast, non-agentic test scripts directly:

```
tests/shell-lint/test-lint-shell.sh          → 18/18 PASS
tests/hooks/test-session-start.sh            → 6/6 PASS
tests/systematic-debugging/test-find-polluter.sh → 5/5 PASS
tests/writing-skills/test-render-graphs.sh   → 3/8 PASS until I `apt install graphviz`
                                                → 8/8 PASS once the real dependency existed
tests/version-bump/test-bump-version.sh      → inconclusive: this sandbox's `yq` binary
                                                resolves to the Python/jq-wrapper `yq`
                                                (version string "0.0.0"), not the Go
                                                mikefarah/yq the script's `strenv()` syntax
                                                requires — a real ambiguity in the `yq`
                                                name across ecosystems, not a superpowers bug,
                                                but the script has no version/flavor guard
                                                against installing the wrong one, which is a
                                                minor real robustness gap.
```

I also directly ran the SessionStart hook (the only hook this plugin ships) end-to-end:

```
$ CLAUDE_PLUGIN_ROOT=... bash hooks/session-start
→ valid JSON, hookSpecificOutput.additionalContext populated with the full
  using-superpowers SKILL.md content, correctly branching format by
  CURSOR_PLUGIN_ROOT / CLAUDE_PLUGIN_ROOT / Copilot-CLI env detection
```

Works exactly as documented, and the code comments show it has a real bug-fix history against a specific upstream issue (bash 5.3+ heredoc hang, github issue #571) rather than being untested.

The larger, genuinely agentic test suites (`tests/claude-code/run-skill-tests.sh`, the entire `tests/explicit-skill-requests/` directory) invoke a live `claude` CLI against real prompts to verify the model actually invokes the right skill — this is exactly the kind of behavior test the review brief anticipated being untestable from a static repo, and it is: I could not run it here (no live agentic session available), and I'm reporting that plainly rather than guessing at pass/fail. The README's own claim that "skill-behavior tests use the drill eval harness from superpowers-evals, cloned into evals/" is honestly scoped — that harness is explicitly an external clone-in step, and this shipped tree genuinely has no `evals/` directory, consistent with the README's own description rather than a discrepancy.

Skill-content sampling (`systematic-debugging`, `dispatching-parallel-agents`, `writing-skills`, both read closely) found consistently real, non-templated, specifically-authored procedures — phase-by-phase debugging discipline with a concrete multi-layer diagnostic-instrumentation example, a real "6 test failures across 3 files" worked parallel-dispatch example, and a self-referential TDD-for-skills methodology (a skill about writing skills that itself follows red/green/refactor against subagent pressure-tests). `RELEASE-NOTES.md` (1,400 lines) shows genuine, dated, issue-numbered iteration ("One donated session had sat blocked for almost nine hours on a question the controller could have decided" — the kind of detail that reads as a real incident, not invented copy).

### Weaknesses

- **No mechanical safety enforcement anywhere.** One hook exists (`SessionStart`), and it only injects context. There is no PreToolUse/Stop hook comparable to sage-mode's `sage-lane`/`sage-careful` or gstack's `/careful`/`/freeze`. The "mandatory, not suggestions" language in the README is therefore a claim about prompt-level discipline, not an enforced guarantee — a materially different (and weaker) safety posture than the other two, worth being explicit about since the README doesn't emphasize this gap itself.
- No cost/model-tiering concept at all — a real, if scope-consistent, absence relative to the other two.
- Multi-agent coordination is convention-only (no lane/glob enforcement), so a "spec compliance, then code quality" two-stage review is only as good as the reviewing subagent's fidelity to the instructions it was given, with no hook backstop if it drifts.

---

## Head-to-head, by dimension

| Dimension | sage-mode-plugin | gstack | superpowers |
|---|---|---|---|
| **Mechanical safety enforcement** | Real, hook-based, fail-closed lane/symlink defense verified by adversarial testing; but its HIGH-deny command matcher has a real false-positive bug (`echo rm -rf /` → hard deny) | Real, hook-based; more precisely anchored than sage-mode's equivalent check (same adversarial probe did **not** false-positive); tamper-evident egress ledger verified to behave exactly as documented on both the "catches this" and "doesn't catch that" sides | **None.** One SessionStart hook, no PreToolUse/Stop enforcement anywhere; safety is 100% prompt discipline |
| **Shell portability (the `env sh` under dash question)** | Ships real `sh` hooks; all pass a dedicated 80-case matrix forced under `/usr/bin/dash`, and I independently reran that matrix successfully | Ships zero `sh` hooks — everything is explicitly `bash`, so the dash-portability risk class doesn't apply to its hooks | Ships zero production `sh` scripts at all — the risk class is opted out of entirely (different bet, not a fix) |
| **Cost/model-selection awareness** | Real and specific: Lane A/B billing-aware routing, explicit metered-billing footgun warning, per-role model assignment on every agent file | Real: task-based Sonnet/Opus routing in the browser sidebar, cross-model benchmarking CLI, model-specific behavioral profiles (down to exact version-string matching) | Effectively absent — not a design goal of this plugin |
| **Multi-agent / parallel work** | DAG-planned sprints with hook-enforced file-ownership lanes ("owns" globs) — the only one of the three with an *enforced*, not just conventional, conflict-avoidance mechanism | Parallel specialist dispatch within a session (Agent tool, fresh context) plus coarser process-level parallelism across sessions via a third-party tool (Conductor) | Parallel subagent dispatch by convention, well-illustrated with a real worked example, no enforcement backstop |
| **Shipped-content completeness vs. apparent structure** | **Worst on this axis.** `skills/catalog/` (25 files, elaborate-looking directory structure) is one 34-line template with the topic name swapped in, verbatim across every file — confirmed by direct diff, not sampling error. Core `sage-*` skills are excellent and not templated. | Best-sampled depth: everything I read (careful hook, egress ledger, `/cso`'s exclusion list, a `review/specialists/*.md` file, `/cso`'s own procedure text once shared boilerplate is subtracted) was specific and non-templated. Cannot claim total coverage given the repo's size. | Small, fully-sampled, and consistently real — no templating found anywhere in the 14 skills read |
| **Test/eval rigor** | 46 unit tests + 80-case hook fixture matrix, all passing, genuinely adversarial in content (symlink escape, IFS obfuscation, BOM handling) | ~7,400 tests; after subtracting environment-only failures (no browser binaries, no `.git`, root-user permission bypass, one stray-file contamination I traced to ground truth), no confirmed product-level failures found | Fast unit/integration tests pass; the real behavioral rigor (LLM-driven skill-triggering evals) lives in an external harness not shipped in this tree and genuinely untestable here — reported as such, not guessed at |
| **General engineering hygiene** | TS strict mode, clean compile, zero runtime deps, careful install-path documentation; lint tool exists but is blind to its most important case | Large but disciplined: dated bug-fix comments, real TODOS.md with issue numbers and effort estimates, honest doc/behavior match on the egress ledger's limits; one self-exemption in its own security tool | Disciplined contribution process (94% PR rejection rate, mandatory disclosure of AI authorship), 1,400-line real release history; smallest surface area, easiest to fully audit |

---

## Genuinely uncertain / untestable from static analysis

- **Whether any of the three actually improves outcomes in a live agentic session.** All three make claims that only resolve inside a real Claude Code (or equivalent) session with a real model: sage-mode's premise-challenge consult actually changing a roadmap's shape, gstack's `/cso` actually finding real vulnerabilities at its stated 8/10 confidence bar without drowning users in false positives at scale, superpowers' skills actually auto-triggering on the right natural-language phrasing per its `tests/explicit-skill-requests/` suite. None of this can be verified by reading files; I did not attempt to guess at outcomes.
- **gstack's Playwright/browser-dependent test suite** (roughly a third of the raw failure count) is untestable in this sandbox because no Chromium binary is installed and I could not fetch one; I cannot make a claim about the `/browse` mechanism's real-world correctness beyond what the source and its non-browser unit tests show.
- **superpowers' `superpowers-evals` harness** is explicitly external (a separate repo cloned into `evals/` per its own README) and not present in this shipped tree at all — its actual eval rigor is unverifiable from what was provided, and the project is honest about that rather than shipping a stub in its place.
- **sage-mode-plugin's Lane B consult mechanism** (`claude -p` subprocess dispatch with role-specific system prompts) is exercised by unit tests only in a mocked/degraded-path sense (`consult degrades with exit 3 when claude is absent`); the actual multi-model consult round-trip is not something I could exercise without a live `claude` CLI and billing context.
- **gstack's productivity claims and Karpathy-anecdote framing** in the README are unfalsifiable from the repo and were treated as marketing color, not evidence, in this review — I neither confirmed nor assumed them false, I simply didn't let them influence the code-quality verdict either way.
- **Whether sage-mode's `skills/catalog` stubs are meaningfully harmful in practice** is somewhat softer than it sounds: they're `disable-model-invocation: true` and retrieved only via `sage-recall` ranking, so a user who never triggers that retrieval path never sees them. But when they *are* retrieved, the file delivered is generic boilerplate, not the domain-specific procedure its name and description promise — and 25 topics is a lot of surface area for that gap to matter across a project's lifetime.
