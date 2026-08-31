import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseFrontmatter, projectDocsDir, projectSageDir, readSageHome } from "../util.js";
const K1 = 1.5;
const B = 0.75;
const STOP = new Set("a an the and or of to in on for with from by at as is are was were be been being this that these those it its into over under not no yes if then else when where how what which who whom whose your you we they them our".split(" "));
export function tokenize(text) {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((t) => stem(t))
        .filter((t) => t.length > 1 && !STOP.has(t));
}
function stem(w) {
    if (w.length <= 3)
        return w;
    return w.replace(/(ing|ed|es|s)$/g, "");
}
function walk(root, pred, acc = []) {
    if (!existsSync(root))
        return acc;
    for (const name of readdirSync(root)) {
        if (name.startsWith("."))
            continue;
        const p = join(root, name);
        const st = statSync(p);
        if (st.isDirectory())
            walk(p, pred, acc);
        else if (pred(name))
            acc.push(p);
    }
    return acc;
}
function indexFile(path, root, kindFallback) {
    const raw = readFileSync(path, "utf8");
    const { data, body } = parseFrontmatter(raw);
    const title = String(data.title || data.name || path.split("/").pop()?.replace(/\.md$/, "") || "");
    const kind = String(data.kind || kindFallback);
    const applies = data.applies_when ? String(data.applies_when) : undefined;
    const description = data.description ? String(data.description) : undefined;
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const blob = [title, applies, description, tags.join(" "), body].filter(Boolean).join("\n");
    const tokens = tokenize(blob);
    const terms = {};
    for (const t of tokens)
        terms[t] = (terms[t] || 0) + 1;
    const id = relative(root, path).replace(/\\/g, "/").replace(/\/SKILL\.md$/, "").replace(/\.md$/, "");
    return {
        id,
        path: relative(process.cwd(), path).replace(/\\/g, "/"),
        kind,
        title,
        applies_when: applies,
        description,
        tags,
        terms,
        len: tokens.length,
    };
}
export function buildIndex(opts) {
    const docsRoot = opts?.docsRoot || projectDocsDir(opts?.cwd);
    const skillsRoot = opts?.skillsRoot || join(readSageHome() || "", "skills");
    const scopeRoot = opts?.scopeRoot || join(projectSageDir(opts?.cwd), "out-of-scope");
    const docs = walk(docsRoot, (n) => n.endsWith(".md")).map((p) => indexFile(p, docsRoot, "note"));
    const skills = walk(skillsRoot, (n) => n === "SKILL.md").map((p) => indexFile(p, skillsRoot, "skill"));
    const scope = existsSync(scopeRoot)
        ? walk(scopeRoot, (n) => n.endsWith(".md")).map((p) => indexFile(p, scopeRoot, "out-of-scope"))
        : [];
    const all = [...docs, ...skills, ...scope];
    const df = {};
    for (const d of all) {
        for (const t of Object.keys(d.terms))
            df[t] = (df[t] || 0) + 1;
    }
    const N = all.length;
    const avgdl = N ? all.reduce((s, d) => s + d.len, 0) / N : 0;
    return {
        version: 1,
        builtAt: new Date().toISOString(),
        docs: [...docs, ...scope],
        skills,
        stats: { N, avgdl, df },
    };
}
export function saveIndex(idx, cwd) {
    const p = join(projectSageDir(cwd), "index.json");
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify(idx) + "\n");
    return p;
}
export function loadIndex(cwd) {
    const p = join(projectSageDir(cwd), "index.json");
    if (!existsSync(p))
        return null;
    return JSON.parse(readFileSync(p, "utf8"));
}
function idf(term, N, df) {
    const n = df[term] || 0;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}
export function bm25(query, doc, stats) {
    let score = 0;
    const avgdl = stats.avgdl || 1;
    for (const t of query) {
        const tf = doc.terms[t] || 0;
        if (!tf)
            continue;
        const d = idf(t, stats.N, stats.df);
        score += (d * (tf * (K1 + 1))) / (tf + K1 * (1 - B + B * (doc.len / avgdl)));
    }
    return score;
}
export function search(idx, query, opts) {
    const q = tokenize(query);
    if (!q.length)
        return [];
    const pool = [...idx.docs, ...idx.skills].filter((d) => !opts?.kind || d.kind === opts.kind);
    const scored = pool
        .map((d) => ({ d, score: bm25(q, d, idx.stats) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, opts?.n ?? 5);
    return scored.map(({ d, score }) => ({
        id: d.id,
        path: d.path,
        kind: d.kind,
        title: d.title,
        score,
        snippet: (d.applies_when || d.description || d.title).slice(0, 200),
    }));
}
export function dedupAppliesWhen(idx, text, threshold = 0.55) {
    const q = tokenize(text);
    const learnings = idx.docs.filter((d) => d.kind === "learning");
    const hits = [];
    const max = Math.max(1, ...learnings.map((d) => bm25(q, d, idx.stats)));
    for (const d of learnings) {
        const s = bm25(q, d, idx.stats);
        const norm = s / (max || 1);
        if (s > 0 && (overlap(q, tokenize(d.applies_when || d.title)) >= threshold || norm >= threshold)) {
            hits.push({ d, score: s });
        }
    }
    return hits.sort((a, b) => b.score - a.score).map((h) => h.d);
}
export function overlap(a, b) {
    if (!a.length || !b.length)
        return 0;
    const sb = new Set(b);
    const inter = a.filter((t) => sb.has(t)).length;
    return inter / Math.max(a.length, b.length);
}
