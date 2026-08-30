import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
// This file exists because an independent complex-workload review found a
// real gap none of the existing tests caught: lib/board's evaluateCircuitBreaker
// and lib/review's checkRecommendation were both real, unit-tested functions
// that skills/sage-build/SKILL.md and skills/sage-review/SKILL.md instructed
// the agent to run — but neither was reachable from the `sage` CLI, the only
// interface those skills actually teach the agent to use. Every existing test
// imports lib/*/index.js directly, so the CLI wiring itself was never
// exercised — a function can be "tested" and still be unreachable from the
// product surface a real user's agent would use. These tests spawn the real
// compiled CLI binary (lib/cli.js) instead of importing library functions,
// specifically to catch that class of gap going forward.
const CLI = join(import.meta.dirname, "..", "lib", "cli.js");
function gitInit(dir) {
    spawnSync("git", ["init"], { cwd: dir });
    spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: dir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
    writeFileSync(join(dir, "a.txt"), "one\n");
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync("git", ["commit", "-m", "init"], { cwd: dir });
}
test("sage board wtf is reachable from the CLI and returns a computed score", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    mkdirSync(join(dir, ".sage/sprints/00"), { recursive: true });
    writeFileSync(join(dir, ".sage/sprints/00/ledger.md"), "# Sprint 00\n\n## Nodes\n- n1: done\n\n## Circuit\n- WTF-LIKELIHOOD: 0\n");
    const r = spawnSync("node", [CLI, "board", "wtf", "--sprint", "00", "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.score, 0);
    assert.equal(out.stopAndAsk, false);
    assert.equal(out.hardCapReached, false);
    // Prove it's actually computed, not just echoing the ledger's own
    // hand-written WTF-LIKELIHOOD line — the exact self-report failure mode
    // this mechanism exists to close.
    assert.ok("breakdown" in out, "result must expose the computed breakdown, not just a bare number");
});
test("sage board wtf exits 1 when the sprint's ledger does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const r = spawnSync("node", [CLI, "board", "wtf", "--sprint", "99", "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 1);
});
test("sage review recommendation is reachable from the CLI and fails a review missing the section", () => {
    const r = spawnSync("node", [CLI, "review", "recommendation", "--json"], {
        input: "## Findings\nnothing here\n",
        encoding: "utf8",
    });
    assert.equal(r.status, 1);
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, false);
    assert.ok(out.issues.some((s) => /missing/i.test(s)));
});
test("sage review recommendation passes a well-formed recommendation via --file", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    const file = join(dir, "review.md");
    writeFileSync(file, "## Recommendation\nFix it because src/foo.ts:12 mishandles the empty case\n");
    const r = spawnSync("node", [CLI, "review", "recommendation", "--file", file, "--json"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, true);
});
test("sage board and sage review usage text advertise the new subcommands, so --help doesn't lie about what's callable", () => {
    const r = spawnSync("node", [CLI, "--help"], { encoding: "utf8" });
    assert.match(r.stdout, /sage board wtf/);
    assert.match(r.stdout, /sage review recommendation/);
});
// A complex-workload review caught this live: dag.json's `base` is only
// checked by validate() for being *present*, never for actually resolving
// to a git ref. worktree() only discovers that when it shells out to `git
// worktree add ... <base>`, and the resulting Error used to propagate
// uncaught to main()'s top-level handler — which dumps `err.stack` to
// stderr instead of the structured `{"violations": [...]}` shape every
// other `sage dag` subcommand returns on failure. A bad base looked like a
// crash in the tool, not a reportable, expected violation.
test("sage dag worktree reports an unresolvable dag.base as a structured violation, not a raw stack trace", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const dagFile = join(dir, "dag.json");
    writeFileSync(dagFile, JSON.stringify({
        version: 1,
        sprint: "00-x",
        base: "this-ref-does-not-exist",
        nodes: [
            {
                id: "n1",
                title: "Do something useful here",
                role: "backend",
                owns: ["src/a.ts"],
                acceptance: ["returns 200 on success"],
                verify: "npm test",
                risk: "low",
            },
        ],
    }));
    const r = spawnSync("node", [CLI, "dag", "worktree", "n1", "--dag", "dag.json", "--json"], {
        cwd: dir,
        encoding: "utf8",
    });
    assert.equal(r.status, 1);
    assert.doesNotMatch(r.stderr, /at worktree \(/, "must not leak a raw stack trace to stderr");
    const out = JSON.parse(r.stdout);
    assert.ok(Array.isArray(out.violations) && out.violations.length === 1);
    assert.match(out.violations[0].message, /this-ref-does-not-exist/);
});
