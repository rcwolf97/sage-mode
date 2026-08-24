# Comparison eval (v1 gate)

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
