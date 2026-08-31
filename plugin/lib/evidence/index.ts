import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, writeSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { git, gitRoot, projectSageDir, sha256 } from "../util.js";

const LOG_MAX = 2 * 1024 * 1024;
const HEX40 = /^[0-9a-f]{40}$/;

// Matches an allow-path entry on a full path segment boundary — never a raw
// string prefix — so e.g. "CHANGELOG.md" does not also match
// "CHANGELOG.md.bak" (or vice versa). A trailing "*" (e.g. "dist/*") opts an
// entry into directory-prefix matching; anything else must match exactly.
function matchesAllowPath(path: string, entry: string): boolean {
  const dir = (entry.endsWith("*") ? entry.slice(0, -1) : entry).replace(/\/$/, "");
  return path === dir || path.startsWith(dir + "/");
}

export interface EvidenceRecord {
  ts: string;
  label: string;
  command: string;
  cmd_sha256: string;
  exit: number;
  duration_s: number;
  commit?: string;
  dirty?: boolean;
  wtree?: string;
  log_path?: string;
  node?: string;
  /** Verdict taxonomy. Distinct from Freshness.grade (FRESH|STALE). */
  grade?: "type-check-only" | "unit-test-verified" | "live-verified" | "verifier-blocked";
}

export type Freshness = { grade: "FRESH" | "STALE"; reason: string; record?: EvidenceRecord };

// ---------------------------------------------------------------------------
// Self-invalidation guard: is .sage/ (and .worktrees/) actually gitignored?
// ---------------------------------------------------------------------------
//
// run() writes its own log file under <root>/.sage/sprints/NN/logs/ (see
// below) and appends to <root>/.sage/sprints/NN/evidence.jsonl. If .sage/ is
// not gitignored, those writes are themselves untracked working-tree changes
// that land between the pre-run and post-run wtree() snapshots — so the
// TOCTOU guard (correctly) refuses to record a wtree, and check() then grades
// every subsequent run STALE forever, with a reason string ("wtree missing or
// not 40 hex characters") that points at nothing an operator can act on.
// .worktrees/ has the same problem: node worktrees live inside the project
// directory, and an untracked/dirty file under one is picked up by wtree()'s
// `git add -A` against the temp index exactly like any other untracked file.
//
// git check-ignore -q is the authoritative check — it reasons from git's own
// pattern-matching (global, per-repo, and nested .gitignore files alike)
// rather than re-implementing ignore-file parsing here. It matches by path
// pattern, not by file existence, so a synthetic probe path under a
// not-yet-created directory (neither .sage/ nor .worktrees/ need exist yet
// for this to give a real answer) is sufficient — nothing is created on disk.
const IGNORE_PROBE_NAME = ".sage-ignore-probe";
const SAGE_SCRATCH_DIRS = [".sage", ".worktrees"];

export interface IgnoreCheck {
  ok: boolean;
  /** Directories (with trailing "/") confirmed NOT ignored. Empty when ok. */
  unignored: string[];
  /** Present when !ok: names the cause and the fix, for FAIL LOUD callers. */
  reason?: string;
}

function checkSageIgnored(root: string): IgnoreCheck {
  const unignored: string[] = [];
  for (const dir of SAGE_SCRATCH_DIRS) {
    const probe = join(dir, IGNORE_PROBE_NAME);
    const res = spawnSync("git", ["check-ignore", "-q", probe], { cwd: root });
    // status 0 = ignored. status 1 = git's own, authoritative "not ignored".
    // Anything else (128 = not a git repo, null = spawn failure, etc.) is
    // "cannot tell" and is deliberately NOT treated as a violation — fail
    // open on ambiguity, matching lib/board/index.ts's deriveWtfSignals
    // posture toward repo state it can't confirm.
    if (res.status === 1) unignored.push(dir + "/");
  }
  if (!unignored.length) return { ok: true, unignored: [] };
  return {
    ok: false,
    unignored,
    reason:
      `${unignored.join(" and ")} not gitignored — sage's own writes there ` +
      `(evidence.jsonl, run logs, worktree checkouts) change the working-tree ` +
      `fingerprint between the pre-run and post-run snapshot, so \`sage evidence check\` ` +
      `can never grade FRESH. Fix: add\n  ${unignored.join("\n  ")}\nto .gitignore and commit it.`,
  };
}

export function wtree(cwd?: string): string | null {
  const root = gitRoot(cwd);
  if (!root) return null;
  const realIndex = git(["rev-parse", "--git-path", "index"], root);
  let realPath = (realIndex.stdout || "").trim();
  if (realPath && !realPath.startsWith("/")) realPath = join(root, realPath);
  const tmp = join(tmpdir(), `sage-wtree-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: tmp };
  try {
    let seeded = false;
    if (realPath && existsSync(realPath)) {
      try {
        copyFileSync(realPath, tmp);
        seeded = true;
      } catch (err) {
        process.stderr.write(
          `sage evidence: warning: could not copy index for fast-path fingerprint, losing the 40x stat-cache speedup (falling back to git read-tree HEAD): ${String(err)}\n`,
        );
      }
    }
    if (!seeded) {
      const rt = spawnSync("git", ["read-tree", "HEAD"], { cwd: root, env, encoding: "utf8" });
      if (rt.status !== 0) return null;
    }
    const add = spawnSync("git", ["add", "-A"], { cwd: root, env, encoding: "utf8" });
    if (add.status !== 0) return null;
    const wt = spawnSync("git", ["write-tree"], { cwd: root, env, encoding: "utf8" });
    const out = (wt.stdout || "").trim();
    return HEX40.test(out) ? out : null;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

// A sharper TOCTOU guard than wtree() alone can provide. wtree() is
// content-addressed by design (that's what makes it survive an identical
// re-commit or a rebase) — but that same property makes it blind to a
// mutate-then-revert-to-identical-content race: a test command that writes
// different content to a tracked file mid-run and then writes the original
// content back before exiting produces before === after on content alone,
// even though whatever the test actually observed and asserted against
// mid-run was the mutated version, not the tree state being certified.
// mtime is not content-addressed — a real write syscall updates it even when
// the final bytes match the original — so comparing a fingerprint of every
// tracked file's mtime, in addition to the tree hash, catches exactly this
// case. Deliberately conservative: this can flag a run STALE even when a
// tracked file was touched and rewritten with genuinely identical content
// for an unrelated, benign reason. That tradeoff is intentional and matches
// this plugin's stated philosophy elsewhere (lib/dag's lane-overlap check:
// "false positives are acceptable; false negatives are not") — an
// occasional redundant re-run costs little; a false FRESH on evidence the
// suite never actually ran against costs a lot.
function trackedMtimeFingerprint(cwd: string): string | null {
  const root = gitRoot(cwd);
  if (!root) return null;
  const ls = git(["ls-files"], root);
  if (ls.status !== 0) return null;
  const files = (ls.stdout || "").split("\n").filter(Boolean);
  const parts: string[] = [];
  for (const f of files) {
    try {
      const st = statSync(join(root, f));
      parts.push(`${f}:${st.mtimeMs}`);
    } catch {
      parts.push(`${f}:missing`);
    }
  }
  return sha256(parts.sort().join("\n"));
}

export function evidencePath(root?: string, sprintId?: string): string {
  const sage = projectSageDir(root);
  if (sprintId === "session") {
    return join(sage, "evidence", "session", "evidence.jsonl");
  }
  const sprint = activeSprintDir(root, sprintId);
  return join(sprint || join(sage, "sprints", "00"), "evidence.jsonl");
}

export function findingsPath(root?: string, sprintId?: string): string {
  const sage = projectSageDir(root);
  if (sprintId === "session") {
    return join(sage, "findings", "session", "findings.jsonl");
  }
  const sprint = activeSprintDir(root, sprintId);
  return join(sprint || join(sage, "sprints", "00"), "findings.jsonl");
}

// NOTE: `sprintId`, when given, is used explicitly instead of falling back to
// "lexicographically last" — this is what lets `evidence check`/`run` target
// a specific sprint's ledger (see tech-spec.md §5.7) instead of silently
// reading whatever sprint directory happens to sort last on disk. Omitting it
// preserves the prior default (lexicographically-last) for backward compat.
// TODO(cli): lib/cli.ts does not yet thread an explicit sprint through here —
// `sage evidence run|check` always call with no sprintId today. `sage board`
// already has a `--sprint S` flag (see lib/cli.ts ~line 292) that could be
// mirrored for `evidence run|check` so callers can opt in explicitly; that
// CLI wiring is out of this module's ownership and is left for the CLI owner.
export function activeSprintDir(root?: string, sprintId?: string): string | null {
  const sage = projectSageDir(root);
  const sprints = join(sage, "sprints");
  if (!existsSync(sprints) || !statSync(sprints).isDirectory()) return null;
  if (sprintId) {
    const explicit = join(sprints, sprintId);
    return existsSync(explicit) && statSync(explicit).isDirectory() ? explicit : null;
  }
  const dirs = readdirSync(sprints)
    .map((n) => join(sprints, n))
    .filter((p) => statSync(p).isDirectory())
    .sort();
  return dirs.at(-1) || null;
}

export function readEvidence(root?: string, sprintId?: string): EvidenceRecord[] {
  const p = evidencePath(root, sprintId);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as EvidenceRecord;
      } catch {
        return null;
      }
    })
    .filter((x): x is EvidenceRecord => !!x);
}

export async function run(opts: {
  label: string;
  command: string[];
  cwd?: string;
  node?: string;
  sprintId?: string;
  grade?: EvidenceRecord["grade"];
  /** Downgrade an unignored .sage/.worktrees FAIL to a warning and proceed
   * anyway. The run's evidence may then never grade FRESH (see
   * checkSageIgnored above) — this is an explicit escape hatch for a caller
   * who understands that tradeoff, not a default. */
  allowUnignored?: boolean;
}): Promise<number> {
  const cwd = opts.cwd || process.cwd();

  // FAIL LOUD before doing any work: a run whose own bookkeeping writes can
  // never let it grade FRESH is a run not worth starting, and silently
  // starting it anyway is exactly the self-invalidation bug this guards
  // against. Only enforced inside an actual git repo — gitRoot() returning
  // null means wtree() will already fail closed for unrelated reasons, and
  // there is nothing here to warn about.
  const repoRoot = gitRoot(cwd);
  if (repoRoot) {
    const ignoreStatus = checkSageIgnored(repoRoot);
    if (!ignoreStatus.ok) {
      if (opts.allowUnignored) {
        process.stderr.write(
          `sage evidence: warning: ${ignoreStatus.reason}\n` +
            `(continuing because --allow-unignored was passed; this run may never grade FRESH)\n`,
        );
      } else {
        process.stderr.write(
          `sage evidence: refusing to run — ${ignoreStatus.reason}\n` +
            `(pass --allow-unignored to downgrade this to a warning and proceed anyway)\n`,
        );
        return 1;
      }
    }
  }

  const before = wtree(cwd);
  const beforeMtime = trackedMtimeFingerprint(cwd);
  const started = Date.now();
  const cmdStr = opts.command.join(" ");
  const cmdHash = sha256(cmdStr);
  const sage = projectSageDir(cwd);
  const sprint = opts.sprintId === "session" ? join(sage, "evidence", "session") : activeSprintDir(cwd, opts.sprintId) || join(sage, "sprints", "00");
  const logsDir = join(sprint, "logs");
  try {
    mkdirSync(logsDir, { recursive: true });
  } catch (err) {
    process.stderr.write(`sage evidence: warning: log dir failed: ${String(err)}\n`);
  }
  const logPath = join(logsDir, `${opts.label}-${Date.now().toString(36)}.log`);
  let fd: number | undefined;
  try {
    fd = openSync(logPath, "wx", 0o600);
    chmodSync(logPath, 0o600);
  } catch (err) {
    process.stderr.write(`sage evidence: warning: could not open log: ${String(err)}\n`);
  }

  const child = spawn(opts.command[0]!, opts.command.slice(1), {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  let written = 0;
  const tee = (buf: Buffer, dest: NodeJS.WriteStream) => {
    dest.write(buf);
    if (fd === undefined) return;
    const remain = LOG_MAX - written;
    if (remain <= 0) return;
    const slice = buf.subarray(0, remain);
    writeSync(fd, slice);
    written += slice.length;
    if (written >= LOG_MAX) writeSync(fd, Buffer.from("\n[truncated]\n"));
  };
  child.stdout?.on("data", (b: Buffer) => tee(b, process.stdout));
  child.stderr?.on("data", (b: Buffer) => tee(b, process.stderr));

  const exit = await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", (err) => {
      process.stderr.write(`sage evidence: warning: spawn failed: ${err.message}\n`);
      resolve(1);
    });
  });
  if (fd !== undefined) closeSync(fd);

  const after = wtree(cwd);
  const afterMtime = trackedMtimeFingerprint(cwd);
  const commit = git(["rev-parse", "--short", "HEAD"], cwd).stdout.trim();
  const dirty = git(["status", "--porcelain"], cwd).stdout.trim().length > 0;
  const rec: EvidenceRecord = {
    ts: new Date().toISOString(),
    label: opts.label,
    command: cmdStr,
    cmd_sha256: cmdHash,
    exit,
    duration_s: (Date.now() - started) / 1000,
    commit: commit || undefined,
    dirty,
    log_path: logPath,
    node: opts.node,
    grade: opts.grade,
  };
  // Both fingerprints must agree the tree was untouched: content (wtree)
  // AND mtime (trackedMtimeFingerprint, the TOCTOU-sharpening check above).
  // A mutate-then-revert-to-identical-content race passes the content check
  // but fails the mtime one, so it's still correctly refused here.
  if (before && after && before === after && beforeMtime && afterMtime && beforeMtime === afterMtime) {
    rec.wtree = after;
  }
  try {
    const ledger = evidencePath(cwd, opts.sprintId);
    mkdirSync(dirname(ledger), { recursive: true });
    appendFileSync(ledger, JSON.stringify(rec) + "\n");
  } catch (err) {
    process.stderr.write(`sage evidence: warning: ledger append failed: ${String(err)}\n`);
  }
  return exit;
}

export function check(opts: {
  label: string;
  expectCmd?: string;
  maxAgeHours?: number;
  allowPaths?: string[];
  cwd?: string;
  sprintId?: string;
}): Freshness {
  const cwd = opts.cwd || process.cwd();
  const recs = readEvidence(cwd, opts.sprintId).filter((r) => r.label === opts.label);
  const rec = recs.at(-1);
  if (!rec) return { grade: "STALE", reason: `no evidence record for label "${opts.label}" — run \`sage evidence run\` first` };
  if (rec.exit !== 0) return { grade: "STALE", reason: `recorded run exited ${rec.exit} (non-zero) — rerun and get a clean pass`, record: rec };
  if (opts.maxAgeHours != null) {
    const age = (Date.now() - Date.parse(rec.ts)) / 3600000;
    if (age > opts.maxAgeHours) {
      return { grade: "STALE", reason: `recorded run is ${age.toFixed(1)}h old, older than the ${opts.maxAgeHours}h max — rerun`, record: rec };
    }
  }
  if (opts.expectCmd && sha256(opts.expectCmd) !== rec.cmd_sha256) {
    return { grade: "STALE", reason: `recorded run used a different command than expected (cmd_sha256 mismatch) — rerun with the current command`, record: rec };
  }
  if (!rec.wtree) {
    return {
      grade: "STALE",
      reason:
        "no wtree fingerprint was recorded for that run — the working tree changed between its start and its end " +
        "(most commonly: .sage/ or .worktrees/ is not gitignored, so sage's own log/ledger write counted as a " +
        "change; run `sage evidence run` again after fixing the cause, or once with --allow-unignored if that's expected)",
      record: rec,
    };
  }
  if (!HEX40.test(rec.wtree)) {
    return { grade: "STALE", reason: `recorded wtree is malformed (not 40 hex characters): ${JSON.stringify(rec.wtree)}`, record: rec };
  }
  const now = wtree(cwd);
  if (!now) return { grade: "STALE", reason: "cannot fingerprint the current working tree (not inside a git repo?)", record: rec };
  if (now !== rec.wtree) {
    const diff = git(["diff", "--name-only", rec.wtree, now], cwd).stdout.trim().split("\n").filter(Boolean);
    const allow = opts.allowPaths || [];
    const outside = diff.filter((p) => !allow.some((a) => matchesAllowPath(p, a)));
    if (outside.length === 0 && diff.length) {
      return { grade: "FRESH", reason: "diff confined to allow-paths", record: rec };
    }
    return { grade: "STALE", reason: `tree changed: ${outside.slice(0, 8).join(", ")}`, record: rec };
  }
  return { grade: "FRESH", reason: "wtree matches", record: rec };
}

export function trust(command: string, cwd?: string): void {
  const root = gitRoot(cwd) || cwd || process.cwd();
  const store = join(projectSageDir(root), "trust.json");
  const key = sha256(root);
  let data: Record<string, string> = {};
  if (existsSync(store)) {
    try {
      data = JSON.parse(readFileSync(store, "utf8")) as Record<string, string>;
    } catch {
      data = {};
    }
  }
  data[key] = sha256(command);
  mkdirSync(dirname(store), { recursive: true });
  writeFileSync(store, JSON.stringify(data, null, 2) + "\n");
}

export function isTrusted(command: string, cwd?: string): boolean {
  const root = gitRoot(cwd) || cwd || process.cwd();
  const store = join(projectSageDir(root), "trust.json");
  if (!existsSync(store)) return false;
  try {
    const data = JSON.parse(readFileSync(store, "utf8")) as Record<string, string>;
    return data[sha256(root)] === sha256(command);
  } catch {
    return false;
  }
}

export type VerdictGrade = NonNullable<EvidenceRecord["grade"]>;

const GRADE_RANK: Record<VerdictGrade, number> = {
  "verifier-blocked": 0,
  "type-check-only": 1,
  "unit-test-verified": 2,
  "live-verified": 3,
};

export function meetsMinimumGrade(record: EvidenceRecord, minimum: VerdictGrade): boolean {
  if (!record.grade) return false;
  return GRADE_RANK[record.grade] >= GRADE_RANK[minimum];
}

/** Runtime acceptance text cannot be closed by a type-check-only record. */
export function refuseTypeCheckOnlyForRuntime(acceptance: string, grade?: VerdictGrade): boolean {
  if (grade !== "type-check-only") return false;
  return /return|render|exit|http|browser|click|runtime|live|request/i.test(acceptance);
}

void createHash;
