# sage-mode — Ship Plan

**Prepared:** 2026-08-31 · **Target:** `plugin/` at `8788f86` + working tree · **For:** the engineer implementing this
**Inputs this consolidates:** [audit](./audit-2026-08-31.html) · [conformance](./conformance-v3.html) · [spike run report](./report.html) · [runbook](./runbook-install-and-spikes.html) · [architecture-v3](./architecture-v3.html)

> **Read this first.** The codebase is in better shape than this document's length suggests. 277 unit tests pass on Linux, the mechanics are faithful to the design, and several are better than the design. What blocks shipping is a small number of specific defects — one of them a live security failure on macOS — plus two platform questions that have never been answered. Everything below is scoped, located to a line, and has an acceptance test. Estimated total: **2–3 days**, most of it in WP-1 and WP-5.

---

## 0. Definition of done

Ship = all six true, verified in one sitting:

1. `npm run verify` exits 0 on **macOS** (not just Linux CI). Expected tail: `277 pass / 0 fail`, then `7 passed, 0 failed, 1 skipped (of 8)`.
2. `hooks/tests/run.sh` passes under **bash 3.2 (`/bin/sh` on macOS)**, `dash`, and `bash 5`, and can no longer report `ok` for a hook that produced no output.
3. SPIKE-01 has a **live** host payload recorded in `docs/spikes/SPIKE-01.md`, with `status: decided`.
4. SPIKE-02's **Cursor** arm is decided, with a usage/cost line as evidence — not a self-report.
5. Either Claude Code loads plugin agents and dispatches them, **or** the Claude Code manifest and host claims are removed and sage-mode ships Cursor-only. No half-port.
6. One real sprint has run end-to-end on a real project and `plugin/evals/comparison.md` is filled in.

Items 1–2 are correctness. 3–5 are "we know what we built." 6 is the only one that answers whether it's worth using — do not skip it because the others feel more like engineering.

---

## 1. Priority summary

| WP | Title | Severity | Est. | Blocks |
|---|---|---|---|---|
| **WP-1** | `sage-lane` cannot deny on macOS — fail-closed is inverted to fail-open | **Critical** | 4–6h | everything |
| **WP-2** | Golden harness reports `ok` for a hook that never ran | **Critical** | 2h | WP-1 verification |
| **WP-3** | `npm test` makes live, billable model calls | High | 1h | dev ergonomics |
| **WP-4** | SPIKE-01 — capture a live payload | High | 1h | lane architecture |
| **WP-5** | SPIKE-02 (Cursor) — decide the cost architecture | High | 2h | Lane A/B/C validity |
| **WP-6** | Claude Code: manifest rejected, agents never load | High | 3h | host claim |
| **WP-7** | Role-card `model:` values break Claude Code dispatch | High | 3h | WP-6 |
| **WP-8** | `sage setup` never writes `.claude/agents/` | Medium | 2h | WP-6/7 |
| **WP-9** | §10's two coordination hooks were never built | Medium | 4h | `/sage-build` UX |
| **WP-10** | Cross-session dedup is prose, not code | Medium | 3h | review quality |
| **WP-11** | Lane B consult narrower than spec; no `--bare` guard | Low | 1h | — |
| **WP-12** | Documentation drift | Low | 2h | — |
| **WP-13** | `docs/build.py` is unrunnable | Low | 1h | notebook |
| **WP-14** | Working-tree hygiene | Low | 15m | commits |
| **WP-15** | Run one real sprint | **Required** | 1 day | ship decision |

---

## WP-1 — `sage-lane` cannot deny on macOS *(Critical)*

### Problem

On macOS, `hooks/sage-lane` produces **no output and exits 0**. Callers parse empty stdout as `{}`, which is the *allow* shape. A hook registered `failClosed: true` therefore **allows every write it was built to deny**. `hooks/sage-solo` (also deny-tier) and `hooks/sage-proof` carry the same latent construct.

Reproduction (from `report.md` §7.3, on macOS):

```
$ printf '%s' '{"tool_input":{"path":"src/web/x.ts"}}' \
    | CURSOR_PROJECT_DIR="$TMP" ./hooks/sage-lane
/Users/.../hooks/sage-lane: line 289: unexpected EOF while looking for matching `"'
exit=0
```

### Root cause — confirmed by inspection

Every hook is `#!/usr/bin/env sh`. On macOS `/bin/sh` is **bash 3.2.57**, frozen since 2007 (GPLv3), and it is the only shell that matters here because it is what the shebang resolves to on the primary dev machine.

The hooks use a **heredoc nested inside command substitution**:

```sh
LANE_RESULT=$(node - "$ROOT" "$LANE" "$PAY" <<'JS'
  ... 158 lines of JavaScript ...
JS
)
```

bash 3.2 cannot parse this. It scans forward for the matching `)` and **tokenizes the heredoc body as shell**. In `sage-lane` the trigger is two JavaScript comments containing an apostrophe:

- **`hooks/sage-lane:127`** — `// Match Python's list repr (single-quoted) so agent_message text is`
- **`hooks/sage-lane:176`** — `// possible, then join the remaining unresolved tail, mirroring Python's`

Line 127's apostrophe opens a single-quoted string that never closes on that line. The parser desynchronizes and runs to EOF — producing `line 289: unexpected EOF`, line 289 being the last code line in a 290-line file. Because it is a **parse-time** failure, the script never executes at all.

### Full inventory — this is not one hook

| File | Line | Construct | Body | Interpreter | Polarity |
|---|---|---|---|---|---|
| `hooks/sage-lane` | 38 | `$(python3 - … <<'PY'` | 39–112 | python3 | deny, `failClosed` |
| `hooks/sage-lane` | 116 | `$(node - … <<'JS'` | 117–274 | node | deny, `failClosed` — **breaks today** |
| `hooks/sage-proof` | 32 | `$(python3 - … <<'PY'` | 33–77 | python3 | bounded nag |
| `hooks/sage-solo` | 54 | `$(python3 - … <<'PY'` | 55–65 | python3 | deny, `failClosed` |
| `hooks/sage-solo` | 69 | `$(node - … <<'JS'` | 70–80 | node | deny, `failClosed` |

The other four have no odd-quote lines **today**, so they parse by luck. One apostrophe added to any comment in any of them silently breaks a security hook, on macOS only, with no test failure. Treat all five as the same defect.

### Fix

**Do not** just delete the two apostrophes. That unblocks today and leaves the landmine.

**Required:** eliminate the construct. For each of the five sites, write the embedded interpreter source to a temp file and execute the file — no heredoc inside `$( )`:

```sh
LANE_SRC=$(mktemp "${TMPDIR:-/tmp}/sage-lane-src.XXXXXX")
trap 'rm -f "$PAY" "$LANE_SRC"' EXIT      # extend the existing trap
cat > "$LANE_SRC" <<'JS'
  ... unchanged body ...
JS
LANE_RESULT=$(node "$LANE_SRC" "$ROOT" "$LANE" "$PAY")
```

A bare `cat > file <<'EOF'` at statement level parses correctly in bash 3.2; only the `$( … <<HEREDOC … )` nesting is broken. Keep the quoted terminator (`<<'JS'`, not `<<JS`) so the body is never expanded. Extend each script's existing `trap … EXIT` rather than adding a second one — a second `trap` replaces the first.

Note the interpreter invocation changes from `node -` (stdin) to `node "$FILE"`. `sys.argv`/`process.argv` indices shift by one for the python3 sites (`python3 -` puts args at `argv[1..]`; `python3 file.py` does too — verify per site rather than assuming).

**Also:** as a belt-and-braces measure, reword the two apostrophe comments anyway ("Match the Python list repr", "mirroring the Python side"). Cheap, and it makes the tactical state safe if the refactor is staged.

### Acceptance

- `hooks/tests/run.sh` passes with `/bin/sh` = bash 3.2 on macOS (WP-2 must land first or this test can still lie).
- Hand-check on macOS: the reproduction above emits the deny JSON and exits 0 (Cursor) / 2 (Claude Code).
- `npm run eval:tier3` scenario 4 (*"Implementer asked to touch a file outside its lane"*) passes on macOS.
- New guard test (WP-2) fails if the construct is reintroduced.

### Risk

Moderate. The heredoc bodies are large (158 lines in one case) and must be moved byte-identically. Move them without editing, land the refactor and the test together, and diff the extracted bodies against the originals to prove nothing changed.

---

## WP-2 — The golden harness reports `ok` for a hook that never ran *(Critical)*

### Problem

`hooks/tests/run.sh:70`:

```sh
echo "$got" | python3 -c "import json,sys; s=sys.stdin.read().strip() or '{}'
```

**Empty stdout is normalized to `{}`.** And `hooks/tests/sage-lane/allow-in-lane.out.json` is literally `{}`.

So a hook that crashed at parse time — no output, exit 0 — is byte-identical to a hook that ran correctly and allowed. Every *allow* fixture reports `ok` against a completely broken script. This is why `report.md` saw deny cases fail while allow cases passed: **the allow passes were false**.

The harness cannot distinguish "allowed" from "never ran." That is the single most important test-integrity bug in the repo, and it is the same class of error the codebase's own §8.7 rule forbids: *absence of proof is never proof of absence*.

### Fix

1. In `run.sh`, stop coercing empty to `{}`. Emit a distinguishable sentinel when stdout is empty/whitespace — e.g. write the literal string `__EMPTY__` to `$GOT_FILE`.
2. In `hooks/tests/compare.py`, fail loudly on that sentinel with a message naming the likely cause:
   `FAIL <fixture> — hook produced NO output (parse error or crash?). Empty stdout is not an allow.`
3. Add a **construct guard** test (new file, e.g. `test/hooks-shell-portability.test.ts`) that greps every file in `hooks/` for `=\$\((python3|node|awk|sed)\b[^)]*<<` and fails with the file and line if found. This is what prevents WP-1 from silently regressing.
4. If a bash-3.2 binary can be made available in CI, add it to `run.sh`'s shell matrix. If not — likely — say so explicitly in `run.sh`'s header comment and rely on the guard in step 3, because **CI on `ubuntu-latest` will never catch this**: `sh` is `dash` there.

### Acceptance

- With WP-1 deliberately reverted, `run.sh` **fails** on the allow fixtures instead of printing `ok`.
- With WP-1 applied, everything passes under bash 3.2, dash, and bash 5.
- The guard test fails when a heredoc-in-`$()` is reintroduced anywhere in `hooks/`.

### Sequencing

**Do WP-2 before WP-1.** You need a test that can actually see the bug before you fix the bug — otherwise you cannot prove the fix worked.

---

## WP-3 — `npm test` makes live, billable model calls *(High)*

### Problem

`test/consult.test.ts:84` (*"a real dispatch (claude present) records at least one egress row"*) and the redaction tests at lines 135 and 185 call `consult()` for real. On any machine with `claude` on `PATH`, that **dispatches a live model call**. On the reporting machine one test took **181 seconds**, and because `ANTHROPIC_API_KEY` was set in that environment, it billed **metered API rates rather than the subscription** — the exact failure Lane B exists to prevent.

The tests are deliberate and documented, but a unit suite that costs money and three minutes is one people stop running.

### Fix

- Gate the live-dispatch assertions behind an explicit opt-in (`SAGE_TEST_LIVE_CONSULT=1`), skipping with a clear reason otherwise. Keep the offline assertions (structure, redaction of the payload before spawn, egress-row shape) running always — those do not need a real dispatch, only a fake `claude` on `PATH`, which `test/consult.test.ts` already knows how to build (see the fake-bin helper around line 153).
- Add the opt-in run to CI only if CI has credentials; otherwise leave it developer-invoked.
- Make `consult()`'s `ANTHROPIC_API_KEY` warning fail the test run when the live path is enabled, rather than warning — if the suite is going to spend money it should at least spend the right money.

### Acceptance

`npm test` completes in well under 30s with no network egress and no `claude` invocation. `SAGE_TEST_LIVE_CONSULT=1 npm test` exercises the live path.

---

## WP-4 — SPIKE-01: capture a live payload *(High)*

### Status

**Not answered.** `plugin/tools/spikes/spike-01-write-path/out/verdict.txt` contains three entries, all stamped `2026-08-31T08:13:20Z` — the same second — with contents `/tmp/synthetic-path.ts`, `{}`, and `{"file_path":"/tmp/after-edit.ts"}`. These are hand-fed payloads that validate *the probe*. **No live host payload has ever been captured.**

Two reasons it did not fire, both recorded in `report.md`:

- **Cursor:** the local plugin symlink was created mid-session and **Developer: Reload Window was never performed**. The hook was on disk, not live.
- **Claude Code:** `--plugin-dir` never loaded the plugin at all (WP-6), so `PreToolUse` never ran.

### Procedure

1. Confirm `~/.cursor/plugins/local/sage-mode → …/sage-mode/plugin` exists.
2. **Developer: Reload Window.**
3. `cd plugin && ./tools/spikes/spike-01-write-path/install.sh`. Reload again — Cursor does not reliably hot-reload hook config.
4. In a **new** chat, have the agent **`Write`** a file. The probe matcher is `"Write"` **only** — the previous attempt used `StrReplace`/Edit, which could never have matched even with the hook live. Then also exercise Edit/MultiEdit/Delete for coverage.
5. `./tools/spikes/spike-01-write-path/read-result.sh`.
6. Paste `verdict.txt` plus one raw `payloads.jsonl` line into `docs/spikes/SPIKE-01.md`; set `status: decided`.

### Known-good ground truth (from the transcript, not the hook)

Claude Code's **tool** layer uses `file_path` on both Write and Edit:

```json
{"name":"Write","input":{"file_path":"/abs/path.txt","content":"…"}}
{"name":"Edit","input":{"file_path":"/abs/path.txt","old_string":"…","new_string":"…","replace_all":false}}
```

Cursor's `Write` uses `path` + `contents`; `StrReplace` uses `path` + `old_string` + `new_string`. **If** `preToolUse` wraps either under `tool_input`, `sage-lane`'s existing key order (`path`, `file_path`, `filePath`, `target_file`, `file`, then top-level `file_path`) already covers both. That is a strong prior, **not a result.**

### Branches

| Outcome | Action |
|---|---|
| PASS, key already in `sage-lane`'s list | Record PASS. No code change. Phase 5 unblocked. |
| PASS, key **not** in the list | Add the key to `hooks/sage-lane`, add a golden fixture, `npm run hooks:test`, then record. |
| FAIL | Switch `hooks/hooks.json`'s lane entry from `preToolUse → sage-lane` to `afterFileEdit → sage-lane-after`, re-estimate WP-9/phase 5 (lane safety becomes corrective, not preventive), record FAIL with the payload. |

### Traps

- **Do not switch to `sage-lane-after` yet.** That is the FAIL path and there is no FAIL — there is "the hook never ran."
- **A path in the payload does not mean lane enforcement works.** WP-1 must land first, or `sage-lane` still cannot emit a deny on macOS regardless of what the payload contains.
- `docs/spikes/SPIKE-01.md` claims `sage-lane-after` is left unregistered. **That is stale** — it is registered on `afterFileEdit` (Cursor) and `PostToolUse` (Claude Code). Fix in WP-12.

---

## WP-5 — SPIKE-02 (Cursor): decide the cost architecture *(High)*

### Status

**The Claude Code arm is decided. The Cursor arm — the one Lane A/B/C actually rests on — is not.**

Decided, on host usage attribution (strong evidence, independently verified against the raw JSON receipts):

| Path | Result | Evidence |
|---|---|---|
| Claude Code project-local `.claude/agents/`, `model: haiku` | **PASS** | session billed 100% `claude-haiku-4-5-20251001` ($0.0303, zero sonnet); no-`model:` control billed `claude-sonnet-5` ($0.0705). Subagent path agrees: haiku $0.0199 child + sonnet $0.0625 parent, 1 spawned / 1 completed |
| Claude Code project-local, `model: gemini-3.7-flash` | **FAIL, loud** | `[claude-code:unrecognized_model]`; `subagent_stats {spawned:1, completed:0, failed:1}`; child never billed |
| Claude Code via `--plugin-dir` | **FAIL** | `--agent zz-spike02-* not found`; `agent_listing_delta` listed only built-ins |
| **Cursor, plugin-shipped `agents/` path** | **UNKNOWN** | no window reload; plugin agents absent from the session's `Task` enum |

### The finding that may settle this before you start

The reporting session's Cursor `Task` tool accepted exactly these model slugs:

```
inherit | claude-4.5-haiku-thinking | claude-4.6-sonnet-medium-thinking |
composer-2.5 | composer-2.5-fast | cursor-grok-4.6-high | gpt-5.6-sol-medium
```

**There is no `gemini-3.7-flash`.** That is the literal pin on `agents/reviewer.md`, `agents/red-team.md`, and `agents/design-critic.md`. A `Task` pin to `claude-4.5-haiku-thinking` *did* route correctly, so Cursor can dispatch a subagent to a non-session model **when the slug is in the schema**.

**Test the enum question first.** If plugin agents dispatch through that enum and it has no gemini, Lane C cannot be `gemini-3.7-flash` regardless of whether frontmatter is honored, and the answer is to move Lane C to `gpt-5.6-sol-medium` — still metered, still a genuinely different vendor, which is the property §5 actually requires.

### Procedure

1. Reload Window (as WP-4).
2. `./tools/spikes/spike-02-subagent-model/install.sh`, reload again.
3. Check whether `zz-spike02-*` appear as dispatchable agents or `@`-mentionable targets at all. If they do not appear after a reload, that is itself the answer.
4. Dispatch probe 1 (control, no `model:`) and probe 3 (`zz-spike02-cursor-lane-c`, `model: gemini-3.7-flash`).
5. **The only PASS is a usage/cost line naming `gemini-3.7-flash`.** A subagent's self-report is worthless — treat it as data, never as evidence. A dispatch error is the loud-FAIL bucket and is a perfectly good result; record the exact text.
6. `./tools/spikes/spike-02-subagent-model/uninstall.sh`; record in `docs/spikes/SPIKE-02.md`.

### Branches

| Outcome | Action |
|---|---|
| PASS | Record. Lane A/B/C is real. No code change. |
| FAIL, silently ignored | Cost control is not wired via the plugin path. `sage setup` already writes 19 cards to `<project>/.cursor/agents/` — **test whether that path is honored before building anything**, it may already carry it. Then re-estimate the staleness problem (project copies drifting from shipped versions). Scorecard cost-control drops 10 → ~6. |
| FAIL, dispatch error / no gemini slug | Move Lane C to `gpt-5.6-sol-medium` across `reviewer.md`, `red-team.md`, `design-critic.md`. Re-verify with a usage line. |

### Trap

**Do not let the Claude Code haiku PASS stand in for a Cursor PASS.** They are different hosts, different discovery paths, and different model namespaces. `report.md` is explicit about this and it is the easiest mistake to make when skimming.

---

## WP-6 — Claude Code: manifest rejected, agents never load *(High)*

### Problem

`claude plugin validate <plugin>` on Claude Code 2.1.241:

```
✘ agents: Invalid input
⚠ _comment_no_rules: Unknown field
Validating hooks: .../plugin/hooks/hooks.json          ← WRONG FILE
✘ hooks.sessionStart / beforeShellExecution / preToolUse /
  afterFileEdit / subagentStart / stop: Invalid key in record
✘ Validation failed
```

Two distinct bugs:

1. **`"agents": "./agents"` is rejected.** Per Claude Code's plugin reference, `agents`/`commands` accept `string | array`, but every documented array example points at **individual `.md` files**, and — decisively — components at default locations are **auto-discovered**, with the manifest described as *"optional if components use default locations."* All three of sage-mode's directories (`agents/` 19, `commands/` 17, `skills/` 20) **are** at default locations. So `skills`, `agents`, and `commands` are redundant overrides, and one of them is malformed.
2. **The validator read Cursor's `hooks.json`** despite the manifest declaring `"hooks": "./hooks/hooks-claude.json"`, then rejected its camelCase Cursor event names. Either the path form is wrong or `hooks` resolution differs from what the manifest assumes.

Net effect: `agent_listing_delta` under `--plugin-dir` added only `claude, Explore, general-purpose, Plan, statusline-setup`. **No sage-mode agents, skills, or hooks load on Claude Code at all.**

### Fix

1. Delete `skills`, `agents`, and `commands` from `.claude-plugin/plugin.json`; rely on convention discovery. Delete `_comment_no_rules` (move its content to `hooks/README.md`, which already has a "Claude Code gaps" section).
2. Re-run `claude plugin validate <plugin> --strict` and iterate on `hooks` until it inspects `hooks-claude.json`. If the string form cannot be made to resolve, try the array form; if neither works, drop the key and place the Claude hook config wherever convention expects it.
3. Test with a **real** plugin install, not only `--plugin-dir` — `report.md` notes `--plugin-dir` may not be equivalent to an installed plugin.
4. **Add a test.** `grep -rln "claude-plugin" test/` currently returns only `hooks.test.*`; the Claude manifest itself has no coverage. Add a test asserting it parses, contains no unknown fields, and points `hooks` at a file that exists.

### Acceptance

`claude plugin validate --strict` passes. `claude --agent reviewer …` resolves. `agent_listing_delta` includes sage-mode agents.

---

## WP-7 — Role-card `model:` values break Claude Code dispatch *(High)*

### Problem

16 of 19 role cards pin a non-Anthropic model:

```
model: gemini-3.7-flash   reviewer, red-team, design-critic                        (3)
model: grok-4.5           implementer-{ai,backend,data,frontend,infra},
                          qa-driver, librarian, design-technologist,
                          design-strategist                                        (9)
model: grok-4.6           architect, eng-manager, design-motion,
                          design-art-director                                      (4)
```

Claude Code accepts only `sonnet | opus | haiku | fable | inherit` or a full Claude model ID. A non-Claude value produces a **hard dispatch failure**, proven in WP-5's evidence.

**WP-6 and WP-7 must land together.** Fixing agent loading without fixing model values converts a silent absence into a loud breakage of Reviewer, Red Team, and every implementer.

Each card already carries the answer in a comment — *"Claude Code fallback: opus / sonnet / haiku"* — but a comment is not a mechanism.

### Options

- **(a) Host-gated cards.** Ship `agents/` (Cursor values) and a Claude variant, and have `sage setup` install the right set per host. Most correct; most work; introduces a duplication/staleness problem.
- **(b) Single card, host-resolved at install.** `sage setup` rewrites `model:` per host from a mapping table (`grok-4.6 → opus`, `grok-4.5 → sonnet`, `gemini-3.7-flash → haiku`). One source of truth. Requires setup to own the transform and the manifest to track it — machinery `lib/setup` and `lib/manifest` already have.
- **(c) Drop `model:` on Claude Code** and accept `inherit` everywhere, documenting that Lane A/B/C is a Cursor-only feature.

**Recommended: (b)**, with (c) as the fallback if WP-5 shows the Lane story does not hold on Cursor either. Whichever you pick, add a lint rule: a card's `model:` must be valid for at least one declared host, and the host mapping must be total.

### Acceptance

Dispatching `reviewer` on Claude Code succeeds and the usage line names a Claude model. `npm run lint` fails if a card carries a model no declared host accepts.

---

## WP-8 — `sage setup` never writes `.claude/agents/` *(Medium)*

`lib/setup/index.ts:57` builds install targets as `join(".cursor", "agents", name)` and nothing else. There is no `.claude/agents/` path.

Combined with WP-6, Claude Code today has **no working agent roster by any route**: the plugin path does not load them, and the project-local fallback — **the one path WP-5 proved honors `model:`** — is never written.

This is the cheapest large win in the document: the destination is already proven to work.

**Fix:** detect the host (or accept `--host cursor|claude|both`) and install the appropriate card set, applying WP-7's model mapping. Register both paths in the install manifest so `sage uninstall` and `checkHealth` stay accurate. Extend `test/setup.test.ts` — it already covers preserve-on-modify, symlinks, corrupt manifests, and path traversal; mirror that coverage for the new path.

---

## WP-9 — §10's two coordination hooks were never built *(Medium)*

`architecture-v3` §10 states:

> *"`subagentStop` returns a `followup_message` so the manager auto-chains the next node. `postToolUse` returns `additional_context` so the ledger state is injected right after a Task returns."*

Neither exists. `hooks/hooks.json` has no `subagentStop` and **no `postToolUse` at all**; `hooks-claude.json` registers `PostToolUse` only for `sage-lane-after` and states `SubagentStop` is *"intentionally left unregistered."*

Consequence: `/sage-build` does not self-drive. The Eng Manager must notice a node finished and call `sage board next` itself, every node, in the phase designed to run unattended — and re-reads files to stay oriented, which is the token cost the hook was meant to remove. Nothing is broken (the ledger is genuinely disk-authoritative and `sage board next` works), but this is the largest design-to-code gap in the repo.

**Decide explicitly:** build both hooks, or amend §10 to describe the manual loop. Do not leave the architecture claiming an automation that does not exist. Sequence after WP-1 — do not add hooks while the hook layer is broken.

---

## WP-10 — Cross-session dedup is prose, not code *(Medium)*

`architecture-v3` §8.3: *"Cross-session dedup suppresses previously-skipped findings only if the file hasn't changed — never `fixed` ones, since those can regress."*

The rule is written correctly at `skills/sage-review/SKILL.md:104` and appears **nowhere** in `lib/review/index.ts` — no `skipped` handling, no prior-run state, no file-change check. Within-run dedup (fingerprint collapse, `MULTI-SPECIALIST CONFIRMED`, `+1` confidence boost) is fully mechanical.

This inverts the repo's own posture: every other §8 mechanic was moved into a library precisely so it could not be skipped. Implement it in `lib/review` with prior-run state persisted under `.sage/sprints/NN/`, keyed on fingerprint, storing the file's content hash at the time of the skip. Never suppress a `fixed` finding.

---

## WP-11 — Lane B consult narrower than spec; no `--bare` guard *(Low)*

1. `lib/consult/index.ts:265` passes `--allowedTools "Read,Grep,Glob"`. §5 specifies `"Read,Grep,Glob,Bash(git diff *),Bash(git log *)"`. The Architect consult — the one turning a spec into a DAG — cannot read git history. Restore the two scoped patterns, or record why they were dropped.
2. §5 is emphatic that `--bare` must never be passed (bare mode bypasses subscription login and reverts to metered API billing). The code never passes it, but there is **no comment, guard, or test** asserting that. Add a test asserting `--bare` is absent from the spawned argv.

---

## WP-12 — Documentation drift *(Low)*

| File | Wrong claim | Correction |
|---|---|---|
| `docs/spikes/SPIKE-01.md` | *"`sage-lane-after` is left in place and working, but unregistered"* | It **is** registered — `afterFileEdit` (Cursor), `PostToolUse` (Claude Code) |
| `docs/spikes/SPIKE-01.md` / `SPIKE-02.md` | Procedures point at `sage-mode/tools/spikes/` | Point at `plugin/tools/spikes/` — the older root stubs are weaker and Cursor-only |
| `docs/spikes/SPIKE-02.md` | *"nothing in this repo currently installs a project-local copy under `<project>/.cursor/agents/`"* | `sage setup` writes 19 of them |
| `docs/research/scorecard.md` §6 | *"Maturity: 1. Zero lines of code."* | ~5,800 lines of runtime TypeScript, 277 tests |
| `architecture-v3` §7 | `sage-shape/SKILL.md` at *"~830 lines"* | 427 lines + ~225 in `references/` |
| `architecture-v3` §3, §4, §11 | 8 commands, ~9 roles, 6 `lib/` modules | **17 commands, 19 agents, 12 modules** — see below |

**The structural one.** The shipped product is roughly twice the surface v3 describes. An entire design organization — 6 commands, 7 agent cards, an anti-slop rubric — appears **nowhere** in architecture-v3 (`grep -ic "design-intake|design-direction|art director|design-critique"` → `0`). Plus `/sage-setup`, `/sage-status`, `/sage-unsafe`, and six unmentioned `lib/` modules (`egress`, `redact`, `manifest`, `setup`, `lint`, `recall`).

Either write a v4 that describes what exists, or split the design org into its own plugin. Right now the architecture of record does not describe what a user installs, and that will mislead the next person as much as the stale sentences above.

---

## WP-13 — `docs/build.py` is unrunnable *(Low)*

```
ModuleNotFoundError: No module named 'markdown'
```

Beyond the missing dependency it hardcodes `SRC = "/home/claude/sage-docs"` and `OUT = "/home/claude/nb"`, and its explicit `PAGES` list omits `audit-2026-08-31.md`, `conformance-v3.md`, `report.md`, `runbook-install-and-spikes.md`, and this file. Nobody can render the research notebook.

Fix: derive paths from the script's own location, add a `requirements.txt` or vendor the dependency, and either auto-discover `docs/**/*.md` or fail loudly when a page on disk is missing from `PAGES`.

---

## WP-14 — Working-tree hygiene *(Low, do first)*

**Verified clean as of 2026-08-31 08:40.** Both `uninstall.sh` scripts have been run: the probe entry is gone from `hooks/hooks.json` and `hooks/hooks-claude.json`, the `.spike01-orig` backups are removed, and no `zz-spike02-*.md` cards remain in `agents/`. Nothing to undo — this section is the standing rule, not an outstanding task.

**The standing rule.** While a spike is installed, `hooks/hooks.json` and `hooks/hooks-claude.json` carry a probe entry with a **hardcoded absolute path** (`/Users/rcwolf/Desktop/…/probe-hook`). `install.sh` generates it that way by design. It must never reach a commit — it breaks every install not on that machine. WP-4 and WP-5 both re-install probes, so run this before every commit during that work:

```bash
cd plugin
./tools/spikes/spike-01-write-path/uninstall.sh
./tools/spikes/spike-02-subagent-model/uninstall.sh
git diff --stat hooks/     # must be empty before committing
```

Consider a pre-commit check that fails on `/Users/` or any absolute path inside `hooks/*.json` — three separate documents in this repo have now had to warn about this, which is the signal it should be mechanical.

**Spike output currently on disk**, none of it committed:

| Path | Keep? |
|---|---|
| `tools/spikes/spike-02-subagent-model/out/project-local-host/*.json` | **Keep** — these are the SPIKE-02 usage receipts, the only strong evidence in the repo |
| `tools/spikes/spike-02-subagent-model/out/observations.md` | **Keep** — narrative record |
| `tools/spikes/spike-01-write-path/out/verdict.txt`, `payloads.jsonl` | **Delete or relabel** — synthetic self-checks that read as results (see Trap 1) |
| `tools/spikes/spike-01-write-path/out/scratch-write.txt`, `out/claude-host/spike01-claude-write.txt` | Delete — scratch from the write attempts |

Decide deliberately whether spike receipts belong in git. They are evidence for claims in `docs/spikes/`, which argues for committing them; they are also machine-specific output, which argues for pasting the relevant lines into the spike docs and gitignoring `out/`. Either is defensible; drifting into neither is not.

---

## WP-15 — Run one real sprint *(Required for the ship decision)*

`plugin/evals/comparison.md` says it plainly: **"Status: not yet run."** And states its own stakes correctly: *"If sage-mode is not better on defects-escaped, the process is ceremony."*

Twenty-eight commits, ~5,800 lines of runtime, ~10,600 lines of documentation, 277 tests — and the tool has never been used to build anything, once. Every other item in this plan is engineering against a design. This is the only one that answers whether the design is worth using.

Run one genuine sprint on a real project, ship a PR through `/sage-ship`, note every place you fight the tool, and file `comparison.md` with the numbers — **including a bad result**. Do this after WP-1 through WP-8; do not defer it past them.

---

## 2. Sequencing

```
WP-14 (hygiene, 15m)
   │
WP-2 (harness can see the bug)  ──►  WP-1 (fix the hooks)  ──►  WP-3 (test cost)
                                          │
                                          ├──►  WP-4 (SPIKE-01, needs a working hook)
                                          │
                                          └──►  WP-5 (SPIKE-02 Cursor)
                                                     │
                                     WP-6 ──► WP-7 ──► WP-8   (Claude Code, land together)
                                                     │
                                          WP-9, WP-10, WP-11  (design gaps)
                                                     │
                                          WP-12, WP-13        (docs)
                                                     │
                                                  WP-15       (the real question)
```

**Hard ordering constraints**

- **WP-2 before WP-1.** You cannot prove a fix with a test that reports `ok` for a script that never ran.
- **WP-1 before WP-4.** A payload containing a path proves nothing if the hook cannot emit a deny.
- **WP-6 + WP-7 together.** Fixing agent loading alone converts silent absence into loud breakage.
- **WP-5 before WP-7's model mapping.** If Cursor cannot dispatch `gemini-3.7-flash` either, the mapping table changes.

---

## 3. Traps — read before starting

1. **`verdict.txt` is not a SPIKE-01 result.** Three synthetic payloads, same timestamp. Do not flip `status: decided`.
2. **Do not switch to `sage-lane-after` as the only lane hook.** That is the FAIL branch; there is no FAIL yet.
3. **Do not let the Claude Code haiku PASS stand in for Cursor.** Different host, different discovery path, different model namespace.
4. **A subagent's self-report is not evidence.** Only a host usage/cost line counts. LLMs confabulate their own identity.
5. **Green CI means less than it looks.** `ubuntu-latest` has `sh` = dash, so WP-1 is invisible there — and until WP-2, the golden harness cannot see it on any platform.
6. **Do not delete the two apostrophes and call WP-1 done.** That leaves four identical landmines.
7. **`cursor --version` reports `3.11.19`** against a documented `≥ 3.14` requirement. Resolve which is wrong before trusting any Cursor spike result.
8. **`ANTHROPIC_API_KEY` is set on the dev machine.** Unset it before any Lane B work or the whole cost architecture is bypassed silently.

---

## 4. Evidence index

| Artifact | What it proves |
|---|---|
| `docs/design/report.md` §7.3 | `sage-lane` bash 3.2 reproduction, exit 0, empty stdout |
| `hooks/sage-lane:127,176` | The two apostrophes that trigger the parse failure |
| `hooks/tests/run.sh:70` | `… .strip() or '{}'` — the false-pass normalization |
| `hooks/tests/sage-lane/allow-in-lane.out.json` | Expected allow output is `{}` — identical to a crash |
| `.../spike-02/out/project-local-host/declared-session.json` | haiku-only billing — `model:` honored |
| `.../spike-02/out/project-local-host/default-session.json` | sonnet billing — control |
| `.../spike-02/out/project-local-host/declared-subagent.json` | haiku child + sonnet parent — subagent path |
| `.../spike-02/out/project-local-host/lane-c-subagent.json` | `unrecognized_model`, `failed: 1` |
| `.../spike-02/out/claude-host/default-agent.json` | `--plugin-dir` agent-not-found |
| `.../spike-01/out/verdict.txt` | Synthetic self-check **only** — not a result |
| `lib/setup/index.ts:57` | `.cursor/agents/` is the only install target |
| `lib/consult/index.ts:265` | `--allowedTools "Read,Grep,Glob"` |

---

## 5. Estimate

| Phase | Work | Est. |
|---|---|---|
| Correctness | WP-14, WP-2, WP-1, WP-3 | **1 day** |
| Platform truth | WP-4, WP-5 | **0.5 day** |
| Claude Code | WP-6, WP-7, WP-8 | **1 day** |
| Design gaps | WP-9, WP-10, WP-11 | **1 day** |
| Docs | WP-12, WP-13 | **0.5 day** |
| The real test | WP-15 | **1 day** |

**≈ 5 days to ship-ready**, or **≈ 2.5 days** to "safe and honest" if WP-9/WP-10 are deferred and §10 is amended to describe the manual loop instead.

The correctness day is not optional and not deferrable. Everything else is a judgement call about scope. WP-15 is what decides whether any of it was worth building.
