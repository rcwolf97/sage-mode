import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { git, gitRoot, projectSageDir, pluginRoot, parseFrontmatter } from "../util.js";
import { type Dag, loadDag, expandAgainstTree } from "../dag/index.js";
import { type Finding, parseJsonl } from "../review/index.js";

export type NodeStatus =
  | "pending"
  | "claimed"
  | "building"
  | "in-review"
  | "blocked"
  | "done"
  | "abandoned";

export type NextAction = "dispatch" | "join" | "rule" | "review" | "done";

export interface Ledger {
  sprint: string;
  plan: string;
  base: string;
  branch: string;
  started: string;
  waves: string[][];
  nodes: Record<
    string,
    {
      status: NodeStatus;
      worktree?: string;
      model?: string;
      attempts: number;
      verify?: string;
      commit?: string;
      updated: string;
    }
  >;
  rulings: string[];
  cost: { laneB: number; laneCtokens: number };
  wtf: number;
  redWarning?: string;
  skippedSteps?: { step: string; status: "skipped"; reason?: string }[];
}

const STATUS: NodeStatus[] = [
  "pending",
  "claimed",
  "building",
  "in-review",
  "blocked",
  "done",
  "abandoned",
];

export function ledgerPath(sprint: string, root?: string): string {
  return join(projectSageDir(root), "sprints", sprint, "ledger.md");
}

export function boardDir(sprint: string, root?: string): string {
  return join(projectSageDir(root), "sprints", sprint, "board");
}

export function parseLedger(text: string): Ledger {
  const sprint = text.match(/^# sage ledger — sprint (.+)$/m)?.[1]?.trim() || "";
  const plan = text.match(/^plan:\s*(.+)$/m)?.[1]?.trim() || "";
  const base = text.match(/^base:\s*(.+)$/m)?.[1]?.trim() || "";
  const branch = text.match(/^branch:\s*(.+)$/m)?.[1]?.trim() || "";
  const started = text.match(/^started:\s*(.+)$/m)?.[1]?.trim() || "";
  const waves: string[][] = [];
  for (const m of text.matchAll(/^- wave \d+:\s*(.+)$/gm)) {
    waves.push(
      m[1]!.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  const nodes: Ledger["nodes"] = {};
  const table = text.split("## Nodes")[1]?.split("## ")[0] || "";
  for (const line of table.split("\n")) {
    if (!line.startsWith("| n")) continue;
    const cols = line.split("|").map((s) => s.trim());
    const id = cols[1];
    if (!id) continue;
    nodes[id] = {
      status: (STATUS.includes(cols[2] as NodeStatus) ? cols[2] : "pending") as NodeStatus,
      worktree: cols[3] && cols[3] !== "—" ? cols[3] : undefined,
      model: cols[4] && cols[4] !== "—" ? cols[4] : undefined,
      attempts: Number(cols[5] || 0) || 0,
      verify: cols[6] && cols[6] !== "—" ? cols[6] : undefined,
      commit: cols[7] && cols[7] !== "—" ? cols[7] : undefined,
      updated: cols[8] || "",
    };
  }
  const rulings = (text.split("## Rulings")[1]?.split("## ")[0] || "")
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2));
  const laneB = Number(text.match(/lane B consults:\s*(\d+)/)?.[1] || 0);
  const laneC = Number(text.match(/lane C review tokens:\s*([\d,]+)/)?.[1]?.replace(/,/g, "") || 0);
  const wtf = Number(text.match(/WTF-LIKELIHOOD:\s*(\d+)/)?.[1] || 0);
  const redWarning = text.match(/WARNING — allowing after 3 blocked re-entries[\s\S]*?(?=\n## |\n$)/)?.[0];
  const skippedSteps: Ledger["skippedSteps"] = [];
  const skippedBlock = text.split("## Skipped steps")[1]?.split("## ")[0] || "";
  for (const line of skippedBlock.split("\n")) {
    if (!line.startsWith("| ") || line.startsWith("| step")) continue;
    const cols = line.split("|").map((s) => s.trim());
    if (!cols[1] || cols[1] === "----" || cols[1] === "step" || cols[1] === "—") continue;
    skippedSteps.push({ step: cols[1], status: "skipped", reason: cols[2] && cols[2] !== "—" ? cols[2] : undefined });
  }
  return {
    sprint,
    plan,
    base,
    branch,
    started,
    waves,
    nodes,
    rulings,
    cost: { laneB, laneCtokens: laneC },
    wtf,
    redWarning,
    skippedSteps,
  };
}

export function renderLedger(l: Ledger): string {
  const waves = l.waves.map((w, i) => `- wave ${i + 1}: ${w.join(", ")}`).join("\n");
  const rows = Object.entries(l.nodes)
    .map(([id, n]) => {
      return `| ${id} | ${n.status} | ${n.worktree || "—"} | ${n.model || "—"} | ${n.attempts} | ${n.verify || "—"} | ${n.commit || "—"} | ${n.updated} |`;
    })
    .join("\n");
  return `# sage ledger — sprint ${l.sprint}
plan: ${l.plan}
base: ${l.base}
branch: ${l.branch}
started: ${l.started}

## Waves
${waves}

## Nodes
| id | status | worktree | model | attempts | verify | commit | updated |
|----|--------|----------|-------|----------|--------|--------|---------|
${rows}

## Joins
${l.waves.length ? `- join after wave ${l.waves.length}` : "- none"}

## Rulings
${l.rulings.map((r) => `- ${r}`).join("\n") || "- none"}

## Cost
- lane B consults: ${l.cost.laneB}
- lane C review tokens: ${l.cost.laneCtokens}

## Circuit
- WTF-LIKELIHOOD: ${l.wtf}
${l.redWarning ? `\n${l.redWarning}\n` : ""}
## Skipped steps
| step | reason |
|------|--------|
${(l.skippedSteps || []).length ? (l.skippedSteps || []).map((s) => `| ${s.step} | ${s.reason || "—"} |`).join("\n") : "(none)"}
`;
}

export function loadLedger(sprint: string, root?: string): Ledger | null {
  const p = ledgerPath(sprint, root);
  if (!existsSync(p)) return null;
  const text = readFileSync(p, "utf8");
  // parseLedger is deliberately lenient (every field falls back to "" / 0 /
  // [] rather than throwing) so a still-being-written or oddly-formatted
  // ledger doesn't crash a reader mid-write. But that leniency means an
  // empty, truncated, or otherwise unparseable file — existsSync sees it,
  // so the "no ledger" branch above never fires — produces a fully-formed,
  // *valid-looking* empty Ledger instead of a signal that something is
  // wrong. That is a real false-PASS risk for a caller like
  // evaluateCircuitBreakerForSprint: a corrupted ledger.md (crashed
  // mid-write, a concurrent-write race, a zero-byte file) would otherwise
  // mechanically score as a clean wtf:0/stopAndAsk:false rather than
  // raising the same loud failure a genuinely missing ledger gets.
  //
  // The bar deliberately stays low — any recognizable `## ` section heading
  // — rather than requiring the exact renderLedger() header line, so a
  // hand-authored or intentionally-terse ledger fixture (real ones in the
  // wild, and in this codebase's own CLI tests) that a human clearly meant
  // as ledger content still loads normally. What it excludes is content
  // with no markdown structure at all: an empty file, or binary/garbage
  // bytes from a crash or partial write.
  if (!/^## /m.test(text)) return null;
  return parseLedger(text);
}

// ---------------------------------------------------------------------------
// Explicit-failure ledger loading
// ---------------------------------------------------------------------------
//
// loadLedger() above returns `null` on a missing ledger, which is the right
// shape for callers like next() that have a legitimate "no ledger yet" branch
// to fall into. But `sage board wtf`/`sage board ledger` had no such branch —
// the CLI's `if (!l) return 1;` turned a missing ledger into exit 1 with
// nothing on stdout or stderr. Worse than an ordinary silent failure:
// skills/sage-build/SKILL.md names `sage board wtf` as the *only* legitimate
// source of the WTF-likelihood number, specifically to close off an agent
// hand-writing one as a self-report. An agent that runs the command, gets
// exit 1 and no message, has neither a number nor an error — which is
// exactly the condition that invites the hand-written estimate back in.
//
// loadLedgerOrThrow / evaluateCircuitBreakerForSprint exist for that call
// site: same "no ledger" condition, but surfaced as a typed, catchable error
// carrying a machine-readable reason instead of vanishing.

/** Machine-readable shape of a missing-ledger failure — `LedgerNotFoundError`
 * implements this, so a caller that only wants the data (not to `catch` an
 * `Error` instance) can still narrow on `code`. */
export interface LedgerLoadFailure {
  code: "no-ledger";
  sprint: string;
  expectedPath: string;
}

export class LedgerNotFoundError extends Error implements LedgerLoadFailure {
  readonly code = "no-ledger" as const;
  readonly sprint: string;
  readonly expectedPath: string;
  constructor(sprint: string, expectedPath: string) {
    super(`no ledger for sprint ${sprint} at ${expectedPath} — run /sage-build first`);
    this.name = "LedgerNotFoundError";
    this.sprint = sprint;
    this.expectedPath = expectedPath;
  }
}

/** Same lookup as `loadLedger`, but throws `LedgerNotFoundError` instead of
 * returning `null` when the sprint has no ledger yet. Use this at any call
 * site where "no ledger" is a hard stop that must be reported, not a state
 * the caller has real logic for — `loadLedger` stays available, unchanged,
 * for callers (like `next()`, below) that do have one. */
export function loadLedgerOrThrow(sprint: string, root?: string): Ledger {
  const l = loadLedger(sprint, root);
  if (!l) throw new LedgerNotFoundError(sprint, ledgerPath(sprint, root));
  return l;
}

export function saveLedger(l: Ledger, root?: string): void {
  const p = ledgerPath(l.sprint, root);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, renderLedger(l));
}

export function writeStatus(sprint: string, id: string, status: NodeStatus, root?: string): void {
  const dir = boardDir(sprint, root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.status`), status + "\n");
}

export function writeBlocker(sprint: string, id: string, body: string, root?: string): void {
  const dir = boardDir(sprint, root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.blocker.md`), body);
  writeStatus(sprint, id, "blocked", root);
}

export function writeAnswer(sprint: string, id: string, body: string, root?: string): void {
  const dir = boardDir(sprint, root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.answer.md`), body);
}

export function next(sprint: string, root?: string): { action: NextAction; nodes: string[]; reason: string } {
  const l = loadLedger(sprint, root);
  if (!l) return { action: "dispatch", nodes: [], reason: "no ledger" };
  const blocked = Object.entries(l.nodes)
    .filter(([, n]) => n.status === "blocked")
    .map(([id]) => id);
  if (blocked.length) return { action: "rule", nodes: blocked, reason: "blocked nodes need a ruling" };

  for (let i = 0; i < l.waves.length; i++) {
    const wave = l.waves[i]!;
    const states = wave.map((id) => l.nodes[id]?.status || "pending");
    if (states.some((s) => s === "building" || s === "claimed" || s === "in-review")) {
      const active = wave.filter((id) => ["building", "claimed", "in-review"].includes(l.nodes[id]?.status || ""));
      return { action: "dispatch", nodes: active, reason: `wave ${i + 1} in progress` };
    }
    if (states.every((s) => s === "done" || s === "abandoned")) {
      continue;
    }
    if (states.some((s) => s === "pending") && states.every((s) => s === "pending" || s === "done" || s === "abandoned")) {
      const pending = wave.filter((id) => (l.nodes[id]?.status || "pending") === "pending");
      return { action: "dispatch", nodes: pending, reason: `dispatch wave ${i + 1}` };
    }
  }

  const allDone = Object.values(l.nodes).every((n) => n.status === "done" || n.status === "abandoned");
  if (!allDone) {
    const leftover = Object.entries(l.nodes)
      .filter(([, n]) => n.status !== "done" && n.status !== "abandoned")
      .map(([id]) => id);
    return { action: "dispatch", nodes: leftover, reason: "unfinished nodes" };
  }

  const reviewPending = Object.entries(l.nodes).some(([, n]) => n.status === "in-review");
  if (reviewPending) return { action: "review", nodes: [], reason: "review in flight" };

  return { action: "done", nodes: [], reason: "all nodes done" };
}

export function activeSprint(root?: string): string | null {
  const sage = projectSageDir(root);
  const dir = join(sage, "sprints");
  if (!existsSync(dir)) return null;
  const dirs = readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isDirectory())
    .sort();
  for (const d of dirs.slice().reverse()) {
    if (existsSync(join(dir, d, "ledger.md"))) return d;
  }
  return dirs.at(-1) || null;
}

// ---------------------------------------------------------------------------
// Circuit breaker: WTF-likelihood score
// ---------------------------------------------------------------------------
//
// Ported from gstack's mechanical scope-creep score — see
// skills/sage-build/references/circuit-breaker-rationale.md for the "why"
// behind each weight. The property gstack established, and the one the
// previous implementation here violated: none of these signals are a
// judgment call made by the agent the breaker governs. Every input is
// either counted from real git history, cross-checked against dag.json's
// declared `owns` globs, or read from a schema-conforming JSONL artifact a
// *different* process (the reviewer) wrote for reasons that have nothing to
// do with this score. `computeWtf` is a pure function of those counts —
// hand-built numbers in a test are indistinguishable from a real sprint's,
// which is exactly what makes the score auditable.
//
// The previous implementation was
// `Number(text.match(/WTF-LIKELIHOOD:\s*(\d+)/)?.[1] || 0)` — parsing a
// number out of the ledger's own Circuit section. But nothing anywhere
// computed that number; it could only ever have gotten there by an agent
// (the Eng Manager persona `/sage-build` runs) writing it in by hand. That
// is textual self-report wearing a mechanical costume. This section
// replaces it: from here on, `l.wtf` must only ever be set from
// `computeWtf(...).score` (typically via `evaluateCircuitBreaker`), never
// typed in directly. No parallel "agent-reported" field is kept — the old
// WTF-LIKELIHOOD line *was* the self-report; keeping a second copy of the
// same free-text number under an "advisory" label would just be the same
// problem wearing an apologetic disclaimer.

/** Mechanically-derived inputs to the WTF-likelihood formula. Every field is
 * a count or boolean sourced from git history, dag.json, or findings.jsonl
 * — see `deriveWtfSignals` for exactly how each is produced from real repo
 * state. This type is kept separate from `deriveWtfSignals` specifically so
 * `computeWtf` can be unit-tested with hand-built numbers, the same way
 * lib/dag/index.ts's `globIntersect` takes an explicit `treePaths` argument
 * instead of always shelling out to `git ls-files`. */
export interface WtfSignals {
  /** Commits mechanically identified as reverts: either git's own
   * auto-generated `Revert "..."` subject line, or the `This reverts commit
   * <sha>` trailer `git revert` writes into the commit body. Both are
   * things git itself writes when `git revert` runs — never free text an
   * agent composes describing its own work. */
  reverts: number;
  /** Non-revert commits ("fixes" — see `totalFixes`) whose
   * `git diff-tree --name-only` touched more than 3 files. */
  fixesOverThreeFiles: number;
  /** Total fix commits landed in the sprint so far, across every node's
   * branch, revert commits included (a revert is still an iteration of the
   * loop, not a no-op). One commit == one fix, per the Implementer
   * contract in skills/sage-build/SKILL.md step 3 ("Commit, one commit per
   * acceptance criterion"). */
  totalFixes: number;
  /** True only when findings.jsonl for this sprint has at least one finding
   * recorded and every one of them is NITPICK severity — the lowest band
   * lib/review/index.ts's `Finding` type defines, and the mechanical
   * stand-in for gstack's "Low" (this schema has no literal "Low" tier).
   * Missing, empty, or unparsable findings.jsonl is treated as "no data"
   * and returns false, never true — a node with zero recorded findings is
   * not evidence that "everything remaining is low severity", it's absence
   * of evidence either way. */
  allRemainingFindingsLow: boolean;
  /** Distinct (node, file) pairs where a file a node's branch touched does
   * not match any glob in that node's `owns` from dag.json. */
  outOfLaneTouches: number;
}

export interface WtfBreakdown {
  revertPoints: number;
  fileSpreadPoints: number;
  fixCountPoints: number;
  lowFindingsPoints: number;
  outOfLanePoints: number;
}

export interface WtfResult {
  /** Total score, in the same percentage-point units SKILL.md's table uses
   * (e.g. 30 means "30%"). */
  score: number;
  breakdown: WtfBreakdown;
  /** score > 20 — SKILL.md step 6's stop-and-ask threshold. Strictly
   * greater-than: a score that lands exactly on 20 does not trip it. */
  stopAndAsk: boolean;
  /** totalFixes >= 50 — the hard cap, independent of score. */
  hardCapReached: boolean;
}

/** gstack's exact formula (skills/sage-build/SKILL.md step 6), as a pure
 * function: start at 0, +15 per revert, +5 per fix touching more than 3
 * files, +1 per fix after the 15th, +10 if every remaining finding is Low
 * severity, +20 per out-of-lane file touch. No signal here is a judgment
 * call — see `WtfSignals` for how each is mechanically sourced when this is
 * called via `evaluateCircuitBreaker`/`deriveWtfSignals` against a real
 * sprint. */
export function computeWtf(signals: WtfSignals): WtfResult {
  const revertPoints = signals.reverts * 15;
  const fileSpreadPoints = signals.fixesOverThreeFiles * 5;
  const fixCountPoints = Math.max(0, signals.totalFixes - 15) * 1;
  const lowFindingsPoints = signals.allRemainingFindingsLow ? 10 : 0;
  const outOfLanePoints = signals.outOfLaneTouches * 20;
  const score = revertPoints + fileSpreadPoints + fixCountPoints + lowFindingsPoints + outOfLanePoints;
  return {
    score,
    breakdown: { revertPoints, fileSpreadPoints, fixCountPoints, lowFindingsPoints, outOfLanePoints },
    stopAndAsk: score > 20,
    hardCapReached: signals.totalFixes >= 50,
  };
}

// git's own auto-generated revert subject (`git revert` with `--edit`
// defaults to `Revert "<original subject>"`) and its auto-inserted body
// trailer (present whether or not the subject was edited). Matching either
// is matching something git itself wrote, not something the agent typed.
const REVERT_SUBJECT = /^revert\b/i;
const REVERT_TRAILER = /^this reverts commit [0-9a-f]{7,40}\.?\s*$/im;

/** Pulls `WtfSignals` from real repo state: per-node branches (the
 * `sprint/<sprint>-<id>` convention lib/dag/index.ts's `worktree()`
 * function creates), dag.json's declared `owns` globs, and the sprint's
 * findings.jsonl. Best-effort and fails closed toward zero signals — never
 * throws. A node whose branch no longer exists (deleted after a clean join,
 * or never dispatched yet) or a dag.json that fails to load simply
 * contributes nothing, exactly like a node that hasn't built anything. */
export function deriveWtfSignals(l: Ledger, root?: string): WtfSignals {
  const cwd = root || gitRoot() || process.cwd();

  let dag: Dag | null = null;
  if (l.plan) {
    const dagPath = isAbsolute(l.plan) ? l.plan : join(cwd, l.plan);
    try {
      if (existsSync(dagPath)) dag = loadDag(dagPath);
    } catch {
      dag = null;
    }
  }

  const nodeIds = dag ? dag.nodes.map((n) => n.id) : Object.keys(l.nodes);

  let reverts = 0;
  let fixesOverThreeFiles = 0;
  let totalFixes = 0;
  let outOfLaneTouches = 0;

  for (const id of nodeIds) {
    const node = dag?.nodes.find((n) => n.id === id);
    // Per-node branch naming convention from lib/dag/index.ts's worktree():
    // `git worktree add -B sprint/${dag.sprint}-${nodeId} dir dag.base`.
    const branch = `sprint/${l.sprint}-${id}`;
    if (!l.base || git(["rev-parse", "--verify", branch], cwd).status !== 0) continue;

    const log = git(["log", "--reverse", "--format=%H", `${l.base}..${branch}`], cwd);
    if (log.status !== 0) continue;
    const shas = log.stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sha of shas) {
      totalFixes++;
      const msg = git(["show", "-s", "--format=%B", sha], cwd).stdout;
      const subject = msg.split("\n")[0] || "";
      if (REVERT_SUBJECT.test(subject) || REVERT_TRAILER.test(msg)) {
        reverts++;
        continue;
      }
      const diff = git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha], cwd);
      const files = diff.stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (files.length > 3) fixesOverThreeFiles++;
      if (node) {
        for (const f of files) {
          const inLane = node.owns.some((g) => expandAgainstTree(g, [f]).includes(f));
          if (!inLane) outOfLaneTouches++;
        }
      }
    }
  }

  return {
    reverts,
    fixesOverThreeFiles,
    totalFixes,
    allRemainingFindingsLow: remainingFindingsAllLow(l.sprint, cwd),
    outOfLaneTouches,
  };
}

/** Path to the sprint's findings.jsonl. Design choice: co-located with
 * ledger.md/board/ under `.sage/sprints/<sprint>/`, matching where
 * evidence.jsonl already lives per agents/implementer-*.md ("Evidence
 * record via `sage evidence run` (`.sage/sprints/NN/evidence.jsonl`)") —
 * findings.jsonl is the same kind of internal, machine-written JSONL
 * artifact, distinct from the rendered docs/sprints/NN-<slug>/review.{md,html}
 * meant for humans. If a future sage-review revision writes findings.jsonl
 * somewhere else, this is the one place to update. */
export function findingsPath(sprint: string, root?: string): string {
  return join(projectSageDir(root), "sprints", sprint, "findings.jsonl");
}

// findings.jsonl carries no resolved/fixed flag in its schema (see
// lib/review/index.ts's Finding type), so this reads the file's *current*
// contents as the remaining set — valid as long as sage-review overwrites
// (rather than appends to) the file on each re-review pass, which is the
// existing fix-cycle contract in skills/sage-build/SKILL.md step 4
// ("findings loop back to the Implementer for a fix; bound fix cycles at
// 3"). An empty or missing file means "no data", not "all low" — it must
// NOT award the +10% just because nothing has been recorded yet, or every
// freshly-reviewed node with zero findings would trip the signal for no
// reason.
function remainingFindingsAllLow(sprint: string, root?: string): boolean {
  const p = findingsPath(sprint, root);
  if (!existsSync(p)) return false;
  let findings: Finding[];
  try {
    findings = parseJsonl(readFileSync(p, "utf8"));
  } catch {
    return false;
  }
  if (findings.length === 0) return false;
  return findings.every((f) => f.severity === "NITPICK");
}

/** One-call convenience: derive signals from real repo state, then score
 * them. This is the mechanism skills/sage-build/SKILL.md step 6 refers to —
 * the Eng Manager must call this rather than writing a number into the
 * ledger's Circuit section by hand. */
export function evaluateCircuitBreaker(l: Ledger, root?: string): WtfResult {
  return computeWtf(deriveWtfSignals(l, root));
}

/** One-call convenience for the `sage board wtf` call site specifically:
 * loads the sprint's ledger (throwing `LedgerNotFoundError` — see
 * `loadLedgerOrThrow` — rather than returning something the CLI can
 * mistake for a clean zero score) and scores it in one step. */
export function evaluateCircuitBreakerForSprint(sprint: string, root?: string): WtfResult {
  return evaluateCircuitBreaker(loadLedgerOrThrow(sprint, root), root);
}

export function skippedStepsWithoutReason(l: Ledger): string[] {
  return (l.skippedSteps || [])
    .filter((s) => s.status === "skipped" && !(s.reason && s.reason.trim() && s.reason !== "—"))
    .map((s) => s.step);
}

const ROLE_AGENT: Record<string, string> = {
  frontend: "implementer-frontend",
  backend: "implementer-backend",
  data: "implementer-data",
  infra: "implementer-infra",
  ai: "implementer-ai",
  design: "design-technologist",
};

function agentDisplayName(role: string): string {
  const file = ROLE_AGENT[role];
  if (!file) return role;
  const p = join(pluginRoot, "agents", `${file}.md`);
  if (!existsSync(p)) return file;
  const { data } = parseFrontmatter(readFileSync(p, "utf8"));
  return String(data.name || file);
}

/** Markdown source for `sage board render`. Caller writes it then HTML-renders. */
export function renderBoardMarkdown(sprint: string, root?: string): string {
  const l = loadLedgerOrThrow(sprint, root);
  const dagPath = join(projectSageDir(root), "sprints", sprint, "dag.json");
  const dag = existsSync(dagPath) ? loadDag(dagPath) : null;
  const wtf = evaluateCircuitBreaker(l, root);
  const b = wtf.breakdown;
  const sum = b.revertPoints + b.fileSpreadPoints + b.fixCountPoints + b.lowFindingsPoints + b.outOfLanePoints;
  const lines: string[] = [
    "---",
    `title: Sprint ${sprint} board`,
    "kind: brief",
    "---",
    "",
    `# Sprint ${sprint} commander console`,
    "",
    "Observed model receipts are unavailable — SPIKE-02 Cursor plugin-shipped `model:` did not produce a host usage/cost line. Declared values below are frontmatter only.",
    "",
    `WTF total **${wtf.score}** = reverts ${b.revertPoints} + file-spread ${b.fileSpreadPoints} + fix-count ${b.fixCountPoints} + low-findings ${b.lowFindingsPoints} + out-of-lane ${b.outOfLanePoints} (sum ${sum}).`,
    "",
  ];
  l.waves.forEach((wave, i) => {
    lines.push(`## Wave ${i}`);
    lines.push("");
    lines.push("| node | agent | lane | status | attempts | owns | declared model | observed model |");
    lines.push("|------|-------|------|--------|----------|------|----------------|----------------|");
    for (const id of wave) {
      const node = l.nodes[id];
      const dagNode = dag?.nodes.find((n) => n.id === id);
      const agent = dagNode ? agentDisplayName(dagNode.role) : "—";
      const lane = dagNode ? (dagNode.role === "design" ? "A" : "A") : "—";
      const owns = dagNode ? dagNode.owns.join(", ") : "—";
      const declared = node?.model || dagNode?.model || "—";
      lines.push(
        `| ${id} | ${agent} | ${lane} | ${node?.status || "—"} | ${node?.attempts ?? 0} | ${owns} | declared: ${declared} | observed: — |`,
      );
    }
    lines.push("");
  });
  return lines.join("\n");
}
