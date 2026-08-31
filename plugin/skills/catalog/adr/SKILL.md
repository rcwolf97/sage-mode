---
name: adr
description: Catalog skill — architecture decision records, options, consequences. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "recording a durable technical decision"
---

# adr

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. State the decision in one sentence, present tense: "We will use X for Y." Not "we discussed X."
2. List every option that was seriously considered — including "do nothing" and "revisit in 6 months." An ADR with one option is a justification, not a decision record.
3. For each option, write the concrete cost it trades against the others: latency, operational burden, vendor lock-in, team familiarity, migration cost off it later. Skip options with no real tradeoff — they weren't actually considered.
4. Name what would make you reverse this decision (a metric, a deadline, a vendor change) and where that trigger will be checked, not "if it doesn't work out."
5. File it under `docs/adr/NNNN-slug.md`, numbered sequentially, status `Accepted` — never edit a merged ADR's decision; write a new one that supersedes it and link both directions.
6. Link the ADR from the code or config it governs (a comment, a README section) so someone hitting the decision later finds the reasoning, not just the result.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's obviously the right call, no need to write it down" | The call is obvious to you, today, with full context. In 8 months the next engineer has neither — recording a durable technical decision is for them, not you. |
| "We'll write the ADR after we ship, once it's proven out" | Post-hoc ADRs quietly drop the options that were rejected, because you no longer remember why they lost. The record becomes marketing for the choice, not a decision trail. |
| "This is a small decision, doesn't need the ceremony" | Ask whether reversing it next year would require a migration. If yes, it's not small — line-count of the diff is not the same as blast radius of the decision. |
| "We already have a Slack thread about this" | Slack threads rot out of search and out of the channel's retention window. An ADR is the thing that outlives the tool you discussed it in. |

## Red Flags

- An ADR with exactly one option listed
- "Consequences" section that only lists upside
- No named reversal trigger — just "we can always change it later"
- Decision title describes the technology, not the decision ("Redis" instead of "Cache session state in Redis, not in-process")

## Done when

The ADR names the options actually considered, the specific cost of the path taken, and the condition under which it gets revisited — and it's linked from the code it governs.
