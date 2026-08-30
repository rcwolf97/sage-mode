import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { setup, uninstall, checkHealth } from "../lib/setup/index.js";
import { readManifest } from "../lib/manifest/index.js";
function gitInit(dir) {
    spawnSync("git", ["init"], { cwd: dir });
    spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: dir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
    writeFileSync(join(dir, "README.md"), "hello\n");
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync("git", ["commit", "-m", "init"], { cwd: dir });
}
const DEFAULT_AGENTS = ["architect.md", "implementer-backend.md", "reviewer.md"];
// A synthetic plugin tree (agents/ + docs/assets/) standing in for the real
// pluginRoot, so tests can mutate "source" content (to exercise the
// refresh-on-source-change path) without touching this repo's real agent
// cards.
function makeSageHome(agentNames = DEFAULT_AGENTS) {
    const home = mkdtempSync(join(tmpdir(), "sage-home-"));
    const agentsDir = join(home, "agents");
    mkdirSync(agentsDir, { recursive: true });
    for (const name of agentNames) {
        writeFileSync(join(agentsDir, name), `original content for ${name}\n`);
    }
    const assetsDir = join(home, "docs", "assets");
    mkdirSync(assetsDir, { recursive: true });
    writeFileSync(join(assetsDir, "notebook.css"), "body{}\n");
    writeFileSync(join(assetsDir, "mermaid.min.js"), "// mermaid\n");
    return home;
}
function isolatedUserHome() {
    return mkdtempSync(join(tmpdir(), "sage-userhome-"));
}
// setup()/uninstall()/checkHealth() all resolve the user-level ~/.sage state
// through process.env.HOME (see util.ts homeDir()). Redirecting it to a temp
// dir for the duration of a call keeps every test from touching the real
// developer's ~/.sage/config.json.
function withHome(dir, fn) {
    const prev = process.env.HOME;
    process.env.HOME = dir;
    try {
        return fn();
    }
    finally {
        if (prev === undefined)
            delete process.env.HOME;
        else
            process.env.HOME = prev;
    }
}
function agentsRelPaths(agentNames = DEFAULT_AGENTS) {
    return agentNames.map((n) => `.cursor/agents/${n}`);
}
const ASSET_REL_PATHS = ["docs/assets/notebook.css", "docs/assets/mermaid.min.js"];
function snapshotTree(root) {
    const out = {};
    function walk(dir) {
        if (!existsSync(dir))
            return;
        for (const name of readdirSync(dir)) {
            if (name === ".git")
                continue;
            const p = join(dir, name);
            const st = statSync(p);
            if (st.isDirectory())
                walk(p);
            else
                out[p] = createHash("sha256").update(readFileSync(p)).digest("hex");
        }
    }
    walk(root);
    return out;
}
test("setup into a fresh repo writes agent cards and asset files and records them in the manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    const r = withHome(userHome, () => setup({ project: dir, sageHome: home }));
    for (const rel of [...agentsRelPaths(), ...ASSET_REL_PATHS]) {
        assert.ok(existsSync(join(dir, rel)), `expected ${rel} to be written`);
        assert.ok(r.files.written.includes(rel), `expected ${rel} reported as written`);
    }
    assert.equal(r.files.preserved.length, 0);
    assert.equal(r.files.refreshed.length, 0);
    const manifest = readManifest(dir);
    assert.equal(manifest.entries.length, agentsRelPaths().length + ASSET_REL_PATHS.length);
    for (const rel of [...agentsRelPaths(), ...ASSET_REL_PATHS]) {
        const entry = manifest.entries.find((e) => e.path === rel);
        assert.ok(entry, `expected a manifest entry for ${rel}`);
    }
});
test("editing an agent card and re-running setup preserves the edit and reports it", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    const edited = join(dir, ".cursor", "agents", "implementer-backend.md");
    writeFileSync(edited, "the engineer's own tuned version\n");
    const r2 = withHome(userHome, () => setup({ project: dir, sageHome: home }));
    assert.equal(readFileSync(edited, "utf8"), "the engineer's own tuned version\n");
    assert.ok(r2.files.preserved.includes(".cursor/agents/implementer-backend.md"));
    assert.ok(!r2.files.written.includes(".cursor/agents/implementer-backend.md"));
    assert.ok(!r2.files.refreshed.includes(".cursor/agents/implementer-backend.md"));
});
test("an untouched owned card is refreshed when the source changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    writeFileSync(join(home, "agents", "reviewer.md"), "a newer version of the shipped card\n");
    const r2 = withHome(userHome, () => setup({ project: dir, sageHome: home }));
    assert.equal(readFileSync(join(dir, ".cursor", "agents", "reviewer.md"), "utf8"), "a newer version of the shipped card\n");
    assert.ok(r2.files.refreshed.includes(".cursor/agents/reviewer.md"));
    assert.ok(!r2.files.preserved.includes(".cursor/agents/reviewer.md"));
});
test("a file present with no manifest entry (pre-manifest install) is preserved, not clobbered", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    mkdirSync(join(dir, ".cursor", "agents"), { recursive: true });
    writeFileSync(join(dir, ".cursor", "agents", "architect.md"), "a file that predates the manifest\n");
    const r = withHome(userHome, () => setup({ project: dir, sageHome: home }));
    assert.equal(readFileSync(join(dir, ".cursor", "agents", "architect.md"), "utf8"), "a file that predates the manifest\n");
    assert.ok(r.files.preserved.includes(".cursor/agents/architect.md"));
    // the other, genuinely-new files still get installed normally
    assert.ok(r.files.written.includes(".cursor/agents/implementer-backend.md"));
    assert.ok(existsSync(join(dir, ".cursor", "agents", "implementer-backend.md")));
});
test("deleting an owned card and re-running setup re-writes it and resumes tracking", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    const p = join(dir, ".cursor", "agents", "implementer-backend.md");
    rmSync(p);
    assert.ok(!existsSync(p));
    const r2 = withHome(userHome, () => setup({ project: dir, sageHome: home }));
    assert.ok(existsSync(p));
    assert.equal(readFileSync(p, "utf8"), "original content for implementer-backend.md\n");
    assert.ok(r2.files.refreshed.includes(".cursor/agents/implementer-backend.md"));
    const manifest = readManifest(dir);
    const entry = manifest.entries.find((e) => e.path === ".cursor/agents/implementer-backend.md");
    assert.ok(entry);
});
test("uninstall removes owned-clean files, preserves modified ones, and is idempotent on a second run", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    const edited = join(dir, ".cursor", "agents", "architect.md");
    writeFileSync(edited, "kept exactly as the user left it\n");
    const u1 = withHome(userHome, () => uninstall({ project: dir }));
    for (const rel of [".cursor/agents/implementer-backend.md", ".cursor/agents/reviewer.md", ...ASSET_REL_PATHS]) {
        assert.ok(u1.removed.includes(rel), `expected ${rel} removed`);
        assert.ok(!existsSync(join(dir, rel)), `expected ${rel} deleted from disk`);
    }
    assert.ok(!u1.removed.includes(".cursor/agents/architect.md"));
    assert.deepEqual(u1.preserved, [{ path: ".cursor/agents/architect.md", reason: "modified" }]);
    assert.equal(readFileSync(edited, "utf8"), "kept exactly as the user left it\n");
    const u2 = withHome(userHome, () => uninstall({ project: dir }));
    assert.deepEqual(u2.removed, []);
    assert.deepEqual(u2.preserved, [{ path: ".cursor/agents/architect.md", reason: "modified" }]);
    assert.equal(readFileSync(edited, "utf8"), "kept exactly as the user left it\n");
});
test("checkHealth performs no writes and reports install-manifest and gitignore state", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    const beforeProject = snapshotTree(dir);
    const beforeUser = snapshotTree(userHome);
    const report = withHome(userHome, () => checkHealth({ project: dir }));
    const afterProject = snapshotTree(dir);
    const afterUser = snapshotTree(userHome);
    assert.deepEqual(beforeProject, afterProject);
    assert.deepEqual(beforeUser, afterUser);
    assert.equal(typeof report.ok, "boolean");
    assert.ok(Array.isArray(report.gaps));
    assert.equal(report.gitignore.sageIgnored, true);
    assert.equal(report.gitignore.worktreesIgnored, true);
    assert.equal(report.manifest.ownedClean, agentsRelPaths().length + ASSET_REL_PATHS.length);
    assert.equal(report.manifest.ownedModified, 0);
    assert.equal(report.manifest.missing, 0);
    assert.equal(report.notebook.source, "project-config");
    const node = report.interpreters.find((i) => i.name === "node");
    assert.ok(node);
    assert.equal(node.present, true);
    assert.equal(node.runs, true);
});
test("checkHealth flags a customized file as a preserved gap without treating it as broken", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    writeFileSync(join(dir, ".cursor", "agents", "architect.md"), "customized\n");
    const report = withHome(userHome, () => checkHealth({ project: dir }));
    assert.equal(report.manifest.ownedModified, 1);
    assert.ok(report.gaps.some((g) => g.includes("customized")));
    assert.equal(report.ok, true);
});
