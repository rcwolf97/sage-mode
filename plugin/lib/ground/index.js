import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { git, gitRoot } from "../util.js";
const PATH_CITE = /(?<![A-Za-z0-9_/.*-])((?:[\w.*-]+\/)+[\w.*-]+\.[A-Za-z0-9]+)(?::(\d+))?/g;
const HEX = /\b([0-9a-f]{7,40})\b/gi;
const SCAFFOLD = /Learning \d+|TODO\(|\{\{[^}]+\}\}|<slug>/g;
const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;
function lineOf(src, index) {
    return src.slice(0, index).split("\n").length;
}
function pathExists(root, cited, extraBase) {
    const bases = [root, extraBase].filter((b) => !!b);
    if (cited.includes("*")) {
        const parent = cited.replace(/\/?[^/]*\*.*$/, "") || ".";
        return bases.some((b) => existsSync(join(b, parent)) && statSync(join(b, parent)).isDirectory());
    }
    for (const b of bases) {
        const abs = isAbsolute(cited) ? cited : join(b, cited);
        try {
            if (existsSync(abs) && statSync(abs).isFile())
                return true;
        }
        catch {
            /* continue */
        }
        if (cited.endsWith(".html")) {
            const md = abs.replace(/\.html$/, ".md");
            try {
                if (existsSync(md) && statSync(md).isFile())
                    return true;
            }
            catch {
                /* continue */
            }
        }
    }
    return false;
}
export function groundMechanical(filePath, cwd) {
    const root = gitRoot(cwd) || cwd || process.cwd();
    const abs = isAbsolute(filePath) ? filePath : resolve(root, filePath);
    const src = readFileSync(abs, "utf8");
    const flags = [];
    const dir = dirname(abs);
    const seen = new Set();
    for (const m of src.matchAll(PATH_CITE)) {
        const cited = m[1];
        if (cited.startsWith("http") || cited.includes("node_modules"))
            continue;
        const key = `path:${cited}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const plugin = join(root, "plugin");
        const extra = existsSync(plugin) ? plugin : undefined;
        const ok = pathExists(root, cited, extra) || pathExists(dir, cited);
        if (!ok) {
            flags.push({
                kind: "path",
                text: cited,
                action: "fix",
                detail: `cited path does not exist in the working tree: ${cited}`,
                line: lineOf(src, m.index ?? 0),
            });
        }
    }
    for (const m of src.matchAll(HEX)) {
        const sha = m[1];
        if (/^[0-9]+$/.test(sha))
            continue; // pure decimal, not a sha
        if (sha.length < 7)
            continue;
        const key = `sha:${sha}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const cat = git(["cat-file", "-e", sha], root);
        if (cat.status !== 0) {
            flags.push({
                kind: "sha",
                text: sha,
                action: "fix",
                detail: `git cat-file -e ${sha} failed — not an object in this repo`,
                line: lineOf(src, m.index ?? 0),
            });
            continue;
        }
        const merge = git(["merge-base", "--is-ancestor", sha, "HEAD"], root);
        if (merge.status !== 0) {
            flags.push({
                kind: "sha",
                text: sha,
                action: "annotate",
                detail: `${sha} exists but is not reachable from HEAD`,
                line: lineOf(src, m.index ?? 0),
            });
        }
    }
    for (const m of src.matchAll(SCAFFOLD)) {
        flags.push({
            kind: "scaffold",
            text: m[0],
            action: "fix",
            detail: `scaffold leak: ${m[0]}`,
            line: lineOf(src, m.index ?? 0),
        });
    }
    for (const m of src.matchAll(MD_LINK)) {
        const href = m[2];
        if (/^(https?:|mailto:|#)/i.test(href))
            continue;
        const target = href.split("#")[0];
        if (!target)
            continue;
        const resolved = resolve(dir, target);
        const mdAlt = target.endsWith(".html") ? resolve(dir, target.replace(/\.html$/, ".md")) : null;
        if (!existsSync(resolved) && !(mdAlt && existsSync(mdAlt))) {
            flags.push({
                kind: "link",
                text: href,
                action: "fix",
                detail: `relative markdown link does not resolve: ${href}`,
                line: lineOf(src, m.index ?? 0),
            });
        }
    }
    return { path: abs, flags };
}
export function formatGroundReport(report) {
    if (!report.flags.length)
        return `sage ground ${report.path}\nno flags`;
    const rows = report.flags.map((f) => `- [${f.action}] ${f.kind} L${f.line ?? "?"}: ${f.detail}`);
    return `sage ground ${report.path}\n${report.flags.length} flag(s)\n${rows.join("\n")}`;
}
const DOC_DIMENSIONS = ["completeness", "consistency", "clarity", "scope", "feasibility"];
export function reviewDocSkeleton(filePath, cwd) {
    const g = groundMechanical(filePath, cwd);
    const lines = [
        `# Document review: ${filePath}`,
        "",
        "Non-blocking. Max 3 iterations; the same issue on two consecutive passes becomes `## Reviewer Concerns` and stops.",
        "Dispatch Lane C (`reviewer`, `readonly: true`) with `skills/sage-review/references/checklists/design-doc.md`.",
        "Unavailable reviewer → one-line notice, do not block.",
        "",
        "## Mechanical ground",
        "",
        formatGroundReport(g),
        "",
        "## Rubric (1–10, Lane C fills these)",
        "",
    ];
    for (const d of DOC_DIMENSIONS) {
        lines.push(`### ${d}`);
        lines.push("");
        lines.push("score: unscored");
        lines.push("");
    }
    lines.push("## Reviewer Concerns");
    lines.push("");
    lines.push("(none yet)");
    lines.push("");
    return lines.join("\n");
}
