# sage-mode vs. Matt Pocock's `skills`: an implementation-only comparison

Evaluated by reading and executing the code on the owner's machine (macOS arm64, node v22.23.2, npm 10.9.8). Everything below that is labelled as command output was actually run. `sage-mode/docs/design/**` and all `.html` files were excluded from consideration per the evaluation rules.

Repo roots:
- **A** `/Users/rcwolf/Desktop/Projects/cursor-plugins/sage-mode` (plugin root is `plugin/`)
- **B** `/Users/rcwolf/Desktop/Projects/cursor-plugins/skills`

---

## 1. Repo A (sage-mode) as it actually is today

### Inventory

The shipping artifact is `/Users/rcwolf/Desktop/Projects/cursor-plugins/sage-mode/plugin/`, not the repo root. `wc -l` on the TypeScript engine:

| File | Lines |
|---|---|
| `plugin/lib/cli.ts` | 731 |
| `plugin/lib/lint/index.ts` | 712 |
| `plugin/lib/dag/index.ts` | 688 |
| `plugin/lib/board/index.ts` | 623 |
| `plugin/lib/review/index.ts` | 597 |
| `plugin/lib/setup/index.ts` | 493 |
| `plugin/lib/evidence/index.ts` | 450 |
| `plugin/lib/redact/index.ts` | 368 |
| `plugin/lib/egress/index.ts` | 333 |
| `plugin/lib/consult/index.ts` | 330 |
| `plugin/lib/notebook/index.ts` | 271 |
| `plugin/lib/manifest/index.ts` | 199 |
| `plugin/lib/recall/index.ts` | 192 |
| `plugin/lib/ground/index.ts` | 179 |
| `plugin/lib/util.ts` | 165 |

**6,451 lines** of `lib/**/*.ts` (120 of which are colocated tests), **5,112 lines** of `plugin/test/*.test.ts` across 17 suites, **479 lines** in `plugin/evals/tier3/run.ts`, and **1,578 lines** of POSIX shell under `plugin/hooks/` (`json-safe.sh` 388, `sage-lane` 292, `sage-careful` 214, `sage-solo` 99, `sage-proof` 87, `sage-lane-after` 82, `sage-bootstrap` 71, `host-detect.sh` 63). Prose surface: 23 `skills/*/SKILL.md` (2,326 lines), 19 `agents/*.md` (822 lines), 21 `commands/*.md` (105 lines), plus `schemas/` (5 JSON Schemas), `profiles/` (4), `templates/` (6), `rules/sage-conduct.mdc`.

### Does it build and run

Every command below was executed in `plugin/`:

- `npm install` → `up to date, audited 4 packages in 1s` (only `typescript` + `@types/node`; no network needed).
- `npm run build` (`tsc -p tsconfig.json`) → exit 0, no diagnostics.
- `npm test` → `ℹ tests 299 / ℹ pass 298 / ℹ fail 0 / ℹ skipped 1 / ℹ duration_ms 5116.6`.
- `npm run lint` (`node lib/cli.js lint`, i.e. the tool linting its own corpus) → `ok`.
- `npm run hooks:test` (`bash hooks/tests/run.sh`) → 204 `ok` lines, zero `fail` lines. It is a golden-payload suite: 49 `*.in.json` fixtures across `sage-bootstrap`, `sage-careful`, `sage-lane`, `sage-proof`, `sage-solo`, each replayed under `bash`, `dash`, and the shebang default, with separate `.out.json` (Cursor) and `.claude.out.json` (Claude Code) expectations.
- `npm run eval:tier3` → `9 passed, 0 failed, 2 skipped (of 11)`.

`.github/workflows/ci.yml` runs exactly those five steps on every push and PR.

### Source/build drift

`plugin/` commits its compiled `.js` next to its `.ts` (`outDir: "."`). After `npm run build`, `git status --porcelain` showed 114 dirty paths, 18 of them `.js`. **This is uncommitted work-in-progress, not committed drift**: every dirty `.js` has a matching dirty `.ts` (`plugin/lib/{board,cli,consult,dag,evidence,recall,review,setup}/index.{ts,js}`, seven test pairs, `evals/tier3/run.{ts,js}`), plus two new untracked pairs `plugin/test/ground.test.{ts,js}` and `plugin/test/hooks-shell-portability.test.{ts,js}`. `npm run build:check` (`build && git diff --exit-code -- '*.js'`) would fail on this tree, but only because the owner has unstaged source edits, and the guard exists precisely to catch that.

### Verified functionality (not claimed)

- `node lib/cli.js dag validate evals/fixtures/overlap-dag.json` → 7 `D2:` lane-intersection violations, exit 1.
- `node lib/cli.js dag plan evals/fixtures/interfaces-dag.json` → `{"waves":[["n1"],["n2"],["n3"]]}`, exit 0.
- `node lib/cli.js review gate < evals/fixtures/planted.jsonl` → emitted the planted `CRITICAL` finding with its evidence line intact.
- `node lib/cli.js recall "test"` → ranked, scored hits from a real on-disk index.
- `redact()` on a synthetic secret blob: redacted an Anthropic key, a `ghp_` token and an `AKIA` key to `«REDACTED:<kind>:<len>»`, left a plain line and an email alone, preserved line count exactly, and was idempotent (second pass `count=0`).
- `hooks/sage-careful` (piped real hook JSON): `rm -rf /` → `{"permission": "deny", ...}`; `ls -la` → `{}`; `git push --force origin main` → deny naming the resolved default branch; `git  push --force origin main` (double space) → correctly still denied; `echo "git push is dangerous"` → correctly allowed.

### What is stubbed, dead, or unwired

Only one real `TODO` exists in `lib/`: `plugin/lib/evidence/index.ts:191-195` records that `sage evidence run|check` never thread an explicit `--sprint`, so they always fall back to lexicographically-last. Seven exported functions have no caller anywhere in `lib/`, `test/`, `evals/` or the markdown corpus. Two of those matter:

1. **`saveReviewState` (`plugin/lib/review/index.ts:269`) is never called.** `plugin/lib/cli.ts:436-438` and `:467-469` call `loadReviewState(sprint)` and feed it to `applyCrossRunDedup(...)`, so cross-run finding suppression reads `.sage/sprints/NN/review-state.json` — but no code path, and no `skills/` or `commands/` markdown, ever writes that file (`grep -rn 'review-state\|saveReviewState' skills/ commands/ agents/` returns nothing). The dedup logic itself is correct and well tested, but with no writer the state is permanently `{}` and the feature is a no-op in practice.
2. **`shouldRedTeam` (`plugin/lib/review/index.ts:491`) is entirely dead** — defined, tested nowhere, referenced nowhere.

A third gap is disclosed rather than hidden: `plugin/hooks/hooks-claude.json` is a complete, commented Claude Code hook registration, and `plugin/test/hooks.test.ts:293-311` asserts every command path resolves and is executable — but `plugin/.claude-plugin/plugin.json` has **no `hooks` key** pointing at it (contrast `plugin/.cursor-plugin/plugin.json`, which has `"hooks": "./hooks/hooks.json"`). Its own `description` field says `"Cursor-only — this file is not a supported Claude Code install path."` So Claude Code hook enforcement exists as a file and is path-tested, but is not wired into any install.

**A bug I found by reading:** `plugin/hooks/sage-careful:162` sets `IS_GIT_PUSH` only when the second token is literally `push`, and the MEDIUM fallback at `:207` matches the contiguous substring `'git push --force'`. So `git -C /repo push --force origin main` matches neither. I confirmed it: the hook returns `{}` (allow). A genuine force-push-to-main escape.

---

## 2. Repo B (Matt Pocock's `skills`) as it actually is today

### Inventory

Executable code across the whole repo is **472 lines**:

| File | Lines |
|---|---|
| `scripts/link-skills.sh` | 56 |
| `scripts/sync-plugin-version.mjs` | 41 |
| `scripts/list-skills.sh` | 7 |
| `skills/misc/git-guardrails-claude-code/scripts/block-dangerous-git.sh` | ~25 |
| `skills/engineering/wizard/template.sh`, `skills/engineering/diagnosing-bugs/scripts/hitl-loop.template.sh`, `skills/in-progress/setup-ts-deep-modules/dependency-cruiser.config.cjs` | remainder |

Markdown is **6,938 lines**: `skills/` 3,892, `docs/` 2,110, `README.md`+`CHANGELOG.md`+`CLAUDE.md`+`CONTEXT.md` 556. 27 `SKILL.md` files across five buckets (`engineering` 18, `productivity` 7, `misc` 4, `in-progress` 8, `deprecated` empty), each with an `agents/openai.yaml` sidecar.

### Does it build and run

There is nothing to build. `package.json` (`/Users/rcwolf/Desktop/Projects/cursor-plugins/skills/package.json`) declares only `changeset`, `version`, and `check-plugin-version`. `npm test` → `npm error Missing script: "test"`. There is no lint, no typecheck, no test suite, and no eval harness anywhere in the repo (a recursive search for `*test*`/`*eval*` outside `.git` returns exactly one hit: `skills/engineering/tdd/tests.md`, a prose reference).

What I did run:
- `bash scripts/list-skills.sh` → 27 sorted `SKILL.md` paths, exit 0.
- `node scripts/sync-plugin-version.mjs --check` → `plugin.json version is 1.2.3 (already in sync)`, exit 0.
- I did **not** run `scripts/link-skills.sh`: it symlinks into the owner's real `~/.claude/skills` and `~/.agents/skills`, and its own header says it is dev-only and unsupported. Read statically, its logic is sound and it guards against `$DEST` being a symlink back into the repo (`link-skills.sh:31-40`).

`.github/workflows/release.yml` is the only workflow, and it is release-only (checkout → `npm ci` → `changesets/action@v1`). Notably it never invokes `check-plugin-version`, so the one mechanical check the repo owns is not run in CI.

### Verified integrity

Since there are no tests, I wrote my own checks against the conventions `CLAUDE.md` states. All currently hold: all 25 paths in `.claude-plugin/plugin.json`'s `skills` array resolve to a real `SKILL.md`; no `engineering/` or `productivity/` skill is missing from that array; every promoted skill is named in `README.md`; no `misc/` or `in-progress/` skill leaks into `README.md`; every promoted skill has a `docs/<bucket>/<name>.md` page. The repo-wide "no em-dashes" rule holds everywhere except `CHANGELOG.md`. This is a genuinely tidy repo — but it is tidy by author discipline, with nothing enforcing any of it.

### Content quality and rough edges

The prose is excellent and unusually operational. `skills/engineering/diagnosing-bugs/SKILL.md` (138 lines) gates Phase 2 behind a checklist that demands a named command already run at least once. `skills/engineering/code-review/SKILL.md` (87 lines) pastes a twelve-item Fowler smell baseline into a sub-agent prompt and forbids reranking across its two axes. `skills/engineering/codebase-design/SKILL.md` (114 lines) is a precise glossary with explicit "avoid these words" guidance. `skills/engineering/wayfinder/SKILL.md` (128 lines) is a coherent tracker-backed planning protocol.

Rough edges are real but honestly labelled: `skills/in-progress/retro/SKILL.md` is described in `skills/in-progress/README.md` as `"STUB: design notes only, not functional yet"`. `skills/engineering/implement/SKILL.md` is 15 lines of which 5 are body — its 97-line docs page is six times longer than the skill it documents.

**A bug I found and confirmed by execution:** `skills/misc/git-guardrails-claude-code/scripts/block-dangerous-git.sh` does unanchored `grep -qE` on substrings. Piping real hook JSON: `git  push origin main` (double space) → **exit 0, not blocked**; `git -C /repo push` → **exit 0, not blocked**; `echo "git push is dangerous"` → **exit 2, blocked** (false positive). It also hard-depends on `jq` with no fallback and no presence check, so on a machine without `jq` `$COMMAND` is empty, no pattern matches, and the guard **fails open**. It lives in `misc/` and is not shipped in the plugin, which limits the blast radius.

---

## 3. Direct side-by-side

| Axis | A (sage-mode) | B (skills) |
|---|---|---|
| Executable lines | ~12,050 TS + 1,578 shell | 472 total |
| Test lines | 5,112 + 49 golden hook fixtures + 11 evals | 0 |
| Verified test run | 299 tests, 298 pass, 0 fail | no test script exists |
| CI | 5 gates on every push (`ci.yml`) | release-only; runs no checks |
| Build | `tsc` clean, exit 0 | nothing to build |
| Self-linting of prose | `npm run lint` → `ok`; `test/conventions.test.ts` (380 lines) validates the corpus | none; conventions in `CLAUDE.md` prose only |
| Doc:code ratio | ~0.5:1 (5,949 prose : ~12,050 code) | ~14.7:1 (6,938 prose : 472 code) |
| Bugs found by reading | 1 hook escape, 1 dead feature, 1 dead function, 1 TODO | 1 fail-open guard with a confirmed bypass |
| Honesty about gaps | high (eval `SKIP`s explain exactly what is unexercised) | high (`STUB` labelled, open issue #746 cited in docs) |

The most striking asymmetry is not size but *self-verification*. `plugin/test/conventions.test.ts` mechanically enforces, against the real corpus, that every `references/` path a `SKILL.md` names resolves (`:99`), that no skill reaches outside its own directory (`:143`), that every `SKILL.md` `name` matches its directory (`:242`), that every review specialist has a checklist and every checklist is referenced (`:275`), and that every command's target skill exists (`:315`). Repo B states equivalent rules in `CLAUDE.md` and satisfies them today, but a rename would silently break them.

Repo B's real advantage is **documentation as product**. `docs/engineering/tdd.md` (94 lines) explains what the skill does, when to reach for it, a routing table to sibling skills, and an explicit named hole with a live GitHub issue number. Nothing in sage-mode's non-excluded surface addresses a user that way; `plugin/README.md` is 60-odd lines of install and command reference.

---

## 4. Asymmetric capabilities (checked for actual wiring)

**Only in A, and genuinely wired:**
- **Egress ledger with a hash chain.** `lib/egress/index.ts:173 record()` is imported and called from `lib/consult/index.ts:6,180`, which records a pre-flight and a post-flight row per dispatch. `lib/cli.ts:644-668` exposes `list`/`verify`/`grants`. I ran `node lib/cli.js egress verify` → `ok — no ledger file yet` (correct: the git root has no `.sage/`), and read a real 2-row chained ledger at `plugin/.sage/egress.jsonl` with `prev_hash`/`hash` fields.
- **Redaction before egress.** `redact()` is called at `lib/consult/index.ts:209` on the payload before dispatch; verified idempotent and line-preserving above. 222 lines of tests.
- **Ownership-tracked install/uninstall.** `lib/setup/index.ts` + `lib/manifest/index.ts`, covered by the largest suite in the repo (`test/setup.test.ts`, 746 lines) including symlink handling, path traversal, corrupt manifests, and a HOME/project-root collision refusal.
- **Cross-shell hook enforcement.** 49 golden payloads × 3 shells × 2 host response shapes, all passing.
- **Evidence freshness gating.** `sage evidence check` returns `STALE` on a `cmd_sha256` mismatch with a non-zero exit — exercised live by tier-3 scenario 7.

**Only in A, but not actually wired (be skeptical here):**
- Cross-run review dedup (`saveReviewState` has no writer — see §1).
- `shouldRedTeam` (dead).
- Claude Code hook registration (`hooks-claude.json` is not referenced by `.claude-plugin/plugin.json`).

**Only in B, and genuinely present:**
- A **user-facing docs tree** (`docs/engineering/*`, `docs/productivity/*`, 2,110 lines) with a documented template (`.agents/writing-docs.md`) and published URLs.
- A **release pipeline**: changesets, a 44K-line `CHANGELOG.md`, semver, and `sync-plugin-version.mjs` keeping `package.json` and `plugin.json` aligned. Repo A is pinned at `1.0.0` with no versioning process.
- **Cross-harness packaging**: every skill carries `agents/openai.yaml`, and `link-skills.sh` targets both `~/.claude/skills` and `~/.agents/skills`. Repo A is Cursor-only by its own README.
- **A router skill** (`skills/engineering/ask-matt/SKILL.md`) that maps every user-reachable skill.

---

## 5. VERDICT

**sage-mode.**

Judged purely on implemented, working code — the standard this evaluation was asked to apply — it is not close. Repo A has roughly 12,050 lines of TypeScript and 1,578 lines of POSIX shell that I compiled, executed, and probed: `tsc` exits clean, 299 tests run with 298 passing and zero failures, a 49-fixture golden hook suite passes 204 assertions across three shells, an 11-scenario adherence eval reports 9 passed / 0 failed / 2 honestly skipped, and all five gates run in CI on every push. When I drove the CLI and hooks directly, they did what the skills claim: the DAG validator rejected an overlapping graph with 7 specific violations and exit 1, the review gate preserved a planted `CRITICAL` finding, the redactor was idempotent and line-preserving, and `sage-careful` denied `rm -rf /` and a double-spaced force-push while correctly ignoring an `echo` that merely contained the words. Repo B, by contrast, contains 472 lines of executable code total, has no test script, no build, no lint, and a release-only CI that does not even run the one check it defines; its single security-shaped artifact fails open without `jq` and is bypassed by an extra space. Repo B's markdown is genuinely better writing than sage-mode's, and its docs tree and changesets pipeline are real assets sage-mode lacks — but a 14.7:1 documentation-to-code ratio measured against a 0.5:1 one is the whole comparison in a number. The two dead paths I found in sage-mode (`saveReviewState` with no writer, `shouldRedTeam` unreferenced) and the `git -C … push --force` hook escape are each a half-day fix inside a codebase that already has the test harness to lock them down; repo B would have to build that harness from zero.

**The conditions under which Matt's repo is the right call instead:** if the owner wants to *stop building* and just consume — repo B is a maintained, versioned, publicly released product with a real changelog, and sage-mode is a single-author `1.0.0` with 114 uncommitted files on `main`. If the harness is anything other than Cursor, repo B wins outright: sage-mode's own `plugin/README.md` and `.claude-plugin/plugin.json` say Claude Code is unsupported, and `hooks-claude.json` is not wired into any install, whereas repo B ships a validated Claude Code plugin plus `openai.yaml` for every skill. And if the actual need is *prose that steers a model well* rather than enforcement in code — `diagnosing-bugs`, `code-review` and `codebase-design` are better-written than anything of comparable scope in sage-mode's skill corpus, and adopting those three as reading material costs nothing. The strongest move available is not either/or: keep sage-mode as the engine and lift repo B's docs discipline and release process into it.
