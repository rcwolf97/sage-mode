---
name: sage-notebook
description: Render markdown notebook pages to self-contained HTML and rebuild the index.
disable-model-invocation: true
---

# sage-notebook

## Procedure

1. `sage notebook render [--strict]` for pages with `kind` frontmatter.
2. `sage notebook index` writes `docs/index.html`.
3. Copy assets via setup if `docs/assets/notebook.css` is missing.
4. Output is self-contained: local CSS/JS only. Must work from `file://`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The markdown is enough" | Humans browse HTML. Render is part of done. |
| "CDN mermaid is fine" | No network fetches. Vendor locally. |

## Red Flags

- Pages fetching remote CSS/JS
- Missing kind frontmatter skipped without notice
- Horizontal overflow at 390px

## Done when

HTML siblings exist for every kind-bearing markdown page and `docs/index.html` lists them.
