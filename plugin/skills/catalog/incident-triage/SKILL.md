---
name: incident-triage
description: Catalog skill — severity, blast radius, rollback, comms. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "responding to a production incident"
---

# incident-triage

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Assign severity from a fixed rubric (SEV1 full outage, SEV2 major degradation, SEV3 partial or workaround-available, SEV4 minor) within the first few minutes, based on customer and revenue impact — not on how alarming the alert sounds.
2. Name an incident commander immediately, distinct from whoever is heads-down debugging — the IC coordinates and decides; they don't also write the fix.
3. Establish blast radius before hypothesizing root cause: which services, regions, and share of traffic or customers are affected, and is it still growing. This is what decides whether you mitigate now or keep investigating.
4. Mitigate before you fully understand: reach for the fastest safe stop-the-bleeding move — rollback, feature flag off, traffic shift, scale up — rather than holding mitigation until root cause is confirmed. Root cause can wait; customer impact can't.
5. Post a status update on a fixed cadence, even if the content is "still investigating, nothing new" — silence reads to onlookers as either resolved or abandoned.
6. Downgrade or resolve severity explicitly, with a timestamp, once impact actually drops — the timeline should show when things got better, not just when someone noticed.
7. Write a blameless postmortem within a set window covering the timeline, contributing factors, and concrete owned follow-up actions — not "human error" alone as the root cause.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Let's find root cause first, then we'll fix it right" | Customers are down while you investigate; a rollback that restores service in five minutes beats a perfect fix found in forty-five, and root cause can still be found once the pressure is off. |
| "It's probably fine, let's wait for another data point before declaring" | Waiting to declare delays naming an IC and starting mitigation — severity assessed twenty minutes late is twenty minutes of unmanaged blast radius. |
| "We'll skip the status updates, we're heads-down fixing it" | Stakeholders with no updates start pinging responders directly for status, which interrupts the fix far more than a scheduled broadcast would have. |
| "The postmortem can wait until things calm down" | Exact timestamps, which dashboard first showed the anomaly, who said what — these decay within days; a postmortem written from memory weeks later reconstructs a plausible story, not what happened. |

## Red Flags

- Severity decided informally in chat with no rubric, or never explicitly assigned at all
- No single named incident commander — several people independently deciding next steps
- Mitigation held pending full root-cause understanding while customer impact continues to grow
- Postmortem lists "human error" with no contributing-factors analysis and no owned action items

## Done when

Severity was assigned from the rubric within minutes, a rollback or equivalent mitigation restored service before root cause was fully understood, and a blameless postmortem with a timestamped timeline and owned action items is published within the team's SLA window.
