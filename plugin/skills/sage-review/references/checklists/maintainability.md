# Maintainability checklist

Dispatched when the diff is 200+ lines — large enough that structure starts
to matter as much as correctness.

- Is there a single function or file doing two unrelated jobs that a future
  change to one would risk breaking the other?
- Duplicated logic (not duplicated text — duplicated *decision*) that now
  exists in two places and will drift the first time only one gets updated.
- Naming that describes what the code currently happens to do rather than
  what it's for — a name that will actively mislead the next reader once the
  implementation shifts underneath it.
- A new abstraction introduced for a single call site — speculative
  generality that adds a layer of indirection nobody needed yet.
- Error messages and exception types: do they carry enough information for
  someone debugging this in six months with no memory of this diff, or just
  "something went wrong"?
- Is the diff's structure consistent with the surrounding code's existing
  conventions, or does it introduce a second way of doing the same thing?
