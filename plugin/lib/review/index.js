import { git } from "../util.js";
const AUTH = /auth|session|jwt|oauth|permission|role/i;
const BACKEND = /(server|api\/|src\/api|backend|internal\/)/i;
const FRONTEND = /\.(tsx|jsx|css|scss|vue|svelte|html)$/i;
const MIGRATIONS = /migrat/i;
const API = /(openapi|swagger|\/routes\/|graphql|proto)/i;
const TESTS = /(\.test\.|\.spec\.|\/tests\/|\/__tests__\/)/i;
const INFRA = /(Dockerfile|terraform|\.yml|\.yaml|k8s|infra\/|deploy)/i;
const AI = /(prompt|eval|skill|agents\/)/i;
export function fingerprint(f) {
    if (f.fingerprint)
        return f.fingerprint;
    return f.line ? `${f.path}:${f.line}:${f.category}` : `${f.path}:${f.category}`;
}
export function gate(findings) {
    return findings.map((f) => {
        const copy = { ...f, fingerprint: fingerprint(f) };
        if (!copy.evidence || !copy.evidence.trim()) {
            copy.confidence = Math.min(copy.confidence, 5);
        }
        copy.confidence = Math.max(1, Math.min(10, Math.round(copy.confidence)));
        return copy;
    });
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
        out.push(keep);
    }
    return out;
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
export function scope(opts) {
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
        if (!m)
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
        for (const n of [
            "correctness",
            "testing",
            "maintainability",
            "security",
            "data-migration",
            "api-contract",
            "performance",
            "design",
            "prompt-eval",
        ])
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
export function shouldRedTeam(scope, findings) {
    return scope.DIFF_LINES > 200 || findings.some((f) => f.severity === "CRITICAL");
}
export function classifyFix(f) {
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
