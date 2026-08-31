---
name: perf-profile
description: Catalog skill — CPU, allocations, N+1, hot paths. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "investigating slowness with measurements not guesses"
---

# perf-profile

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Reproduce the slowness under a measurable, repeatable condition first (a specific request, a specific input size, a specific load level). A profile of "the app feels slow" is not a profile of anything.
2. Decide CPU-time vs. wall-clock before picking a tool. A CPU sampling profiler (`pprof`, `py-spy`, `async-profiler`) shows where cycles burn but is blind to time spent blocked on I/O, locks, or a downstream call — for a request that's slow but not CPU-bound, you need wall-clock/off-CPU profiling (`py-spy --idle`, blocking profilers, or a trace span breakdown) or you'll "optimize" code that was never the bottleneck.
3. Take the sample from conditions that match the complaint: same build (not a debug build with assertions on), same data volume, same concurrency — a profile against an empty local DB won't reproduce a query planner choosing a bad index against production-sized tables.
4. Read the flame graph by width, not depth: wide frames are where time is actually spent; a tall narrow stack can be totally irrelevant even if it looks scary. Look for one dominant wide frame before chasing anything else.
5. For anything touching a database or ORM, count queries per request, not just their individual latency — an N+1 (one query to list N items, then N queries to fetch each item's related data) can dominate wall-clock time while every individual query profiles as "fast."
6. Check allocation profiles (not just CPU) when GC pause time or memory growth is part of the complaint — a hot loop that's cheap per-call but allocates on every iteration shows up in GC pressure, not CPU sampling.
7. Fix the single largest frame, re-run the identical profile, and confirm the frame shrank or moved before touching a second thing — profiling one change at a time is what makes the next flame graph meaningful.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This loop looks inefficient, let's optimize it" | Code that looks slow and code that measures slow are frequently different lines — without a flame graph pointing at it, "looks inefficient" is a guess dressed up as an optimization. |
| "The query is fast in isolation, so the endpoint is fine" | A fast query run N times per request (classic N+1) still adds up to the dominant cost of that request; per-query latency hides the multiplication. |
| "We profiled it locally and it's fine" | Local data volumes, cold vs. warm caches, and debug builds routinely hide the exact bottleneck (bad index choice, lock contention under concurrency) that only appears at production scale. |
| "CPU profile shows nothing hot, so it must be network" | A CPU sampling profiler only samples on-CPU time — a request stuck waiting on a lock, a slow downstream call, or I/O shows as near-zero CPU and needs an off-CPU/wall-clock profile to actually see it. |

## Red Flags

- A performance fix with no before/after measurement from the same profiling method
- Query count per request never checked — only individual query latency
- CPU-only profiling used to investigate a complaint that's actually about end-to-end latency (which includes I/O wait)
- Profiling run against synthetic/local data an order of magnitude smaller than production

## Done when

The slow path is reproduced under a fixed condition, a profile (CPU or wall-clock, whichever matches the symptom) identifies the dominant frame or query pattern by measurement, the fix targets that frame specifically, and a re-run of the same profile shows the frame shrank.
