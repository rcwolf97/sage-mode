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
findings, `.sage/specialist-stats.json`. **Writes:** `docs/learnings/`,
`docs/roadmap.md`, a proposed skill diff.

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

3. **Draft, dedup, write.** For each notable problem, draft a learning in the
   shape below, from `templates/learning.md`. **Before writing**, run `sage
   recall dedup --applies-when "<the draft's applies_when text>"`. Above the
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
   ---
   ## What happened
   ## Why it happened
   ## What to do next time
   ## How we'd detect it earlier
   ```

4. **Update the roadmap.** `docs/roadmap.md` status column: which items
   shipped, which slipped (and to where), which changed scope. Amend, don't
   delete — mark superseded rows rather than removing history.

5. **Report cost.** Pull the sprint's ledger Cost block: Lane B consult count
   (subscription-billed, so this is a count and a token estimate, not a
   dollar bill), Lane C review token total, and the nodes with the highest
   combined attempts + review cycles — the ones that were actually expensive
   to land, not just the ones that took the most wall-clock time.

6. **Tune the system.** Look across `ledger.md`, board files, and
   `.sage/specialist-stats.json` for patterns: which nodes needed the most
   review rounds, which briefs produced a blocker (a sign the brief was
   ambiguous, not that the implementer was slow), which model tier was under-
   or over-provisioned for what it was actually asked to do, and — the one
   that keeps the rest of sage-mode's skills honest — which rationalization
   an agent actually reached for to skip a step, read from its own
   transcript or blocker text, never invented for the occasion. Each real
   rationalization observed is a candidate row for the relevant skill's
   Common Rationalizations table.

7. **Emit a tuning diff, gated.** Write the proposed change as an actual
   diff against the skill file it touches — not a description of a change —
   and put it behind a decision brief (`rules/sage-conduct.mdc`, not restated
   here). **Never apply tuning silently**, even when it looks obviously
   correct: a skill file used by every future sprint is a wide blast radius
   for an unreviewed edit. See `references/tuning-diff.md` (trigger:
   preparing the tuning diff at the end of a retro) for the expected shape.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is basically the same as last time, I'll just add a new file" | Dedup first. The 79th unindexed file is exactly the failure mode this step exists to prevent. |
| "I'll edit the skill directly, the user won't mind" | Tuning is always a diff the user approves — never a direct edit, no matter how small. |
| "No problems this sprint, skip the retro" | Cost and roadmap updates still happen even in a clean sprint; "nothing notable" only shortens step 2-3. |
| "The rationalization table entry is close enough to one I remember" | Pull it from the actual transcript or blocker text. An invented entry defeats the point of the table being real. |
| "Dedup came back just under threshold, close enough to be the same" | Under threshold means write new. If it's genuinely the same problem, the `applies_when` text needs sharpening, not the threshold ignored. |
| "The index re-render can wait until something actually changed" | It's unconditional every retro. A skipped render this week is a stale index the next sprint's recall silently serves. |

## Red Flags

- A new learning file written when `recall dedup` returned an existing record above threshold
- A skill file edited without a decision brief
- Notebook not re-rendered or re-indexed this retro
- Cost block omitted because "nothing shipped"
- A rationalization-table entry that doesn't trace to an actual transcript or blocker
- Roadmap rows deleted instead of marked superseded

## Done when

Learnings are written or updated with no duplicates, the notebook is
re-rendered and re-indexed, the roadmap reflects shipped/slipped/changed,
cost is reported per lane, and the tuning diff is written and gated behind an
explicit user decision rather than applied.
