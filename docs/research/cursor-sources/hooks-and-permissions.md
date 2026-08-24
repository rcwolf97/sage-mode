# Cursor Hooks & Permission/Sandbox System — State as of August 2026

Sources consulted: [cursor.com/docs/hooks](https://cursor.com/docs/hooks) (primary, fetched as [hooks.md](https://cursor.com/docs/hooks.md)), [cursor.com/docs/agent/security/run-modes](https://cursor.com/docs/agent/security/run-modes), [cursor.com/docs/agent/tools/terminal](https://cursor.com/docs/agent/tools/terminal), [cursor.com/docs/cloud-agent/security](https://cursor.com/docs/cloud-agent/security), [cursor.com/docs/cli/overview](https://cursor.com/docs/cli/overview), [cursor.com/docs/cli/changelog](https://cursor.com/docs/cli/changelog), [ntorres.dev hooks.json guide](https://ntorres.dev/blog/cursor-hooks-json-guide), [GitButler hooks deep dive](https://blog.gitbutler.com/cursor-hooks-deep-dive), [johnlindquist/cursor-hooks](https://github.com/johnlindquist/cursor-hooks), [endorlabs/cursor-hook-examples](https://github.com/endorlabs/cursor-hook-examples), [productionai.institute permissions.json reference](https://www.productionai.institute/insights/cursor-permissions-json-schema-reference), [howtoharden.com Cursor guide](https://howtoharden.com/guides/cursor/), and multiple Cursor Community Forum threads (linked inline). Note: the GitButler post predates the August 2026 doc revision — it does not mention `preToolUse`/`postToolUse`/subagent hooks at all, implying those events were added after that post was written; treat it as historical corroboration for the events it does cover, not a complete picture.

## 1. hooks.json — location, schema, command declaration, shell, env vars

**Locations (priority order Enterprise → Team → Project → User)**, per [cursor.com/docs/hooks](https://cursor.com/docs/hooks):
- Enterprise (system-wide): `/Library/Application Support/Cursor/hooks.json` (macOS), `/etc/cursor/hooks.json` (Linux/WSL), `C:\ProgramData\Cursor\hooks.json` (Windows)
- Team (cloud-distributed, Enterprise only): configured via the web dashboard, not a file
- Project: `<project-root>/.cursor/hooks.json`
- User: `~/.cursor/hooks.json`

All applicable levels run (they are not mutually exclusive/overriding in the sense of "last wins" — GitButler's post explicitly frames project, `/etc/cursor/hooks.json`, and `~/.cursor/hooks.json` as "all are executed" — [blog.gitbutler.com](https://blog.gitbutler.com/cursor-hooks-deep-dive)).

**Top-level schema:**
```json
{
  "version": 1,
  "hooks": {
    "hookName": [
      {
        "command": "./path/to/script.sh",
        "type": "command",
        "timeout": 30,
        "loop_limit": 5,
        "failClosed": false,
        "matcher": "pattern"
      }
    ]
  }
}
```
(per [cursor.com/docs/hooks](https://cursor.com/docs/hooks))

**Per-hook-entry fields**, quoted from [cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md):
> "`command` (string, required), `type` (`"command"` | `"prompt"`, default `"command"`), `timeout` (number, platform default), `loop_limit` (number | null, default `5`), `failClosed` (boolean, default `false`), `matcher` (object)"

Note the doc's own text is inconsistent about whether `matcher` is a string or object — the schema block shows `"matcher": "pattern"` (a string) and per-event descriptions confirm it is matched as a **string pattern** against different targets per event (see §2 Matcher table below), so treat "matcher (object)" in the prose table as a documentation inconsistency, not a distinct object schema. Both ntorres.dev and the primary docs describe the matcher as a **JavaScript regex string** — ntorres.dev: "JavaScript regex, not POSIX/grep syntax" ([ntorres.dev](https://ntorres.dev/blog/cursor-hooks-json-guide)).

**`command` value**: "Each definition currently supports a `command` property that can be a shell string, an absolute path, or a relative path" ([cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md)). Relative command paths resolve relative to the `hooks.json` file's own location — "Hook command paths are relative to the `.cursor/hooks.json` file location" ([github.com/johnlindquist/cursor-hooks](https://github.com/johnlindquist/cursor-hooks)).

**A dedicated `"shell"` field**: **Not documented as of 2026-08.** No source (primary docs, ntorres.dev, GitButler, or the two example repos) shows a `shell` key on a hook-entry object. Shell selection appears to be handled implicitly by `command` being a shell string (so the invoking shell is whatever the OS default/`command` string specifies), and Windows users have had to work around this explicitly, e.g. Cursor staff recommending `"command": "cmd /c node .cursor/hooks/pre-dev-gate.js"` to force the interpreter ([forum.cursor.com — hooks intermittently non-functional on Windows](https://forum.cursor.com/t/hooks-intermittently-non-functional-on-windows-pretooluse-worked-then-stopped-after-hooks-json-edit/154608)).

**Type: `"prompt"` hooks**: An alternative to command-based hooks — "Prompt-Based: LLM-evaluated conditions using natural language. Returns `{ ok: boolean, reason?: string }`." Cloud Agents only run command-based hooks; prompt-based hooks are unavailable there ([cursor.com/docs/hooks](https://cursor.com/docs/hooks)).

**Environment variables available to hook scripts**, quoted list from [cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md):
```
CURSOR_PROJECT_DIR (workspace root)
CURSOR_VERSION
CURSOR_USER_EMAIL (if logged in)
CURSOR_TRANSCRIPT_PATH (if transcripts enabled)
CURSOR_CODE_REMOTE ("true" for remote workspaces)
CLAUDE_PROJECT_DIR (alias for project dir)
```
Additionally, `sessionStart` hooks can return an `"env"` object whose key/value pairs become environment variables available to all subsequent hook executions within that session (see §8).

Sandboxed shell execution separately injects `CURSOR_SANDBOX`, `CURSOR_ORIG_UID`, `CURSOR_ORIG_GID`, and (Linux) `CURSOR_SANDBOX_LANDLOCK_STATUS` — these are sandbox-process variables, not hook-script variables (see §9).

## 2. Every hook event

Base fields present on **all** hook payloads (agent-lifecycle hooks), per [cursor.com/docs/hooks](https://cursor.com/docs/hooks):
```json
{
  "conversation_id": "uuid",
  "generation_id": "uuid",
  "model": "...",
  "model_id": "...",
  "model_params": [{ "id": "...", "value": "..." }],
  "hook_event_name": "eventName",
  "cursor_version": "...",
  "workspace_roots": ["/path/to/repo"],
  "user_email": "string|null",
  "transcript_path": "string|null"
}
```
App-lifecycle hooks (`workspaceOpen`) omit `conversation_id`, `generation_id`, `model`, `transcript_path`.

| Event | Fires when | Can deny/block? | Can inject/modify content? |
|---|---|---|---|
| `preToolUse` | before any tool executes (Shell, Read, Write, MCP, Task) | Yes (`allow`/`deny`, no `ask`) | Yes — `updated_input` rewrites the tool call |
| `postToolUse` | after successful tool execution | No | Yes — `additional_context`, `updated_mcp_tool_output` |
| `postToolUseFailure` | tool fails, times out, or is denied | No | No — observational only |
| `beforeShellExecution` | before a shell command executes | Yes (`allow`/`deny`/`ask`) | No (block-only) |
| `afterShellExecution` | after a shell command completes | No | No |
| `beforeMCPExecution` | before an MCP tool executes | Yes (`allow`/`deny`/`ask`) | No (block-only) |
| `afterMCPExecution` | after an MCP tool completes | No | No |
| `beforeReadFile` | before Agent reads a file | Yes (`allow`/`deny`) | No — cannot rewrite content, only gate access |
| `beforeTabFileRead` | before Tab (inline completion) reads a file | Yes (`allow`/`deny`) | No |
| `afterFileEdit` | after Agent edits a file | No | No — observation only |
| `afterTabFileEdit` | after Tab edits a file | No | No |
| `beforeSubmitPrompt` | after user sends, before backend request | Yes (`continue: false`) | No documented context-injection field (see §8) |
| `subagentStart` | before spawning a subagent (Task tool) | Yes (`allow`/`deny`; `ask` treated as `deny`) | No |
| `subagentStop` | subagent completes/errors/aborted | No (loop-continuation only) | `followup_message` (auto-continue) |
| `stop` | agent loop ends | No (loop-continuation only) | `followup_message` (auto-continue) |
| `sessionStart` | new composer conversation created | No (fire-and-forget) | Yes — `additional_context`, `env` |
| `sessionEnd` | composer conversation ends | No (fire-and-forget) | No |
| `afterAgentResponse` | after agent completes an assistant message | No | No |
| `afterAgentThought` | after agent completes a thinking block | No | No |
| `preCompact` | before context-window compaction | No | No (only a `user_message` shown to user) |
| `workspaceOpen` | Cursor opens a workspace / on folder change (app lifecycle, outside an agent session; "runs in the Cursor desktop app and CLI") | N/A | `pluginPaths` — plugin dirs to load |

All events above are named and described per [cursor.com/docs/hooks](https://cursor.com/docs/hooks) / [cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md), cross-checked against [ntorres.dev](https://ntorres.dev/blog/cursor-hooks-json-guide). That is 20 distinct events plus `beforeTabFileRead`/`afterTabFileEdit` as Tab-specific variants — the task brief's "~23 events" figure roughly matches this enumerated set (20 listed here); no source enumerated a longer list, so this is treated as the complete current set. **A longer canonical count is not documented as of 2026-08** beyond what is listed above.

### Matcher targets per event (from [cursor.com/docs/hooks](https://cursor.com/docs/hooks) and [ntorres.dev](https://ntorres.dev/blog/cursor-hooks-json-guide))
| Event(s) | Matcher matches against |
|---|---|
| `preToolUse` / `postToolUse` / `postToolUseFailure` | tool type string: `Shell`, `Read`, `Write`, `Grep`, `Delete`, `Task`, or `MCP:<tool_name>` |
| `subagentStart` / `subagentStop` | subagent type: `generalPurpose`, `explore`, `shell`, … |
| `beforeShellExecution` / `afterShellExecution` | the full shell command string (JS regex) |
| `beforeReadFile` | tool type: `TabRead`, `Read` |
| `afterFileEdit` | tool type: `TabWrite`, `Write` |
| `beforeSubmitPrompt` | fixed value `UserPromptSubmit` |
| `stop` | fixed value `Stop` |
| `afterAgentResponse` / `afterAgentThought` | fixed values `AgentResponse` / `AgentThought` |

### Per-event detail — the important ones

**`preToolUse`** — input: `tool_name`, `tool_input`, `tool_use_id`, `cwd`, `model`, `model_id`, `model_params`, `agent_message` (plus base fields). Example shown in docs uses a Shell tool: `"tool_input": { "command": "npm install", "working_directory": "/project" }` ([cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md)) — **no example for Edit/Write with a `file_path` field was found in the docs**; whether `tool_input` for Edit/Write carries `file_path` is **not documented as of 2026-08** (not shown verbatim anywhere fetched). Output: `permission` (`"allow"`|`"deny"` — **`ask` is not enforced for preToolUse**), `user_message`, `agent_message`, `updated_input` (replaces the tool call before execution).

**`postToolUse`** — input adds `tool_output` (JSON-stringified) and `duration` (ms) to the preToolUse-style base. Output: `additional_context` (extra context injected into the conversation after the tool result) and `updated_mcp_tool_output` (replaces MCP tool output shown to the model). Cannot deny/block — the tool has already run.

**`beforeShellExecution`** — input: `command` (full terminal command string), `cwd`, `sandbox` (boolean, whether it will run sandboxed). Output: `permission` (`allow`/`deny`/`ask`), `user_message`, `agent_message`. Example deny response quoted from [endorlabs/cursor-hook-examples](https://github.com/endorlabs/cursor-hook-examples):
```json
{
  "permission": "deny",
  "user_message": "Malware detected in command. Command blocked. npm://nyc-config@0.9.0",
  "agent_message": "Malware detected in command. Command blocked. npm://nyc-config@0.9.0"
}
```

**`beforeMCPExecution`** — input: `tool_name`, `tool_input` (JSON params), plus either `url` or `command`. Output identical shape to `beforeShellExecution`. Docs explicitly "Recommend `failClosed: true` for security" on this hook ([cursor.com/docs/hooks](https://cursor.com/docs/hooks)).

## 3. Blocking semantics

**Which events can deny**: `preToolUse`, `beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile`, `beforeTabFileRead`, `subagentStart` (all via a `permission` field), plus `beforeSubmitPrompt` (via a boolean `continue` field, not `permission`). All other events are observational/fire-and-forget and cannot block.

**Response shape** for permission-based hooks:
```json
{
  "permission": "allow" | "deny" | "ask",
  "user_message": "Optional message shown to the user",
  "agent_message": "Optional message fed to the agent when denied"
}
```
`ask` requires human confirmation. Two events narrow this enum: `preToolUse` and `beforeReadFile`/`beforeTabFileRead` only support `allow`/`deny` (`ask` is not enforced there — [cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md)); `subagentStart` treats `ask` as `deny`: "`ask` is not supported for subagentStart and is treated as `deny`" ([cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md)).

**Exit-code semantics**, quoted verbatim from [cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md):
> "Exit code `0` - Hook succeeded, use the JSON output. Exit code `2` - Block the action (equivalent to returning `permission: "deny"`). Other exit codes - Hook failed, action proceeds (fail-open by default)."

**Timeout / crash / malformed output**, quoted verbatim:
> "By default, hook failures (crash, timeout, invalid JSON) allow the action through (fail-open). Set `failClosed: true` on the hook definition to block the action on failure instead."

So the default posture across the whole system is **fail-open**: a hook that times out, crashes, or emits malformed JSON does **not** block the agent unless the hook entry explicitly sets `"failClosed": true`. This is a significant asymmetry from a security-review point of view — a broken or slow security hook silently stops enforcing rather than blocking.

**Timeout value**: the `timeout` field is "number, platform default" — a hook-entry-level override in seconds (schema shows `"timeout": 30` as an example). **No documented maximum timeout ceiling was found as of 2026-08** ("No maximum timeout value is specified in the documentation" — cross-checked via [cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md)).

## 4. `stop` hook

**Input**: `status` (`"completed"`|`"aborted"`|`"error"`), `loop_count` (integer, how many times the stop hook has already triggered an automatic follow-up for that conversation; starts at 0), plus base fields.

**Output**: `{ "followup_message": "<message text>" }`. When `followup_message` is non-empty, it is **auto-submitted as the next user message**, which continues the agent loop.

**`loop_count` / `loop_limit`**: `loop_count` in the input tells the hook how many times it has already fired a follow-up this conversation. The hook-entry field `loop_limit` (default `5`) caps how many times a given hook can trigger a follow-up before Cursor stops honoring `followup_message` from it; setting `loop_limit: null` removes the cap entirely ([cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md)).

**Can the `stop` hook actually block turn-end, or only auto-continue?** Per docs: **"Can block: No."** The `stop` hook has no `permission`/`deny` output — its only lever is `followup_message`, which re-opens the loop by injecting a new user turn rather than refusing to end the current one. So it is strictly an auto-continuation mechanism, not a true block/deny gate on ending the turn ([cursor.com/docs/hooks](https://cursor.com/docs/hooks)). Note also the CLI-specific caveat in §10: as of a February 2026 forum report, `stop` hooks were not firing at all in `cursor-agent` CLI despite being documented ("the source code in your product simply discards it" — [forum.cursor.com/t/cursor-cli-hooks](https://forum.cursor.com/t/cursor-cli-hooks/148511)); an April 2026 CLI changelog entry says hook reliability was subsequently improved (see §10).

## 5. `preToolUse` / `postToolUse`

- **Tool name/args passing**: `tool_name` (string) and `tool_input` (object, tool-specific — shown for Shell as `{ "command": ..., "working_directory": ... }`) are passed on both events; `postToolUse` additionally receives `tool_output` as a **JSON-stringified** string (not a nested object) and `duration` in milliseconds.
- **File paths for Edit/Write**: **Not documented as of 2026-08.** No fetched source shows a verbatim `tool_input` example for an Edit or Write tool call, so whether `file_path` appears inside `tool_input` for those tools is unconfirmed from the docs. (By contrast, the separate `afterFileEdit`/`beforeReadFile` hooks do explicitly carry `file_path` at the top level — see §6 — so file-path visibility clearly exists in the hook system generally, just not confirmed specifically inside `preToolUse`/`postToolUse` payloads.)
- **Can the hook modify tool input/output, or only allow/deny?** `preToolUse` can do both: deny via `permission` **and** rewrite the call via `updated_input` (replaces the tool input before execution). `postToolUse` cannot deny (the tool already ran) but can modify what the model subsequently sees: `updated_mcp_tool_output` (MCP-tool results only) and `additional_context` (arbitrary extra text appended after the tool result). So `preToolUse` is allow/deny **and** modify-before-execution; `postToolUse` is modify-after-execution only, no blocking. Source: [cursor.com/docs/hooks](https://cursor.com/docs/hooks), [cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md).

## 6. `beforeReadFile` / `afterFileEdit`

**`beforeReadFile`** — input: `file_path` (absolute), `content` (the file's full text), `attachments` (array of `{"type": "file"|"rule", "file_path": "..."}`). Output: `permission` (`allow`/`deny`) and `user_message`. Fails open by default; set `failClosed: true` to block on hook failure.

**`afterFileEdit`** — input: `file_path` (absolute), `edits` (array of `{"old_string": "...", "new_string": "..."}`). No output fields are consumed — it is a pure notification hook.

**Can a hook rewrite the content the model sees, Claude-Code-style?** **No.** Per [cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md), quoted directly: "**beforeReadFile and afterFileEdit** allow observation only. The beforeReadFile hook permits denying file access via permission field, but neither hook supports rewriting file content—they observe or gate access without content modification." This is an explicit, documented gap versus Claude Code's hook system, where a `PreToolUse`/read hook can substitute the content returned to the model. Cursor's `beforeReadFile` is binary — full read or full deny — with no partial-redaction/content-injection return channel. (The [endorlabs example repo](https://github.com/endorlabs/cursor-hook-examples) uses `beforeShellExecution` to block malicious installs rather than rewriting file content precisely because content rewriting isn't available.) The `beforeTabFileRead`/`afterTabFileEdit` Tab-specific variants follow the same allow/deny-or-observe-only pattern; `afterTabFileEdit` additionally carries precise edit ranges (`range: {start_line_number, start_column, end_line_number, end_column}`, `old_line`, `new_line`) but still cannot rewrite anything, per [cursor.com/docs/hooks](https://cursor.com/docs/hooks).

## 7. `subagentStart` / `subagentStop`

**`subagentStart`** input: `subagent_id`, `subagent_type` (`generalPurpose`|`explore`|`shell`|...), `task`, `parent_conversation_id`, `tool_call_id`, `subagent_model`, `is_parallel_worker`, optional `git_branch`.

Output: `permission` (`allow`/`deny`), `user_message`, `agent_message`.

**Does denying actually prevent the subagent from spawning?** Yes — quoted directly: "'allow' to proceed, 'deny' to block." and "'ask' is not supported for subagentStart and is treated as 'deny'" ([cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md)). This is a genuine hard gate, unlike `stop`.

**`subagentStop`** input: `subagent_type`, `status` (`completed`|`error`|`aborted`), `task`, `description`, `summary`, `duration_ms`, `message_count`, `tool_call_count`, `loop_count` (starts at 0), `modified_files` (string array), `agent_transcript_path` (string or null).

Output: `followup_message`, "only consumed when status is completed" ([cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md)) — same auto-continue mechanism as `stop`, subject to the entry's `loop_limit`. `subagentStop` **cannot block** — it can only chain another follow-up task, not veto subagent completion.

## 8. `sessionStart` / `beforeSubmitPrompt` — context injection

**`sessionStart`** — input: `session_id`, `is_background_agent`, `composer_mode` (`agent`|`ask`|`edit`, optional). Fires "when new composer conversation created (fire-and-forget, non-blocking)." Output: `{ "env": {...}, "additional_context": "<context>" }`. Per docs: "`additional_context`: Context added to initial system context" and "`env`: Object of environment variables for session" (env vars become available to subsequent hook executions in that session). **This is the exact mechanism**: the field name is `additional_context`, and it injects text into the conversation's initial system context at session start. Source: [cursor.com/docs/hooks](https://cursor.com/docs/hooks), [cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md).

**`beforeSubmitPrompt`** — input: `prompt` (user text), `attachments` (array of `{type: "file"|"rule", file_path}`). Output: `{ "continue": boolean, "user_message": "<message>" }`. **No `additional_context` (or equivalent) output field is documented for `beforeSubmitPrompt`** — its only levers are `continue` (block/allow submission) and `user_message` (shown to the user when blocked). This was confirmed twice independently across fetches of the primary docs. GitButler's older post likewise describes `beforeSubmitPrompt` as "Informational only; no output JSON currently respected" — consistent with there being no context-injection channel on this event even in the current docs, only the boolean gate.

**Why this matters for the `superpowers` repo**: the `superpowers` project's Cursor integration relies on a `sessionStart` hook (configured via `hooks-cursor.json` with `{ hooks: { sessionStart: [{ command: ./hooks/session-start }] } }`) to inject its skill/context material once per session using the `additional_context` output field — **not** `beforeSubmitPrompt`, which has no such field. This matches a live compatibility bug: on Windows, Cursor was found to open the extensionless `session-start` bash script as a document instead of executing it, breaking the injection entirely — "Cursor on Windows opens hooks/session-start file instead of executing SessionStart hook" ([github.com/obra/superpowers issue #1449](https://github.com/obra/superpowers/issues/1449)). Because `sessionStart` fires once at conversation creation (not per-prompt), any injected `additional_context` is a one-time system-context seed, not a per-turn re-injection the way a `beforeSubmitPrompt`-based mechanism (had it supported context injection) could have been.

## 9. Permissions / sandbox and interaction with hooks

Cursor's terminal/tool approval system is governed by **Run Modes** ([cursor.com/docs/agent/security/run-modes](https://cursor.com/docs/agent/security/run-modes)), independent of `hooks.json`:

- **Auto-review** — "Allowlisted calls run immediately. Other shell commands run in the sandbox when possible."
- **Allowlist** — "Actions in your allowlist run without approval. With sandboxing enabled, supported shell commands can run in the sandbox."
- **Run Everything** — "Every tool call runs automatically."

**`permissions.json`** (used by Auto-review) — quoted structure:
```json
{
  "autoRun": {
    "allow_instructions": [],
    "block_instructions": [
      "Every AWS CLI command should go through approval first."
    ]
  }
}
```
`allow_instructions`/`block_instructions` are **plain-English sentences**, not command patterns — the allowlisting is LLM-interpreted natural-language policy, not a literal regex/glob allowlist. Community-documented (third-party, not primary docs) fields also reference `terminalAllowlist` and `mcpAllowlist` arrays in `~/.cursor/permissions.json`, used to pre-approve literal commands/MCP tools ([forum.cursor.com — permissions.json allowlists disable Auto-review](https://forum.cursor.com/t/permissions-json-allowlists-disable-auto-review-with-sandbox-contradicts-docs/165722/7); [productionai.institute](https://www.productionai.institute/insights/cursor-permissions-json-schema-reference)) — treat the exact shape of these two fields as community-sourced rather than confirmed verbatim from primary docs.

**Sandboxing** (`Run Modes > Sandboxing` section):
- macOS: Seatbelt via `sandbox-exec`, no extra setup, requires Cursor v2.0+.
- Linux: Landlock primary backend, Bubblewrap fallback; sandbox remaps the process to UID 0 inside a user namespace.
- Injected env vars in sandboxed processes: `CURSOR_SANDBOX` (`"seatbelt"` on macOS, `"native"` on Linux), `CURSOR_ORIG_UID`/`CURSOR_ORIG_GID` (original host identity — needed e.g. for Docker operations since "UID inside the sandbox may not match your real user"), `CURSOR_SANDBOX_LANDLOCK_STATUS` (`"fully_enforced"` or `"bubblewrap"` on Linux).
- **`sandbox.json`** (`~/.cursor/sandbox.json` global or `<project>/.cursor/sandbox.json` project-level, project wins on conflict) controls network policy and extra readable/writable paths — separate purpose from `permissions.json`: "sandbox.json governs resource access; permissions.json steers Auto-review approval decisions" ([cursor.com/docs/agent/security/run-modes](https://cursor.com/docs/agent/security/run-modes)).
- Network modes: "sandbox.json Only" (allowlist only), "sandbox.json + Defaults" (adds Cursor's built-in domains — npm, Docker, GitHub, etc.), "Allow All."
- Protected paths even inside a sandboxed, workspace-read/write command: `.git/config`, `.vscode`, Cursor config files.

**Interaction between Run Modes/sandbox and hooks**: The primary Run Modes docs page **does not discuss hook integration** ("The documentation does not discuss how Run Modes interact with hooks... makes no mention of hook integration or mechanics"). The one place hooks and the permission system are explicitly tied together is the Cloud Agent security docs: "pair these with hooks to enforce policy and log activity at agent lifecycle points" ([cursor.com/docs/cloud-agent/security](https://cursor.com/docs/cloud-agent/security)) — i.e., hooks are positioned as a *supplementary* enforcement layer on top of (not integrated into) Run Modes/sandbox policy. The howtoharden.com guide frames this distinction sharply: Run Modes are "best-effort guardrails rather than a hard security boundary" and "the vendor does not claim Run Modes are a security boundary," whereas hooks (specifically the blocking ones) are described as "the layer that does not carry a best-effort caveat" — i.e., hooks (when written to `failClosed: true` and correctly matched) are the one part of the system that can be a genuine hard stop, while Run Mode/sandbox settings alone are advisory ([howtoharden.com/guides/cursor](https://howtoharden.com/guides/cursor/)).

**Real-world friction between allowlist and sandbox** (forum reports, current as of 2026):
- "Command Allowlist is silently ignored when 'Auto-Run in Sandbox' is enabled" — with the legacy terminal tool disabled (the current default), the allowlist-approval variable is forced false and a `workspace_readwrite` sandbox policy is applied instead, letting commands run unchecked against the allowlist; staff workaround is to re-enable "Legacy Terminal Tool" ([forum.cursor.com/t/command-allowlist-is-silently-ignored-when-auto-run-in-sandbox-is-enabled/152136](https://forum.cursor.com/t/command-allowlist-is-silently-ignored-when-auto-run-in-sandbox-is-enabled/152136)).
- "permissions.json allowlists disable Auto-review (with Sandbox) — contradicts docs" — a non-empty `terminalAllowlist`/`mcpAllowlist` locks the UI into plain Allowlist mode instead of coexisting with Auto-review, contrary to what the docs imply; workaround is to configure allowlists via Settings → Agents → Approvals & Execution instead of the raw JSON array, and to avoid the undocumented/unsupported `approvalMode: "unrestricted"` field, which "breaks Run Mode control" ([forum.cursor.com/t/permissions-json-allowlists-disable-auto-review-with-sandbox-contradicts-docs/165722/7](https://forum.cursor.com/t/permissions-json-allowlists-disable-auto-review-with-sandbox-contradicts-docs/165722/7)).
- Third-party security research (Backslash) has separately characterized the denylist side of auto-run as bypassable — see "The Denylist Delusion: Cursor's Auto-Run Leaves Agentic AI Wide Open" ([backslash.security](https://www.backslash.security/blog/cursor-ai-security-flaw-autorun-denylist)) — not independently verified against primary docs here, flagged as a third-party claim.

## 10. Practical gotchas

**Performance overhead**: **Not documented as of 2026-08.** No source fetched (primary docs, ntorres.dev, GitButler) quantifies hook execution overhead or gives guidance on keeping hook scripts fast; the only related guidance is the per-hook `timeout` field defaulting to a "platform default" with no stated ceiling.

**Debugging**: Cursor ships built-in tooling for this — quoted verbatim: "There is a Hooks tab in **Customize** and a Hooks output channel to debug configured and executed hooks and see errors" ([cursor.com/docs/hooks.md](https://cursor.com/docs/hooks.md)).

**Do hooks fire for the `cursor-agent` CLI as well as the IDE?** Yes, but with a rocky history:
- CLI hook support was added in the January 2026 release: "Hooks. Session start/end, stop hooks with follow-up loops (autonomous 'keep going' patterns), pre-compaction, and subagent lifecycle hooks" ([cursor.com/docs/cli/changelog](https://cursor.com/docs/cli/changelog)).
- Shortly after (reported February 2026), several documented hooks were found not actually implemented in the CLI binary despite being advertised — a forum investigation found `stop`, `beforeSubmitPrompt`, `afterAgentResponse`, `afterAgentThought`, and `beforeReadFile` were silently discarded ("the source code in your product simply discards it" — [forum.cursor.com/t/cursor-cli-hooks/148511](https://forum.cursor.com/t/cursor-cli-hooks/148511)), while `beforeShellExecution`/`afterShellExecution`, `beforeMCPExecution`/`afterMCPExecution`, and `afterFileEdit` did work.
- An April 2026 changelog entry reports a fix: "Hooks fire reliably. `afterAgentThought`/`afterAgentResponse` events emit in the CLI, and Claude Code-format hook responses are accepted" ([cursor.com/docs/cli/changelog](https://cursor.com/docs/cli/changelog)) — notably the CLI also gained acceptance of **Claude Code-format** hook responses, i.e. some cross-compatibility with Claude Code's hook JSON shape.
- A May 20, 2026 entry: "Hooks accept payloads over stdin. Avoids argv length limits and keeps payloads out of process listings" ([cursor.com/docs/cli/changelog](https://cursor.com/docs/cli/changelog)) — implying payloads were previously (partly) passed via argv, a minor security/robustness fix (argv is visible in process listings to other local users).
- Cloud Agents (background/remote agents) support a specific subset of hooks per the primary docs: `beforeShellExecution`, `afterShellExecution`, `beforeReadFile`, `afterFileEdit`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`, `subagentStop`, `beforeSubmitPrompt`, `preCompact`, `afterAgentResponse`, `afterAgentThought`, `stop`. Not available in Cloud Agents: `sessionStart`, `sessionEnd`, `beforeMCPExecution`, `afterMCPExecution`, `beforeTabFileRead`, `afterTabFileEdit`, `workspaceOpen`. Cloud Agents also only load project/team/enterprise hooks, not user-level `~/.cursor/hooks.json` ([cursor.com/docs/hooks](https://cursor.com/docs/hooks)).

**Cross-platform (Windows) issues** — several independent, still-relevant forum reports:
- Extensionless script files get opened as documents instead of executed: "Cursor on Windows opens hooks/session-start file instead of executing SessionStart hook" ([github.com/obra/superpowers#1449](https://github.com/obra/superpowers/issues/1449)) — fix is to give the script a proper extension or an explicit interpreter wrapper.
- Path-format mismatch: Cursor sends `workspace_roots` in Unix-style paths (e.g. `"/c:/Users/..."`) that Node.js on Windows cannot resolve directly, silently breaking file operations inside a hook (e.g. writing log/state files); workaround is to strip the leading `/` or avoid `workspace_roots`-derived paths entirely and use `__dirname` instead ([forum.cursor.com/t/hooks-intermittently-non-functional-on-windows.../154608](https://forum.cursor.com/t/hooks-intermittently-non-functional-on-windows-pretooluse-worked-then-stopped-after-hooks-json-edit/154608)). The same thread also reports that **editing `hooks.json` mid-session can break the file watcher**, requiring a full app reset (multiple restarts insufficient) before hooks resume firing at all.
- Shell/interpreter mismatch producing `"--: line 1: 3: Bad file descriptor (stderr)"` on Windows for hooks that work fine when the same command is run manually in a terminal, affecting `beforeSubmitPrompt` and `beforeShellExecution`; reported across Cursor versions ~2.1.25 through 2.1.46, Windows-only (Mac unaffected), and marked **unresolved with no official fix** as of late December 2025 in that thread ([forum.cursor.com/t/cursor-hooks-on-windows/140293](https://forum.cursor.com/t/cursor-hooks-on-windows/140293)). Staff's general-purpose workaround elsewhere is to force the interpreter explicitly, e.g. `"command": "cmd /c node .cursor/hooks/pre-dev-gate.js"`.

**Other gotchas**:
- Fail-open-by-default (§3) means a slow or crashing security hook is a silent no-op unless `failClosed: true` is set per hook entry — easy to misconfigure a "blocking" hook that in practice never blocks on its own failure.
- `beforeReadFile`/`afterFileEdit` cannot redact or rewrite content (§6), so secret-redaction-before-LLM patterns can only **deny the whole read**, not scrub-and-allow, per GitButler's characterization of `beforeReadFile` being "Used for secret redaction before LLM processing" via denial rather than substitution.
- Working-directory sensitivity in third-party example hooks: the endorlabs `stop` hook reads a `malware_detected_packages_<generation_id>.txt` from the current working directory, so a hook invoked from a different cwd than expected silently fails to find its own state file ([github.com/endorlabs/cursor-hook-examples](https://github.com/endorlabs/cursor-hook-examples)).
