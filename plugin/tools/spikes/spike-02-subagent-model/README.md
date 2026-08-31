# SPIKE-02 — do plugin-shipped subagents honor `model:`?

## The question

Several of this plugin's real agent cards (`agents/*.md`) already set a
`model:` frontmatter field — e.g. `agents/reviewer.md` sets
`model: gemini-3.7-flash`. Whether the host that dispatches a subagent
actually routes it to the declared model, silently ignores the field and
uses its own default, or errors out, has never been confirmed against a
live Cursor or Claude Code session.

**A concrete, already-visible gap this spike would confirm:** several
existing agent cards use non-Claude model identifiers
(`gemini-3.7-flash`, `grok-4.5`, `grok-4.6` — `grep -h '^model:'
agents/*.md` finds them). Those are Cursor multi-model-router values.
Claude Code only recognizes Claude models/aliases (`sonnet`, `opus`,
`haiku`, `inherit`, or a specific Claude model ID) — so whatever this
spike concludes about `model:` in general, those SPECIFIC values are
almost certainly non-functional (ignored, or a dispatch error) under
Claude Code. Fixing those agent cards is out of scope for this spike and
for the hooks/plugin-manifest work that produced it — `agents/*.md` isn't
owned by that pass — but it's flagged here so it isn't lost; route it to
whoever owns `agents/`.

## What this harness does and doesn't do

It does NOT dispatch a subagent for you — that's an agent action (Task
tool / "@agent-name" in chat), not something a shell script can trigger.
What it DOES do, in one command (`./run.sh`):
- validates both probe agent cards' frontmatter actually parses,
- confirms whether they're installed where the host can find them,
- writes `out/observations.md`, a template for recording what you observe,
- prints the exact two prompts to send your live agent.

Two probe agents, both otherwise identical (same instructions, same
harmless task — don't do real work, echo back a small templated answer):
- `agents/zz-spike02-declared-model.md` — `model: haiku`
- `agents/zz-spike02-default-model.md` — no `model:` field at all (control)

## What to run

**In Cursor or Claude Code (same steps either way):**
1. `./install.sh` — copies the two probe cards into the real `agents/`
   directory (the only place either host discovers plugin agents, per
   `plugin.json`'s/`.claude-plugin/plugin.json`'s `agents: "./agents"`).
   Restart your session if new agent files aren't picked up live.
2. `./run.sh` — validates everything and prints the two prompts.
3. In your agent chat, send prompt 1, then paste the subagent's verbatim
   response into `out/observations.md` under
   `## zz-spike02-declared-model`. Do the same for prompt 2 under
   `## zz-spike02-default-model`.
4. Fill in the `## Verdict` section at the bottom of
   `out/observations.md` yourself, from what you actually saw (see next
   section for what actually counts as evidence).
5. `./uninstall.sh` when done — removes exactly the two probe agent cards.

Run this in both hosts if you can; `model:` may be honored on one and not
the other.

## Where the output lands

`tools/spikes/spike-02-subagent-model/out/observations.md` — the template
`run.sh` writes has the exact structure to fill in, including a reminder
of what NOT to trust (see next section).

## How to read the result

**Do not let either probe agent's own self-report settle this by itself.**
An LLM asked "what model are you" is not a reliable narrator of its own
identity — it may confabulate a plausible-sounding answer regardless of
what's actually running it. What actually counts as evidence, roughly in
order of trustworthiness:
1. Any model name your HOST'S OWN UI/transcript shows for the dispatched
   subagent (some hosts label which model handled a Task call in the
   transcript or logs, independent of what the subagent itself claims).
2. Response latency — a genuinely smaller/faster model (haiku-class)
   responding dramatically faster than the default is circumstantial but
   real evidence, if you can compare like-for-like.
3. The prime-number check's correctness/terseness, as one more weak
   signal, not a verdict on its own.
4. The subagent's own self-report — weakest signal, record it anyway
   (it's still data), but don't treat it as conclusive.

If `model: haiku` causes an outright dispatch ERROR instead of silently
being honored or ignored, that's itself a real, useful, and different
answer to the question — record the exact error text in
`observations.md` rather than treating it as the harness failing.
