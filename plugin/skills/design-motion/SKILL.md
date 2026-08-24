---
name: design-motion
description: Choreography spec before animation code. Tokens plus reduced-motion variant.
disable-model-invocation: true
---

# design-motion

Motion Director on Lane A (`grok-4.6`). The spec is written **before any animation code exists**. Skipping straight to code is how every page ends up with the same shared fade-in-up — the spec is what forces a choreography decision instead of a default.

## Procedure

1. **Refuse if no tokens.** If `docs/design/tokens.css` does not exist, stop and tell the user to run `/design-system` first.

2. **Write the spec in prose, in this order, before any token or code:**

   - **Hierarchy.** What arrives first on the screen, and why that is the most important thing on it. Name the element, not a category ("the hero image" not "media").
   - **Causality.** What came from what. Where an element genuinely persists across a state change, this is a shared-element transition, not two independent animations that happen to line up.
   - **Continuity.** What carries across a route change, and what resets. Silence here means everything resets, which is a valid answer but must be stated, not assumed.
   - **Restraint.** What deliberately does not move — usually most of the page. Name it explicitly; a spec with nothing in this section hasn't actually decided anything.

3. **Then, and only then, the token set:**

   - **One base duration.** Everything else is expressed relative to it.
   - **Stagger as a fraction of the base duration**, not an independently chosen number.
   - **An entrance curve and a sharper exit curve.** The exit runs at roughly 0.6× the entrance duration — exits should feel faster than entrances, not symmetric.
   - **Spring parameters for anything the user directly manipulates** (drag, resize, a toggle they touch); **durations for anything the system initiates** (a route change, content arriving on its own).
   - **A reduced-motion variant that swaps transforms for opacity**, rather than switching motion off outright. `prefers-reduced-motion` disabling everything is itself a rubric tell (motion tell: no reduced-motion handling at all reads the same as none existing) — the fix is a real substitute, not a bypass.

4. **Write `docs/design/motion.md`** with the four prose sections above, and append the token set to `docs/design/tokens.css` alongside the visual tokens from `/design-system`.

5. **Gate.** Decision brief. Confirm the hierarchy choice and the restraint list specifically — these are the two sections most likely to get rubber-stamped rather than actually decided.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "fade-in-up, 0.3s, ease-in-out on everything" | That reads as animated, never as designed. Write hierarchy, causality, continuity, restraint first. |
| "Every element gets its own timing, we'll tune it in code" | Tuning without a spec is how the shared-fade tell happens. Fraction-of-base-duration stagger, decided up front. |
| "`prefers-reduced-motion { animation: none }`" | That's a bypass, not a variant. Swap transforms for opacity — keep the motion legible, remove the vestibular trigger. |
| "Exit can reuse the entrance curve reversed" | Exits read right at roughly 0.6× the enter duration with a sharper curve, not a mirrored one. |
| "This drag interaction can use a duration, it's simpler" | Direct manipulation wants springs — a duration under the user's finger feels laggy or overshoots. |

## Red Flags

- Animation code written before `motion.md` exists
- A shared fade-in-up with no stagger anywhere in the page
- Easing values that are `ease`, `ease-in-out`, or `linear` with no custom curve
- No named restraint section, or restraint list is empty
- `prefers-reduced-motion` disabling motion outright instead of swapping to opacity

## Done when

`docs/design/motion.md` states hierarchy, causality, continuity, and restraint by name; the token set (base duration, stagger fraction, entrance/exit curves, spring vs. duration split, reduced-motion variant) is appended to `tokens.css`; and the user approved the hierarchy and restraint choices at the gate.
