---
name: design-critique
description: Anti-slop + WCAG critique on Lane C against real screenshots at five viewports.
disable-model-invocation: true
---

# design-critique

Design Critic on Lane C (`gpt-5.6-sol-medium`), `readonly: true`, `no_children: true`. Because the Critic cannot dispatch its own children, this skill splits capture from judgement the same way `sage-verify` does: `qa-driver` (Lane A, Browser) captures; the Critic judges. The capturer marking its own work would be one witness reviewing itself — the split is the point.

**Before starting a critique pass, load `references/anti-slop-rubric.md` and `references/accessibility-pass.md`** — the full tables live there; this file carries only the procedure and the pointer.

## Procedure

1. **Refuse if there's nothing to critique.** Need a built page — from `/design-build` standalone, or a UI node's rendered result inside a sprint. If neither exists, say so and stop.

2. **Dispatch `qa-driver`** (Lane A, Browser) against the page **path**, not pasted markup: navigate, screenshot at 390 / 768 / 1024 / 1440 / 1920, capture console output, and pull the computed-style facts the mechanical checks need — `padding-block` per section, `max-width` distribution, `font-size` min/max, `border-radius` distribution, `box-shadow` values, `font-family` on `h1`, gradient and emoji occurrences, animation/easing config, `:hover` diffs, presence of `prefers-reduced-motion` handling. Write every artifact under the evidence directory (`<notebook>/sprints/NN/evidence/` inside a sprint — `<notebook>` is the configured notebook root, `docs/` by default, per `rules/sage-conduct.mdc` — `docs/design/critique/evidence/` standalone). A check with no artifact did not run — do not accept a verdict without one.

   If the page could not be opened, `qa-driver` says so and this skill reports nothing invented rather than guessing at findings.

3. **Dispatch the Critic** with **paths** to the evidence artifacts, `references/anti-slop-rubric.md`, and `references/accessibility-pass.md` — never the contents pasted into the prompt. It runs both rubrics and emits one JSONL finding per line in the §5.6 schema (`severity`, `confidence`, `path`, `category`, `summary`, `evidence`, `fingerprint`). Every mechanical check cites the computed value or the screenshot it came from; every judgement check (rubric #7, #19, #20, and any accessibility-pass call the Critic can't resolve mechanically) is labeled as judgement in the finding, not presented as equal-weight to a measured one.

4. **Gate the findings.** Any finding whose `evidence` field is absent or empty has its confidence rewritten to `min(confidence, 5)`, full stop — no exception for a finding that "feels" high-confidence. Dedup by fingerprint; where the same tell surfaces from both rubrics independently, boost confidence by +1 (capped at 10) and tag it multi-confirmed.

5. **Classify against the severity map** in `references/anti-slop-rubric.md`: three or more Structural hits is an automatic High regardless of the rest of the page. Performance breaching LCP > 2.5s, CLS > 0.1, or INP > 200ms is a Blocker on its own, independent of every other finding. Blocker and High gate the merge; Medium and Nitpick do not — never report a Medium as though it blocks.

6. **Write findings and route them.** `docs/design/critique/findings.jsonl` (or the sprint's evidence path) plus a rendered report. Inside a sprint, Blocker and High findings route back as new nodes into `/sage-build`, exactly like a code review finding — the Critic never patches inline. Standalone, they route back to `/design-build`.

7. **Gate.** Decision brief with an explicit merge recommendation — ship, or send back with the specific Blocker/High findings named.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know this pattern is slop without looking" | No finding without something actually observed in a screenshot or a computed value. |
| "It's close enough, I'll approve it" | Three Structural hits is an automatic High. Name them; don't average them away. |
| "Confidence 8, I just couldn't quote the value" | The gate rewrites that to 5. Do not invent evidence to protect a score. |
| "The judgement calls are basically as solid as the mechanical ones" | Label them. A judgement finding sits differently than a measured one, and the report must say which is which. |
| "I'll fix the CSS myself while I'm in here" | The Critic is readonly and cannot dispatch children. Findings route back as nodes; this skill never patches. |
| "Couldn't open the page, I'll still file what I'd guess is wrong" | If `qa-driver` couldn't open it, say so and report nothing invented. |
| "This is just a Medium, but I'll flag it as blocking to be safe" | Overstating severity burns the same trust as understating it. Use the map. |

## Red Flags

- A critique with no screenshot artifacts backing it
- A finding at confidence ≥ 7 with no quoted evidence after the gate ran
- A judgement-call finding presented without being labeled as one
- Three or more Structural hits present but the page still recommended as clean
- A Medium or Nitpick treated as gating
- Performance numbers estimated instead of read from `qa-driver`'s capture
- The Critic dispatching anything — it is `readonly` and `no_children`

## Done when

Screenshots and computed-style artifacts exist for all five viewports, both rubrics ran, the confidence gate and dedup were applied, findings are classified against the severity map with judgement calls labeled, Blocker/High findings were routed back as nodes (or to `/design-build` standalone), and the merge recommendation is explicit.
