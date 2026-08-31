import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { git, gitRoot, projectDocsDir, projectSageDir, sha256 } from "../util.js";
const AUTH = /auth|session|jwt|oauth|permission|role/i;
const BACKEND = /(server|api\/|src\/api|backend|internal\/)/i;
const FRONTEND = /\.(tsx|jsx|css|scss|vue|svelte|html)$/i;
const MIGRATIONS = /migrat/i;
const API = /(openapi|swagger|\/routes\/|graphql|proto)/i;
const TESTS = /(\.test\.|\.spec\.|\/tests\/|\/__tests__\/)/i;
const INFRA = /(Dockerfile|terraform|\.yml|\.yaml|k8s|infra\/|deploy)/i;
const AI = /(prompt|eval|skill|agents\/)/i;
/** A rung ≥ 4 claim must look like a command-and-output pair. */
export function looksLikeCommandOutput(evidence) {
    if (!evidence.trim())
        return false;
    if (/```/.test(evidence))
        return true;
    if (/^[\$%#>]\s/m.test(evidence))
        return true;
    if (/\n\$\s/.test(evidence))
        return true;
    return false;
}
export function fingerprint(f) {
    if (f.fingerprint)
        return f.fingerprint;
    return f.line ? `${f.path}:${f.line}:${f.category}` : `${f.path}:${f.category}`;
}
// ---------------------------------------------------------------------------
// Finding row validation (schemas/finding.schema.json), enforced at gate()
// ---------------------------------------------------------------------------
//
// architecture-v3 §8.3 claims the finding shape is enforced "at the tool
// layer" via `--json-schema`. True for the Lane B path (`claude -p
// --json-schema`) — FALSE for Lane C, where the reviewer runs as a Cursor/
// Claude subagent: `output_schema` is not a documented subagent frontmatter
// field on either host. So malformed JSONL from a Lane C specialist had
// nothing between it and gate()/dedup() — a broken specialist that emits a
// row missing `severity`, or a `confidence` of 47, would flow straight
// through and *look like a clean bill of health*.
//
// Hand-rolled against schemas/finding.schema.json's actual constraints,
// following lib/dag/index.ts's validate() style (explicit field checks, not
// a generic JSON Schema interpreter) — this repo has zero runtime npm
// dependencies and stays that way. A row failing any check is REJECTED with
// a reason, never silently dropped (the reason travels with it — see
// gate()) and never silently coerced (a non-integer or out-of-range
// confidence is a rejection, not something rounded/clamped into range).
const SEVERITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "NITPICK"]);
const REQUIRED_NONEMPTY_STRING_FIELDS = ["path", "category", "summary", "specialist"];
const OPTIONAL_STRING_FIELDS = ["evidence", "fix", "test_stub", "fingerprint"];
/** Validates one raw, untrusted JSON value against the finding schema's
 * actual constraints (required fields; severity enum; integer confidence in
 * 1-10; non-empty path/category/summary/specialist; integer line >= 1 when
 * present; string-typed optional fields; boolean cannot_verify when
 * present). additionalProperties stays true per the schema — unknown extra
 * fields are not a rejection reason. */
export function validateFindingRow(row) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
        return { ok: false, reason: "row is not a JSON object" };
    }
    const r = row;
    for (const field of ["severity", "confidence", "path", "category", "summary", "specialist"]) {
        if (r[field] === undefined || r[field] === null) {
            return { ok: false, reason: `missing required field "${field}"` };
        }
    }
    if (typeof r.severity !== "string" || !SEVERITIES.has(r.severity)) {
        return {
            ok: false,
            reason: `severity must be one of CRITICAL, HIGH, MEDIUM, NITPICK — got ${JSON.stringify(r.severity)}`,
        };
    }
    if (typeof r.confidence !== "number" || !Number.isInteger(r.confidence) || r.confidence < 1 || r.confidence > 10) {
        return { ok: false, reason: `confidence must be an integer 1-10 — got ${JSON.stringify(r.confidence)}` };
    }
    for (const field of REQUIRED_NONEMPTY_STRING_FIELDS) {
        const v = r[field];
        if (typeof v !== "string" || v.length < 1) {
            return { ok: false, reason: `"${field}" must be a non-empty string — got ${JSON.stringify(v)}` };
        }
    }
    if (r.line !== undefined) {
        if (typeof r.line !== "number" || !Number.isInteger(r.line) || r.line < 1) {
            return { ok: false, reason: `line must be an integer >= 1 when present — got ${JSON.stringify(r.line)}` };
        }
    }
    for (const field of OPTIONAL_STRING_FIELDS) {
        if (r[field] !== undefined && typeof r[field] !== "string") {
            return { ok: false, reason: `"${field}" must be a string when present — got ${JSON.stringify(r[field])}` };
        }
    }
    if (r.cannot_verify !== undefined && typeof r.cannot_verify !== "boolean") {
        return { ok: false, reason: `cannot_verify must be a boolean when present — got ${JSON.stringify(r.cannot_verify)}` };
    }
    if (r.rung !== undefined) {
        if (typeof r.rung !== "number" || !Number.isInteger(r.rung) || r.rung < 1 || r.rung > 5) {
            return { ok: false, reason: `rung must be an integer 1-5 when present — got ${JSON.stringify(r.rung)}` };
        }
    }
    return { ok: true, finding: row };
}
export function gate(findings) {
    const accepted = [];
    const rejected = [];
    for (const row of findings) {
        const v = validateFindingRow(row);
        if (!v.ok) {
            rejected.push({ row, reason: v.reason });
            continue;
        }
        const f = v.finding;
        const copy = { ...f, fingerprint: fingerprint(f) };
        // Findings the reviewer flagged as `cannot_verify` are, by definition,
        // ones the diff cannot supply evidence for — the whole point is that the
        // evidence isn't in the diff. Capping their confidence for missing
        // `evidence` would defeat that; every other finding keeps the existing
        // low-evidence-caps-confidence rule.
        if (!copy.cannot_verify && (!copy.evidence || !copy.evidence.trim())) {
            copy.confidence = Math.min(copy.confidence, 5);
        }
        if (copy.rung != null && copy.rung >= 4 && !looksLikeCommandOutput(copy.evidence || "")) {
            copy.rung = 3;
            copy.confidence = Math.min(copy.confidence, 5);
        }
        copy.confidence = Math.max(1, Math.min(10, Math.round(copy.confidence)));
        accepted.push(copy);
    }
    return Object.assign(accepted, { rejected });
}
export function parseJsonl(text) {
    const out = [];
    for (const line of text.split(/\r?\n/)) {
        if (!line.trim())
            continue;
        try {
            out.push(JSON.parse(line));
        }
        catch {
            /* truncated line — skip */
        }
    }
    return out;
}
export function toJsonl(findings) {
    return findings.map((f) => JSON.stringify(f)).join("\n") + (findings.length ? "\n" : "");
}
export function dedup(findings) {
    const gated = gate(findings);
    const groups = new Map();
    for (const f of gated) {
        const fp = fingerprint(f);
        const arr = groups.get(fp) || [];
        arr.push(f);
        groups.set(fp, arr);
    }
    const out = [];
    for (const [, group] of groups) {
        group.sort((a, b) => b.confidence - a.confidence);
        const keep = { ...group[0] };
        const specialists = [...new Set(group.map((g) => g.specialist))];
        if (specialists.length > 1) {
            keep.summary = `MULTI-SPECIALIST CONFIRMED (${specialists.join(" + ")}) ${keep.summary}`;
            keep.confidence = Math.min(10, keep.confidence + 1);
        }
        // A cannot_verify finding must survive dedup as cannot_verify even when
        // merged under a higher-confidence duplicate that didn't flag it that
        // way — otherwise whichever specialist happened to score higher would
        // silently erase the "check this by hand" signal the other one raised.
        if (group.some((g) => g.cannot_verify))
            keep.cannot_verify = true;
        out.push(keep);
    }
    // dedup() calls gate() internally purely to key/merge only well-formed
    // rows — but gate() already computed which rows were rejected, and that
    // information must not evaporate here. Without this, a caller that goes
    // through dedup() (rather than gate()) gets a silently-shorter output with
    // no way to tell "nothing was wrong" apart from "N rows were malformed and
    // got dropped" — precisely the clean-bill-of-health failure mode gate()'s
    // `.rejected` exists to prevent (see the block comment above gate()).
    return Object.assign(out, { rejected: gated.rejected });
}
export function reviewStatePath(sprint, root) {
    return join(projectSageDir(root), "sprints", sprint, "review-state.json");
}
export function loadReviewState(sprint, root) {
    const p = reviewStatePath(sprint, root);
    if (!existsSync(p))
        return {};
    try {
        return JSON.parse(readFileSync(p, "utf8"));
    }
    catch {
        return {};
    }
}
export function saveReviewState(sprint, state, root) {
    const p = reviewStatePath(sprint, root);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify(state, null, 2) + "\n");
}
/** Suppress prior-run `skipped` fingerprints only when the file hash is unchanged. Never suppress `fixed`. */
export function applyCrossRunDedup(findings, state, fileHash) {
    return findings.filter((f) => {
        const fp = fingerprint(f);
        const prior = state[fp];
        if (!prior || prior.disposition !== "skipped")
            return true;
        const now = fileHash(f.path);
        if (!now)
            return true;
        return now !== prior.hash;
    });
}
export function classifyBand(confidence) {
    if (confidence >= 7)
        return "show";
    if (confidence >= 5)
        return "caveat";
    if (confidence >= 3)
        return "appendix";
    return "suppress";
}
/** classifyBand's confidence-only bands, plus the first-class "cannot_verify"
 * outcome: a finding for a requirement the diff doesn't touch, which no
 * confidence score can honestly represent — it isn't "low confidence this is
 * a bug," it's "unjudgeable from what changed." Routed to its own outcome
 * unconditionally (checked before, and independent of, confidence) so a
 * renderer can put these in their own section instead of folding them into
 * a confidence band that implies a pass/fail judgment was actually made. */
export function classifyFinding(f) {
    if (f.cannot_verify)
        return "cannot_verify";
    return classifyBand(f.confidence);
}
// ---------------------------------------------------------------------------
// Sage's own scratch output is not review scope
// ---------------------------------------------------------------------------
//
// Reproduced bug: `sage review scope` picked up .sage/sprints/NN/evidence.jsonl,
// .sage/sprints/NN/logs/*, and .worktrees/<node>/ — sage-mode's own bookkeeping
// and per-node worktree checkouts — as if they were reviewable source changes.
// None of them matched any SCOPE_* category, so scope() set error:"unmatched"
// and the CLI exits 2, which the skill escalates to the user as a classifier
// bug. It isn't one: the tool's own scratch output manufactured the alarm.
//
// Fix is an unconditional exclusion, applied to the *union* of committed
// diff + working-tree diff + untracked files before anything else runs —
// classification, the unmatched check, and DIFF_LINES all see only the
// filtered set. This is deliberately independent of whether .sage/ and
// .worktrees/ are actually gitignored (see lib/evidence/index.ts's
// checkSageIgnored for that separate, real concern): even a repo that force-
// adds these paths, or one where evidence.jsonl was accidentally committed
// once, must not have sage's own artifacts pollute review scope. The
// deliberate union of committed + working-tree + untracked diffs itself is
// unchanged and intentional — uncommitted WIP should still select reviewers.
const SAGE_SCRATCH_PREFIXES = [".sage/", ".worktrees/"];
function isSageScratchPath(path, notebookAssetsRelDir) {
    if (SAGE_SCRATCH_PREFIXES.some((p) => path === p.slice(0, -1) || path.startsWith(p)))
        return true;
    if (notebookAssetsRelDir && (path === notebookAssetsRelDir || path.startsWith(notebookAssetsRelDir + "/"))) {
        return true;
    }
    return false;
}
// Resolves to the project's notebook asset directory (default docs/assets,
// or <config notebook.root>/assets — see lib/notebook/index.ts's copyAssets,
// which is what actually writes there), relative to the repo root so it can
// be compared against git's root-relative path output. Returns null when the
// repo root can't be determined (e.g. cwd isn't inside a git repo at all) —
// nothing to resolve against, and scope() already handles that case via the
// no_base check on `opts.base`.
function notebookAssetsRelDir(cwd) {
    const root = gitRoot(cwd);
    if (!root)
        return null;
    const assetsAbs = join(projectDocsDir(root), "assets");
    const rel = relative(root, assetsAbs).split(sep).join("/");
    return rel || null;
}
export function scope(opts) {
    const cwd = opts.cwd || process.cwd();
    const baseCheck = git(["rev-parse", "--verify", opts.base], cwd);
    if (baseCheck.status !== 0) {
        return emptyScope("no_base");
    }
    const assetsRel = notebookAssetsRelDir(cwd);
    const excludeScratch = (rows) => rows.filter((f) => !isSageScratchPath(f, assetsRel));
    const committed = excludeScratch(git(["diff", "--name-only", opts.base], cwd)
        .stdout.split("\n")
        .map((s) => s.trim())
        .filter(Boolean));
    const wt = excludeScratch(git(["diff", "--name-only"], cwd)
        .stdout.split("\n")
        .map((s) => s.trim())
        .filter(Boolean));
    const untracked = excludeScratch(git(["ls-files", "--others", "--exclude-standard"], cwd)
        .stdout.split("\n")
        .map((s) => s.trim())
        .filter(Boolean));
    const files = [...new Set([...committed, ...wt, ...untracked])];
    const stat = git(["diff", "--numstat", opts.base], cwd).stdout;
    let lines = 0;
    for (const row of stat.split("\n")) {
        const m = row.match(/^(\d+|-)\s+(\d+|-)\s+(.*)$/);
        if (!m)
            continue;
        if (isSageScratchPath(m[3].trim(), assetsRel))
            continue;
        if (m[1] !== "-")
            lines += Number(m[1]);
        if (m[2] !== "-")
            lines += Number(m[2]);
    }
    const s = {
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
    const any = s.SCOPE_AUTH ||
        s.SCOPE_BACKEND ||
        s.SCOPE_FRONTEND ||
        s.SCOPE_MIGRATIONS ||
        s.SCOPE_API ||
        s.SCOPE_TESTS ||
        s.SCOPE_INFRA ||
        s.SCOPE_AI;
    if (files.length && !any)
        s.error = "unmatched";
    return s;
}
function emptyScope(error) {
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
];
export function select(opts) {
    const s = opts.scope;
    const roster = [];
    const add = (name) => {
        if (!roster.includes(name))
            roster.push(name);
    };
    if (s.DIFF_LINES >= 30) {
        add("correctness");
        add("testing");
    }
    if (s.DIFF_LINES >= 200)
        add("maintainability");
    if (s.SCOPE_AUTH || (s.SCOPE_BACKEND && s.DIFF_LINES > 100))
        add("security");
    if (s.SCOPE_MIGRATIONS)
        add("data-migration");
    if (s.SCOPE_API)
        add("api-contract");
    if (s.SCOPE_BACKEND || s.SCOPE_FRONTEND)
        add("performance");
    if (s.SCOPE_FRONTEND && opts.designRequired)
        add("design");
    if (s.SCOPE_AI)
        add("prompt-eval");
    if (opts.all) {
        for (const n of SPECIALIST_ROSTER)
            add(n);
    }
    for (const f of opts.force || [])
        add(f);
    const neverGate = new Set(["security", "data-migration"]);
    const stats = opts.stats || {};
    const filtered = roster.filter((name) => {
        if (opts.all || (opts.force || []).includes(name))
            return true;
        if (neverGate.has(name))
            return true;
        const st = stats[name];
        if (st && st.dispatches >= 10 && st.findings === 0)
            return false;
        return true;
    });
    return filtered;
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
// Verifies a rendered review artifact (review.md contents) has a mandatory,
// specific `## Recommendation` line. Checks, in order:
//   1. the section exists at all
//   2. it isn't empty
//   3. it cites a specific file:line
//   4. it isn't pure generic hedging with no citation to back it
export function checkRecommendation(reviewMarkdown) {
    const issues = [];
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
export function classifyFix(f) {
    // A cannot_verify finding has no diff evidence behind it by definition —
    // there is nothing here an auto-fix could safely act on. Always ASK.
    if (f.cannot_verify)
        return "ASK";
    if (f.test_stub)
        return "ASK";
    if (f.severity === "CRITICAL")
        return "ASK";
    const askCats = /security|auth|xss|injection|race|design/i;
    if (askCats.test(f.category) || askCats.test(f.summary))
        return "ASK";
    if (f.severity === "MEDIUM" || f.severity === "NITPICK")
        return "AUTO-FIX";
    return "ASK";
}
export function contentHash(path) {
    if (!existsSync(path))
        return undefined;
    try {
        return sha256(readFileSync(path, "utf8"));
    }
    catch {
        return undefined;
    }
}
export function sessionReviewDir(slug, root) {
    const day = new Date().toISOString().slice(0, 10);
    return join(projectSageDir(root), "reviews", `${day}-${slug}`);
}
