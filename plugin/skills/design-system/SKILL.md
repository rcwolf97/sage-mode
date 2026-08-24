---
name: design-system
description: Derive tokens from the chosen direction. OKLCH ramps. Designed dark mode. Living component sheet.
disable-model-invocation: true
---

# design-system

Tokens are generated **from the chosen direction**, not retrieved from a palette catalog. Codify the type scale, colour, space, radius, shadow that the comp already has. Fill gaps. OKLCH ramps so lightness steps are perceptually even. **Dark mode is designed against the dark surface, never inverted** — hue must differ, not just lightness.

Write `docs/design/tokens.css` and `docs/design/system.html`. Query catalog knowledge for specific UX/a11y/stack questions, not for taste.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll look up a palette named 'SaaS'" | That is catalog recombination. Derive from the comp. |
| "Dark mode is filter:invert" | Inverted greys fail the critic. Design the dark surface. |

## Red Flags

- Tokens that do not appear in the chosen comp
- Identical hues across light and dark
- No living component sheet

## Done when

tokens.css exists, system.html shows components, dark mode differs in hue.
