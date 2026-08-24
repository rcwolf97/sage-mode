---
name: sage-recall
description: BM25 search over the project notebook and the skill catalog. Use when looking up prior learnings or which catalog skill applies.
---

# sage-recall

May be model-invoked so other skills can pull it in.

## Procedure

1. If `.sage/index.json` is missing or stale, `sage recall index`.
2. `sage recall "<query>" [--kind K] [-n N]`. Default N=5.
3. Zero results → say "no results". Never fabricate a match.
4. For retro: `sage recall dedup --applies-when "<text>"`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "No hits, I'll just answer from memory" | Never present a 0-result search as if it returned data. |
| "I'll dump the whole docs/ folder instead" | Retrieval exists so context cost does not grow with knowledge. |

## Red Flags

- Invented citations
- Skipping index rebuild after many new pages
- Returning more than N unsolicited rows

## Done when

The caller received ranked hits or an explicit empty result.
