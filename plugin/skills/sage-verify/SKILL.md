---
name: sage-verify
description: Runtime evidence. qa-driver captures; qa-analyst judges. Findings return as nodes, never inline fixes.
disable-model-invocation: true
---

# sage-verify

Runtime evidence, split across two roles so the one that captures never
grades its own capture — the same independence principle review applies to
code, generalized to running software. `qa-driver` is a Cursor subagent on
Lane A (`grok-4.5`) that navigates the app and writes artifacts. `qa-analyst`
is a Lane B `claude -p` call (`claude-sonnet-5`, via `sage consult --role
qa-analyst`) that reads those artifacts and issues verdicts. The split exists
because the browser only exists on Lane A, but judgment belongs on the
strongest model available — putting one role on the free lane and the other
on the good model is strictly better than putting both halves on either lane
alone.

**Reads:** the branch, the sprint spec's verification profile,
`profiles/<profile>.json`. **Writes:** `docs/sprints/NN/evidence/`.
**Runs:** `qa-driver` (Lane A), `qa-analyst` (Lane B).

## Procedure

1. **Resolve the profile.** Read the sprint spec's verification profile field
   (`web` / `api` / `cli` / `ai-product`, set by `/sage-plan`) and load
   `profiles/<profile>.json`. This walk-through covers `web`, which is the
   profile with a real driver/analyst browser split; the others substitute
   static tooling for the browser but keep the same artifact-and-gate
   discipline. See `references/profiles.md` (trigger: the profile is not
   `web`) for the exact check list of `api`, `cli`, and `ai-product`.

2. **Every required check must produce an artifact, no exceptions.** A
   non-browser check with a `command` field (`suite`, `typecheck`, and —
   `api`/`cli`/`ai-product` profiles — `contract`, `migrations`, `errors`,
   `golden`, `sandbox`, `ttfs`, `evals`, `prompts`) runs through `sage
   evidence run --label <id> -- <command>` — the evidence wrapper — which
   tees output to a capped log and writes a wtree-fingerprinted record; that
   record *is* the artifact. **Resolve a `${verify.X}` placeholder by reading
   the matching key from `.sage/config.json`'s `verify` object** (written by
   `sage-setup`; `tests`/`typecheck`/`build` always get a default, the
   profile-specific keys only if a prior setup or the user supplied one —
   there is no generic default for "run the migration-safety analysis" the
   way `npm test` is a safe default for `tests`). **If the key is absent,
   the check has no command and did not run** — say so plainly in the
   evidence summary per step 8, the same as a missing artifact. Never invent
   a command to fill the gap and never silently drop the check from the
   report. **A check with no artifact under `evidence/` did not run.** A
   verbal "tests passed" with nothing on disk is not evidence, no matter who
   says it.

3. **Dispatch `qa-driver` for browser checks.** It navigates the app, screenshots
   every width the profile lists under `viewports`, captures console output,
   and walks any `browser-walkthrough` check sourced from `spec.acceptance` —
   writing every screenshot and log to `evidence/`. **It states facts, never
   verdicts:** "console carried 3 errors at 390px," not "the 390px viewport
   passed." If it cannot open the app at all, it says so and captures nothing
   invented rather than guessing at what the page would have looked like.

4. **Dispatch `qa-analyst` to judge.** `sage consult --role qa-analyst --brief
   <path>`, Lane B, on `claude-sonnet-5`. It reads what `qa-driver` wrote —
   including the screenshots — against the sprint's acceptance criteria and
   the anti-slop rubric, and emits findings in the finding schema (same
   schema review uses), so the same confidence gate applies: an unquoted
   verdict is capped at 5. **`qa-analyst` is the only role in this skill
   allowed to say PASS or FAIL.**

5. **Degrade loudly, never silently.** If `claude` is unavailable, `consult`
   exits 3 and the fallback is `qa-driver` judging its own captured
   artifacts — the exact capturer/grader collapse this split exists to avoid.
   That degradation MUST be written into the evidence summary as a standing
   line, not a warning that scrolls past once and is gone.

6. **Severity gates the merge, not presence.** For a `design-critique`-kind
   check (the `web` profile's `a11y` entry): only `Blocker` and `High`
   findings gate; `Medium` and `Nitpick` are recorded but don't block. That's
   the line between "broken" and "I'd prefer," and it's what keeps the check
   useful instead of exhausting.

7. **Route findings back to build. Never fix inline.** Every finding
   `qa-analyst` emits above the display threshold becomes a new node for
   `/sage-build` — the same path a review finding takes. `sage-verify` does
   not patch CSS, does not touch code, no matter how small the fix looks; the
   fix goes through an Implementer and then `/sage-review`, so nothing ships
   without having been reviewed.

8. **Report.** The evidence summary lists every required check, whether its
   artifact exists, the analyst's verdict, and any degradation. If any
   required check has no artifact, say the run is not verified — don't round
   a partial pass up to a clean one.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The page looks fine, I'll skip the screenshot" | No artifact means the check did not run, regardless of how it looked. |
| "I'll fix the CSS while I'm in here" | Fixes go through `/sage-build` and `/sage-review`. QA does not patch. |
| "Driver can grade its own capture, it's faster" | The capturer marking its own work is one witness wearing two hats. Split stays split. |
| "Couldn't open the app, but I've seen this page before, I'll file what I'd expect" | If you couldn't open it, say so and report nothing invented — not even an educated guess. |
| "qa-analyst said PASS in plain text, close enough" | Verdicts route through the finding schema so the confidence gate applies. Plain-text PASS skips the gate. |
| "Medium a11y findings are basically Blockers, I'll gate on them too" | Severity mapping is fixed: Blocker/High gate, Medium/Nitpick don't. Loosening it defeats the point of having a line. |

## Red Flags

- A pass/fail verdict in `qa-driver`'s output
- A required viewport with no screenshot on the `web` profile
- Silent fallback to `claude`-absent degradation with no line in the evidence summary
- An inline QA fix instead of a routed-back node
- `qa-analyst` output that isn't valid against the finding schema
- A "verified" report where any required check has no artifact

## Done when

Every required check in the profile has a written artifact, `qa-analyst` has
issued a verdict for each, any degradation is recorded in the evidence
summary, findings above threshold have been routed to `/sage-build` as new
nodes, and the user has either approved shipping or seen the findings sent
back.
