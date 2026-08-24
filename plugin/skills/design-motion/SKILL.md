---
name: design-motion
description: Choreography spec before animation code. Tokens plus reduced-motion variant.
disable-model-invocation: true
---

# design-motion

Write the spec **before any animation code**: hierarchy (what arrives first and why), causality (shared-element where an element persists), continuity (what carries across a route change), restraint (what does not move — usually most of the page).

Then tokens: one base duration; stagger as a fraction of it; entrance curve; sharper exit at ~0.6× enter; springs for direct manipulation; reduced-motion that swaps transforms for opacity rather than switching motion off.

Output `docs/design/motion.md` and motion tokens in `tokens.css`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "fade-in-up 0.3s ease-in-out on everything" | That reads as animated, never designed. Spec first. |
| "prefers-reduced-motion: animation none" | Swap transforms for opacity. Do not delete motion. |

## Red Flags

- Code before spec
- Shared fade-in-up
- Easing is `ease` / `linear` everywhere

## Done when

motion.md and tokens exist; reduced-motion is specified.
