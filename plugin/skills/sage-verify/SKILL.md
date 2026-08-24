---
name: sage-verify
description: Runtime evidence. qa-driver captures; qa-analyst judges. Findings return as nodes, never inline fixes.
disable-model-invocation: true
---

# sage-verify

`qa-driver` (Lane A, Browser) captures. `qa-analyst` (Lane B `sage consult --role qa-analyst`) judges. If `claude` is absent, qa-driver judging its own artifacts is weaker — record that in the evidence summary, do not hide it.

## Procedure

1. Read `profiles/<profile>.json` from the sprint spec.
2. Every required check writes an artifact under `docs/sprints/NN/evidence/`. A check with no artifact did not run.
3. Driver: navigate, screenshot widths in the profile, capture console, write facts.
4. Analyst: read artifacts against acceptance and the anti-slop rubric. Emit findings JSONL → gate.
5. Findings route back into `/sage-build` as new nodes. QA never fixes inline.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The page looks fine, skip screenshots" | No artifact means it did not run. |
| "I'll fix the CSS while I'm here" | Fixes go through build and review. QA does not patch. |
| "Driver can grade, it's faster" | The capturer marking its own work is one witness. Split the role. |
| "Couldn't open the app, I'll still file issues" | If you couldn't open it, say so and report nothing invented. |

## Red Flags

- Verdicts in qa-driver output
- Missing viewport screenshots on web profile
- Silent claude fallback
- Inline QA fixes

## Done when

Every required check has an artifact, analyst verdicts exist, fallbacks are recorded, and the user approved shipping or sent findings back to build.
