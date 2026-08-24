---
name: design-direction
description: Three Art Directors in parallel with mutually exclusive mandates. Working HTML comps, not descriptions.
disable-model-invocation: true
---

# design-direction

Dispatch three `design-art-director` subagents in **one message**, each with a different mandate drawn from the brief:

- A — restrained. Maximum confidence, minimum elements.
- B — expressive. Lead with the signature element.
- C — structural. The layout system is the idea.

Each returns `docs/design/directions/{a,b,c}.html` — real type, colour, spacing, one interaction — plus a one-paragraph rationale and a named signature element. Each names an anti-reference. Forbidden reflexes: default UI sans as display, uniform large radius, purple-to-blue decorative gradient.

If two comps share the same structural tells (centered hero + three icon circles + identical padding), send one back.

Write `docs/design/compare.html` at 1440 and 390 with: `Recommendation: <direction> because <specific reason naming what it does that the others don't>`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "One model can write three directions in one reply" | That produces three medians. Separate contexts, exclusive mandates. |
| "A mood board is enough" | The output is a working page the user can open. |

## Red Flags

- Descriptions instead of HTML
- Missing signature element
- Directions converging
- Recommendation without a because

## Done when

Three comps render, compare.html exists, user picked or grafted, taste.md updated with the choice and the rejects.
