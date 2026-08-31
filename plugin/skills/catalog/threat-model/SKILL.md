---
name: threat-model
description: Catalog skill — assets, attackers, STRIDE-style abuse cases. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "naming who can hurt this system and how"
---

# threat-model

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. List the assets worth protecting by name — specific data (customer PII, payment tokens, source), specific capabilities (ability to deploy, ability to send email as the company) — not "the system" as one undifferentiated blob.
2. Draw the trust boundaries: every place data crosses from one zone of control into another — public internet to edge, edge to internal service, service to third-party API, service to database. Each crossing is where an attacker's input becomes your input.
3. Name attacker classes separately, since they have different capabilities: an anonymous internet user, an authenticated-but-untrusted user (your own customer), a malicious or compromised insider, a compromised third-party dependency. A model that only considers "external attacker" misses insider and supply-chain abuse cases entirely.
4. For each trust boundary, run STRIDE against what crosses it — Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege — and record an explicit yes or no per category rather than skipping the ones that seem irrelevant.
5. Turn each plausible STRIDE hit into a concrete abuse case, not an abstract label: not "tampering is possible" but "a user with a valid session token can replay a modified webhook payload to grant themselves a role, because the handler never verifies the signature before applying it."
6. Rank abuse cases by attacker capability required multiplied by impact if it succeeds, not by novelty — a boring, low-skill, high-impact case (an internal API reachable from the public internet) outranks a clever low-impact one.
7. Hand the ranked abuse cases off as input to a security-audit pass or a fix cycle — a threat model with no attached next step is a document nobody revisits.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We already did a security audit, this is redundant" | An audit checks a specific system as built against known checks; a threat model asks who would want to attack it and how, independent of what's implemented yet — it surfaces abuse cases an audit checklist has no line item for. |
| "Our attacker is just random bots, not sophisticated" | Low-effort attacker classes — credential-stuffing bots, scanners — are exactly what automated abuse cases like account takeover and enumeration are built for; unsophisticated doesn't mean low volume or low impact. |
| "Insider threat isn't realistic for a team our size" | A small team means every engineer plausibly has broad access; the relevant scenario is usually a compromised laptop or leaked credential acting as that insider, not malice — access breadth is the risk, not headcount. |
| "We'll threat-model once the design is finalized" | Trust boundaries drawn after implementation tend to match the code's accidental structure instead of an intentional one — doing it earlier is what lets the design put a boundary where one is actually needed. |

## Red Flags

- Assets listed as "the database" or "the system" instead of named data or capabilities
- Only one attacker class considered, usually "external hacker"
- STRIDE categories skipped rather than explicitly ruled out per boundary
- Abuse cases with no severity or next action, sitting in a document nobody owns

## Done when

Every trust boundary has an explicit yes/no against each STRIDE category, at least one concrete abuse case exists for each "yes," and the abuse cases are ranked with a named next step — audit, fix, or accept.
