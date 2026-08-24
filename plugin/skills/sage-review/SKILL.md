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
`docs/sprints/NN/review.{md,html}`.
**Runs:** Reviewer + Red Team, Lane C, non-Anthropic model.

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
   Pass the base ref and the checklist **path** — never its contents; the
   specialist re-derives its own diff via `git merge-base <base> HEAD` then
   `git diff`, which is a cheaper prompt and works because each subagent has
   repo access. Set `is_background: false` explicitly on every dispatch —
   don't rely on the default.

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

7. **Classify every finding: AUTO-FIX or ASK.** Rule of thumb — mechanical and
   uncontroversial → AUTO-FIX; reasonable engineers could disagree → ASK.
   `CRITICAL` defaults toward ASK; `MEDIUM`/`NITPICK` default toward AUTO-FIX.
   **Override:** any finding carrying a `test_stub` becomes ASK regardless of
   severity, and the user approves the test before it's added. The full
   category table is in `references/classification.md` (trigger: classifying
   findings in this step, or a finding's category isn't obviously mechanical
   or obviously judgment) — don't guess at the boundary from the rule of
   thumb alone when a table entry exists.

8. **Apply, then batch.** Apply every AUTO-FIX finding. Collect every ASK
   finding into **one** decision call — never one interruption per finding.
   Use the decision-brief shape from `rules/sage-conduct.mdc` (not restated
   here).

9. **Loop, bounded at 3.** Commit the fixes, re-run the relevant verify
   command, re-review the new diff — inside the same invocation. If cycle 3
   still applies an AUTO-FIX item or surfaces a new ASK finding, **stop** and
   report which findings keep reappearing. A review that will not converge is
   a genuine blocker worth human eyes, not a request to run it again.

10. **Write and render.** `docs/sprints/NN/review.md`, with confidence bands:
    ≥7 shown normally · 5–6 with the caveat "Medium confidence — verify this
    is actually an issue" · 3–4 appendix only · 1–2 suppressed. Render to
    HTML.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll include the implementer's report for context" | Hand over conclusions, get back validation of conclusions. ARTIFACT + CONTRACT only. |
| "No matching scope category means nothing to review" | Files changed with no category match is `SCOPE_ERROR=unmatched`, exit 2 — a bug report, not a skip. |
| "Confidence 8, I just couldn't quote the exact line" | The gate rewrites that to 5 regardless of the claim. Don't pre-empt it by inflating confidence elsewhere. |
| "The roster looks thin, I'll add maintainability just in case" | The self-tuning stats already decided that. Padding the roster defeats the cost tracking it exists for. |
| "Diff is 210 lines but it's obviously safe, skip red team" | The trigger is line count or CRITICAL, not a judgment call about how safe it looks. |
| "One more review cycle will probably converge" | Three cycles, then stop and name the recurrences. "Probably" is not evidence of convergence. |
| "I'll summarize the diff instead of passing the checklist path" | Passing content, not a path, defeats the point — it stays resident in your context and costs more per dispatch. |

## Red Flags

- Reviewer or red-team running on an Anthropic model
- Any finding with `confidence` ≥ 7 and no `evidence` after gate ran
- Red team dispatched inside the parallel wave instead of after it
- The implementer's report handed to a reviewer or red-team subagent
- Loop still applying fixes past cycle 3
- ASK findings surfaced to the user one at a time instead of batched
- A specialist added to the dispatch that `select` did not return

## Done when

`review.html` exists with confidence bands rendered, gate and dedup both ran,
every ASK item was batched into one decision call, the loop halted at ≤3
cycles, and any unconverged findings are named as residuals rather than
silently dropped.
