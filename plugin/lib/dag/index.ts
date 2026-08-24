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

export function globIntersect(a: string, b: string, treePaths?: string[]): boolean {
  if (a === b) return true;
  const na = normalizeGlob(a);
  const nb = normalizeGlob(b);
  if (na === nb) return true;

  // Primary decision procedure (tech-spec §6.3): expand both globs against
  // the real repo file tree and check whether the resulting path sets
  // intersect. This is exact — no wildcard-position blind spot — for any
  // path the tree currently contains, which is what the false-negative
  // table (src/*.ts vs src/api.ts, src/**/*.ts vs src/api/foo.ts, etc.)
  // requires: those only ever went undetected because the old code looked
  // only at literal prefixes, never at what the globs actually match.
  const tree = treePaths ?? repoTreePaths();
  const matchesA = expandAgainstTree(na, tree);
  const matchesB = expandAgainstTree(nb, tree);
  if (matchesA.length > 0 && matchesB.length > 0) {
    const setB = new Set(matchesB);
    return matchesA.some((p) => setB.has(p));
  }

  // Fallback: one or both globs matched zero paths in the current tree —
  // e.g. two nodes both creating brand-new files under a directory that
  // doesn't exist yet. Tree expansion has nothing to compare in that case.
  // This is not a rare corner case: `/sage-dag` runs against files a sprint
  // is about to CREATE as often as files it's touching, so "neither side
  // has a tree match yet" is a realistic state, not just an edge case.
  //
  // A plain trailing-`**`-strip prefix comparison (prefixOverlap, kept below
  // for the narrow shapes it still catches cheaply) reintroduces exactly the
  // false-negative class this fix exists to close whenever the wildcard
  // isn't trailing — `src/*.ts` vs `src/api.ts` share no literal prefix once
  // you strip a trailing star that neither pattern has. So the primary
  // no-tree-match fallback is a real pattern-vs-pattern intersection check
  // (segmentsCanIntersect, below): could ANY concrete path satisfy both
  // globs, reasoning from the glob syntax alone. prefixOverlap only runs as
  // a last-resort OR on top of that, which can only ever add a false
  // positive, never remove a true one.
  return segmentsCanIntersect(na, nb) || prefixOverlap(na, nb) || prefixOverlap(nb, na);
}

// Do the glob patterns `a` and `b` — reasoned about purely as patterns, with
// no filesystem involved — admit at least one concrete path satisfying both?
// This is the fallback's fallback: it runs when tree-expansion had nothing
// to compare against on one or both sides. Segment semantics match
// globToRegExp: `**` matches zero or more whole path segments, `*` matches
// within a single segment (never crosses `/`), everything else is literal.
//
// Implemented as a memoized product walk over the two segment sequences
// (classic finite-automaton-intersection shape for this restricted wildcard
// dialect — decidable and cheap for the segment counts a real `owns` glob
// ever has). Conservative by construction: a segment pair it cannot prove
// incompatible is treated as compatible, so this can only ever return a
// false positive, never a false negative.
function segmentsCanIntersect(a: string, b: string): boolean {
  const as = a.split("/");
  const bs = b.split("/");
  const memo = new Map<string, boolean>();

  function rec(i: number, j: number): boolean {
    const key = i + "," + j;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    // Prevent infinite recursion on repeated "both sides ** stay put" states.
    memo.set(key, true);
    let result: boolean;
    if (i === as.length && j === bs.length) {
      result = true;
    } else if (i === as.length) {
      result = bs.slice(j).every((s) => s === "**");
    } else if (j === bs.length) {
      result = as.slice(i).every((s) => s === "**");
    } else {
      const A = as[i]!;
      const B = bs[j]!;
      if (A === "**" && B === "**") {
        result = rec(i + 1, j) || rec(i, j + 1) || rec(i + 1, j + 1);
      } else if (A === "**") {
        // ** consumes zero segments (drop it) or one segment that must also
        // satisfy B's current segment, staying at i for further consumption.
        result = rec(i + 1, j) || (segmentCompatible(null, B) && rec(i, j + 1));
      } else if (B === "**") {
        result = rec(i, j + 1) || (segmentCompatible(A, null) && rec(i + 1, j));
      } else {
        result = segmentCompatible(A, B) && rec(i + 1, j + 1);
      }
    }
    memo.set(key, result);
    return result;
  }

  return rec(0, 0);
}

// Can a single path segment simultaneously match single-segment patterns `x`
// and `y`? `null` means "any segment" (used when ** is consuming one
// segment and the other side has already been fully accounted for).
// Handles: bare `*`, no-wildcard-either-side, one-side-literal-vs-wildcarded,
// and exact equality. A segment containing an internal `*` compared against
// another segment ALSO containing an internal `*` (e.g. `a*.ts` vs `*b.ts`)
// is rare enough in real `owns` globs that we don't fully solve wildcard-vs-
// wildcard intersection here — conservatively treated as compatible, which
// can only produce a false positive, never a false negative.
// A segment "has a wildcard" if it contains `*`, `?`, or an (at least
// plausibly) unescaped `[` — the same three POSIX glob metacharacters
// globToRegExp/segmentRegExp now translate. Getting this detection wrong in
// either direction is exactly how the character-class/`?` false negative
// happened in the first place: a segment like `a?.ts` or `[ab]*.ts` has no
// `*` at position 0 but is still a live wildcard.
function hasWildcard(s: string): boolean {
  return s.includes("*") || s.includes("?") || s.includes("[");
}

function segmentCompatible(x: string | null, y: string | null): boolean {
  if (x === null || y === null) return true;
  if (x === "*" || y === "*") return true;
  if (!hasWildcard(x) && !hasWildcard(y)) return x === y;
  if (!hasWildcard(x)) return segmentRegExp(y).test(x);
  if (!hasWildcard(y)) return segmentRegExp(x).test(y);
  return true; // both sides wildcarded — conservative true, see comment above
}

// Single-segment (no `/`) glob-to-regex, since globToRegExp's `**` handling
// assumes a full normalized glob string, not an isolated segment.
function segmentRegExp(seg: string): RegExp {
  let re = "";
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i]!;
    if (c === "*") re += "[^/]*";
    else if (c === "?" || c === "[") {
      const t = translateBracketOrQuestion(seg, i);
      if (t) {
        re += t.chunk;
        i = t.next - 1;
        continue;
      }
      re += ".+^$()[]{}|\\".includes(c) ? "\\" + c : c;
    } else if (".+^$()[]{}|\\".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}

function repoTreePaths(cwd?: string): string[] {
  const root = gitRoot(cwd) || cwd || process.cwd();
  const res = git(["ls-files"], root);
  if (res.status !== 0) return [];
  return res.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
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

// POSIX glob character-class translation, shared by globToRegExp and
// segmentRegExp. `[...]`/`[!...]` and `?` are standard POSIX glob syntax —
// hooks/sage-lane already implements both correctly (its python branch via
// fnmatch, its node branch with its own from-scratch parser) — this used to
// be missing here entirely: `[` was escaped as a literal character and `?`
// fell through to the "insert literally" branch, where it's a live regex
// metachar (zero-or-one of the preceding char) rather than "exactly one
// character," silently making false negatives possible for any owns glob
// using either. Returns the consumed-up-to index so callers can resume.
function translateBracketOrQuestion(g: string, i: number): { chunk: string; next: number } | null {
  const c = g[i]!;
  if (c === "?") return { chunk: "[^/]", next: i + 1 };
  if (c !== "[") return null;
  let j = i + 1;
  let cls = "[";
  if (g[j] === "!" || g[j] === "^") {
    cls += "^";
    j++;
  }
  // A `]` immediately after `[` or `[!` is a literal member of the class,
  // per POSIX glob semantics, not the closing bracket.
  if (g[j] === "]") {
    cls += "\\]";
    j++;
  }
  while (j < g.length && g[j] !== "]") {
    const ch = g[j]!;
    cls += "\\^$.|?*+()[]{}".includes(ch) ? "\\" + ch : ch;
    j++;
  }
  if (j >= g.length) return null; // unterminated class — treat `[` as literal below
  cls += "]";
  return { chunk: cls, next: j + 1 };
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
    else if (c === "?" || c === "[") {
      const t = translateBracketOrQuestion(g, i);
      if (t) {
        re += t.chunk;
        i = t.next - 1;
        continue;
      }
      re += ".+^$()[]{}|\\".includes(c) ? "\\" + c : c;
    } else if (".+^$()[]{}|\\".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}

export function laneIntersections(dag: Dag, wave: string[]): Violation[] {
  const v: Violation[] = [];
  const tree = repoTreePaths();
  const nodes = wave.map((id) => dag.nodes.find((n) => n.id === id)!).filter(Boolean);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      for (const ga of a.owns) {
        for (const gb of b.owns) {
          if (globIntersect(ga, gb, tree)) {
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
