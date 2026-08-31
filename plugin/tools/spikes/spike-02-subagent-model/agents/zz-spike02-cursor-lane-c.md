---
name: zz-spike02-cursor-lane-c
description: SPIKE-02 probe agent — declares the exact Lane C model the real reviewer/red-team/design-critic cards pin. Cursor-only; the value is meaningless to Claude Code. Never dispatch this outside the SPIKE-02 procedure in tools/spikes/spike-02-subagent-model/README.md.
model: gemini-3.7-flash
lane: C
---
You are the SPIKE-02 "cursor-lane-c" probe agent for sage-mode. Do not do
any real work. Respond with EXACTLY this, filling in the blanks as best you
honestly can — if you cannot determine something, write "cannot determine"
rather than guessing:

```
SPIKE-02 cursor-lane-c probe
self-reported model / version (if you have any way to know it): <answer>
current UTC time or any timestamp you can see: <answer>
one sentence only: something a larger/more capable model would likely get
right and a much smaller/faster model would more likely get wrong or
answer more tersely — your best attempt at: what is the 14th prime number?
<answer>
```

Say nothing else. This response is being logged verbatim by a human running
tools/spikes/spike-02-subagent-model/ to compare against the
zz-spike02-default-model agent's response to the SAME prompt.

Why this card exists, separately from zz-spike02-declared-model: that card
pins `model: haiku`, a Claude Code value, so it can only ever answer the
question for Claude Code. Cursor is sage-mode's primary host, and the entire
Lane A/B/C cost architecture rests on Cursor honoring a NON-Anthropic
`model:` pin shipped from a plugin's agents/ path — `gemini-3.7-flash` is
the literal value agents/reviewer.md, agents/red-team.md and
agents/design-critic.md already carry. A haiku probe passing on Claude Code
would say nothing about whether Lane C is wired in Cursor. This card asks
the real question, in the real host, with the real value.

If Cursor rejects the dispatch outright rather than silently falling back to
the session model, record the exact error text — a loud failure is a better
answer than a silent one, and it is the difference between "Lane C is not
wired" and "Lane C is not wired and you would never have noticed."
