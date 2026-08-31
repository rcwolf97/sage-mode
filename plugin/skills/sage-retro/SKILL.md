---
name: sage-retro
description: Deduplicated learnings, roadmap update, cost report, skill-tuning diff.
disable-model-invocation: true
---

# sage-retro

End-of-week retro: not a status report, a mechanism for making the system
that ran this sprint slightly better before the next one starts. Writes
durable learnings, updates the roadmap, reports what the sprint cost, and
proposes tuning to sage-mode's own skills — as a diff the user approves, not
a silent edit.

**Reads:** the sprint's ledger, board files, review residuals, verify
findings, `.sage/specialist-stats.json`. **Writes:** `<notebook>/learnings/`,
`<notebook>/roadmap.md`, a proposed skill diff. (`<notebook>` is the
configured notebook root, `docs/` by default — see `rules/sage-conduct.mdc`.)

## Procedure

1. **Re-render and re-index, unconditionally.** `sage notebook render` (all),
   `sage notebook index`, `sage recall index`. Do this even in a sprint with
   nothing notable — a stale index is a retrieval failure waiting to surface
   on the next sprint that needed exactly the learning it can no longer find.

2. **Gather notable problems.** Read the sprint's `ledger.md` Rulings
   section, any `board/<id>.blocker.md` / `.answer.md` pairs, the review's
   residuals, and any verify findings that came back as new nodes. A notable
   problem is one that cost a ruling, produced a blocker, took more than one
   review cycle to converge, or shipped as a residual — not everything that
   merely happened this sprint.

3. **Draft, ground, dedup, write.** For each notable problem, draft a learning in the
   shape below, from `templates/learning.md`. **`scope` is `sprint` (default) or
   `session`.** Sprint reads today's ledger/review/verify. Session reads
   `.sage/findings/session/` and `.sage/evidence/session/` — a `/sage-fix` with
   no sprint still gets a retro. **Before writing**, run `sage ground` on the
   drafted learning (never auto-rewrite; fix or annotate flags first), then
   `sage recall dedup --applies-when "<the draft's applies_when text>"`. Above the
   similarity threshold → **update the existing record** — revise its four
   body sections, append this sprint's id to its history, leave `created`
   untouched — instead of writing a new file. **This is the required
   behavior when a retro runs twice on the same problem: the second pass is
   an edit, not a second file.** See `references/learning-format.md`
   (trigger: drafting a learning, or a dedup result is borderline and it's
   unclear whether it should update or write new) for the full frontmatter
   shape and a worked two-runs-same-problem walkthrough.

   ```markdown
   ---
   title: <short, specific>
   kind: learning
   category: <area>
   tags: [<...>]
   applies_when: "<the retrieval key — what situation makes this relevant>"
   severity: <low|medium|high>
   sprint: "<NN>"
   created: <date>
   last_confirmed: "<NN>"
   ---
   ## What happened
   ## Why it happened
   ## What to do next time
   ## How we'd detect it earlier
   ```

4. **Re-check a small, bounded sample of existing learnings for staleness.**
   A learning written months ago can quietly go wrong — "always do X because
   service Y doesn't support Z" stops being true the day service Y ships Z,
   and nothing re-checks it unless something forces the question. This step
   is that force, kept cheap on purpose: it rides along on the sprint you're
   already retro-ing, using the touched-files context you already gathered
   in step 2, instead of being a separate pass someone has to remember to
   run. (This is deliberately not the full-corpus Keep/Update/Consolidate/
   Replace/Delete sweep some other systems run as a standalone periodic
   skill — that shape is easy to skip and, by its own maintainers' account,
   often is. Bolting a small check onto a step that already runs is the fix.)

   **The bound is hard: at most 3 learnings re-checked per retro.** Select
   them like this:
   - Build a candidate pool with `sage recall "<areas/files touched this
     sprint>" --kind learning --json` (one or two queries built from the
     categories and paths already in hand from step 2 — not a query built
     to be maximally broad). This is a relevance filter, not the selection
     itself: it exists so the corpus you even look at is already narrowed to
     what's plausibly relevant, not "every learning that exists."
   - From that candidate pool, open each hit's frontmatter and drop any
     whose `applies_when` or `tags` don't genuinely plausibly bear on what
     changed this sprint — a recall hit is a relevance signal, not a
     guarantee.
   - Of what's left, take the **3 with the oldest `last_confirmed`** (a
     learning that has never been re-confirmed since creation — where
     `last_confirmed` still equals its original `sprint` value — sorts as
     the oldest of all, ahead of anything already bumped once). Fewer than 3
     genuinely relevant candidates exist → re-check only those; zero → this
     step is a no-op this retro, same as "nothing notable" shortens step 3.
     Never pad the sample up to 3 with a weak or unrelated match just to use
     the full budget.

   For each of the (at most 3) sampled learnings, ask directly: **does this
   still hold, given what actually changed this sprint?** Answer it from
   what you already read in step 2 — the sprint's actual diffs and board
   files — not from general reasoning about whether it sounds plausible.

   - **Still holds** → bump `last_confirmed` to this sprint's id. Nothing
     else changes — `created` stays at the original write date, the body
     is untouched. This is a metadata-only edit, not a rewrite.
   - **No longer holds** → never delete the file. Set `status: superseded`
     in its frontmatter — the same convention step 5's roadmap rows use for
     a plan that changed, not a bespoke one for learnings — and add one line
     directly under the frontmatter, before "## What happened":
     `> **Superseded (sprint <NN>):** <what changed, in one sentence, and
     what's true now instead>`. The old body stays in place below it as a
     record of what was believed and why, the same way a superseded roadmap
     row keeps its original text rather than being blanked.

   See `references/learning-format.md` (trigger: re-checking a sampled
   learning, or unsure whether a change to what changed this sprint is
   enough to supersede vs. just reconfirm) for the full field documentation.

5. **Update the roadmap.** `<notebook>/roadmap.md` status column: which items
   shipped, which slipped (and to where), which changed scope. Amend, don't
   delete — mark superseded rows rather than removing history.

6. **Report cost.** Pull the sprint's ledger Cost block: Lane B consult count
   (subscription-billed, so this is a count and a token estimate, not a
   dollar bill), Lane C review token total, and the nodes with the highest
   combined attempts + review cycles — the ones that were actually expensive
   to land, not just the ones that took the most wall-clock time. Every Lane
   B consult's `model_receipt` (from `sage consult`'s own JSON output —
   `lib/consult`) goes in this block too: `verified` with the model ID(s) the
   CLI's response envelope actually named, or `unverified` when the envelope
   carried no `modelUsage` field. Report the count of unverified consults
   plainly rather than folding it into the total — a run of unverified
   consults is a signal the CLI version or invocation changed underneath the
   plugin, not something to silently average away.

7. **Tune the system.** Look across `ledger.md`, board files, and
   `.sage/specialist-stats.json` for patterns: which nodes needed the most
   review rounds, which briefs produced a blocker (a sign the brief was
   ambiguous, not that the implementer was slow), which model tier was under-
   or over-provisioned for what it was actually asked to do, and — the one
   that keeps the rest of sage-mode's skills honest — which rationalization
   an agent actually reached for to skip a step, read from its own
   transcript or blocker text, never invented for the occasion. Each real
   rationalization observed is a candidate row for the relevant skill's
   Common Rationalizations table.

8. **Emit a tuning diff, gated.** Write the proposed change as an actual
   diff against the skill file it touches — not a description of a change —
   and put it behind a decision brief (`rules/sage-conduct.mdc`, not restated
   here). **Never apply tuning silently**, even when it looks obviously
   correct: a skill file used by every future sprint is a wide blast radius
   for an unreviewed edit. See `references/tuning-diff.md` (trigger:
   preparing the tuning diff at the end of a retro) for the expected shape.

## Conduct

Assumes `rules/sage-conduct.mdc` is loaded. Cursor applies it automatically
every session. sage-mode is Cursor-only.

## Non-interactive

Step 8's tuning diff has no one to approve it. Every other step (learnings,
staleness re-check, roadmap, cost) proceeds exactly as usual — none of them
gate on a live question. Write the tuning diff to disk unapplied, same as
always, and stop there rather than waiting on an approval that won't come.
Terminal: `Retro complete: tuning diff written, unapplied` or `Retro skipped:
<reason>`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is basically the same as last time, I'll just add a new file" | Dedup first. The 79th unindexed file is exactly the failure mode this step exists to prevent. |
| "I'll edit the skill directly, the user won't mind" | Tuning is always a diff the user approves — never a direct edit, no matter how small. |
| "No problems this sprint, skip the retro" | Cost and roadmap updates still happen even in a clean sprint; "nothing notable" only shortens step 2-3. |
| "The rationalization table entry is close enough to one I remember" | Pull it from the actual transcript or blocker text. An invented entry defeats the point of the table being real. |
| "Dedup came back just under threshold, close enough to be the same" | Under threshold means write new. If it's genuinely the same problem, the `applies_when` text needs sharpening, not the threshold ignored. |
| "The index re-render can wait until something actually changed" | It's unconditional every retro. A skipped render this week is a stale index the next sprint's recall silently serves. |
| "The staleness re-check is extra work with no notable problem attached, I'll skip it" | It's not optional and it's not big: at most 3 learnings, chosen from this sprint's already-gathered context. Skipping it is exactly how a six-month-stale learning keeps getting served as current advice. |
| "I'm already in the learnings this sprint, might as well sweep the whole corpus while I'm in there" | The bound is 3, not "however many look worth checking." A full-corpus sweep is the enormous-prompt-surface, easy-to-neglect shape this step was designed to avoid — that's a separate, heavier procedure, not a bigger version of this one. |

## Red Flags

- A new learning file written when `recall dedup` returned an existing record above threshold
- A skill file edited without a decision brief
- Notebook not re-rendered or re-indexed this retro
- Cost block omitted because "nothing shipped"
- A rationalization-table entry that doesn't trace to an actual transcript or blocker
- Roadmap rows deleted instead of marked superseded
- Staleness re-check skipped entirely with no candidate pool even considered
- More than 3 learnings re-checked for staleness in one retro
- `last_confirmed` bumped on a learning without actually weighing it against what changed this sprint
- A learning file deleted, or its body wiped, instead of marked `status: superseded` with the old text left in place

## Done when

Learnings are written or updated with no duplicates, up to 3 sprint-relevant
existing learnings have been re-checked for staleness with `last_confirmed`
bumped or `status: superseded` set accordingly, the notebook is re-rendered
and re-indexed, the roadmap reflects shipped/slipped/changed, cost is
reported per lane, and the tuning diff is written and gated behind an
explicit user decision rather than applied.
