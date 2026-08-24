# Classification: AUTO-FIX vs ASK

**Trigger:** load this while doing step 7 of `SKILL.md` — classifying a
findings list after gate + dedup — whenever a finding's category isn't
obviously mechanical or obviously judgment from the rule of thumb alone.

## The table

| AUTO-FIX | ASK |
|---|---|
| Dead code, unused variables | Security: auth, XSS, injection |
| N+1 queries | Race conditions |
| Stale comments contradicting code | Design decisions |
| Magic numbers → named constants | Fixes over 20 lines |
| Version/path mismatches | Removing functionality |
| Inline styles, O(n·m) lookups | Anything changing user-visible behaviour |

## The rule of thumb

Mechanical and uncontroversial → AUTO-FIX. Reasonable engineers could
disagree → ASK.

`CRITICAL` severity defaults toward ASK even when the category would
otherwise read as mechanical — a magic number that happens to be a security
threshold is not the same finding as a magic number that's a page-size
constant. `MEDIUM` and `NITPICK` default toward AUTO-FIX.

**Override, absolute:** any finding carrying a `test_stub` field becomes ASK
regardless of severity or category. The user approves the test stub before
it's committed — a test written to validate a fix the user never saw is a
test nobody actually reviewed.

## Worked edge cases

**"N+1 query in the auth middleware."** Category reads as performance
(AUTO-FIX row), but the location is `SCOPE_AUTH`. Treat it as ASK — the fix
touches code a security specialist would also want eyes on, and "reasonable
engineers could disagree" applies to *where* the fix should live, not just
whether the N+1 is real.

**"Magic number `86400` replaced with `SECONDS_PER_DAY`."** Clean AUTO-FIX:
mechanical, no behavior change, no reasonable disagreement.

**"Dead code removal that also deletes an exported function another module
still imports."** Looks like the AUTO-FIX row ("dead code, unused
variables") but is actually "removing functionality" — the ASK row. The
category label on a finding is a starting point, not the final word; check
what the fix actually does before applying it unattended.

**"Fix is 18 lines, well under the 20-line threshold, but rewrites the
retry/backoff logic."** Line count alone doesn't settle it. A short diff that
changes behavior a caller depends on is still a design decision. When line
count and "changes user-visible behaviour" disagree, the behaviour column
wins.
