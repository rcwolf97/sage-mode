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

```jsonc
// profiles/api.json
{
  "name": "api",
  "checks": [
    { "id": "suite",      "command": "${verify.tests}", "required": true },
    { "id": "contract",   "kind": "api-contract",     "command": "${verify.contract}",   "required": true },
    { "id": "migrations", "kind": "migration-safety", "command": "${verify.migrations}", "required": true },
    { "id": "errors",     "kind": "error-path-coverage", "command": "${verify.errors}",  "required": true }
  ]
}
```

Runs contract tests against the declared API schema, a migration-safety
analysis on any schema-changing node in the sprint, and error-path coverage —
does every documented error response actually get exercised by a test, not
just the happy path. No browser involved; `qa-driver` is not dispatched for
this profile.

**Unlike `${verify.tests}`, none of `contract`/`migrations`/`errors` has a
safe generic default.** `sage-setup` can reasonably default `tests` to `npm
test` for most projects; it cannot guess what "run this project's
migration-safety analysis" means, because most projects don't have one.
These three keys exist in `.sage/config.json`'s `verify` object only if the
project already has that tooling and someone recorded the command there. A
sprint on a project without one runs `suite` normally and reports `contract`
/ `migrations` / `errors` as not verified — that is the correct, honest
outcome per `SKILL.md` step 2/8, not a defect to work around by inventing a
command. `qa-analyst` judges whichever of the four artifacts actually exist
against acceptance.

## `cli`

```jsonc
// profiles/cli.json
{
  "name": "cli",
  "checks": [
    { "id": "suite",   "command": "${verify.tests}", "required": true },
    { "id": "golden",  "kind": "golden-file",              "command": "${verify.golden}",  "required": true },
    { "id": "sandbox", "kind": "clean-sandbox-invocation", "command": "${verify.sandbox}", "required": true },
    { "id": "ttfs",    "kind": "time-to-first-success",    "command": "${verify.ttfs}",    "required": true }
  ]
}
```

Runs golden-file tests (recorded expected output diffed against actual), a
clean-sandbox invocation (the tool run from a fresh environment with nothing
pre-installed or pre-configured, to catch hidden dependencies on the dev
machine's state), and a time-to-first-success measurement against the
documented quickstart — does a new user following the README actually reach
a working state, and how long does it take. All three write artifacts (diff
output, sandbox log, timing report) that `qa-analyst` judges. Same rule as
`api`: `golden`/`sandbox`/`ttfs` only run if `.sage/config.json` has a
command for them — no invented default.

## `ai-product`

```jsonc
// profiles/ai-product.json
{
  "name": "ai-product",
  "checks": [
    { "id": "suite",   "command": "${verify.tests}", "required": true },
    { "id": "evals",   "kind": "eval-suite",         "command": "${verify.evals}",   "required": true },
    { "id": "prompts", "kind": "prompt-regression",  "command": "${verify.prompts}", "required": true }
  ]
}
```

Runs the eval suite and a prompt regression check against the recorded
baseline — does the current prompt/model combination score at or above the
last approved baseline on the same eval set, or has something regressed.
Artifacts are the eval run's scored output and the regression diff against
baseline. `qa-analyst` judges regressions against the sprint's acceptance
criteria the same way it judges a screenshot: it needs the artifact, not a
summary of it. Same rule as `api`: no eval harness configured in
`.sage/config.json` means `evals`/`prompts` are reported not verified, not
skipped silently.

## What stays constant across all four

Every check writes an artifact, or is honestly reported as not verified when
its `${verify.X}` command isn't configured. Every artifact gets judged by
`qa-analyst`, never by whatever produced it. Every finding above the display
threshold routes back to `/sage-build` as a new node. The only thing that
changes per-profile is what mechanically produces the artifacts — a browser
for `web`, project-supplied contract/migration tooling for `api`, sandboxed
invocation for `cli`, an eval harness for `ai-product` — and none of that
tooling ships inside sage-mode itself; it's always the project's own
command, recorded once in `.sage/config.json`.
