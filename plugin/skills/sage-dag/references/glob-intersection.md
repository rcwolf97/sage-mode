# Reading a `sage dag lanes` intersection violation

Load this when `sage dag lanes --wave N` reports two nodes intersect and the
overlap isn't obvious from eyeballing the `owns` globs.

## How intersection is decided

Two globs are treated as intersecting if any path could match both. The
decision procedure is deliberately conservative:

1. Expand both globs against the current repo tree. If the resulting path
   sets intersect, they intersect.
2. Additionally, if one pattern's literal prefix is a prefix of the other's,
   treat them as intersecting even when the tree is currently empty — so
   `src/api/**` and `src/**` are caught before either directory exists yet.

**False positives are acceptable; false negatives are not.** A missed
intersection becomes a merge conflict or a silently lost edit at runtime,
which is far more expensive than an Architect round trip to split a lane.

## Why this trips more than it looks like it should

- `src/api/routes.ts` and `src/api/**` intersect even though the second glob
  looks broader — the first is a literal path inside the second's expansion.
- Two globs that don't share a literal prefix can still intersect through
  expansion: `**/*.test.ts` and `src/api/**` both match
  `src/api/handler.test.ts`.
- A node whose `owns` is a single directory and a sibling node whose `owns` is
  a glob for generated files inside that same directory will intersect even
  if the two nodes' actual work is unrelated — this is usually a sign the
  Architect should narrow one of the two lanes rather than a false alarm to
  wave away.

## D2 only applies within a concurrency class

Two nodes with overlapping `owns` are legal if the graph's `depends_on` edges
mean one always finishes before the other starts — they're never actually
concurrent, so there's no split-brain risk. `sage dag lanes --wave N` already
accounts for this: it only checks nodes the topological layering placed in the
**same** wave. If a violation is reported, the two nodes really do run at the
same time in the current plan.

## What to send back to the Architect

Name both node ids and the overlapping pattern (the tool output already gives
you this) — don't just say "narrow the lanes," give the Architect the exact
conflict so the re-consult is a targeted fix rather than a full re-plan. The
usual resolution is one of: split one node's `owns` more narrowly, merge the
two nodes if the overlap reflects genuinely inseparable work, or add a
`depends_on` edge if the overlap is actually sequential work that was
mis-planned as parallel.
