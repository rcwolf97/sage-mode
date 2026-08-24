# Cursor Agent Runtime — Capabilities as of 2026-08-23

## 1. Parallel / multi-agent execution

Cursor 3.0 (shipped April 2, 2026) introduced the **Agents Window**, described as allowing users to "run many agents in parallel across repos and environments: locally, in worktrees, in the cloud, and on remote SSH." Source: https://cursor.com/changelog/3-0

Access: upgrade, then `Cmd+Shift+P → Agents Window`. Once open, "switch back to the IDE anytime, or have both open simultaneously." Source: https://cursor.com/changelog/3-0

Per third-party docs on the window (Cursor's own agents-window doc page returned `ROBOTS_DISALLOWED` on direct fetch; corroborated via community source): "Run multiple agents simultaneously across isolated environments from a single control surface," working "across local workspaces, cloud environments, git worktrees, and remote SSH." Source: https://www.agentpatterns.ai/tools/cursor/agents-window/ (community summary, not cursor.com)

**Git worktrees**: a `/worktree` command "creates a separate git worktree so changes happen in isolation." "Each worktree is a distinct checkout of the repository at its own filesystem path, so multiple agents can edit different parts of the codebase simultaneously without conflicts." Source: https://cursor.com/changelog/3-0, https://www.agentpatterns.ai/tools/cursor/agents-window/

**Best-of-N**: `/best-of-n` "runs the same task in parallel across multiple models, each in its own isolated worktree, then compares outcomes" / "presents outputs side-by-side for selection." Source: https://cursor.com/changelog/3-0

**Agent Tabs**: lets you view "multiple chats at once, side-by-side or in a grid." Source: https://cursor.com/changelog/3-0

**CLI worktree flag**: `agent` CLI supports `-w`/`--worktree [name]`, creating isolated git worktrees at `~/.cursor/worktrees/<reponame>/<name>`. Source: https://cursor.com/docs/cli/using. CLI changelog confirms "Git worktrees support with `--worktree`" shipped in the February 2026 CLI release. Source: https://cursor.com/docs/cli/changelog. The March 2026 CLI release added "Subagents execute locally in parallel." Source: https://cursor.com/docs/cli/changelog

**Subagents (in-session parallelism, distinct from Agents Window agents)**: documented at https://cursor.com/docs/subagents. "Agent sends multiple Task tool calls in a single message, so subagents run simultaneously." Nesting is capped: "The main agent and its direct subagents can launch subagents, but a subagent launched by another subagent can't launch further ones." Cost scales linearly: "Running five subagents in parallel uses roughly five times the tokens of a single agent." Built-in subagents are Explore, Bash, and Browser. Per-subagent model override is supported via a `model` field (`inherit` default, or an explicit model ID, optionally with params like `claude-opus-5[effort=high,context=300k]`). Source: https://cursor.com/docs/subagents

**Concurrency limits — hard numbers found only via forum, NOT in docs**: Cursor staff member "Colin" stated on the forum (March 9, 2026): Pro plan is capped at **8 simultaneous [cloud] agents** — "It's 8, and this limit has been around since October!" Pro+/Ultra get "very generous increases on this rate limit" but no exact number was given publicly. Source: https://forum.cursor.com/t/cloud-agents-simultaneous-limit-what-are-the-actual-numbers-per-plan/154013 — this is a **community/forum figure, not documented on cursor.com**. A bug existed (fixed per Colin, June 12, 2026) where completed/idle cloud agents were incorrectly counted against the concurrent limit, causing spurious limit errors. Same source.

**Self-hosted/on-prem parallelism is limited**: an open forum feature request states "An agent is limited to a single directory, and it's not possible to work on multiple worktrees in parallel" for self-hosted background-agent pools; no official Cursor reply was present in the thread as of the check. Source: https://forum.cursor.com/t/improved-parallelism-in-self-hosted-agent/169211

**No first-class "orchestrator" product feature** beyond Subagents' documented "orchestrator pattern" (a prompting pattern, not a distinct product surface): "Planner analyzes requirements → Implementer builds features → Verifier confirms completion," with "Each handoff includ[ing] structured output so the next agent has clear context." Source: https://cursor.com/docs/subagents

**Community skepticism**: on the "What's the point of multiple agents?" forum thread, users called Best-of-N "a complete waste IMHO" and said comparing agents "multiplies the amount of reviewing I have to do (+1 whole review session *per agent*)." Reported genuine use cases were narrow: "very repetitive task[s]" across 150+ similar files, and exploratory bug-finding rather than production coding. Source: https://forum.cursor.com/t/whats-the-point-of-multiple-agents/141805 (URL as fetched: https://forum.cursor.com/t/what-s-the-point-of-multiple-agents/141805)

**Research-scale orchestration (internal, not a shipped end-user feature)**: Cursor's research blog describes a "Planners-and-Workers" architecture used internally where "hundreds of workers run concurrently, pushing to the same branch," reaching "around 1,000 commits per second," used to build a browser from scratch (1M+ LOC / 1,000 files) and migrate Solid→React (+266K/-193K edits over three weeks). This is R&D reporting, not a documented general-availability feature/limit for ordinary users. Source: https://cursor.com/blog/scaling-agents (Jan 14, 2026) and https://cursor.com/blog/agent-swarm-model-economics (Jul 20, 2026)

## 2. Background / remote agents

Cursor calls this product **Cloud Agents** (formerly "Background Agents"). "Cloud agents use the same agent fundamentals but run in isolated VMs in the cloud with full development environments instead of on your local machine." Source: https://cursor.com/docs/cloud-agent

VM specifics (CPU/RAM/storage) are **Not documented as of 2026-08** — the overview only says "Cursor manages VM provisioning, isolation, snapshots, startup, artifacts, and capacity for every Cloud Agent." Source: https://cursor.com/docs/cloud-agent

**Launch surfaces**: Desktop ("Select Cloud in the dropdown under the agent input"), Web (cursor.com/agents), Mobile (iOS app / Android PWA), Slack ("@cursor command to kick off an agent"), GitHub/Bitbucket (comment `@cursor` on a PR/issue), Linear (`@cursor` command), and API. Source: https://cursor.com/docs/cloud-agent

**Environment config** — `.cursor/environment.json`, three modes: agent-led setup, a saved snapshot, or a Dockerfile.
- Snapshot form: `{"snapshot": "snapshot-...", "install": "npm install"}`
- Dockerfile form: `{"build": {"dockerfile": "Dockerfile", "context": ".."}, "install": "pnpm install && ./custom_script.sh"}`
"The `dockerfile` and `context` paths in `build` are relative to `.cursor`." The install script "runs during Build creation" and "completes in the background instead of delaying each agent start"; it must be idempotent since it "runs for every Build and may run on previously prepared disk state." Startup uses a `start` command plus optional `terminals` that "run in a `tmux` session shared by you and the agent." Docker-in-VM requires `sudo service docker start` in the start command. Source: https://cursor.com/docs/cloud-agent/setup

**Secrets**: managed via cursor.com/dashboard/cloud-agents and exposed as env vars; environment-scoped secrets supported for multi-repo setups; 2FA supported via `oathtool --totp -b "$TOTP_SECRET"`. AWS IAM role assumption supported via secret `CURSOR_AWS_ASSUME_IAM_ROLE_ARN`, which sets `AWS_PROFILE=cursor-cloud-agent` for the default AWS credential chain. Source: https://cursor.com/docs/cloud-agent/setup

**Speed**: "Cloud Agents Start 3x Faster with Builds" (Aug 13, 2026 changelog/blog) — ready-made environments give "3x faster time to first token." Source: https://cursor.com/blog/builds, https://cursor.com/changelog (entry dated Aug 13, 2026)

**Automations** (event/schedule-driven cloud agents): "Cursor Automations run cloud agents in the background, either on a schedule or in response to events from GitHub, GitLab, Slack, webhooks, Linear, and more." Schedules use cron or presets; event triggers include PR/push/merge events (GitHub/GitLab/Bitbucket), Slack messages/reactions, Linear issue changes, generic webhooks, Sentry errors, and PagerDuty incidents. An automation "executes when *any* trigger fires" among multiple configured triggers. Source: https://cursor.com/docs/cloud-agent/automations. The Aug 19, 2026 changelog entry ("Cloud Agents and Cursor Harness Improvements") extends this: cloud agents "can automatically pick up work in response to events, hold a goal until it's met, and stay on course." Source: https://cursor.com/changelog (Aug 19, 2026 entry)

**Limits**: Concurrency for Pro plan is **8 simultaneous cloud agents** per forum staff statement (see §1) — **not stated in official docs**. https://cursor.com/docs/cloud-agent/settings and https://cursor.com/docs/cloud-agent/best-practices explicitly do **not** address concurrent-agent limits, timeouts, or max session length — Not documented as of 2026-08. One documented constraint: "Long-running is not available for multi-repo environments yet. Selecting a multi-repo environment disables the toggle." Source: https://cursor.com/docs/cloud-agent/settings

**API**: full REST surface for agent lifecycle — `POST /v1/agents` (create + enqueue initial run), `GET /v1/agents`, `GET /v1/agents/{id}`, `POST /v1/agents/{id}/archive` / `unarchive`, `DELETE /v1/agents/{id}`; runs — `POST /v1/agents/{id}/runs`, `GET /v1/agents/{id}/runs`, `GET /v1/agents/{id}/runs/{runId}`, `GET /v1/agents/{id}/runs/{runId}/stream` (SSE), `POST /v1/agents/{id}/runs/{runId}/cancel`, `GET /v1/agents/{id}/usage`; artifacts — `GET /v1/agents/{id}/artifacts`, `GET /v1/agents/{id}/artifacts/download`; self-hosted pool ops — `GET /v0/private-workers`, `GET /v0/private-workers/pools`, `GET /v0/private-workers/pending-requests`; metadata — `GET /v1/me`, `GET /v1/models`, `GET /v1/repositories`. Source: https://cursor.com/docs/cloud-agent/api/endpoints. This API surface has no documented concurrency cap either — Not documented as of 2026-08.

## 3. Planning mode

Plan Mode is documented at https://cursor.com/docs/agent/plan-mode. Activation: press `Shift+Tab` from the chat input, or use the mode picker dropdown; Cursor "automatically suggests it when you type keywords that indicate complex tasks."

Five-step workflow: "Agent asks clarifying questions to understand your requirements. Researches your codebase to gather relevant context. Creates a comprehensive implementation plan. You review and edit the plan through chat or markdown files. Click to build the plan when ready." Source: https://cursor.com/docs/agent/plan-mode

**Artifact**: plans are "saved by default in your home directory"; users can "Save to workspace" to persist them for "future reference, team sharing, and documentation" — implying a markdown plan file. Source: https://cursor.com/docs/agent/plan-mode

**Programmatic access**: the docs page itself gives no CLI/API detail. However the CLI exposes Plan as one of three operating modes (`Shift+Tab`, `/plan`, or `--plan` flag) — "design your approach before coding" — and ACP exposes an equivalent "plan" session mode ("planning, read-only"). Sources: https://cursor.com/docs/cli/using, https://cursor.com/docs/cli/acp. Whether the plan artifact itself (the markdown file) is exposed via a stable API/schema is **Not documented as of 2026-08**.

**When to use / not use**: suited to "complex features with multiple valid approaches," tasks "touch[ing] many files or systems," "unclear requirements," and "architectural decisions where you want to review the approach first." For "quick changes or tasks you've done many times before, jumping straight to Agent mode is fine." No technical constraints on plan size/complexity are documented. Source: https://cursor.com/docs/agent/plan-mode

## 4. Models

Per https://cursor.com/docs/models-and-pricing, models are split into two pools:

- **Cursor Models pool** (bundled "generous included usage," no exact token/request count disclosed): Grok 4.6 (standard + Fast), Grok 4.5 (standard + Fast), Composer 2.5 (standard + Fast).
- **Other Models pool** (billed at API rates plus, for Teams/Enterprise, "a Cursor Token Rate of $0.25 per million tokens" on top of model pricing): Claude Fable 5, Claude Opus 5, Claude Sonnet 5 (Anthropic); Gemini 3.1 Pro, Gemini 3.7 Flash (Google); GPT-5.6 Luna, GPT-5.6 Sol, GPT-5.6 Terra (OpenAI).

Example per-million-token rates quoted on the page: Claude Sonnet 5 "$2" input / "$10" output; GPT-5.6 Luna "$0.2" input. Source: https://cursor.com/docs/models-and-pricing

Grok 4.6 was introduced Aug 12, 2026 (https://cursor.com/blog/grok-4-6). Composer 2.5 became the CLI's default model as of the May 20, 2026 CLI release (https://cursor.com/docs/cli/changelog).

**Auto / Router model selection**: "Cursor Router picks the model for each Auto request based on your optimization mode" (Teams/Enterprise). Three modes: **Auto Cost** (fixed pricing regardless of model), **Auto Balance**, **Auto Intelligence** (both priced at actual model API rates). Source: https://cursor.com/docs/models-and-pricing. Mechanism detail from the Router blog post (Aug 6, 2026): a "Compass" model "estimates the complexity of each turn by predicting whether the user will be satisfied with Cursor's response," then routes complex turns via a domain/task/modifier taxonomy to the best-fit frontier model; simple tasks route to cheaper models (e.g., Grok). Reported results: "Auto Intelligence: Achieves Fable-level satisfaction at 68% lower cost" and "Auto Balance: Outperforms Opus 4.8 at 41% lower cost." Source: https://cursor.com/blog/how-cursor-router-works. New CLI installs default to Auto routing as of the July 6, 2026 CLI release. Source: https://cursor.com/docs/cli/changelog

**Per-subagent model selection** IS documented (this is the concrete "plugin-usable" control-tier lever): the Subagents `model` frontmatter field accepts `inherit` (default) or an explicit model ID, with bracket-notation parameters, e.g. `claude-opus-5[effort=high,context=300k]` or `composer-2`, `gpt-5.6-sol`. Source: https://cursor.com/docs/subagents

**Per-agent (Agents Window) model selection**: implied by Best-of-N ("runs the same task in parallel across multiple models") but a general settable "model per agent tab" control beyond Best-of-N is **Not documented as of 2026-08** on the pages fetched.

## 5. Context management

**Context window sizes per model**: **not tabulated in official docs** fetched (models-and-pricing page lists pricing but not context-window figures) — Not documented as of 2026-08 in a single authoritative table. https://cursor.com/docs/models-and-pricing

Community/forum reports **contradict** any assumption of a flat number and show real confusion: users reported Claude 4.x models "stuck at 200k context window size when they should be showing 1M" (forum, Apr 1, 2026); Cursor moderator "deanrie" clarified "200k is the default for Claude 4.6 models without MAX mode," and that 1M context requires enabling MAX mode, itself gated to the Ultra plan. Source: https://forum.cursor.com/t/claude-models-stuck-at-200k-context-window-size/156424. Further bug reports (May 12, 2026: MAX mode showing 300K instead of 1M; Jul 30, 2026: CLI flag issues blocking 1M selection) show this remains an ongoing pain point through mid-2026. Same source thread and: https://forum.cursor.com/t/max-mode-shows-300k-context-limit-instead-of-1m-for-all-models-opus-4-6-sonnet-4-5-etc/160371 (title only, not fetched in full — flag as unverified detail).

**@-mentions**: documented at https://cursor.com/docs/agent/prompting. Supported mention targets: **Files & Folders** (`@auth.ts`, `@src/components/`), **Terminals** (`@Terminals`), **Previous Conversations** (`@Chats`), **Version control / git** (`@Commit (Diff of Working State)` for uncommitted changes or branch diffs), **Browser** (`@Browser`). Guidance given: "Use @ mentions when you know which files are relevant. If you're not sure which files matter, skip it — Agent finds relevant files through its own search." Source: https://cursor.com/docs/agent/prompting. (Note: explicit `@docs` and `@web` mention types referenced in the task prompt were not confirmed on this fetched page — Not documented as of 2026-08 from the sources checked; may exist but wasn't surfaced.)

**Automatic compaction/summarization**: "When the window gets close to full, Cursor compresses older parts of the conversation into a summary to leave more room for new conversation." Source: https://cursor.com/docs/agent/prompting. CLI equivalent: `/summarize` replaced `/compress` as of the May 20, 2026 CLI release; `/context` (added Jun 9, 2026 CLI release) "visualizes token consumption." Source: https://cursor.com/docs/cli/changelog. Hooks expose a `preCompact` event for hooking into this behavior. Source: https://cursor.com/docs/hooks

**Context usage visibility**: a ring/indicator shows total tokens used, "split by category" — "system prompts, tools, rules, skills, MCP connections, subagent documentation, summarized conversation, and active dialogue." Source: https://cursor.com/docs/agent/prompting

**Codebase indexing / semantic search**: Cursor's primary documented mechanism is actually literal/regex search first — "Instant Grep" — described as "the fastest way to find code," supporting "full regex and word-boundary matching" (e.g. `import.*PaymentService`). Semantic/embedding-based search is layered on: "Cursor creates embeddings without storing filenames or source code. Filenames are obfuscated and code chunks are encrypted." It "runs automatically; no configuration needed." Custom encryption keys can be set via a `.cursor/keys` file. No indexing size/document-count limits were documented on the fetched page. Source: https://cursor.com/docs/agent/tools/search

**Context-budget controls a plugin could use**: subagent `model` param supports an explicit `context=<N>` override, e.g. `claude-opus-5[effort=high,context=300k]` — this is the one documented, structured context-budget lever found. Source: https://cursor.com/docs/subagents

## 6. Cursor CLI (`cursor-agent` / `agent`)

Overview: https://cursor.com/docs/cli/overview ; full capability doc: https://cursor.com/docs/cli/using ; headless/CI doc: https://cursor.com/docs/cli/headless ; changelog: https://cursor.com/docs/cli/changelog

**Interactive mode**: `agent` launches a conversational session; `agent "refactor the auth module to use JWT tokens"` starts with an initial prompt. "Start a conversational session with the agent to describe your goals, review proposed changes, and approve commands." Source: https://cursor.com/docs/cli/overview

**Non-interactive / print mode**: `-p`/`--print` — e.g. `agent -p "find and fix performance issues" --model "gpt-5"`. Headless doc: "Use print mode (`-p, --print`) for non-interactive scripting and automation." File changes are NOT applied unless combined with `--force` (alias `--yolo`): "Combine `--print` with `--force` (or `--yolo`) to modify files in scripts." Source: https://cursor.com/docs/cli/headless

**Output formats** (`--output-format`): `text` ("clean, final-answer-only responses"), `json` ("structured analysis" / "structured output that's easier to parse in scripts"), and `stream-json` ("message-level progress tracking," with `--stream-partial-output` for incremental delta streaming). stream-json emits typed events (`system`, `assistant`, `tool_call`, `result`) parseable with `jq` for CI pipelines. Source: https://cursor.com/docs/cli/headless, https://cursor.com/docs/cli/using

**Modes**: `Agent` (default, full tool access), `Plan` (`Shift+Tab`, `/plan`, or `--plan`), `Ask` (read-only, `/ask` or `--mode=ask`). Source: https://cursor.com/docs/cli/using

**Worktrees**: `-w`/`--worktree [name]` creates isolated worktrees at `~/.cursor/worktrees/<reponame>/<name>`; `--workspace <path>` sets repo root. Multi-root session launch via `--add-dir` (added Jun 29, 2026). Source: https://cursor.com/docs/cli/using, https://cursor.com/docs/cli/changelog

**Cloud handoff**: prepend `&` to a prompt to push the conversation to a Cloud Agent, e.g. `& refactor the auth module and add comprehensive tests`. Source: https://cursor.com/docs/cli/overview

**Session management**: `agent ls`, `agent resume`, `agent --resume="chat-id-here"`, `--continue`/`/resume`. `/fork` branches a conversation (added Jun 9, 2026). Source: https://cursor.com/docs/cli/overview, https://cursor.com/docs/cli/changelog

**Sandbox**: `/sandbox` or `--sandbox <mode>` toggles execution sandboxing. Secure sudo: "Your password flows directly to `sudo` via a secure IPC channel; the AI model never sees it." Source: https://cursor.com/docs/cli/overview

**Rules/skills/plugins/hooks in CLI**: Rules from `.cursor/rules`, plus `AGENTS.md` and `CLAUDE.md` at project root, are "automatically loaded and applied," mirroring editor behavior. Skills "load in interactive, headless, and editor modes" (per May 7, 2026 changelog entry) and are discovered from nested directories ("Nested rules and skills discovered everywhere," May 14, 2026). Local plugins load via `~/.cursor/settings.json` (May 20, 2026); "Plugin marketplaces by git URL" (May 7, 2026); a script marketplace is manageable via CLI commands and `/usage` shows plan spend (Jul 13, 2026). Hooks: "Hooks for session lifecycle events" shipped Jan 2026 CLI release. Sources: https://cursor.com/docs/cli/using, https://cursor.com/docs/cli/changelog

**MCP in CLI**: MCP servers auto-detected from `mcp.json`; `/mcp list` pager (Jan 2026); MCP management redesigned with per-server detail views (May 14, 2026); MCP tools refresh in-session immediately (May 20, 2026); improved MCP login for known hosts (Aug 11, 2026). Source: https://cursor.com/docs/cli/using, https://cursor.com/docs/cli/changelog

**ACP (Agent Client Protocol)**: `agent acp` exposes a JSON-RPC 2.0 interface over stdio ("newline-delimited JSON (one message per line)"), for "building custom clients and integrations" — used by JetBrains IDEs, Neovim (avante.nvim), Zed, and custom editors. Session lifecycle via `session/new` / `session/load`; modes `agent`/`plan`/`ask`; permission gating via `session/request_permission` notifications. This is the primary scriptable automation surface beyond print mode. Source: https://cursor.com/docs/cli/acp

**Recent CLI-specific capability additions relevant to orchestration** (from changelog, see §10 for full dated list): durable goals (`/goal`), steering a running turn then interrupting via Enter, subagents surviving transient network failures (Jul 13, 2026), subagents executing locally in parallel (Mar 2026), `--trust` for interactive sessions (Jul 20, 2026).

Overall: the CLI is explicitly scriptable for automation via `-p`/`--force`/`--output-format json|stream-json`, environment-variable auth (`CURSOR_API_KEY`), and CI install one-liners (`curl https://cursor.com/install -fsS | bash`; PowerShell `irm 'https://cursor.com/install?win32=true' | iex`). Source: https://cursor.com/docs/cli/headless

## 7. Code review features

Two distinct systems exist: **Bugbot** (PR-focused, cross-platform) and **Agent Review** (local/pre-commit).

**Bugbot** (https://cursor.com/docs/bugbot): "analyzes PR diffs and leaves comments with explanations and fix suggestions." Runs on GitHub, GitLab, Bitbucket, Azure DevOps. Triggers: automatic ("runs automatically on each PR update"), manual comment triggers (`cursor review` or `bugbot run` on a PR), API (`POST /bugbot/review`), or in-editor via the `/review-bugbot` skill/agent command, which "review[s] your branch changes: every change relative to the base branch, including committed and uncommitted changes."

Configurability: repo-level enable/disable, reviewer allow/deny lists, "run once per PR, skipping subsequent commits"; personal-level "run only when mentioned," draft-PR reviews; advanced — team-wide rules, project `.cursor/BUGBOT.md` files, learned rules from team activity, manual custom rules with glob scoping, and effort levels (Default/High/Custom).

**API/programmatic access**: Bugbot API supports triggering reviews with a dry-run option, per-review analytics (findings count, resolution status), and admin endpoints for repo/user management. Rate limits documented: combined rules capped at "100,000 characters," individual rules truncated at "30,000 characters," dry-run requests limited to "10 per minute per team," normal review requests limited to "30 per minute per team." Source: https://cursor.com/docs/bugbot — meaning a plugin CAN invoke Bugbot programmatically via `POST /bugbot/review`, subject to those per-team rate caps.

**Agent Review** (https://cursor.com/docs/agent/agent-review): "runs a dedicated code review on your local changes from inside Cursor." Modes: automatic ("runs after every commit is made" if enabled), manual `/agent-review` in the agent window, or via Source Control tab ("compare all local changes against your main branch"). Two review depths — **Quick** (fast/low-cost, for "small diffs, formatting changes, or a fast sanity check") and **Deep** (slow/high-cost, for "complex logic, security-sensitive code, or large refactors"). Reads repo `BUGBOT.md` rule files for custom criteria. Settings location is moving "from Agents to Git & PRs section in version 3.11."

## 8. Terminal / tool surface

Core agent tools (from https://cursor.com/docs/agent/overview): file search ("Search for files by name, read directory structures, and find exact keywords or patterns within files"), web search ("Generate search queries and perform web searches"), file reading (including images: .png/.jpg/.gif/.webp/.svg), file editing ("Suggest edits to files and apply them automatically"), terminal ("Execute terminal commands and monitor output"), browser control ("Control a browser to take screenshots, test applications, and verify visual changes"), and image generation ("Generate images from text descriptions or reference images"). Shortcuts: `Cmd+I`/`Ctrl+I` opens agent; `Cmd+Enter`/`Ctrl+Enter` sends immediately; `Enter` queues; `Cmd/Ctrl+Shift+P` opens Command Palette (also the entry point for the Agents Window per the 3.0 changelog). Source: https://cursor.com/docs/agent/overview, https://cursor.com/changelog/3-0

**Search/indexing tool detail**: "Instant Grep" (regex/word-boundary literal search) plus automatic, zero-config embedding-based semantic search with obfuscated filenames and encrypted code chunks. Source: https://cursor.com/docs/agent/tools/search

**Built-in browser automation / screenshots**: **Design Mode** (`Cmd/Ctrl+Shift+D` in the Agents Window browser) — click an element, draw annotations, or narrate by voice. On element selection the agent receives "Element identity: the xpath, the component, attributes, computed styles, and props from the fiber tree" plus "a screenshot: the layout, surrounding elements, and the exact page state." Additional gestures: `Shift+drag` to select an area, `Cmd/Ctrl+L` to add a selected element to chat, `Option/Alt+click` for input. Source: https://cursor.com/docs/agent/design-mode, https://cursor.com/changelog/3-0. Cloud Agent settings also reference a "computer use" capability for Team plans (name only, no detail given) — Source: https://cursor.com/docs/cloud-agent/settings (Not documented in further detail as of 2026-08).

**MCP tool integration**: three transports — stdio (local, single user), SSE (local/remote, multi-user), Streamable HTTP (local/remote, multi-user). Config via `mcp.json` (`mcpServers` map with `command`/`args`/`env`, or `url`/`headers` for remote). "Cursor asks for approval before using MCP tools by default." MCP tool calls follow the same Run Modes as terminal commands; in Auto-review mode "allowlisted MCP tools run immediately and everything else is routed through the classifier." Enterprise admins get an MCP Allowlist to approve servers/tools by pattern. Source: https://cursor.com/docs/mcp

**Hooks give programmatic control over the tool surface** (see §2/§6 context) — `preToolUse`/`postToolUse`/`postToolUseFailure`, `beforeShellExecution`/`afterShellExecution`, `beforeMCPExecution`/`afterMCPExecution`, `beforeReadFile`/`afterFileEdit`, `subagentStart`/`subagentStop`, `beforeSubmitPrompt`, `preCompact`, `stop`, `sessionStart`/`sessionEnd`, plus Tab-specific hooks (`beforeTabFileRead`, `afterTabFileEdit`) and `workspaceOpen`. Command hooks are spawned processes exchanging JSON over stdio; exit code 0 = use JSON output, exit code 2 = block the action, other codes = fail-open. Cloud agents only run command-based hooks from `.cursor/hooks.json` — prompt-based hooks and several lifecycle hooks (sessionStart, sessionEnd, beforeMCPExecution, beforeTabFileRead, workspaceOpen) are unavailable in cloud environments. Source: https://cursor.com/docs/hooks

## 9. Limits and pricing mechanics

**Usage model**: two pools — "Cursor Models" (Grok 4.6/4.5, Composer 2.5, "generous included usage," no disclosed numeric cap) vs "Other Models" (billed at per-token API rates; Teams/Enterprise add a flat "$0.25 per million tokens" Cursor Token Rate on top). Plan-level included third-party spend: Pro "$20," Pro Plus "$70," Ultra "$400" (plus unlimited/generous Cursor-model usage on all paid tiers); a India-specific "Start" plan offers Cursor Models only. Source: https://cursor.com/docs/models-and-pricing

**Rate limits — request-level**: **not specified in the pricing docs page fetched** — Not documented as of 2026-08 in that source.

**Concurrent cloud agents**: **8 simultaneous agents on Pro**, per Cursor staff ("Colin," forum, Mar 9, 2026: "It's 8, and this limit has been around since October!"); Pro+/Ultra get unspecified "generous increases." This number appears **only in a forum post, not in official docs** (https://cursor.com/docs/cloud-agent/settings and https://cursor.com/docs/cloud-agent/best-practices both omit it). Source: https://forum.cursor.com/t/cloud-agents-simultaneous-limit-what-are-the-actual-numbers-per-plan/154013. Treat as a documented-vs-community contradiction: the product surface has a real, enforced cap that Cursor does not publish in its docs.

**Bugbot API rate limits** (one of the few hard numeric limits actually in official docs): dry-run "10 per minute per team," normal reviews "30 per minute per team," rule text capped at 100,000 characters combined / 30,000 per rule. Source: https://cursor.com/docs/bugbot

**Timeouts on long runs / session length**: Not documented as of 2026-08 for Cloud Agents (checked https://cursor.com/docs/cloud-agent, /setup, /settings, /best-practices — none give numeric timeout or max-duration figures). One related toggle: "Long-running is not available for multi-repo environments yet." Source: https://cursor.com/docs/cloud-agent/settings. CLI hook `timeout` values are configurable per-hook (example in docs: `"timeout": 30` seconds) but that governs hook scripts, not overall agent sessions. Source: https://cursor.com/docs/hooks

**Context-window discrepancies affecting heavy use**: community reports (see §5) show MAX-mode/1M-context gating tied to plan tier (Ultra) and repeated bugs where advertised 1M windows silently fell back to 200K–300K — a real operational risk for anyone budgeting context for heavy agent use. Source: https://forum.cursor.com/t/claude-models-stuck-at-200k-context-window-size/156424

**AIUC-1 certification**: "Cursor earns AIUC-1 certification for agent security and reliability" (Aug 13, 2026) — relevant to enterprise risk/compliance framing around heavy agent use, though it is a certification announcement, not a technical limit. Source: https://cursor.com/blog/aiuc-1

## 10. Recent releases (last ~4 months, Apr–Aug 2026)

From https://cursor.com/changelog and https://cursor.com/blog:

- **Aug 19, 2026** — *Cloud Agents and Cursor Harness Improvements*: "Cloud agents can automatically pick up work in response to events, hold a goal until it's met, and stay on course." https://cursor.com/changelog (Aug 19, 2026 entry) / https://cursor.com/changelog/08-19-26
- **Aug 18, 2026** — *Git at any scale* (Victor Martí): https://cursor.com/blog/git-at-any-scale
- **Aug 17, 2026** — *Origin Code Hosting*: "Cursor can now host your code" — repos, pull requests, code browsing, GitHub sync. https://cursor.com/changelog/origin-code-hosting
- **Aug 14, 2026** — *Cursor is now a part of SpaceX*. https://cursor.com/blog/joining-spacex
- **Aug 13, 2026** — *Firetiger joins Cursor* (Maxime Prades). https://cursor.com/blog/firetiger
- **Aug 13, 2026** — *Cursor earns AIUC-1 certification for agent security and reliability* (Kenneth Moras). https://cursor.com/blog/aiuc-1
- **Aug 13, 2026** — *Cloud agents start 3x faster with builds*: "3x faster time to first token." https://cursor.com/blog/builds
- **Aug 12, 2026** — *Introducing Grok 4.6*. https://cursor.com/blog/grok-4-6
- **Aug 11, 2026** — CLI: steer-then-interrupt a running turn via Enter; single-turn runs wait for subagents; durable goals via `/goal`; sticky skills; inline image previews; improved MCP login for known hosts; hardened git commands during agent operations. https://cursor.com/docs/cli/changelog
- **Aug 6, 2026** — *How Cursor Router chooses the right model for the task* (Connor & Yuri): Compass complexity scoring + domain/task/modifier taxonomy; "Auto Intelligence: Fable-level satisfaction at 68% lower cost"; "Auto Balance: outperforms Opus 4.8 at 41% lower cost." https://cursor.com/blog/how-cursor-router-works
- **Aug 4, 2026** — *Mixture-of-Kittens*: open-source MoE megakernel for NVL72s (Stuart, Nash, Henry, William & Federico). https://cursor.com/blog/mixture-of-kittens
- **Aug 3, 2026** — *Google Workspace Plugins*: "Cursor can now read, write, and act across your Google Workspace" (Gmail, Drive, Calendar). https://cursor.com/changelog (Aug 3, 2026 entry)
- **Jul 30, 2026** — *How we set up our cloud agent environment* (Mathew & Arvind). https://cursor.com/blog/cloud-agent-environment
- **Jul 29, 2026** — *Cursor, now on iPad*: full PR review surface, improved layout, inbox organization, paid plans only. https://cursor.com/changelog (Jul 29, 2026 entry)
- **Jul 28, 2026** — *Introducing Cursor Start* (India-focused plan). https://cursor.com/blog/cursor-start-india
- **Jul 22, 2026** — *Introducing Cursor Router*. https://cursor.com/blog/router
- **Jul 20, 2026** — *Agent swarms and the new model economics* (Wilson Lin): planner/worker hierarchy, cost comparison ($1,339 hybrid vs $10,565 single-frontier-model rebuild of SQLite), coordination failure modes (split-brain duplication, planner contention, merge conflicts, "megafiles," code ossification). https://cursor.com/blog/agent-swarm-model-economics
- **Jul 20, 2026 (CLI)** — `--trust` works in interactive sessions; model catalog refreshes every 10 min in background; fixed CPU spin from branch watcher; improved markdown-table rendering with emoji/CJK. https://cursor.com/docs/cli/changelog
- **Jul 13, 2026 (CLI)** — script marketplace management via CLI; `/usage` shows plan spend; fixed Max Mode sticking unintentionally; auto-accept web-search permission; subagents survive transient network failures. https://cursor.com/docs/cli/changelog
- **Jul 6, 2026 (CLI)** — new installs default to Auto model routing; model shortcuts (`/opus`, `/composer`); cross-workspace chat resume by default; QR-code SSH login. https://cursor.com/docs/cli/changelog
- **Jun 29, 2026 (CLI)** — multi-root sessions via `--add-dir`; cloud transfers preserve model/workspace context; unencrypted credential storage option for sandboxed environments. https://cursor.com/docs/cli/changelog
- **Jun 22, 2026 (CLI)** — Auto-review run mode ("middle ground between Allowlist and Run Everything"); named multi-directory workspaces; `/rewind` enabled by default. https://cursor.com/docs/cli/changelog
- **Jun 12, 2026** — Cloud Agents bug fix: idle/completed agents no longer incorrectly counted against concurrent limit (per staff forum reply). https://forum.cursor.com/t/cloud-agents-simultaneous-limit-what-are-the-actual-numbers-per-plan/154013
- **Jun 9, 2026 (CLI)** — borderless file-edit rendering; `/fork` branches conversations; `/context` visualizes token consumption; faster resume picker; HTTP/2 keepalive stall detection. https://cursor.com/docs/cli/changelog
- **May 20, 2026 (CLI)** — Composer 2.5 becomes default model; `/summarize` replaces `/compress`; local plugins via `~/.cursor/settings.json`; MCP tools refresh in-session immediately. https://cursor.com/docs/cli/changelog
- **May 14, 2026 (CLI)** — Vim visual mode; `Ctrl+G` opens prompt in `$EDITOR`; redesigned MCP management with per-server views; nested rules/skills discovery everywhere. https://cursor.com/docs/cli/changelog
- **May 7, 2026 (CLI)** — plugin marketplaces by git URL; `Ctrl+L` clears screen; skills load in interactive, headless, and editor modes; Linux clipboard image paste. https://cursor.com/docs/cli/changelog
- **Apr 2, 2026** — **Cursor 3.0**: new Agents Window (parallel agents across local/worktree/cloud/remote-SSH), `/worktree`, `/best-of-n`, Design Mode (`Cmd/Ctrl+Shift+D`), Agent Tabs (grid/side-by-side chats); deprecates prior worktree selector; removes cloud agents from the Editor; improves diff rendering, job monitoring, browser automation. https://cursor.com/changelog/3-0
- **Apr 2026 (CLI)** — `/rewind` interactive-timeline turn undo; desktop notifications across terminal emulators; interactive `/config` replaces hand-edited JSON; `/btw` side questions. https://cursor.com/docs/cli/changelog

Earlier 2026 CLI milestones for context (outside the 4-month window but load-bearing for §1/§6): March 2026 — "Subagents execute locally in parallel," Run Everything split into its own toggle, plugins marketplace integration, default stream retries. February 2026 — git worktree support via `--worktree`, `--yolo` autonomous mode, AWS Bedrock personal credentials, unified `/changes` review UI. January 2026 — session-lifecycle hooks, locked-socket sudo password support, Plan/Ask modes, Cloud Agent handoff via `&`, `/mcp list` pager. Source: https://cursor.com/docs/cli/changelog
