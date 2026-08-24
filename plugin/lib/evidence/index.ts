import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, writeSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { git, gitRoot, projectSageDir, sha256 } from "../util.js";

const LOG_MAX = 2 * 1024 * 1024;
const HEX40 = /^[0-9a-f]{40}$/;

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
}

export type Freshness = { grade: "FRESH" | "STALE"; reason: string; record?: EvidenceRecord };

export function wtree(cwd?: string): string | null {
  const root = gitRoot(cwd);
  if (!root) return null;
  const realIndex = git(["rev-parse", "--git-path", "index"], root);
  let realPath = (realIndex.stdout || "").trim();
  if (realPath && !realPath.startsWith("/")) realPath = join(root, realPath);
  const tmp = join(tmpdir(), `sage-wtree-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: tmp };
  try {
    if (realPath && existsSync(realPath)) {
      spawnSync("cp", [realPath, tmp], { encoding: "utf8" });
    } else {
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

export function evidencePath(root?: string): string {
  const sage = projectSageDir(root);
  const sprint = activeSprintDir(root);
  return join(sprint || join(sage, "sprints", "00"), "evidence.jsonl");
}

export function activeSprintDir(root?: string): string | null {
  const sage = projectSageDir(root);
  const sprints = join(sage, "sprints");
  if (!existsSync(sprints) || !statSync(sprints).isDirectory()) return null;
  const dirs = readdirSync(sprints)
    .map((n) => join(sprints, n))
    .filter((p) => statSync(p).isDirectory())
    .sort();
  return dirs.at(-1) || null;
}

export function readEvidence(root?: string): EvidenceRecord[] {
  const p = evidencePath(root);
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
}): Promise<number> {
  const cwd = opts.cwd || process.cwd();
  const before = wtree(cwd);
  const started = Date.now();
  const cmdStr = opts.command.join(" ");
  const cmdHash = sha256(cmdStr);
  const sage = projectSageDir(cwd);
  const sprint = activeSprintDir(cwd) || join(sage, "sprints", "00");
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
  };
  if (before && after && before === after) rec.wtree = after;
  try {
    const ledger = join(sprint, "evidence.jsonl");
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
}): Freshness {
  const cwd = opts.cwd || process.cwd();
  const recs = readEvidence(cwd).filter((r) => r.label === opts.label);
  const rec = recs.at(-1);
  if (!rec) return { grade: "STALE", reason: "no record" };
  if (rec.exit !== 0) return { grade: "STALE", reason: "recorded run failed", record: rec };
  if (opts.maxAgeHours != null) {
    const age = (Date.now() - Date.parse(rec.ts)) / 3600000;
    if (age > opts.maxAgeHours) return { grade: "STALE", reason: `older than ${opts.maxAgeHours}h`, record: rec };
  }
  if (opts.expectCmd && sha256(opts.expectCmd) !== rec.cmd_sha256) {
    return { grade: "STALE", reason: "command changed", record: rec };
  }
  if (!rec.wtree || !HEX40.test(rec.wtree)) {
    return { grade: "STALE", reason: "wtree missing or not 40 hex characters", record: rec };
  }
  const now = wtree(cwd);
  if (!now) return { grade: "STALE", reason: "cannot fingerprint working tree", record: rec };
  if (now !== rec.wtree) {
    const diff = git(["diff", "--name-only", rec.wtree, now], cwd).stdout.trim().split("\n").filter(Boolean);
    const allow = opts.allowPaths || [];
    const outside = diff.filter((p) => !allow.some((a) => p === a || p.startsWith(a.replace(/\*$/, "") || a)));
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

void createHash;
void evidencePath;
