import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "../vendor/marked/marked.esm.js";
import { parseFrontmatter, projectDocsDir } from "../util.js";

const SHELL_CSS_HREF = "assets/notebook.css";
const MERMAID_HREF = "assets/mermaid.min.js";

export interface RenderOptions {
  strict?: boolean;
  assetsRel?: string;
}

export interface PageMeta {
  title: string;
  kind?: string;
  path: string;
  htmlPath: string;
  status?: string;
  tags?: string[];
  sprint?: string;
}

function walkMd(root: string, acc: string[] = []): string[] {
  if (!existsSync(root)) return acc;
  for (const name of readdirSync(root)) {
    if (name === "assets" || name.startsWith(".")) continue;
    const p = join(root, name);
    const st = statSync(p);
    if (st.isDirectory()) walkMd(p, acc);
    else if (name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

function relTo(fromFile: string, toFile: string): string {
  const rel = relative(dirname(fromFile), toFile);
  return rel.split("\\").join("/") || ".";
}

function assetPrefix(htmlPath: string, docsRoot: string): string {
  const rel = relative(dirname(htmlPath), join(docsRoot, "assets"));
  return rel.split("\\").join("/") || "assets";
}

function rewriteMdLinks(html: string): string {
  return html.replace(/href="([^"]+)\.md(#[^"]*)?"/g, (_m, p, hash) => `href="${p}.html${hash || ""}"`);
}

function wrapTables(html: string): string {
  return html.replace(/<table[\s\S]*?<\/table>/g, (t) => `<div class="tw">${t}</div>`);
}

function stripBadMermaid(src: string, warnings: string[]): string {
  return src.replace(/```mermaid\n([\s\S]*?)```/g, (_m, body: string) => {
    let cleaned = body.replace(/[<>]/g, "");
    if (cleaned !== body) warnings.push("stripped angle brackets from mermaid labels");
    return "```mermaid\n" + cleaned + "```";
  });
}

function mermaidify(html: string): string {
  return html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (_m, body) => {
    return `<div class="mermaid">${body}</div>`;
  });
}

function execSummaries(html: string): string {
  return html.replace(/<blockquote>\s*<p><strong>In plain terms:<\/strong>/g, '<blockquote class="exec"><p><strong>In plain terms:</strong>');
}

function missingPlainTerms(body: string, kind: string | undefined): string[] {
  if (!kind || !["spec", "plan", "roadmap"].includes(kind)) return [];
  const sections = body.split(/\n## /).slice(1);
  const missing: string[] = [];
  for (const sec of sections) {
    const title = sec.split(/\n/, 1)[0]?.trim() || "";
    const rest = sec.slice(title.length);
    if (!/>\s*\*\*In plain terms:\*\*/.test(rest) && !/> \*\*In plain terms:\*\*/.test(rest)) {
      missing.push(title);
    }
  }
  return missing;
}

function shell(opts: {
  title: string;
  subtitle?: string;
  kind?: string;
  body: string;
  assets: string;
  nav: { href: string; label: string; on?: boolean }[];
}): string {
  const nav = opts.nav
    .map((n) => `<a href="${n.href}"${n.on ? ' class="on"' : ""}>${n.label}</a>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<link rel="stylesheet" href="${opts.assets}/notebook.css">
</head>
<body>
<div class="bar"><div class="bar-in">
  <a class="brand" href="${relIndex(opts.assets)}">sage<span>·</span>mode</a>
  <nav>${nav}</nav>
</div></div>
<div class="wrap">
<main>
  <div class="page-head">
    ${opts.kind ? `<div class="eyebrow">${escapeHtml(opts.kind)}</div>` : ""}
    <h1>${escapeHtml(opts.title)}</h1>
    ${opts.subtitle ? `<div class="sub">${escapeHtml(opts.subtitle)}</div>` : ""}
  </div>
  ${opts.body}
</main>
</div>
<script src="${opts.assets}/mermaid.min.js"></script>
<script>if (window.mermaid) mermaid.initialize({ startOnLoad: true, theme: "neutral" });</script>
</body>
</html>
`;
}

function relIndex(assets: string): string {
  // assets is relative from the page to docs/assets; index is docs/index.html
  if (assets === "assets" || assets === "./assets") return "index.html";
  return assets.replace(/\/?assets$/, "") + (assets.includes("/") ? "/index.html" : "index.html");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function render(srcPath: string, options: RenderOptions = {}): string {
  const raw = readFileSync(srcPath, "utf8");
  const { data, body } = parseFrontmatter(raw);
  const warnings: string[] = [];
  const cleaned = stripBadMermaid(body, warnings);
  for (const w of warnings) process.stderr.write(`sage notebook: warning: ${w}\n`);
  if (options.strict) {
    const miss = missingPlainTerms(cleaned, typeof data.kind === "string" ? data.kind : undefined);
    if (miss.length) {
      throw new Error(`strict: missing "In plain terms:" under: ${miss.join(", ")}`);
    }
  }
  let html = marked.parse(cleaned, { async: false }) as string;
  html = rewriteMdLinks(html);
  html = wrapTables(html);
  html = mermaidify(html);
  html = execSummaries(html);
  const docsRoot = inferDocsRoot(srcPath);
  const htmlPath = srcPath.replace(/\.md$/, ".html");
  const assets = options.assetsRel || assetPrefix(htmlPath, docsRoot);
  const title = String(data.title || basenameTitle(srcPath));
  const page = shell({
    title,
    subtitle: data.kind ? String(data.kind) : undefined,
    kind: data.kind ? String(data.kind) : undefined,
    body: html,
    assets,
    nav: [
      { href: joinRel(assets, "index.html"), label: "Home", on: false },
      { href: htmlPath.endsWith("roadmap.html") ? "#" : joinRel(assets, "roadmap.html"), label: "Roadmap" },
    ],
  });
  writeFileSync(htmlPath, page);
  return htmlPath;
}

function joinRel(assets: string, file: string): string {
  const up = assets.replace(/\/?assets$/, "") || ".";
  if (up === "." || up === "") return file;
  return `${up}/${file}`.replace(/^\.\//, "");
}

function basenameTitle(p: string): string {
  return p.split("/").pop()?.replace(/\.md$/, "") || "untitled";
}

function inferDocsRoot(srcPath: string): string {
  let dir = dirname(resolve(srcPath));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "assets", "notebook.css")) || dir.endsWith("/docs")) return dir.endsWith("/docs") ? dir : join(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return projectDocsDir();
}

export function renderAll(root?: string, options: RenderOptions = {}): string[] {
  const docs = root || projectDocsDir();
  const out: string[] = [];
  for (const md of walkMd(docs)) {
    const raw = readFileSync(md, "utf8");
    const { data } = parseFrontmatter(raw);
    if (!data.kind) continue;
    out.push(render(md, options));
  }
  return out;
}

export function index(root?: string): string {
  const docs = root || projectDocsDir();
  const pages: PageMeta[] = [];
  for (const md of walkMd(docs)) {
    const raw = readFileSync(md, "utf8");
    const { data } = parseFrontmatter(raw);
    if (!data.kind && !data.title) continue;
    const htmlPath = md.replace(/\.md$/, ".html");
    pages.push({
      title: String(data.title || basenameTitle(md)),
      kind: data.kind ? String(data.kind) : undefined,
      path: relative(docs, md),
      htmlPath: relative(docs, htmlPath),
      status: data.status ? String(data.status) : undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
      sprint: data.sprint ? String(data.sprint) : undefined,
    });
  }
  pages.sort((a, b) => a.title.localeCompare(b.title));
  const cards = pages
    .map((p) => {
      const href = p.htmlPath.split("\\").join("/");
      return `<a class="card" href="${href}"><div class="k">${escapeHtml(p.kind || "note")}</div><div class="t">${escapeHtml(p.title)}</div><div class="d">${escapeHtml(p.status || p.path)}</div></a>`;
    })
    .join("\n");
  const html = shell({
    title: "Notebook",
    kind: "home",
    body: `<p class="lede">Project notebook — specs, plans, reviews, learnings.</p><div class="cards">${cards || '<div class="card ghost"><div class="t">Empty</div><div class="d">Run /sage-shape to start.</div></div>'}</div>`,
    assets: "assets",
    nav: [{ href: "index.html", label: "Home", on: true }],
  });
  const out = join(docs, "index.html");
  mkdirSync(docs, { recursive: true });
  writeFileSync(out, html);
  return out;
}

export function copyAssets(docsRoot?: string, sageHome?: string): void {
  const docs = docsRoot || projectDocsDir();
  const home = sageHome || resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const src = join(home, "docs", "assets");
  const dest = join(docs, "assets");
  mkdirSync(dest, { recursive: true });
  for (const name of ["notebook.css", "mermaid.min.js"]) {
    const from = join(src, name);
    if (existsSync(from)) copyFileSync(from, join(dest, name));
  }
}

void SHELL_CSS_HREF;
void MERMAID_HREF;
