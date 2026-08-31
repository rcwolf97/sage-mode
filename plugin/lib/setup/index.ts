import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { gitRoot, homeDir, pluginRoot, projectDocsDir, readJson, readSageHome, sageUserDir, VERSION, writeJson } from "../util.js";
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

// The project-relative path installFile()/readManifest() track it as (see
// lib/manifest/index.ts's MANIFEST_REL) — duplicated here as a literal rather
// than imported so lib/setup stays the only owner of "does a manifest exist
// yet" as a signal, without adding a new export to a module we don't own.
const INSTALL_MANIFEST_REL = join(".sage", "install-manifest.json");

// Detects the one configuration that makes the user-level config and the
// project config the *same file on disk*: HOME pointed at the project root
// itself (a repo checked out at ~, or a container/CI where HOME == the
// workdir). sageUserDir() is `$HOME/.sage`; the project config lives at
// `<root>/.sage/config.json`. When HOME === root, both resolve to
// `<root>/.sage/config.json`, and whichever one setup() writes second
// silently clobbers the other — in practice the user-level write (sageHome,
// trustedRoots) stomps the project's `lanes` block, and `sage egress grants`
// then honestly, and wrongly, reports nothing can leave the machine. Returns
// a human-actionable message naming both paths, or null when there is no
// collision.
function homeProjectCollision(root: string): string | null {
  const userDir = resolve(sageUserDir());
  const projectSageDir = resolve(join(root, ".sage"));
  if (userDir !== projectSageDir) return null;
  return (
    `the user-level sage config directory (${userDir}) and this project's .sage directory ` +
    `(${projectSageDir}) are the same path, because $HOME (${homeDir()}) is the project root ` +
    `itself. Writing either config would silently overwrite the other — most dangerously, the ` +
    `project's "lanes" block would be clobbered by the user-level config, and \`sage egress ` +
    `grants\` would then report nothing can leave the machine even though it can. ` +
    `Run sage from a project directory that is not your home directory.`
  );
}

export function setup(opts?: {
  project?: string;
  profile?: string;
  noProjectAgents?: boolean;
  /** Testing hook: install from a synthetic plugin tree instead of the real pluginRoot. */
  sageHome?: string;
}): SetupResult {
  const sageHome = opts?.sageHome || pluginRoot;
  const root = opts?.project || gitRoot() || process.cwd();
  // Fail loud, before touching disk: see homeProjectCollision() above. This
  // must run before the first mkdirSync/writeFileSync below — a setup that
  // detects the collision only after it has already written something has
  // already done the damage it exists to prevent.
  const collision = homeProjectCollision(root);
  if (collision) {
    throw new Error(`sage setup refused: ${collision}`);
  }
  const user = sageUserDir();
  mkdirSync(join(user, "bin"), { recursive: true });
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
        reviewer: "gpt-5.6-sol-medium",
        red_team: "gpt-5.6-sol-medium",
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
  /** true when the tool launched but its no-op probe returned non-zero —
   *  installed and executable, but this probe cannot confirm the capability.
   *  Reported as a gap, never as a broken install. */
  probeInconclusive?: boolean;
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
  /** Every finding, gap and broken alike — kept for backward compatibility
   * with the CLI's renderHealthReport(), which already prints this list as
   * "gaps" in the human-readable report. Use `problems` (below) to tell the
   * two severities apart programmatically. */
  gaps: string[];
  /** The subset of `gaps` that is genuinely BROKEN — something that will not
   * work and that the operator must act on, per compound-engineering's
   * health-check contract: an absence is never a failure, only a gap.
   * `ok` is exactly `problems.length === 0`. */
  problems: string[];
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
// `optionalProbe` marks a tool whose no-op invocation is NOT a reliable
// liveness signal. `claude` is the motivating case: some installs are
// restricted wrappers that reject `--version` with a non-zero status while
// `claude -p` — the only thing sage-mode actually calls — works fine. For
// those, failing to answer the probe means "could not determine", not "broken",
// and must never be reported as a broken install.
function probeInterpreter(
  name: string,
  noopArgs: string[],
  opts?: { optionalProbe?: boolean },
): InterpreterStatus {
  const present = locate(name);
  if (!present) return { name, present: false, runs: false, probeInconclusive: false };
  const exec = spawnSync(name, noopArgs, { encoding: "utf8", timeout: 5000 });
  const spawned = !exec.error;
  const runs = spawned && exec.status === 0;
  if (present && spawned && !runs && opts?.optionalProbe) {
    // It launched and answered — it is installed and executable. The non-zero
    // status tells us about this probe, not about the tool.
    return { name, present, runs: true, probeInconclusive: true };
  }
  let version: string | undefined;
  if (runs) {
    const v = spawnSync(name, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (!v.error && v.status === 0) {
      version = ((v.stdout || v.stderr || "").trim().split(/\r?\n/)[0]) || undefined;
    }
  }
  return { name, present, runs, version, probeInconclusive: false };
}

// Read-only capability report: resolves environment, project, and manifest
// state and probes for optional tooling, but never writes anything.
//
// Severity contract (deliberately mirrors compound-engineering's health-check
// posture): every finding is either a GAP — a capability that is merely
// absent because `sage setup` hasn't run yet, or an optional tool nothing
// requires — or a PROBLEM — something genuinely BROKEN that will not work
// and that the operator must act on. An absence alone is never a failure;
// `ok` reflects `problems` only, never `gaps`. Both severities are still
// appended to `gaps` (see the HealthReport doc comment) so the CLI's
// existing human-readable renderer keeps showing every finding, gap or not.
function note(gaps: string[], problems: string[], message: string, severity: "gap" | "broken"): void {
  gaps.push(message);
  if (severity === "broken") problems.push(message);
}

export function checkHealth(opts?: { project?: string }): HealthReport {
  const sageHome = readSageHome() || pluginRoot;
  const root = opts?.project || gitRoot() || process.cwd();
  const gaps: string[] = [];
  const problems: string[] = [];

  // Bug 2: HOME resolving to the project root itself makes the user config
  // and the project config the same file — see homeProjectCollision() above.
  // This is never a gap: it is actively, silently corrupting whichever
  // config gets written second, so it is reported BROKEN unconditionally.
  const collision = homeProjectCollision(root);
  if (collision) note(gaps, problems, collision, "broken");

  const notebookRoot = projectDocsDir(root);
  let notebookSource: "project-config" | "default" = "default";
  const projectCfgPath = join(root, ".sage", "config.json");
  let projectCfg: { notebook?: { root?: string }; verify?: Record<string, string> } | undefined;
  if (!existsSync(projectCfgPath)) {
    // Not-yet-set-up is a gap, not a failure: a fresh repo that has never run
    // `sage setup` has no project config yet, by design.
    note(gaps, problems, "no project .sage/config.json — run `sage setup` to create one", "gap");
  } else {
    try {
      projectCfg = readJson<{ notebook?: { root?: string }; verify?: Record<string, string> }>(projectCfgPath);
      if (projectCfg?.notebook?.root) notebookSource = "project-config";
    } catch {
      // A config that exists but is malformed is genuinely broken — every
      // command that reads it (verify commands, lanes, notebook root) is
      // silently falling back to defaults instead of what the operator
      // actually configured.
      note(gaps, problems, `${projectCfgPath} exists but is not valid JSON`, "broken");
    }
  }

  const interpreters = [
    probeInterpreter("python3", ["-c", ""]),
    probeInterpreter("node", ["-e", ""]),
    probeInterpreter("git", ["--version"]),
    probeInterpreter("claude", ["--version"], { optionalProbe: true }),
  ];
  for (const i of interpreters) {
    if (!i.present) {
      // Absent is always a gap, `claude` included — Lane B is optional and
      // the code already documents a Lane A fallback for it.
      note(gaps, problems, `${i.name} not found on PATH (optional — only needed for workflows that use it)`, "gap");
    } else if (i.probeInconclusive) {
      // Installed and executable, probe just wasn't conclusive. A gap at most —
      // reporting this as broken is what made `setup --check` fail on a healthy
      // machine whose `claude` is a restricted `-p`-only wrapper.
      note(
        gaps,
        problems,
        `${i.name} is installed but did not answer a version probe — assuming usable; if a lane that needs it fails, check it by hand`,
        "gap",
      );
    } else if (!i.runs) {
      // Present but non-functional is the confusing failure mode worth
      // failing loudly on: a broken install or wrong architecture, not an
      // intentional absence.
      note(
        gaps,
        problems,
        `${i.name} is on PATH but failed to execute — broken install or wrong architecture`,
        "broken",
      );
    }
  }

  const manifestInstalled = existsSync(join(root, INSTALL_MANIFEST_REL));
  const giLines = existsSync(join(root, ".gitignore"))
    ? readFileSync(join(root, ".gitignore"), "utf8").split(/\r?\n/)
    : [];
  const sageIgnored = giLines.includes(".sage/");
  const worktreesIgnored = giLines.includes(".worktrees/");
  if (!sageIgnored || !worktreesIgnored) {
    // Before `sage setup` has ever run, this is exactly the gap setup is
    // about to fix — a fresh clone reporting ok:false here would be the
    // first thing a new engineer sees, for a condition that isn't broken,
    // it's just not-yet-set-up. Once an install manifest exists, setup has
    // already run once — a .gitignore that reverted (or never got committed)
    // after that really does silently break evidence forever (see
    // lib/evidence's checkSageIgnored), so it's genuinely broken from here.
    note(
      gaps,
      problems,
      ".sage/ and/or .worktrees/ are not gitignored — evidence fingerprints will silently grade STALE forever until this is fixed",
      manifestInstalled ? "broken" : "gap",
    );
  }

  const verify: VerifyCheckStatus[] = [];
  for (const [key, command] of Object.entries(projectCfg?.verify || {})) {
    const bin = String(command).trim().split(/\s+/)[0] || "";
    const resolvable = bin.length > 0 && locate(bin);
    verify.push({ key, command: String(command), resolvable });
    if (!resolvable) {
      note(gaps, problems, `verify.${key} ("${command}") does not resolve to a runnable command`, "broken");
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
    note(
      gaps,
      problems,
      `${counts.ownedModified} project file(s) were customized after install and are preserved as-is`,
      "gap",
    );
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
    problems,
    ok: problems.length === 0,
  };
}
