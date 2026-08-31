# Performance checklist

Dispatched on any backend or frontend diff. Looks for the class of defect
that ships clean and correct, then falls over under real load or on a slow
connection — not a substitute for `sage-verify`'s measured performance gate
(LCP/CLS/INP, `design-technologist`'s job), which is a hard number this
checklist doesn't have access to.

- A query or lookup inside a loop that should be batched — N+1 database
  calls, N+1 network requests, N+1 anything.
- A new unbounded collection: is there a realistic input size where it grows
  without limit (an unpaginated list, an unbounded cache, an accumulator
  that's never cleared)?
- Synchronous/blocking work on a path that used to be non-blocking, or
  vice-versa in a context that assumed the old behavior.
- A new dependency or asset added to a hot path (page load, request
  handler) without checking its size/cost against what was already there.
- Re-computation of something that could be cached or memoized, done on
  every call instead of once.
- Does the diff's own claimed complexity match reality — an implementer's
  report calling something O(n) that's actually O(n²) in the diff as
  written?
