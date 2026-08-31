---
name: canary
description: Catalog skill — percentage rollouts, abort criteria, metrics. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "shipping a risky change behind a staged rollout"
---

# canary

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Pick the rollout metric before picking the percentage — error rate, p99 latency, a business metric (checkout completion) — whichever one actually catches the failure mode you're worried about. A canary watching the wrong metric is theater.
2. Define the abort threshold as a number, not a feeling: "error rate > 2x baseline for 5 consecutive minutes," not "if it looks bad."
3. Start at a percentage small enough that a full failure doesn't page anyone but the person running the rollout — 1% or a single host, not 10%.
4. Automate the rollback path before you start, not after you need it. If rolling back requires a human to remember the right command under pressure at 2am, the canary isn't safe, it's a delayed incident.
5. Hold each stage long enough to cross a real traffic cycle (weekday peak, not a quiet Tuesday 3am) before advancing — a canary that only ever ran during low traffic hasn't been tested against the load that matters.
6. Compare the canary against a control cohort of the SAME traffic mix, not against last week's aggregate — otherwise a normal week-over-week shift gets misread as the canary's fault.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "1% is basically nothing, let's start at 10%" | 10% of a high-throughput service can be more absolute requests than most staging environments ever see. Blast radius is a function of actual traffic, not the percentage's smallness. |
| "We'll watch the dashboard manually" | Manual watching stops at 6pm. An unattended canary with no automated abort only fails safely during business hours. |
| "The metrics dashboard already exists, that's our abort criteria" | A dashboard existing isn't the same as a documented number someone will act on before things get worse. Write the threshold down before you start, or you'll rationalize a bad number in the moment. |
| "It passed staging, canary is just a formality" | Staging traffic shape, data volume, and downstream dependency behavior routinely differ from production in exactly the ways that matter — that's the entire reason canary exists as a separate stage. |

## Red Flags

- Abort criteria described in adjectives ("bad," "weird") instead of numbers
- No automated rollback — the plan is "someone reverts the deploy"
- Canary and control compared against different time windows
- Rollout percentage increased on a fixed timer regardless of what the metrics show

## Done when

The abort threshold is a specific number tied to a specific metric, the rollback is one command or fully automatic, and the rollout advanced only after clearing a real traffic cycle at each stage.
