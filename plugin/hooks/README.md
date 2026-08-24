# hooks/

Five shell scripts Cursor runs at specific moments (tech-spec.md §7). `hooks.json`
wires them to events. All hooks source `json-safe.sh`, are POSIX `sh` (tested
under both `dash` and `bash`), and are covered by golden-payload fixtures in
`tests/`.

## Lane enforcement: `sage-lane` vs. `sage-lane-after`

`hooks.json` currently registers **only** `preToolUse → sage-lane` — the
config normative in tech-spec.md lines ~918–935. This is the *preventive*
path: it denies an out-of-lane `Write`/`Delete` before it happens.

That config depends on **SPIKE-01** (tech-spec.md §3: does Cursor's
`preToolUse` payload expose a file path for `Write`?), which **has not been
executed against live Cursor** — see `docs/spikes/SPIKE-01.md`. The current
`hooks.json` assumes SPIKE-01 passes.

`sage-lane-after` implements the fallback named in SPIKE-01's "Fail →"
branch: `afterFileEdit`-based **detect-and-revert**. It is **not registered**
in `hooks.json`, but the script is kept in this directory, working, and
covered by its own test fixtures — so switching lane enforcement over is a
one-line `hooks.json` change (add an `afterFileEdit` entry pointing at
`./sage-lane-after`, and optionally drop the `preToolUse` entry once the
revert flow is trusted), not new engineering.

**If SPIKE-01 is run for real and fails:** wire `afterFileEdit →
sage-lane-after` in `hooks.json` per the fallback in `docs/spikes/SPIKE-01.md`,
and re-estimate WP-16 as that document describes.
