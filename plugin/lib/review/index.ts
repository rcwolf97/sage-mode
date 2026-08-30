import { git } from "../util.js";

export interface Finding {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "NITPICK";
  confidence: number;
  path: string;
  line?: number;
  category: string;
  summary: string;
  evidence?: string;
  fix?: string;
  test_stub?: string;
  fingerprint?: string;
  specialist: string;
}

export interface Scope {
  SCOPE_AUTH: boolean;
  SCOPE_BACKEND: boolean;
  SCOPE_FRONTEND: boolean;
  SCOPE_MIGRATIONS: boolean;
  SCOPE_API: boolean;
  SCOPE_TESTS: boolean;
  SCOPE_INFRA: boolean;
  SCOPE_AI: boolean;
  DIFF_LINES: number;
  files: string[];
  error?: "no_base" | "unmatched";
}

const AUTH = /auth|session|jwt|oauth|permission|role/i;
const BACKEND = /(server|api\/|src\/api|backend|internal\/)/i;
const FRONTEND = /\.(tsx|jsx|css|scss|vue|svelte|html)$/i;
const MIGRATIONS = /migrat/i;
const API = /(openapi|swagger|\/routes\/|graphql|proto)/i;
const TESTS = /(\.test\.|\.spec\.|\/tests\/|\/__tests__\/)/i;
const INFRA = /(Dockerfile|terraform|\.yml|\.yaml|k8s|infra\/|deploy)/i;
const AI = /(prompt|eval|skill|agents\/)/i;

export function fingerprint(f: Finding): string {
  if (f.fingerprint) return f.fingerprint;
  return f.line ? `${f.path}:${f.line}:${f.category}` : `${f.path}:${f.category}`;
}

export function gate(findings: Finding[]): Finding[] {
  return findings.map((f) => {
    const copy = { ...f, fingerprint: fingerprint(f) };
    if (!copy.evidence || !copy.evidence.trim()) {
      copy.confidence = Math.min(copy.confidence, 5);
    }
    copy.confidence = Math.max(1, Math.min(10, Math.round(copy.confidence)));
    return copy;
  });
}

export function parseJsonl(text: string): Finding[] {
  const out: Finding[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Finding);
    } catch {
      /* truncated line — skip */
    }
  }
  return out;
}

export function toJsonl(findings: Finding[]): string {
  return findings.map((f) => JSON.stringify(f)).join("\n") + (findings.length ? "\n" : "");
}

export function dedup(findings: Finding[]): Finding[] {
  const gated = gate(findings);
  const groups = new Map<string, Finding[]>();
  for (const f of gated) {
    const fp = fingerprint(f);
    const arr = groups.get(fp) || [];
    arr.push(f);
    groups.set(fp, arr);
  }
  const out: Finding[] = [];
  for (const [, group] of groups) {
    group.sort((a, b) => b.confidence - a.confidence);
    const keep = { ...group[0]! };
    const specialists = [...new Set(group.map((g) => g.specialist))];
    if (specialists.length > 1) {
      keep.summary = `MULTI-SPECIALIST CONFIRMED (${specialists.join(" + ")}) ${keep.summary}`;
      keep.confidence = Math.min(10, keep.confidence + 1);
    }
    out.push(keep);
  }
  return out;
}

export function classifyBand(confidence: number): "show" | "caveat" | "appendix" | "suppress" {
  if (confidence >= 7) return "show";
  if (confidence >= 5) return "caveat";
  if (confidence >= 3) return "appendix";
  return "suppress";
}

export function scope(opts: { base: string; cwd?: string }): Scope {
  const cwd = opts.cwd || process.cwd();
  const baseCheck = git(["rev-parse", "--verify", opts.base], cwd);
  if (baseCheck.status !== 0) {
    return emptyScope("no_base");
  }
  const committed = git(["diff", "--name-only", opts.base], cwd)
    .stdout.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const wt = git(["diff", "--name-only"], cwd)
    .stdout.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"], cwd)
    .stdout.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const files = [...new Set([...committed, ...wt, ...untracked])];
  const stat = git(["diff", "--numstat", opts.base], cwd).stdout;
  let lines = 0;
  for (const row of stat.split("\n")) {
    const m = row.match(/^(\d+|-)\s+(\d+|-)/);
    if (!m) continue;
    if (m[1] !== "-") lines += Number(m[1]);
    if (m[2] !== "-") lines += Number(m[2]);
  }
  const s: Scope = {
    SCOPE_AUTH: files.some((f) => AUTH.test(f)),
    SCOPE_BACKEND: files.some((f) => BACKEND.test(f)),
    SCOPE_FRONTEND: files.some((f) => FRONTEND.test(f)),
    SCOPE_MIGRATIONS: files.some((f) => MIGRATIONS.test(f)),
    SCOPE_API: files.some((f) => API.test(f)),
    SCOPE_TESTS: files.some((f) => TESTS.test(f)),
    SCOPE_INFRA: files.some((f) => INFRA.test(f)),
    SCOPE_AI: files.some((f) => AI.test(f)),
    DIFF_LINES: lines,
    files,
  };
  const any =
    s.SCOPE_AUTH ||
    s.SCOPE_BACKEND ||
    s.SCOPE_FRONTEND ||
    s.SCOPE_MIGRATIONS ||
    s.SCOPE_API ||
    s.SCOPE_TESTS ||
    s.SCOPE_INFRA ||
    s.SCOPE_AI;
  if (files.length && !any) s.error = "unmatched";
  return s;
}

function emptyScope(error: Scope["error"]): Scope {
  return {
    SCOPE_AUTH: false,
    SCOPE_BACKEND: false,
    SCOPE_FRONTEND: false,
    SCOPE_MIGRATIONS: false,
    SCOPE_API: false,
    SCOPE_TESTS: false,
    SCOPE_INFRA: false,
    SCOPE_AI: false,
    DIFF_LINES: 0,
    files: [],
    error,
  };
}

export interface SpecialistStats {
  [name: string]: { dispatches: number; findings: number };
}

// Single source of truth for the roster's 9 specialist names — select()'s
// opts.all branch and the mechanical checklist-file test (test/review.test.ts)
// both read from this instead of each keeping their own copy, which is what
// let the two silently disagree before: a complex-workload review found
// skills/sage-review/SKILL.md's "pass the checklist path" instruction had no
// matching file for any of these names anywhere in the shipped plugin.
export const SPECIALIST_ROSTER = [
  "correctness",
  "testing",
  "maintainability",
  "security",
  "data-migration",
  "api-contract",
  "performance",
  "design",
  "prompt-eval",
] as const;

export function select(opts: {
  scope: Scope;
  stats?: SpecialistStats;
  all?: boolean;
  force?: string[];
  designRequired?: boolean;
}): string[] {
  const s = opts.scope;
  const roster: string[] = [];
  const add = (name: string) => {
    if (!roster.includes(name)) roster.push(name);
  };
  if (s.DIFF_LINES >= 30) {
    add("correctness");
    add("testing");
  }
  if (s.DIFF_LINES >= 200) add("maintainability");
  if (s.SCOPE_AUTH || (s.SCOPE_BACKEND && s.DIFF_LINES > 100)) add("security");
  if (s.SCOPE_MIGRATIONS) add("data-migration");
  if (s.SCOPE_API) add("api-contract");
  if (s.SCOPE_BACKEND || s.SCOPE_FRONTEND) add("performance");
  if (s.SCOPE_FRONTEND && opts.designRequired) add("design");
  if (s.SCOPE_AI) add("prompt-eval");
  if (opts.all) {
    for (const n of SPECIALIST_ROSTER) add(n);
  }
  for (const f of opts.force || []) add(f);

  const neverGate = new Set(["security", "data-migration"]);
  const stats = opts.stats || {};
  const filtered = roster.filter((name) => {
    if (opts.all || (opts.force || []).includes(name)) return true;
    if (neverGate.has(name)) return true;
    const st = stats[name];
    if (st && st.dispatches >= 10 && st.findings === 0) return false;
    return true;
  });
  return filtered;
}

export function shouldRedTeam(scope: Scope, findings: Finding[]): boolean {
  return scope.DIFF_LINES > 200 || findings.some((f) => f.severity === "CRITICAL");
}

// --- Recommendation check -------------------------------------------------
//
// gstack's model: every review artifact ends with one canonical bottom-line
// sentence — `Recommendation: <action> because <path:line — finding>` — so a
// human skimming a long review can find "what do I do and why" without
// reading every finding. This lives here (not lib/lint) because it is
// review-domain logic, not plugin-structure linting: lib/lint walks
// SKILL.md/agents/hooks/schemas for authoring hygiene, while this module
// already owns the Finding schema, the fingerprint format, and the
// gate/dedup pipeline the Recommendation line is supposed to be derived
// from. Keeping the check next to gate()/dedup()/classifyBand() means the
// whole pipeline — findings in, Recommendation out — stays in one file.
//
// The citation pattern intentionally mirrors fingerprint()'s
// `{path}:{line}:{category}` shape (loosened to just `path:line`, since the
// recommendation prose doesn't carry a machine-readable category suffix).
const FILE_LINE_RE = /[\w./-]+:\d+/;

// Mirrors lib/lint's CONDUCT_PHRASES: known-generic phrases that read as
// boilerplate rather than a real, evidenced conclusion. A hedge alone fails
// the check; a hedge that still names a concrete path:line does not, because
// the specific citation is what actually carries the "why" — the wording
// around it is not load-bearing once the citation is there.
export const GENERIC_RECOMMENDATION_PHRASES = [
  "proceed with caution",
  "looks fine overall",
  "no major issues",
  "use your judgment",
  "looks good overall",
  "looks good to me",
  "no significant issues found",
];

export interface RecommendationCheck {
  ok: boolean;
  issues: string[];
}

// Verifies a rendered review artifact (review.md contents) has a mandatory,
// specific `## Recommendation` line. Checks, in order:
//   1. the section exists at all
//   2. it isn't empty
//   3. it cites a specific file:line
//   4. it isn't pure generic hedging with no citation to back it
export function checkRecommendation(reviewMarkdown: string): RecommendationCheck {
  const issues: string[] = [];
  // Slice by heading boundary rather than a single lazy-match regex: a lazy
  // `[\s\S]*?` bounded by a lookahead on multiline `$` is ambiguous the
  // moment the body spans more than one line (multiline `$` matches before
  // *every* newline, so the lookahead can succeed after just the first
  // line). Finding the heading, then the next `## ` heading (or EOF), and
  // slicing between is unambiguous regardless of how many lines the body
  // spans.
  const headingRe = /^## Recommendation[ \t]*$/m;
  const headingMatch = headingRe.exec(reviewMarkdown);
  if (!headingMatch) {
    issues.push("missing ## Recommendation section");
    return { ok: false, issues };
  }
  const rest = reviewMarkdown.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingMatch = /^##\s/m.exec(rest);
  const body = (nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest).trim();
  if (!body) {
    issues.push("## Recommendation section is empty");
    return { ok: false, issues };
  }
  const hasCitation = FILE_LINE_RE.test(body);
  if (!hasCitation) {
    issues.push("Recommendation does not cite a specific file:line");
  }
  const lower = body.toLowerCase();
  const genericHit = GENERIC_RECOMMENDATION_PHRASES.find((p) => lower.includes(p));
  if (genericHit && !hasCitation) {
    issues.push(`Recommendation is a generic hedge ("${genericHit}") with no specific file:line citation`);
  }
  return { ok: issues.length === 0, issues };
}

export function classifyFix(f: Finding): "AUTO-FIX" | "ASK" {
  if (f.test_stub) return "ASK";
  if (f.severity === "CRITICAL") return "ASK";
  const askCats = /security|auth|xss|injection|race|design/i;
  if (askCats.test(f.category) || askCats.test(f.summary)) return "ASK";
  if (f.severity === "MEDIUM" || f.severity === "NITPICK") return "AUTO-FIX";
  return "ASK";
}
