# sage-mode

A Cursor marketplace that ships **Sage Mode**: an engineering organization you command. Eight sprint commands, six design commands, specialist agents, adversarial review, and a notebook that remembers.

This repository is a **custom Cursor marketplace**, not an official `cursor.com/marketplace` listing.

## Install in Cursor

Do **not** use `/add-plugin <github-url>` (that flow pins a stale commit).

### Custom marketplace

1. Open **Customize → Plugins**.
2. Add a marketplace with this repo: `https://github.com/rcwolf97/sage-mode`
3. Install **sage-mode** at user or project scope.
4. **Developer: Reload Window**.
5. In a project, run `/sage-setup`.

### Local development symlink

```bash
ln -s "$(pwd)/plugin" ~/.cursor/plugins/local/sage-mode
```

Then **Developer: Reload Window**. Enable *Include third-party Plugins, Skills, and other configs* if the plugin does not appear. Put `~/.sage/bin` on your `PATH`.

## Prerequisites

| Requirement | Version | If missing |
|---|---|---|
| Cursor | ≥ 3.14 | Hard requirement |
| Node.js | ≥ 20 | CLI, notebook, evidence, recall unavailable |
| git | ≥ 2.38 | Hard requirement |
| GitHub CLI `gh` | ≥ 2.0 (optional) | `/sage-ship` prints the PR body instead of opening it |

## Commands

Sprint: `/sage-shape` `/sage-plan` `/sage-dag` `/sage-build` `/sage-review` `/sage-verify` `/sage-ship` `/sage-retro`

Support: `/sage-setup` `/sage-status` `/sage-unsafe`

Design: `/design-intake` `/design-direction` `/design-system` `/design-motion` `/design-build` `/design-critique`

## Fifteen-minute first run

1. Install the plugin (above).
2. Open an empty git repo.
3. `/sage-setup`
4. `/sage-shape` — answer one question at a time until a roadmap exists.
5. Open `docs/roadmap.html` and `docs/index.html`.

## Layout

```
.cursor-plugin/marketplace.json   # this repo is the marketplace
plugin/                           # the installable Cursor plugin
docs/                             # research notebook (this repo)
```

## License

MIT
