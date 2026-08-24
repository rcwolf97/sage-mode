# Sage Mode plugin

Cursor plugin for sprint-shaped delivery. Installed via the marketplace at the repository root (`.cursor-plugin/marketplace.json` → `"source": "plugin"`).

`SAGE_HOME` is this directory. `/sage-setup` writes `~/.sage/config.json` and `~/.sage/bin/sage`.

```bash
npm install
npx tsc -p tsconfig.json
node lib/cli.js --version
node --test test/*.test.js
node lib/cli.js lint
```

Zero runtime npm dependencies. `marked` and `mermaid` are vendored.
