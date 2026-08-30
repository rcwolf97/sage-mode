# Testing checklist

Dispatched alongside `correctness` whenever the diff is 30+ lines. Judges
whether the tests in the diff actually test anything, not just whether tests
exist.

- Was every new test run and shown to fail before the corresponding code
  existed (TDD, per every implementer's Checklist)? A test added in the same
  commit as passing code, with no evidence it ever failed, is unverified.
- Does each test assert on behavior, not on implementation detail that would
  pass even if the behavior were wrong (e.g. asserting a mock was called,
  not that the output is correct)?
- Every new exception/error path named in the implementer's report: is there
  a test that actually exercises it, or is it untested and therefore
  blocking per this plugin's own rule (an untested exception path blocks the
  node the same as an untested happy path)?
- Adversarial/edge-case coverage: does the test suite cover the boundary
  values, not just one representative "happy" input?
- A test that would still pass if the entire feature were deleted is not a
  test — flag it.
- Flaky-looking assertions: timing-dependent waits, unordered-collection
  equality checked with strict ordering, anything that could pass or fail
  depending on execution order.
