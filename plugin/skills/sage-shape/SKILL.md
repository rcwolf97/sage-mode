---
name: sage-shape
description: Project intake. One question at a time. Writes <notebook>/roadmap.md and renders HTML.
disable-model-invocation: true
---

# sage-shape

Product on Lane B (`sage consult --role product --session --brief <file>`). If `product_mode` is `hybrid` or `claude` is missing, run the interrogation on Lane A `grok-4.6` in this thread and send only the premise challenge and final drafting to Lane B. Warn once, never silently.

This is the front door. It runs on a brand-new project before there is a spec, a sprint, or a line of code — everything downstream (`/sage-plan`, `/sage-dag`, `/sage-build`, `/sage-ship`) assumes a roadmap this skill produced already exists and was approved. A shallow run here does not fail loudly. It fails quietly, three sprints later, when the team discovers they built the wrong wedge, for the wrong person, in a shape nobody actually asked for. Every question below exists because a specific version of that failure has happened before. Treat all of it as load-bearing, not as a checklist to clear quickly on the way to writing code.

The rest of this file is long on purpose. The interrogation content — the actual question text, the pushback patterns, the demand-test judgment calls, the worked examples — *is* the skill. A thin version of this file that just names the seven topics is not a smaller version of the same procedure; it is a different, much weaker procedure that happens to share a table of contents with this one.

## Hybrid mode in practice

The frontmatter above covers the mechanics: in `product_mode: hybrid`, or when `claude` is missing, steps 2 and 3 (the interrogation and the demand test) run on Lane A `grok-4.6` in this thread instead of on Lane B. Steps 4 (premise challenge) and the final roadmap drafting in step 6 still go to Lane B regardless of mode — that split is fixed, not a judgment call the skill makes per run. "Warn once, never silently" means exactly that: the first time this skill runs in hybrid mode (or falls back to it because `claude` is unavailable) in a given session, say so plainly to the user in one line — *"Running the interrogation on Lane A this session; the premise challenge still goes to Lane B as required"* — and don't repeat the warning on every subsequent question. A user who wasn't told which lane asked which question can't judge the answers with the right context; a user warned on every turn stops reading the warning at all.

## Why the steps are ordered this way

Ground before interrogating, because the notebook may already contain the answer to a question you're about to ask cold, and re-asking a settled question wastes the user's patience for the harder ones still to come. Interrogate before the demand test, because you cannot judge whether evidence is real until you know what claim it's supposed to be evidence for. The demand test comes before the premise challenge, because Lane B's argument is much sharper with the demand evidence already assembled — "the demand is thin" is a specific objection; "have you thought about whether this is worth building" is not. The premise challenge comes before alternatives, because a strong premise objection sometimes *is* one of the alternatives, or reshapes what a second materially-different shape should look like. Alternatives come before the roadmap is written, because a roadmap written around a single shape has nothing to compare its choice against and reads as inevitable rather than decided. The roadmap is rendered before the gate, because presenting an approval request for a document the user cannot actually read defeats the point of asking. None of these steps is optional filler in front of "the real work" of writing the roadmap — each one changes what the roadmap should say.

## Procedure

### 1. Ground

Before asking anything, read `docs/preferences/`, the existing `<notebook>/roadmap.md` if one exists, and run `sage recall "<initial framing>" --kind learning`. (`<notebook>` is the configured notebook root, `docs/` by default — see `rules/sage-conduct.mdc`.) Never start cold when the notebook already has context. A prior retro may have already recorded that this exact kind of feature under-delivered last time, that this user's stated preference is "narrowest possible wedge, always," or that a similar demand claim turned out to be interest rather than demand once it shipped. Surfacing that context early changes which follow-ups you need and which you can skip — you do not need to re-litigate a preference the notebook already states plainly, only confirm it still holds.

If `<notebook>/roadmap.md` already exists, this run is a re-run, not a fresh intake — see the amendment rules at the end of step 6. Read the existing roadmap in full, including its premise-challenge and out-of-scope sections, before asking the user anything. Re-asking a question the existing roadmap already answered wastes the user's patience and signals you skipped the ground step. Where the framing has clearly moved on (a pivot, a new user segment, a scrapped wedge), say so and confirm which parts of the old roadmap still hold before treating anything as settled.

Let the ground step actually shape the first question rather than sitting unused once read. If `sage recall` surfaces a learning like "the last two intakes for this team over-scoped the wedge," don't file that away silently — open with something informed by it: *"Last time around, the wedge ended up covering more than planned. Let's start narrow on purpose this time — who's the one person hitting this problem right now?"* A ground step that gets read but doesn't change the first question asked was not worth running.

### 2. Interrogate — one question at a time

This is the actual work of the skill. Ask exactly one question. Wait for a real answer. Judge whether that answer is usable, or whether it is vague, hypothetical, or a restated feature-wish wearing the shape of an answer. Only once you have something usable do you move to the next topic. Never present the seven topics below to the user as a list, never number them out loud, and never fold two into a single turn because it "feels more efficient" — a compound question gets a compound half-answer, and afterward you cannot tell which half is missing.

**How to run the loop, turn by turn.** Propose one question. Listen to the literal answer, not the answer you expected. Classify it: usable (specific, sourced, concrete), vague (true but unfalsifiable — "it's slow," "people want it"), feature-language (describes the solution instead of the problem), hypothetical (describes an imagined user's imagined reaction instead of an observed one), or off-topic (answers a different, adjacent question). Only "usable" closes the topic. Everything else gets exactly one in-file follow-up from the patterns below; if that doesn't resolve it, load `references/evasive-answers.md` rather than improvising a third attempt or accepting the second answer anyway out of momentum. A topic is done when you could write its roadmap-relevant sentence today, from what was actually said, without inventing a word of it.

The seven topics below MUST all be covered before you move to the demand test in step 3. The order here is a sensible default, not a law — if an early answer already resolves a later topic, confirm it fits and move on rather than re-asking mechanically. What you may not do is skip a topic because it seems implied by another answer; "implied" is exactly the gap where the founder's pitch and the actual user story diverge.

For each topic: ask the question in your own words — the scripts below are patterns to internalize, not lines to recite verbatim every time. If the first answer is vague, feature-flavored, or hypothetical, use the matching follow-up to get underneath it.

**Anti-patterns in how the questions get asked.** A leading question that already contains the answer you expect — *"This is mainly for power users, right?"* — invites agreement rather than information; ask the open version and let the answer surprise you. A false-choice question that offers two options when a third, unlisted one might be true — *"Is this for onboarding or retention?"* — boxes the answer into your framing instead of theirs; ask what it's for, then let them name it. And per the anti-sycophancy rule in `rules/sage-conduct.mdc`, do not open a follow-up with agreement before you've actually pushed on the answer — "Great point, and also, what do they do today?" softens the follow-up into something easy to wave off; state the gap first, agreement (if warranted) after, not before.

**How long is too long.** Depth matters more than speed here, but a topic that has taken more than two or three follow-ups without landing on a usable answer is no longer being clarified — reference `references/evasive-answers.md` at that point rather than continuing to improvise, or, if the reference's patterns don't apply either, say plainly that the topic is going to be recorded as unresolved and move on. An interrogation that never converges is not more rigorous than a fast one; it's stuck.

**2.1 Who has the problem, and what breaks for them today**

Ask: *"Who, specifically, hits this problem? Not 'developers' or 'our users' in the abstract — one real person, in the actual moment something goes wrong for them. What literally breaks — what do they try to do that fails, or what do they end up doing by hand that shouldn't have to be manual?"*

> Bad answer: "Basically anyone who uses the app would benefit from this."
> Follow-up: "That's not a person, that's an absence of one. Pick whoever ran into this most recently — or who would today if they used the product right now. Walk me through their afternoon at the exact moment it goes wrong for them."

Naming a market segment instead of a person is the single most common failure here, and it's dangerous precisely because it sounds like an answer. If the user genuinely cannot name anyone, treat that as real information rather than pushing past it — it usually means the problem was inferred from a market trend rather than observed in an actual person's day, and the demand test in step 3 is going to be hard to pass later.

> Bad answer: "It's just not efficient right now."
> Follow-up: "Not efficient compared to what? What specifically takes too long, and how do you know it takes too long — did someone say that, or is that an assumption you're making on their behalf?"

A vague inefficiency claim dissolves the moment you ask for the comparison it's implicitly making. Push until you get an actual failure: a step that errors out, a manual copy-paste, a thing someone has to remember to do that they sometimes forget.

> Bad answer: "It's a well-known pain point in this industry."
> Follow-up: "Known to whom, and from where — an article, a conversation, a support queue? I need a specific instance you can point to, not an industry-level generalization, even if the generalization is true."

Industry-level framing is a good reason to *look* for a specific instance; it is not itself a specific instance, and the roadmap needs the latter.

**2.2 What they do instead right now — the status quo is the real competitor**

Ask: *"Right now, with nothing new shipped, what does that person actually do when they hit this? Not what they should do — what they actually do, today, without the thing we're discussing."*

> Bad answer: "They probably just deal with it."
> Follow-up: "Deal with it how, specifically? Walk me through the real sequence — do they open a spreadsheet, message someone, switch to a second tool, or just give up and skip the step? I need the actual steps, not a summary of them."

This question matters more than it looks like it does, because every new feature competes against whatever the user already does, and "already does" is very often good enough — annoying, but tolerated, because switching costs more than the annoyance saves. A precise picture of the workaround tells you exactly how high the new thing's bar is.

> Bad answer: "There's no real alternative, they just can't do it at all right now."
> Follow-up: "So right now the thing just doesn't happen — nobody does it, in any form? That's a different and harder situation than replacing a workaround: you're not competing with an existing habit, you're trying to create a new one. Is that actually what's going on, or is there some rough version of this happening that we haven't named yet?"

If the honest answer is "nothing happens today," write that down explicitly rather than letting it blend into "the status quo is bad" — creating a new behavior from nothing is a materially harder adoption problem than replacing a worse one, and the roadmap's "why" should say so.

> Bad answer: "Our competitor's product is what they use instead."
> Follow-up: "What do they specifically do inside that competitor's product to solve this — which screen, which action? I want the workaround's mechanics, not just its brand name, because that's what our version has to actually beat."

Naming a competitor answers "where do they go," not "what do they do" — the mechanics of the workaround are what actually sets the bar.

**2.3 The narrowest wedge that's genuinely useful**

Ask: *"If you could ship exactly one thin slice of this and nothing else, what's the smallest version a real user would still choose over what they do today?"*

> Bad answer: "Just the core dashboard — analytics, exports, and sharing."
> Follow-up: "That's still three separate capabilities wearing one name. If you had to cut two of the three and still ship something someone would use tomorrow, which one survives — and why that one instead of the other two?"

Restating the full feature list under a smaller-sounding name is the near-universal failure mode here, because "the core version" sounds narrow while actually changing nothing. Keep pushing until you reach a single capability, not a category. "The dashboard" is a category. "A number on screen that turns from red to green when the overdue count hits zero" is a wedge.

> Bad answer: "It's not useful without all three together."
> Follow-up: "That's a testable claim, not a given — what specifically breaks for the user if only one of the three ships first? Walk me through what they'd actually be stuck unable to do."

Often nothing concrete breaks; the other pieces were assumed necessary rather than verified necessary. If something genuinely does break, that's useful too — it tells you the true minimum bundle, which may be larger than one capability but is still smaller than "everything."

> Bad answer: "Let's just build the whole thing, cutting scope will just mean rework later."
> Follow-up: "Rework on a wedge that turns out wrong costs a sprint. Rework on a full build that turns out wrong costs the whole project, plus everything built on top of it in the meantime. Which failure would actually cost more here?"

Fear of rework is a real cost, but it's rarely evaluated against the much larger cost of building the wrong full thing before anyone has used any of it.

**2.4 User stories in their words, not feature language**

Ask: *"Tell me what the user would actually say out loud about this — the sentence they'd say to a coworker, not the sentence that goes in a ticket."*

> Bad answer: "As a user, I want to filter by date so I can view relevant analytics."
> Follow-up: "That's the feature you're proposing, phrased as a user story — it's not something a person actually said. What's the real complaint or moment that made you think of this? Is there a message, a ticket, a transcript — an actual quote — behind it?"

Feature language dressed as a user story is a subtle failure because the template makes it look sourced when it isn't. If there's genuinely no quote to point to, say so plainly in the roadmap rather than presenting an invented story as if it were observed — "inferred, not sourced" is honest; a fabricated quote is not.

> Bad answer: "Users would say something like 'this is so much easier now.'"
> Follow-up: "That's what they'd say after using the finished feature — I'm asking what they say today, before it exists, about the problem itself. What's the complaint that exists right now?"

Watch for answers that describe the imagined reaction to the solution instead of the actual, present-tense complaint. Only the latter is a real user story.

> Bad answer: "I'm the user too, I know what I'd want."
> Follow-up: "You're one data point, and a biased one — you already know the solution you have in mind, which most users don't. What did someone *other* than you say about this, and if nobody else has, that's worth naming as a gap rather than standing in for it."

Founder-as-user is a legitimate data point but not a substitute for an independent one; conflating the two is exactly the gap the demand test in step 3 exists to catch.

**2.5 The ideal flow — screen by screen, or call by call**

Ask: *"Walk me through it as if I'm watching over their shoulder. They open — what, exactly? What's on the very first screen before they've done anything? Then what do they do, and what happens next?"*

> Bad answer: "They'd just open it and get the answer easily."
> Follow-up: "That's the destination, not the path there. Start me at the very first screen, before any input from them. What's on it? What's the first thing they tap, type, or say?"

A flow description that jumps straight to the payoff has skipped the part that's actually hard to design and easy to get wrong. Walk the whole sequence, including the unhappy path — what does the user see if the thing fails, is empty, or times out? A flow that only covers the happy path isn't a flow, it's a wish.

> Bad answer: "It works basically like [competitor product]."
> Follow-up: "I want our version, not theirs — and I want it step by step. What's the very first screen or the first call in our flow, specifically?"

A competitor reference can be a useful shorthand once the flow is established, but it can't substitute for actually walking the steps; competitors differ in exactly the details that matter for the wedge you chose in 2.3.

> Bad answer: "It's an API, there's no screen to walk through."
> Follow-up: "Fine — walk me through the calls instead. What's the first request, what does it return, what does the caller do with that response before the next request, and what happens if a call in the middle fails?"

An API or CLI feature still has a sequence with a first step, a happy path, and a failure mode; "no screen" is not an exemption from walking it.

**2.6 What observable thing tells us it worked**

Ask: *"What's the one thing you could point to — a number, a message, a piece of behavior — that tells you, without asking anyone, that this worked?"*

> Bad answer: "People would be happier using it."
> Follow-up: "Happier isn't something either of us can point to in three weeks and check. What would you literally measure, or literally see happen, that tells you this landed — a metric moving, a support-ticket category disappearing, someone using it twice in a row without a reminder?"

A feeling is the almost-universal bad answer here, and it's tempting to accept because it sounds like a real goal. It isn't checkable, so it can't do the job an observable is for. Keep pushing until the answer is something a person could point at without asking anyone how they feel.

> Bad answer: "We'll know it worked if engagement goes up."
> Follow-up: "Engagement with what, specifically, and up by how much, over what window? 'Engagement' can mean five different metrics that move in different directions — name the one that's actually tied to this wedge."

A vague metric name is only slightly better than a feeling; it still needs to be pinned to something specific enough to check later without an argument about what it meant.

> Bad answer: "We'll just ask users if it helped."
> Follow-up: "Asking gets you an opinion, and opinions about a feature someone was just handed tend to be generous. Is there something they *do* differently, that we can see without asking — a workaround that stops appearing, a task that gets finished faster, a ticket category that goes quiet?"

Self-report is real information but is not itself an observable of the kind this question needs; it's a supplement to a behavioral signal, not a replacement for one.

**2.7 What's explicitly out of scope, and for how long**

Ask: *"What are you deliberately not building as part of this, and when — if ever — does that change?"*

> Bad answer: "We'll figure that out as we go."
> Follow-up: "That's exactly how scope grows without anyone deciding it should — nothing was ever explicitly excluded, so everything adjacent quietly becomes included. Name at least one adjacent thing you're not building in this wedge, and roughly when you'd reconsider that: next sprint, next quarter, or never."

A single named exclusion is enough to start; more is better, and each one is worth a beat of follow-up on timing, because "out of scope forever" and "out of scope until next sprint" are different commitments and get written differently.

> Bad answer: "Everything except the core is out of scope, obviously."
> Follow-up: "Name two or three specific things, not 'everything else' — I need items a later reader can check the roadmap against and know whether they were excluded on purpose or just forgotten."

"Everything else" is not a list anyone can check against later. Get concrete nouns, not a residual category.

> Bad answer: "Let's leave it open in case we need it."
> Follow-up: "Leaving it open is a decision too, it's just an unstated one. Say plainly whether it's in-scope-later, in-scope-never, or genuinely undecided-pending-something — and if it's the third, name the something."

An unstated "maybe" reads as "in scope" to the next person who touches the roadmap; make the ambiguity explicit if you can't resolve it.

**2.8 Adjusting the seven topics by project type**

The seven topics above don't change, but what counts as a good answer shifts with what's being built. For an **internal tool**, "who has the problem" is a named teammate or team, not a market segment, and the demand test in step 3 draws on internal behavior — Slack complaints, manual spreadsheets passed around, a process someone re-does every Monday — rather than customer signals. For an **API or SDK**, the "flow" in 2.5 is a call sequence and the "user story" in 2.4 is often a quote from a support thread or an integration partner rather than an end user, but it still has to be an actual quote, not an inferred developer need. For a **consumer-facing feature**, watch 2.6 especially closely — "engagement" and "retention" are easy to say and hard to pin down; push for the single metric that's actually tied to this wedge, not the team's general north star. For a **pure content or marketing surface**, the "status quo" in 2.2 is usually a competitor's page or an existing internal doc, and the observable in 2.6 is closer to a conversion or a specific action taken on the page than to product usage — don't force a product-shaped metric onto something that isn't a product.

**2.9 Multiple stakeholders with different problems**

Intake conversations rarely involve exactly one voice. A founder pitches the project, but the people who'd actually use it are a different set of people with their own, possibly conflicting, answers to the seven topics above. When this shows up — the founder says one thing about who has the problem, and a quoted user or support ticket says another — do not silently pick the founder's framing because they're the one in the room. Name the gap out loud: *"You're describing this for [segment A], but the ticket you just quoted is from someone doing [different job] entirely — which one is this wedge actually for?"* If both are real and both matter, that is itself useful roadmap content: it may mean two wedges, not one, and that's a legitimate output of step 5's alternatives rather than a problem to paper over. What's not acceptable is running the whole interrogation against the founder's framing alone and treating a user's contradicting quote as a footnote.

**2.10 When the user wants to skip a step**

Sometimes the person being interrogated will push to shortcut the process directly — "let's skip the questions, I know what I want," "we don't need alternatives, just write the roadmap." Per the escalation rule in `rules/sage-conduct.mdc`, this is not one of the categories that requires stopping to ask the user for permission to proceed differently — it's a ruling call, and the ruling here is fixed: the seven topics, the demand test, the premise challenge, and the mandatory alternatives are the skill, not optional scaffolding around it. State plainly, once, why the step matters for their specific project — not a lecture, one sentence — and keep running the procedure. If they explicitly and repeatedly refuse to answer a specific question after that, record the topic as unanswered in the roadmap rather than inventing an answer on their behalf; an honestly incomplete roadmap that says so is better than a complete-looking one built on invention.

### 3. Apply the demand test

Once all seven topics above are covered, hold every claim of "people want this" up to one standard: **interest is not demand.** Signals that feel like validation — a waitlist, a show of hands, a "that's a cool idea" — are not evidence that anyone will actually use or pay for the thing. Real demand shows up as behavior, money, or pain when something that already exists breaks.

| Signal | Counts as demand? | Why |
|---|---|---|
| Fifty people starred the GitHub repo | No | A star costs nothing to give and predicts nothing about use. |
| Three users hit this exact workaround and complained loudly when it broke | Yes | They were already doing the behavior; its absence caused visible, unprompted pain. |
| A prospect said the deal is blocked until we ship this capability | Yes | Tied directly to money — the strongest form of demand there is. |
| Twelve people said "yes" when asked if they'd use a dark mode | No, by itself | Ask what they do today when it bothers them — if the answer is "nothing, they tolerate it," the "yes" was politeness. |
| Support tickets on this exact failure have been steady for two months | Yes | Recurring, unprompted, specific complaints are behavior, not opinion. |
| The founder is confident this is a market gap | No, by itself | Conviction is a hypothesis worth testing, not evidence the test already passed. |
| A competitor shipped this six months ago | No, by itself | Tells you what a competitor bet on, not what your users need — ask what your users do today instead. |
| Someone on the team built their own script to work around the missing feature | Yes | Voluntary, unprompted effort to solve the problem is behavior. |
| A survey shows 70% would use it if it existed | No | Survey intent is cheap to state and doesn't predict switching behavior — see the waitlist row above. |
| Churn exit interviews name this gap specifically, more than once | Yes | Real people leaving and citing the same reason, unprompted, is strong behavioral evidence. |
| A power user asked, unprompted, "when is X shipping" more than once | Yes, weakly | Repeated unprompted asking is closer to behavior than a single request, but weigh it against how few people are asking. |
| Ten thumbs-up reactions on an internal proposal doc | No | A reaction emoji costs less than a survey answer; treat it as background color, not evidence. |
| An existing free tier is being used heavily, and users hit the paywall on this exact capability and stop | Yes | Hitting a real limit and quitting rather than paying is a strong, if discouraging, behavioral signal. |
| A user copy-pastes data between two tools every week to fake the missing capability | Yes | A recurring manual workaround performed without being asked is behavior, not opinion. |

When a new signal doesn't obviously match any row above, a fast heuristic is **cost to give**: what did it cost the person to produce this signal? A star, a thumbs-up, a "yes" in a hallway — free. A support ticket, a workaround built by hand, money paid, a deal held up — costly. Signals that were free to give are interest until proven otherwise; signals that cost the person something are demand. This heuristic resolves most new cases fast, but it isn't a substitute for the table above when a signal clearly matches a row on it.

A short worked example of the judgment call in practice:

> User: "We know people want this — support gets asked about it a lot."
> Follow-up: "How often, over what period, and asked how — as a complaint about something broken, or as a casual 'could it also do X'?"
> User: "Maybe eight times over three months, and it's usually phrased as 'is there a way to also...'"
> Assessment: eight instances over three months on an unstated total user base is thin on its own, and "is there a way to also" is closer to a feature request than a complaint about something failing. This leans toward *interest*, not demand — worth naming as "moderate, unconfirmed signal" in the roadmap rather than either dismissing it or inflating it to "strong demand." The right next move is often to ask one more question — how many total users could have asked and didn't — before ruling either way.

When the evidence is genuinely borderline even after applying the cost-to-give heuristic, that's the trigger condition for `references/demand-test.md`, which carries more judgment calls and a fuller worked procedure for ruling under uncertainty than fit here. Don't invent a ruling on the spot; load the reference or ask one more clarifying question before writing the roadmap row's "why."

If a topic clears the interrogation in step 2 but fails the demand test, say so out loud rather than quietly writing the roadmap row as though it passed. A row can honestly read "hypothesis, unvalidated" in its why column — that is a legitimate status, and a far better one than a fabricated demand signal the team discovers doesn't hold up three sprints later. Internal tools are not exempt from this test: teammates have a status quo and workarounds too, and the same standard applies whether the evidence comes from customers or colleagues.

### 4. Challenge the premise — mandatory Lane B consult

Run exactly one additional Lane B consult, in both `product_mode: full` and `product_mode: hybrid` — this specific step never moves to Lane A, even in hybrid mode where the interrogation itself did. Its job is adversarial: argue that this project should not be built at all, or that it should be built in a materially different shape than the one the interrogation converged on. This is not a formality and not a rubber stamp. It needs to be a real, specific argument built from what was actually said in steps 2 and 3 — not a generic "have you considered the risks?" paragraph that could apply to any project.

Frame the consult narrowly. Pass it a **path** to the interrogation notes — never paste the transcript into the dispatch prompt itself; see the files-not-paste rule in `rules/sage-conduct.mdc`. The brief file itself should carry, at minimum: the wedge as currently scoped, the demand evidence and its strength from step 3, the status quo from 2.2, and the observable from 2.6 — enough for Lane B to argue against the actual shape, not a guess at it. Instruct it explicitly to argue *against* the current shape, not to summarize or validate it:

```
Brief: docs/.shape-notes/2026-08-24-overdue-reminders.md

You are reviewing a project intake before a roadmap gets written.
Do not summarize what's in the brief. Argue against it.

Give the strongest case that this project should not be built as
scoped, or should be built in a meaningfully different shape.
Ground the argument in what the brief actually says — the status
quo described, the demand evidence given, the wedge chosen — not
in generic risk language. One specific paragraph beats five vague
ones.
```

A usable response is specific and inconvenient on purpose:

```
The demand evidence here is three support tickets over two months
on a team of forty. That's real pain, but it's thin — not enough
people hitting it often enough to justify standing infrastructure.
It may justify a one-time data cleanup and a canned response instead
of a feature. Before building the reminder system, find out whether
those three people are still doing the manual workaround today or
quietly stopped needing it. If build-anyway is the call, the cheaper
version is a scheduled export through an existing email tool, not
new in-app infrastructure — same observable outcome, a fraction of
the cost, and disposable if the demand signal doesn't grow.
```

A second, shorter example for a different kind of project — one where the honest challenge is about sequencing rather than whether to build at all:

```
The wedge is fine; the order is backwards. You're proposing to build
the export feature before anyone has used the dashboard it exports
from long enough to know which columns matter. Ship the dashboard
alone first, watch what people actually look at for two weeks, then
build export around the columns that turn out to matter. Building
both at once means guessing at the export format now and probably
rebuilding it once real usage tells you what it should have been.
```

If the response that comes back is generic — restates the wedge approvingly, lists abstract risks ("scalability," "maintenance burden") without tying them to anything in the brief — that is not a completed premise challenge. Send it back once with a pointed instruction: name the single weakest part of *this* brief specifically, not a category of risk every project shares. A premise challenge that could have been written without reading the brief has not done its job.

The rule that matters most here: present the consult's strongest point in the roadmap even when the decision goes the other way. If the team decides to build anyway, the roadmap's premise-challenge section states the objection in full — the thin ticket count, the "quietly stopped needing it" question, the cheaper alternative, or the sequencing argument — followed by the actual reasoning for proceeding regardless. Summarizing the objection down to "we considered risks and decided to proceed" defeats the entire point of running this step. A reader of the roadmap six months later needs to see exactly what was argued and exactly why it didn't change the call, not a sentence that could have been written without ever running the consult.

### 5. Generate alternatives — mandatory

Produce at least two materially different shapes for the same underlying goal, with the trade-off between them named explicitly. A single option, however obviously correct it looks, is not a decision — it's a decision with the comparison hidden. Before treating two shapes as materially different, check: do they trade a real cost against a real benefit in different directions (immediacy vs. reach, safety vs. capability, speed to ship vs. flexibility later)? If both shapes would be built the same way, with the same data, and differ only in surface presentation, they are one shape, not two — go back and find one that actually trades something.

A worked example, for a plausible goal ("remind users about overdue tasks so they act on them"):

- **Shape A — real-time in-app indicator.** The moment a task goes overdue, a badge appears in the app the next time it's opened; no push, no email. Cheap to build, and immediate the instant someone looks — but invisible to anyone who's stopped opening the app, which is arguably the person most overdue in the first place.
- **Shape B — daily digest email.** Once a day, a single email lists everything overdue. Reaches people even when they've stopped opening the app, and is simple to reason about — one job, one time, one message — but it's batched rather than immediate, competes with every other email in an inbox, and a persistent skipper can stop reading it just as easily as they stopped opening the app.

Named trade-off: Shape A buys immediacy at the cost of reach — it only works for people already engaged. Shape B buys reach at the cost of immediacy and attention — it works for the disengaged but is easier to tune out. Neither is strictly better; which one fits depends on which failure mode the actual demand evidence points toward. That's the kind of trade-off this step needs — not a coat of paint on the same underlying mechanism.

A second worked example, for a different kind of goal ("help a team find the right document faster"):

- **Shape A — better search.** Improve ranking and add filters on the existing search bar. Low structural risk, works with data that already exists, but only helps people who already know roughly what they're looking for and are willing to type a query.
- **Shape B — a recommended-for-you feed.** Surface likely-relevant documents proactively based on recent activity, with no query required. Helps people who don't know what to search for, but requires new infrastructure to model relevance and risks surfacing the wrong thing confidently, which erodes trust faster than a bad search result does.

Named trade-off: Shape A is safer and cheaper but leaves the "didn't know what to look for" case unsolved. Shape B solves that case but introduces a new failure mode — confident wrongness — that search's honest "no results" doesn't have.

When more than two shapes are genuinely plausible, don't force it down to exactly two just to satisfy the letter of "mandatory" — surface a third if it trades something the first two don't, and let the recommendation in the decision brief do the work of narrowing. What's not acceptable is the reverse: presenting two shapes that are really the same idea with cosmetic differences, to satisfy the letter of the rule while skipping its purpose.

Present all generated shapes as part of the eventual decision brief in step 8, with a recommendation and a specific reason grounded in the demand evidence from step 3 and the premise-challenge findings from step 4 — never as a values-neutral "pick one." That grounding is what makes this step useful instead of decorative.

### 5.5 Self-check before writing anything

Before opening `templates/roadmap.md`, run through this checklist against your own working notes. It exists because it is much cheaper to catch a gap here than after the roadmap is drafted and the user is looking at it.

- Can you write one sourced sentence for each of the seven topics in step 2, without inventing a word of any of them?
- Does the demand evidence for the wedge clear the table in step 3, or is it honestly marked as a hypothesis?
- Did the premise challenge actually run on Lane B, and do you have its response in hand — not a summary you wrote from memory of what it probably said?
- Do you have at least two materially different shapes, each with a real trade-off named, not two versions of the same mechanism?
- Is the out-of-scope list from 2.7 non-empty and specific?

If any item fails, go back to the relevant step rather than writing around the gap — a roadmap drafted over an unresolved item just relocates the problem into a document that looks finished.

### 6. Write the roadmap

Write `<notebook>/roadmap.md` from `templates/roadmap.md`, or update it in place if a roadmap already exists (see the amendment rules below). A roadmap is not a spec. A spec says exactly what to build and how; a roadmap is a **map** — what the feature set is, what order it comes in, why that order, and what state each item is in. Individual sprints, written later by `/sage-plan`, are what turn one roadmap row into an actual spec.

Every row in the feature map table needs, at minimum:

| Feature | Why | Observable success | Status | Spec |
|---|---|---|---|---|
| Red badge on overdue count (Shape A, ch. 5) | 3 tickets/2mo citing missed overdue tasks; workaround (manual weekly review) confirmed active | Badge cleared within 24h of appearing, tracked per user, for ≥60% of occurrences | planned | — |

- **Feature** — named at wedge granularity, not category granularity ("red badge on overdue count," not "notifications system").
- **Why** — the demand evidence from step 3, stated plainly, including its strength; "hypothesis, unvalidated" is an honest entry here, not a failure.
- **Observable success** — the concrete, checkable signal from question 2.6. If this cell can't be filled with something actually observable, the row isn't ready to write — go back and ask again rather than leaving a placeholder.
- **Status** — `planned` (not yet specced), `in progress` (a sprint spec exists and work has started — the Spec column must be filled), `shipped` (the observable has actually been checked, not just deployed), or `superseded` (see below). A row cannot move to `in progress` with an empty Spec column; that combination means the status was updated ahead of the actual work.
- **Spec** — empty until `/sage-plan` produces one, then a link to it.

The roadmap also carries the sections the template defines: why the project exists, who it's for, the wedge that was chosen and why (naming the runner-up alternative from step 5, not silently dropping it), the full out-of-scope list from question 2.7, and the premise challenge's objection in full from step 4.

**Ordering the feature map.** Row order in the table is itself a claim, not just a list — it says "build in this sequence." Default to ordering by dependency first (a row that another row needs goes above it), then by how directly a row targets the wedge from 2.3 (the wedge itself is row one unless something else blocks it), then by how strong its demand evidence is relative to the others. Resist ordering by "easiest to build first" alone — a row that's cheap to build but doesn't touch the actual wedge or its demand evidence is scope creep with good intentions, and putting it first signals it matters more than it does.

A short before-and-after on roadmap prose, since the difference is easy to miss in the abstract:

> Before: "Add notifications so users stay engaged with the product."
> After: "Real-time in-app badge on overdue tasks (Shape A). Why: 3 support tickets/2mo confirm active manual workaround; deal blocked on this per prospect quote 2026-07. Observable: badge cleared within 24h for ≥60% of occurrences, tracked per user."

The "before" version could describe almost any feature in almost any product; it carries no evidence, no wedge boundary, and no way to check later whether it worked. The "after" version is specific enough that a reader six months from now, who wasn't in the room, can tell exactly what was decided and why.

**Re-runs amend, never replace.** This skill runs again on any refactor or major change to the project's direction. When it does, don't overwrite the existing roadmap — add to it. New feature rows get appended to the feature map. A row whose plan has changed gets its status set to `superseded`, with a short note on what replaced it and why, left in place rather than deleted — for example, a row for "daily digest email" that gets set to `superseded — replaced by real-time badge, digest had near-zero open rate after two weeks live` rather than simply removed from the table. The premise-challenge and alternatives sections from the new run get appended below the old ones under a dated subheading, not merged over them, erasing the earlier reasoning. The point of amending instead of replacing is that the roadmap becomes a record of how the project's understanding of itself changed over time — that history is worth more than a clean-looking document with no memory of its own prior decisions. A reader should be able to see that a row was cut, and why, not find it silently missing.

### 7. Render

Run `sage notebook render <notebook>/roadmap.md`, then `sage notebook index`. A roadmap that only exists as unrendered markdown is not done — both the gate in step 8 and the completion condition at the end of this file require the rendered HTML to actually exist and render without error. After any amendment on a re-run, re-render; a stale `<notebook>/roadmap.html` that no longer matches the markdown is worse than no HTML at all, because it actively misleads a reader who trusts it.

### 8. Gate

Present the roadmap for approval using the decision-brief format defined in `rules/sage-conduct.mdc` — do not restate that format here, follow it as written there. The alternatives from step 5 are naturally the brief's compared options; the recommendation is the shape the demand evidence and premise-challenge findings actually support, stated with a specific reason, never "this one seems better." Stop after presenting the brief. Do not proceed to any later skill, and do not treat silence, a topic change, or a vague acknowledgment as approval — the completion condition below requires an explicit, stated yes.

A roadmap approval is rarely a clean binary in practice. If the user approves most of the feature map but wants one row reworked, don't force an artificial all-or-nothing outcome — mark the accepted rows as approved, note the row still under discussion, and keep the gate open on that one point rather than either blocking the whole roadmap or quietly shipping the disputed row as if it were settled. The skill is not done until every row that made it into the feature map has been explicitly addressed, even if that takes more than one decision-brief round.

## What this skill does not do

`/sage-shape` produces a roadmap, not a technical plan. It does not assess feasibility, estimate effort, or design an architecture — that's `/sage-plan`'s Architect consult, run per sprint once a roadmap row is picked up. It does not write acceptance criteria at implementation granularity — that's the sprint spec, also `/sage-plan`. It does not decide engineering trade-offs like which database or framework to use; the premise challenge in step 4 argues about whether and what to build, not how to build it. If the interrogation surfaces a clearly technical question — "can our current infrastructure even support real-time badges" — note it as an open question for the Architect consult in the eventual sprint, rather than trying to answer it here or blocking the roadmap on it. A roadmap row can carry unresolved technical risk explicitly; it cannot carry an unresolved "why" or an unresolved observable, which are this skill's job to nail down.

## Conduct

Assumes `rules/sage-conduct.mdc` is loaded. Cursor applies it automatically;
on a host without an always-applied rules mechanism (Claude Code), the
operator must get its content into the session some other way (e.g. folded
into the project's `CLAUDE.md`) before running this skill.

## Non-interactive

This skill's entire procedure depends on a live person answering the
interrogation in step 2 — there is no non-interactive substitute for a
founder's actual answer, and inventing one to keep going would violate the
usable-answer bar that step sets. In non-interactive mode, run the ground
step (1) only, report what context already exists, and stop before asking
anything — never fabricate an interrogation to produce a roadmap nobody
actually answered. Terminal: `Shape skipped: no human available for the
interrogation`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I already know what they want, I can skip questions" | Cold assumptions write the wrong map. One question at a time, actually answered, is the product — not a formality in front of it. |
| "I'll bundle five questions to save time" | A wall of questions gets a wall of shallow answers, and afterward you can't tell which one went unanswered. Serial questions are the method, not an inefficiency in it. |
| "Interest on the waitlist is enough demand" | Interest costs the person nothing to give and predicts nothing about use. Behavior, money, or panic when it breaks is what counts. |
| "One option is fine if it's obviously right" | "Obviously right" is exactly the case a second shape most needs checking against — a single option is a decision with the comparison hidden, not one that was never worth making. |
| "I'll replace the old roadmap, it's cleaner" | Amend and mark superseded. A clean-looking roadmap with no memory of its own history hides exactly the reasoning a later reader needs. |
| "The premise challenge will just slow things down, this is clearly worth building" | The challenge isn't a veto and doesn't have to change the outcome — but skipping it means the roadmap ships with a blind spot nobody, including the user, ever saw named. |
| "They already covered this in the project brief" | A written brief is a pitch, not a live answer under follow-up. The gap between what a founder says the product does and what a user story actually contains only shows up once you push on it in the moment. |
| "This is obviously the MVP, no need to narrow the wedge further" | "Obviously the MVP" is usually the full feature list wearing a smaller hat. Make them name what gets cut and confirm nothing breaks without it. |
| "The user seems impatient with the questions, I should speed up" | Impatience isn't consent to skip a step. Slow down the follow-up if it helps, or say plainly why the question matters — don't drop the rigor to match the mood. |
| "I can write the roadmap now and backfill the demand evidence" | A roadmap row's "why" must already be evidenced when it's written. Writing it first and hoping the evidence shows up later turns the map into a wish list with a table format. |
| "Lane B is unavailable, I'll just note the premise challenge as skipped" | Hybrid mode still routes this specific step to Lane B — see the mode note at the top of this file. If Lane B is genuinely unreachable, that blocks the whole skill; it doesn't make step 4 optional. |
| "It's an internal tool, there's no real 'demand' to test" | Teammates have a status quo and workarounds too. The demand test still applies — the evidence just comes from colleagues instead of customers. |
| "The two alternatives are basically the same idea, I'll just note that and move on" | If they're the same idea, you haven't generated a real second shape yet — go back and find one that trades something different, rather than documenting the absence of a choice. |
| "The user picked an option already, the decision brief is redundant" | An informal pick in conversation isn't the recorded, stated approval this skill requires — run the gate anyway, so there's an explicit record of what was approved and why. |
| "The Lane B response was generic but it technically answered, good enough" | A generic response that could apply to any project hasn't actually challenged this one — send it back once with a pointed instruction before accepting it. |
| "This project is small, the full seven topics feel like overkill" | Small projects are exactly where an unspoken wrong assumption costs the most relative to the size of the effort — the topics scale down in depth, not in count. |
| "The founder's framing and the user quote roughly agree, close enough" | "Roughly agree" is where the real gap hides — name the difference explicitly rather than rounding it away; it may mean two wedges, not a rounding error. |
| "I'll order the feature map by what's easiest to build first" | Row order is a sequencing claim, not a convenience list. Order by dependency and wedge-fit first, or the roadmap quietly promotes low-value work to the front. |

## Red Flags

- More than one question asked in a single turn
- A user story written in feature language ("as a user I want X so that Y") instead of something a real person actually said
- "That would be cool," a waitlist count, or a star count accepted as demand evidence
- The "narrowest wedge" answer is actually the full feature list with a smaller-sounding name
- The observable-success answer is a feeling ("people would be happier") and wasn't pushed toward something measurable
- Out-of-scope list is empty, or answered with "we'll figure that out later"
- Premise challenge skipped entirely, or run on Lane A instead of Lane B in either product mode
- Premise challenge's objection summarized away in the roadmap instead of stated in full
- Premise challenge response is generic enough it could apply to any project, and was accepted anyway
- Only one shape presented at the alternatives step, or two shapes that are cosmetically different, not materially
- A roadmap feature row with an empty "why" or an empty "observable success" cell
- A row marked `in progress` with no linked spec
- Roadmap history overwritten on a re-run instead of amended, with superseded rows marked
- `<notebook>/roadmap.html` never rendered, or rendered once and not re-rendered after a later amendment
- Proceeding to a later skill without an explicit, stated user approval of the decision brief
- A user's answer accepted at face value after visibly hedging, deflecting, or answering a different question than the one asked
- A founder's framing of who has the problem accepted without checking it against an actual user quote when one exists
- Feature map rows ordered by build convenience rather than dependency and wedge-fit

## References

Two supporting files live in `references/`. Neither loads by default — load only the one whose trigger condition is actually met.

- **`references/demand-test.md`** — trigger: the demand evidence offered for a topic is genuinely borderline and neither the table nor the cost-to-give heuristic in step 3 above clearly resolves which side of the line it falls on. Carries more judgment-call examples and a fuller worked procedure for ruling under uncertainty than fit here.
- **`references/evasive-answers.md`** — trigger: an answer in step 2 is still vague, still feature-language, or still hypothetical after one follow-up. Carries the recurring evasion patterns — enthusiasm as deflection, the hypothetical third-person user, the "everyone" answer, restating the feature instead of the complaint — with a second-level follow-up for each, across all seven interrogation topics.

A third file, `references/worked-transcript.md`, has a different kind of trigger: load it before your first live run of this skill, to see the whole procedure — ground through gate — play out once on a single small example, or when asked directly to demonstrate the procedure rather than just follow it.

## Done when

`<notebook>/roadmap.html` renders without error; every row in the feature map has a non-empty, evidenced "why" and a genuinely observable — not felt, not assumed — success signal; the premise challenge's strongest objection is recorded in full in the roadmap's premise-challenge section, whether or not it changed the outcome; at least two materially different shapes were generated with their trade-off named, and the chosen shape is identifiable in the roadmap; and the user has given explicit, stated approval of the decision brief in step 8 — not silence, not a topic change, an actual yes, with every feature-map row explicitly addressed.
