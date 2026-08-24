---
name: sage-shape
description: Project intake. One question at a time. Writes docs/roadmap.md and renders HTML.
disable-model-invocation: true
---

# sage-shape

Product on Lane B (`sage consult --role product --session --brief <file>`). If `product_mode` is `hybrid` or `claude` is missing, run the interrogation on Lane A `grok-4.6` in this thread and send only the premise challenge and final drafting to Lane B. Warn once, never silently.

## Procedure

1. **Ground.** Read `docs/preferences/`, existing `docs/roadmap.md`, and `sage recall "<framing>" --kind learning`.
2. **Interrogate, one question at a time.** Cover: who has the problem; what they do instead; the narrowest useful wedge; user stories in their words; ideal flow screen-by-screen or call-by-call; the observable that tells us it worked; what is explicitly out of scope and for how long.
3. **Demand test.** Interest is not demand. Waitlists and "that's interesting" do not count. Behavior counts. Money counts. Panic when it breaks counts.
4. **Premise challenge.** Always Lane B, even in hybrid. Argue the project should not be built, or should be built differently. Present the strongest point even when you disagree.
5. **Alternatives — mandatory.** At least two materially different shapes with the trade-off named.
6. **Write the roadmap** from `templates/roadmap.md`. Not a spec — a map with why and observable success per row. Re-runs amend; superseded sections are marked, not deleted.
7. **Render.** `sage notebook render docs/roadmap.md` then `sage notebook index`.
8. **Gate.** Decision brief. Stop.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I already know what they want, I can skip questions" | Cold assumptions write the wrong map. One question at a time is the product. |
| "I'll bundle five questions to save time" | A wall of questions gets a wall of shallow answers. Serial questions are the method. |
| "Interest on the waitlist is enough demand" | Interest is not demand. Behavior, money, or panic when it breaks counts. |
| "One option is fine if it's obviously right" | A single option is not a decision. Generate at least two shapes. |
| "I'll replace the old roadmap, it's cleaner" | Amend and mark superseded. Deleting history deletes the why. |

## Red Flags

- More than one question in a single turn
- Roadmap rows without a why or an observable
- Premise challenge skipped or run on Lane A in full mode
- HTML not rendered
- Proceeding without an explicit user approval

## Done when

`docs/roadmap.html` renders, every feature row has a why and an observable success signal, and the user has approved the roadmap.
