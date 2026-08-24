# When a candidate needs an Architect consult

Load this when it is unclear whether a sprint candidate crosses the "non-obvious"
line in step 5 of `SKILL.md`, or when writing the consult brief itself.

## The line

Consult the Architect when the answer to "how big is this and what could go
wrong" depends on information you would have to go read code to get. Skip the
consult when it doesn't.

**Skip the consult:**
- Adding a field to an existing form that already has a save path.
- A copy or styling change with no schema or API surface.
- A CRUD item that mirrors three others already shipped this quarter.
- Anything the roadmap's own "why" already sized correctly.

**Consult the Architect:**
- Touches a schema on a table with real production rows (backfill risk).
- Adds or changes a third-party integration (rate limits, auth flows, webhook
  semantics you don't already know cold).
- Crosses more than one existing module boundary.
- The done-condition depends on a system's current behavior you have not
  personally verified this sprint (e.g. "the export already streams" — does
  it, or does someone remember it that way?).
- Two candidates in the same sprint plausibly touch the same files — ask the
  Architect to flag the conflict before `/sage-dag` has to untangle it.
- Anything where a wrong size estimate changes whether the item fits this
  sprint at all.

When genuinely unsure, consult. A skipped consult that turns out to matter
costs a mid-sprint replan; a consult that turns out to be unnecessary costs one
round trip.

## Writing the brief

`.sage/sprints/NN/plan-brief.md` should give the Architect exactly what it
needs to answer feasibility and risk — not the whole spec draft, not the
roadmap. A good brief:

```markdown
# Feasibility check — sprint NN

## Candidate
<one paragraph: what the item is, in product terms>

## Question
<the specific thing you need sized or risk-assessed>

## What you may need to know
<file paths, table names, or integrations relevant to the answer —
paths only, let the Architect read them itself>

## Constraints
<sprint length, anything already ruled out, related items in this sprint
that might collide with this one>
```

Keep it to the one question that's actually blocking the priority/sequence
decision. A brief that asks five things gets five shallow answers, same as a
five-part question to the user.

## What comes back

The Architect's answer belongs in the sprint's risk section if it surfaces a
named risk, or directly shapes the done-condition if it changes what "shipped"
means for that item. Either way, log it — a feasibility answer that only lives
in the dispatch transcript is not available to `/sage-dag` when it plans the
same item three days later.
