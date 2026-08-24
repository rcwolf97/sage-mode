---
name: incident-triage
description: Catalog skill — severity, blast radius, rollback, comms. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "responding to a production incident"
---

# incident-triage

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. State the concrete risk this skill exists to prevent.
2. List the checks you will run; each check produces an artifact or a command.
3. Do the checks. Quote evidence.
4. Write findings or a short note in the sprint docs. Do not silently "fix everything".

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This doesn't apply to a small change" | responding to a production incident. Size is not the filter. |
| "I'll skip the artifact, I looked already" | If it is not written down, the next session cannot resume. |

## Red Flags

- Advice with no command or citation
- Scope expansion into unrelated refactors
- Skipping rollback or detection

## Done when

The checks ran, evidence is cited, and remaining risk is named.
