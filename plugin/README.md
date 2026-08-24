# Sage Mode plugin

Cursor plugin for sprint-shaped delivery.

**Install (local development):** this directory (`plugin/`) is the plugin root — it's what Cursor loads, not the repository root. Symlink it into Cursor's local plugin directory, then reload:

```bash
ln -s "$PWD" ~/.cursor/plugins/local/sage-mode
# Cursor: Developer: Reload Window
```

Do **not** use `/add-plugin <this-repo-url>` — the repository root one level up is a *marketplace* (`.cursor-plugin/marketplace.json`, `"source": "plugin"`), meant for distributing this alongside other plugins from one repo, not for installing this plugin directly. The marketplace path is a distribution mechanism for later, not the way to get this running locally today.

`SAGE_HOME` is this directory. `/sage-setup` writes `~/.sage/config.json` and `~/.sage/bin/sage`.

```bash
npm install
npx tsc -p tsconfig.json
node lib/cli.js --version
node --test test/*.test.js
node lib/cli.js lint
```

Zero runtime npm dependencies. `marked` and `mermaid` are vendored.
