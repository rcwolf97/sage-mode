# What Cursor Can Actually Do (August 2026)

**Researched:** 2026-08-21 against cursor.com/docs, cursor.com/changelog, github.com/cursor/plugins, agent-plugins.org, and the Cursor community forum. Roughly Cursor 3.14.x.

> **In plain terms:** Before designing an agent organization on top of Cursor, we need to know what Cursor actually gives us versus what we'd have to fake. Short answer: Cursor now ships most of the machinery an agent org needs — parallel subagents with per-agent model selection, git worktrees, blocking hooks, a plugin format that packages all of it. Three things it does *not* give us change the design: hooks can't rewrite what the model reads, the end-of-turn hook can't actually block, and subagents can't talk to each other. Everything below is sourced; where the docs are silent I say so rather than guessing.

---

## 1. The plugin format — what sage-mode ships as

> **In plain terms:** There are two plugin formats. The portable one only carries skills and MCP servers. The Cursor one also carries subagents, commands, rules, and hooks — which is everything we need, so that's the one we use. The cost is that sage-mode is then Cursor-first, not portable.

| | Agent Plugin | Cursor Plugin |
|---|---|---|
| Manifest | `plugin.json` at repo root | `.cursor-plugin/plugin.json` |
| Standard | [agent-plugins.org](https://agent-plugins.org/) v1.0.0, portable | Cursor-only superset |
| Skills | ✅ | ✅ |
| MCP servers | ✅ | ✅ |
| Rules (`.mdc`) | ❌ | ✅ |
| **Subagents** | ❌ | ✅ |
| Commands | ❌ | ✅ |
| **Hooks** | ❌ | ✅ |

Source: [cursor.com/docs/plugins](https://cursor.com/docs/plugins), [cursor.com/docs/reference/plugins](https://cursor.com/docs/reference/plugins)

```
sage-mode/
├── .cursor-plugin/plugin.json
├── skills/<name>/SKILL.md      # + scripts/ references/ assets/
├── agents/<name>.md            # subagent definitions
├── commands/<name>.md
├── rules/<name>.mdc
├── hooks/hooks.json
└── mcp.json
```

All six directories are **auto-discovered** if the manifest omits the corresponding field. The manifest requires only `name`; optional fields include `version`, `author`, `repository`, and a `variables` object — a restricted JSON Schema (`type`, `title`, `description`, `default`, `enum`, `const`, `properties`, `required`, `items`) whose values users set in the dashboard and that config files reference as `${VAR}`. That's how a plugin takes an API key without hardcoding it.

**Distribution.** Marketplace listing requires manual review. But a plain GitHub repo installs directly with `/add-plugin <github-url>` — no listing needed. ⚠️ That path has an [unresolved bug since June 2026](https://forum.cursor.com/t/add-plugin-github-imports-can-get-stuck-on-stale-plugin-versions/163895): installs pin to the commit at install time and can't be upgraded or cleanly removed. Cursor staff reproduced it; still broken as of Aug 3, 2026. **For development, symlink instead:** `ln -s /path/to/sage-mode ~/.cursor/plugins/local/sage-mode`, then `Developer: Reload Window`.

---

## 2. Skills — and the context tax nobody mentions

> **In plain terms:** Cursor reads `SKILL.md` files the same way Claude Code does, including the pattern where a short skill file points at longer reference files that only load when needed. But Cursor also auto-loads skills from Claude's and Codex's directories, which means a machine with several skill libraries installed is paying context for all of them at once.

`SKILL.md` frontmatter Cursor reads ([docs](https://cursor.com/docs/skills)):

| Field | Required | Notes |
|---|---|---|
| `name` | yes | lowercase-kebab, **must match the parent folder name** |
| `description` | yes | this is the entire trigger mechanism — the agent reads it to decide relevance |
| `paths` | no | globs that scope the skill to matching files |
| `disable-model-invocation` | no | `true` = manual `/skill-name` only |
| `icon`, `color` | no | badge styling when used as a Custom Mode |
| `metadata` | no | arbitrary key-value |

**Progressive disclosure is supported natively.** A skill folder may contain `scripts/` (executable), `references/` (docs loaded on demand), and `assets/` (templates, data). The docs are explicit: *"Agents load resources progressively—only when needed."* This is the mechanism that makes a skeleton-plus-references skill design work, and it's the reason the ui-ux-pro-max pattern ports cleanly.

**Auto-discovery roots**, walked recursively: `.cursor/skills/`, `.agents/skills/`, `~/.cursor/skills/`, `~/.agents/skills/`, **plus** `.claude/skills/`, `.codex/skills/`, `~/.claude/skills/`, `~/.codex/skills/`.

⚠️ That cross-loading is a real problem for a token-efficient design. Users report [context bloat from skills loading across all compatibility roots](https://forum.cursor.com/t/toggle-or-allowlist-for-agent-skills-roots-stop-loading-claude-skills-and-codex-skills-when-i-only-want-cursor-agents/160199). The IDE has a settings toggle to disable it; **the toggle does not apply to `cursor-agent` CLI**, and there is no CLI flag equivalent.

**Cursor shows you the bill.** A context ring displays token usage *"split by category — system prompts, tools, rules, skills, MCP connections, subagent documentation, summarized conversation, and active dialogue"* ([docs](https://cursor.com/docs/agent/prompting)). CLI: `/context`. This makes skill-library bloat measurable rather than theoretical.

**Not documented as of 2026-08:** any cap on skill count, file size, or nesting depth.

---

## 3. Subagents — the org chart is buildable

> **In plain terms:** This is the finding that makes the whole "team of engineers" idea real rather than aspirational. Cursor lets you define named subagents in files, give each one its own model, and launch several at once. You can put a cheap fast model on the implementers and an expensive one from a different vendor on the reviewer — which gets us genuinely independent review without shelling out to an external CLI.

Subagents live in `.cursor/agents/`, `.claude/agents/`, or `.codex/agents/` (project wins over user on name conflict) as markdown with YAML frontmatter ([docs](https://cursor.com/docs/subagents)):

| Field | Type | Default |
|---|---|---|
| `name` | string | filename |
| `description` | string | — |
| `model` | string | `inherit` |
| `readonly` | boolean | `false` |
| `is_background` | boolean | `false` |

**`model` is the important one.** It accepts `inherit`, a model ID (`composer-2`, `gpt-5.6-sol`), or a model ID with bracketed parameters: `claude-opus-5[effort=high,context=300k]`. Per-role model *and* effort *and* context-window assignment, declared in a file a plugin ships.

Not one of the five reference repos used this. agent-skills documents Haiku/Sonnet/Opus tiering in prose and pins `model:` in none of its four persona files; gstack's subagents all inherit the parent model. **This is free cost control that the state of the art is leaving on the floor.**

**Dispatch and parallelism.** There is a literal tool named **Task**. *"Agent sends multiple Task tool calls in a single message, so subagents run simultaneously."* Built-in subagents: **Explore, Bash, Browser**.

**Two hard limits:**

1. **Nesting depth.** *"The main agent and its direct subagents can launch subagents, but a subagent launched by another subagent can't launch further ones."* So: main → implementer → reviewer works. Reviewer → anything does not.
2. **Cost is linear.** *"Running five subagents in parallel uses roughly five times the tokens of a single agent."* Parallelism buys wall-clock, never tokens.

**Tools:** subagents *"inherit all tools from the parent, including MCP tools"* — constrained only by `readonly`. There is no per-subagent tool allowlist frontmatter field. Scoping a specialist's tool access requires a hook, not config.

⚠️ **Subagents cannot communicate with each other.** No documented channel. Any "the frontend agent asks the backend agent a question" design has to route through the parent. See §7.

---

## 4. Hooks — what can actually be enforced

> **In plain terms:** Six hook events can genuinely block the agent. Everything else just watches. Two things we assumed in v1 turn out to be impossible: you can't rewrite a file's contents before the model reads it, and you can't refuse to let the agent end its turn — you can only shove another message at it. Also, every hook fails *open* by default, meaning a crashed security hook silently stops protecting anything.

**Config** at `.cursor/hooks.json` (project), `~/.cursor/hooks.json` (user), or system-wide; **all applicable levels run**.

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      { "command": "./hooks/sage-careful", "type": "command",
        "timeout": 30, "failClosed": true, "matcher": "rm |git push" }
    ]
  }
}
```

`matcher` is a **JavaScript regex string**, matched against a different target per event: tool type (`Shell`, `Read`, `Write`, `Grep`, `Delete`, `Task`, `MCP:<name>`) for `preToolUse`; the full command string for `beforeShellExecution`; subagent type for `subagentStart`.

### The complete event table

| Event | Can block? | Can inject / modify? |
|---|---|---|
| `preToolUse` | ✅ allow/deny | ✅ **`updated_input`** rewrites the tool call |
| `postToolUse` | ❌ | ✅ `additional_context`, `updated_mcp_tool_output` |
| `postToolUseFailure` | ❌ | ❌ |
| `beforeShellExecution` | ✅ allow/deny/ask | ❌ |
| `afterShellExecution` | ❌ | ❌ |
| `beforeMCPExecution` | ✅ allow/deny/ask | ❌ |
| `afterMCPExecution` | ❌ | ❌ |
| `beforeReadFile` | ✅ allow/deny | ❌ **cannot rewrite content** |
| `beforeTabFileRead` | ✅ allow/deny | ❌ |
| `afterFileEdit` | ❌ | ❌ observation only |
| `afterTabFileEdit` | ❌ | ❌ |
| `beforeSubmitPrompt` | ✅ `continue: false` | ❌ no injection field |
| `subagentStart` | ✅ allow/deny (`ask`→deny) | ❌ |
| `subagentStop` | ❌ | ✅ `followup_message` |
| `stop` | ❌ | ✅ `followup_message` |
| `sessionStart` | ❌ | ✅ **`additional_context`**, `env` |
| `sessionEnd` | ❌ | ❌ |
| `afterAgentResponse` / `afterAgentThought` | ❌ | ❌ |
| `preCompact` | ❌ | ❌ (user message only) |
| `workspaceOpen` | n/a | `pluginPaths` |

Source: [cursor.com/docs/hooks](https://cursor.com/docs/hooks)

### The three findings that change the design

**(a) `beforeReadFile` cannot rewrite content.** Quoted from the docs: *"beforeReadFile and afterFileEdit allow observation only... neither hook supports rewriting file content—they observe or gate access without content modification."* agent-skills' `simplify-ignore.sh` — which swaps annotated code for `BLOCK_<hash>` placeholders so the model literally cannot see it — **does not port to Cursor**. The only lever is denying the whole read.

**(b) The `stop` hook cannot block turn-end.** Its only output is `followup_message`, auto-submitted as the next user message, capped by `loop_limit` (default 5, `null` removes the cap). So a "you can't say done until the tests pass" gate is a *nagging loop*, not a wall. It works — but it's a different mechanism with a different failure mode, and it burns turns.

**(c) `preToolUse` can rewrite tool input.** `updated_input` replaces the tool call before execution. Underused: a hook can silently correct or constrain a call instead of denying it and making the agent retry blindly.

### Fail-open by default

> *"By default, hook failures (crash, timeout, invalid JSON) allow the action through (fail-open). Set `failClosed: true` on the hook definition to block the action on failure instead."*

**Every enforcement hook sage-mode ships must set `failClosed: true`.** A hook that crashes silently stops enforcing.

⚠️ **Windows BOM bug, unresolved.** On Windows, hook payloads arrive on stdin with a UTF-8 BOM because of how PowerShell pipes into a native command. `JSON.parse()` throws; scripts that catch defensively degrade to allow-all — *silently neutering security hooks, including Cursor's own documentation examples*. Confirmed by Cursor staff July 27, 2026, [no ETA](https://forum.cursor.com/t/on-windows-cursor-s-hook-stdin-json-payload-includes-a-utf-8-bom-that-breaks-standard-json-parse-causing-security-guards-to-silently-degrade-to-allowing-commands-across-all-agent-channels/166794). Mitigation: strip the BOM (`readFileSync(0,"utf8").replace(/^﻿/,"")`) **and** set `failClosed: true`.

**Hook env vars:** `CURSOR_PROJECT_DIR`, `CURSOR_VERSION`, `CURSOR_USER_EMAIL`, `CURSOR_TRANSCRIPT_PATH`, `CURSOR_CODE_REMOTE`, `CLAUDE_PROJECT_DIR`. `sessionStart` can return an `env` object whose values persist to all later hooks in the session.

**Debugging:** there's a Hooks tab under Customize and a Hooks output channel.

**Cloud Agents run a subset.** Not available there: `sessionStart`, `sessionEnd`, `beforeMCPExecution`, `afterMCPExecution`, `beforeTabFileRead`, `workspaceOpen`. Cloud agents also load only project/team/enterprise hooks — **not** user-level `~/.cursor/hooks.json`. Since `sessionStart` is our bootstrap injection point, **sage-mode's bootstrap does not work in Cloud Agents.**

---

## 5. Parallel execution and worktrees

> **In plain terms:** Cursor 3.0 built the thing our DAG executor needs — isolated git worktrees, several agents at once, a window to watch them in. The catch is a concurrency cap Cursor doesn't publish, and their own research team documenting exactly the failure modes we're about to walk into.

**Cursor 3.0** (April 2, 2026) shipped the **Agents Window**: *"run many agents in parallel across repos and environments: locally, in worktrees, in the cloud, and on remote SSH"* ([changelog](https://cursor.com/changelog/3-0)). Open with `Cmd+Shift+P → Agents Window`.

- **`/worktree`** — *"creates a separate git worktree so changes happen in isolation"*, so *"multiple agents can edit different parts of the codebase simultaneously without conflicts."*
- **`/best-of-n`** — same task across multiple models, each in its own worktree, results compared side by side.
- **Agent Tabs** — multiple chats side-by-side or in a grid.
- **CLI:** `agent --worktree <name>` creates worktrees at `~/.cursor/worktrees/<repo>/<name>`. Subagents have executed locally in parallel since the March 2026 CLI release.

**Concurrency limit:** ⚠️ **8 simultaneous cloud agents on Pro** — stated by Cursor staff on the forum (*"It's 8, and this limit has been around since October!"*), [not in the docs](https://forum.cursor.com/t/cloud-agents-simultaneous-limit-what-are-the-actual-numbers-per-plan/154013). Pro+/Ultra get unspecified increases. Local subagent concurrency limits are **not documented as of 2026-08**.

**Cursor's own research is the best warning available.** Their [agent-swarm post](https://cursor.com/blog/agent-swarm-model-economics) (July 20, 2026) describes a planner/worker architecture where *"hundreds of workers run concurrently, pushing to the same branch"* — and names the coordination failure modes they hit: **split-brain duplication, planner contention, merge conflicts, "megafiles," and code ossification.** Their [scaling post](https://cursor.com/blog/scaling-agents) reports rebuilding SQLite for $1,339 with a hybrid planner/worker fleet versus $10,565 with a single frontier model.

Meanwhile the community is [openly skeptical](https://forum.cursor.com/t/what-s-the-point-of-multiple-agents/141805) of multi-agent work for ordinary coding — one user on Best-of-N: *"multiplies the amount of reviewing I have to do (+1 whole review session per agent)."* Reported genuine wins were narrow: highly repetitive edits across 150+ similar files, and exploratory bug-hunting.

**Read this honestly:** parallelism pays when tasks are genuinely independent and the review burden doesn't multiply with them. That is a *planning* constraint, which is why the DAG's file-ownership declarations matter more than the executor.

---

## 6. The rest of the surface

> **In plain terms:** Plan mode, a real browser with element inspection, two separate code-review systems, a scriptable CLI, and scheduled cloud agents. Most of this is stuff the five reference repos had to build themselves.

**Plan Mode** ([docs](https://cursor.com/docs/agent/plan-mode)) — `Shift+Tab`, or `/plan`, or `--plan` in the CLI. Agent asks clarifying questions → researches the codebase → produces a plan → you edit it in chat or as markdown → click to build. Plans save to the home directory by default; "Save to workspace" persists them. Whether the plan artifact has a stable schema is **not documented as of 2026-08**.

**Design Mode** (`Cmd+Shift+D` in the Agents Window browser) — click an element and the agent receives *"the xpath, the component, attributes, computed styles, and props from the fiber tree"* plus a screenshot. `Shift+drag` to select an area, `Cmd+L` to add an element to chat. Plus a built-in **Browser** subagent. This is gstack's whole `/qa` browser daemon and ui-ux-pro-max's Playwright review loop, shipped in the product.

**Two code-review systems:**
- **Bugbot** — PR-level, on GitHub/GitLab/Bitbucket/Azure DevOps. Configurable via `.cursor/BUGBOT.md`, team rules, glob-scoped custom rules, effort levels. **Has an API:** `POST /bugbot/review`, rate-limited to 30 reviews/min/team (10/min dry-run), rules capped at 100k chars combined / 30k each. A plugin can invoke it.
- **Agent Review** — local, `/agent-review`, runs against your working tree or branch diff. Quick and Deep modes. Also reads `BUGBOT.md`.

**CLI (`cursor-agent`)** — genuinely scriptable. `-p/--print` for non-interactive; `--force`/`--yolo` to actually apply edits in print mode; `--output-format text|json|stream-json` with typed events (`system`, `assistant`, `tool_call`, `result`) parseable by `jq`. Modes: Agent / Plan / Ask. Session management via `agent ls`, `agent resume`, `/fork`. `&` prefix hands a conversation to a Cloud Agent. **ACP** (`agent acp`) exposes JSON-RPC over stdio for custom clients.

**Cloud Agents + Automations** — cloud agents run in isolated VMs configured by `.cursor/environment.json` (snapshot or Dockerfile + install/start commands). **Automations** trigger cloud agents on cron or on events from GitHub, GitLab, Slack, Linear, webhooks, Sentry, PagerDuty. Full REST API for agent lifecycle, runs, SSE streaming, artifacts. The Aug 19, 2026 release added agents that *"hold a goal until it's met."*

**Models available** ([pricing](https://cursor.com/docs/models-and-pricing)): Cursor pool — Grok 4.6, Grok 4.5, Composer 2.5 (generous included usage). Other pool (API rates) — Claude Fable 5 / Opus 5 / Sonnet 5, Gemini 3.1 Pro / 3.7 Flash, GPT-5.6 Luna / Sol / Terra. **Cursor Router** auto-selects per turn using a "Compass" complexity predictor, in three modes (Auto Cost / Auto Balance / Auto Intelligence); reported *"Auto Intelligence: Fable-level satisfaction at 68% lower cost."*

⚠️ **Context windows are a mess.** Not tabulated in the docs. Community reports show 200k default for Claude models, 1M requiring MAX mode gated to Ultra, and [recurring bugs](https://forum.cursor.com/t/claude-models-stuck-at-200k-context-window-size/156424) where advertised 1M silently fell back to 200–300k. Don't design around a context number you haven't measured.

**Run Modes & sandbox** — Auto-review / Allowlist / Run Everything. `permissions.json` allowlists are **plain-English sentences** interpreted by an LLM, not regex. Sandboxing uses Seatbelt (macOS) or Landlock/Bubblewrap (Linux); `sandbox.json` controls network and path access. Third-party hardening analysis frames Run Modes as *"best-effort guardrails rather than a hard security boundary"* while blocking hooks are *"the layer that does not carry a best-effort caveat."* Hooks are the real enforcement; Run Modes are advisory.

---

## 7. What this means for sage-mode

> **In plain terms:** Nine concrete design consequences. Three kill ideas from v1, six unlock things we didn't know we could do.

| # | Finding | Consequence |
|---|---|---|
| 1 | Per-subagent `model` with `[effort=,context=]` | **The org chart is a config file.** Cheap models on implementers, an expensive different-vendor model on the reviewer. Cross-model independence without an external CLI. |
| 2 | Task tool + parallel dispatch + `/worktree` | The DAG executor is mostly orchestration prompt, not infrastructure. |
| 3 | Nesting capped at one level | main → implementer → reviewer is legal. Anything deeper is not. Design the org exactly three deep. |
| 4 | Subagents can't talk to each other | Agent-to-agent "communication" must be **a shared run directory plus the manager as the bus.** No peer channel exists — don't pretend otherwise. |
| 5 | `beforeReadFile` can't rewrite content | Drop the `simplify-ignore` idea. Scope enforcement must use `preToolUse` deny on Write. |
| 6 | `stop` can't block, only `followup_message` | The verify gate is a **nag loop** with `loop_limit`, not a wall. Budget the turns. |
| 7 | Hooks fail **open** by default | Every enforcement hook sets `failClosed: true`. Windows needs BOM stripping too. |
| 8 | `sessionStart` `additional_context` is the only injection point, and it's absent in Cloud Agents | Bootstrap works locally; **cloud runs are unbootstrapped.** Either accept that or re-seed via a rule with `alwaysApply: true`. |
| 9 | `postToolUse` `additional_context` | Underused: after a Task returns, inject the run ledger back into context. Keeps the manager oriented without re-reading files. |

**Two open verification items** — things the docs don't answer that we must test before building:

- Does `preToolUse`'s `tool_input` carry `file_path` for Write/Edit? The docs only show a Shell example. `afterFileEdit` definitely has `file_path`, but it can't block. **If Write's `tool_input` lacks a path, file-lane enforcement isn't buildable as designed.**
- Does per-subagent `model` selection actually apply to subagents shipped inside a plugin, or only to `.cursor/agents/` in the project? The manifest documents an `agents` field; the subagents doc doesn't discuss plugin distribution.

**And one platform risk worth stating plainly:** plugin support in the `cursor-agent` CLI has been broken or partial repeatedly through 2026 — plugin skills unregistered, nested skills missed, no file watcher, commands not loading. Cursor staff in May 2026: *"I can confirm that plugins are not currently working in the CLI."* Partially fixed since, with adjacent gaps still open. **Build and test sage-mode against the IDE. Treat CLI support as unproven until measured.**
