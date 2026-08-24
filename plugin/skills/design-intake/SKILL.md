---
name: design-intake
description: Design intake. One question at a time. Writes docs/design/brief.md and appends taste.md.
disable-model-invocation: true
---

# design-intake

Design Director on Lane B, conversational consult. Cap 900 lines of skill substance lives here plus references if needed.

## Required coverage

What this is for and what happens to the business if it works; the specific person, device, and state of mind; before/after; **what someone should feel in the first three seconds, in one word — then the second word, and whether they are in tension**; three admired products and *specifically what*; **three they don't want to look like**; the one thing they'd describe to a friend; existing brand assets and what is negotiable; stack, CMS, a11y floor, performance budget, who maintains it; whether content is real or lorem (if lorem, say the design will be generic regardless); how we'll know it worked.

Read `docs/design/taste.md` first. Output `docs/design/brief.md` and append taste. Render HTML. Gate.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll pick a style from a catalog" | Catalog recombination cannot originate. Intake is the meeting an agency would have. |
| "Lorem is fine for now" | If the content is fake, say plainly that the design will be generic. |

## Red Flags

- Wall of questions
- No anti-references
- No one-word feeling
- Skipping taste.md

## Done when

`docs/design/brief.html` exists, taste.md was appended, and the user approved the brief.
