# Comparison eval (v1 gate)

**Status: not yet run. No results recorded below or elsewhere in this repo.** This requires a live
Cursor session with real model billing to execute both arms — it cannot be run from this sandbox,
and no prior run's numbers should be assumed to exist just because this file does. Run it and file
the result (even a bad one) before treating sage-mode's process overhead as justified by evidence
rather than by design intent.

Run the same fixture sprint through sage-mode and through a plain Cursor agent with a good prompt.

Record: wall-clock, token spend by lane, defects found by review, defects that escaped to /sage-verify.

If sage-mode is not better on defects-escaped, the process is ceremony. Publish the result in the notebook whichever way it goes.

Template:

```
date:
fixture:
sage_wall_clock:
plain_wall_clock:
sage_tokens_by_lane: { A, B, C }
plain_tokens:
defects_found_review:
defects_escaped_verify:
verdict:
```
