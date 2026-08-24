---
name: design-critique
description: Anti-slop + WCAG critique on Lane C against real screenshots at five viewports.
disable-model-invocation: true
---

# design-critique

Design Critic on Lane C. Screenshots at 390 / 768 / 1024 / 1440 / 1920. Finding schema + confidence gate.

**Structural — three hits = automatic High:** centered hero (h1 + subtitle + two buttons); three-column feature grid with icon in a coloured circle; identical section padding; one container width, nothing full-bleed; total symmetry; type scale range under 5:1; no signature element.

**Surface:** default UI sans as display; decorative purple→blue gradient; identical border-radius on every element; single flat black box-shadow; dark mode as inverted greys; emoji as icons.

**Motion:** one shared fade-in-up; easing ease/linear; hover opacity only; no reduced-motion.

**Substance:** placeholder copy; nothing that could only be true of this product.

Fifteen of twenty checks are computable from DOM/computed styles; the rest are judgement and MUST be labelled as such. Blocker/High gate; Medium/Nitpick do not. Performance Blocker as in design-build. If the page could not be opened, report nothing invented.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know this pattern is slop without looking" | No finding without something you observed. |
| "I'll approve, it's close enough" | Three structural hits fail. Name them. |

## Red Flags

- Critique without screenshots
- Invented findings
- Approving a page with three structural tells

## Done when

Findings JSONL gated; screenshots exist; Blocker/High listed; merge recommendation is explicit.
