import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gitRoot, pluginRoot, sageUserDir, VERSION, writeJson } from "../util.js";
import { copyAssets } from "../notebook/index.js";
const SHIM = `#!/usr/bin/env sh
SAGE_HOME=$(sed -n 's/.*"sageHome"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' "$HOME/.sage/config.json")
exec node "$SAGE_HOME/lib/cli.js" "$@"
`;
export function setup(opts) {
    const sageHome = pluginRoot;
    const user = sageUserDir();
    mkdirSync(join(user, "bin"), { recursive: true });
    const root = opts?.project || gitRoot() || process.cwd();
    const existing = existsSync(join(user, "config.json"))
        ? JSON.parse(readFileSync(join(user, "config.json"), "utf8"))
        : {};
    const trusted = new Set(existing.trustedRoots || []);
    trusted.add(root);
    writeJson(join(user, "config.json"), {
        sageHome,
        version: VERSION,
        installedAt: new Date().toISOString(),
        trustedRoots: [...trusted],
    });
    const shim = join(user, "bin", "sage");
    writeFileSync(shim, SHIM);
    chmodSync(shim, 0o755);
    const gitignore = join(root, ".gitignore");
    let gi = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
    if (!gi.split(/\r?\n/).includes(".sage/")) {
        gi = gi.replace(/\s*$/, "") + (gi ? "\n" : "") + ".sage/\n.worktrees/\n";
        writeFileSync(gitignore, gi);
    }
    mkdirSync(join(root, ".sage"), { recursive: true });
    if (!existsSync(join(root, ".sage", "config.json"))) {
        writeJson(join(root, ".sage", "config.json"), {
            version: 1,
            profile: opts?.profile || "web",
            verify: { tests: "npm test", typecheck: "npx tsc --noEmit", build: "npm run build" },
            lanes: {
                product: "claude-cli",
                product_mode: "full",
                architect: "grok-4.6",
                eng_manager: "grok-4.6",
                implementer: "grok-4.5",
                implementer_high_risk: "grok-4.6",
                reviewer: "gemini-3.7-flash",
                red_team: "gemini-3.7-flash",
                qa_driver: "grok-4.5",
                qa_analyst: "claude-cli",
                librarian: "grok-4.5",
            },
            notebook: { root: "docs", publish: false },
            lane_enforcement: "both",
            budget: { warn_metered_tokens: 200000 },
        });
    }
    mkdirSync(join(root, "docs", "assets"), { recursive: true });
    copyAssets(join(root, "docs"), sageHome);
    if (!opts?.noProjectAgents) {
        const dest = join(root, ".cursor", "agents");
        const src = join(sageHome, "agents");
        if (existsSync(src)) {
            mkdirSync(dest, { recursive: true });
            for (const name of readdirSync(src).filter((n) => n.endsWith(".md"))) {
                copyFileSync(join(src, name), join(dest, name));
            }
        }
    }
    return { sageHome, shim, project: root };
}
void dirname;
