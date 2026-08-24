---
name: design-build
description: Design Technologist implements direction + system + motion against a performance budget.
disable-model-invocation: true
---

# design-build

Design Technologist on Lane A (`grok-4.5`). Implements the chosen direction against the tokens and the motion spec — with the performance budget as an acceptance criterion, not an afterthought.

## Procedure

1. **Refuse if any input is missing.** Requires the chosen comp under `docs/design/directions/`, `docs/design/tokens.css`, and `docs/design/motion.md`. If any is absent, stop and name which upstream command produces it.

2. **Read all three by path.** The comp is the reference for what the page should look like; `tokens.css` and `motion.md` are the hard constraints on how it's built.

3. **Tokens are the contract — do not freelance.** Radius, shadow, colour, spacing, and easing values all come from `tokens.css`. Motion timing, curves, and the spring/duration split come from `motion.md`. If the page genuinely needs a value neither file has, that is a gap in the system or the spec, not a license to invent one locally — send it back to `/design-system` or `/design-motion` rather than adding a one-off.

4. **Build against the performance budget as acceptance criteria:**
   - LCP under 2.5s, CLS under 0.1, INP under 200ms.
   - Animate `transform` and `opacity` only.
   - Apply `will-change` just before an animation starts and remove it after.
   - Lazy-mount anything heavy (WebGL, large embeds) below the fold.
   - Keep animation JS under roughly 40KB gzipped.
   A direction that can't hit the budget is a direction that failed — this is not something `/design-critique` discovers later, measure it here.

5. **Measure, don't estimate.** Run the actual performance measurement (Lighthouse or equivalent) against the built page before calling it done. A number you didn't measure is not evidence.

6. **Gate.** Decision brief with the measured budget numbers against the thresholds. Hand off to `/design-critique` next — this skill does not self-certify against the anti-slop rubric, only against tokens and budget.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll optimize later, ship the feature first" | The budget is an acceptance criterion here, not a follow-up task. Measure before calling it done. |
| "A new radius looks a bit better on this one card" | Tokens are the contract every other UI node also inherits. Change the system, don't freelance one component. |
| "I estimated the LCP from the bundle size" | An estimate is not a measurement. Run the actual check. |
| "The motion spec didn't cover this micro-interaction, I'll wing it" | A gap in the spec goes back to `/design-motion`, not into an ad-hoc animation. |
| "It's close enough to the comp, ship it" | The comp is the reference for `/design-critique`'s structural and surface checks. Close enough is what those checks exist to catch. |

## Red Flags

- A radius, shadow, colour, or easing value in the code that doesn't trace back to `tokens.css` or `motion.md`
- No measured performance numbers at the gate, only estimates
- Motion implemented before `motion.md` was read
- A one-off visual decision made to "match the comp better" instead of updating the token that's actually wrong

## Done when

The implementation matches the chosen comp, every visual and motion value traces to `tokens.css` or `motion.md`, the performance budget was measured (not estimated) and passes or the failure is named, and the result is ready to hand to `/design-critique`.
