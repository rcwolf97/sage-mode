# A worked transcript, ground to gate

Load this file before your first live run of `sage-shape`, to see the whole procedure play out once on a single small example, or when asked directly to demonstrate the procedure rather than just follow it. It is not a script to reuse verbatim — the actual questions and follow-ups in `SKILL.md` are the patterns to internalize; this is one illustration of how they chain together in a real session, including the parts that don't go smoothly on the first try.

The project: a small internal tool team wants to build "something to help people find the right internal doc faster." That framing is exactly the kind of thing this skill exists to sharpen or redirect.

## Ground

`sage recall "internal doc search" --kind learning` returns one hit: a prior retro note reading *"the last internal-tools intake for this team wrote a wedge that was really three features; watch for re-bundling."* That context shapes the first question below — it's asked with the narrowing follow-up already primed, rather than waiting to discover the same pattern from scratch.

`docs/roadmap.md` does not exist yet. This is a fresh intake.

## Interrogate

**2.1 — who has the problem**

> Q: "Who specifically runs into trouble finding a doc — not 'the team' in general, one real person, one real moment."
> A: "Probably any new hire in their first month."
> Follow-up: "Pick the most recent new hire — walk me through the actual moment they went looking for something and couldn't find it."
> A: "Priya, two weeks ago. She was looking for the deploy runbook and asked three different people in Slack before someone linked it."
> Usable. Recorded: Priya (proxy for new hires in month one), deploy runbook, three Slack asks before resolution.

**2.2 — status quo**

> Q: "Today, with nothing new, what does someone in Priya's position actually do?"
> A: "They ask in Slack, basically."
> Follow-up: "Walk me through it — which channel, how long does it usually take, does it always work?"
> A: "Usually the #eng-help channel. Takes anywhere from five minutes to half a day depending on who's around. It always eventually works, someone always answers."
> Usable. Recorded: workaround is Slack-ask in #eng-help, resolves but with wide, unpredictable latency (5 min–half day).

**2.3 — narrowest wedge**

> Q: "If you shipped exactly one thin slice of this, what's the smallest version Priya would actually use over asking in Slack?"
> A: "A real search bar with good ranking, permissions-aware results, and a 'recently viewed by your team' section."
> Follow-up (recognizing the re-bundling pattern the ground step flagged): "That's three things again — better ranking, permissions, and a team-recency feature. If you had to cut two and ship one, which survives?"
> A: "...better ranking, I guess. The other two are nice-to-haves."
> Usable. Recorded wedge: improved search ranking on the existing search bar, nothing else, for this round.

**2.4 — user stories in their words**

> Q: "What would Priya actually have said, in the moment, about this?"
> A: "She'd say 'I want a good search tool.'"
> Follow-up: "That's the feature, not her complaint. What did she actually say in Slack when she was stuck?"
> A: "Checking the actual thread — she said 'is there a runbook for deploys somewhere? can't find it in search.'"
> Usable, and now sourced: quote pulled from the actual Slack thread rather than invented.

**2.5 — ideal flow**

> Q: "Walk me through it: Priya opens search, types what, sees what first?"
> A: "She types 'deploy runbook', and the top result is the actual runbook doc, not a stale draft or an unrelated doc with those words in the title."
> Follow-up (unhappy path): "What does she see if there genuinely isn't a good match — a blank result, or something else?"
> A: "Good question — right now a bad query just shows nothing, which looks broken. It should at least suggest the top few Slack-recommended docs when confidence is low."
> Usable — happy and unhappy path both captured.

**2.6 — observable success**

> Q: "What's the one thing you'd point to that tells you this worked, without asking anyone?"
> A: "People stop asking in #eng-help as much."
> Follow-up: "How would you actually check that — what specifically, over what window?"
> A: "We could track #eng-help messages tagged with the 'can't find X' pattern week over week, and check click position on search results — did people click the first result, or scroll past three before finding it?"
> Usable: two concrete observables — #eng-help "can't find X" message count, and average click position on search results.

**2.7 — out of scope**

> Q: "What are you deliberately not building in this round, and for how long?"
> A: "We're not doing the permissions-aware results or the recently-viewed section — those were the two we cut a minute ago."
> Follow-up: "For how long — next round, or genuinely undecided?"
> A: "Permissions-aware results, next round for sure once ranking ships. Recently-viewed is genuinely undecided — might not be worth it if ranking alone fixes most of this."
> Usable and specific.

## Demand test

Evidence assembled: one sourced Slack quote from Priya, a described pattern of #eng-help asks resolving in 5 minutes to half a day, and a claim (unverified) that "this happens a lot." Applying the table: the sourced quote plus the described recurring workaround is behavior — real, if currently measured only anecdotally. The unquantified "happens a lot" is not yet demand on its own; it needs the actual count. Ruling: demand evidence is real but currently thin on quantification — record as "moderate, partially confirmed: one sourced instance plus an unverified recurring pattern; recommend pulling the actual #eng-help message count for the last month before treating this as strongly confirmed," rather than either dismissing it or inflating it.

## Premise challenge (Lane B)

Brief written to `docs/.shape-notes/2026-08-24-doc-search.md` containing the wedge, the demand evidence as ruled above, the status quo, and the observable. Consult dispatched with a path only, instructed to argue against the shape.

Lane B's response:

> The demand evidence is one sourced quote and an unquantified pattern — before building a ranking change, pull the actual #eng-help message count for the last month; if it's under, say, ten instances total, this is not yet worth engineering investment and a five-minute fix (pinning the deploy runbook and a few other high-traffic docs to the top of search results manually) would test the hypothesis for near-zero cost. If the count comes back high, ranking is the right call — but building it before checking the count risks solving a problem that turns out to be three people's bad luck rather than a real recurring pattern.

Decision: proceed with the ranking wedge, but the roadmap's premise-challenge section records this objection in full, plus the actual reasoning for proceeding — in this case, the team pulled the #eng-help count before finalizing the roadmap and found 34 "can't find X" messages in the prior month, well above the ten-message threshold Lane B named, which is what justified proceeding rather than settling for the five-minute pin-to-top fix.

## Alternatives

- **Shape A — improved ranking on existing search.** Low structural risk, reuses the existing search bar, addresses Priya's exact case. Doesn't help if the doc simply doesn't exist or is badly titled — ranking can't surface a good match that isn't there.
- **Shape B — a maintained "start here" index page for high-traffic docs, hand-curated.** Near-zero engineering cost, directly fixes the deploy-runbook case today. Doesn't scale — someone has to maintain it, and it degrades silently as the doc set grows unless there's a process to keep it current.

Named trade-off: Shape A is a real engineering investment that scales with the doc set automatically but takes a sprint to build and tune; Shape B is nearly free and fixes today's exact problem but creates an ongoing manual-maintenance burden that tends to rot. Recommendation: Shape A, given the confirmed 34-message-a-month volume — the ongoing maintenance cost of Shape B at that volume would likely exceed the one-time cost of Shape A within a couple of months.

## Roadmap (excerpt)

| Feature | Why | Observable success | Status | Spec |
|---|---|---|---|---|
| Improved search ranking (Shape A) | 34 "can't find X" #eng-help messages in prior month; sourced Priya quote re: deploy runbook | #eng-help "can't find X" messages drop ≥50% within 4 weeks of launch; median result click position moves from 3rd to 1st | planned | — |

Out of scope this round: permissions-aware results (next round, after ranking ships), recently-viewed-by-team section (undecided, revisit if ranking alone doesn't fully resolve the pattern).

## Render and gate

`sage notebook render docs/roadmap.md`, then `sage notebook index`. Decision brief presented per `rules/sage-conduct.mdc`, comparing Shape A and Shape B, recommending Shape A with the volume-based reasoning above. The user approves Shape A as written; the skill is done.
