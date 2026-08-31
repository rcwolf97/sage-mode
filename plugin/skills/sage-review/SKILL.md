---
name: sage-review
description: Adversarial review. Lane C, readonly, ARTIFACT+CONTRACT only. Confidence gate is mechanical.
disable-model-invocation: true
---

# sage-review

Models a second, adversarial engineer who was not in the room when the code was
written: Reviewer and Red Team subagents, Lane C (`gemini-3.7-flash`),
`readonly: true`. Cheap and disposable is correct here — review is judgment,
not production code, and a wrong verdict costs a re-run, not a bad deploy.

**Reads:** the diff (committed + working-tree + untracked, per `sage review
scope`), the node's acceptance criteria. **Writes:** `findings.jsonl`,
`<notebook>/sprints/NN/review.{md,html}` (`<notebook>` is the configured
notebook root — `docs/` by default; see `rules/sage-conduct.mdc`).
**Runs:** Reviewer + Red Team, Lane C, non-Anthropic model.

**Conduct.** Assumes `rules/sage-conduct.mdc` is loaded. Cursor applies it
automatically; on a host without an always-applied rules mechanism (Claude
Code), the operator must get its content into the session some other way
(e.g. folded into the project's `CLAUDE.md`) before running this skill.

## Procedure

1. **Scope.** `sage review scope --base <ref>` → `SCOPE_*` booleans and
   `DIFF_LINES`. The changed set is the union of the committed diff, the
   working-tree diff, and untracked files — deliberately not `git diff
   base...HEAD` — so in-progress work still selects the right specialists.
   **Exit 2 surfaces to the user, always.** `SCOPE_ERROR=no_base` when the
   base ref won't resolve; `SCOPE_ERROR=unmatched` when files changed but no
   category matched. A silent "no reviewers needed" is forbidden — a
   classifier bug must look like a classifier bug, not a clean bill of health.

2. **Select the roster.** `sage review select --scope <json> --stats <file>`.

   | Specialist | Dispatched when |
   |---|---|
   | correctness | always, `DIFF_LINES` ≥ 30 |
   | testing | always, `DIFF_LINES` ≥ 30 |
   | maintainability | ≥ 200 lines, or new abstractions introduced |
   | security | `SCOPE_AUTH`, or `SCOPE_BACKEND` and > 100 lines |
   | data-migration | `SCOPE_MIGRATIONS` |
   | api-contract | `SCOPE_API` |
   | performance | `SCOPE_BACKEND` or `SCOPE_FRONTEND` |
   | design | `SCOPE_FRONTEND` and the node has `design: required` |
   | prompt-eval | `SCOPE_AI` (prompts, evals, skill files) |

   `select` also drops any specialist with zero findings across 10+ dispatches
   read from `.sage/specialist-stats.json` — except `security` and
   `data-migration`, which never gate out; a 0%-hit-rate security specialist
   is insurance, not waste. Take the roster as returned. If a diff genuinely
   feels under-covered, that is a deliberate `--all-specialists` override, not
   a quiet decision to add extra specialists "to be safe" — the stats exist so
   review cost tracks real hit rate, and padding the roster defeats them.

3. **Dispatch the wave, in one message.** One Task call per selected
   specialist, all in the same assistant turn, so Cursor parallelizes them.
   Pass the base ref and the checklist **path** — `skills/sage-review/
   references/checklists/<specialist>.md`, one file per roster name, e.g.
   `references/checklists/security.md` for the `security` dispatch — never
   its contents; the specialist re-derives its own diff via `git merge-base
   <base> HEAD` then `git diff`, which is a cheaper prompt and works because
   each subagent has repo access. Set `is_background: false` explicitly on
   every dispatch — don't rely on the default.

   **The dispatch prompt itself carries exactly three things: the base ref,
   the checklist path, and the node's acceptance criteria.** Nothing else.
   This is the same guarantee as step 4 below, moved one level up: a real
   run was observed where a controller didn't hand over the implementer's
   report, but wrote "focus on auth, the styling is intentional" straight
   into the dispatch prompt — steering the reviewer away from a finding
   class before it ever looked, without ever handing over the report step 4
   forbids. Withholding the report while coaching the reviewer around it in
   the prompt is the same failure relocated, not a smaller version of it.
   Banned outright, with no size exception: telling a specialist which
   finding classes to skip, and pre-rating a finding's severity before it's
   found ("call anything here Minor at most"). A defect the plan or spec
   itself mandates is **reported for the user to decide on** — never quietly
   waved through because the controller believes it was intentional; "the
   plan says so" is not the reviewer's call to make, it's a finding with
   context, same as any other.

4. **Withhold the claim.** The reviewer receives ARTIFACT (the diff) and
   CONTRACT (the node's acceptance criteria) only — **never** the
   implementer's `reports/<id>.md`. The reasoning is the whole point of
   running review at all: if you hand over conclusions, you get back
   validation of conclusions. A reviewer told "I implemented rate limiting
   correctly, please confirm" produces a different, worse review than one
   handed the diff cold.

5. **Collect, gate, dedup.** Concatenate every specialist's JSONL →
   `sage review gate` → `sage review dedup`.
   - **Gate is mechanical.** Any finding whose `evidence` field is absent or
     empty has `confidence` rewritten to `min(confidence, 5)` — regardless of
     what the specialist claimed. A finding cannot argue its way to a 9
     without quoting the line that motivates it.
   - **Dedup groups by fingerprint** (`{path}:{line}:{category}`, or
     `{path}:{category}` without a line) — loose enough that a reworded
     duplicate still collapses. Keep the highest confidence, tag
     `MULTI-SPECIALIST CONFIRMED (a + b)`, boost confidence **+1, capped at
     10** — two independent contexts finding the same thing is itself
     evidence. Cross-run: a fingerprint the user previously marked `skipped`
     is suppressed only if the file hasn't changed since; `fixed` findings are
     never suppressed, because fixes regress.
   - See `references/dedup-walkthrough.md` (trigger: two findings look like
     the same issue and it's unclear whether they should have merged, or a
     third review cycle is producing findings that look identical to cycle 1)
     for a worked fingerprint merge and a worked non-convergence report.

6. **Red team, second wave, sequential.** Dispatch only if `DIFF_LINES > 200`
   or any `CRITICAL` survived gate + dedup. It is handed the merged findings
   with the framing "find what they missed," plus the same ARTIFACT +
   CONTRACT the first wave got — never the implementer's report. It runs
   after the parallel wave finishes, not inside it.

7. **Classify every finding: AUTO-FIX, ASK, or cannot-verify.** Rule of thumb
   — mechanical and uncontroversial → AUTO-FIX; reasonable engineers could
   disagree → ASK. `CRITICAL` defaults toward ASK; `MEDIUM`/`NITPICK` default
   toward AUTO-FIX. **Override:** any finding carrying a `test_stub` becomes
   ASK regardless of severity, and the user approves the test before it's
   added. The full category table is in `references/classification.md`
   (trigger: classifying findings in this step, or a finding's category isn't
   obviously mechanical or obviously judgment) — don't guess at the boundary
   from the rule of thumb alone when a table entry exists.

   A specialist forced to a binary AUTO-FIX/ASK judgment on a requirement the
   diff doesn't actually touch has exactly two bad options: invent a finding
   for code it never saw, or wave the requirement through as satisfied
   because nothing in the diff contradicts it. `cannot_verify: true` is the
   honest third option — when the acceptance criterion is real but the code
   that would prove or disprove it lives outside the diff (a config value
   read elsewhere, a caller this change doesn't touch, an invariant enforced
   in a file that wasn't part of the change), emit the finding with
   `cannot_verify` set rather than either failure mode. It always routes to
   ASK — `classifyFix` in `lib/review/index.ts` checks it before severity —
   and it is exempt from the evidence confidence cap in step 5, because the
   entire point is that the evidence isn't in the diff to quote.

8. **Apply, then batch.** Apply every AUTO-FIX finding. Collect every ASK
   finding into **one** decision call — never one interruption per finding.
   Use the decision-brief shape from `rules/sage-conduct.mdc` (not restated
   here).

9. **Loop, bounded at 3.** Commit the fixes, re-run the relevant verify
   command, re-review the new diff — inside the same invocation. If cycle 3
   still applies an AUTO-FIX item or surfaces a new ASK finding, **stop** and
   report which findings keep reappearing. A review that will not converge is
   a genuine blocker worth human eyes, not a request to run it again.

10. **Write and render.** `<notebook>/sprints/NN/review.md`, with confidence
    bands: ≥7 shown normally · 5–6 with the caveat "Medium confidence — verify
    this is actually an issue" · 3–4 appendix only · 1–2 suppressed. A finding
    carrying `cannot_verify: true` skips the confidence bands entirely — it
    isn't low-confidence, it's unjudgeable from the diff — and goes in its own
    **"Cannot verify — check by hand"** section instead, one line per finding
    naming the requirement and where the code that would prove or disprove it
    actually lives. `classifyFinding` in `lib/review/index.ts` routes it there
    unconditionally, checked before confidence. Render to HTML.

11. **Write the Recommendation line.** Every review ends with a mandatory
    `## Recommendation` section: `<action> because <path:line — the specific
    finding>`. Derive it from the merged findings **after gate and dedup have
    run**, never before — a finding still carrying its specialist's raw
    confidence hasn't yet been checked for evidence, and one that gate
    capped to 5 for missing evidence, or that dedup left as a lone
    unconfirmed claim, must not become the headline the human reads first.
    Pick the single highest-confidence finding that survived gate + dedup
    (ties broken toward `CRITICAL` severity) and write the recommendation
    around it, citing its `path:line` directly. Before writing, run
    `sage review recommendation --file <rendered-review.md> --json` — it
    verifies the section exists, is non-empty, cites a real `path:line`, and
    isn't pure generic hedging (see `GENERIC_RECOMMENDATION_PHRASES` in
    `lib/review/index.ts`) with nothing specific behind it. That command is
    the only path to `checkRecommendation`; there is no other way to run it.
    A non-zero exit or `"ok": false` means write it again, not ship it
    anyway.

## Non-interactive

Step 8's decision call has no one to answer it. Apply every AUTO-FIX finding
as usual, then write every ASK finding — `cannot_verify` ones included — into
`review.md` as unresolved instead of batching a call for them, and stop
without looping further. Terminal line: `Review complete: N AUTO-FIX applied,
M ASK unresolved in review.md` on a clean run, or `Review skipped: <reason>`
(e.g. `SCOPE_ERROR=unmatched`) when scope never resolved.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll include the implementer's report for context" | Hand over conclusions, get back validation of conclusions. ARTIFACT + CONTRACT only. |
| "I'll tell the specialist to focus on auth, the styling is intentional" | The dispatch prompt carries only the base ref, checklist path, and acceptance criteria — steering it around a finding class in the prompt is the withheld-report failure relocated, not avoided. |
| "This is obviously fine, I'll just note it as Minor in the dispatch so the reviewer doesn't waste time" | Pre-rating severity before a specialist has looked is banned outright, same as suppressing a finding class — the specialist rates what it finds, not what the dispatch told it to expect. |
| "The plan explicitly asked for this, so it's not really a defect" | A defect the plan mandates is still reported, for the user to decide on — the reviewer doesn't get to wave it through because the controller believes it was intentional. |
| "I'll invent a plausible finding for this acceptance criterion since the diff doesn't show it" | That's the failure `cannot_verify` exists to replace — emit the finding as `cannot_verify: true` naming what's unjudgeable, don't guess at a verdict the diff can't support. |
| "Nothing in the diff contradicts this criterion, so it passes" | Absence of contradiction isn't evidence of correctness. If the diff doesn't touch the code that would prove it, that's `cannot_verify`, not a pass. |
| "No matching scope category means nothing to review" | Files changed with no category match is `SCOPE_ERROR=unmatched`, exit 2 — a bug report, not a skip. |
| "Confidence 8, I just couldn't quote the exact line" | The gate rewrites that to 5 regardless of the claim. Don't pre-empt it by inflating confidence elsewhere. |
| "The roster looks thin, I'll add maintainability just in case" | The self-tuning stats already decided that. Padding the roster defeats the cost tracking it exists for. |
| "Diff is 210 lines but it's obviously safe, skip red team" | The trigger is line count or CRITICAL, not a judgment call about how safe it looks. |
| "One more review cycle will probably converge" | Three cycles, then stop and name the recurrences. "Probably" is not evidence of convergence. |
| "I'll summarize the diff instead of passing the checklist path" | Passing content, not a path, defeats the point — it stays resident in your context and costs more per dispatch. |
| "I'll base the Recommendation on the specialist's original claim, gate ran after anyway" | Gate can rewrite that finding's confidence to 5 for missing evidence. The Recommendation must be picked from the post-gate, post-dedup set, or a demoted finding becomes the headline. |
| "The recommendation is obviously 'proceed with caution', no need to check it mechanically" | That's exactly the boilerplate `checkRecommendation` exists to catch — a generic hedge with no `path:line` fails the check by design. |

## Red Flags

- Reviewer or red-team running on an Anthropic model
- Any finding with `confidence` ≥ 7 and no `evidence` after gate ran, unless it carries `cannot_verify: true`
- Red team dispatched inside the parallel wave instead of after it
- The implementer's report handed to a reviewer or red-team subagent
- A dispatch prompt naming a finding class to skip, or pre-rating a finding's severity before it's found
- A defect the plan or spec mandated, waved through instead of reported
- A verdict asserted on a requirement whose proving code lies outside the diff, instead of `cannot_verify`
- Loop still applying fixes past cycle 3
- ASK findings surfaced to the user one at a time instead of batched (interactive mode)
- A specialist added to the dispatch that `select` did not return
- `## Recommendation` missing, empty, or failing `checkRecommendation`
- Recommendation derived from a finding's pre-gate confidence or before dedup ran

## Done when

`review.html` exists with confidence bands rendered, `cannot_verify` findings
listed in their own section, gate and dedup both ran, every ASK item was
batched into one decision call (or, non-interactively, written into the
review as unresolved), the loop halted at ≤3 cycles, any unconverged findings
are named as residuals rather than silently dropped, and `## Recommendation`
passes `checkRecommendation` — present, non-empty, citing a real `path:line`,
and derived from the post-gate, post-dedup findings.
