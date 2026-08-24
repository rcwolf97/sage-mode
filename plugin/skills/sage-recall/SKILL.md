---
name: sage-recall
description: BM25 search over the project notebook and the skill catalog. Use when looking up prior learnings or which catalog skill applies.
---

# sage-recall

May be model-invoked directly — the one skill in the catalog without `disable-model-invocation: true` — because retrieval only helps if a model can reach for it mid-task rather than waiting to be told. Reach for it unprompted whenever you're about to answer from memory about prior learnings, decisions, or which catalog skill covers something. Other skills also invoke it explicitly and expect a result back: `sage-shape`'s grounding step, `sage-plan`'s open-findings lookup, `sage-retro`'s dedup check.

## What it searches
BM25 over `docs/**/*.md` (the notebook: roadmap, specs, plans, reviews, learnings, decisions) and `skills/**/SKILL.md` (the catalog), indexed into `.sage/index.json`.

## Procedure
1. If `.sage/index.json` is missing, or pages were written/edited since the last index and nobody reindexed (a fresh sprint, a batch of new learnings), run `sage recall index` first.
2. `sage recall "<query>" [--kind K] [-n N]`. Default N = 5. Use `--kind` (`spec|plan|review|learning|decision|...`) to narrow when you already know the page type.
3. Each hit is `{id, path, kind, title, score, snippet}`; the snippet is truncated to ≤200 chars for display. Pass `--json` when the caller needs full, untruncated records — e.g. handing a path on to another skill.
4. Zero results → say "no results" and stop. Never fabricate a match or fall back to answering from general memory.
5. For `/sage-retro`: `sage recall dedup --applies-when "<text>"` returns existing learnings above a similarity threshold — update the matched record instead of writing a new one.

## Common Rationalizations
| Rationalization | Reality |
|---|---|
| "No hits, I'll just answer from memory" | Never present a 0-result search as if it returned data. Say "no results." |
| "I'll dump the whole docs/ folder instead" | Retrieval exists so context cost doesn't grow with the size of the knowledge base. Reading everything defeats the point. |
| "Close enough, I won't bother with dedup" | A near-duplicate learning that skips dedup is the 79th unsearchable file, not a new insight. |

## Red Flags
- Invented citations — a path or title that didn't come back in the actual results
- Skipping the reindex after a batch of new pages, then wondering why recent work doesn't show up
- Returning more than N rows, or rows outside a requested `--kind`, unasked

## Done when
The caller received either ranked hits (text or `--json`) or an explicit "no results" — never silence, never an improvised answer.
