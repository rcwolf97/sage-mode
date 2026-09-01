---
name: code-review
description: "Review changes since a fixed point with a gemini-3.7-flash subagent. Standards plus spec, adversarial. Use when reviewing a branch, a PR, or work before merge."
disable-model-invocation: true
---

# Code review

One fresh-context reviewer. Model: **gemini-3.7-flash**. Different vendor from the implementer on purpose.

This session is the coordinator. It does not review its own diff. `/receiving-code-review` is how you take the findings, not a second review.

`/requesting-code-review` is the same command. Follow this skill.

## When

After a ticket, after a major feature, before merge. Also when stuck, before a refactor, after a nasty bug.

Never skip because "it's simple". Never implement the review in this context.

## 1. Pin the range

Fixed point: what they named (SHA, branch, tag, `main`). If they didn't, ask.

```bash
git rev-parse <fixed-point>
git diff <fixed-point>...HEAD --stat
git log <fixed-point>..HEAD --oneline
```

Empty diff or bad ref: stop here.

## 2. Contract

Find what the change was supposed to do, in this order:

1. Ticket or issue in the commit messages, via `docs/agents/issue-tracker.md` if it exists
2. A path they passed
3. `docs/tickets/`, `docs/specs/`, or `.scratch/` matching the branch
4. Ask. If there is no spec, the Spec axis reports "none" and still runs Standards

## 3. Dispatch

Launch the plugin agent `code-reviewer` (`agents/code-reviewer.md`). Pin `gemini-3.7-flash`. Read-only. No child agents.

Fill [code-reviewer.md](code-reviewer.md). Placeholders: description, plan/tickets, base SHA, head SHA, smell baseline below, spec path or "none".

If the host cannot pin Gemini, say so in one line and dispatch a fresh-context reviewer anyway. Name the fallback model. Do not silently use the model that wrote the code.

## 4. Act

- Critical: fix now
- Important: fix before merge or the next ticket
- Minor: later, unless cheap
- Push back when the reviewer is wrong. Show the code. `/receiving-code-review` if the social part is getting sloppy

Do not merge the two axes into one ranked list. A change can be clean and wrong, or right and ugly.

## Smell baseline

Repo docs win. Tooling that already enforces a rule is skipped. Smells are judgement calls.

Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man, Refused Bequest.

## Never

- Review the diff yourself "to save a subagent"
- Hand the reviewer your session history or your claim that it is done
- Ignore Critical
- Proceed with unfixed Important
- Spawn a reviewer from inside the reviewer
