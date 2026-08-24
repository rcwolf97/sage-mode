# The four escalation categories — worked examples

Load this when an Implementer's blocker doesn't obviously fall inside or
outside the four categories `SKILL.md` step 7 names, and the Eng Manager needs
to decide whether to rule on it directly or escalate to the user.

## The general test

Ask: if the Eng Manager's ruling turns out to be wrong, can it be undone by
discarding the worktree and re-dispatching? If yes, it's very likely a
category the Eng Manager rules on itself. If no — the wrong answer already did
something that outlives the branch — it's very likely one of the four.

## 1. Destructive operations

**Escalate:** "The migration needs to `DROP COLUMN` on `invoices.legacy_total`
to satisfy the acceptance criteria — 40k rows still have non-null values in
it." Dropping a populated column is not recoverable by discarding the
worktree; the data is gone once the migration runs against the real database.

**Rule it yourself:** "Should the new `invoice_lines` seed script truncate the
`invoice_lines` table before reseeding, or upsert?" — if this is against a
test fixture or a table this sprint owns end-to-end and nothing outside the
worktree depends on its current contents yet, it's a normal implementation
choice.

## 2. Security-sensitive decisions

**Escalate:** "The acceptance criteria says 'API key rotation invalidates the
old key' but doesn't say whether requests in flight with the old key at the
moment of rotation should complete or fail." This is an auth semantics
decision with real attacker-facing consequences either way.

**Rule it yourself:** "Should the rate-limit key be derived from the
`X-Api-Key` header or a parsed JWT claim?" — if the spec already named which
auth mechanism this sprint uses and this is just "which field within it,"
it's usually resolvable from the spec and existing code, not a fresh security
decision.

## 3. Effects outside the worktree

**Escalate:** "Verifying this acceptance criterion requires calling the real
Stripe sandbox, which will create live webhook subscriptions on the shared
sandbox account." Anything that reaches a shared external system, sends a
real notification, or writes to storage the worktree doesn't own crosses this
line — the blast radius survives even if the branch is thrown away.

**Rule it yourself:** "Should the new health-check endpoint log at `info` or
`debug` level?" — logging inside the worktree's own code, to be reviewed like
any other diff, is not an outside effect.

## 4. Plan defects that invalidate the spec

**Escalate:** "The acceptance criteria for `n4` assumes the export endpoint
already streams; it doesn't — it loads the full result set into memory. The
node as scoped can't be built as a same-sprint follow-on without first fixing
the base endpoint, which is a different node's `owns`." This means the spec
itself was wrong about a starting condition, not just under-specified about a
detail — building around it produces something that doesn't actually satisfy
the sprint's goal.

**Rule it yourself:** "The acceptance criteria doesn't say what happens on an
empty result set" — an underspecified edge case within an otherwise sound
plan is a ruling (pick the sane default, name it in the answer file, note it
in the node's report), not a plan defect.

## When a blocker is genuinely ambiguous between "ruling" and "escalate"

Default toward ruling and logging it, per `rules/sage-conduct.mdc`'s
rulings-not-stalls principle — a wrong ruling on a reversible question costs
bounded rework; a session parked mid-sprint costs the whole day. The
exception is when the *cost of being wrong* is itself irreversible or
external, which is what the four categories are naming in the first place —
if in doubt about which side a blocker falls on, ask: "if I rule wrong here,
does discarding this worktree undo it?" That question resolves nearly every
edge case.
