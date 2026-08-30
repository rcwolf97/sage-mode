import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { gitRoot, pluginRoot, projectDocsDir, readJson, readSageHome, sageUserDir, VERSION, writeJson } from "../util.js";
import {
  classify,
  installFile,
  plannedRemovals,
  readManifest,
  writeManifest,
  type Classification,
  type InstallResult,
  type Manifest,
} from "../manifest/index.js";

export interface SetupFileReport {
  written: string[];
  preserved: string[];
  refreshed: string[];
}

export interface SetupResult {
  sageHome: string;
  shim: string;
  project?: string;
  files: SetupFileReport;
}

const SHIM = `#!/usr/bin/env sh
SAGE_HOME=$(sed -n 's/.*"sageHome"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' "$HOME/.sage/config.json")
exec node "$SAGE_HOME/lib/cli.js" "$@"
`;

interface Candidate {
  relPath: string;
  sourceAbsPath: string;
}

// The full set of files setup() manages via the install manifest — used both
// to actually write them (setup) and to inspect their state without writing
// anything (checkHealth). Kept in one place so the two never drift apart.
function candidateFiles(sageHome: string, root: string, opts?: { noProjectAgents?: boolean }): Candidate[] {
  const out: Candidate[] = [];

  const assetsSrc = join(sageHome, "docs", "assets");
  if (existsSync(assetsSrc)) {
    for (const name of ["notebook.css", "mermaid.min.js"]) {
      const from = join(assetsSrc, name);
      if (existsSync(from)) out.push({ relPath: join("docs", "assets", name), sourceAbsPath: from });
    }
  }

  if (!opts?.noProjectAgents) {
    const src = join(sageHome, "agents");
    if (existsSync(src)) {
      for (const name of readdirSync(src).filter((n) => n.endsWith(".md"))) {
        out.push({ relPath: join(".cursor", "agents", name), sourceAbsPath: join(src, name) });
      }
    }
  }

  return out;
}

function recordResult(report: SetupFileReport, res: InstallResult): void {
  if (res.action === "written") report.written.push(res.path);
  else if (res.action === "refreshed") report.refreshed.push(res.path);
  else report.preserved.push(res.path);
}

export function setup(opts?: {
  project?: string;
  profile?: string;
  noProjectAgents?: boolean;
  /** Testing hook: install from a synthetic plugin tree instead of the real pluginRoot. */
  sageHome?: string;
}): SetupResult {
  const sageHome = opts?.sageHome || pluginRoot;
  const user = sageUserDir();
  mkdirSync(join(user, "bin"), { recursive: true });
  const root = opts?.project || gitRoot() || process.cwd();
  const existing = existsSync(join(user, "config.json"))
    ? (JSON.parse(readFileSync(join(user, "config.json"), "utf8")) as {
        trustedRoots?: string[];
        sageHome?: string;
      })
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
  if (!opts?.noProjectAgents) mkdirSync(join(root, ".cursor", "agents"), { recursive: true });

  // Every file we actually put into the project (agent role cards, notebook
  // assets) is routed through installFile: it will not overwrite a file the
  // user has modified or a pre-existing file we never wrote (see
  // lib/manifest/index.ts for the classify() policy this implements), and
  // installFile itself writes atomically (temp file + rename) so a crash
  // mid-setup never leaves a half-written file behind — whatever was
  // installed before this run either stays exactly as it was, or is cleanly
  // replaced, never corrupted in place. We deliberately do NOT do a
  // whole-directory swap of .cursor/agents: that directory is shared with
  // whatever project-specific agent cards a user drops in alongside sage's,
  // and swapping the whole directory would risk deleting those. Per-file
  // atomicity plus the manifest's preserve policy gives the same "previous
  // install stays intact on failure" guarantee without that risk.
  const manifest = readManifest(root);
  const report: SetupFileReport = { written: [], preserved: [], refreshed: [] };
  for (const c of candidateFiles(sageHome, root, opts)) {
    recordResult(report, installFile(root, c.relPath, c.sourceAbsPath, manifest));
  }
  manifest.sageVersion = VERSION;
  writeManifest(root, manifest);

  return { sageHome, shim, project: root, files: report };
}

export interface UninstallPreserved {
  path: string;
  reason: "modified" | "unowned";
}

export interface UninstallResult {
  removed: string[];
  preserved: UninstallPreserved[];
}

// Removes exactly what plannedRemovals() says is safe to remove (owned-clean
// and missing entries) and nothing else. A file the user modified is kept and
// reported as preserved. Safe to call twice: entries for removed paths are
// dropped from the manifest, so a second run has nothing left to do for them.
export function uninstall(opts?: { project?: string; purgeUserConfig?: boolean }): UninstallResult {
  const root = opts?.project || gitRoot() || process.cwd();
  const manifest = readManifest(root);
  const removed: string[] = [];
  const preserved: UninstallPreserved[] = [];
  const remaining: Manifest["entries"] = [];

  const toRemove = new Set(plannedRemovals(root, manifest));
  for (const entry of manifest.entries) {
    if (toRemove.has(entry.path)) {
      const abs = join(root, entry.path);
      if (existsSync(abs)) {
        try {
          unlinkSync(abs);
        } catch {
          /* best-effort: file may already be gone */
        }
      }
      removed.push(entry.path);
      continue;
    }
    // Not in plannedRemovals: classify() said owned-modified (the ordinary
    // "user edited this" case), or — for an entry whose recorded path
    // escapes the project root, which a hand-edited or malicious manifest
    // can contain — "unowned" (see resolveInRoot in lib/manifest/index.ts).
    // Either way it is kept, never deleted; only the reported reason differs.
    const cls = classify(root, entry.path, manifest);
    preserved.push({ path: entry.path, reason: cls === "unowned" ? "unowned" : "modified" });
    remaining.push(entry);
  }

  writeManifest(root, { ...manifest, entries: remaining });

  if (opts?.purgeUserConfig) {
    const cfgPath = join(sageUserDir(), "config.json");
    if (existsSync(cfgPath)) {
      try {
        const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as { trustedRoots?: string[] };
        cfg.trustedRoots = (cfg.trustedRoots || []).filter((r) => r !== root);
        writeJson(cfgPath, cfg);
      } catch {
        /* corrupt user config: leave it alone rather than guessing */
      }
    }
  }

  return { removed, preserved };
}

export interface InterpreterStatus {
  name: string;
  present: boolean;
  runs: boolean;
  version?: string;
}

export interface VerifyCheckStatus {
  key: string;
  command: string;
  resolvable: boolean;
}

export interface HealthReport {
  sageHome: string;
  project: string;
  notebook: { root: string; source: "project-config" | "default" };
  interpreters: InterpreterStatus[];
  gitignore: { sageIgnored: boolean; worktreesIgnored: boolean };
  verify: VerifyCheckStatus[];
  manifest: { ownedClean: number; ownedModified: number; unowned: number; missing: number };
  gaps: string[];
  ok: boolean;
}

function locate(name: string): boolean {
  const r = spawnSync("sh", ["-c", `command -v ${name} >/dev/null 2>&1`]);
  return r.status === 0;
}

// Detects an interpreter by actually executing it — not just finding it on
// PATH. A binary that resolves via `command -v` but fails to run (wrong
// architecture, broken shim, missing shared library, no exec permission) is a
// real and confusing failure mode that presence-only checks miss entirely.
function probeInterpreter(name: string, noopArgs: string[]): InterpreterStatus {
  const present = locate(name);
  if (!present) return { name, present: false, runs: false };
  const exec = spawnSync(name, noopArgs, { encoding: "utf8", timeout: 5000 });
  const runs = !exec.error && exec.status === 0;
  let version: string | undefined;
  if (runs) {
    const v = spawnSync(name, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (!v.error && v.status === 0) {
      version = ((v.stdout || v.stderr || "").trim().split(/\r?\n/)[0]) || undefined;
    }
  }
  return { name, present, runs, version };
}

// Read-only capability report: resolves environment, project, and manifest
// state and probes for optional tooling, but never writes anything. Every
// absence is reported as a gap for the user to act on if they care about that
// workflow, never as a thrown failure — sage should run fine without, say,
// python3 if nothing the user does needs it.
export function checkHealth(opts?: { project?: string }): HealthReport {
  const sageHome = readSageHome() || pluginRoot;
  const root = opts?.project || gitRoot() || process.cwd();
  const gaps: string[] = [];

  const notebookRoot = projectDocsDir(root);
  let notebookSource: "project-config" | "default" = "default";
  const projectCfgPath = join(root, ".sage", "config.json");
  let projectCfg: { notebook?: { root?: string }; verify?: Record<string, string> } | undefined;
  if (existsSync(projectCfgPath)) {
    try {
      projectCfg = readJson<{ notebook?: { root?: string }; verify?: Record<string, string> }>(projectCfgPath);
      if (projectCfg?.notebook?.root) notebookSource = "project-config";
    } catch {
      gaps.push(`${projectCfgPath} exists but is not valid JSON`);
    }
  }

  const interpreters = [
    probeInterpreter("python3", ["-c", ""]),
    probeInterpreter("node", ["-e", ""]),
    probeInterpreter("git", ["--version"]),
    probeInterpreter("claude", ["--version"]),
  ];
  let broken = false;
  for (const i of interpreters) {
    if (!i.present) {
      gaps.push(`${i.name} not found on PATH (optional — only needed for workflows that use it)`);
    } else if (!i.runs) {
      gaps.push(`${i.name} is on PATH but failed to execute — broken install or wrong architecture`);
      broken = true;
    }
  }

  const giLines = existsSync(join(root, ".gitignore"))
    ? readFileSync(join(root, ".gitignore"), "utf8").split(/\r?\n/)
    : [];
  const sageIgnored = giLines.includes(".sage/");
  const worktreesIgnored = giLines.includes(".worktrees/");
  if (!sageIgnored || !worktreesIgnored) {
    gaps.push(
      ".sage/ and/or .worktrees/ are not gitignored — evidence fingerprints will silently grade STALE forever until this is fixed",
    );
    broken = true;
  }

  const verify: VerifyCheckStatus[] = [];
  for (const [key, command] of Object.entries(projectCfg?.verify || {})) {
    const bin = String(command).trim().split(/\s+/)[0] || "";
    const resolvable = bin.length > 0 && locate(bin);
    verify.push({ key, command: String(command), resolvable });
    if (!resolvable) {
      gaps.push(`verify.${key} ("${command}") does not resolve to a runnable command`);
      broken = true;
    }
  }

  const manifest = readManifest(root);
  const counts = { ownedClean: 0, ownedModified: 0, unowned: 0, missing: 0 };
  const seen = new Set<string>();
  const tally = (cls: Classification) => {
    if (cls === "owned-clean") counts.ownedClean++;
    else if (cls === "owned-modified") counts.ownedModified++;
    else if (cls === "unowned") counts.unowned++;
    else counts.missing++;
  };
  for (const c of candidateFiles(sageHome, root)) {
    seen.add(c.relPath.split("\\").join("/"));
    tally(classify(root, c.relPath, manifest));
  }
  for (const entry of manifest.entries) {
    if (seen.has(entry.path)) continue;
    tally(classify(root, entry.path, manifest));
  }
  if (counts.ownedModified > 0) {
    gaps.push(`${counts.ownedModified} project file(s) were customized after install and are preserved as-is`);
  }

  return {
    sageHome,
    project: root,
    notebook: { root: notebookRoot, source: notebookSource },
    interpreters,
    gitignore: { sageIgnored, worktreesIgnored },
    verify,
    manifest: counts,
    gaps,
    ok: !broken,
  };
}
