# Correctness checklist

Dispatched whenever the diff is 30+ lines. Reviews the diff against ARTIFACT
(the diff) + CONTRACT (acceptance criteria) only — never the implementer's
own claim of correctness.

- Does the diff actually satisfy every acceptance-criteria entry in
  CONTRACT, not just avoid obvious bugs? A diff with zero defects that
  doesn't do what was asked is still a finding.
- Trace every new conditional branch: is there a reachable input that hits
  it and produces the wrong result?
- Off-by-one and boundary conditions on any new loop, slice, or index
  arithmetic — check the edges explicitly, don't eyeball it.
- Every new exception/error path: does it actually trigger on the condition
  it claims to, and is the caller's handling of it correct?
- State mutated in more than one place (a shared object, a module-level
  variable, a cache) — can two call sites disagree about its value?
- Does the diff silently swallow an error it should propagate, or propagate
  one it should have handled?
