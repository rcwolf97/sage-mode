# Evidence freshness: why STALE happens

**Trigger:** load this when `sage evidence check` returns STALE and the next
step isn't obvious, or before telling the user "the suite needs to re-run" so
the actual reason is stated rather than assumed.

`check({label, expectCmd?, maxAgeHours?, allowPaths?})` evaluates, in order,
and returns the first match:

1. **The recorded run's exit code was non-zero.** STALE, "recorded run
   failed." Fix: re-run; there is no record of a passing run to cite.

2. **`maxAgeHours` exceeded.** STALE. Fix: re-run — the record is old enough
   that the project's own freshness policy no longer trusts it, independent
   of whether anything changed.

3. **`expectCmd` given and its hash doesn't match the recorded command's
   hash.** STALE, "command changed." **This is not a re-run fix.** The check
   that ran and the check ship expects to cite are two different commands —
   someone changed the test command, the typecheck invocation, or similar.
   Surface this as a decision: was the command change intentional? If so, the
   record needs to be re-made under the new command and the freshness pin
   updated to match; if not, it's a bug in the sprint's tooling that predates
   ship and blocks it.

4. **`wtree` is missing, or isn't a 40-character hex string.** STALE. This
   protects against a forged or corrupted ledger line being trusted, or
   silently used to build a `git` command — a malformed value must degrade to
   STALE, never get passed through as an argument. Fix: re-run to produce a
   valid record.

5. **`wtree` doesn't match the current working tree**, and the diff between
   old and new touches files outside `allowPaths`. STALE, naming the changed
   files. Fix: re-run. **Exception:** if every changed path is inside
   `allowPaths` (e.g., a post-test `VERSION`/`CHANGELOG` bump), the record
   stays FRESH — that's what `allowPaths` exists for, so a routine version
   bump doesn't invalidate a suite run that already passed against the actual
   code.

## What this means for step 1 of `SKILL.md`

Most STALE results are case 1, 2, or 5 — re-run, cite the new record, move
on. **Case 3 is the one worth pausing on**, because "just re-run it" produces
a record for a command nobody signed off shipping against. If `expectCmd`
mismatches, say so explicitly rather than silently re-running and citing the
new result as if nothing changed.
