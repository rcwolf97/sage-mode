# Evasive answers — patterns and second-level follow-ups

Load this file from `sage-shape/SKILL.md` step 2 when an answer to one of the seven interrogation topics is still vague, still feature-language, or still hypothetical after the one in-file follow-up has already been used. The main procedure's exchanges cover the first follow-up for common cases; this file covers the recurring *patterns* behind evasive answers — patterns that show up across all seven topics, not just one — with a second-level follow-up for each, and a note on when to stop pushing and record the topic as unresolved instead.

Each pattern below can appear on any of the seven topics. Match the pattern first, then apply its follow-up to whichever topic you're actually on.

## Pattern: enthusiasm as deflection

The answer is energetic and positive but doesn't actually contain new information — it restates that the idea is good rather than answering what was asked.

> Q (topic 2.6, observable success): "What's the one thing you'd point to that tells you this worked?"
> A: "Oh, people are going to love this, I'm really excited about it."
> First follow-up (already used): "Excitement isn't something either of us can check later — what would you literally see happen?"
> Second-level follow-up: "I hear that you're confident about this — that's useful context, but it's not the answer to the question. If I asked you to bet money on a specific number moving, which number would you bet on?"

Enthusiasm is not itself dishonest, but it's easy for both the person answering and the model asking to mistake energy for content. Naming the gap plainly — "that's confidence, not an answer" — without being dismissive of the confidence itself usually redirects the conversation back to something checkable.

## Pattern: the hypothetical third-person user

The answer describes an imagined person's imagined behavior, phrased as if it were observed, with no actual person or instance behind it.

> Q (topic 2.4, user stories): "What would the user actually say about this?"
> A: "A user would probably say something like, 'finally, this is so much easier.'"
> First follow-up (already used): "That's the reaction to the finished feature — what's the complaint before it exists?"
> Second-level follow-up: "Let's try this differently — has anyone, anywhere, actually said anything resembling a complaint about this problem? A Slack message, a support ticket, a comment in a meeting? If genuinely nobody has, that's fine to say — but say that, rather than inventing what they'd say."

The tell here is grammar: "a user would say" or "users would probably think" is speculative language standing in for an observed quote. If pushed twice and the hypothetical persists, record the story as "inferred, not sourced" in the roadmap rather than treating the invented quote as real.

## Pattern: the "everyone" answer

The answer names a universal group instead of a specific instance, making the claim unfalsifiable because it can't be checked against any one person's actual situation.

> Q (topic 2.1, who has the problem): "Who specifically hits this?"
> A: "Honestly, everyone who uses the product runs into this eventually."
> First follow-up (already used): "Pick the person who ran into it most recently and walk me through their moment."
> Second-level follow-up: "If it's truly universal, you should be able to name the very last person it happened to, today or yesterday — who was it, and what were they doing right before it happened?"

"Everyone" is nearly always an overstatement standing in for "I haven't identified a specific instance." If the second-level follow-up still can't produce a name or a recent instance, that is itself the finding: the problem may be real but hasn't actually been observed in a specific person yet, which is a materially different starting point for the demand test than a confirmed, named instance.

## Pattern: restating the feature instead of the complaint

The answer describes the proposed solution again, dressed in slightly different words, rather than describing the underlying problem it's meant to solve.

> Q (topic 2.2, status quo): "What do they do today instead?"
> A: "Right now there's no dashboard, so they can't see their analytics easily."
> First follow-up (already used): "Walk me through the actual steps they take today — not the absence of the dashboard, the real sequence."
> Second-level follow-up: "I keep hearing 'no dashboard' — that's describing the thing we haven't built yet. Forget the dashboard entirely for a second: today, with nothing new, what does this person physically do when they need to know their numbers? Open a spreadsheet? Ask someone? Not check at all?"

This pattern is sticky because the person answering has already mentally committed to the solution and finds it hard to describe the world without it. Explicitly asking them to set the solution aside, even artificially, often breaks the loop.

## Pattern: the demo-as-answer

The answer points at an existing mockup, prototype, or competitor screenshot as if showing it settles the question, without actually answering what was asked in words.

> Q (topic 2.5, ideal flow): "Walk me through it screen by screen."
> A: "It's basically like the mockup I already showed you."
> First follow-up (already used): "I want it in words, step by step, starting from the very first screen."
> Second-level follow-up: "Forget the mockup for a moment — if you had to describe screen one over the phone to someone who couldn't see it, what would you say is on it?"

A visual artifact is a useful reference but isn't a substitute for a verbal walk-through, because visuals compress and gloss over exactly the sequencing and edge-case questions this topic needs answered. If the person genuinely cannot describe the flow without pointing at the image, that's a sign the flow itself hasn't been thought through past its surface appearance.

## Pattern: the delegation answer

The answer redirects the question to someone else instead of answering it, without actually producing that other person's answer.

> Q (topic 2.7, out of scope): "What's explicitly not included, and for how long?"
> A: "You'd have to ask the engineering team about that."
> First follow-up (already used): "I'm asking what's deliberately excluded from your intent right now — not an engineering constraint."
> Second-level follow-up: "This one's a product call, not an engineering one — what do *you* want left out of this wedge on purpose, regardless of what engineering later says is feasible? We can adjust after Architect weighs in, but I need your intent first."

Delegation can be a legitimate move when the question genuinely belongs to someone else, but topics 2.1 through 2.7 are all product-intent questions the person being interrogated should be able to answer for themselves. If they genuinely can't — because they're not actually the decision-maker for this project — that's worth surfacing directly: who *is* the right person to ask, and should this interrogation be redirected to them for this topic specifically.

## Pattern: the scope-creep answer

The answer to a narrowing question (2.3, or a follow-up on 2.7) keeps adding more back in rather than cutting, effectively refusing to narrow at all.

> Q (topic 2.3, narrowest wedge): "If you had to cut two of those three, which one survives?"
> A: "I guess we could cut exports for now, but we'd still need the sharing feature and probably some basic permissions too, and maybe a settings page..."
> First follow-up (already used, implicit in the exchange above): the answer already re-expanded past the ask.
> Second-level follow-up: "You just added permissions and a settings page to a list I asked you to shrink. Let's restart from one: if you could ship exactly one capability and nothing else — not one plus a few small additions — which single one is it?"

This pattern often comes from genuine anxiety that a narrow wedge won't be "enough," which is a legitimate concern — but it belongs in the premise-challenge and alternatives discussion later, not smuggled back into the wedge definition itself. Hold the line on "exactly one" until you get it, then address the anxiety separately if it persists.

## When to stop pushing

Two follow-ups per topic — the one in the main procedure plus one pattern-matched follow-up from this file — is the working budget. If a third attempt is starting to feel necessary, that's the signal to stop, not to improvise a third question. Record the topic plainly as unresolved in your working notes (not in the roadmap yet — the roadmap is written in step 6, after the whole interrogation), state to the user that this topic isn't landing and you're moving on to keep the session moving, and revisit it once the rest of the interrogation gives you more context that might make the question easier to ask differently. An unresolved topic that's honestly flagged is far better than a topic marked "done" on the strength of a third improvised guess.
