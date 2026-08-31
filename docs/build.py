#!/usr/bin/env python3
"""sage-mode notebook renderer (prototype of the future `sage-notebook` skill).

Converts markdown sources into a self-contained, cross-linked HTML notebook.
Conventions it enforces:
  - every page gets the shared shell + nav
  - a blockquote opening with "In plain terms:" renders as an exec-summary callout
  - ```mermaid fences render as real diagrams
  - links to *.md are rewritten to *.html
"""
import html
import os
import re
import shutil
import sys

import markdown

SRC = "/home/claude/sage-docs"
OUT = "/home/claude/nb"

PAGES = [
    # (src_md, out_path, section, title, subtitle)
    ("competitive-analysis.md", "design/competitive-analysis.html", "design",
     "Competitive Analysis",
     "A second no-context agent, this time with full access to all four repos — gstack and compound-engineering each win decisively on their own headline strength, plus a live sage-careful regression found and fixed"),
    ("blind-comparison.md", "design/blind-comparison.html", "design",
     "Blind Comparative Review",
     "Plugin code only, no docs, judged against gstack and superpowers — gstack first, superpowers close second, sage-mode-plugin last on one damning finding"),
    ("adversarial-review.md", "design/adversarial-review.html", "design",
     "Adversarial Re-Review",
     "Ready with caveats — a new D2 false negative found and closed, plus what the fix pass missed"),
    ("architecture-v3.md", "design/architecture-v3.html", "design",
     "sage-mode Architecture v3",
     "Eight commands, an org underneath, and a cost architecture that makes it runnable daily"),
    ("build-review.md", "design/build-review.html", "design",
     "Implementation Review",
     "The team's v1 against the spec — three blockers, eight major issues, and what was done well"),
    ("tech-spec.md", "design/tech-spec.html", "design",
     "Technical Specification v1.0",
     "Build sage-mode from an empty directory — contracts, libraries, hooks, skills, and 24 work packages"),
    ("design-org.md", "design/design-org.html", "design",
     "The Design Org",
     "Six design commands, an agency of roles, and a rubric for detecting AI-generated design"),
    ("scorecard.md", "research/scorecard.html", "research",
     "Scorecard",
     "sage-mode against the five, on twelve dimensions — with the maturity caveat kept separate"),
    ("architecture-v2.md", "design/architecture-v2.html", "design",
     "sage-mode Architecture v2",
     "Superseded by v3 — introduced the org chart and the sprint model"),
    ("gstack-coding-mechanics.md", "research/gstack-coding-mechanics.html", "research",
     "gstack's Implementation Machinery",
     "Line-by-line teardown of how gstack builds, reviews, verifies and ships — the quotable source"),
    ("architecture.md", "design/architecture.html", "design",
     "sage-mode Architecture v0.1",
     "Superseded by v2 — kept for the record"),
    ("cursor-capabilities.md", "research/cursor-capabilities.html", "research",
     "What Cursor Can Actually Do",
     "August 2026 — plugins, skills, subagents, hooks, parallelism, and the three limits that change the design"),
    ("overview.md", "research/overview.html", "research",
     "Five Repos, Compared",
     "What each one fundamentally believes, where they conflict, and what none of them solve"),
    ("agent-skills.md", "research/agent-skills.html", "research",
     "agent-skills", "Addy Osmani — Google SDLC practice, encoded as prompts"),
    ("compound-engineering-plugin.md", "research/compound-engineering-plugin.html", "research",
     "Compound Engineering", "Every Inc — each unit of work should make the next one cheaper"),
    ("gstack.md", "research/gstack.html", "research",
     "gstack", "Garry Tan — simulate the whole org, boil the ocean"),
    ("superpowers.md", "research/superpowers.html", "research",
     "superpowers", "Jesse Vincent — the model will talk itself out of the process"),
    ("ui-ux-pro-max-skill.md", "research/ui-ux-pro-max-skill.html", "research",
     "UI/UX Pro Max", "nextlevelbuilder — the model has no taste and no eyes"),
]

NAV = [
    ("Home", "index.html", "home"),
    ("Design", "design/tech-spec.html", "design"),
    ("Research", "research/overview.html", "research"),
]

CSS = r"""
:root{
  --bg:#fbfaf8; --surface:#ffffff; --surface-2:#f4f2ee; --line:#e3ded6;
  --ink:#1c1a17; --ink-2:#4e4941; --ink-3:#847c70;
  --accent:#8a4b2a; --accent-soft:#f3e6de; --accent-line:#d8a583;
  --code-bg:#f4f2ee; --shadow:0 1px 2px rgba(28,26,23,.05),0 8px 24px -12px rgba(28,26,23,.18);
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  --sans:ui-sans-serif,-apple-system,"Segoe UI",Inter,Helvetica,Arial,sans-serif;
  --serif:ui-serif,Georgia,"Iowan Old Style","Times New Roman",serif;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#14130f; --surface:#1c1a17; --surface-2:#232019; --line:#332f27;
    --ink:#f0ece5; --ink-2:#bdb5a8; --ink-3:#8a8275;
    --accent:#e5a173; --accent-soft:#2a2119; --accent-line:#7a5537;
    --code-bg:#221f19; --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 28px -14px rgba(0,0,0,.7);
  }
}
:root[data-theme="dark"]{
  --bg:#14130f; --surface:#1c1a17; --surface-2:#232019; --line:#332f27;
  --ink:#f0ece5; --ink-2:#bdb5a8; --ink-3:#8a8275;
  --accent:#e5a173; --accent-soft:#2a2119; --accent-line:#7a5537;
  --code-bg:#221f19; --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 28px -14px rgba(0,0,0,.7);
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);
  font-size:16.5px;line-height:1.65;letter-spacing:-.005em}
a{color:var(--accent);text-decoration:none;border-bottom:1px solid transparent}
a:hover{border-bottom-color:var(--accent-line)}

/* ---- top bar ---- */
.bar{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--bg) 86%,transparent);
  backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.bar-in{max-width:1180px;margin:0 auto;padding:.7rem 1.5rem;display:flex;align-items:center;gap:1.6rem}
.brand{font-family:var(--mono);font-size:.82rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink);font-weight:600;border:0}
.brand span{color:var(--accent)}
.bar nav{display:flex;gap:1.1rem;margin-left:auto;flex-wrap:wrap}
.bar nav a{font-size:.86rem;color:var(--ink-2);border:0;padding:.15rem 0}
.bar nav a:hover{color:var(--ink)}
.bar nav a.on{color:var(--ink);font-weight:600;box-shadow:inset 0 -2px 0 var(--accent-line)}

/* ---- layout ---- */
.wrap{max-width:1180px;margin:0 auto;padding:0 1.5rem 6rem;display:grid;
  grid-template-columns:minmax(0,1fr) 232px;gap:3.2rem}
main{min-width:0;padding-top:2.6rem}
.toc{position:sticky;top:5rem;align-self:start;padding-top:3.4rem;font-size:.83rem;line-height:1.5}
.toc-h{font-family:var(--mono);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink-3);margin-bottom:.7rem}
.toc a{display:block;color:var(--ink-2);padding:.24rem 0 .24rem .7rem;border:0;
  border-left:2px solid var(--line)}
.toc a:hover{color:var(--ink);border-left-color:var(--accent-line)}
@media(max-width:940px){.wrap{grid-template-columns:1fr;gap:0}.toc{display:none}}

/* ---- header ---- */
.page-head{margin-bottom:2.4rem;padding-bottom:1.6rem;border-bottom:1px solid var(--line)}
.eyebrow{font-family:var(--mono);font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--accent);margin-bottom:.7rem}
h1{font-family:var(--serif);font-size:clamp(2rem,4.4vw,2.9rem);line-height:1.08;margin:0;
  letter-spacing:-.02em;font-weight:600}
.sub{color:var(--ink-2);font-size:1.03rem;margin-top:.7rem;max-width:62ch}

/* ---- prose ---- */
main h1:not(.page-head h1){display:none}
h2{font-family:var(--serif);font-size:1.62rem;line-height:1.2;margin:3.2rem 0 .9rem;
  letter-spacing:-.015em;font-weight:600;scroll-margin-top:5rem}
h2:first-of-type{margin-top:1rem}
h3{font-size:1.06rem;margin:2rem 0 .6rem;font-weight:650;letter-spacing:-.005em;scroll-margin-top:5rem}
h4{font-size:.94rem;margin:1.5rem 0 .4rem;font-weight:650;color:var(--ink-2)}
p{margin:0 0 1.05rem;max-width:74ch}
ul,ol{margin:0 0 1.05rem;padding-left:1.3rem;max-width:74ch}
li{margin:.32rem 0}
li>p{margin:.3rem 0}
hr{border:0;border-top:1px solid var(--line);margin:2.8rem 0}
strong{font-weight:650;color:var(--ink)}

/* ---- exec summary callout ---- */
blockquote{margin:0 0 1.4rem;padding:1rem 1.15rem;background:var(--accent-soft);
  border-left:3px solid var(--accent-line);border-radius:0 8px 8px 0;color:var(--ink)}
blockquote p{margin:0;max-width:70ch;font-size:1.02rem}
blockquote p+p{margin-top:.6rem}
blockquote strong:first-child{font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--accent);display:block;margin-bottom:.35rem}

/* ---- code ---- */
code{font-family:var(--mono);font-size:.855em;background:var(--code-bg);padding:.12em .38em;
  border-radius:4px;border:1px solid var(--line)}
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:10px;padding:1rem 1.1rem;
  overflow-x:auto;margin:0 0 1.4rem;font-size:.86rem;line-height:1.55}
pre code{background:none;border:0;padding:0;font-size:1em}

/* ---- tables ---- */
.tw{overflow-x:auto;margin:0 0 1.5rem;border:1px solid var(--line);border-radius:10px;
  background:var(--surface);box-shadow:var(--shadow)}
table{border-collapse:collapse;width:100%;font-size:.885rem;line-height:1.5}
th,td{text-align:left;padding:.62rem .85rem;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--surface-2);font-weight:650;font-size:.76rem;letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink-2);white-space:nowrap}
tr:last-child td{border-bottom:0}
td code{font-size:.84em}

/* ---- mermaid ---- */
.mermaid{background:var(--surface);border:1px solid var(--line);border-radius:10px;
  padding:1.4rem;margin:0 0 1.5rem;text-align:center;overflow-x:auto;box-shadow:var(--shadow)}

/* ---- index cards ---- */
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:1rem;margin:1.2rem 0 2.4rem}
.card{display:block;background:var(--surface);border:1px solid var(--line);border-radius:12px;
  padding:1.15rem 1.2rem;box-shadow:var(--shadow);transition:transform .12s ease,border-color .12s ease}
.card:hover{transform:translateY(-2px);border-color:var(--accent-line)}
.card .k{font-family:var(--mono);font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);margin-bottom:.5rem}
.card .t{font-family:var(--serif);font-size:1.16rem;font-weight:600;color:var(--ink);
  margin-bottom:.35rem;line-height:1.25}
.card .d{font-size:.87rem;color:var(--ink-2);line-height:1.5}
.card.ghost{border-style:dashed;box-shadow:none;opacity:.62}
.card.ghost:hover{transform:none;border-color:var(--line)}

.lede{font-family:var(--serif);font-size:1.22rem;line-height:1.55;color:var(--ink-2);
  max-width:68ch;margin:0 0 2.2rem}
.sec-h{font-family:var(--mono);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--ink-3);margin:2.6rem 0 .2rem;padding-bottom:.6rem;border-bottom:1px solid var(--line)}

/* ---- score matrix ---- */
.smx table{font-size:.83rem}
.smx th{padding:.5rem .42rem;font-size:.68rem}
.smx th:not(.dim){text-align:left;white-space:nowrap}
.smx .dim{width:26%;min-width:186px;max-width:260px;white-space:normal}
.smx .dim b{display:block;font-weight:650}
.smx .note{display:block;font-size:.76rem;color:var(--ink-3);margin-top:.22rem;line-height:1.42;
  font-weight:400;text-transform:none;letter-spacing:0}
.smx .wt{display:block;font-family:var(--mono);font-size:.64rem;color:var(--ink-3);margin-top:.32rem;
  letter-spacing:.06em}
.smx td.sc{white-space:nowrap;padding:.5rem .42rem;vertical-align:middle}
.smx .bw{display:inline-block;width:36px;height:6px;background:var(--surface-2);
  border:1px solid var(--line);border-radius:4px;overflow:hidden;vertical-align:middle;margin-right:.45rem}
.smx .b{display:block;height:100%;background:var(--accent-line);border-radius:4px}
.smx .b.design{background:var(--accent)}
.smx .b.mat{background:var(--ink-3)}
.smx .sv{font-family:var(--mono);font-size:.74rem;color:var(--ink-2);vertical-align:middle}
.smx tfoot td{border-top:2px solid var(--line);border-bottom:0}
.smx tfoot .dim b{font-weight:700}
.cap{font-size:.8rem;color:var(--ink-3);margin:-.9rem 0 1.8rem;max-width:74ch}
.foot{margin-top:4rem;padding-top:1.4rem;border-top:1px solid var(--line);
  font-size:.8rem;color:var(--ink-3);font-family:var(--mono)}
"""

SHELL = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · sage-mode</title>
<link rel="stylesheet" href="{root}assets/notebook.css">
</head>
<body>
<div class="bar"><div class="bar-in">
  <a class="brand" href="{root}index.html">sage<span>·</span>mode</a>
  <nav>{nav}</nav>
</div></div>
<div class="wrap">
<main>
  <div class="page-head">
    <div class="eyebrow">{eyebrow}</div>
    <h1>{title}</h1>
    {subline}
  </div>
  {body}
  <div class="foot">sage-mode notebook · rendered {date}</div>
</main>
{toc}
</div>
<script src="{root}assets/mermaid.min.js"></script>
<script>
(function(){{
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  try {{
    mermaid.initialize({{
      startOnLoad:true,
      theme: dark ? 'dark' : 'neutral',
      themeVariables: dark
        ? {{ background:'#1c1a17', primaryColor:'#232019', primaryTextColor:'#f0ece5',
             primaryBorderColor:'#7a5537', lineColor:'#8a8275', fontSize:'14px' }}
        : {{ background:'#ffffff', primaryColor:'#f4f2ee', primaryTextColor:'#1c1a17',
             primaryBorderColor:'#d8a583', lineColor:'#847c70', fontSize:'14px' }},
      flowchart:{{ curve:'basis', htmlLabels:true }}
    }});
  }} catch(e) {{}}
}})();
</script>
</body>
</html>
"""


def render_md(text: str) -> str:
    md = markdown.Markdown(extensions=["tables", "fenced_code", "toc", "attr_list", "sane_lists"])
    return md.convert(text)


def postprocess(body: str) -> str:
    # mermaid fences -> live diagrams
    def mm(m):
        return '<pre class="mermaid">' + html.unescape(m.group(1)) + "</pre>"

    body = re.sub(
        r'<pre><code class="language-mermaid">(.*?)</code></pre>', mm, body, flags=re.S
    )
    # wrap tables for horizontal scroll
    body = re.sub(r"<table>", '<div class="tw"><table>', body)
    body = re.sub(r"</table>", "</table></div>", body)
    # rewrite intra-notebook .md links to .html
    body = re.sub(r'(href="[^"]*?)\.md(")', r"\1.html\2", body)
    return body


def build_toc(body: str) -> str:
    heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body, flags=re.S)
    if len(heads) < 3:
        return ""
    items = "".join(
        '<a href="#{}">{}</a>'.format(i, re.sub(r"<[^>]+>", "", t).strip()) for i, t in heads
    )
    return '<aside class="toc"><div class="toc-h">On this page</div>' + items + "</aside>"


def nav_html(active: str, root: str) -> str:
    out = []
    for label, href, key in NAV:
        cls = ' class="on"' if key == active else ""
        out.append('<a href="{}{}"{}>{}</a>'.format(root, href, cls, label))
    return "".join(out)


def write_page(out_path, section, title, subtitle, body_md, date, drop_h1=True):
    text = body_md
    if drop_h1:
        text = re.sub(r"\A#\s+.*?\n", "", text, count=1)
    body = postprocess(render_md(text))
    depth = out_path.count("/")
    root = "../" * depth
    eyebrow = {"design": "Design", "research": "Research", "home": "Notebook"}[section]
    page = SHELL.format(
        title=html.escape(title),
        subline='<div class="sub">{}</div>'.format(html.escape(subtitle)) if subtitle else "",
        eyebrow=eyebrow,
        nav=nav_html(section, root),
        body=body,
        toc=build_toc(body),
        root=root,
        date=date,
    )
    full = os.path.join(OUT, out_path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(page)
    return out_path


def main():
    date = "2026-08-25"
    os.makedirs(os.path.join(OUT, "assets"), exist_ok=True)
    with open(os.path.join(OUT, "assets", "notebook.css"), "w") as f:
        f.write(CSS)
    if not os.path.exists(os.path.join(OUT, "assets", "mermaid.min.js")):
        shutil.copy("/tmp/node_modules/mermaid/dist/mermaid.min.js",
                    os.path.join(OUT, "assets", "mermaid.min.js"))

    for src, out, section, title, sub in PAGES:
        with open(os.path.join(SRC, src)) as f:
            write_page(out, section, title, sub, f.read(), date)
        print("built", out)

    with open(os.path.join(SRC, "index_body.html")) as f:
        idx_body = f.read()
    page = SHELL.format(
        title="sage-mode", subline='<div class="sub">A Cursor plugin for going from idea to '
        "shipped feature in a day — and a notebook that remembers how.</div>",
        eyebrow="Project notebook", nav=nav_html("home", ""), body=idx_body, toc="",
        root="", date=date)
    with open(os.path.join(OUT, "index.html"), "w") as f:
        f.write(page)
    print("built index.html")


if __name__ == "__main__":
    main()
