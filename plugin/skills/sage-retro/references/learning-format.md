# Learning record format and the update-vs-new-file decision

**Trigger:** load this while drafting a learning in step 3 of `SKILL.md`, or
whenever a `recall dedup` result is borderline and it's unclear whether it
should update an existing record or become a new file.

## Full shape

```markdown
---
title: Stripe webhook retries duplicate on 5xx
kind: learning
category: integrations
tags: [stripe, webhooks, idempotency]
applies_when: "handling third-party webhooks with at-least-once delivery"
severity: high
sprint: "03"
created: 2026-08-21
---

## What happened
## Why it happened
## What to do next time
## How we'd detect it earlier
```

`applies_when` is the retrieval key. It answers "is this relevant to what I'm
doing right now," which a `title` alone cannot — a title tells you what
happened, `applies_when` tells you when to go looking for it. Write it as a
situation, not a summary: "handling third-party webhooks with at-least-once
delivery," not "Stripe retry bug."

## Worked example: retro run twice on the same problem

**Sprint 03 retro.** A notable problem: Stripe retried a webhook after a 5xx
and the handler processed it twice, double-crediting an account. Draft:

```yaml
applies_when: "handling third-party webhooks with at-least-once delivery"
severity: high
sprint: "03"
```

`recall dedup --applies-when "handling third-party webhooks with
at-least-once delivery"` returns nothing above threshold — first occurrence.
Write the file: `docs/learnings/integrations/stripe-webhook-retry-dedup.md`.

**Sprint 07 retro.** A different notable problem this sprint: a GitHub
webhook for a check-run event also arrived twice and triggered a duplicate
CI dispatch. Draft:

```yaml
applies_when: "handling webhook deliveries from an external service that
  may retry on failure"
severity: high
sprint: "07"
```

`recall dedup --applies-when "..."` scores this above threshold against the
sprint-03 record — different vendor, same underlying situation (at-least-once
webhook delivery with no idempotency key). **This is the required
behavior:** update the sprint-03 file in place rather than writing a second
one. Concretely:

- `created:` stays `2026-08-21` — it's still the same learning, first
  observed then.
- `sprint:` becomes `"03, 07"` (or a small list) — both occurrences on
  record.
- The four body sections get revised, not appended verbatim — "What happened"
  now describes the pattern across both incidents (Stripe *and* GitHub), not
  just the first one; "What to do next time" generalizes the fix (check for
  and honor an idempotency key / delivery-id header on any webhook receiver)
  rather than staying Stripe-specific.
- `applies_when` may get sharpened toward the more general phrasing from the
  second draft, since that's the wording that actually matched both.

**What doesn't happen:** a second file
`docs/learnings/integrations/github-webhook-retry-dedup.md` sitting next to
the first, both saying almost the same thing, neither one showing up as an
obvious duplicate to the next person who searches. That's the 79-file
unindexed-pile failure mode this dedup step exists to prevent.
