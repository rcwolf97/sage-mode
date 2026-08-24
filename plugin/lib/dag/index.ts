import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { git, gitRoot, readJson } from "../util.js";

export const ROLES = ["frontend", "backend", "data", "infra", "ai", "design"] as const;
export type Role = (typeof ROLES)[number];

export interface DagNode {
  id: string;
  title: string;
  role: Role;
  depends_on?: string[];
  owns: string[];
  reads?: string[];
  acceptance: string[];
  verify: string;
  risk: "low" | "medium" | "high";
  design?: "none" | "required";
  model?: string | null;
  notes?: string;
}

export interface Dag {
  version: 1;
  sprint: string;
  base: string;
  profile?: "web" | "api" | "cli" | "ai-product";
  nodes: DagNode[];
}

export interface Violation {
  code: string;
  message: string;
  nodes?: string[];
}

const ID = /^n[0-9]+$/;
const SPRINT = /^[0-9]{2}(-[a-z0-9-]+)?$/;
const BAD_ACCEPT = /\b(works|correctly|properly|as expected)\b/i;

export function loadDag(path: string): Dag {
  return readJson<Dag>(path);
}

export function validate(dag: Dag): Violation[] {
  const v: Violation[] = [];
  if (dag.version !== 1) v.push({ code: "schema", message: "version must be 1" });
  if (!SPRINT.test(dag.sprint || "")) v.push({ code: "schema", message: `sprint id invalid: ${dag.sprint}` });
  if (!dag.base) v.push({ code: "schema", message: "base is required" });
  if (!Array.isArray(dag.nodes) || dag.nodes.length < 1) v.push({ code: "schema", message: "nodes minItems 1" });
  if (dag.nodes?.length > 60) v.push({ code: "schema", message: "nodes maxItems 60" });

  const ids = new Set<string>();
  for (const n of dag.nodes || []) {
    if (!ID.test(n.id)) v.push({ code: "schema", message: `bad id ${n.id}` });
    if (ids.has(n.id)) v.push({ code: "schema", message: `duplicate id ${n.id}` });
    ids.add(n.id);
    if (!n.title || n.title.length < 8 || n.title.length > 120) {
      v.push({ code: "schema", message: `title length on ${n.id}` });
    }
    if (!ROLES.includes(n.role)) v.push({ code: "schema", message: `bad role on ${n.id}` });
    if (!n.owns?.length) v.push({ code: "schema", message: `owns required on ${n.id}` });
    if (!n.acceptance?.length) v.push({ code: "schema", message: `acceptance required on ${n.id}` });
    if (!n.verify) v.push({ code: "schema", message: `verify required on ${n.id}` });
    if (!["low", "medium", "high"].includes(n.risk)) v.push({ code: "schema", message: `risk on ${n.id}` });
    for (const a of n.acceptance || []) {
      if (a.length < 10) v.push({ code: "schema", message: `acceptance too short on ${n.id}` });
      if (BAD_ACCEPT.test(a) && !/\d/.test(a) && !/returns|exits|equals|contains|renders/i.test(a)) {
        v.push({ code: "D4", message: `acceptance not observable on ${n.id}: ${a}`, nodes: [n.id] });
      }
    }
    for (const g of n.owns || []) {
      if (g === "**" || g === "*" || g === "/" || g === ".") {
        v.push({ code: "D3", message: `${n.id} owns ${g} — a lane that owns everything is not a lane`, nodes: [n.id] });
      }
    }
  }

  const idSet = new Set((dag.nodes || []).map((n) => n.id));
  for (const n of dag.nodes || []) {
    for (const d of n.depends_on || []) {
      if (!idSet.has(d)) v.push({ code: "D1", message: `${n.id} depends on missing ${d}`, nodes: [n.id, d] });
    }
  }
  const cycle = findCycle(dag);
  if (cycle) v.push({ code: "D1", message: `cycle: ${cycle.join(" -> ")}`, nodes: cycle });

  const waves = plan(dag).waves;
  waves.forEach((wave, i) => {
    const high = wave.filter((id) => dag.nodes.find((n) => n.id === id)?.risk === "high");
    if (high.length > 2) {
      v.push({
        code: "D7",
        message: `wave ${i + 1} schedules ${high.length} high-risk nodes`,
        nodes: high,
      });
    }
    const hits = laneIntersections(dag, wave);
    for (const h of hits) v.push(h);
  });

  return v;
}

function findCycle(dag: Dag): string[] | null {
  const nodes = new Map(dag.nodes.map((n) => [n.id, n.depends_on || []]));
  const seen = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];
  let found: string[] | null = null;
  const dfs = (id: string) => {
    if (found) return;
    if (stack.has(id)) {
      found = [...path.slice(path.indexOf(id)), id];
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    stack.add(id);
    path.push(id);
    for (const d of nodes.get(id) || []) dfs(d);
    path.pop();
    stack.delete(id);
  };
  for (const id of nodes.keys()) dfs(id);
  return found;
}

export function plan(dag: Dag): { waves: string[][] } {
  const indeg = new Map<string, number>();
  const kids = new Map<string, string[]>();
  for (const n of dag.nodes) {
    indeg.set(n.id, 0);
    kids.set(n.id, []);
  }
  for (const n of dag.nodes) {
    for (const d of n.depends_on || []) {
      indeg.set(n.id, (indeg.get(n.id) || 0) + 1);
      kids.get(d)?.push(n.id);
    }
  }
  const waves: string[][] = [];
  let ready = [...indeg.entries()].filter(([, v]) => v === 0).map(([k]) => k).sort();
  const seen = new Set<string>();
  while (ready.length) {
    waves.push(ready);
    const next: string[] = [];
    for (const id of ready) {
      seen.add(id);
      for (const c of kids.get(id) || []) {
        indeg.set(c, (indeg.get(c) || 1) - 1);
        if (indeg.get(c) === 0) next.push(c);
      }
    }
    ready = next.sort();
  }
  if (seen.size !== dag.nodes.length) {
    /* cycle — remaining nodes omitted */
  }
  return { waves };
}

export function globIntersect(a: string, b: string): boolean {
  if (a === b) return true;
  const na = normalizeGlob(a);
  const nb = normalizeGlob(b);
  if (na === nb) return true;
  if (prefixOverlap(na, nb) || prefixOverlap(nb, na)) return true;
  return false;
}

function normalizeGlob(g: string): string {
  return g.replace(/^\.\//, "").replace(/\/$/, "");
}

function prefixOverlap(a: string, b: string): boolean {
  const ap = a.replace(/\*\*$/, "").replace(/\*$/, "").replace(/\/$/, "");
  const bp = b.replace(/\*\*$/, "").replace(/\*$/, "").replace(/\/$/, "");
  if (!ap || !bp) return true;
  return ap === bp || ap.startsWith(bp + "/") || bp.startsWith(ap + "/");
}

export function expandAgainstTree(glob: string, treePaths: string[]): string[] {
  const re = globToRegExp(glob);
  return treePaths.filter((p) => re.test(p));
}

function globToRegExp(glob: string): RegExp {
  const g = normalizeGlob(glob);
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i]!;
    if (c === "*" && g[i + 1] === "*") {
      re += ".*";
      i++;
      if (g[i + 1] === "/") i++;
    } else if (c === "*") re += "[^/]*";
    else if (".+^$()[]{}|\\".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}

export function laneIntersections(dag: Dag, wave: string[]): Violation[] {
  const v: Violation[] = [];
  const nodes = wave.map((id) => dag.nodes.find((n) => n.id === id)!).filter(Boolean);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      for (const ga of a.owns) {
        for (const gb of b.owns) {
          if (globIntersect(ga, gb)) {
            v.push({
              code: "D2",
              message: `${a.id} and ${b.id} intersect on ${ga} ∩ ${gb}`,
              nodes: [a.id, b.id],
            });
          }
        }
      }
    }
  }
  return v;
}

export function lanes(dag: Dag, waveIndex: number): Violation[] {
  const { waves } = plan(dag);
  const wave = waves[waveIndex - 1];
  if (!wave) return [{ code: "wave", message: `no wave ${waveIndex}` }];
  return laneIntersections(dag, wave);
}

export function worktree(nodeId: string, dag: Dag, cwd?: string): string {
  const root = gitRoot(cwd) || cwd || process.cwd();
  const nn = dag.sprint.match(/^[0-9]{2}/)?.[0] || "00";
  const dir = join(root, ".worktrees", `s${nn}-${nodeId}`);
  if (existsSync(join(dir, ".git")) || existsSync(dir)) {
    const check = git(["worktree", "list", "--porcelain"], root);
    if (check.stdout.includes(dir)) return dir;
  }
  mkdirSync(join(root, ".worktrees"), { recursive: true });
  const add = git(["worktree", "add", "-B", `sprint/${dag.sprint}-${nodeId}`, dir, dag.base], root);
  if (add.status !== 0) {
    const retry = git(["worktree", "add", dir, dag.base], root);
    if (retry.status !== 0) {
      throw new Error(add.stderr || retry.stderr || "worktree add failed");
    }
  }
  return dir;
}

export function megafileFlag(dag: Dag, cwd?: string): Violation[] {
  const root = gitRoot(cwd) || cwd || process.cwd();
  const v: Violation[] = [];
  for (const n of dag.nodes) {
    if (n.owns.length === 1 && !n.owns[0]!.includes("*")) {
      const p = join(root, n.owns[0]!);
      if (existsSync(p)) {
        const text = readFileSync(p, "utf8");
        if (text.split("\n").length > 800) {
          v.push({ code: "D6", message: `${n.id} owns a single file over 800 lines: ${n.owns[0]}`, nodes: [n.id] });
        }
      }
    }
  }
  return v;
}

export function validateFile(path: string, cwd?: string): Violation[] {
  const dag = loadDag(path);
  return [...validate(dag), ...megafileFlag(dag, cwd)];
}
