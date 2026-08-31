# Runbook — Install sage-mode, Render the Docs, Run the Spikes

**Written:** 2026-08-31 · **Applies to:** sage-mode `v1.0.0` · **Audience:** you, on a machine with a live Cursor and/or Claude Code session
**Status of the spikes as of this writing:** SPIKE-01 `not-run`, SPIKE-02 `not-run`.

> **In plain terms:** This is the only page you need. It covers installing the plugin, rendering the notebook, and executing the two platform spikes the whole architecture rests on — including what "pass" and "fail" actually look like and what to change in the repo for each outcome. Everything you need is stated here; no other page is required reading.

---

## 0. Why the spikes are the point

`architecture-v3` makes two assumptions it never tested:

| | Question | What breaks if the answer is NO |
|---|---|---|
| **SPIKE-01** | Does Cursor's `preToolUse` hook payload carry a **file path** for a `Write`/`Edit` call? | `hooks/sage-lane` is `failClosed: true`. If it can never find a path, it denies **every** Write — not "safely degraded," but all legitimate work blocked. Lane enforcement must fall back to `afterFileEdit` detect-and-revert, which is preventive → corrective, and phase 5 (parallel worktrees) needs re-estimating. |
| **SPIKE-02** | Do **plugin-shipped** subagents honor their `model:` frontmatter? | The Lane A/B/C cost architecture — the most differentiated idea in sage-mode — is not wired at all. Every implementer, reviewer and red-team run silently costs whatever the session model costs, and `/sage-retro`'s cost report is fiction. |

Cursor's own hook documentation shows `tool_input` **only** for Shell (`command`, `working_directory`). The Write/Edit shape is genuinely unspecified — this is not paranoia, it is an open question with no documented answer. `afterFileEdit` *is* documented to carry `file_path`, which is exactly why the fallback exists.

Combined, both spikes are about **one hour**. Do them before writing another feature.

---

## 1. Prerequisites

| Requirement | Version | If missing |
|---|---|---|
| Cursor | ≥ 3.14 | Hard requirement for SPIKE-01/02 in Cursor |
| Node.js | ≥ 20 | CLI, notebook, evidence, recall unavailable |
| git | ≥ 2.38 | Hard requirement |
| `python3` | any 3.x | SPIKE-01's probe degrades to a raw-text log with no automatic key-check |
| Claude Code CLI | ≥ 2.1 | Optional — only needed to run the spikes against the second host, and for Lane B |
| GitHub CLI `gh` | ≥ 2.0 | Optional — `/sage-ship` prints the PR body instead of opening it |

Check them:

```bash
cursor --version 2>/dev/null || echo "cursor CLI not on PATH (the IDE can still be installed)"
node -v && git --version && python3 -V
claude --version 2>/dev/null || echo "claude CLI absent — Lane B will degrade to Lane A with a warning"
gh --version 2>/dev/null || echo "gh absent — ship prints the PR body instead"
```

---

## 2. Install the plugin

### 2a. Local development symlink (recommended for spike work)

This is the right mode for running spikes: the spike scripts patch files **inside the plugin directory**, so you want Cursor reading your working tree, not a pinned copy.

```bash
cd /path/to/cursor-plugins/sage-mode
ln -s "$(pwd)/plugin" ~/.cursor/plugins/local/sage-mode
mkdir -p ~/.sage/bin && export PATH="$HOME/.sage/bin:$PATH"   # add to your shell profile
```

Then in Cursor: **Developer: Reload Window**. If the plugin does not appear, enable *Include third-party Plugins, Skills, and other configs* in settings.

### 2b. Custom marketplace (for normal use, not spike work)

Do **not** use `/add-plugin <github-url>` — that flow pins a stale commit.

1. **Customize → Plugins**
2. Add a marketplace pointing at this repo: `https://github.com/rcwolf97/sage-mode`
3. Install **sage-mode** at user or project scope
4. **Developer: Reload Window**

### 2c. Build and verify before you trust anything

```bash
cd plugin
npm install
npm run verify
```

`npm run verify` is the whole gate in one command, in the same order CI runs it:

```
build → test (277) → lint → hooks:test → eval:tier3
```

Expected tail:

```
ℹ tests 277
ℹ pass 277
ℹ fail 0
...
7 passed, 0 failed, 1 skipped (of 8)
```

The one SKIP is scenario 3 ("Reviewer handed a clean diff"), skipped **by design**: "no invented findings" is a judgement about what a live reviewer subagent does, and no fixture mechanically proves absence of hallucination. A SKIP here is correct. A FAIL anywhere is not.

> **If `npm test` shows 5 failures in the consult suite**, you are on a build from before 2026-08-31. Those tests were not hermetic against `~/.sage/config.json`: once `sage setup` has run once on your machine, `assertTrusted()` refuses the tests' temp dirs and five assertions fail — while CI stays green, because GitHub runners have a virgin HOME. Fixed by redirecting `HOME` at module load in `test/consult.test.ts`.

### 2d. First run in a project

```bash
cd /path/to/some/git/repo
sage setup --profile web        # or api | cli | ai-product
```

This writes `docs/assets/*` and 19 role cards into `<project>/.cursor/agents/`, and records every file in an install manifest so `sage uninstall` can remove exactly what it added and preserve anything you edited. Then, in Cursor:

```
/sage-setup
/sage-shape
```

Read-only health check at any time — writes nothing:

```bash
sage setup --check --json
```

---

## 3. Render the docs notebook

The notebook is markdown rendered to self-contained HTML with a shared shell, nav, mermaid diagrams, and `*.md` links rewritten to `*.html`.

**For a project's own notebook** (the normal case — this is what `/sage-retro` and `/sage-notebook` drive):

```bash
sage notebook render                 # render every page under the notebook root
sage notebook render docs/some.md    # one page
sage notebook render --watch         # re-render on save
sage notebook render --strict        # non-zero exit on any render warning
sage notebook index                  # rebuild docs/index.html
sage recall index                    # rebuild the BM25 search index at .sage/index.json
```

The notebook root is configurable via `.sage/config.json`'s `notebook.root` (default `docs`). Skills refer to it as `<notebook>`, never a hardcoded path.

**For this repo's own research notebook** (`sage-mode/docs/`), the renderer is the standalone prototype:

```bash
cd sage-mode/docs
python3 build.py
```

Note `build.py` currently hardcodes `SRC = "/home/claude/sage-docs"` and `OUT = "/home/claude/nb"` and carries an explicit `PAGES` list. Point those at your paths, and add any new page to `PAGES` or it will not be rendered. Two pages added on 2026-08-31 — `audit-2026-08-31.md` and this runbook — are **not** in that list yet.

---

## 4. SPIKE-01 — does `preToolUse` expose a file path for Write?

### Use the right harness

There are two SPIKE-01 harnesses in the repo and they are not equivalent:

| Path | Verdict |
|---|---|
| `sage-mode/tools/spikes/spike-01/` | **Older stub.** Dumps raw stdin to `/tmp`. No key-check, no verdict, Cursor-only. `docs/spikes/SPIKE-01.md` still points here. |
| `plugin/tools/spikes/spike-01-write-path/` | **Use this one.** One-command install/read/uninstall, dual-host, BOM-stripped, checks nine candidate key locations and prints a verdict. |

### Procedure

All commands from `plugin/`.

```bash
cd plugin
./tools/spikes/spike-01-write-path/install.sh
```

`install.sh` backs up `hooks/hooks.json` and `hooks/hooks-claude.json` (once — a second run will not clobber the backup with an already-patched copy) and adds `probe-hook` as an **extra** `preToolUse`/`PreToolUse` entry with matcher `Write`, *alongside* the real `sage-lane` entry, not instead of it. `probe-hook` always emits `{}` (allow) and can never block a real edit.

Then:

1. **Cursor:** Developer: Reload Window (Cursor does not reliably hot-reload hook config).
   **Claude Code:** restart the session (or `/plugin reload` if your build has it).
2. In a normal agent chat, ask it to **write or edit a file**. A scratch file is fine. If you want zero side effects, have it edit a git-tracked file and `git checkout` it after.
3. Do this **several times** across different tool shapes — a plain `Write`, an `Edit`, a `MultiEdit` if your host has one. One sample is not an answer.

```bash
./tools/spikes/spike-01-write-path/read-result.sh
```

### Reading the result

Output lands in `plugin/tools/spikes/spike-01-write-path/out/`:

- `verdict.txt` — one block per captured call: the top-level keys, the `tool_input` keys, and a verdict line
- `payloads.jsonl` — the raw BOM-stripped payload, ground truth if the key-check missed something
- `payloads-raw-fallback.txt` — only if `python3` was unavailable

Each block ends with one of:

**`VERDICT: file path WAS exposed, via: <key>=<value>`** → **PASS.** Cross-check that `<key>` is in `hooks/sage-lane`'s own candidate list (`tool_input.path`, `.file_path`, `.filePath`, `.target_file`, `.file`, then top-level `file_path`). If the key that carried it is **not** in that list, you have found a real gap in `sage-lane` — add the key.

**`VERDICT: NO candidate key carried a file path.`** → **FAIL** for that host and tool.

### What to change, per outcome

| Outcome | Action |
|---|---|
| **PASS, key already covered** | Set `status: decided`, record PASS and paste a payload into `docs/spikes/SPIKE-01.md`. Nothing else changes. Phase 5 is unblocked. |
| **PASS, key NOT in sage-lane's list** | Add the key to `hooks/sage-lane`'s extraction order, add a golden-payload case under `hooks/tests/sage-lane/`, run `npm run hooks:test`, then record PASS. |
| **FAIL** | In `hooks/hooks.json`, switch the lane-enforcement entry from `preToolUse → sage-lane` to `afterFileEdit → sage-lane-after`. That hook already exists and already implements detect-and-log against `.sage/lane`'s `owns` globs, writing violations to `.sage/lane-violations.jsonl` for `/sage-build` to revert at the next join. It is left unregistered specifically so this is a one-line config change, not new engineering. Then re-estimate WP-16: parallel-worktree lane safety becomes probabilistic-then-corrected, not preventive. Record FAIL with the payload. |
| **Hosts disagree** | Record both explicitly. The fallback registration matters more for whichever host fails. |

```bash
./tools/spikes/spike-01-write-path/uninstall.sh   # restores both hooks files exactly
```

---

## 5. SPIKE-02 — do plugin-shipped subagents honor `model:`?

### Use the right harness

Same split as SPIKE-01. `sage-mode/tools/spikes/spike-02/` is a bare probe plugin; **use `plugin/tools/spikes/spike-02-subagent-model/`**, which ships three probe cards, a comparison template, and honest guidance on what counts as evidence.

### The three probes, and why there are three

| Card | `model:` | Answers |
|---|---|---|
| `zz-spike02-default-model` | *(none)* | **Control.** Whatever the host defaults a plugin subagent to. |
| `zz-spike02-declared-model` | `haiku` | The question **for Claude Code**. |
| `zz-spike02-cursor-lane-c` | `gemini-3.7-flash` | The question **for Cursor** — the one the cost architecture actually rests on. |

The third card was added on 2026-08-31 because the harness previously could not answer the question that matters. `haiku` is a Claude Code value; Cursor is sage-mode's primary host, and Lane C depends on Cursor honoring a **non-Anthropic** pin shipped from a plugin's `agents/` path. `gemini-3.7-flash` is the literal value `agents/reviewer.md`, `agents/red-team.md` and `agents/design-critic.md` already carry. A haiku probe passing on Claude Code would have said nothing about whether Lane C is wired in Cursor.

### Procedure

```bash
cd plugin
./tools/spikes/spike-02-subagent-model/install.sh
```

This copies all three `zz-spike02-*.md` cards into `plugin/agents/` — the only place either host discovers plugin agents, per both manifests' `agents: "./agents"`. All three carry a `lane:` field, so `npm run lint` still passes while they are installed (it did not before 2026-08-31; a missing `lane:` produced a confusing lint failure mid-spike).

Restart your Cursor/Claude Code session so the new agent cards are discovered, then:

```bash
./tools/spikes/spike-02-subagent-model/run.sh
```

`run.sh` validates all three cards' frontmatter, confirms installation, writes `out/observations.md` (never overwriting notes you have already started), and prints the exact prompts. A subagent dispatch is an agent action, not something a shell script can trigger — so you send these yourself, **one at a time**:

```
1. Dispatch the zz-spike02-default-model subagent and report its exact response verbatim.
2. Dispatch the zz-spike02-declared-model subagent and report its exact response verbatim.
3. Dispatch the zz-spike02-cursor-lane-c subagent and report its exact response verbatim.
```

**In Cursor, run 1 and 3. In Claude Code, run 1 and 2** — prompt 3 is inert there by design.

Paste each verbatim response into the matching section of `out/observations.md`.

### Reading the result — do not trust the self-report

**An LLM asked "what model are you" is not a reliable narrator of its own identity.** It will confabulate a plausible answer regardless of what is running it. Evidence, in descending order of trustworthiness:

1. **Any model name your host's own UI, transcript or usage breakdown shows** for the dispatched subagent, independent of what the subagent claims. This is the only strong signal. In Cursor, check the usage/cost breakdown for a `gemini-3.7-flash` line attributable to that dispatch.
2. **Latency**, compared like-for-like against the control. A genuinely smaller/faster model responding dramatically faster is circumstantial but real.
3. **Terseness and correctness** on the 14th-prime check (it is 43). Weak.
4. **The subagent's own self-report.** Weakest. Record it — it is still data — but it settles nothing.

If a declared model causes an **outright dispatch error** instead of being honored or silently ignored, that is a different and more useful answer: record the exact error text. A loud failure is better than a silent one — it is the difference between "Lane C is not wired" and "Lane C is not wired and you would never have noticed."

### What to change, per outcome

| Outcome | Action |
|---|---|
| **PASS in Cursor** (usage attributes to `gemini-3.7-flash`) | Set `status: decided`, record the evidence in `docs/spikes/SPIKE-02.md`. Lane A/B/C is real. Nothing else changes. |
| **FAIL in Cursor — silently ignored** | Cost control is not wired. `/sage-setup` must install role cards into `<project>/.cursor/agents/`, which *is* documented to honor `model:`. **Note: `sage setup` already does this** — it writes all 19 cards there. So verify whether the project-local copies are honored before assuming the fallback needs building; it may already be carrying the weight. Re-estimate WP-01 and WP-09 for the staleness problem (project copies drifting from the plugin's shipped versions). Correct the scorecard: cost control drops from 10 to ~6. |
| **FAIL — dispatch error** | Same as above, plus: the non-Claude values in `agents/*.md` are actively breaking dispatch, not just inert. Gate them behind a host check or split the role cards per host. |
| **Claude Code, any result** | Record it, but do not let it stand in for the Cursor answer. `grok-*` and `gemini-*` values are near-certainly non-functional under Claude Code regardless — that is a known, separate gap in `agents/*.md`. |

```bash
./tools/spikes/spike-02-subagent-model/uninstall.sh   # removes exactly the zz-spike02-*.md cards
```

---

## 6. After both spikes — close the loop

Whatever the answers, do all four:

1. **Record the result in the spike file.** Flip `status: not-run` → `status: decided`, paste the raw evidence (payload / transcript / usage screenshot), and state PASS or FAIL in the `## Status` heading. An unrecorded spike is an unrun spike.
2. **Fix `docs/spikes/SPIKE-01.md` and `SPIKE-02.md` to point at `plugin/tools/spikes/`**, not the older root stubs.
3. **Correct SPIKE-02.md's stale claim.** It currently says *"nothing in this repo currently installs a project-local copy under `<project>/.cursor/agents/`."* That is false — `sage setup` writes 19 of them.
4. **Update `docs/research/scorecard.md` §6.** It still says *"Maturity: 1. Zero lines of code."* There are ~5,800 lines of runtime TypeScript and 277 passing tests. If either spike failed, adjust the cost-control and parallel-throughput scores per §5's own stated ceilings.

Then re-run the gate and commit:

```bash
cd plugin && npm run verify
```

---

## 7. Command reference

```bash
# gate
npm run verify        # build → test → lint → hooks:test → eval:tier3 (what CI runs)
npm run build         # tsc; also regenerates evals/tier3/run.js
npm test              # 277 unit tests
npm run lint          # sage's own skill/agent/command conventions
npm run hooks:test    # golden payloads, every hook, bash AND dash, both host shapes
npm run eval:tier3    # 8 process-adherence scenarios

# install / health
sage setup [--profile web|api|cli|ai-product]
sage setup --check [--json]              # read-only
sage uninstall [--purge-user-config] [--yes]

# notebook
sage notebook render [--watch] [--strict] [file.md]
sage notebook index
sage recall index
sage recall "<query>" [--kind K] [-n N]

# the mechanics worth knowing by hand
sage evidence run --label unit -- <cmd>  # record a content-bound test run
sage evidence check --label unit         # FRESH or STALE, with the reason
sage dag validate <dag.json>             # D1 cycles, D2 owns-glob overlap
sage dag plan <dag.json>                 # topological waves
sage review scope --base <ref>           # scope booleans from the union diff
sage review select --scope <json>        # specialist roster
sage review gate                         # reads JSONL on stdin; caps unevidenced findings at 5
sage board next [--sprint S]             # resume point, read from disk alone
sage status [--json]
```

### Spike scripts, all of them

```bash
plugin/tools/spikes/spike-01-write-path/{install.sh,read-result.sh,uninstall.sh}
plugin/tools/spikes/spike-02-subagent-model/{install.sh,run.sh,uninstall.sh}
```

Both are idempotent, both back up or scope precisely what they touch, and both have a real uninstall. Neither can block a real edit or do real work.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Plugin does not appear in Cursor | Third-party configs disabled, or no window reload | Enable *Include third-party Plugins, Skills, and other configs*; Developer: Reload Window |
| `sage: command not found` | `~/.sage/bin` not on `PATH` | `export PATH="$HOME/.sage/bin:$PATH"` in your shell profile |
| `sage evidence check` always STALE | `.sage/` or `.worktrees/` not gitignored, so sage's own writes change the working-tree fingerprint between the pre- and post-run snapshots | The error names the exact lines to add to `.gitignore`. Add them and commit. |
| 5 consult tests fail locally, CI green | Pre-2026-08-31 build; suite not hermetic against `~/.sage/config.json` after a `sage setup` run | Pull the fix, or `HOME=$(mktemp -d) npm test` as a workaround |
| `npm run eval:tier3` fails scenario 2 | Pre-2026-08-31 build; the runner parsed `review gate --json`'s `{findings, rejected}` envelope as a bare array | Pull the fix. The gate itself was always correct. |
| Hook changes not taking effect | Cursor does not reliably hot-reload hook config | Developer: Reload Window. Claude Code: restart the session. |
| `npm run lint` fails during SPIKE-02 | Pre-2026-08-31 probe cards lacked a `lane:` field | Pull the fix, or `uninstall.sh` before linting |
| Lane B silently metered instead of flat-rate | `ANTHROPIC_API_KEY` inherited from your shell, profile, or CI | `consult()` warns loudly on stderr — unset the variable |
| `consult refused: <root> is not a trusted root` | `~/.sage/config.json` exists but does not list this project | Run `sage setup` in that project |
