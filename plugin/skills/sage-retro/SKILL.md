---
name: sage-retro
description: Deduplicated learnings, roadmap update, cost report, skill-tuning diff.
disable-model-invocation: true
---

# sage-retro

## Procedure

1. `sage notebook render` all, `sage notebook index`, `sage recall index`.
2. For each notable problem, draft a learning from `templates/learning.md`, then `sage recall dedup --applies-when "<text>"`. Above threshold → update the existing record. Do not write a duplicate file.
3. Update the roadmap: shipped, slipped, changed.
4. Report cost: Lane B consults, Lane C tokens, most expensive nodes.
5. Tune: which nodes needed the most review rounds, which briefs were ambiguous, which model tier was wrong, which rationalization an agent actually used. Emit a **diff** against sage-mode skills for the user to approve. Do not apply tuning silently.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is basically the same as last time but I'll add a new file" | Dedup first. The 79th unindexed file is the failure mode. |
| "I'll edit the skill directly, the user won't mind" | Tuning is a diff the user approves. |
| "No problems this sprint, skip retro" | Cost and roadmap updates still happen. |

## Red Flags

- Duplicate learning files with similar applies_when
- Skills edited without approval
- Notebook not re-indexed
- Cost omitted

## Done when

Learnings are written or updated without duplicates, notebook is re-rendered, roadmap is current, cost is reported, tuning diff is gated.
