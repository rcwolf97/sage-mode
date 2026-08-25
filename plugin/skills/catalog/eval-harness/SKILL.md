---
name: eval-harness
description: Catalog skill — golden sets, graders, regression gates. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "building or extending an LLM or agent eval suite"
---

# eval-harness

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Build the golden set from real failure cases first — production transcripts, bug reports, prior regressions — before adding synthetic ones; a synthetic-only set tends to test what you already believe the model does well.
2. Version the golden set and treat edits to it like code review, not a quiet fix — an eval whose ground truth shifts under you invalidates every historical score.
3. Write graders that check the property you actually care about — factual correctness, tool-call correctness, format compliance — rather than defaulting to exact-string-match, which fails on harmless rephrasing and hides real regressions in noise.
4. Where a grader is itself a model call, pin its prompt and model version, and periodically hand-audit a sample of its verdicts against human judgment — an unaudited judge can drift and start rubber-stamping.
5. Keep the regression set disjoint from anything used in prompt iteration — tuning against the same cases you score against measures overfitting, not generalization.
6. Set a regression threshold as a number tied to the metric ("pass rate must not drop more than 1pt vs. main") and wire it into CI so a merge is blocked automatically, not flagged for someone to notice later.
7. When a case is flaky — passes or fails nondeterministically at the same settings — fix or remove it rather than quietly excluding it from the gate; an ignored flaky case is a hole in coverage nobody can see.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Exact match is fine, we'll eyeball the failures" | Exact match fails correct outputs phrased differently, which trains reviewers to skim past red numbers — so the one real regression buried in the noise gets eyeballed past too. |
| "We don't need to version the golden set, it barely changes" | The first time someone "fixes" an ambiguous expected answer, every historical score becomes incomparable and last week's regression can no longer be confirmed as real. |
| "LLM-as-judge is basically as good as a human, no need to audit it" | Judge models carry documented biases — favoring longer answers, their own phrasing style — that drift further from human judgment the more the system under test is optimized against that same judge. |
| "We'll run the eval before merging, no need to block CI on it" | A check that doesn't gate is a suggestion; the regression it would have caught ships anyway the first time someone is in a hurry. |

## Red Flags

- Grader is exact-string-match against free-form model output
- Golden set has no version history or changelog of what changed and why
- The same cases are used both for prompt tuning and for the regression gate
- Eval results are reported in a dashboard but nothing in CI actually fails the build

## Done when

The golden set is versioned and disjoint from tuning data, the grader has been checked against human judgment on a sample, and a defined pass-rate threshold blocks merges in CI rather than only appearing in a dashboard.
