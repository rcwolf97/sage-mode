import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { git, gitRoot, projectSageDir } from "../util.js";
import { loadDag, expandAgainstTree } from "../dag/index.js";
import { parseJsonl } from "../review/index.js";
const STATUS = [
    "pending",
    "claimed",
    "building",
    "in-review",
    "blocked",
    "done",
    "abandoned",
];
export function ledgerPath(sprint, root) {
    return join(projectSageDir(root), "sprints", sprint, "ledger.md");
}
export function boardDir(sprint, root) {
    return join(projectSageDir(root), "sprints", sprint, "board");
}
export function parseLedger(text) {
    const sprint = text.match(/^# sage ledger — sprint (.+)$/m)?.[1]?.trim() || "";
    const plan = text.match(/^plan:\s*(.+)$/m)?.[1]?.trim() || "";
    const base = text.match(/^base:\s*(.+)$/m)?.[1]?.trim() || "";
    const branch = text.match(/^branch:\s*(.+)$/m)?.[1]?.trim() || "";
    const started = text.match(/^started:\s*(.+)$/m)?.[1]?.trim() || "";
    const waves = [];
    for (const m of text.matchAll(/^- wave \d+:\s*(.+)$/gm)) {
        waves.push(m[1].split(",")
            .map((s) => s.trim())
            .filter(Boolean));
    }
    const nodes = {};
    const table = text.split("## Nodes")[1]?.split("## ")[0] || "";
    for (const line of table.split("\n")) {
        if (!line.startsWith("| n"))
            continue;
        const cols = line.split("|").map((s) => s.trim());
        const id = cols[1];
        if (!id)
            continue;
        nodes[id] = {
            status: (STATUS.includes(cols[2]) ? cols[2] : "pending"),
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
    };
}
export function renderLedger(l) {
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
${l.redWarning ? `\n${l.redWarning}\n` : ""}`;
}
export function loadLedger(sprint, root) {
    const p = ledgerPath(sprint, root);
    if (!existsSync(p))
        return null;
    return parseLedger(readFileSync(p, "utf8"));
}
export function saveLedger(l, root) {
    const p = ledgerPath(l.sprint, root);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, renderLedger(l));
}
export function writeStatus(sprint, id, status, root) {
    const dir = boardDir(sprint, root);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.status`), status + "\n");
}
export function writeBlocker(sprint, id, body, root) {
    const dir = boardDir(sprint, root);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.blocker.md`), body);
    writeStatus(sprint, id, "blocked", root);
}
export function writeAnswer(sprint, id, body, root) {
    const dir = boardDir(sprint, root);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.answer.md`), body);
}
export function next(sprint, root) {
    const l = loadLedger(sprint, root);
    if (!l)
        return { action: "dispatch", nodes: [], reason: "no ledger" };
    const blocked = Object.entries(l.nodes)
        .filter(([, n]) => n.status === "blocked")
        .map(([id]) => id);
    if (blocked.length)
        return { action: "rule", nodes: blocked, reason: "blocked nodes need a ruling" };
    for (let i = 0; i < l.waves.length; i++) {
        const wave = l.waves[i];
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
    if (reviewPending)
        return { action: "review", nodes: [], reason: "review in flight" };
    return { action: "done", nodes: [], reason: "all nodes done" };
}
export function activeSprint(root) {
    const sage = projectSageDir(root);
    const dir = join(sage, "sprints");
    if (!existsSync(dir))
        return null;
    const dirs = readdirSync(dir)
        .filter((n) => statSync(join(dir, n)).isDirectory())
        .sort();
    for (const d of dirs.slice().reverse()) {
        if (existsSync(join(dir, d, "ledger.md")))
            return d;
    }
    return dirs.at(-1) || null;
}
/** gstack's exact formula (skills/sage-build/SKILL.md step 6), as a pure
 * function: start at 0, +15 per revert, +5 per fix touching more than 3
 * files, +1 per fix after the 15th, +10 if every remaining finding is Low
 * severity, +20 per out-of-lane file touch. No signal here is a judgment
 * call — see `WtfSignals` for how each is mechanically sourced when this is
 * called via `evaluateCircuitBreaker`/`deriveWtfSignals` against a real
 * sprint. */
export function computeWtf(signals) {
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
export function deriveWtfSignals(l, root) {
    const cwd = root || gitRoot() || process.cwd();
    let dag = null;
    if (l.plan) {
        const dagPath = isAbsolute(l.plan) ? l.plan : join(cwd, l.plan);
        try {
            if (existsSync(dagPath))
                dag = loadDag(dagPath);
        }
        catch {
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
        if (!l.base || git(["rev-parse", "--verify", branch], cwd).status !== 0)
            continue;
        const log = git(["log", "--reverse", "--format=%H", `${l.base}..${branch}`], cwd);
        if (log.status !== 0)
            continue;
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
            if (files.length > 3)
                fixesOverThreeFiles++;
            if (node) {
                for (const f of files) {
                    const inLane = node.owns.some((g) => expandAgainstTree(g, [f]).includes(f));
                    if (!inLane)
                        outOfLaneTouches++;
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
export function findingsPath(sprint, root) {
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
function remainingFindingsAllLow(sprint, root) {
    const p = findingsPath(sprint, root);
    if (!existsSync(p))
        return false;
    let findings;
    try {
        findings = parseJsonl(readFileSync(p, "utf8"));
    }
    catch {
        return false;
    }
    if (findings.length === 0)
        return false;
    return findings.every((f) => f.severity === "NITPICK");
}
/** One-call convenience: derive signals from real repo state, then score
 * them. This is the mechanism skills/sage-build/SKILL.md step 6 refers to —
 * the Eng Manager must call this rather than writing a number into the
 * ledger's Circuit section by hand. */
export function evaluateCircuitBreaker(l, root) {
    return computeWtf(deriveWtfSignals(l, root));
}
