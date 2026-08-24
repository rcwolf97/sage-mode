---
name: sage-notebook
description: Render markdown notebook pages to self-contained HTML and rebuild the index.
disable-model-invocation: true
---

# sage-notebook

Thin wrapper around `lib/notebook`. Every skill that writes or edits a page under `docs/` (roadmap, spec, plan, review, learning, decision, brief) calls this afterward; it also runs standalone to rebuild the whole notebook.

## Procedure

1. Confirm the page(s) you just wrote carry frontmatter with at minimum `title` and `kind` (`roadmap|spec|plan|review|learning|decision|brief|note`). A page missing `kind` is silently skipped by the renderer — that's a bug in whatever wrote the page, not something to route around here.
2. `sage notebook render --strict`, scoped to the page(s) that changed or with no args to re-render everything under `docs/`. Use `--strict` by default: it fails the build if a `kind: spec|plan|roadmap` page has a `##` section with no leading "In plain terms:" exec-summary blockquote. Fix the missing callout in the source markdown — do not drop `--strict` to get past it.
3. If render warns that a mermaid label was stripped of `<`, `>`, or `` ` ``, those characters silently corrupt the diagram if left in. Edit the source fence to remove them and re-render; don't ignore the warning.
4. `sage notebook index` regenerates `docs/index.html` from the frontmatter of every rendered page. Run it after any render that added a page or changed a `title`, `kind`, or `status`.
5. If `docs/assets/` (`notebook.css`, `mermaid.min.js`) is missing, that's a `/sage-setup` gap, not a notebook one — run setup to vendor it rather than fetching anything from the network.
6. Spot-check one changed page's `.html` sibling: no remote CSS/JS references, `*.md` links rewritten to `*.html`, tables scroll inside their own wrapper (never the page body), and it would render correctly at 390px wide.

## Common Rationalizations
| Rationalization | Reality |
|---|---|
| "The markdown is enough" | Humans and the index browse HTML. Render is part of done, not a follow-up nicety. |
| "CDN mermaid is fine, it's just a diagram" | Output must work from `file://` with no internet. Every asset is vendored under `docs/assets/`. |
| "I'll drop --strict, the callout is trivial" | `--strict` is the only thing that catches a missing exec-summary before a human does. Fix the doc, not the flag. |

## Red Flags
- A page with `kind` frontmatter missing from `docs/index.html` and nobody noticed
- A mermaid label-stripped warning in render output, ignored instead of fixed at the source
- A colour defined only inside a `@media` or `[data-theme]` block instead of also on bare `:root`
- Horizontal scroll on the page body itself (tables scroll in their own wrapper; the body never should)

## Done when
Every markdown page with `kind` frontmatter has an up-to-date `.html` sibling, `docs/index.html` lists it, and `sage notebook render --strict` exits clean.
