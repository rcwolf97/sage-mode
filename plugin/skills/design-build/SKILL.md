---
name: design-build
description: Design Technologist implements direction + system + motion against a performance budget.
disable-model-invocation: true
---

# design-build

Implement against the chosen direction, tokens, and motion spec. Performance is a Blocker: LCP > 2.5s, CLS > 0.1, or INP > 200ms fails.

Do not invent new radii, shadows, or easings. Inherit tokens as hard constraints.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll optimize later" | The budget is an acceptance criterion, not an afterthought. |
| "A new radius looks better here" | Tokens are the contract. Change the system, don't freelance. |

## Red Flags

- New visual tokens invented in components
- No performance measurement
- Motion that ignores the spec

## Done when

Implementation matches the direction and tokens; budget measured; ready for critique.
