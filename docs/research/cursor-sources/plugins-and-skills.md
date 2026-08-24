# Cursor Extensibility System (Plugins, Skills, Subagents, Commands, Rules, MCP) — as of 2026-08-23

Version context: Cursor's plugin system launched in **Cursor 2.5** (March 4, 2026, "Plugins, Sandbox Access Controls, and Async Subagents") — https://cursor.com/changelog/2-5. Team marketplaces shipped in **2.6** (March 3, 2026). A unified **Customize page** (managing plugins/skills/MCP/subagents/rules/commands/hooks at user, team, or workspace scope, plus a popularity leaderboard, shareable "plugin canvases", and GitLab/BitBucket/Azure DevOps marketplace imports) shipped in **Cursor 3.9** (June 22, 2026) — https://cursor.com/changelog/customize, corroborated at https://dev.classmethod.jp/en/articles/cursor-customize-integrated-management/. Forum posts from early August 2026 reference Cursor **v3.14.7**, so that is roughly the live version as this doc was written — https://forum.cursor.com/t/add-plugin-github-imports-can-get-stuck-on-stale-plugin-versions/163895.

## 1. Plugin formats

Cursor recognizes two manifest formats, both discoverable through the same install flow. "Agent Plugins and Cursor Plugins use the same installation flow." Source: https://cursor.com/help/customization/plugins

### Agent Plugins (open standard, root `plugin.json`)

Conforms to the **agent-plugins.org** open standard (spec v1.0.0), not Cursor-specific. Per https://cursor.com/docs/plugins: Agent Plugins package "skills and MCP servers" — that is the ceiling of what the open standard covers (no rules/agents/commands/hooks).

Directory structure (agent-plugins.org spec, https://agent-plugins.org/ and https://cursor.com/docs/reference/plugins):
```
my-plugin/
├── plugin.json
├── skills/
│   └── summarize/
│       ├── SKILL.md
│       ├── scripts/
│       └── references/
├── mcp.json
└── com.example.client/
    └── hooks/
```
"Extension namespaces": "Reverse-domain extension namespaces let individual clients add behavior without changing the portable core" — i.e. a client like Cursor can drop client-specific files (e.g. hooks) into a `com.cursor.*`-style folder without breaking portability for other agent runtimes. Source: https://agent-plugins.org/

Example manifest (from Cursor's docs, showing the schema pointer used to mark a plugin as Agent-Plugins-conformant):
```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-plugin",
  "description": "Portable code review tools",
  "version": "1.0.0",
  "author": { "name": "Your Name" }
}
```
Source: https://cursor.com/docs/plugins. The full JSON Schema is only linked, not inlined, by Cursor's docs: "agent-plugins.org/specification or the JSON Schemas at agent-plugins.org/schemas" — not independently verified line-by-line in this pass.

### Cursor Plugins (`.cursor-plugin/plugin.json`)

Cursor's own superset format. Manifest lives in a subdirectory, not the repo root: `.cursor-plugin/plugin.json`. This unlocks Cursor-only components: **rules, agents (subagents), commands, hooks**, in addition to skills and MCP. Source: https://cursor.com/docs/plugins, https://cursor.com/docs/reference/plugins

Directory structure:
```
my-plugin/
├── .cursor-plugin/
│   └── plugin.json
├── skills/
│   └── skill-name/
│       └── SKILL.md
├── rules/
│   └── rule-name.mdc
├── agents/
│   └── agent-name.md
├── commands/
│   └── command-name.md
├── hooks/
│   └── hooks.json
└── mcp.json
```
Source: https://cursor.com/docs/reference/plugins

**Component table** (verbatim descriptions), source https://cursor.com/docs/plugins:

| Component | Cursor-only? | Purpose (quoted) |
|-----------|------|---------|
| Rules | yes | "Persistent AI guidance and coding standards (.mdc files)" |
| Skills | no | "Specialized agent capabilities for complex tasks" |
| Agents | yes | "Custom agent configurations and prompts" |
| Commands | yes | "Agent-executable command files" |
| MCP Servers | no | "Model Context Protocol integrations" |
| Hooks | yes | "Automation scripts triggered by events" |

### `plugin.json` field reference (Cursor Plugin format)

Required:
- `name` (string) — "Plugin identifier. Lowercase, kebab-case (alphanumerics, hyphens, and periods). Must start and end with an alphanumeric character."

Optional metadata: `description`, `version` (semver), `author` (`{name, email}` object), `homepage`, `repository`, `license`, `keywords` (array), `logo`.

Optional component-path fields:

| Field | Type | Purpose (quoted) |
|-------|------|---------|
| `rules` | string or array | "Path(s) to rule files or directories" |
| `agents` | string or array | "Path(s) to agent files or directories" |
| `skills` | string or array | "Path(s) to skill directories" |
| `commands` | string or array | "Path(s) to command files or directories" |
| `hooks` | string or object | "Path to hooks config file, or inline hook config" |
| `mcpServers` | string, object, or array | "Path to MCP config file, inline MCP server config, or an array" |
| `variables` | object | JSON Schema declaring variable names for user configuration |

Note the `agents` field: since a plugin manifest can point at an `agents/` path, **plugins can ship subagent definitions** in the Cursor Plugin format (see §3). Source: https://cursor.com/docs/reference/plugins

**Component auto-discovery** — if a manifest field is omitted, Cursor still scans default paths:
- Skills: `skills/` — "Each subdirectory containing a `SKILL.md` file"
- Rules: `rules/` — "All `.md`, `.mdc`, or `.markdown` files"
- Agents: `agents/` — "All `.md`, `.mdc`, or `.markdown` files"
- Commands: `commands/` — "All `.md`, `.mdc`, `.markdown`, or `.txt` files"
- Hooks: `hooks/hooks.json`
- MCP Servers: `mcp.json`
Source: https://cursor.com/docs/reference/plugins

**`variables` field** — top level must be `{"type": "object", "properties": {...}}`. "Only a fixed set of JSON Schema keywords is accepted (`type`, `title`, `description`, `default`, `enum`, `const`, `properties`, `required`, `items`, and common length/numeric constraints)." Values are set by users in the dashboard and referenced in config files as `${VAR}`. Example:
```json
{
  "name": "example-plugin",
  "variables": {
    "type": "object",
    "properties": {
      "API_TOKEN": {
        "type": "string",
        "title": "API token",
        "description": "Bearer token for the example HTTP MCP"
      }
    },
    "required": ["API_TOKEN"]
  }
}
```
Source: https://cursor.com/docs/reference/plugins

### Multi-plugin repos (marketplace manifest)

A repo can host many plugins at once via `.cursor-plugin/marketplace.json` at the repo root:
```json
{
  "name": "marketplace-identifier",
  "owner": { "name": "required", "email": "optional" },
  "plugins": [{ "name": "required", "source": "path" }],
  "metadata": { "description": "optional", "version": "optional" }
}
```
Plugin entries in this array support all individual `plugin.json` fields plus `category` and `tags`. Documented limit: `"plugins": array (max 500)`. Source: https://cursor.com/docs/reference/plugins

The official `cursor/plugins` repo is itself structured this way:
```
plugins/
├── .cursor-plugin/
│   └── marketplace.json       # Marketplace manifest (lists all plugins)
├── plugin-name/
│   ├── .cursor-plugin/
│   │   └── plugin.json        # Per-plugin manifest
│   ├── skills/                # Agent skills (SKILL.md with frontmatter)
│   ├── rules/                 # Cursor rules (.mdc files)
│   ├── mcp.json               # MCP server definitions
│   ├── README.md
│   ├── CHANGELOG.md
│   └── LICENSE
```
"This is a multi-plugin marketplace repository. The root `.cursor-plugin/marketplace.json` lists all plugins, and each plugin has its own manifest." Source: https://github.com/cursor/plugins/blob/main/README.md

### Local dev / testing

Load an unpublished plugin from `~/.cursor/plugins/local/my-plugin` (then run **Developer: Reload Window**), or symlink for fast iteration: `ln -s /path/to/my-plugin ~/.cursor/plugins/local/my-plugin`. Source: https://cursor.com/docs/plugins. Cursor staff also recommend this local-plugin path as the **workaround** for the `/add-plugin <github-url>` stale-version bug (§8): "install the plugin as a local development plugin by cloning it locally and using `~/.cursor/plugins/local/<plugin-name>`." Source: https://forum.cursor.com/t/add-plugin-github-imports-can-get-stuck-on-stale-plugin-versions/163895

## 2. Skills

Skills are "reusable sets of instructions that teach Agent how to handle specific tasks. They're more detailed than rules and designed for multi-step workflows." Source: https://cursor.com/docs/skills (also mirrored at https://cursor.com/docs/context/commands per a stale WebFetch cache — the canonical URL is `/docs/skills`).

### SKILL.md frontmatter fields

| Field | Required | Purpose (quoted) |
|-------|----------|---------|
| `name` | Yes | "Skill identifier. Lowercase letters, numbers, and hyphens only. Must match the parent folder name." |
| `description` | Yes | "Describes what the skill does and when to use it. Used by the agent to determine relevance." |
| `paths` | No | "Glob patterns that scope the skill to matching files." Accepts comma-separated strings or lists. |
| `disable-model-invocation` | No | When `true`, "the skill is only included when explicitly invoked via `/skill-name`." |
| `icon` | No | "Icon shown on the badge when the skill is used as a Custom Mode. Defaults to a lightning icon." |
| `color` | No | "Badge color when the skill is used as a Custom Mode. One of `default`, `green`, `cyan`, `blue`, `purple`, `magenta`, `orange`, `yellow`, `red`, or `brand`." |
| `metadata` | No | "Arbitrary key-value mapping for additional metadata." |
Source: https://cursor.com/docs/skills

A bare-minimum skill needs no frontmatter at all beyond a plain markdown body under `.cursor/skills/<name>/SKILL.md`:
```
# Deploy to staging
1. Run the test suite
2. Build the production bundle
3. Deploy to the staging environment
4. Verify the deployment health check
```
Source: https://cursor.com/docs/skills. Creation shortcut: type `/create-skill` in chat and Cursor's built-in skill walks you through naming/structuring/saving.

### Discovery / triggering

**Auto-discovery locations** (walked recursively): `.agents/skills/`, `.cursor/skills/`, `~/.agents/skills/` (global), `~/.cursor/skills/` (global), plus nested project subdirectories (e.g. `apps/web/.cursor/skills/` in a monorepo — those are auto-scoped to files under `apps/web/`, "similar to the `paths` frontmatter field"). For cross-tool compatibility Cursor **also** auto-loads from Claude's and Codex's skill directories: `.claude/skills/`, `.codex/skills/`, `~/.claude/skills/`, `~/.codex/skills/`. Source: https://cursor.com/docs/skills

Triggering is **not** a hard-coded "Skill tool" call in the traditional sense but rather description-based relevance: "Automatic: Agent determines relevance based on context" using the `description` field, plus:
- Manual: typing `/` in Agent chat and searching for the skill name (or `/skill-name` directly)
- Session Mode: use a skill as a Custom Mode via `Option+Enter` (Mac) / `Alt+Enter` (Windows)
- `disable-model-invocation: true` forces manual-only invocation
Source: https://cursor.com/docs/skills

There is a Settings toggle in the IDE ("Rule, Skills and Subagents") to disable loading from the Claude/Codex compatibility paths — but this toggle **does not apply to `cursor-agent` (CLI)**. Source: https://forum.cursor.com/t/toggle-or-allowlist-for-agent-skills-roots-stop-loading-claude-skills-and-codex-skills-when-i-only-want-cursor-agents/160199

### Structure, progressive disclosure, limits

Optional subdirectories inside a skill folder:
```
skill-name/
├── SKILL.md
├── scripts/        # "Executable code that agents can run"
├── references/     # "Additional documentation loaded on demand"
└── assets/         # "Static resources like templates, images, or data files"
```
"Agents load resources progressively—only when needed" — i.e. `references/` content is not force-loaded into context, matching Claude Code's progressive-disclosure model. Source: https://cursor.com/docs/skills

Nesting: "Cursor walks the skills root recursively and picks up any `SKILL.md` it finds," and category folders can be used purely for grouping (the skill's identity comes from its immediate parent folder, not any ancestor category folder). Source: https://cursor.com/docs/skills

**Limits**: no documented cap on skill count, file size, or nesting depth — **Not documented as of 2026-08**. In practice, users report "excessive skill loading causing context bloat" from the many compatibility-path skill roots, with no CLI-side allowlist; a community bash-wrapper workaround using Linux namespaces exists but "requires Linux and specific kernel features." Source: https://forum.cursor.com/t/toggle-or-allowlist-for-agent-skills-roots-stop-loading-claude-skills-and-codex-skills-when-i-only-want-cursor-agents/160199

## 3. Subagents / custom agents

Yes — Cursor supports named subagents with their own model, tool restrictions, and prompt.

### File location and format

Storage locations: project-level `.cursor/agents/`, `.claude/agents/`, `.codex/agents/`; user-level `~/.cursor/agents/`, `~/.claude/agents/`, `~/.codex/agents/`. "Project subagents take precedence when names conflict." Each subagent is "a markdown file with YAML frontmatter" followed by the prompt body. Source: https://cursor.com/docs/subagents

### Frontmatter fields

| Field | Type | Default |
|-------|------|---------|
| `name` | string | Derived from filename |
| `description` | string | — |
| `model` | string | `inherit` |
| `readonly` | boolean | `false` |
| `is_background` | boolean | `false` |

`model` accepts `inherit` or a specific model ID (e.g. `composer-2`, `gpt-5.6-sol`), with parameters appendable in brackets: `claude-opus-5[effort=high,context=300k]`. Source: https://cursor.com/docs/subagents

Built-in subagents ship out of the box: **Explore, Bash, and Browser**. Source: corroborated in a sibling internal doc (`cursor-c-runtime.md`, https://cursor.com/docs/subagents).

### Plugin shipping

The Cursor Plugin manifest's `agents` field ("Path(s) to agent files or directories") and the `agents/` auto-discovery path mean **a plugin can ship subagent definitions** as part of a Cursor Plugin (this component is explicitly marked Cursor-only in the plugin component table — not part of the portable Agent Plugins standard). Source: https://cursor.com/docs/reference/plugins, https://cursor.com/docs/plugins. The dedicated subagents doc page itself does not separately confirm plugin distribution — cross-referenced from the manifest reference instead.

### Dispatch and parallelism

Dispatch:
- Explicit: `/name` syntax, or natural mention ("Use the verifier subagent to confirm...")
- Automatic delegation: "Agent proactively delegates tasks based on: The task complexity and scope, Custom subagent descriptions in your project, Current context and available tools."
Source: https://cursor.com/docs/subagents

Parallel execution: yes. "Launch multiple subagents concurrently for maximum throughput." Mechanism: "Agent sends multiple **Task tool** calls in a single message, so subagents run simultaneously." This is Cursor's closest equivalent to Claude Code's `Task`/`Agent` tool — a tool literally named **Task**. Source: https://cursor.com/docs/subagents

Nesting is capped one level deep: "The main agent and its direct subagents can launch subagents, but a subagent launched by another subagent can't launch further ones." Cost scales roughly linearly with parallel count: "Running five subagents in parallel uses roughly five times the tokens of a single agent." As of Cursor 2.5, subagents can also run **asynchronously** — "the parent can continue working while subagents run in the background" — and "Subagents can also spawn their own subagents, creating a tree of coordinated work" (this async/tree capability is described in the 2.5 changelog; read together with the subagents-doc nesting cap above, the practical rule is: direct children of the root agent may spawn subagents, but grandchildren may not spawn further). Sources: https://cursor.com/docs/subagents, https://cursor.com/changelog/2-5

Tools/capabilities: no separate tool-allowlist frontmatter field is documented; subagents "inherit all tools from the parent, including MCP tools from configured servers," constrained only by the `readonly` flag. Source: https://cursor.com/docs/subagents

## 4. Commands

Custom slash commands are plain markdown files, one command per file.

- **Location**: `.cursor/commands/` "for Cursor to make commands discoverable in the command prompt window." Source: https://mobisoftinfotech.com/resources/blog/ai-development/ai-workflow-automation-cursor-claude-commands (secondary source corroborating the official docs page, which a WebFetch pass returned only Skills content for — the commands reference lives at https://cursor.com/docs/context/commands per site search, but its content did not resolve distinctly from the Skills page in this research pass; treat command specifics below as **secondary-sourced, not independently confirmed against cursor.com verbatim**).
- **Format**: a markdown file per command (example: `commands/flutter-code-review.md`) containing command purpose, supported arguments, processing instructions, a report template, and checklist/rules as prose sections — no rigid required schema was found.
- **Argument passing**: referenced inside the command body via `` `$ARGUMENTS` ``, letting one command accept multiple flag-like tokens, e.g.:
  ```
  /flutter-code-review
  /flutter-code-review full
  /flutter-code-review save
  /flutter-code-review full save
  ```
- **Cross-tool design guidance**: "Write instructions in plain, explicit markdown" and "avoid tool-specific jargon" so the same command file works unmodified in both Cursor and Claude Code.

Per the plugin manifest reference (§1), Cursor Plugins can bundle commands via the `commands` field or the auto-discovered `commands/` directory, accepting `.md`, `.mdc`, `.markdown`, or `.txt` files, each with optional `name`/`description` frontmatter (same shape as agents/skills frontmatter). Source: https://cursor.com/docs/reference/plugins

A known bug: **"Local plugin not loading commands"** is an open forum bug-report thread title (https://forum.cursor.com/t/local-plugin-not-loading-commands/161008) — content not deep-dived in this pass, but the title alone corroborates that plugin-shipped commands have had discovery reliability issues, consistent with the broader skills/commands discovery bugs in §8.

Exact frontmatter field list and any `argument-hint`-style field: **Not documented as of 2026-08** in what could be directly verified this pass.

## 5. Rules

### `.mdc` files

Project rules require the `.mdc` extension — a plain `.md` file in `.cursor/rules` is ignored: *"A plain `.md` file in `.cursor/rules` is ignored by the rules system because it has no frontmatter to specify `description`, `globs`, and `alwaysApply`."* Source: https://cursor.com/docs/rules

Frontmatter fields: `alwaysApply` (boolean), `description` (string, used for agent relevance), `globs` (file path pattern(s)). Example:
```
---
description: "Standards for components and validation"
alwaysApply: false
globs: src/components/**/*.tsx
---
[rule content]
```
Source: https://cursor.com/docs/rules

### Four trigger modes

| Mode | Trigger | Frontmatter config |
|------|---------|---------------------|
| Always Apply | Every session | `alwaysApply: true` |
| Apply Intelligently | Agent's own decision | `alwaysApply: false` + `description` |
| Apply to Specific Files | File pattern match | `alwaysApply: false` + `globs` |
| Apply Manually | @-mention in chat | `alwaysApply: false`, no `description`/`globs` |

Behavior when `alwaysApply: true`: *"Globs and description are ignored."* With `alwaysApply: false` and `globs` set, rules auto-attach "when a matching file is in context." Source: https://cursor.com/docs/rules

Glob examples given: `**/*.ts`, `src/components/**/*.tsx`, `docs/**/*.md, docs/**/*.mdx`, `tailwind.config.*`.

Best practice guidance: keep rules "under 500 lines," and "Reference files instead of copying their contents—this keeps rules short and prevents them from becoming stale as code changes." Source: https://cursor.com/docs/rules

### AGENTS.md

`AGENTS.md` is a simpler alternative — plain markdown, no frontmatter — and supports nesting:
```
project/
  AGENTS.md              # Global
  frontend/
    AGENTS.md            # Frontend-specific
```
"Instructions from nested `AGENTS.md` files are combined with parent directories, with more specific instructions taking precedence." Source: https://cursor.com/docs/rules

### Precedence

"Rules are applied in this order: **Team Rules → Project Rules → User Rules**. All applicable rules are merged; earlier sources take precedence when guidance conflicts." Source: https://cursor.com/docs/rules

Precedence **between Rules and AGENTS.md specifically**, and between either and plugin-shipped rule content: **Not documented as of 2026-08** — the docs state the Team→Project→User order for rules and separately state nested-AGENTS.md specificity-wins, but do not state how AGENTS.md content is merged/ordered relative to `.mdc` rules or plugin-bundled rules in the same repo.

## 6. MCP

### `mcp.json` formats

Three server shapes are supported:

Local CLI server (Node):
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "mcp-server"],
      "env": { "API_KEY": "value" }
    }
  }
}
```
Local CLI server (Python):
```json
{
  "mcpServers": {
    "server-name": {
      "command": "python",
      "args": ["mcp-server.py"],
      "env": { "API_KEY": "value" }
    }
  }
}
```
Remote (HTTP/SSE):
```json
{
  "mcpServers": {
    "server-name": {
      "url": "http://localhost:3000/mcp",
      "headers": { "API_KEY": "value" }
    }
  }
}
```
Source: https://cursor.com/docs/mcp

STDIO server fields: `type` (yes, e.g. `"stdio"`), `command` (yes — "Must be available on your system path or contain its full path"), `args` (no), `env` (no), `envFile` (no — "only available for STDIO servers", i.e. not for remote/HTTP servers). Source: https://cursor.com/docs/mcp

### Scope

- Project: `.cursor/mcp.json` — "project-specific tools."
- Global: `~/.cursor/mcp.json` — "tools available everywhere."
Source: https://cursor.com/docs/mcp

As of the Cursor 3.9 Customize page, MCP servers can also be added/managed at **user, team, or workspace** level from one UI, alongside plugins/skills/subagents/rules/commands/hooks. Source: https://cursor.com/changelog/customize, https://dev.classmethod.jp/en/articles/cursor-customize-integrated-management/

### Plugin bundling

A plugin's `mcpServers` manifest field can be "Path to MCP config file, inline MCP server config, or an array." Source: https://cursor.com/docs/reference/plugins. Variables (`${VAR}` placeholders resolved from the `variables` schema, §1) let a bundled MCP server take user-supplied secrets like API tokens without hardcoding them in the plugin repo.

Team admins can distribute MCP servers org-wide via a **team marketplace** (a GitHub/GitLab/BitBucket/Azure DevOps repo import): servers then appear "alongside personal and workspace MCP servers." Source: https://cursor.com/help/customization/plugins (paraphrase preserved from original fetch), https://cursor.com/changelog/customize

### Limits

No explicit documented limits on number of servers, tools per server, or request/response sizes — **Not documented as of 2026-08**.

## 7. Distribution & install

### Marketplace

Official marketplace at https://cursor.com/marketplace. "Every plugin is open source and manually reviewed before it appears in the marketplace." Updates undergo re-review before publishing. Source: https://cursor.com/help/customization/plugins. Community plugins/MCP servers not in the official marketplace circulate via **cursor.directory**. Plugins "work across Cursor desktop, web, and CLI" per that doc page — though see §8 for the CLI-plugin parity bugs that partially contradict this claim in practice.

Marketplace categories observed: Infrastructure (Railway, AWS Core, Netlify, Azure, Temporal, MongoDB, PostgreSQL…), Data & Analytics (Snowflake, dbt Labs, Datadog, Elastic, PostHog), Productivity (Asana, ClickUp, Linear, Jira, Figma, Slack), Payments (Stripe, Shopify, Circle, Phantom), Agent Orchestration (Composio, Merge, Sourcegraph, AWS Agents), Design (Figma, Webflow, Canva, Miro), Customer Support (Intercom, Plain, Zendesk). Source: https://cursor.com/marketplace. Launch partners at the original March 2026 marketplace announcement: Amplitude, AWS, Figma, Linear, Stripe. Source: https://cursor.com/blog/marketplace, https://cursor.com/changelog/2-5. A follow-up post ("Over 30 new plugins join the Cursor Marketplace," March 11, 2026) added Atlassian, Datadog, GitLab, Glean, Hugging Face, monday.com, PlanetScale. Source: https://cursor.com/blog/new-plugins

### Team marketplaces

Teams/Enterprise admins can "import a GitHub repository of plugins and distribute them to your team," via Dashboard → Settings → Plugins → Import under Team Marketplaces, pasting a repo URL. "Team Access groups" scope who sees what. Source: https://forum.cursor.com/t/cursor-2-5-plugins/152124/19 (Colin, Cursor staff). As of the 3.9 Customize update, team-marketplace repo imports also support **GitLab, BitBucket, and Azure DevOps**, not just GitHub. Source: https://cursor.com/changelog/customize

Team marketplace **auto-refresh** exists ("Enable Auto Refresh" pulls updates when the branch changes) but as of the 3.9-era docs runs "at most once every 10 minutes," consolidating consecutive pushes into the latest commit — this cadence was itself a fix for an earlier bug where auto-refresh silently did nothing (see §8).

### Install modes (team-admin distribution policy)

Verbatim from https://cursor.com/docs/plugins: "After setting marketplace access, choose how each plugin is distributed to that audience:
- **Default Off**: Developers can find the plugin and choose whether to install it.
- **Default On**: The plugin is installed by default, but developers can opt out.
- **Required**: The plugin is always installed and cannot be uninstalled."

### Scope

Installs happen at **project or user** scope from the marketplace UI ("Select **Install** and choose a project or user scope" — https://cursor.com/docs/plugins). The 3.9 Customize page frames this three ways: **user, team, or workspace** level. Source: https://cursor.com/changelog/customize

### Direct GitHub-repo install (no marketplace listing required)

Yes — a personal, un-listed GitHub repo can be installed directly via the **`/add-plugin <github-url>`** command, e.g. `/add-plugin https://github.com/monk-io/monk-plugin`. Source: confirmed via an active bug thread reproducing this exact command, https://forum.cursor.com/t/add-plugin-github-imports-can-get-stuck-on-stale-plugin-versions/163895. This is distinct from, and simpler than, the team-marketplace GitHub-repo-import flow (§ above), which requires Dashboard admin access and is meant for org-wide distribution rather than one person's ad hoc install.

### Versioning / updates

- Personal `/add-plugin <github-url>` installs: pinned to the commit present at install time; **as of Aug 2026 there is an active, unresolved bug** where these installs get stuck on the stale commit even after the upstream repo has newer commits, and cannot be upgraded or cleanly removed through the normal UI (§8).
- Team marketplace installs: update via "Enable Auto Refresh" (automatic, ~10 min cadence) or a manual "Refresh" button; this mechanism itself shipped with a multi-month bug where auto-refresh silently failed to pick up changes (§8).
- Plugin `version` field uses semver in the manifest (§1) but no documented enforcement of version pinning/constraints when a project or team declares a dependency on a specific plugin version — **Not documented as of 2026-08**.

## 8. Known parity gaps and bugs (as of 2026-08-23)

**cursor-agent CLI vs IDE — plugin skills not registering.** Filed as "Cursor-agent CLI does not register skills from plugins (IDE does — parity gap)." The CLI only scans four hardcoded skill roots: `<repo>/.claude/skills/`, `<repo>/.cursor/skills/`, `~/.cursor/skills/`, `~/.cursor/skills-cursor/` — it does **not** scan plugin cache directories (`~/.cursor/plugins/cache/cursor-public/*/skills/`, `~/.cursor/plugins/local/*/skills/`, or Claude-marketplace caches `~/.claude/plugins/cache/*/*/skills/`). Reporter Dan Roth's minimal repro: a skill at `~/.cursor/plugins/local/repro/skills/canary/SKILL.md` was invisible to the CLI; moving the identical file to `~/.cursor/skills/canary/SKILL.md` made it discoverable immediately. Workaround: symlink plugin skill dirs into `~/.cursor/skills/` — fragile, because plugin-cache paths are content-hash/SHA directories that shift on update. **Cursor staff (Colin), May 4, 2026**: "I can confirm that plugins are not currently working in the CLI. We'll update the docs to reflect this, and we're hoping to dedicate some time to this soon!" **May 7, 2026**: "we've re-enabled the feature flag for plugins in the CLI" in build `v2026.05.05-84a231c`. Source: https://forum.cursor.com/t/cursor-agent-cli-does-not-register-skills-from-plugins-ide-does-parity-gap/158947

However, a **related, broader thread stayed open past that fix**: "Skills not shown in Cursor CLI while visible and working in desktop app." Cursor staff (Dean Rie, April 28, 2026) called this "a known parity gap between the CLI and desktop" with three distinct causes: (1) nested skills in subfolders aren't picked up by the CLI, (2) plugin-installed skills aren't registered in the CLI, (3) no file watcher — skills added mid-session don't appear until restart. As of the thread's last update (May 10, 2026), plugin skill support was "on our radar" with **no ETA**. Source: https://forum.cursor.com/t/skills-not-shown-in-cursor-cli-while-visible-and-working-in-desktop-app/159218

A separate, earlier-dated report: **"Agent does not have access to plugin capabilities (MCP, skills, commands, etc.)"** — Tyler (toakleaf), March 10, 2026: "In Chat, use the plugin's MCP tools, skills, or commands — they work. In Agent, ask to use the same capabilities — the Agent does not have access to them." Colin (staff), March 11, 2026: "Cursor CLI does not support plugins yet" — framed as a known limitation, not a bug, with no fix timeline, and a manual-MCP-config workaround suggested. Source: https://forum.cursor.com/t/agent-does-not-have-access-to-plugin-capabilities-mcp-skills-commands-etc/154334

**Net read on CLI/IDE plugin parity**: fixed in one narrow sense (basic plugin-skill loading was feature-flagged back on May 7, 2026) but multiple adjacent gaps (nested-folder skills, live file-watching, general plugin capability access for Agent mode specifically) remained open as recently as May–June 2026, and no forum evidence in this pass shows a definitive full-parity closure dated closer to August 2026 — treat CLI plugin support as **still meaningfully behind the IDE** as of this writing.

**Windows: hook stdin UTF-8 BOM silently defeats security guardrails.** On Windows, Cursor's `beforeShellExecution` hook payload arrives on stdin prefixed with a UTF-8 BOM (`﻿`), because (per staff) "the payload really does get sent to the hook's stdin with a UTF-8 BOM... due to how PowerShell pipes text into a native command." Standard `JSON.parse()` throws `SyntaxError: Unexpected token` on the BOM; hook scripts that catch that error defensively then **silently degrade to allow-all**, neutering security-guard hooks without any visible error — affects both the main agent and Multitask subagent channels, and even Cursor's own hooks-documentation examples are affected. Confirmed by Cursor staff (Dean Rie), July 27, 2026, on Cursor 3.13.10+ / Windows 10/11. **Unresolved, no ETA**, as of the thread's last post. Workaround: strip the BOM manually (`readFileSync(0, "utf8").replace(/^﻿/, "")`) and set `failClosed: true` so parse failures deny rather than allow. Source: https://forum.cursor.com/t/on-windows-cursor-s-hook-stdin-json-payload-includes-a-utf-8-bom-that-breaks-standard-json-parse-causing-security-guards-to-silently-degrade-to-allowing-commands-across-all-agent-channels/166794

**Cloud agents: wrong filesystem path for plugin skills.** Cloud/background agents show `<agent_skill>` context paths like `/home/cursor/...` that don't exist on the actual VM filesystem (`/home/ubuntu/...`), so bash-based reads of a skill file fail even though the model's built-in Read tool "resolves skill paths correctly" and works fine. Confirmed by Cursor staff (Mohit Jain), June 10, 2026, on Cursor 3.7.19: "This is a real bug on our side, not something in your setup, and we're getting it fixed." Status at last post: **in progress**, not yet shipped. Workaround: use the Read tool instead of bash, or hardcode `/home/ubuntu/` paths via an always-on rule. Source: https://forum.cursor.com/t/wrong-path-when-loading-plugin-skills-into-cloud-environments/162848

**Plugin skills/commands not showing up in the UI after install.** "Cursor Team Kit cannot be added as plugin" (Feb 18, 2026) — plugin installs without error but its skills/commands don't reliably render in pickers. Staff (Dean Rie): "This looks like a known issue where skills from installed plugins don't always show up correctly." Workarounds: `Developer: Reload Window`, or invoke the skill directly by name (e.g. `/new-branch-and-pr`) even when it's not visible in any list. Status: **unresolved**, staff called it non-blocking (functionality still works, just not discoverable in UI). Source: https://forum.cursor.com/t/cursor-team-kit-cannot-be-added-as-plugin/152159. A distinct, separately-titled bug — "Local plugin not loading commands" — corroborates that plugin-shipped **commands** specifically have discovery problems: https://forum.cursor.com/t/local-plugin-not-loading-commands/161008 (title-level confirmation only in this pass).

**`/add-plugin <github-url>` gets stuck on stale commits.** Filed June 23, 2026 by Marcin Gasperowicz (nooga): plugins installed via `/add-plugin https://github.com/monk-io/monk-plugin` stay pinned to the commit present at install time and cannot be upgraded or cleanly uninstalled through normal UI, even as the upstream repo advances. Staff (kevinn), same day: "I was able to reproduce the stale pin behavior on our side," specific "to the personal `/add-plugin <github-url>` flow" (team-marketplace imports are a separate code path and not affected the same way). Follow-ups confirm persistence: July 21 (status check, no reply on record here), July 27 (second user hits it), **August 3, 2026** (third user, kimjson, confirms on v3.14.7 — i.e. still broken at time of writing this doc). Workaround: clone locally and use `~/.cursor/plugins/local/<plugin-name>` instead of `/add-plugin`. **Unresolved as of Aug 3, 2026.** Source: https://forum.cursor.com/t/add-plugin-github-imports-can-get-stuck-on-stale-plugin-versions/163895

**Team marketplace auto-refresh unreliable.** Filed March 13, 2026: pushing changes to a team-marketplace repo's main branch didn't propagate without manually clearing cache, clicking refresh, and reinstalling. Staff acknowledged tracking it March 16; Colin announced a fix April 7 ("The auto-refresh mechanism should be fixed now!"); the original reporter retested April 9 on v3.0.13 and the bug **persisted**; more users confirmed it broken April 15–16, with staff requesting further diagnostic logs. No confirmed resolution found in this pass. Source: https://forum.cursor.com/t/team-marketplace-auto-refresh-does-not-pick-up-plugin-changes-manual-refresh-cache-clear-reinstall-required/154675

**Skills-root isolation has no CLI equivalent.** The IDE has a Settings toggle (Rules, Skills and Subagents) to stop loading skills from the Claude/Codex compatibility paths, but "This setting doesn't apply to `cursor-cli`" (confirmed by a forum participant, June 19, 2026, after staff pointed at the IDE-only toggle on June 8). No first-party CLI flag exists; only a Linux-namespace bash-wrapper community workaround (`cursor-agent-skill-filter`), which requires specific kernel features and doesn't work cross-platform. Source: https://forum.cursor.com/t/toggle-or-allowlist-for-agent-skills-roots-stop-loading-claude-skills-and-codex-skills-when-i-only-want-cursor-agents/160199

**Practical takeaway for a plugin author**: build and test against the **IDE first** — it is consistently the most reliable surface for plugin skills/commands/hooks. Do not assume CLI (`cursor-agent`) parity for any plugin-shipped component without testing directly on the target OS/version; Windows hook behavior in particular needs explicit BOM-stripping and `failClosed: true` if the hook enforces any security policy; and cloud/background-agent execution has its own separate path-resolution bugs for skills that don't affect local/IDE runs.
