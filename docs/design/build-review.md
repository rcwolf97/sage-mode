# Implementation Review — sage-mode v1

**Reviewed:** 2026-08-24 · **Commit:** `bb36690` · **Against:** [Technical Specification v1.0](./tech-spec.html)
**Method:** full repo read, their test suite executed, hooks executed against POSIX `sh` and `bash`, library behaviour probed directly.

> **In plain terms:** The team built the right thing in the right shape. The structure, the naming, the contracts and one library are genuinely good. But three things block shipping: the hooks do not work on Linux at all, the check that makes parallel agents safe has false negatives, and the skills are outlines rather than procedures — every `references/` directory is empty. Their own test suite already reports three failures, so CI has never been green. None of this is a redesign; it's a concentrated, enumerable gap.

---

## 1. Verdict

| | |
|---|---|
| **Structure and contracts** | Faithful. Schemas, profiles, templates, catalog, commands, lint — all present and correct. |
| **`lib/evidence`** | Excellent. Better than the spec asked for in places. |
| **Safety layer (hooks)** | **Broken.** Non-functional on Linux; one hook bricks the build, another silently permits `rm -rf /`. |
| **Parallelism safety (D2)** | **Unsound.** False negatives in the exact shape the spec forbade. |
| **Skills and role cards** | **Outlines.** ~5% of specified substance. 14 empty `references/` directories. |
| **Tests and evals** | Tier 2 is strong. Unit coverage is thin; Tier 3 is a checklist, not a runner. |
| **Shippable?** | **No.** Blockers 1–3 below. Everything else is fixable in the ordinary course. |

**Their own test suite reports `# pass 19 / # fail 3`.** All three failures are in the hooks. CI runs `node --test` and would fail on this commit. That is the single most important process observation in this review: the code was committed without the suite passing.

---

## 2. Blockers

> **In plain terms:** Three things that mean this cannot be installed and used. Each has a small, specific fix.

### B1 — Every hook is broken on Linux, and two of them fail dangerously

`hooks/json-safe.sh:8` strips the UTF-8 BOM with:

```sh
JSON_IN=$(printf '%s' "$JSON_IN" | sed $'1s/^\xEF\xBB\xBF//')
```

`$'...'` is a **bash extension**. Every hook declares `#!/usr/bin/env sh`. On any system where `/bin/sh` is `dash` — Debian, Ubuntu, and GitHub Actions' `ubuntu-latest` — the string is passed to `sed` literally and it dies:

```
sed: -e expression #1, char 2: unknown command: `1'
```

Combined with `set -eu`, the hook exits 1. Measured on this repo:

| Hook | `dash` | `bash` | Declared polarity | Real-world consequence |
|---|---|---|---|---|
| `sage-careful` | **rc=1** | rc=0 | ask-tier, fails **open** | **Allows everything.** `rm -rf /` is permitted. The destructive-command guard is a complete no-op. |
| `sage-solo` | **rc=1** | rc=0 | `failClosed: true` | **Denies every subagent spawn.** `/sage-build` cannot dispatch a single implementer. The product does not run. |
| `sage-proof` | **rc=1** | rc=0 | non-blocking | The verification nag never fires. "Done" claims go unchecked. |
| `sage-lane` | rc=0 | rc=0 | — | Survives only because it inlines Python instead of sourcing `json-safe.sh` — i.e. by violating §7.1 rule 3. |
| `sage-bootstrap` | rc=0 | rc=0 | — | Fine. |

This is precisely the failure class the spec quoted gstack warning about — *"a deny that no-ops exactly when it matters"* — reproduced exactly. It passes on macOS, where `/bin/sh` is bash in POSIX mode, which is why it was not caught locally.

**Fix:** replace the `sed` with a POSIX-safe BOM strip, and remove the two other `$'\n'` bashisms at `sage-careful:43` and `:48` (which currently make the newline checks silently never match, defeating the compound-command detection):

```sh
# POSIX-safe, no bashisms
JSON_IN=$(printf '%s' "$JSON_IN" | sed "1s/^$(printf '\357\273\277')//")
```

Then add `dash` to the CI matrix. A hook suite that only ever runs under bash cannot catch this class of bug again.

### B2 — The lane-intersection check has false negatives

D2 — no two concurrent nodes may own intersecting file globs — is the single constraint the architecture leans on to prevent split-brain duplication, lost edits, and same-file merge conflicts. The spec was explicit: *"False positives are acceptable; false negatives are not."*

`globIntersect` only compares **literal prefixes after stripping a trailing star**, so any glob whose wildcard is not at the end is invisible to it. Measured:

| A | B | Should intersect | Reported |
|---|---|---|---|
| `src/**` | `src/api/**` | yes | ✅ yes |
| `src/**` | `src/api/foo.ts` | yes | ✅ yes |
| `src/*.ts` | `src/api.ts` | yes | ❌ **no** |
| `src/**/*.ts` | `src/api/foo.ts` | yes | ❌ **no** |
| `**/*.test.ts` | `src/api.test.ts` | yes | ❌ **no** |
| `src/api/**` | `src/**/*.ts` | yes | ❌ **no** |
| `src/a/**` | `src/b/**` | no | ✅ no |

Four false negatives in eight cases, including `src/**/*.ts` — one of the most common glob shapes in a TypeScript repo. Two implementers given those lanes will be dispatched into the same files concurrently, and the system will believe it is safe.

The repo's own fixture (`evals/fixtures/overlap-dag.json`) tests only `src/**` ∩ `src/api/**` — the one case the prefix heuristic handles — which is why this passed review.

**Most of the fix is already written and never called.** `expandAgainstTree` and `globToRegExp` implement the spec's primary decision procedure — expand both globs against the real tree and intersect the path sets — and `laneIntersections` does not reference them. Wire the tree-expansion path in as the primary check, keep prefix overlap as the belt-and-braces fallback for globs matching nothing yet, and add the seven rows above as test cases.

### B3 — The skills and role cards are outlines, not procedures

Every `references/` directory exists and **every one of them is empty**:

```
skills/{sage-shape,sage-plan,sage-dag,sage-build,sage-review,sage-verify,
        sage-ship,sage-retro,design-*}/references/     → 14 dirs, 0 files
```

Sizes against spec:

| Artifact | Spec | Shipped |
|---|---|---|
| `sage-shape/SKILL.md` | ~830 lines of substance (cap 900) | **42** |
| `design-intake/SKILL.md` | cap 900 | **33** |
| Spine skills | ≤ 250, sized to the procedure | 24–59 |
| Role cards | ≤ 80 — "a model, a scope, and a checklist" | **7–13** |
| All 19 role cards combined | — | **169 lines** |

What shipped for `sage-shape` is a competent *summary* — the procedure steps, a rationalization table, red flags, a done-when. It is well written. But step 2 reads:

> *"Interrogate, one question at a time. Cover: who has the problem; what they do instead; the narrowest useful wedge; user stories in their words; ideal flow screen-by-screen; the observable..."*

That is a bullet list of topics. The spec's §8.1 called for the **826 lines of retained substance** from gstack's `office-hours`: the forcing questions with their actual text, the pushback patterns for when an answer is evasive, the anti-sycophancy rules, the response postures, the premise-challenge phase, the mandatory alternatives generation. The entire line-count analysis in the architecture doc existed to justify keeping that material.

`agents/implementer-backend.md` is three sentences. It contains no checklist, no output contract, no scope contract.

**This is the difference between a system that behaves like a senior engineering org and one that behaves like a model with a nice table of contents.** The skeleton is right; the thing the skeleton was built to carry does not exist yet. The empty `references/` directories are the honest evidence: the architecture anticipated the content and the content was never written.

---

## 3. Major issues

| # | Issue | Evidence | Fix |
|---|---|---|---|
| M1 | **`sage-lane` and `sage-solo` hard-require `python3`** with no fallback, contradicting §4.1 (`jq` **or** `python3` **or** `node`). No python3 → `set -eu` → non-zero → `failClosed` → **every write denied**. | Both scripts are `python3 - <<'PY'` heredocs with no alternative branch. | Port both to the `json-safe.sh` helper chain, or add node/jq branches. |
| M2 | **`sage-solo` never uses `subagent_type`.** It reads it into `TYPE` and the Python only inspects `parent`, sourced from `.sage/parent-role`. Nothing deletes that file. A stale `parent-role` left by a previous reviewer dispatch **denies every subsequent spawn**. | `hooks/sage-solo:12-24` | Use the payload's own fields; write `parent-role` with a PID/turn guard and clear it on `subagentStop`. |
| M3 | **WP-00 was never completed, and both SPIKE-01 outcomes are wired at once.** No `docs/spikes/SPIKE-0N.md` exists. `hooks.json` registers `preToolUse → sage-lane` **and** `afterFileEdit → sage-lane-after` simultaneously — the primary mechanism and its fallback, live together. | `tools/spikes/` has only scaffolding; `hooks/hooks.json` | Run the probe, record the result, and enable exactly one path. Double-reporting will produce duplicate violations. |
| M4 | **Notebook assets resolve to the plugin directory, not the project's.** A rendered page links `href="../../root/rev/plugin/docs/assets/notebook.css"`. Cursor plugin paths are content-hashed and change on every update — the exact instability §4.5 was written to avoid. | rendered `spec.html` | Resolve assets against `<project>/docs/assets/`, which `/sage-setup` already populates. |
| M5 | **`sage-careful`'s HIGH-deny patterns are exact-string matches**, not the token-by-token check §7.2 specified. `rm -rf / --no-preserve-root`, `sudo rm -rf /`, `rm  -rf /` (double space) and `rm -Rf /` all miss the deny and fall through to a MEDIUM *ask*. | `hooks/sage-careful:74-80` | Tokenize the command; match on the argument set, not the literal string. |
| M6 | **Unit coverage far below spec.** §11.1 required 100% on `lib/evidence` and `lib/dag` and named nine specific cases. Shipped: **5 tests** for evidence, **3** for dag. The index-immutability assertion, the untracked-file invalidation case, and the `owns: ["**"]` rejection are absent. | `test/*.test.ts` | Add the nine named cases; they are all cheap. |
| M7 | **Tier 3 is a markdown checklist, not a runner.** WP-23's acceptance was *"Tier 3 runs unattended and reports pass/fail per scenario."* The eight scenarios are documented and the fixtures exist, but nothing executes them. | `evals/tier3/README.md` | Wire the scenarios to the fixtures already committed. Two of the eight are one-liners today. |
| M8 | **Lint enforces ceilings but no floors,** so a stub passes cleanly. `node lib/cli.js lint` returns `ok` on a 42-line `sage-shape` and 14 empty `references/` directories. | `lib/lint/index.ts` | Add: a skill declaring `references/` must have files in it; warn when a skill is under ~25% of its declared cap. |

---

## 4. Minor issues

- **`matches()` in `sage-lane` uses `g.lstrip("./")`** — Python's `lstrip` strips a *character set*, not a prefix. `".github/**"` becomes `"github/**"`, so every dotfile glob silently fails to match.
- **`check()` allow-paths matching has no boundary** — `CHANGELOG.md` also matches `CHANGELOG.md.bak`. Use path-segment comparison.
- **`activeSprintDir()` returns the lexicographically last sprint directory** and no API accepts a sprint id, so `evidence check` can silently read the wrong sprint's ledger. §5.7 assumes per-sprint scoping.
- **`wtree()` shells out to `cp`** rather than `copyFileSync`, and does not check its status. Not portable to Windows; on failure it silently drops to the slow path, losing the documented 40× stat-cache speedup.
- **`consult` does not warn when `ANTHROPIC_API_KEY` is set.** The environment is inherited, so a stray key routes Lane B to metered API billing and silently defeats the cost architecture. Warn loudly.
- **Compiled `.js` is committed beside every `.ts`** with no freshness check. These will drift. Either build in CI and gitignore the output, or add a "dist is current" assertion.
- **Dead code at the repo root:** `lib/notebook/build.py` (the Python prototype, superseded by `plugin/lib/notebook`) and a stray `message.md`.

---

## 5. What was done well

> **In plain terms:** This section is not politeness. Several of these are better than what the spec asked for, and the review would be misleading without them.

**`lib/evidence` is the strongest code in the repo.** It gets every subtle thing right: the temp `GIT_INDEX_FILE` never touches the real index; the TOCTOU guard records `wtree` only when the before-and-after fingerprints match; `HEX40` is validated **both** on write and again before the value is passed to `git` as an argument, which is the injection guard the spec called for; the transparency invariant holds — every bookkeeping failure is a stderr warning and the child's exit code is always returned; trust-on-first-use is keyed by `sha256(root) → sha256(command)`. This is faithful, careful work.

**The review pipeline behaves correctly under test.** Verified directly: a finding claiming `confidence: 9` with no `evidence` field is rewritten to `5` — mechanically, not advisorily. Two specialists hitting one fingerprint merge to `confidence: 8` and are tagged `MULTI-SPECIALIST CONFIRMED`.

**`lib/consult` implements the whole Lane B contract:** trusted-root refusal, `--allowedTools`, `--json-schema`, session capture and `--resume`, `total_cost_usd` capture, and a `rate_limit` branch that explicitly refuses to retry in a loop. It never passes `--bare`.

**Tier 2 evals are genuinely good** — 62 queries covering every catalog skill and every spine skill, with `expectIdContains` targets. This is the layer most teams skip.

**The lint is a faithful implementation of §11.4** and it passes: line caps, `disable-model-invocation` with the documented `sage-recall` exception, the three required sections, role-card caps, `lane` frontmatter, deny-tier `failClosed`, schema fixtures.

**The architecture was followed.** Thin commands and fat skills; `disable-model-invocation: true` throughout; all five schemas; four profiles; six templates; 25 catalog skills; the QA-driver/QA-analyst split; the correct model in every role card. The README correctly warns off `/add-plugin` and documents the symlink against `plugin/`.

---

## 6. What to do, in order

1. **Fix B1.** One `sed` line plus two `case` patterns, then add `dash` to CI. Roughly an hour, and it converts the safety layer from decorative to real.
2. **Get CI green and keep it green.** Three tests are failing on `main`. Nothing else should merge until that is untrue.
3. **Fix B2.** Wire the already-written `expandAgainstTree` into `laneIntersections` and add the seven glob rows above as tests. Parallel execution is unsafe until this lands.
4. **Run WP-00 properly** and enable exactly one lane-enforcement path (M3).
5. **Write the skill bodies (B3).** This is the largest remaining piece of work and it is content, not code. `sage-shape` first — it is the front door and the most under-built. Then the role cards.
6. **Close M1, M2, M4–M8** in the ordinary course.

**One process change worth making.** B1 and B2 share a shape: both were tested only against the case that works — bash for the hooks, trailing-`**` globs for the lane check. The spec's §13.16 point applies to the implementation as much as to the prompts: *test your prompts like code*, and test your code against the cases you expect to fail, not the ones you expect to pass. A `dash` row in CI and seven glob rows in a table would have caught both before this review existed.
