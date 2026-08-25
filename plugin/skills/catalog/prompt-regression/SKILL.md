---
name: prompt-regression
description: Catalog skill — pinned prompts, baseline scores, drift. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "changing a production prompt without silent quality loss"
---

# prompt-regression

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Confirm a frozen golden set exists before touching the prompt: real (or representative) inputs with either a known-good reference output or a scored rubric, checked into version control alongside the prompt itself — not a handful of examples someone remembers being good.
2. Pin everything that can silently shift output: model version/snapshot, temperature, top_p, max tokens, system vs. user message split. A prompt "regression" is sometimes actually a model-version drift wearing a prompt's clothes — isolate which one changed.
3. Run the old prompt and the new prompt against the identical golden set in the same run (same model snapshot, same sampling params) so any difference is attributable to the prompt text alone.
4. Score outputs with something more discriminating than exact string match: a rubric-based LLM judge, embedding similarity to the reference, or task-specific structural checks (does the JSON parse, does the required field exist, is the cited source real). Exact match will flag harmless rephrasing as a regression and miss a subtly wrong answer that happens to share surface words.
5. Look at per-example deltas, not just the aggregate score — an aggregate that holds steady can hide five examples that got much worse offset by five that got slightly better, which is a real regression the average erases.
6. For anything with a coherent one-line summary, semantically diff old vs. new output pairs (not just score them independently) to catch cases where the answer is differently wrong, not just differently scored.
7. Canary the new prompt on a small slice of live traffic with the old prompt kept as instant fallback, and compare downstream behavioral signals (thumbs down rate, retry rate, escalation rate) before full rollout, not just eval-set score.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I read ten outputs and they look fine" | Ten manually-read outputs sample almost none of the input distribution and carry your own confirmation bias toward "looks fine" — the golden set exists precisely because eyeballing doesn't scale or generalize. |
| "It's just a wording tweak, not a logic change" | Small wording changes are exactly what shift instruction-following behavior in an LLM — "always" vs. "usually," a reordered list, a changed example — these routinely move eval scores more than the diff size suggests. |
| "The aggregate score is the same or better" | An unchanged aggregate can average out a subset of inputs that got meaningfully worse against a subset that improved; without per-example deltas a real regression can ship invisibly. |
| "We'll just monitor it in prod and roll back if it's bad" | Prod monitoring after a full rollout means every user in the interim got the regression, and "roll back if it's bad" needs a bad-signal detector that usually doesn't exist yet — a canary with a kept-warm fallback catches it before full exposure. |

## Red Flags

- No golden set, or a golden set with no reference/rubric to score against
- Old and new prompt compared on different model snapshots or sampling settings
- Only an aggregate score reported, with no per-example comparison
- Full rollout with no canary slice and no fallback path to the previous prompt

## Done when

The new prompt scored at or above the old prompt on the same frozen golden set with the same model/params, per-example deltas were reviewed for hidden regressions, and either a canary showed neutral-or-better live signals or the rollout can be instantly reverted to the pinned previous prompt.
