---
name: sage-review
description: Adversarial review. Lane C, readonly, ARTIFACT+CONTRACT only. Confidence gate is mechanical.
disable-model-invocation: true
---

# sage-review

Reviewer and Red Team on Lane C (`gemini-3.7-flash`), `readonly: true`.

## Procedure

1. `sage review scope --base <ref>`. Exit 2 (`no_base` / `unmatched`) surfaces to the user. Silent "no reviewers needed" is forbidden.
2. `sage review select` → roster.
3. Dispatch all selected specialists in **one message**. Each re-derives its own diff. Pass the base ref and checklist **paths**.
4. The reviewer never sees the author's claim — ARTIFACT + CONTRACT only.
5. Collect JSONL → `sage review gate` → `sage review dedup`.
6. Red team second wave if diff > 200 lines or any CRITICAL, handed merged findings: "find what they missed." Sequential, not parallel.
7. Classify AUTO-FIX vs ASK. `test_stub` → ASK. CRITICAL defaults ASK. Batch every ASK into one decision call.
8. Apply AUTO-FIX. Loop: commit, re-verify, re-review. **Halt at 3 cycles** and name findings that keep reappearing.
9. Write `docs/sprints/NN/review.md` with confidence bands. Render.

Display: ≥7 normal · 5–6 caveat · 3–4 appendix · 1–2 suppressed.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll include the implementer report for context" | If you hand over conclusions, you get validation of conclusions. |
| "No matching category means nothing to review" | Unmatched with changed files is exit 2, not a skip. |
| "Confidence 8, I just couldn't quote the line" | The gate rewrites that to 5. Do not invent evidence. |
| "One more review cycle will converge" | Three cycles then stop and name the recurrences. |

## Red Flags

- Reviewer running on an Anthropic model
- Findings without evidence at confidence ≥7 after gate
- Red team dispatched in the parallel wave
- Loop continuing past 3

## Done when

Review HTML exists, gate and dedup ran, ASK items were batched, loop halted at ≤3, residuals are listed.
