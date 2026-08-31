import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
// End-to-end smoke pass against the REAL compiled CLI (lib/cli.js), spawned
// as a subprocess exactly the way a real engineer's shell would invoke it —
// every other test in this repo imports lib/*/index.js directly, which is
// how two real bugs (a health check that fails on a fresh repo; HOME
// colliding with the project root and silently clobbering the project
// config) shipped past 260 passing unit tests. This file ports the manual
// smoke pass at /home/claude/work/smoke.sh into a permanent, committed
// regression test so that class of bug can't come back unnoticed.
//
// All 11 steps share one project directory and one temp HOME, run in order
// via subtests of a single top-level test (subtests of the same parent are
// guaranteed sequential when awaited, unlike sibling top-level tests) —
// several steps depend on state a previous one left behind (the manifest
// invariant in step 3 needs `setup` from step 2 to have already run; step 11
// needs the edit from step 3 to still be there).
const CLI = join(import.meta.dirname, "..", "lib", "cli.js");
function gitInit(dir) {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: dir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
}
// Recursive, sorted list of every file under `root` (relative paths,
// forward-slash joined, `.git` excluded) — used to assert a read-only
// command wrote literally nothing, not just "nothing we happened to check."
function snapshotTree(root) {
    const out = [];
    function walk(dir, rel) {
        for (const name of readdirSync(dir)) {
            if (name === ".git")
                continue;
            const abs = join(dir, name);
            const relPath = rel ? `${rel}/${name}` : name;
            const st = statSync(abs);
            if (st.isDirectory())
                walk(abs, relPath);
            else
                out.push(relPath);
        }
    }
    walk(root, "");
    return out.sort();
}
test("sage CLI end-to-end smoke pass", async (t) => {
    const projectDir = mkdtempSync(join(tmpdir(), "sage-e2e-proj-"));
    const homeDir = mkdtempSync(join(tmpdir(), "sage-e2e-home-"));
    function sage(args, opts) {
        const r = spawnSync("node", [CLI, ...args], {
            cwd: projectDir,
            env: { ...process.env, HOME: homeDir },
            encoding: "utf8",
            input: opts?.input,
        });
        return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
    }
    // Fixture: a small real repo with source, api, and migration files, shaped
    // to match `dag`'s owns globs and `review scope`'s SCOPE_* classifiers.
    gitInit(projectDir);
    mkdirSync(join(projectDir, "src"), { recursive: true });
    mkdirSync(join(projectDir, "api"), { recursive: true });
    mkdirSync(join(projectDir, "migrations"), { recursive: true });
    writeFileSync(join(projectDir, "src", "a.ts"), "export const a = 1;\n");
    writeFileSync(join(projectDir, "api", "b.ts"), "export function handler(){return 1}\n");
    writeFileSync(join(projectDir, "migrations", "001.sql"), "-- migration\n");
    spawnSync("git", ["add", "-A"], { cwd: projectDir });
    spawnSync("git", ["commit", "-q", "-m", "init"], { cwd: projectDir });
    await t.test("1. setup --check on a bare repo exits 0, writes NOTHING, and reports gaps", () => {
        const before = snapshotTree(projectDir);
        const r = sage(["setup", "--check", "--json"]);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        const after = snapshotTree(projectDir);
        assert.deepEqual(before, after, "setup --check must never write to the project it inspects");
        const report = JSON.parse(r.stdout);
        assert.equal(report.ok, true, "a fresh, never-set-up repo must report ok:true — absence of setup is a gap, not a failure");
        assert.ok(Array.isArray(report.gaps) && report.gaps.length > 0, "a fresh repo should still list its gaps");
    });
    await t.test("2. setup seeds .gitignore, installs agent cards, and reports written/preserved/refreshed", () => {
        const r = sage(["setup", "--profile", "api", "--json"]);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        const report = JSON.parse(r.stdout);
        assert.ok(Array.isArray(report.files.written));
        assert.ok(Array.isArray(report.files.preserved));
        assert.ok(Array.isArray(report.files.refreshed));
        assert.ok(report.files.written.length > 0, "a first-time setup should have written at least one file");
        const gitignore = readFileSync(join(projectDir, ".gitignore"), "utf8");
        assert.match(gitignore, /^\.sage\/$/m, ".gitignore must be seeded with .sage/");
        assert.match(gitignore, /^\.worktrees\/$/m, ".gitignore must be seeded with .worktrees/");
        assert.ok(existsSync(join(projectDir, ".cursor", "agents", "reviewer.md")), "agent cards must be installed");
    });
    await t.test("3. THE MANIFEST INVARIANT: editing an installed card and re-running setup preserves the edit", () => {
        // This is the single most important assertion in this file: sage must
        // never clobber a hand-edited file it once installed. Losing that
        // guarantee is silent data loss for whoever tuned an agent card.
        const cardPath = join(projectDir, ".cursor", "agents", "implementer-backend.md");
        const original = readFileSync(cardPath, "utf8");
        const edited = original + "MY LOCAL TUNING\n";
        writeFileSync(cardPath, edited);
        const r = sage(["setup", "--profile", "api", "--json"]);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        const report = JSON.parse(r.stdout);
        assert.equal(readFileSync(cardPath, "utf8"), edited, "the user's edit must survive re-running setup, byte for byte");
        assert.ok(report.files.preserved.includes(".cursor/agents/implementer-backend.md"));
        assert.ok(!report.files.written.includes(".cursor/agents/implementer-backend.md"));
        assert.ok(!report.files.refreshed.includes(".cursor/agents/implementer-backend.md"));
    });
    const dagObj = {
        version: 1,
        sprint: "01",
        base: "main",
        constraints: ["No new runtime npm dependencies are permitted"],
        nodes: [
            {
                id: "n1",
                title: "Auth token verification",
                role: "backend",
                depends_on: [],
                owns: ["api/**"],
                interfaces: { produces: ["auth.verifyToken"] },
                acceptance: ["Rejects a request with no bearer token"],
                verify: "echo ok",
                risk: "low",
            },
            {
                id: "n2",
                title: "Profile surface consuming auth",
                role: "frontend",
                depends_on: ["n1"],
                owns: ["src/**"],
                interfaces: { consumes: ["auth.verifyToken"] },
                acceptance: ["Profile view renders for an authed user"],
                verify: "echo ok",
                risk: "low",
            },
        ],
    };
    await t.test("4. a DAG with constraints and interfaces validates clean; dag plan and dag lanes --wave 0 agree", () => {
        writeFileSync(join(projectDir, "dag.json"), JSON.stringify(dagObj, null, 2));
        const v = sage(["dag", "validate", "dag.json", "--json"]);
        assert.equal(v.status, 0, v.stdout + v.stderr);
        assert.deepEqual(JSON.parse(v.stdout).violations, []);
        const p = sage(["dag", "plan", "dag.json", "--json"]);
        assert.equal(p.status, 0, p.stdout + p.stderr);
        assert.deepEqual(JSON.parse(p.stdout).waves, [["n1"], ["n2"]]);
        // 0-indexed: wave 0 is n1's wave, and it must be reported clean by the
        // same rule `dag plan` used to place it there.
        const l = sage(["dag", "lanes", "dag.json", "--wave", "0", "--json"]);
        assert.equal(l.status, 0, l.stdout + l.stderr);
        assert.deepEqual(JSON.parse(l.stdout).violations, []);
    });
    await t.test("5. an interface-order violation is detected when a consumer stops depending on its producer", () => {
        const bad = structuredClone(dagObj);
        bad.nodes[1].depends_on = [];
        writeFileSync(join(projectDir, "bad.json"), JSON.stringify(bad, null, 2));
        const r = sage(["dag", "validate", "bad.json", "--json"]);
        assert.equal(r.status, 1, "a real violation must exit non-zero");
        const violations = JSON.parse(r.stdout).violations;
        assert.ok(violations.some((v) => v.code === "interface-order"), JSON.stringify(violations));
    });
    await t.test("6. a dependsOn typo (camelCase) is rejected as an unknown field, not a silent false PASS", () => {
        const typo = structuredClone(dagObj);
        const nodes = typo.nodes;
        delete nodes[1].depends_on;
        nodes[1].dependsOn = ["n1"];
        writeFileSync(join(projectDir, "typo.json"), JSON.stringify(typo, null, 2));
        const r = sage(["dag", "validate", "typo.json", "--json"]);
        assert.equal(r.status, 1);
        const violations = JSON.parse(r.stdout).violations;
        assert.ok(violations.some((v) => /unknown/i.test(v.message)), JSON.stringify(violations));
    });
    await t.test("7. evidence run then evidence check grades FRESH, then STALE after a real content change", () => {
        const run = sage(["evidence", "run", "--label", "tests", "--", "echo", "hello"]);
        assert.equal(run.status, 0, run.stdout + run.stderr);
        // IMPORTANT: this check's own JSON output is captured from the spawned
        // process's stdout, in memory (spawnSync's `encoding` option) — never
        // redirected to a file inside `projectDir`. `evidence check` fingerprints
        // the working tree, and an untracked file dropped into the repo under
        // test would itself change that fingerprint, invalidating the very
        // freshness check this step exists to exercise. Any scratch this test
        // needs goes outside the repo (`homeDir`, or purely in-memory as here) —
        // this is exactly the kind of self-inflicted STALE the shell version of
        // this smoke pass was careful to avoid, and it trips people up.
        const fresh = sage(["evidence", "check", "--label", "tests", "--json"]);
        assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
        assert.equal(JSON.parse(fresh.stdout).grade, "FRESH");
        writeFileSync(join(projectDir, "src", "a.ts"), "export const a = 1;\n// changed\n");
        const stale = sage(["evidence", "check", "--label", "tests", "--json"]);
        assert.equal(stale.status, 1, "evidence check must exit non-zero when the grade is STALE");
        assert.equal(JSON.parse(stale.stdout).grade, "STALE");
    });
    await t.test("8. review scope output contains no .sage/ or .worktrees/ paths", () => {
        const r = sage(["review", "scope", "--base", "HEAD", "--json"]);
        // review scope legitimately exits non-zero (SCOPE_ERROR=unmatched) when
        // the files it sees don't hit any SCOPE_* category — several of the
        // scratch files this run created (dag.json, bad.json, typo.json) are
        // exactly that case. The property under test is narrower and
        // unconditional: whatever files it DOES report must never include
        // sage's own .sage/ or .worktrees/ scratch output, regardless of exit
        // code.
        const out = JSON.parse(r.stdout);
        assert.ok(Array.isArray(out.files));
        const polluted = out.files.filter((f) => f.startsWith(".sage") || f.startsWith(".worktrees"));
        assert.deepEqual(polluted, [], "review scope must never surface sage's own artifacts as reviewable files");
    });
    await t.test("9. board wtf with no ledger exits non-zero AND prints a non-empty, actionable message", () => {
        const r = sage(["board", "wtf", "--sprint", "01"]);
        assert.notEqual(r.status, 0);
        const message = (r.stdout + r.stderr).trim();
        assert.ok(message.length > 0, "a missing ledger must fail with an actionable message, not silently");
        assert.match(message, /ledger/i);
    });
    await t.test("10. egress grants returns a grant for each configured metered lane, every one with a revokeCommand", () => {
        const r = sage(["egress", "grants", "--json"]);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        const grants = JSON.parse(r.stdout).grants;
        // The default lanes setup() writes send `product`/`qa_analyst` to
        // claude-cli (lane B / anthropic) and `reviewer`/`red_team` to
        // gemini-3.7-flash (lane C / google) — both metered, both must be
        // reported.
        assert.ok(grants.length > 0, "expected at least one metered lane grant");
        for (const g of grants) {
            assert.ok(g.lane && g.sink && g.model, JSON.stringify(g));
            assert.ok(typeof g.revokeCommand === "string" && g.revokeCommand.length > 0, `grant for lane ${g.lane} is missing a non-empty revokeCommand`);
        }
    });
    await t.test("11. uninstall --yes removes clean installed files, PRESERVES the edited card, and is idempotent", () => {
        const first = sage(["uninstall", "--yes", "--json"]);
        assert.equal(first.status, 0, first.stdout + first.stderr);
        const report1 = first.status === 0 ? JSON.parse(first.stdout) : { removed: [] };
        assert.ok(report1.removed.length > 0, "expected clean installed files to be removed");
        const cardPath = join(projectDir, ".cursor", "agents", "implementer-backend.md");
        assert.ok(existsSync(cardPath), "the user-edited card must survive uninstall");
        assert.match(readFileSync(cardPath, "utf8"), /MY LOCAL TUNING/);
        assert.ok(!existsSync(join(projectDir, ".cursor", "agents", "reviewer.md")), "a clean, untouched card must be removed");
        const second = sage(["uninstall", "--yes", "--json"]);
        assert.equal(second.status, 0, second.stdout + second.stderr);
        const report2 = JSON.parse(second.stdout);
        assert.deepEqual(report2.removed, [], "a second uninstall must be a no-op — nothing left to remove");
        assert.ok(existsSync(cardPath), "the edited card must still survive a second uninstall run");
    });
});
