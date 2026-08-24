---
name: design-system
description: Derive tokens from the chosen direction. OKLCH ramps. Designed dark mode. Living component sheet.
disable-model-invocation: true
---

# design-system

Design Technologist on Lane A (`grok-4.5`). Tokens are **derived from the chosen direction**, never retrieved from a palette catalog. The comp already has a type scale, a colour, a spacing rhythm — this skill codifies what's actually there and fills only the gaps the comp didn't specify.

## Procedure

1. **Refuse if no chosen direction.** If no comp in `docs/design/directions/` was approved in `docs/design/taste.md`, stop and tell the user to run `/design-direction` first (or finish picking).

2. **Read the chosen comp by path** — `docs/design/directions/<a|b|c>.html` — never pasted. Extract what it already establishes: the type scale actually used, the colour(s) actually used, the spacing values, radii, shadow treatment, the one real interaction's easing.

3. **Codify, then fill gaps.** Every value already present in the comp becomes a token as-is. Only where the comp is silent (a size, a state, a breakpoint it never exercised) does this skill choose a value — and it must be consistent with what's already there, not a fresh aesthetic decision.

4. **OKLCH ramps.** Build colour scales in OKLCH so lightness steps read evenly — no step that looks like a bigger jump than its neighbours. This applies to every colour family in the token set, not just the primary.

5. **Dark mode is designed, not inverted.** Build the dark scale against the dark surface directly — choose its own lightness steps and, where the comp's colour needs it, its own hue shift. A dark mode that is the light palette with `filter: invert` or flipped greys is a rubric failure (surface tell: hue values collapse to the same value in both palettes when they should differ).

6. **Query the catalog for specific answers, not for taste.** `--domain ux`, `--domain a11y`, `--stack <name>` are for resolving concrete technical questions — keyboard focus behavior inside a modal, a stack-specific form pattern, a contrast ratio requirement — never for picking a look. If a query result would change the aesthetic direction rather than answer a technical question, it doesn't belong here.

7. **Write `docs/design/tokens.css`** — the full token set: colour ramps (light + dark), type scale, spacing scale, radii, shadows, the interaction easing captured from the comp.

8. **Write `docs/design/system.html`** — a living component sheet that actually renders using the tokens: buttons, inputs, cards, whatever the comp implied exists. Not a swatch list — real components in real states (default, hover, focus, disabled).

9. **Gate.** Decision brief. Flag anything the comp was silent on where a gap-fill judgement call was made, so the user can correct it before `/design-build` inherits these as hard constraints.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll look up a palette named 'SaaS' or 'editorial'" | That's catalog recombination again, one layer down. Derive every value from the chosen comp. |
| "Dark mode is just `filter: invert()`, ship it" | Inverted greys are a named surface tell in the anti-slop rubric. Design the dark surface's own steps. |
| "Lightness steps look fine by eye" | Eyeballed ramps produce uneven perceptual jumps. Use OKLCH and check the steps. |
| "The catalog has a nicer look for this domain, I'll use that instead" | The catalog answers technical questions here, not aesthetic ones. The comp already decided the look. |
| "The comp didn't show a disabled state, I'll invent whatever" | A genuine gap gets filled consistently with what's there, then flagged at the gate — not invented silently. |

## Red Flags

- A token that does not appear anywhere in the chosen comp and wasn't flagged as a gap-fill
- Identical hue values across the light and dark ramps
- `system.html` showing swatches instead of real rendered components
- A catalog query used to pick a colour or style rather than answer a technical question
- Gap-fill decisions not surfaced at the gate

## Done when

`tokens.css` exists with light and dark OKLCH ramps, `system.html` renders real components in real states, dark mode differs in hue from light (not just lightness), and any gap-fill judgement calls were flagged to the user.
