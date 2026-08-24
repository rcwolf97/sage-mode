import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { wtree, run, check } from "../lib/evidence/index.js";
function gitInit(dir) {
    spawnSync("git", ["init"], { cwd: dir });
    spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: dir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
    writeFileSync(join(dir, "a.txt"), "one\n");
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync("git", ["commit", "-m", "init"], { cwd: dir });
}
test("wtree does not mutate the real .git/index", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
    gitInit(dir);
    const idx = join(dir, ".git", "index");
    const before = readFileSync(idx);
    const w = wtree(dir);
    assert.ok(w && /^[0-9a-f]{40}$/.test(w));
    const after = readFileSync(idx);
    assert.deepEqual(before, after);
});
test("wtree is stable across git commit of identical content and changes on a new untracked file", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
    gitInit(dir);
    writeFileSync(join(dir, "a.txt"), "one\n"); // already committed identical
    const a = wtree(dir);
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync("git", ["commit", "-m", "noop", "--allow-empty"], { cwd: dir });
    writeFileSync(join(dir, "a.txt"), "one\n");
    const b = wtree(dir);
    assert.equal(a, b);
    writeFileSync(join(dir, "new.ts"), "x\n");
    const c = wtree(dir);
    assert.notEqual(a, c);
});
test("evidence check grades STALE when wtree is absent, malformed, or not 40 hex", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
    gitInit(dir);
    mkdirSync(join(dir, ".sage", "sprints", "00"), { recursive: true });
    const ledger = join(dir, ".sage", "sprints", "00", "evidence.jsonl");
    writeFileSync(ledger, JSON.stringify({
        ts: new Date().toISOString(),
        label: "tests",
        command: "true",
        cmd_sha256: "x",
        exit: 0,
        duration_s: 0,
    }) + "\n");
    const r1 = check({ label: "tests", cwd: dir });
    assert.equal(r1.grade, "STALE");
    writeFileSync(ledger, JSON.stringify({
        ts: new Date().toISOString(),
        label: "tests",
        command: "true",
        cmd_sha256: "x",
        exit: 0,
        duration_s: 0,
        wtree: "not-hex",
    }) + "\n");
    const r2 = check({ label: "tests", cwd: dir });
    assert.equal(r2.grade, "STALE");
    writeFileSync(ledger, JSON.stringify({
        ts: new Date().toISOString(),
        label: "tests",
        command: "true",
        cmd_sha256: "x",
        exit: 0,
        duration_s: 0,
        wtree: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    }) + "\n");
    const r3 = check({ label: "tests", cwd: dir });
    assert.equal(r3.grade, "STALE");
});
test("evidence run returns the child exit code even when ledger append fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
    gitInit(dir);
    // make sprints path a file so append fails
    mkdirSync(join(dir, ".sage"), { recursive: true });
    writeFileSync(join(dir, ".sage", "sprints"), "not-a-dir");
    const code = await run({ label: "tests", command: ["false"], cwd: dir });
    assert.equal(code, 1);
    const code0 = await run({ label: "tests", command: ["true"], cwd: dir });
    assert.equal(code0, 0);
});
void existsSync;
