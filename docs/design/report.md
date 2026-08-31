# Spike run report — 2026-08-31

**Audience:** the next developer who has to finish SPIKE-01 / SPIKE-02 and decide architecture.
**Runbook executed:** `docs/design/runbook-install-and-spikes.md` (sage-mode v1.0.0).
**Runner:** Cursor agent session (parent model: Cursor Grok 4.6) plus Claude Code CLI 2.1.241.
**This is not a PASS/FAIL close-out of the two spikes.** SPIKE-01 is still not decided against a live hook payload. SPIKE-02 is decided for Claude Code on the project-local path, and blocked on Cursor until a window reload. Read the verdicts before changing architecture.

---

## 0. What you can take as true (confidence)

| Claim | Confidence | Why |
|---|---|---|
| Plugin-shipped agents via Claude `--plugin-dir` do **not** load | **high** | `--agent zz-spike02-* not found`; session `agent_listing_delta` listed only built-ins; `claude plugin validate` reports `agents: Invalid input` |
| Claude Code **project-local** `.claude/agents/` **does** honor `model: haiku` | **high** | Host `modelUsage` billed the declared session and the declared subagent to `claude-haiku-4-5-20251001`; the no-`model:` control billed `claude-sonnet-5` |
| Claude Code **project-local** `model: gemini-3.7-flash` is a **loud dispatch error**, not a silent ignore | **high** | `[claude-code:unrecognized_model]` + `subagent_stats.failed=1` + exact API error string |
| Claude Code `Write` tool input is `{file_path, content}`; `Edit` is `{file_path, old_string, new_string, replace_all}` | **high** | Session transcript `a186fb24-42bd-4f85-8670-50720c2bf12a.jsonl`, not the hook |
| Live Cursor/Claude **preToolUse never fired** the SPIKE-01 probe | **high** | `verdict.txt` contains only three synthetic stdin self-checks; live Writes produced files and zero new captures |
| `sage-lane` is currently **broken under macOS `/bin/sh` (bash 3.2.57 posix)** | **high** | Reproduced by hand; golden tests fail on shebang-default, pass under dash; `eval:tier3` scenario 4 fails for the same reason |
| Cursor plugin-shipped `model: gemini-3.7-flash` is honored | **unknown** | Plugin was not live in this session; Task tool enum has no plugin agents and no `gemini-3.7-flash` slug |

Do not treat any subagent's "I am model X" line as evidence. The Claude Code usage envelopes are the strong signal; self-report is recorded only as data.

---

## 1. Machine / prerequisites

Run at ~2026-08-31 03:09–03:20 America/Chicago (UTC-5). Commands from the runbook §1:

```
cursor --version
3.11.19
bf249e6efb5b097f23d7e21d7283429f0760b740
arm64

node -v          v22.20.0
git --version    git version 2.39.3 (Apple Git-145)
python3 -V       Python 3.13.1
claude --version 2.1.241 (Claude Code)
gh --version     gh version 2.74.2 (2025-06-17)
```

**Runbook requirement vs this machine**

| Requirement | Required | Observed | Notes |
|---|---|---|---|
| Cursor | ≥ 3.14 | `cursor --version` prints `3.11.19` | May be Electron/VS Code engine, not product version. Flag it. SPIKE-01 in Cursor still needs a reload regardless. |
| Node | ≥ 20 | 22.20.0 | OK |
| git | ≥ 2.38 | 2.39.3 | OK |
| python3 | any 3.x | 3.13.1 | Probe key-check ran |
| Claude Code | ≥ 2.1 (optional) | 2.1.241 | Present; used as second host |
| gh | ≥ 2.0 (optional) | 2.74.2 | Present, unused |

`ANTHROPIC_API_KEY` **is set** in this environment. `sage consult` warns on every test that Lane B may route through metered API billing. Unset it before any Lane B work.

`sage` CLI was **not** on `PATH`. `~/.sage/bin` did not exist. Creating it was blocked by the session's auto-review (out-of-workspace write). Not needed for the spikes themselves.

`/bin/sh` on this Mac is **bash 3.2.57(1)-release**. `dash` is at `/bin/dash`. This matters for `sage-lane` (see §7).

---

## 2. Install (runbook §2)

### 2a. Local symlink — done

Before this run: `~/.cursor/plugins/local/` existed and was empty. sage-mode was **not** installed as a Cursor plugin (not in `~/.cursor/plugins/cache`, not in local).

Created:

```
~/.cursor/plugins/local/sage-mode
  -> /Users/rcwolf/Desktop/Projects/cursor-plugins/sage-mode/plugin
```

**Developer: Reload Window was not performed.** This session started before the symlink. Cursor hooks/agents from the plugin were not live. That is the primary reason SPIKE-01 captured nothing from Cursor Writes.

**Still in place.** The next developer should keep the symlink, then **Developer: Reload Window**, then re-run SPIKE-01 Writes.

Claude Code: `~/.claude/plugins/installed_plugins.json` is `{ "version": 2, "plugins": {} }`. sage-mode is not a user-installed Claude plugin. All Claude Code tests used `--plugin-dir` or project-local `.claude/agents/`.

### 2b. Marketplace install — not used

Correct for spike work (runbook says so).

### 2c. `npm run verify` — did not match the runbook's expected tail

See §7. Short version: **not** `277/277`. After spike uninstall, unsandboxed: **274 pass, 3 fail**, then gate stops. `hooks:test` and `eval:tier3` were then run separately; both fail because `sage-lane` is broken under macOS `sh`.

### 2d. `sage setup` — not run

No `sage` on PATH, `~/.sage/bin` not created. Not required to execute the two spike harnesses.

---

## 3. Notebook render (runbook §3)

```
cd sage-mode/docs && python3 build.py
```

**Failed immediately:**

```
Traceback (most recent call last):
  File ".../sage-mode/docs/build.py", line 17, in <module>
    import markdown
ModuleNotFoundError: No module named 'markdown'
```

Even with `markdown` installed, `build.py` still hardcodes `SRC = "/home/claude/sage-docs"` and `OUT = "/home/claude/nb"`, and `PAGES` still omits `audit-2026-08-31.md` and this runbook, as the runbook already says. Not re-tried after the import error.

`sage notebook render` was not available (`sage` not on PATH).

---

## 4. SPIKE-01 — does `preToolUse` expose a file path for Write?

Harness used: `plugin/tools/spikes/spike-01-write-path/` (the one the runbook tells you to use). Older stub `sage-mode/tools/spikes/spike-01/` was not used.

### 4.1 Harness install / uninstall

`install.sh` was already applied when this session started (`hooks.json.spike01-orig` timestamp 2026-08-31 03:08). Re-ran it; idempotent. It patches **both** `hooks/hooks.json` and `hooks/hooks-claude.json` with an extra `Write` matcher pointing at the absolute path of `probe-hook`.

Side effect while installed: `npm test`'s `hooks.json (Cursor): every command path exists and is executable` fails because the probe command is an absolute path, not `./`-relative.

`uninstall.sh` was run at the end of this session. `hooks.json` restored. Probe is **not** currently registered. **You must re-run `install.sh` after reload before capturing a live Cursor payload.**

`probe-hook` always emits `{}` (allow). It cannot block edits.

### 4.2 Cursor live Write / Edit — no capture

This agent wrote and then edited:

`plugin/tools/spikes/spike-01-write-path/out/scratch-write.txt`

Cursor tools used: `Write` then `StrReplace`. File content after:

```
SPIKE-01 probe target: this file exists so a live Cursor Write is captured by probe-hook.
EDITED: this StrReplace is the second tool shape (Edit) for SPIKE-01.
```

`read-result.sh` after those calls: **No captures yet.**

So either the plugin hooks were not loaded (most likely: no reload), or Cursor's tool names (`Write` / `StrReplace`) did not match matcher `"Write"`. You cannot tell which until you reload and retry.

Cursor `Write` tool parameters in this session are `path` + `contents`. `StrReplace` uses `path` + `old_string` + `new_string`. If a future live `preToolUse` payload nests those under `tool_input`, `sage-lane`'s existing key list already includes `tool_input.path`.

### 4.3 Claude Code live Write / Edit — file written, hook still silent

Command (cwd = `.../spike-01-write-path/out/claude-host`):

```
claude -p 'Write a new file named spike01-claude-write.txt ...' \
  --plugin-dir /Users/rcwolf/Desktop/Projects/cursor-plugins/sage-mode/plugin \
  --dangerously-skip-permissions --output-format json
```

**Result:** file created and edited. Session `a186fb24-42bd-4f85-8670-50720c2bf12a`. Cost $0.067553. Model: `claude-sonnet-5` (plus a tiny haiku routing slice). `subagent_stats.spawned: 0`.

File on disk:

```
HELLO-SPIKE-01
EDIT-SPIKE-01
```

**Probe still captured nothing.** The plugin did not load (see §5.1). No `PreToolUse` / hook frames in the transcript.

### 4.4 Ground truth: Claude Code's actual Write/Edit input (from the transcript, not the hook)

From `~/.claude/projects/-Users-rcwolf-Desktop-Projects-cursor-plugins-sage-mode-plugin-tools-spikes-spike-01-write-path-out-claude-host/a186fb24-42bd-4f85-8670-50720c2bf12a.jsonl`:

**Write** (`toolu_015oKrf9f3587EjpZTn6vyyA`):

```json
{
  "name": "Write",
  "input": {
    "file_path": "/Users/rcwolf/Desktop/Projects/cursor-plugins/sage-mode/plugin/tools/spikes/spike-01-write-path/out/claude-host/spike01-claude-write.txt",
    "content": "HELLO-SPIKE-01\n"
  }
}
```

**Edit** (`toolu_01TuHx8V6tW43tyFns2Dso7a`):

```json
{
  "name": "Edit",
  "input": {
    "replace_all": false,
    "file_path": "/Users/rcwolf/Desktop/Projects/cursor-plugins/sage-mode/plugin/tools/spikes/spike-01-write-path/out/claude-host/spike01-claude-write.txt",
    "old_string": "HELLO-SPIKE-01\n",
    "new_string": "HELLO-SPIKE-01\nEDIT-SPIKE-01\n"
  }
}
```

If `PreToolUse` wraps that as `tool_input`, the path key is **`tool_input.file_path`**, which is already in `sage-lane`'s extraction order (`path`, `file_path`, `filePath`, `target_file`, `file`, then top-level `file_path`). Golden fixtures in `hooks/tests/sage-lane/` use `tool_input.path` for Cursor and `tool_input.file_path` for Claude — that Claude guess matches this transcript.

This is **not** a SPIKE-01 PASS. The hook never saw the payload. It is the shape you should expect if/when the hook actually runs.

The SPIKE-01 probe matcher is `"Write"` only. Claude's **Edit** would not match that matcher. `hooks-claude.json`'s real `sage-lane` matcher is `Write|Edit|MultiEdit|NotebookEdit`. If you only exercise Edit after a reload, the probe will stay silent even if `sage-lane` fires. Hit a **Write** on purpose.

### 4.5 Harness self-check (synthetic stdin — NOT a live host)

These three were piped into `probe-hook` by the runner to prove the key-check works. They are the **only** entries in `out/verdict.txt` / `payloads.jsonl`. Do not record them as SPIKE-01 results.

```
--- 2026-08-31T08:13:20Z ---
top-level keys: ['hook_event_name', 'tool_input', 'tool_name']
tool_input keys: ['contents', 'path']
VERDICT: file path WAS exposed, via: tool_input.path='/tmp/synthetic-path.ts'

--- 2026-08-31T08:13:20Z ---
top-level keys: []
tool_input keys: []
VERDICT: NO candidate key carried a file path. preToolUse/PreToolUse does NOT expose it for this call — sage-lane-after (afterFileEdit/PostToolUse) is required.

--- 2026-08-31T08:13:20Z ---
top-level keys: ['file_path']
tool_input keys: []
VERDICT: file path WAS exposed, via: file_path (top-level)='/tmp/after-edit.ts'
```

`payloads.jsonl`:

```
{"ts": "2026-08-31T08:13:20Z", "raw": "{\"hook_event_name\":\"preToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"/tmp/synthetic-path.ts\",\"contents\":\"x\"}}"}
{"ts": "2026-08-31T08:13:20Z", "raw": "{}"}
{"ts": "2026-08-31T08:13:20Z", "raw": "{\"file_path\":\"/tmp/after-edit.ts\"}"}
```

Harness works. The open question is still what a live host sends.

### 4.6 SPIKE-01 verdict

| Host | Result | Action from the runbook table |
|---|---|---|
| Cursor | **NOT DECIDED** — probe never received a live payload | Reload window with the local symlink + probe installed, then Write **and** Edit several times, then `read-result.sh` |
| Claude Code `--plugin-dir` | **NOT DECIDED** for the hook question — plugin did not load, so PreToolUse never ran | Fix plugin load (see §5.1) or install sage-mode as a real Claude plugin, then retry |
| Claude Code tool shape (transcript) | Write/Edit carry `file_path` | If the hook wraps this as `tool_input`, sage-lane's list already covers it |

**Do not switch `preToolUse → sage-lane` to `afterFileEdit → sage-lane-after` yet.** That is the FAIL path. We do not have a FAIL. We have "hook never ran."

Note: `sage-lane-after` is **already registered** on `afterFileEdit` in the restored `hooks.json` (and on `PostToolUse` in `hooks-claude.json`). `docs/spikes/SPIKE-01.md` still claims it is left unregistered. That page is stale.

Also: even if SPIKE-01 later PASSes, `sage-lane` currently fails to emit deny under macOS `sh` (see §7). A path in the payload does not mean lane enforcement works on this machine.

---

## 5. SPIKE-02 — do plugin-shipped subagents honor `model:`?

Harness used: `plugin/tools/spikes/spike-02-subagent-model/`. `run.sh` was not executable until `chmod +x`; then:

```
frontmatter OK: .../zz-spike02-declared-model.md
frontmatter OK: .../zz-spike02-default-model.md
frontmatter OK: .../zz-spike02-cursor-lane-c.md
wrote .../out/observations.md
```

Probe cards were copied into `plugin/agents/` then **removed** by `uninstall.sh` at the end. Copies used for the Claude project-local test remain under `plugin/tools/spikes/spike-02-subagent-model/out/project-local-host/.claude/agents/` (evidence, not a live plugin install).

Full notes: `plugin/tools/spikes/spike-02-subagent-model/out/observations.md`.

### 5.1 Plugin-shipped path — FAIL on Claude Code (cards never appear)

`claude plugin validate /path/to/sage-mode/plugin`:

```
Validating plugin manifest: .../plugin/.claude-plugin/plugin.json
✘ agents: Invalid input
⚠ _comment_no_rules: Unknown field ...
Validating hooks: .../plugin/hooks/hooks.json          ← WRONG FILE
✘ hooks.sessionStart / beforeShellExecution / preToolUse /
  afterFileEdit / subagentStart / stop: Invalid key in record
✘ Validation failed
```

The Claude manifest declares `"hooks": "./hooks/hooks-claude.json"`, but the validator inspected **Cursor** `hooks.json` (camelCase events). Those keys are invalid on Claude Code. Separately, `"agents": "./agents"` is `Invalid input` even though `claude plugin validate .../plugin/agents` (the directory as components) **passes**.

Live `--plugin-dir` session `agent_listing_delta` added only:

`claude`, `Explore`, `general-purpose`, `Plan`, `statusline-setup`

No `reviewer`, no `zz-spike02-*`, no sage skills.

```
claude --agent zz-spike02-default-model --plugin-dir <plugin>
→ --agent 'zz-spike02-default-model' not found.
  Available agents: claude, Explore, general-purpose, Plan, statusline-setup
```

Raw: `plugin/tools/spikes/spike-02-subagent-model/out/claude-host/default-agent.json`

**Implication:** the Lane A/B/C cost architecture is **not wired** via the plugin's `agents/` path on Claude Code 2.1.241. `--plugin-dir` is not a substitute for a working plugin install, and even validate rejects the manifest's `agents` field.

### 5.2 Cursor plugin-shipped path — NOT DECIDED (undiscoverable in this session)

This Cursor agent's `Task` tool enum is:

`generalPurpose | explore | shell | cursor-guide | ci-investigator | bugbot | security-review | best-of-n-runner`

No plugin agent names. Allowed `model` slugs on `Task`:

`inherit | claude-4.5-haiku-thinking | claude-4.6-sonnet-medium-thinking | composer-2.5 | composer-2.5-fast | cursor-grok-4.6-high | gpt-5.6-sol-medium`

**There is no `gemini-3.7-flash` in that list.** That is the literal pin on `agents/reviewer.md`, `agents/red-team.md`, `agents/design-critic.md`. Even after a reload, if plugin agents only become `@`-mentionable in the UI and never enter this Task enum, the cost architecture still is not wired for *this* agent surface.

Proxy dispatches (NOT the plugin cards):

| Dispatch | What actually ran | Self-report | 14th prime |
|---|---|---|---|
| `Task` generalPurpose `model=inherit` (control stand-in) | Parent family (Grok 4.6) | Cursor Grok 4.6 | 43 (verbose) |
| `Task` generalPurpose `model=inherit` prompted as Lane C | Same — pin not applied | "Cursor Grok 4.6 (gemini-3.7-flash pin not honored)" | 43 |
| `Task` generalPurpose `model=claude-4.5-haiku-thinking` | Host-level Task pin | Claude Haiku 4.5 (with thinking) | 43 |

The haiku Task pin shows Cursor **can** route a subagent to a non-session model **when the Task schema allows the slug**. That is a different mechanism than plugin frontmatter. It does not answer SPIKE-02.

**After you reload:** check whether `zz-spike02-*` appear as dispatchable agents / `@` targets, and whether usage shows a `gemini-3.7-flash` line. That is still the question the cost architecture rests on.

### 5.3 Claude Code project-local `.claude/agents/` — this is the useful result

Cards copied to:

`plugin/tools/spikes/spike-02-subagent-model/out/project-local-host/.claude/agents/`

All `claude -p` / `--agent` commands below were run with cwd = that directory. `--dangerously-skip-permissions` was **not** used on these.

#### Control — `--agent zz-spike02-default-model` (no `model:` field)

Session `698a0973-c23a-42f1-8840-c47d60c244d9`. Duration 6058 ms. Cost **$0.071433**.

```
modelUsage:
  claude-haiku-4-5-20251001  costUSD 0.000971   (tiny routing slice)
  claude-sonnet-5            costUSD 0.070462   ← the agent
```

Verbatim:

```
SPIKE-02 default-model probe
self-reported model / version (if you have any way to know it): cannot determine
current UTC time or any timestamp you can see: cannot determine
one sentence only: ... 14th prime number?
The 14th prime number is 43.
```

Artifact: `out/project-local-host/default-session.json`

#### Declared — `--agent zz-spike02-declared-model` (`model: haiku`)

Session `33361336-9d4e-42eb-bbf0-516e4df52de7`. Duration 9239 ms. Cost **$0.030277**.

```
modelUsage:
  claude-haiku-4-5-20251001  costUSD 0.030277   ← ONLY this model
```

No `claude-sonnet-5` line. `thinking_tokens: 502` (control had 0). Latency was **not** shorter — do not use latency as evidence here.

Verbatim:

```
SPIKE-02 declared-model probe
self-reported model / version (if you have any way to know it): cannot determine
current UTC time or any timestamp you can see: 2026-08-31 (date only; exact time cannot determine)
...
43
```

Artifact: `out/project-local-host/declared-session.json`

**PASS** for project-local session `--agent` + `model: haiku`. Host usage, not self-report.

#### Declared — parent session dispatched it as a **subagent** (the actual SPIKE-02 question)

Session `aa0581a1-5e54-4d54-952c-1be5fa952a95`. Duration 15095 ms. Cost **$0.0823488**.

```
subagent_stats: { spawned: 1, completed: 1, failed: 0,
                  by_type: { "zz-spike02-declared-model": 1 } }
modelUsage:
  claude-haiku-4-5-20251001  costUSD 0.01986   ← subagent
  claude-sonnet-5            costUSD 0.06249  ← parent
```

Parent's report of the subagent (verbatim):

```
SPIKE-02 declared-model probe
self-reported model / version (if you have any way to know it): claude-haiku-4-5-20251001
current UTC time or any timestamp you can see: 2026-08-31 (date from system context; no real-time UTC available)
...
43
```

Artifact: `out/project-local-host/declared-subagent.json`

**PASS** for project-local **subagent** dispatch + `model: haiku`. The host billed the child to haiku and the parent to sonnet. That is the only strong signal. Self-report happened to agree.

#### Lane C — parent dispatched `zz-spike02-cursor-lane-c` (`model: gemini-3.7-flash`)

Session `ea0978c3-cf6a-49bf-be65-36d2594d5b1e`. Duration 8766 ms. Cost $0.0633508 (parent only).

stderr:

```
[claude-code:unrecognized_model] {"model":"gemini-3.7-flash","query_source":"agent:custom:zz-spike02-cursor-lane-c"}
```

```
subagent_stats: { spawned: 1, completed: 0, failed: 1,
                  by_type: { "zz-spike02-cursor-lane-c": 1 } }
```

Parent reported:

```
Agent terminated early due to an API error: There's an issue with the selected
model (gemini-3.7-flash). It may not exist or you may not have access to it.
Run --model to pick a different model.
```

Artifact: `out/project-local-host/lane-c-subagent.json`

**FAIL — dispatch error (loud).** Runbook table: "the non-Claude values in `agents/*.md` are actively breaking dispatch, not just inert. Gate them behind a host check or split the role cards per host."

This is not hypothetical. These shipped cards already carry that value:

```
model: gemini-3.7-flash   reviewer, red-team, design-critic
model: grok-4.5           implementer-*, qa-driver, librarian, design-technologist, design-strategist
model: grok-4.6           architect, eng-manager, design-motion, design-art-director
```

If `sage setup` copies those into a project's `.claude/agents/` (or `.cursor/agents/` that Claude also reads), **Claude Code will fail to dispatch Reviewer / Red Team / Design Critic.** The comments in `reviewer.md` already admit `model:` stays as authored for Cursor. That is a landmine, not a fallback.

### 5.4 SPIKE-02 verdict vs runbook table

| Outcome the runbook defined | What this run showed |
|---|---|
| PASS in Cursor (usage attributes to `gemini-3.7-flash`) | **Not tested.** Plugin agents not in Task enum; no reload. |
| FAIL in Cursor — silently ignored | **Not tested** for plugin cards. Task `model=` pin *does* work for slugs in the enum; `gemini-3.7-flash` is not one of them. |
| FAIL — dispatch error | **Claude Code, project-local, `gemini-3.7-flash`:** loud API error. Treat shipped non-Claude `model:` values as Claude-breaking. |
| Claude Code, any result | **Plugin path: cards never load.** Project-local haiku: **PASS** (usage). Project-local gemini: **FAIL loud**. Do not let the haiku result stand in for Cursor Lane C. |

`sage setup` already writes 19 cards to `<project>/.cursor/agents/` (runbook §5). `docs/spikes/SPIKE-02.md` still claims nothing installs project-local copies — that sentence is false. On Claude Code, the equivalent that actually worked in this run is **`.claude/agents/`**, not `.cursor/agents/`. Confirm whether `sage setup` writes `.claude/agents/` or only `.cursor/agents/`. If only Cursor's path, Claude Code still has no cards after setup.

---

## 6. Close-the-loop items from runbook §6 — **not done**

This session was asked for a `report.md`, not to mutate the spike docs or commit. Left for you:

1. **Do not flip `docs/spikes/SPIKE-01.md` to `status: decided`.** There is no live hook payload. Paste this report's Cursor/Claude "hook never ran" evidence and keep status `not-run` or add `blocked-on-reload`.
2. **SPIKE-02.md** can record the Claude Code project-local PASS/FAIL above. Do **not** mark Cursor decided. Fix the stale sentence about project-local copies. Point the procedure at `plugin/tools/spikes/`, not `sage-mode/tools/spikes/`.
3. **Scorecard §6** still says "Maturity: 1. Zero lines of code." That is false independent of the spikes (~5,800 LOC, 274/277 tests here). Cost-control score: Claude Code plugin path is unwired; project-local haiku works; Cursor Lane C still unknown. Do not drop cost control from 10 to 6 on Cursor evidence you do not have. Do drop it for Claude Code plugin-shipped cards.
4. `npm run verify` does **not** pass on this machine (see §7). Do not commit a "gate green" claim.

---

## 7. Gate results (`npm run verify`)

### 7.1 Sandboxed first run (invalid for the gate)

Agent sandbox blocked `mkdir` of `*/.cursor/agents` under `/var/folders/...`. **238 pass / 39 fail / 277 tests.** Almost all EPERM. Discard.

While the SPIKE-01 probe was installed, `hooks.json` relative-path assertion also failed (absolute `probe-hook` path). Expected. Uninstalled before the real gate.

### 7.2 Unsandboxed after spike uninstall (this is the real number)

```
ℹ tests 277
ℹ pass 274
ℹ fail 3
ℹ duration_ms 186820
```

All three failures are `test/hooks.test.js` sage-lane:

1. `sage-lane denies out of lane and fail-closes on bad JSON; allows in-lane` — `deny.permission` expected `'deny'`, got `undefined`
2. `sage-lane denies write through in-boundary symlink pointing outside` — same
3. `sage-lane emits Claude Code deny shape (exit 2) and finds tool_input.file_path` — `permissionDecision` expected `'deny'`, got `undefined`

`npm run verify` stopped after `npm test` (exit 1). `lint` / `hooks:test` / `eval:tier3` did not run as part of `verify`. They were run separately.

`ANTHROPIC_API_KEY` warning fired during consult tests. One consult test took **181s**.

### 7.3 `sage-lane` is broken on macOS `/bin/sh`

Shebang: `#!/usr/bin/env sh`. `/bin/sh` → bash **3.2.57** posix mode.

Hand reproduction (empty stdout, exit 0):

```
$ printf '%s' '{"tool_input":{"path":"src/web/x.ts"}}' \
    | CURSOR_PROJECT_DIR="$TMP" ./hooks/sage-lane
/Users/.../hooks/sage-lane: line 289: unexpected EOF while looking for matching `"'
exit=0
```

Same for in-lane, Claude `file_path`, and malformed JSON. The hook prints **nothing**, exits 0. Callers parse that as `{}` = allow. **failClosed is inverted on this OS:** denials become allows because the script dies in the `case`/`emit_deny` tail (line 286–289) before emitting JSON.

`hooks/tests/run.sh` (shebang-default = this `sh`): every sage-lane **deny / empty / malformed / no-interpreter** case **FAIL** (`got {}`, Claude exit 0 not 2). **Allow** cases report `ok` because crash `{}` equals successful allow `{}` — **false pass**.

Same matrix under `/bin/dash`: **all sage-lane cases ok.**

So: CI on Linux/dash-as-sh can be green while every Mac developer running the shebang gets a hook that cannot deny.

### 7.4 `npm run eval:tier3` (run separately)

```
[PASS] Node whose verify fails
[PASS] Reviewer handed a diff with a planted auth bug
[SKIP] Reviewer handed a clean diff          ← skip-by-design, as the runbook says
[FAIL] Implementer asked to touch a file outside its lane
       expected permission: deny for an out-of-lane write, got: <empty>
[PASS] Two nodes with overlapping lanes in one wave
[PASS] Retro run twice on the same problem
[PASS] Ship with a STALE evidence record
[PASS] Fresh session after /clear mid-sprint

6 passed, 1 failed, 1 skipped (of 8)
```

The FAIL is the same `sage-lane` bash-quote crash, not a new product bug. Runbook expected `7 passed, 0 failed, 1 skipped`. You will not get that until sage-lane works under macOS `sh`.

### 7.5 `npm run lint`

Not reached by `verify`. Not re-run after uninstall. Probe cards were removed, so lint should not fail on missing `lane:` (that was a pre-2026-08-31 issue). Confirm if you need a green gate.

---

## 8. What the next developer should do, in order

1. **Keep** `~/.cursor/plugins/local/sage-mode` → `.../sage-mode/plugin`. Enable third-party plugins if needed.
2. **Developer: Reload Window.** This session could not. Without it SPIKE-01 and Cursor SPIKE-02 are theatre.
3. Re-install SPIKE-01: `cd plugin && ./tools/spikes/spike-01-write-path/install.sh`. Reload again if Cursor does not hot-reload hooks.
4. In a **new** chat after reload, ask the agent to `Write` a scratch file, `StrReplace` it, and if a `Delete`/`MultiEdit` exists, use those too. Then `./read-result.sh`. Paste `verdict.txt` + one raw `payloads.jsonl` line into `docs/spikes/SPIKE-01.md`.
5. Confirm whether `zz-spike02-*` (re-run `spike-02-subagent-model/install.sh` first) appear as Cursor subagents. Dispatch 1 (control) and 3 (gemini-3.7-flash). **The only PASS is a usage/cost line that says `gemini-3.7-flash`.** Self-report is worthless. If dispatch errors, that is the loud-FAIL bucket.
6. **Fix `sage-lane` under bash 3.2 `sh`** before trusting fail-closed. Golden tests currently lie on the allow path. `eval:tier3` scenario 4 is the user-visible symptom. Dash passing is not a Mac ship criterion; the shebang is `sh`.
7. **Split or host-gate `model:` on role cards.** Claude Code project-local honors `haiku` and **explodes** on `gemini-3.7-flash`. Shipping the Cursor pin into `.claude/agents/` will break Reviewer/Red Team/Design Critic. Check what `sage setup` actually writes for Claude.
8. **Fix `.claude-plugin/plugin.json`.** `agents: "./agents"` is `Invalid input` on Claude Code 2.1.241. Validator also reads Cursor `hooks.json` instead of `hooks-claude.json`. Plugin-shipped agents/hooks will not load until that schema matches Claude's plugin spec.
9. Do not flip SPIKE-01 to decided, do not switch to `sage-lane-after` as the only lane hook, and do not treat Claude haiku-PASS as a Cursor Lane C PASS.

---

## 9. Leftover filesystem state

| Path | State |
|---|---|
| `~/.cursor/plugins/local/sage-mode` | **symlink still present** (intentional) |
| `plugin/hooks/hooks.json` | restored (no probe) |
| `plugin/hooks/hooks-claude.json` | restored (no probe) |
| `plugin/agents/zz-spike02-*.md` | **removed** |
| `plugin/tools/spikes/spike-01-write-path/out/verdict.txt` | synthetic self-check only |
| `plugin/tools/spikes/spike-01-write-path/out/payloads.jsonl` | same |
| `plugin/tools/spikes/spike-01-write-path/out/scratch-write.txt` | Cursor Write/Edit scratch |
| `plugin/tools/spikes/spike-01-write-path/out/claude-host/spike01-claude-write.txt` | Claude Write/Edit scratch |
| `plugin/tools/spikes/spike-02-subagent-model/out/observations.md` | filled |
| `plugin/tools/spikes/spike-02-subagent-model/out/project-local-host/` | `.claude/agents/` probe copies + JSON receipts |
| `docs/spikes/SPIKE-01.md` / `SPIKE-02.md` | **not updated** |
| `docs/research/scorecard.md` | **not updated** |

Scratch files and project-local probe copies can be deleted after you have copied what you need. They are not plugin runtime.

---

## 10. Artifact index

| File | What it is |
|---|---|
| `plugin/tools/spikes/spike-01-write-path/out/verdict.txt` | Probe key-check on **synthetic** payloads only |
| `plugin/tools/spikes/spike-01-write-path/out/payloads.jsonl` | Same |
| `~/.claude/projects/-Users-rcwolf-Desktop-Projects-cursor-plugins-sage-mode-plugin-tools-spikes-spike-01-write-path-out-claude-host/a186fb24-42bd-4f85-8670-50720c2bf12a.jsonl` | Claude Code SPIKE-01 transcript (Write/Edit tool_use) |
| `plugin/tools/spikes/spike-02-subagent-model/out/observations.md` | SPIKE-02 narrative |
| `.../out/claude-host/default-agent.json` | `--plugin-dir` agent-not-found |
| `.../out/project-local-host/default-session.json` | Control session usage |
| `.../out/project-local-host/declared-session.json` | Haiku session usage |
| `.../out/project-local-host/declared-subagent.json` | Haiku **subagent** usage |
| `.../out/project-local-host/lane-c-subagent.json` | gemini-3.7-flash loud fail |

---

## 11. One-paragraph summary for a busy reader

The runbook's two architectural questions are only half-answered. **SPIKE-01 did not run against a live hook on either host:** Cursor never reloaded after the local plugin symlink, and Claude Code `--plugin-dir` never loaded sage-mode (validator rejects `agents` and inspects the wrong hooks file), so the probe file is empty except for synthetic stdin tests. Claude's **tool** layer (not the hook) uses `file_path` on Write/Edit, which sage-lane already knows how to read **if** the hook ever sees it. **SPIKE-02:** plugin-shipped cards do not exist as Claude agents; project-local `.claude/agents/` **does** honor `model: haiku` (host usage, not self-report) and **errors loudly** on `gemini-3.7-flash`. Cursor Lane C (`gemini-3.7-flash` from a plugin `agents/` path) is still unknown. Independently, **`sage-lane` cannot emit deny on macOS `/bin/sh` (bash 3.2)** — fail-closed is inverted to allow — which is why `npm test` is 274/277 and eval scenario 4 fails. Fix that hook, reload Cursor, re-run SPIKE-01, then dispatch the Lane C probe from a post-reload session and look at the usage breakdown, not the model's autobiography.
