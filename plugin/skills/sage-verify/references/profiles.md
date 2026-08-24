# Verification profiles

**Trigger:** load this when the sprint's verification profile is not `web`,
or when the exact JSON shape of a profile file is needed.

## `web` (the default walk-through in `SKILL.md`)

```jsonc
// profiles/web.json
{
  "name": "web",
  "checks": [
    { "id": "suite",     "command": "${verify.tests}", "required": true },
    { "id": "typecheck", "command": "${verify.typecheck}", "required": true },
    { "id": "viewports", "kind": "browser",
      "widths": [390, 768, 1024, 1440, 1920],
      "capture": ["screenshot", "console"], "required": true },
    { "id": "stories",   "kind": "browser-walkthrough",
      "source": "spec.acceptance", "required": true },
    { "id": "a11y",      "kind": "design-critique", "gate": ["Blocker", "High"] }
  ]
}
```

`suite` and `typecheck` are ordinary commands run through the evidence
wrapper. `viewports` and `stories` are `qa-driver`'s job (step 3 of
`SKILL.md`). `a11y` is a `design-critique` check — same finding schema, same
confidence gate, gated by severity rather than presence (step 6).

## `api`

Runs contract tests against the declared API schema, a migration-safety
analysis on any schema-changing node in the sprint, and error-path coverage —
does every documented error response actually get exercised by a test, not
just the happy path. No browser involved; `qa-driver` is not dispatched for
this profile. `qa-analyst` still judges the resulting artifacts (contract
test output, migration-safety report, coverage report) against acceptance.

## `cli`

Runs golden-file tests (recorded expected output diffed against actual), a
clean-sandbox invocation (the tool run from a fresh environment with nothing
pre-installed or pre-configured, to catch hidden dependencies on the dev
machine's state), and a time-to-first-success measurement against the
documented quickstart — does a new user following the README actually reach
a working state, and how long does it take. All three write artifacts (diff
output, sandbox log, timing report) that `qa-analyst` judges.

## `ai-product`

Runs the eval suite and a prompt regression check against the recorded
baseline — does the current prompt/model combination score at or above the
last approved baseline on the same eval set, or has something regressed.
Artifacts are the eval run's scored output and the regression diff against
baseline. `qa-analyst` judges regressions against the sprint's acceptance
criteria the same way it judges a screenshot: it needs the artifact, not a
summary of it.

## What stays constant across all four

Every check writes an artifact. Every artifact gets judged by `qa-analyst`,
never by whatever produced it. Every finding above the display threshold
routes back to `/sage-build` as a new node. The only thing that changes
per-profile is what mechanically produces the artifacts — a browser for
`web`, contract/migration tooling for `api`, sandboxed invocation for `cli`,
an eval harness for `ai-product`.
