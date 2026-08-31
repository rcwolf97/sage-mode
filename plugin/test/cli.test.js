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
// ---------------------------------------------------------------------------
// B1: `dag lanes --wave N` was left 1-indexed in the CLI after lanes() itself
// (lib/dag/index.ts) moved to 0-indexed to match plan().waves. Default was
// "1", and a non-numeric --wave reached lanes() as NaN. Both are fixed here:
// default is 0, pass-through is unchanged, and a non-integer is rejected
// before it ever reaches lanes().
// ---------------------------------------------------------------------------
function twoWaveDagFile(dir) {
    const dagFile = join(dir, "dag.json");
    writeFileSync(dagFile, JSON.stringify({
        version: 1,
        sprint: "01-test",
        base: "main",
        nodes: [
            {
                id: "n1",
                title: "Backend ingest path",
                role: "backend",
                owns: ["src/api/**"],
                acceptance: ["POST /ingest returns 401 without a bearer token"],
                verify: "npm test",
                risk: "low",
            },
            {
                id: "n2",
                title: "Frontend ingest form",
                role: "frontend",
                depends_on: ["n1"],
                owns: ["src/ui/**"],
                acceptance: ["The form renders a 401 error string from the API"],
                verify: "npm test",
                risk: "low",
            },
        ],
    }));
    return dagFile;
}
test("dag plan waves and dag lanes --wave <i> agree for every wave index, and an out-of-range index reports the wave violation", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    twoWaveDagFile(dir);
    const planR = spawnSync("node", [CLI, "dag", "plan", "dag.json", "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(planR.status, 0, planR.stderr);
    const { waves } = JSON.parse(planR.stdout);
    assert.equal(waves.length, 2, "fixture is expected to produce exactly two waves");
    for (let i = 0; i < waves.length; i++) {
        const lanesR = spawnSync("node", [CLI, "dag", "lanes", "dag.json", "--wave", String(i), "--json"], {
            cwd: dir,
            encoding: "utf8",
        });
        assert.equal(lanesR.status, 0, `wave ${i} should have no lane violations: ${lanesR.stdout}`);
        const out = JSON.parse(lanesR.stdout);
        assert.deepEqual(out.violations, [], `wave ${i} agrees with dag plan's wave ${i}: ${JSON.stringify(waves[i])}`);
    }
    // One past the last wave dag plan produced.
    const oobR = spawnSync("node", [CLI, "dag", "lanes", "dag.json", "--wave", String(waves.length), "--json"], {
        cwd: dir,
        encoding: "utf8",
    });
    assert.equal(oobR.status, 1);
    const oob = JSON.parse(oobR.stdout);
    assert.equal(oob.violations.length, 1);
    assert.equal(oob.violations[0].code, "wave");
});
test("dag lanes defaults --wave to 0 (not the old 1-indexed default)", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    twoWaveDagFile(dir);
    const withDefault = spawnSync("node", [CLI, "dag", "lanes", "dag.json", "--json"], { cwd: dir, encoding: "utf8" });
    const explicitZero = spawnSync("node", [CLI, "dag", "lanes", "dag.json", "--wave", "0", "--json"], {
        cwd: dir,
        encoding: "utf8",
    });
    assert.equal(withDefault.status, explicitZero.status);
    assert.equal(withDefault.stdout, explicitZero.stdout);
});
test("dag lanes rejects a non-integer --wave with a clear error instead of letting NaN reach lanes()", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    twoWaveDagFile(dir);
    const r = spawnSync("node", [CLI, "dag", "lanes", "dag.json", "--wave", "not-a-number"], {
        cwd: dir,
        encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /integer/i);
    assert.doesNotMatch(r.stdout, /"violations"/, "must fail before calling lanes(), not emit a NaN-derived result");
});
// ---------------------------------------------------------------------------
// B2: `board wtf`/`board ledger` used to exit 1 with nothing on stdout or
// stderr when the sprint had no ledger. Both now go through the throwing
// lib/board variants and must surface an actionable message (human mode) or
// a structured {error:{...}} object (--json mode), always with a non-zero
// exit.
// ---------------------------------------------------------------------------
test("sage board wtf prints an actionable stderr message (not silence) when the ledger is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const r = spawnSync("node", [CLI, "board", "wtf", "--sprint", "99"], { cwd: dir, encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.trim().length > 0, "stderr must be non-empty, not a silent failure");
    assert.match(r.stderr, /no ledger/i);
    assert.match(r.stderr, /99/);
});
test("sage board wtf --json emits a structured error object when the ledger is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const r = spawnSync("node", [CLI, "board", "wtf", "--sprint", "99", "--json"], { cwd: dir, encoding: "utf8" });
    assert.notEqual(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.error.code, "no-ledger");
    assert.equal(out.error.sprint, "99");
    assert.ok(out.error.expectedPath.length > 0);
    assert.ok(out.error.message.length > 0);
});
test("sage board ledger prints an actionable stderr message (not silence) when the ledger is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const r = spawnSync("node", [CLI, "board", "ledger", "--sprint", "99"], { cwd: dir, encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.trim().length > 0, "stderr must be non-empty, not a silent failure");
    assert.match(r.stderr, /no ledger/i);
});
test("sage board ledger --json emits a structured error object when the ledger is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const r = spawnSync("node", [CLI, "board", "ledger", "--sprint", "99", "--json"], { cwd: dir, encoding: "utf8" });
    assert.notEqual(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.error.code, "no-ledger");
    assert.equal(out.error.sprint, "99");
});
test("sage board ledger and sage board wtf still succeed normally when a ledger exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    mkdirSync(join(dir, ".sage/sprints/00"), { recursive: true });
    writeFileSync(join(dir, ".sage/sprints/00/ledger.md"), "# Sprint 00\n\n## Nodes\n- n1: done\n\n## Circuit\n- WTF-LIKELIHOOD: 0\n");
    const ledgerR = spawnSync("node", [CLI, "board", "ledger", "--sprint", "00", "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(ledgerR.status, 0, ledgerR.stderr);
    const wtfR = spawnSync("node", [CLI, "board", "wtf", "--sprint", "00", "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(wtfR.status, 0, wtfR.stderr);
});
// ---------------------------------------------------------------------------
// W4: gate() now attaches a non-enumerable `.rejected` list of rows that
// failed finding-schema validation instead of silently dropping them. `sage
// review gate` must surface those rejects — never a clean bill of health —
// and exit non-zero whenever at least one row was rejected, even when other
// rows in the same batch validated fine.
// ---------------------------------------------------------------------------
const VALID_FINDING_LINE = JSON.stringify({
    severity: "HIGH",
    confidence: 8,
    path: "src/foo.ts",
    category: "correctness",
    summary: "off-by-one on the last page",
    specialist: "correctness",
    evidence: "src/foo.ts:42",
});
const MALFORMED_FINDING_LINE = JSON.stringify({
    severity: "SUPER-BAD",
    confidence: 8,
    path: "src/foo.ts",
    category: "correctness",
    summary: "this row has an invalid severity",
    specialist: "correctness",
});
test("sage review gate surfaces rejected rows and exits non-zero, while the valid finding still comes through (human mode)", () => {
    const r = spawnSync("node", [CLI, "review", "gate"], {
        input: `${VALID_FINDING_LINE}\n${MALFORMED_FINDING_LINE}\n`,
        encoding: "utf8",
    });
    assert.notEqual(r.status, 0, "at least one reject must flip the exit code non-zero");
    assert.match(r.stdout, /REJECTED \(1\)/);
    assert.match(r.stdout, /severity/i);
    const findingLine = r.stdout.split("\n").find((l) => l.startsWith("{"));
    assert.ok(findingLine, "the valid finding must still be printed");
    const finding = JSON.parse(findingLine);
    assert.equal(finding.path, "src/foo.ts");
    assert.equal(finding.severity, "HIGH");
});
test("sage review gate --json emits {findings, rejected} and exits non-zero when a row was rejected", () => {
    const r = spawnSync("node", [CLI, "review", "gate", "--json"], {
        input: `${VALID_FINDING_LINE}\n${MALFORMED_FINDING_LINE}\n`,
        encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.findings.length, 1);
    assert.equal(out.findings[0].path, "src/foo.ts");
    assert.equal(out.rejected.length, 1);
    assert.match(out.rejected[0].reason, /severity/i);
    assert.equal(out.rejected[0].row.summary, "this row has an invalid severity");
});
test("sage review gate exits 0 and reports no rejects when every row is well-formed", () => {
    const r = spawnSync("node", [CLI, "review", "gate", "--json"], {
        input: `${VALID_FINDING_LINE}\n`,
        encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.findings.length, 1);
    assert.deepEqual(out.rejected, []);
});
// ---------------------------------------------------------------------------
// W1: `sage egress list|verify|grants`, wiring lib/egress (previously no CLI
// surface at all).
// ---------------------------------------------------------------------------
test("sage egress list|verify|grants are reachable from the CLI and start clean on a fresh repo", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const listR = spawnSync("node", [CLI, "egress", "list", "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(listR.status, 0, listR.stderr);
    assert.deepEqual(JSON.parse(listR.stdout).rows, []);
    const verifyR = spawnSync("node", [CLI, "egress", "verify", "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(verifyR.status, 0, verifyR.stderr);
    assert.equal(JSON.parse(verifyR.stdout).ok, true);
    const grantsR = spawnSync("node", [CLI, "egress", "grants", "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(grantsR.status, 0, grantsR.stderr);
    assert.deepEqual(JSON.parse(grantsR.stdout).grants, []);
});
test("sage egress list renders a human-readable aligned table naming every recorded row", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    mkdirSync(join(dir, ".sage"), { recursive: true });
    writeFileSync(join(dir, ".sage", "egress.jsonl"), JSON.stringify({
        seq: 1,
        ts: "2026-01-01T00:00:00.000Z",
        sink: "anthropic",
        model: "claude-x",
        lane: "B",
        bytes: 123,
        content_sha256: "a".repeat(64),
        redactions: 2,
        prev_hash: "0".repeat(64),
        hash: "1".repeat(64),
    }) + "\n");
    const r = spawnSync("node", [CLI, "egress", "list"], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /seq/);
    assert.match(r.stdout, /anthropic/);
    assert.match(r.stdout, /claude-x/);
    assert.match(r.stdout, /123/);
});
test("sage egress verify exits 3 on a broken chain (non-zero-on-failure convention), 0 when ok", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    mkdirSync(join(dir, ".sage"), { recursive: true });
    const row = {
        seq: 1,
        ts: "2026-01-01T00:00:00.000Z",
        sink: "anthropic",
        model: "claude-x",
        lane: "B",
        bytes: 123,
        content_sha256: "a".repeat(64),
        redactions: 0,
        prev_hash: "0".repeat(64),
        hash: "deadbeef".repeat(8), // wrong on purpose — does not match recomputed hash
    };
    writeFileSync(join(dir, ".sage", "egress.jsonl"), JSON.stringify(row) + "\n");
    const r = spawnSync("node", [CLI, "egress", "verify", "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 3);
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, false);
    assert.equal(out.brokenAt, 1);
});
// ---------------------------------------------------------------------------
// A1: opt-in --fenced truncation sentinels.
// ---------------------------------------------------------------------------
test("--fenced wraps stdout in matched begin/end markers naming the verb, and is off by default", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const plain = spawnSync("node", [CLI, "egress", "verify", "--json"], { cwd: dir, encoding: "utf8" });
    assert.doesNotMatch(plain.stdout, /=== sage/, "--fenced must be opt-in, not the default");
    const fenced = spawnSync("node", [CLI, "egress", "verify", "--json", "--fenced"], { cwd: dir, encoding: "utf8" });
    assert.match(fenced.stdout, /^=== sage egress verify begin ===\n/);
    assert.match(fenced.stdout, /\n=== sage egress verify end ===\n?$/);
});
// ---------------------------------------------------------------------------
// W2: setup lifecycle — sage setup --check (read-only) and sage uninstall
// (guarded delete).
// ---------------------------------------------------------------------------
test("sage setup --check is read-only, reachable, and reports ok:true on a healthy install", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const home = mkdtempSync(join(tmpdir(), "sage-cli-home-"));
    const env = { ...process.env, HOME: home };
    const setupR = spawnSync("node", [CLI, "setup"], { cwd: dir, encoding: "utf8", env });
    assert.equal(setupR.status, 0, setupR.stderr);
    const before = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" }).stdout;
    const checkR = spawnSync("node", [CLI, "setup", "--check", "--json"], { cwd: dir, encoding: "utf8", env });
    assert.equal(checkR.status, 0, checkR.stderr);
    const after = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" }).stdout;
    assert.equal(before, after, "setup --check must not write anything");
    const out = JSON.parse(checkR.stdout);
    assert.equal(out.ok, true);
    assert.ok(Array.isArray(out.gaps));
    assert.ok(Array.isArray(out.interpreters) && out.interpreters.length > 0);
    assert.ok("sageIgnored" in out.gitignore);
    assert.ok("ownedClean" in out.manifest);
});
test("sage uninstall refuses to run without --yes or --json, and is idempotent once confirmed", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const home = mkdtempSync(join(tmpdir(), "sage-cli-home-"));
    const env = { ...process.env, HOME: home };
    spawnSync("node", [CLI, "setup"], { cwd: dir, encoding: "utf8", env });
    const refused = spawnSync("node", [CLI, "uninstall"], { cwd: dir, encoding: "utf8", env });
    assert.notEqual(refused.status, 0);
    assert.ok(refused.stderr.trim().length > 0);
    assert.match(refused.stderr, /--yes/);
    const confirmed = spawnSync("node", [CLI, "uninstall", "--yes", "--json"], { cwd: dir, encoding: "utf8", env });
    assert.equal(confirmed.status, 0, confirmed.stderr);
    const out = JSON.parse(confirmed.stdout);
    assert.ok(out.removed.length > 0);
    const again = spawnSync("node", [CLI, "uninstall", "--yes", "--json"], { cwd: dir, encoding: "utf8", env });
    assert.equal(again.status, 0, again.stderr);
    assert.deepEqual(JSON.parse(again.stdout).removed, []);
});
test("sage uninstall proceeds without --yes when --json is passed (non-interactive)", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir);
    const home = mkdtempSync(join(tmpdir(), "sage-cli-home-"));
    const env = { ...process.env, HOME: home };
    spawnSync("node", [CLI, "setup"], { cwd: dir, encoding: "utf8", env });
    const r = spawnSync("node", [CLI, "uninstall", "--json"], { cwd: dir, encoding: "utf8", env });
    assert.equal(r.status, 0, r.stderr);
});
// ---------------------------------------------------------------------------
// W3: `sage evidence run --allow-unignored` threads through to run(), which
// otherwise refuses to run when .sage/ isn't gitignored.
// ---------------------------------------------------------------------------
test("sage evidence run refuses with a clear message when .sage/ is not gitignored, and --allow-unignored proceeds anyway", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-cli-"));
    gitInit(dir); // note: no .gitignore entry for .sage/ here
    const refused = spawnSync("node", [CLI, "evidence", "run", "--label", "t", "--", "node", "-e", "process.exit(0)"], {
        cwd: dir,
        encoding: "utf8",
    });
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /not gitignored/i);
    assert.match(refused.stderr, /--allow-unignored/);
    const allowed = spawnSync("node", [CLI, "evidence", "run", "--label", "t", "--allow-unignored", "--", "node", "-e", "process.exit(0)"], { cwd: dir, encoding: "utf8" });
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.match(allowed.stderr, /warning/i);
});
// ---------------------------------------------------------------------------
// --help must list every new verb this file wires up, so it never lies about
// what's callable.
// ---------------------------------------------------------------------------
test("--help advertises every newly-wired verb", () => {
    const r = spawnSync("node", [CLI, "--help"], { encoding: "utf8" });
    assert.match(r.stdout, /sage setup --check/);
    assert.match(r.stdout, /sage uninstall/);
    assert.match(r.stdout, /sage egress list/);
    assert.match(r.stdout, /sage egress verify/);
    assert.match(r.stdout, /sage egress grants/);
    assert.match(r.stdout, /--allow-unignored/);
    assert.match(r.stdout, /--fenced/);
    assert.match(r.stdout, /--wave N.*0-indexed/);
});
