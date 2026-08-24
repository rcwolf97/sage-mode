# The anti-slop rubric

Load this file before starting a critique pass. Twenty tells that mark a page as AI-generated median output, plus the severity mapping and the performance thresholds. Roughly fifteen of the twenty are computable directly from the DOM or computed styles; the remaining five are judgement calls and **every finding raised against one of them MUST say so explicitly** — put `"judgement": true` alongside the finding, or say "judgement call" in the summary. A finding raised against a mechanical check without the computed value it was measured from does not meet the confidence-gate evidence requirement in `docs/design/critique/SKILL.md` and gets capped like any other unevidenced finding.

## Structural — three hits is an automatic High

| # | Tell | Mechanical? | Check |
|---|---|---|---|
| 1 | Centered hero: `h1`, one-line subtitle, two buttons side by side | Yes | Screenshot the fold |
| 2 | Three-column feature grid, icon in a coloured circle above each heading | Yes | Screenshot |
| 3 | Every section uses the same vertical padding | Yes | Computed `padding-block` across sections — variance ≈ 0 |
| 4 | One container width everywhere, nothing full-bleed | Yes | Computed `max-width` distribution across top-level sections |
| 5 | Total symmetry — no asymmetric ratio, no overlap, no bleed anywhere on the page | Yes | Screenshot |
| 6 | Type scale range under 5:1 between the largest and smallest sizes in use | Yes | Computed `font-size`, max ÷ min |
| 7 | No signature element — nothing on the page you'd describe to a friend | **No — judgement** | Must name specifically what is missing, not just assert absence |

Three or more hits here is an automatic High regardless of how the rest of the page scores. Name every hit; do not round down to "mostly fine."

## Surface

| # | Tell | Mechanical? | Check |
|---|---|---|---|
| 8 | Default system/UI sans used as the display face with no stated reason | Yes | Computed `font-family` on `h1` |
| 9 | Purple→blue (or teal→indigo) gradient used as decoration, not as a light source | Yes | Screenshot / grep gradient declarations |
| 10 | `border-radius` identical across every element on the page | Yes | Computed radii distribution |
| 11 | `box-shadow` is a single flat black at low alpha, not multi-layer or hue-tinted | Yes | Computed `box-shadow` |
| 12 | Dark mode is the light palette with inverted greys, not a designed dark surface | Yes | Compare hue values between light and dark palettes — hue should differ, not just lightness |
| 13 | Emoji standing in for icons | Yes | Grep for emoji characters in markup |
| 14 | Round avatars in testimonial cards, grayscale logo bar | Yes | Screenshot |

## Motion

| # | Tell | Mechanical? | Check |
|---|---|---|---|
| 15 | Every element uses the same fade-in-up, same duration, no stagger | Yes | Read the animation config / captured timing |
| 16 | Easing is `ease`, `ease-in-out`, or `linear` everywhere — no custom curve | Yes | Grep easing values |
| 17 | Hover states change opacity only | Yes | Computed diff on `:hover` |
| 18 | No `prefers-reduced-motion` handling at all | Yes | Grep for the media query |

## Substance

| # | Tell | Mechanical? | Check |
|---|---|---|---|
| 19 | Copy is placeholder-grade — "Transform your workflow," "Powerful features," "Get started today" | **No — judgement** | Read it against the brief's admired/anti-reference language |
| 20 | Nothing on the page could only be true of *this* product | **No — judgement** | Compare against the brief's friend-test answer and stakes |

Note: #7, #19, and #20 are judgement; the rubric's usual "fifteen of twenty" count treats #12 and #14 as mechanical since they resolve from computed style and screenshot comparison respectively — if a critique pass finds either genuinely ambiguous on a given page, downgrade it to judgement for that pass and say so.

## Severity → merge decision

| Severity | Meaning | Gates the merge? |
|---|---|---|
| Blocker | Broken, inaccessible, or fails the performance budget | Yes |
| High | Materially generic — three or more Structural hits, or a single severe surface/motion/substance failure | Yes |
| Medium | A real tell worth fixing, not gating | No |
| Nitpick | Taste, non-gating | No |

This is the same discipline the code-review gate uses to separate *broken* from *I'd prefer* — it is what keeps a critic useful instead of exhausting. Do not report a Medium as though it blocks the merge, and do not soften a Blocker into a Medium because the rest of the page is strong.

## Performance — a Blocker, not an aspiration

- LCP > 2.5s → Blocker
- CLS > 0.1 → Blocker
- INP > 200ms → Blocker

These three are measured, not estimated, exactly as `/design-build` measured them. A regression here is a Blocker even when every other check on the page is clean.
