# Dedup and non-convergence: worked examples

**Trigger:** load this when two findings in a merged list look like the same
issue and it's unclear whether `dedup` should have merged them, or when a
review cycle's findings look identical to an earlier cycle's and it's unclear
whether that counts as non-convergence.

## Worked fingerprint merge

Wave 1 (parallel): the `security` specialist reviews `src/api/ingest.ts` and
emits:

```json
{"severity":"CRITICAL","confidence":8,"path":"src/api/ingest.ts","line":142,
 "category":"security","summary":"Rate limit key is derived from a
 client-controlled header.","evidence":"const key = req.headers['x-api-key']
 ?? req.ip","specialist":"security","fingerprint":"src/api/ingest.ts:142:security"}
```

Wave 2 (red team, sequential, handed the merged wave-1 findings): re-derives
its own diff, independently lands on the same line, and — because red team's
findings also carry a `category`, and this one is a security issue — emits:

```json
{"severity":"CRITICAL","confidence":7,"path":"src/api/ingest.ts","line":142,
 "category":"security","summary":"Client can set the rate-limit key to
 anything by setting x-api-key.","evidence":"req.headers['x-api-key'] ??
 req.ip — client-supplied, unauthenticated","specialist":"red-team",
 "fingerprint":"src/api/ingest.ts:142:security"}
```

Same `path:line:category` → same fingerprint → `dedup` merges them: keeps the
higher confidence (8), tags `MULTI-SPECIALIST CONFIRMED (security +
red-team)`, boosts to 9 (capped at 10). Two independent passes landing on the
same line is itself evidence, which is the whole justification for the boost.

**Why this doesn't happen constantly:** most specialists have disjoint
categories by design (`security` vs. `performance` vs. `testing`), so most
findings on the same line still produce different fingerprints and don't
merge. A merge is a real signal, not routine noise — treat a
`MULTI-SPECIALIST CONFIRMED` tag as meaningfully stronger than an unconfirmed
finding at the same raw confidence.

## Worked non-convergence report

Cycle 1: `correctness` flags an N+1 query in `getOrdersForUser` (AUTO-FIX,
mechanical). Applied. Verify passes. Re-review of the new diff.

Cycle 2: `correctness` flags a *different* N+1, in `getOrderLineItems`,
introduced by the cycle-1 fix restructuring the join. AUTO-FIX. Applied.
Verify passes. Re-review.

Cycle 3: `correctness` flags a third N+1, in `enrichOrderTotals`, introduced
by the cycle-2 fix. This is cycle 3 still applying a fix — the loop halts
here regardless of whether cycle 3's fix itself succeeds.

**What the stop report says**, concretely — not "review didn't converge" but:

> Halted at cycle 3. `getOrdersForUser` → `getOrderLineItems` →
> `enrichOrderTotals`: each fix for an N+1 in the order-total path introduced
> a new one one level up. This is not three unrelated findings; it's one
> query-shape problem in how order totals get built, and it needs a person to
> decide whether to eager-load the whole aggregate instead of patching each
> query as it's found.

The report names the pattern across cycles, not just the cycle-3 finding in
isolation — that's what makes it useful to the human who picks it up instead
of just restarting the loop.
