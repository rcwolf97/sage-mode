import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { git, gitRoot, projectSageDir } from "../util.js";
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
void git;
void gitRoot;
void existsSync;
