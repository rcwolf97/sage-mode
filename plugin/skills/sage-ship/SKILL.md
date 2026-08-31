---
name: sage-ship
description: Cite fresh evidence, changelog, open a PR. Do not merge. Do not deploy.
disable-model-invocation: true
---

# sage-ship

The release skill, and the smallest possible one: verify what's about to go
out is actually verified, write it up, open a PR, stop. Ship never merges and
never deploys — the user does both, deliberately, so a run that reports "done"
can never mean "and it's live."

**Reads:** the ledger, `evidence.jsonl`, the sprint spec, review and verify
output. **Writes:** `CHANGELOG`, version bump, an open PR.

## Procedure

1. **Check evidence freshness for every required label.** `sage evidence
   check --label <label>` for each check the sprint's verify profile
   requires, plus each node's own `verify` command from the ledger.
   - **FRESH → cite the record, do not re-run.** Point at the evidence line
     (command, timestamp, wtree) in the PR body. **Refuse a `type-check-only`
     record** for a node whose acceptance text describes runtime behavior
     (`refuseTypeCheckOnlyForRuntime` in `lib/evidence`). Re-run at
     `unit-test-verified` or `live-verified`, or stop.
   - **STALE → re-run that exact command before proceeding.** Ship refuses to
     open a PR against evidence that isn't corroborated by the current
     working tree. See `references/freshness.md` (trigger: a check comes back
     STALE and it's not obvious why, or the fix isn't obviously "just re-run
     it") for what actually makes a record stale — one of the five reasons
     is "the command itself changed," which is a decision to make, not
     something a re-run fixes.

2. **Confirm the ledger.** Every node in `ledger.md` is status `done` — not
   `in-review`, not `blocked`. Every `CRITICAL` finding from review or verify
   is either fixed (a commit is recorded against it) or carries an explicit
   user decision in the ledger's Rulings section. **"The user asked to ship"
   is not itself a decision about a specific CRITICAL finding** — it needs
   its own recorded ruling.

3. **Bump the version and write the changelog.** Generate entries from
   `reports/<id>.md` for each node and the sprint spec's item list — one
   entry per shipped item, in plain language a user of the software would
   understand, not a commit-log dump. See `references/pr-body.md` for the
   section layout the changelog feeds into.

4. **Open the PR via `gh`.** If `gh` is missing, print the full PR body to
   the transcript and stop — never invent another way to open it. Embed:

   - the sprint goal, one sentence;
   - the item list, each with its done-condition;
   - the review summary, with confidence bands;
   - links to every evidence artifact cited in step 1;
   - **the residuals** — every finding that was accepted or deferred rather
     than fixed, each with its confidence and the reason it wasn't fixed.

   A residual must reach a durable sink before the run reports itself done.
   The PR is that sink; a residual mentioned only in chat does not count as
   having reached one. See `references/pr-body.md` (trigger: assembling the
   PR body, or unsure what counts as a residual versus something that can be
   left out) for the full template and a worked residuals section.

5. **Stop.** No merge. No deploy — scripted or manual, no exceptions. The
   user merges. The user deploys. If asked to also merge or deploy in the
   same breath as "ship," decline that specific part and say why: ship's job
   ends at an open PR.

## Conduct

Assumes `rules/sage-conduct.mdc` is loaded. Cursor applies it automatically
every session. sage-mode is Cursor-only.

## Non-interactive

Nothing here waits on a live decision — a CRITICAL finding with no recorded
ruling already refuses the PR in interactive mode too, so non-interactivity
changes nothing about that check; it only means there's no one left to ask
for the ruling this run needs. Terminal: `Ship complete: PR opened at <url>`
/ `Ship blocked: unresolved CRITICAL <path:line>` / `Ship blocked: gh
missing, PR body printed`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Tests passed earlier today" | Freshness is measured against the working tree, not the clock. Check, then cite — don't assume. |
| "I'll merge it too, the user asked to ship" | Ship opens a PR. The user merges. The user deploys. Those are separate acts on purpose. |
| "Residuals can live in the chat summary" | A residual must reach a durable sink — the PR — before the run reports itself done. Chat is not durable. |
| "CRITICAL is accepted implicitly since we're shipping" | CRITICAL needs an explicit recorded decision, not an inference from the act of shipping. |
| "STALE just means re-run it" | STALE for a changed command is a decision — did the check change on purpose — not a mechanical re-run. |
| "gh isn't installed, I'll skip the PR body too" | Missing `gh` means print the body and stop. The body is still required output. |

## Red Flags

- A PR opened while any required evidence label reads STALE
- A merge or deploy attempted, in any form
- Residuals omitted from the PR body, or left only in the transcript
- `gh` missing and no PR body printed
- A CRITICAL finding with no recorded ruling, shipped anyway
- A ledger node not `done` included in the shipped item list

## Done when

The PR is open (or its body is printed, if `gh` is missing) containing the
sprint goal, the item list with done-conditions, the review summary with
confidence bands, links to fresh evidence, and every residual; no merge and
no deploy occurred.
