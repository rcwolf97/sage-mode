import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync, } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { setup, uninstall, checkHealth } from "../lib/setup/index.js";
import { classify, installFile, plannedRemovals, readManifest, writeManifest } from "../lib/manifest/index.js";
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
// --- Adversarial coverage -------------------------------------------------
test("a manifest entry with a ../ path can never make uninstall delete a file outside the project root", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    // A file that lives outside the project root entirely (a sibling of it),
    // standing in for something the user cares about. Its content is *known*
    // to the "attacker" so the recorded sha256 in the crafted manifest can
    // match it exactly — the worst case, where classify() cannot fall back on
    // a hash mismatch to save it.
    const victim = join(dir, "..", "victim.txt");
    const victimContent = "the user's own file, outside the sage project entirely\n";
    writeFileSync(victim, victimContent);
    const victimHash = createHash("sha256").update(victimContent).digest("hex");
    assert.ok(existsSync(victim));
    mkdirSync(join(dir, ".sage"), { recursive: true });
    writeManifest(dir, {
        version: 1,
        installedAt: new Date().toISOString(),
        sageVersion: "1.0.0",
        entries: [{ path: "../victim.txt", sha256: victimHash, writtenAt: new Date().toISOString() }],
    });
    // A malicious/corrupt manifest entry escaping the project root must never
    // be eligible for removal, no matter what classify() would otherwise say
    // about its hash.
    const manifest = readManifest(dir);
    assert.deepEqual(plannedRemovals(dir, manifest), []);
    assert.equal(classify(dir, "../victim.txt", manifest), "unowned");
    const result = uninstall({ project: dir });
    assert.ok(existsSync(victim), "file outside the project root must survive uninstall");
    assert.equal(readFileSync(victim, "utf8"), victimContent);
    assert.deepEqual(result.removed, []);
    rmSync(victim, { force: true });
});
test("installFile refuses to write outside the project root even if handed an escaping relPath directly", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const targetOutside = join(dir, "..", "should-not-exist.txt");
    rmSync(targetOutside, { force: true });
    const manifest = readManifest(dir);
    const res = installFile(dir, "../should-not-exist.txt", join(home, "agents", "architect.md"), manifest);
    assert.equal(res.action, "preserved");
    assert.ok(!existsSync(targetOutside), "installFile must never create a file outside the project root");
    rmSync(targetOutside, { force: true });
});
test("classify() and plannedRemovals() also refuse an absolute manifest path outside the root", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const outside = mkdtempSync(join(tmpdir(), "sage-outside-"));
    const target = join(outside, "abs-target.txt");
    writeFileSync(target, "unrelated file on the machine\n");
    const hash = createHash("sha256").update("unrelated file on the machine\n").digest("hex");
    mkdirSync(join(dir, ".sage"), { recursive: true });
    writeManifest(dir, {
        version: 1,
        installedAt: new Date().toISOString(),
        sageVersion: "1.0.0",
        entries: [{ path: target, sha256: hash, writtenAt: new Date().toISOString() }],
    });
    const manifest = readManifest(dir);
    assert.equal(classify(dir, target, manifest), "unowned");
    assert.deepEqual(plannedRemovals(dir, manifest), []);
    uninstall({ project: dir });
    assert.ok(existsSync(target), "absolute-path manifest entry must not cause deletion outside the root");
});
test("a symlink standing in for an owned agent card, pointed at a personal fork with different content, is preserved not clobbered", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    const fork = join(dir, "..", "my-fork-architect.md");
    const forkContent = "the user's personal fork, symlinked into place\n";
    writeFileSync(fork, forkContent);
    const linked = join(dir, ".cursor", "agents", "architect.md");
    rmSync(linked);
    symlinkSync(fork, linked);
    const r2 = withHome(userHome, () => setup({ project: dir, sageHome: home }));
    assert.ok(r2.files.preserved.includes(".cursor/agents/architect.md"));
    assert.ok(lstatSync(linked).isSymbolicLink(), "the symlink itself must survive, not be replaced");
    assert.equal(readlinkSync(linked), fork);
    assert.equal(readFileSync(linked, "utf8"), forkContent, "the fork's content must be untouched");
    rmSync(fork, { force: true });
});
test("uninstall never follows a symlinked owned-clean card into its target — only the link itself is removed", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    // Simulate an owned-clean file that happens to be a symlink to a file with
    // byte-identical content to what sage wrote (so classify() calls it
    // owned-clean and marks it for removal).
    const linkedPath = join(dir, ".cursor", "agents", "architect.md");
    const originalContent = readFileSync(linkedPath, "utf8");
    const decoy = join(dir, "..", "decoy-architect.md");
    writeFileSync(decoy, originalContent);
    rmSync(linkedPath);
    symlinkSync(decoy, linkedPath);
    uninstall({ project: dir });
    assert.ok(!existsSync(linkedPath), "the symlink entry itself should be gone");
    assert.ok(existsSync(decoy), "the symlink's target must never be deleted");
    assert.equal(readFileSync(decoy, "utf8"), originalContent);
    rmSync(decoy, { force: true });
});
test("a corrupt install-manifest.json makes every tracked file look unowned and untouched, never crashes setup", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    writeFileSync(join(dir, ".sage", "install-manifest.json"), "{ not valid json at all ][");
    const r2 = withHome(userHome, () => setup({ project: dir, sageHome: home }));
    // Every path is now "unowned" (present, no manifest entry) and must be
    // preserved untouched, never overwritten.
    for (const rel of [...agentsRelPaths(), ...ASSET_REL_PATHS]) {
        assert.ok(r2.files.preserved.includes(rel), `expected ${rel} preserved after a corrupt manifest`);
    }
    assert.equal(readFileSync(join(dir, ".cursor", "agents", "architect.md"), "utf8"), "original content for architect.md\n");
});
test("an empty install-manifest.json (falsy but valid-ish content) is treated the same safe way", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    writeFileSync(join(dir, ".sage", "install-manifest.json"), "");
    assert.doesNotThrow(() => withHome(userHome, () => setup({ project: dir, sageHome: home })));
});
test("a manifest entry missing its path (or sha256) field is dropped, never crashes uninstall/checkHealth/setup", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    mkdirSync(join(dir, ".sage"), { recursive: true });
    writeFileSync(join(dir, ".sage", "install-manifest.json"), JSON.stringify({
        version: 1,
        installedAt: new Date().toISOString(),
        sageVersion: "1.0.0",
        entries: [
            { sha256: "deadbeef", writtenAt: new Date().toISOString() }, // missing path
            { path: ".cursor/agents/architect.md", writtenAt: new Date().toISOString() }, // missing sha256
            null,
            "not even an object",
        ],
    }));
    const manifest = readManifest(dir);
    assert.deepEqual(manifest.entries, []);
    assert.doesNotThrow(() => withHome(userHome, () => uninstall({ project: dir })));
    assert.doesNotThrow(() => withHome(userHome, () => checkHealth({ project: dir })));
    assert.doesNotThrow(() => withHome(userHome, () => setup({ project: dir, sageHome: home })));
});
test("an interrupted setup (throw partway through the install loop) leaves the manifest exactly as it was before the run", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome(["architect.md", "implementer-backend.md", "reviewer.md"]);
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    const manifestBefore = readFileSync(join(dir, ".sage", "install-manifest.json"), "utf8");
    // Change the source so this run will actually try to refresh an
    // already-tracked file (not just no-op re-verify it), then replace that
    // file's destination with a non-empty directory. classify()'s
    // fileSha256() call reads it as a file and throws EISDIR — a failure mode
    // that doesn't depend on process uid the way chmod-based permission
    // failures do (this test process runs as root, which bypasses permission
    // bits entirely), so it reliably proves the point on any uid.
    writeFileSync(join(home, "agents", "reviewer.md"), "a newer version of the shipped card\n");
    const blockedAbs = join(dir, ".cursor", "agents", "reviewer.md");
    rmSync(blockedAbs);
    mkdirSync(blockedAbs);
    writeFileSync(join(blockedAbs, "not-empty.txt"), "occupies the destination\n");
    let threw = false;
    try {
        withHome(userHome, () => setup({ project: dir, sageHome: home }));
    }
    catch {
        threw = true;
    }
    finally {
        rmSync(blockedAbs, { recursive: true, force: true });
    }
    assert.ok(threw, "expected the interrupted setup to throw rather than silently succeed");
    const manifestAfter = readFileSync(join(dir, ".sage", "install-manifest.json"), "utf8");
    assert.equal(manifestAfter, manifestBefore, "manifest on disk must be exactly the pre-run version, not partially updated");
    const manifest = readManifest(dir);
    for (const rel of [...agentsRelPaths(), ...ASSET_REL_PATHS]) {
        assert.ok(manifest.entries.some((e) => e.path === rel), `expected ${rel} still tracked from the successful prior run`);
    }
    // None of the previously-installed files this run never touched were
    // corrupted or lost (reviewer.md is excluded: this test deliberately
    // replaced it with a directory as the trigger for the mid-loop throw).
    for (const rel of agentsRelPaths().filter((r) => !r.endsWith("reviewer.md"))) {
        assert.ok(existsSync(join(dir, rel)));
    }
});
test("setting up into a project whose .cursor/agents path is blocked by a plain file throws instead of silently reporting success", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    // A plain file sitting where sage needs a directory — mkdirSync(...,
    // {recursive:true}) cannot create a directory through a file, regardless
    // of who owns the process, so this is a permission-independent way to
    // prove a write failure surfaces rather than being swallowed.
    mkdirSync(join(dir, ".cursor"), { recursive: true });
    writeFileSync(join(dir, ".cursor", "agents"), "not a directory\n");
    let threw = false;
    try {
        withHome(userHome, () => setup({ project: dir, sageHome: home }));
    }
    catch {
        threw = true;
    }
    assert.ok(threw, "expected setup() to surface the write failure rather than swallow it");
    assert.ok(!existsSync(join(dir, ".sage", "install-manifest.json")), "no manifest should be written for a failed run");
});
test("checkHealth is fully read-only on a repo where nothing has been set up yet, including ~/.sage", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const userHome = isolatedUserHome();
    const beforeProject = snapshotTree(dir);
    const beforeUser = snapshotTree(userHome);
    const projectEntriesBefore = existsSync(dir) ? readdirSync(dir) : [];
    const userEntriesBefore = existsSync(userHome) ? readdirSync(userHome) : [];
    withHome(userHome, () => checkHealth({ project: dir }));
    const afterProject = snapshotTree(dir);
    const afterUser = snapshotTree(userHome);
    assert.deepEqual(beforeProject, afterProject);
    assert.deepEqual(beforeUser, afterUser);
    assert.deepEqual(existsSync(dir) ? readdirSync(dir) : [], projectEntriesBefore);
    assert.deepEqual(existsSync(userHome) ? readdirSync(userHome) : [], userEntriesBefore);
    assert.ok(!existsSync(join(userHome, ".sage")), "checkHealth must not create ~/.sage as a side effect");
});
test("interpreter detection actually executes the binary: present-but-broken is reported present:true, runs:false", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const userHome = isolatedUserHome();
    const fakeBinDir = mkdtempSync(join(tmpdir(), "sage-fakebin-"));
    const fakeNode = join(fakeBinDir, "node");
    writeFileSync(fakeNode, "#!/bin/sh\nexit 1\n");
    chmodSync(fakeNode, 0o755);
    const prevPath = process.env.PATH;
    process.env.PATH = `${fakeBinDir}:${prevPath}`;
    let report;
    try {
        report = withHome(userHome, () => checkHealth({ project: dir }));
    }
    finally {
        process.env.PATH = prevPath;
    }
    const node = report.interpreters.find((i) => i.name === "node");
    assert.ok(node);
    assert.equal(node.present, true);
    assert.equal(node.runs, false);
    assert.equal(node.version, undefined);
    assert.equal(report.ok, false);
    assert.ok(report.gaps.some((g) => g.includes("node") && g.includes("broken")));
});
test("--purge-user-config removes only this project from trustedRoots, never the rest of ~/.sage/config.json", () => {
    const dirA = mkdtempSync(join(tmpdir(), "sage-proj-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "sage-proj-b-"));
    gitInit(dirA);
    gitInit(dirB);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dirA, sageHome: home }));
    withHome(userHome, () => setup({ project: dirB, sageHome: home }));
    const cfgPath = join(userHome, ".sage", "config.json");
    const cfgBefore = JSON.parse(readFileSync(cfgPath, "utf8"));
    assert.ok(cfgBefore.trustedRoots.includes(dirA));
    assert.ok(cfgBefore.trustedRoots.includes(dirB));
    withHome(userHome, () => uninstall({ project: dirA, purgeUserConfig: true }));
    const cfgAfter = JSON.parse(readFileSync(cfgPath, "utf8"));
    assert.ok(!cfgAfter.trustedRoots.includes(dirA), "the uninstalled project must be removed from trustedRoots");
    assert.ok(cfgAfter.trustedRoots.includes(dirB), "other projects' trustedRoots entries must survive");
    assert.equal(cfgAfter.sageHome, cfgBefore.sageHome, "unrelated config keys must be preserved, not dropped");
    assert.equal(cfgAfter.version, cfgBefore.version);
});
// --- Bug 1: a fresh repo must report ok:true with gaps, not ok:false ------
//
// The health-check contract this implements (deliberately mirroring
// compound-engineering's): an absence is never a failure, only a gap. A
// health check that fails on a repo that has simply never run `sage setup`
// yet is the worst possible first experience for a new engineer.
test("setup --check on a fresh, never-set-up repo reports ok:true with gaps listed, not ok:false", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const userHome = isolatedUserHome();
    const report = withHome(userHome, () => checkHealth({ project: dir }));
    assert.equal(report.ok, true, "a fresh repo must never report ok:false — nothing is broken, it's just not set up yet");
    assert.ok(report.gaps.length > 0, "a fresh repo should still list what's missing, as gaps");
    assert.deepEqual(report.problems, [], "no gap on a fresh repo should count as a genuine problem");
    // The specific gaps this fresh-repo scenario is documented to raise:
    assert.ok(report.gaps.some((g) => g.includes(".sage/") && g.includes("gitignored")));
    assert.ok(report.gaps.some((g) => g.includes("no project .sage/config.json")));
});
test("post-setup repo with .gitignore reverted (install manifest exists) reports ok:false — this really is broken", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    // Simulate the user (or a careless merge) reverting .gitignore after setup
    // already ran once — the install manifest is still there, so this is no
    // longer "not set up yet," it's a real regression that will silently break
    // evidence forever (see lib/evidence's checkSageIgnored).
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n");
    const report = withHome(userHome, () => checkHealth({ project: dir }));
    assert.equal(report.ok, false, "an install that has already run, with .gitignore reverted, must be reported broken");
    assert.ok(report.problems.some((p) => p.includes(".sage/") && p.includes("gitignored")));
});
test("a project config that exists but is malformed JSON is reported broken, not just a gap", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    writeFileSync(join(dir, ".sage", "config.json"), "{ not json at all");
    const report = withHome(userHome, () => checkHealth({ project: dir }));
    assert.equal(report.ok, false);
    assert.ok(report.problems.some((p) => p.includes("not valid JSON")));
});
// --- Bug 2: HOME resolving to the project root must never silently clobber
// the project config with the user config --------------------------------
test("setup refuses, before writing anything, when HOME resolves to the project root itself", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const beforeProject = snapshotTree(dir);
    let threw;
    try {
        withHome(dir, () => setup({ project: dir, sageHome: home }));
    }
    catch (e) {
        threw = e;
    }
    assert.ok(threw instanceof Error, "setup() must refuse rather than silently proceed");
    assert.match(threw.message, /HOME/);
    assert.match(threw.message, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const afterProject = snapshotTree(dir);
    assert.deepEqual(beforeProject, afterProject, "a refused setup must not have written anything to the project");
    assert.ok(!existsSync(join(dir, ".sage")), "no .sage/ directory should have been created");
});
test("checkHealth reports the HOME/project collision as broken (ok:false), never silently picking one config", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const report = withHome(dir, () => checkHealth({ project: dir }));
    assert.equal(report.ok, false);
    assert.ok(report.problems.some((p) => p.includes("HOME") || p.toLowerCase().includes("same path")));
});
test("a stale manifest hash (as if a prior setup crashed between writing the file and writing the manifest) is treated as owned-modified, never silently rewritten", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-proj-"));
    gitInit(dir);
    const home = makeSageHome();
    const userHome = isolatedUserHome();
    withHome(userHome, () => setup({ project: dir, sageHome: home }));
    // Simulate: the file on disk already has the *new* source content (as if
    // atomicWrite succeeded) but the manifest was never updated to match (as
    // if the process died right before writeManifest ran).
    const rel = ".cursor/agents/architect.md";
    const abs = join(dir, ".cursor", "agents", "architect.md");
    writeFileSync(abs, "content that landed on disk but was never recorded in the manifest\n");
    const manifest = readManifest(dir);
    assert.equal(classify(dir, rel, manifest), "owned-modified");
    // The safe direction: never silently overwrite something that looks
    // user-modified, even though in this scenario it's actually sage's own
    // (unrecorded) write.
    const r2 = withHome(userHome, () => setup({ project: dir, sageHome: home }));
    assert.ok(r2.files.preserved.includes(rel));
    assert.equal(readFileSync(abs, "utf8"), "content that landed on disk but was never recorded in the manifest\n");
});
