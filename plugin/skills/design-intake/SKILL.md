---
name: design-intake
description: Design intake. One question at a time. Writes docs/design/brief.md and appends taste.md.
disable-model-invocation: true
---

# design-intake

Design Director on Lane B (`sage consult --role design-director --session --brief docs/design/brief.md`). Shares Product's lane and mechanism — this is the same job: a long interrogation where being wrong is expensive. If `claude` is missing, warn once and fall back to running the interrogation on Lane A `grok-4.6` in this thread, same as `product_mode: hybrid`. Never fall back silently.

Cap is 900 lines like `sage-shape` because the interrogation content **is** the skill. Do not compress the question list below into a summary — ask each one, in this order, and do not move to the next until the current one is actually answered.

## Procedure

1. **Ground.** Read `docs/design/taste.md` if it exists — every rejected direction and every reason belongs in this conversation before the first question is asked. Read any existing `docs/design/brief.md` (a re-run amends, it does not restart). `sage recall "<framing>" --kind learning`.

2. **Interrogate, one question at a time.** Do not bundle. Do not infer an answer from an earlier one and skip asking — confirm it out loud even when it seems implied.

   **Purpose and stakes.**
   "What is this for, and what happens to the business if it works?"
   Push past a mission statement. If the answer is abstract ("build our brand"), ask what changes in the business the day it's working — revenue, signups, a number, a behavior.

   **The person.**
   "Who uses this? Not a persona — a specific person, in a specific situation. What device are they on? What's their state of mind right when they land here?"
   Reject a demographic ("25–34, urban professionals"). That is a persona wearing a person's clothes. Demand someone the user could describe sitting at a desk or standing on a platform.

   **Before and after.**
   "What are they doing immediately before they land on this page, and immediately after they leave it?"
   This is what tells the Art Directors what state of attention they're designing for — rushed, idle, anxious, comparing tabs.

   **The three-second feeling.**
   "What should someone feel in the first three seconds? One word."
   Take the word. Then: "Now a second word — the one sitting right behind it."
   Then ask directly: "Are those two in tension?" If the user says no but the words plainly pull against each other (e.g. *calm* and *urgent*), name the tension yourself and get them to confirm or correct it. This pair is the single most load-bearing artifact of the whole intake — it's what splits into the three mandates in `/design-direction`.

   **Admired references — specifically what.**
   "Name three products whose design you admire."
   For each one, force specificity before moving to the next: "What exactly — the type, the motion, the density, the restraint, the audacity? Not 'I like how it looks.' The mechanism." An answer that stays at "it's clean" is not usable; keep asking "clean how" until it names something buildable.

   **Anti-references.**
   "Name three you don't want to look like."
   Do not accept "nothing specific" — everyone has at least one thing they open and wince at. This list is more informative than the admired one, because it draws the boundary the Art Directors' anti-references get assigned from.

   **The friend test.**
   "What's the one thing on this page you'd want someone to describe to a friend?"
   If the user can't answer, say so plainly: that's the first sign there's no signature element yet, and `/design-direction` will have to manufacture one from everything else in this brief.

   **Brand assets.**
   "What already exists — logo, colors, type, voice? Of what exists, what's fixed and what's negotiable?"
   Get an explicit split. "Keep it mostly consistent" is not a split — ask item by item if the user stalls: logo mark, wordmark, the specific hex values, the type family, the voice.

   **Constraints.**
   Ask as a block, then confirm each one lands somewhere concrete, not "the usual": stack, CMS, accessibility floor (name a standard — WCAG 2.2 AA is the default if the user has no opinion), performance budget (or confirm the §10.6 defaults — LCP 2.5s / CLS 0.1 / INP 200ms — apply), browser support, and who maintains this after ship.

   **Content reality.**
   "Is the content real, or is it lorem ipsum right now?"
   If it's lorem: say plainly, in the brief and out loud, that the design will be generic no matter what we do until real copy exists — a layout can only be as specific as the words in it. Ask whether real copy will exist before `/design-direction` runs, and record the answer either way. Do not soften this into a footnote.

   **Success signal.**
   "How will we know it worked?"
   Reject a vanity metric with no observable behind it ("it'll look more professional"). Push for something measurable or at least falsifiable.

3. **Synthesize the tension back to the user** before writing anything — read back the one-word pair, the admired mechanisms, and the anti-references, and get an explicit "yes, that's right" before drafting.

4. **Write `docs/design/brief.md`.** No template file exists for this yet — write it directly, one section per question above: Purpose & stakes; Audience (the specific person, device, state of mind, before/after); Feeling (the word pair and the named tension); Admired (three, each with its mechanism); Anti-references (three); Friend test; Brand assets (fixed vs. negotiable); Constraints; Content reality; Success signal. A re-run amends this file and marks superseded sections rather than deleting them, same discipline as `<notebook>/roadmap.md` (`<notebook>` is the configured notebook root, `docs/` by default).

5. **Append `docs/design/taste.md`.** New entry: date, project, the one-word feeling pair and its tension, the three anti-references. This is what every later Art Director and every future intake reads first — it is the record that stops the tenth project looking like the first.

6. **Render.** `sage notebook render docs/design/brief.md` then `sage notebook index`.

7. **Gate.** Decision brief. Do not let the session proceed into `/design-direction` without an explicit approval of the brief as written.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll pick a style from a catalog" | Catalog recombination cannot originate. This intake is the meeting an agency would have instead. |
| "I'll infer the audience from the brand positioning" | A brand statement is not a person. Demand someone specific, on a specific device, in a specific state of mind. |
| "Those two feeling-words are basically synonyms, skip the tension" | The tension is usually the most useful thing in the whole brief. Do not let the user wave past it. |
| "They said they don't have anti-references, moving on" | Everyone has at least one site they wince at. Push once more before accepting the gap. |
| "Lorem is fine for now, I'll note it and keep going" | Say it plainly, at the moment, that the design will be generic regardless — not as a footnote nobody reads. |
| "The brief is close enough to what they said, I'll just write it" | Read the synthesis back and get explicit confirmation before drafting. Close enough drifts. |
| "I'll bundle the constraints and content-reality questions to save turns" | Constraints and content reality get confirmed item by item. A block answer hides gaps. |

## Red Flags

- More than one question asked in a single turn
- A persona ("young professionals") standing in for a specific person
- An admired reference recorded without the follow-up "specifically what"
- The anti-reference question skipped or answered "nothing specific" without a push
- A one-word feeling recorded with no second word, or a named tension left unconfirmed
- Lorem content noted without the plain "the design will be generic" statement
- `docs/design/taste.md` not appended
- Proceeding to `/design-direction` without user approval of the brief

## Done when

`docs/design/brief.html` renders, every required question above has a concrete (not vague) answer on record, `docs/design/taste.md` was appended with this project's feeling pair and anti-references, and the user has explicitly approved the brief.
