import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { wtree, run, check } from "../lib/evidence/index.js";

function gitInit(dir: string): void {
  spawnSync("git", ["init"], { cwd: dir });
  spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: dir });
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
  writeFileSync(join(dir, "a.txt"), "one\n");
  spawnSync("git", ["add", "-A"], { cwd: dir });
  spawnSync("git", ["commit", "-m", "init"], { cwd: dir });
}

// Real deployments always gitignore .sage/ (lib/setup/index.ts writes the
// entry on bootstrap) — evidence.jsonl and the per-run log files run() writes
// under .sage/sprints/*/logs/ must never themselves count as a working-tree
// change between the before/after wtree snapshots, or every real run() call
// would spuriously fingerprint-mismatch on its own bookkeeping. The plain
// gitInit() above deliberately omits this so the two tests below opt in
// explicitly to the real-world precondition their race depends on.
function gitInitIgnoringSage(dir: string): void {
  spawnSync("git", ["init"], { cwd: dir });
  spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: dir });
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
  writeFileSync(join(dir, ".gitignore"), ".sage/\n.worktrees/\n");
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
  writeFileSync(
    ledger,
    JSON.stringify({
      ts: new Date().toISOString(),
      label: "tests",
      command: "true",
      cmd_sha256: "x",
      exit: 0,
      duration_s: 0,
    }) + "\n",
  );
  const r1 = check({ label: "tests", cwd: dir });
  assert.equal(r1.grade, "STALE");
  writeFileSync(
    ledger,
    JSON.stringify({
      ts: new Date().toISOString(),
      label: "tests",
      command: "true",
      cmd_sha256: "x",
      exit: 0,
      duration_s: 0,
      wtree: "not-hex",
    }) + "\n",
  );
  const r2 = check({ label: "tests", cwd: dir });
  assert.equal(r2.grade, "STALE");
  writeFileSync(
    ledger,
    JSON.stringify({
      ts: new Date().toISOString(),
      label: "tests",
      command: "true",
      cmd_sha256: "x",
      exit: 0,
      duration_s: 0,
      wtree: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    }) + "\n",
  );
  const r3 = check({ label: "tests", cwd: dir });
  assert.equal(r3.grade, "STALE");
});

test("evidence run returns the child exit code even when ledger append fails", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
  // .sage/ must be gitignored here (gitInitIgnoringSage, not gitInit) —
  // otherwise this now hits the self-invalidation guard added for bug (2)
  // and run() refuses to start at all, which is a different behavior than
  // the one this test exists to pin (exit-code passthrough around a ledger
  // append failure).
  gitInitIgnoringSage(dir);
  // make sprints path a file so append fails
  mkdirSync(join(dir, ".sage"), { recursive: true });
  writeFileSync(join(dir, ".sage", "sprints"), "not-a-dir");
  const code = await run({ label: "tests", command: ["false"], cwd: dir });
  assert.equal(code, 1);
  const code0 = await run({ label: "tests", command: ["true"], cwd: dir });
  assert.equal(code0, 0);
});

// TOCTOU guard, exercised end-to-end through run() with a real subprocess —
// not the hand-crafted-ledger STALE cases above, which only exercise check()
// in isolation against a static fixture and never touch run()'s own
// before/after wtree capture around actual command execution. A command
// that mutates a tracked file while it runs, and leaves it mutated by the
// time it exits, must never be recordable as FRESH: before !== after means
// run() must leave rec.wtree unset, and check() must then grade STALE.
test("evidence run leaves wtree unset (and check grades STALE) when the test command mutates a tracked file mid-run and does not revert it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
  gitInitIgnoringSage(dir);
  await run({ label: "tests", command: ["sh", "-c", "echo mutated >> a.txt"], cwd: dir });
  const ledger = join(dir, ".sage", "sprints", "00", "evidence.jsonl");
  const rec = JSON.parse(readFileSync(ledger, "utf8").trim().split("\n").at(-1)!);
  assert.equal(rec.wtree, undefined);
  const r = check({ label: "tests", cwd: dir });
  assert.equal(r.grade, "STALE");
});

// The sharper TOCTOU race: the test command mutates a tracked file and then
// reverts it back to byte-identical content before exiting. The tree hash
// taken before the command started and the one taken after it finished are
// therefore equal — but that equality is spurious: whatever the test command
// actually observed and asserted against mid-run was the mutated content,
// not the tree state the recorded evidence claims to vouch for. A
// before/after snapshot pair is blind to any change-then-revert that nets to
// zero inside that window, so this is expected to surface a real gap in the
// guard (see the final summary) rather than a case the current
// implementation already handles: run() has no way to observe the tree
// mid-execution, only at its two snapshot points, so it records this exactly
// like a run that never touched a.txt at all and check() reports FRESH.
test("evidence TOCTOU: a test command that mutates a tracked file and reverts it to identical content before exiting must not be graded FRESH", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
  gitInitIgnoringSage(dir);
  await run({ label: "tests", command: ["sh", "-c", "echo two > a.txt; echo one > a.txt"], cwd: dir });
  const r = check({ label: "tests", cwd: dir });
  assert.equal(r.grade, "STALE");
});

// -----------------------------------------------------------------------
// Bug (2): evidence self-invalidation when .sage/ isn't gitignored.
// -----------------------------------------------------------------------
//
// Reproduced: without a .gitignore entry for .sage/, run()'s own log-file
// write is itself an untracked working-tree change, so the TOCTOU guard
// (correctly) never records a wtree, and check() then grades every run
// STALE forever with a reason string ("wtree missing or not 40 hex
// characters") that names no actual cause. The fix is to detect the
// unignored state up front and FAIL LOUD instead of running a check that
// can never pass — these tests pin that new behavior directly, plus the
// --allow-unignored escape hatch for a caller who wants the old (broken)
// behavior anyway.

function captureStderr(): { text(): string; restore(): void } {
  const chunks: string[] = [];
  const real = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  return {
    text: () => chunks.join(""),
    restore: () => {
      process.stderr.write = real;
    },
  };
}

test("evidence run refuses to start (loudly) when .sage/ is not gitignored", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
  gitInit(dir); // deliberately no .gitignore entry for .sage/
  const cap = captureStderr();
  let code: number;
  try {
    code = await run({ label: "tests", command: ["true"], cwd: dir });
  } finally {
    cap.restore();
  }
  assert.equal(code, 1);
  const err = cap.text();
  assert.match(err, /not gitignored/);
  assert.match(err, /\.sage\//);
  assert.match(err, /--allow-unignored/);
  // Must not have run the command at all — no evidence record written.
  assert.equal(existsSync(join(dir, ".sage", "sprints", "00", "evidence.jsonl")), false);
});

test("evidence run --allow-unignored downgrades the FAIL to a warning and proceeds, reproducing the original silent-forever-STALE bug", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
  gitInit(dir); // .sage/ not gitignored
  const cap = captureStderr();
  let code: number;
  try {
    code = await run({ label: "tests", command: ["true"], cwd: dir, allowUnignored: true });
  } finally {
    cap.restore();
  }
  assert.equal(code, 0);
  assert.match(cap.text(), /warning:.*not gitignored/s);
  // The run did proceed and record something, but — this is the bug this
  // module can only warn about, not fix outright, once the caller has
  // opted in — the run's own bookkeeping write means it can never grade
  // FRESH: run() truthfully leaves wtree unset rather than fabricating one.
  const r = check({ label: "tests", cwd: dir });
  assert.equal(r.grade, "STALE");
  assert.match(r.reason, /gitignored/);
});

test("evidence run proceeds normally (no warning) when .sage/ and .worktrees/ are both gitignored", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
  gitInitIgnoringSage(dir);
  const cap = captureStderr();
  let code: number;
  try {
    code = await run({ label: "tests", command: ["true"], cwd: dir });
  } finally {
    cap.restore();
  }
  assert.equal(code, 0);
  assert.equal(cap.text(), "");
  const r = check({ label: "tests", cwd: dir });
  assert.equal(r.grade, "FRESH");
});

test("evidence check STALE reasons name their actual cause instead of a generic 'wtree missing' message", () => {
  const dir = mkdtempSync(join(tmpdir(), "sage-ev-"));
  gitInit(dir);
  const r1 = check({ label: "nope", cwd: dir });
  assert.equal(r1.grade, "STALE");
  assert.match(r1.reason, /no evidence record/);

  mkdirSync(join(dir, ".sage", "sprints", "00"), { recursive: true });
  const ledger = join(dir, ".sage", "sprints", "00", "evidence.jsonl");
  writeFileSync(
    ledger,
    JSON.stringify({
      ts: new Date().toISOString(),
      label: "tests",
      command: "true",
      cmd_sha256: "x",
      exit: 1,
      duration_s: 0,
    }) + "\n",
  );
  const r2 = check({ label: "tests", cwd: dir });
  assert.equal(r2.grade, "STALE");
  assert.match(r2.reason, /exited 1/);
});

void existsSync;
