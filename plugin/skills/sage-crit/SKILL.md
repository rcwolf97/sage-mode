---
name: sage-crit
description: Adversarial review without a sprint. Same roster, gate, and rung as sage-review.
disable-model-invocation: true
---

# sage-crit

Spine B review: sage-review's procedure with no roadmap, no sprint, no DAG.
Lane C, `readonly: true`. Writes session-scoped artifacts, not `sprints/NN`.

**Reads:** an explicit base, branch, or PR. **Writes:** `.sage/reviews/<date>-<slug>/review.{md,html}`, `.sage/findings/session/`, `.sage/evidence/session/`.
**Runs:** the sage-review roster on Lane C.

**Conduct.** Assumes `rules/sage-conduct.mdc` is loaded. Cursor applies it automatically every session. sage-mode is Cursor-only.

## Procedure

Follow the sage-review skill Procedure steps 1–11 with two deltas:

1. **Scope source.** Step 1 accepts `--base` as a git ref, branch, or PR (the argument). An active sprint is **not** required. If none is given, use `HEAD~1`. Still `sage review scope --base <ref>`; still surface exit 2.
10. **Write path.** Step 10 writes `.sage/reviews/<date>-<slug>/review.{md,html}` (slug from the branch or a one-word topic), not `<notebook>/sprints/NN/review.{md,html}`. Pipe findings through `sage review gate --sprint session` is wrong — there is no sprint. Use `sage review gate` then write JSONL to `.sage/findings/session/findings.jsonl`. Evidence runs take `--session`.

Step 4 (ARTIFACT + CONTRACT only — never the implementer's report) and the Common Rationalizations table are **not copied here**. They live in the sage-review skill; follow them verbatim. Same for `rung`, classification, Recommendation-line, and `sage review recommendation`.

## Non-interactive

Same terminal lines as sage-review, with the session write path named.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "There's no sprint, so I'll skip gate and just summarize" | Gate and dedup still run. No sprint is not a skip of the mechanical half. |
| "I'll dump this in sprints/00 so the paths exist" | Session paths exist (`--session`, `.sage/findings/session/`). Faking a sprint is a lie the retro will ingest. |

## Red Flags

- A sprint directory created by this command
- Reviewer running on an Anthropic model
- Implementer's report handed to a specialist

## Done when

- `review.md` exists under `.sage/reviews/<date>-<slug>/` with a Recommendation line that `sage review recommendation` accepts, or `Review skipped: <reason>` is the terminal line.
