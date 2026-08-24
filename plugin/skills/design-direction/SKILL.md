---
name: design-direction
description: Three Art Directors in parallel with mutually exclusive mandates. Working HTML comps, not descriptions.
disable-model-invocation: true
---

# design-direction

The mechanism that beats mode collapse: one model asked for three directions returns three variations on its median; three separate contexts with mutually exclusive mandates return three actually different things.

## Procedure

1. **Refuse if no brief.** If `docs/design/brief.md` does not exist, stop and tell the user to run `/design-intake` first.

2. **Constraints, not a look.** Dispatch `design-strategist` (Lane A) with the **paths** to `docs/design/brief.md` and `docs/design/taste.md` — never their contents. It reads taste.md first and returns `docs/design/constraints.md`: jobs-to-be-done, the audience in their specific situation, a short competitive/reference audit. This is what the Art Directors work against, not a style.

3. **Dispatch three `design-art-director` subagents in one message**, each given the brief, constraints, and taste **paths**, and one of these mandates, drawn from the brief's one-word tension:

   - **A — restrained.** Maximum confidence, minimum elements. Type, space, one gesture. Nothing decorative survives.
   - **B — expressive.** Lead with the signature element. Motion, texture, and scale contrast are the argument.
   - **C — structural.** The layout system is the idea — editorial grid, rules, density, information as the aesthetic.

   Each returns `docs/design/directions/{a,b,c}.html` — a **working single-page comp**: real type, real colour, real spacing, one real interaction — plus a one-paragraph rationale and a named signature element in `docs/design/directions/{a,b,c}.md`.

4. **Hard rules, checked on every comp:**
   - Names one anti-reference it is deliberately not doing.
   - States its signature element in one sentence, or says plainly it does not have one — never a vague gesture toward one.
   - None of the three may reach for the default system font stack as a display face, a uniform large radius on every element, or a purple-to-blue decorative gradient. These are not banned outright; reaching for them as a reflex is the exact failure this command exists to break, so a comp that uses one must say why it earned its place here.

5. **Convergence check.** Score each pair of comps against the structural tells in `skills/design-critique/references/anti-slop-rubric.md` (path only — do not paste the table). If a pair matches on 0.7 or more of the applicable structural tells, send the weaker of the two back to its Art Director, naming the specific tells it shares with the other. Regenerate and recheck. Two regenerations without divergence: stop and escalate to the user with what keeps converging, rather than looping silently.

6. **Write `docs/design/compare.html`** rendering all three at 1440 and 390, with the recommendation in the canonical form:
   `Recommendation: <direction> because <specific reason naming what it does that the others don't>`

7. **Gate.** Decision brief with the three options. The user picks one outright or grafts elements across — either is valid. Append `docs/design/taste.md` with the choice, the two rejects, and the reason for each.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "One model can write three directions in one reply" | That produces three variations on the same median. Separate contexts, mutually exclusive mandates. |
| "A mood board is enough for this round" | The output is a working page the user can open and click, not a description of one. |
| "The gradient is only decorative here, it's fine" | It's exactly the reflex being broken. If it earns its place, the comp must say why — silence is the tell. |
| "Two comps are close but not identical, that's fine" | The convergence check runs on the rubric's structural tells, not on a feeling of similarity. Score it. |
| "I'll paste the brief into each dispatch so nothing gets lost" | Pasted content stays resident in your context across all three dispatches. Pass the path. |
| "Skip the strategist step, the brief already has enough" | The brief is the client's account of the problem. Constraints are the Art Directors' shared ground — skipping it lets each one invent its own. |

## Red Flags

- Descriptions or mockup text where a working HTML comp should be
- A comp with no named signature element and no admission that it lacks one
- Two comps sharing the same structural tells with no send-back
- A recommendation without a `because` naming what the winner does that the others don't
- Brief or constraints content pasted into a subagent dispatch instead of a path
- Proceeding into `/design-system` before the user has picked or grafted

## Done when

All three comps render, `compare.html` exists with a specific recommendation, the convergence check ran, the user picked or grafted a direction, and `docs/design/taste.md` was updated with the choice and both rejects.
